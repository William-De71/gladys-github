// -----------------------------------------------------------------------------
// GitHub GraphQL client.
//
// One request per round reads everything: the authenticated account, the API
// quota and every followed repository (one alias per repository, owner and
// name passed as variables, never spliced into the query). A query costs
// 1 point of the 5,000 points an hour GitHub grants to a token, whatever the
// number of repositories (up to 20): even a 60-second interval uses about 1 %
// of the quota.
//
// GraphQL answers HTTP 200 with partial data when one repository is missing
// (renamed, deleted, private without access): its alias is null and the
// `errors` array names it. The other repositories are read as usual.
//
// Errors are GithubError with a `kind`:
//   - `auth`        401: the token is missing, wrong, expired or revoked;
//   - `rate_limit`  403/429 with an exhausted quota, or a RATE_LIMITED error;
//   - `forbidden`   403 otherwise (token without the needed access);
//   - `server`      5xx;
//   - `network`     no answer (DNS, timeout, connection reset);
//   - `invalid`     an answer that is not the expected JSON.
// -----------------------------------------------------------------------------

const GRAPHQL_URL = 'https://api.github.com/graphql';
const TIMEOUT_MS = 20000;
const MAX_REPOSITORIES = 20;
// The newest items read per round: enough to report every issue, pull
// request, release or commit of a busy repository between two rounds.
const RECENT_COUNT = 5;

class GithubError extends Error {
  /**
   * @param {string} kind - auth | rate_limit | forbidden | server | network | invalid.
   * @param {string} message - The message.
   * @param {object} [extra] - `{ status, resetAt }`.
   */
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'GithubError';
    this.kind = kind;
    this.status = extra.status ?? 0;
    this.resetAt = extra.resetAt ?? null;
  }
}

const REPOSITORY_FRAGMENT = `
fragment repo on Repository {
  databaseId
  nameWithOwner
  url
  description
  isArchived
  isPrivate
  stargazerCount
  forkCount
  watchers { totalCount }
  openIssues: issues(states: OPEN) { totalCount }
  openPullRequests: pullRequests(states: OPEN) { totalCount }
  mergedPullRequests: pullRequests(states: MERGED) { totalCount }
  discussions(first: 1, orderBy: { field: CREATED_AT, direction: DESC }) {
    totalCount
    nodes { number title url createdAt author { login } }
  }
  latestIssues: issues(first: ${RECENT_COUNT}, orderBy: { field: CREATED_AT, direction: DESC }) {
    nodes { number title url createdAt author { login } }
  }
  latestPullRequests: pullRequests(first: ${RECENT_COUNT}, orderBy: { field: CREATED_AT, direction: DESC }) {
    nodes { number title url createdAt isDraft author { login } }
  }
  releases(first: ${RECENT_COUNT}, orderBy: { field: CREATED_AT, direction: DESC }) {
    nodes {
      databaseId name tagName url isDraft isPrerelease publishedAt createdAt
      author { login }
      releaseAssets(first: 50) { nodes { downloadCount } }
    }
  }
  tags: refs(refPrefix: "refs/tags/", first: 1, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
    nodes {
      name
      target {
        __typename
        ... on Commit { url }
        ... on Tag { target { ... on Commit { url } } }
      }
    }
  }
  defaultBranchRef {
    name
    target {
      ... on Commit {
        oid
        statusCheckRollup { state }
        history(first: ${RECENT_COUNT}) {
          nodes { oid abbreviatedOid messageHeadline url committedDate author { name user { login } } }
        }
      }
    }
  }
}`;

const VIEWER_SELECTION = `
  viewer {
    databaseId login name url
    followers { totalCount }
    following { totalCount }
    repositories(privacy: PUBLIC, ownerAffiliations: OWNER) { totalCount }
    gists(privacy: PUBLIC) { totalCount }
  }
  rateLimit { limit remaining resetAt }`;

/**
 * @description The query reading the account and the given repositories.
 * @param {number} count - How many repositories.
 * @returns {string} The GraphQL document.
 * @example
 * buildQuery(2); // -> 'query Round($o0: String!, $n0: String!, …) { … }'
 */
function buildQuery(count) {
  const indexes = [...Array(count).keys()];
  const params = indexes.map((i) => `$o${i}: String!, $n${i}: String!`).join(', ');
  const aliases = indexes
    .map((i) => `  r${i}: repository(owner: $o${i}, name: $n${i}) { ...repo }`)
    .join('\n');
  const head = count > 0 ? `query Round(${params})` : 'query Round';
  return `${head} {${VIEWER_SELECTION}\n${aliases}\n}${count > 0 ? REPOSITORY_FRAGMENT : ''}`;
}

