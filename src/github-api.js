// -----------------------------------------------------------------------------
// GitHub GraphQL client.
//
// A round reads the authenticated account, the API quota and every followed
// repository (one alias per repository, owner and name passed as variables,
// never spliced into the query), in batches of 10 repositories, one request
// after the other. GitHub stops a query after about 10 seconds and each
// repository adds 200 to 250 ms: a single query fails beyond 30 to 40
// repositories, and from 15 busy ones GitHub already empties fields
// (RESOURCE_LIMITS_EXCEEDED). A batch costs 1 point of the 5,000 points an
// hour GitHub grants to a token: 50 repositories every 120 seconds use about
// 3 % of the quota.
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
const MAX_REPOSITORIES = 50;
const BATCH_SIZE = 10;
// The newest items read per round: enough to report every issue, pull
// request, release or commit of a busy repository between two rounds.
const RECENT_COUNT = 5;
// How many times a round runs again without the parts the token was refused.
// GraphQL usually names every refused field at once: one retry is the rule.
const MAX_SKIP_ATTEMPTS = 3;

class GithubError extends Error {
  /**
   * @param {string} kind - auth | rate_limit | forbidden | server | network | invalid.
   * @param {string} message - The message.
   * @param {object} [extra] - `{ status, resetAt, errors }`.
   */
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'GithubError';
    this.kind = kind;
    this.status = extra.status ?? 0;
    this.resetAt = extra.resetAt ?? null;
    // The GraphQL errors of a refused query, to find the parts to leave out.
    this.errors = extra.errors ?? [];
  }
}

// The parts of the query a token may be refused, by name. A fine-grained
// token answers "Resource not accessible by personal access token" (type
// FORBIDDEN) for a field its permissions do not cover, and since the
// `viewer` and most connections are non-null, GraphQL then nulls the whole
// account or repository, or the whole answer. Such a part is left out of the
// query from then on: its counters are not published, the rest still is.
const REPOSITORY_PARTS = {
  watchers: 'watchers { totalCount }',
  openIssues: 'openIssues: issues(states: OPEN) { totalCount }',
  openPullRequests: 'openPullRequests: pullRequests(states: OPEN) { totalCount }',
  mergedPullRequests: 'mergedPullRequests: pullRequests(states: MERGED) { totalCount }',
  discussions: `discussions(first: 1, orderBy: { field: CREATED_AT, direction: DESC }) {
    totalCount
    nodes { number title url createdAt author { login } }
  }`,
  latestIssues: `latestIssues: issues(first: ${RECENT_COUNT}, orderBy: { field: CREATED_AT, direction: DESC }) {
    nodes { number title url createdAt author { login } }
  }`,
  latestPullRequests: `latestPullRequests: pullRequests(first: ${RECENT_COUNT}, orderBy: { field: CREATED_AT, direction: DESC }) {
    nodes { number title url createdAt isDraft author { login } }
  }`,
  releases: `releases(first: ${RECENT_COUNT}, orderBy: { field: CREATED_AT, direction: DESC }) {
    nodes {
      databaseId name tagName url isDraft isPrerelease publishedAt createdAt
      author { login }
      releaseAssets(first: 50) { nodes { downloadCount } }
    }
  }`,
  tags: `tags: refs(refPrefix: "refs/tags/", first: 1, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
    nodes {
      name
      target {
        __typename
        ... on Commit { url }
        ... on Tag { target { ... on Commit { url } } }
      }
    }
  }`,
};

// Inside the head commit of the default branch.
const COMMIT_PARTS = {
  statusCheckRollup: 'statusCheckRollup { state }',
  history: `history(first: ${RECENT_COUNT}) {
          nodes { oid abbreviatedOid messageHeadline url committedDate author { name user { login } } }
        }`,
};

const VIEWER_PARTS = {
  followers: 'followers { totalCount }',
  following: 'following { totalCount }',
  repositories: 'repositories(privacy: PUBLIC, ownerAffiliations: OWNER) { totalCount }',
  gists: 'gists(privacy: PUBLIC) { totalCount }',
};

/**
 * @description The parts not left out, one per line.
 * @param {object} parts - Name -> selection.
 * @param {string} scope - `repo`, `commit` or `viewer`.
 * @param {Set<string>} skipped - `scope.name` keys left out.
 * @returns {string} The selections.
 */
function select(parts, scope, skipped) {
  return Object.entries(parts)
    .filter(([name]) => !skipped.has(`${scope}.${name}`))
    .map(([, selection]) => `  ${selection}`)
    .join('\n');
}

/**
 * @description The fragment read on every repository.
 * @param {Set<string>} skipped - Parts left out.
 * @returns {string} The fragment.
 */
function repositoryFragment(skipped) {
  return `
fragment repo on Repository {
  databaseId
  nameWithOwner
  url
  description
  isArchived
  isPrivate
  stargazerCount
  forkCount
${select(REPOSITORY_PARTS, 'repo', skipped)}
  defaultBranchRef {
    name
    target {
      ... on Commit {
        oid
${select(COMMIT_PARTS, 'commit', skipped)}
      }
    }
  }
}`;
}

/**
 * @description The account and quota selection.
 * @param {Set<string>} skipped - Parts left out.
 * @param {boolean} withViewer - False to read the quota alone.
 * @returns {string} The selection.
 */
function viewerSelection(skipped, withViewer) {
  const viewer = `
  viewer {
    databaseId login name url
${select(VIEWER_PARTS, 'viewer', skipped)}
  }`;
  return `${withViewer ? viewer : ''}
  rateLimit { limit remaining resetAt }`;
}

/**
 * @description The part an error of the answer points at, if it is one.
 * @param {Array} path - The error path, e.g. `['r0', 'defaultBranchRef', 'target', 'statusCheckRollup']`.
 * @returns {string|null} `scope.name`, null when the path names no optional part.
 * @example
 * partOf(['viewer', 'followers']); // -> 'viewer.followers'
 */
function partOf(path) {
  if (!Array.isArray(path)) {
    return null;
  }
  const [root, field, ...rest] = path.map(String);
  if (root === 'viewer' && Object.hasOwn(VIEWER_PARTS, field)) {
    return `viewer.${field}`;
  }
  if (!/^r\d+$/.test(root ?? '')) {
    return null;
  }
  if (Object.hasOwn(REPOSITORY_PARTS, field)) {
    return `repo.${field}`;
  }
  const inCommit = rest.find((name) => Object.hasOwn(COMMIT_PARTS, name));
  return field === 'defaultBranchRef' && inCommit ? `commit.${inCommit}` : null;
}

/**
 * @description Whether an error of the answer is a refusal of the token.
 * @param {object} error - A GraphQL error.
 * @returns {boolean} True for a field the token may not read.
 */
function isRefusal(error) {
  return (
    error?.type === 'FORBIDDEN' ||
    /not accessible by (personal access token|integration)/i.test(String(error?.message ?? ''))
  );
}

/**
 * @description The query reading the account and the given repositories.
 * @param {number} count - How many repositories.
 * @param {Set<string>} [skipped] - Parts left out (see `partOf`).
 * @param {boolean} [withViewer] - False for the batches after the first one:
 * the account is read once per round.
 * @returns {string} The GraphQL document.
 * @example
 * buildQuery(2); // -> 'query Round($o0: String!, $n0: String!, …) { … }'
 */
function buildQuery(count, skipped = new Set(), withViewer = true) {
  const indexes = [...Array(count).keys()];
  const params = indexes.map((i) => `$o${i}: String!, $n${i}: String!`).join(', ');
  const aliases = indexes
    .map((i) => `  r${i}: repository(owner: $o${i}, name: $n${i}) { ...repo }`)
    .join('\n');
  const head = count > 0 ? `query Round(${params})` : 'query Round';
  return `${head} {${viewerSelection(skipped, withViewer)}\n${aliases}\n}${count > 0 ? repositoryFragment(skipped) : ''}`;
}