/**
 * @description The variables of the query.
 * @param {string[]} repositories - `owner/name` strings.
 * @returns {object} `{ o0, n0, o1, n1, … }`.
 * @example
 * buildVariables(['octo/hello']); // -> { o0: 'octo', n0: 'hello' }
 */
function buildVariables(repositories) {
  return Object.fromEntries(
    repositories.flatMap((full, i) => {
      const [owner, name] = full.split('/');
      return [
        [`o${i}`, owner],
        [`n${i}`, name],
      ];
    }),
  );
}

/**
 * @description Create the client.
 * @param {object} options - Options.
 * @param {Function} options.getToken - `() => string`.
 * @param {Function} options.getUserAgent - `() => string`.
 * @param {Function} [options.fetch] - fetch implementation (tests).
 * @returns {{ round: Function }} The client.
 * @example
 * const github = createGithubClient({ getToken: () => token, getUserAgent: () => 'gladys-github' });
 */
function createGithubClient({ getToken, getUserAgent, fetch = globalThis.fetch }) {
  /**
   * @description Run a GraphQL request.
   * @param {string} query - The document.
   * @param {object} variables - Its variables.
   * @returns {Promise<{ data: object, errors: Array }>} The answer.
   * @throws {GithubError} On any failure but partial data.
   */
  async function graphql(query, variables) {
    const token = getToken();
    if (!token) {
      throw new GithubError('auth', 'No GitHub token configured');
    }
    let response;
    try {
      response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
          'User-Agent': getUserAgent(),
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new GithubError('network', `GitHub unreachable: ${err.message}`);
    }
    const reset = Number(response.headers.get('x-ratelimit-reset'));
    const resetAt = Number.isFinite(reset) && reset > 0 ? reset * 1000 : null;
    if (response.status === 401) {
      throw new GithubError('auth', 'GitHub refused the token (401)', { status: 401 });
    }
    if (response.status === 403 || response.status === 429) {
      const exhausted =
        response.headers.get('x-ratelimit-remaining') === '0' ||
        response.headers.has('retry-after') ||
        response.status === 429;
      throw new GithubError(
        exhausted ? 'rate_limit' : 'forbidden',
        `GitHub answered ${response.status}`,
        { status: response.status, resetAt },
      );
    }
    if (response.status >= 500) {
      throw new GithubError('server', `GitHub answered ${response.status}`, {
        status: response.status,
      });
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw new GithubError('invalid', `GitHub sent no JSON (HTTP ${response.status})`, {
        status: response.status,
      });
    }
    const errors = Array.isArray(body?.errors) ? body.errors : [];
    if (errors.some((error) => error?.type === 'RATE_LIMITED')) {
      throw new GithubError('rate_limit', 'GitHub GraphQL quota exhausted', { resetAt });
    }
    if (!response.ok || !body?.data) {
      const message = errors[0]?.message ?? `HTTP ${response.status}`;
      throw new GithubError('invalid', `GitHub refused the query: ${message}`, {
        status: response.status,
      });
    }
    return { data: body.data, errors };
  }

  /**
   * @description Read the account, the quota and the repositories.
   * @param {string[]} repositories - `owner/name` strings (20 at most).
   * @returns {Promise<{ viewer: object, rateLimit: object, repositories: Map<string, object|null>, missing: Map<string, string> }>}
   * The raw answer: each repository by its configured name, null when GitHub
   * could not resolve it (`missing` holds the reason).
   */
  async function round(repositories) {
    const list = repositories.slice(0, MAX_REPOSITORIES);
    const { data, errors } = await graphql(buildQuery(list.length), buildVariables(list));
    const missing = new Map();
    errors.forEach((error) => {
      const alias = Array.isArray(error?.path) ? error.path[0] : null;
      const match = /^r(\d+)$/.exec(String(alias ?? ''));
      if (match && list[Number(match[1])]) {
        missing.set(list[Number(match[1])], error.type ?? 'ERROR');
      }
    });
    return {
      viewer: data.viewer ?? null,
      rateLimit: data.rateLimit ?? null,
      repositories: new Map(list.map((full, i) => [full, data[`r${i}`] ?? null])),
      missing,
    };
  }

  return { round };
}

/**
 * @description The User-Agent GitHub asks every client to send.
 * @param {{ name: string, version: string, homepage: string }} pkg - package.json fields.
 * @returns {string} The User-Agent.
 * @example
 * buildUserAgent({ name: 'gladys-github', version: '0.1.0', homepage: 'https://…' });
 */
function buildUserAgent({ name, version, homepage }) {
  return `${name}/${version} (+${homepage})`;
}

export {
  GRAPHQL_URL,
  MAX_REPOSITORIES,
  RECENT_COUNT,
  GithubError,
  buildQuery,
  buildVariables,
  buildUserAgent,
  createGithubClient,
};