// The repositories of an account or organization, for the `owner/*` patterns:
// most recently pushed first, so the cap keeps the active ones. Forks are
// left out (a pattern follows what the owner makes, not what they copied).
const OWNER_QUERY = `query Owner($login: String!, $cursor: String) {
  repositoryOwner(login: $login) {
    repositories(first: 100, after: $cursor, isFork: false, ownerAffiliations: OWNER, orderBy: { field: PUSHED_AT, direction: DESC }) {
      nodes { nameWithOwner isArchived }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;
// 300 repositories per owner at most: 3 points of the hourly quota.
const MAX_OWNER_PAGES = 3;

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
 * @param {Function} [options.onSkip] - `(parts: string[]) => void`, parts the token may not read.
 * @returns {{ round: Function, listRepositories: Function }} The client.
 * @example
 * const github = createGithubClient({ getToken: () => token, getUserAgent: () => 'gladys-github' });
 */
function createGithubClient({
  getToken,
  getUserAgent,
  fetch = globalThis.fetch,
  onSkip = () => {},
}) {
  // Parts the current token may not read, forgotten when the token changes.
  let skipped = new Set();
  let skippedFor = null;

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
        errors,
      });
    }
    return { data: body.data, errors };
  }

  /**
   * @description Read one batch of repositories.
   * @param {string[]} batch - `owner/name` strings (BATCH_SIZE at most).
   * @param {boolean} withViewer - Whether to read the account too.
   * @returns {Promise<{ data: object, errors: Array }>} The answer.
   */
  async function readBatch(batch, withViewer) {
    // Each refused part costs one more request, once per token.
    for (let attempt = 0; ; attempt += 1) {
      let answer;
      try {
        answer = await graphql(
          buildQuery(batch.length, skipped, withViewer),
          buildVariables(batch),
        );
      } catch (err) {
        if (
          !(err instanceof GithubError) ||
          err.errors.length === 0 ||
          attempt >= MAX_SKIP_ATTEMPTS ||
          !skipRefused(err.errors)
        ) {
          throw err;
        }
        continue;
      }
      if (attempt >= MAX_SKIP_ATTEMPTS || !skipRefused(answer.errors)) {
        return answer;
      }
    }
  }

  /**
   * @description Read the account, the quota and the repositories, in
   * batches of BATCH_SIZE: one failed batch fails the round.
   * @param {string[]} repositories - `owner/name` strings (MAX_REPOSITORIES at most).
   * @returns {Promise<{ viewer: object, rateLimit: object, repositories: Map<string, object|null>, missing: Map<string, string> }>}
   * The raw answer: each repository by its configured name, null when GitHub
   * could not resolve it (`missing` holds the reason).
   */
  async function round(repositories) {
    const list = repositories.slice(0, MAX_REPOSITORIES);
    if (skippedFor !== getToken()) {
      skipped = new Set();
      skippedFor = getToken();
    }
    const batches = [];
    for (let start = 0; start < list.length; start += BATCH_SIZE) {
      batches.push(list.slice(start, start + BATCH_SIZE));
    }
    if (batches.length === 0) {
      batches.push([]);
    }
    let viewer = null;
    let rateLimit = null;
    const found = new Map();
    const missing = new Map();
    // One after the other: GitHub asks clients not to send concurrent requests.
    for (const [index, batch] of batches.entries()) {
      const { data, errors } = await readBatch(batch, index === 0);
      if (index === 0) {
        viewer = data.viewer ?? null;
      }
      // The last batch holds the freshest quota.
      rateLimit = data.rateLimit ?? rateLimit;
      batch.forEach((full, i) => found.set(full, data[`r${i}`] ?? null));
      errors.forEach((error) => {
        const alias = Array.isArray(error?.path) ? error.path[0] : null;
        const match = /^r(\d+)$/.exec(String(alias ?? ''));
        if (match && batch[Number(match[1])] && !partOf(error.path)) {
          missing.set(batch[Number(match[1])], error.type ?? 'ERROR');
        }
      });
    }
    return { viewer, rateLimit, repositories: found, missing };
  }

  /**
   * @description The repositories of an account or organization.
   * @param {string} owner - The login.
   * @returns {Promise<{ found: boolean, repositories: string[] }>} `owner/name`
   * of the repositories not archived, most recently pushed first; `found` is
   * false when GitHub knows no such owner.
   */
  async function listRepositories(owner) {
    const repositories = [];
    let cursor = null;
    for (let page = 0; page < MAX_OWNER_PAGES; page += 1) {
      const { data } = await graphql(OWNER_QUERY, { login: owner, cursor });
      const connection = data.repositoryOwner?.repositories;
      if (!connection) {
        return { found: false, repositories };
      }
      (connection.nodes ?? [])
        .filter((node) => node && !node.isArchived && typeof node.nameWithOwner === 'string')
        .forEach((node) => repositories.push(node.nameWithOwner));
      if (!connection.pageInfo?.hasNextPage) {
        break;
      }
      cursor = connection.pageInfo.endCursor;
    }
    return { found: true, repositories };
  }

  /**
   * @description Leave out the parts the token was refused.
   * @param {Array} errors - The GraphQL errors.
   * @returns {boolean} True when a new part is left out (the query must run again).
   */
  function skipRefused(errors) {
    const parts = [
      ...new Set(
        errors
          .filter(isRefusal)
          .map((error) => partOf(error.path))
          .filter((part) => part && !skipped.has(part)),
      ),
    ];
    parts.forEach((part) => skipped.add(part));
    if (parts.length > 0) {
      onSkip(parts);
    }
    return parts.length > 0;
  }

  return { round, listRepositories };
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
  BATCH_SIZE,
  RECENT_COUNT,
  GithubError,
  buildQuery,
  buildVariables,
  partOf,
  buildUserAgent,
  createGithubClient,
};
