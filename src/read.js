// -----------------------------------------------------------------------------
// Reading the GraphQL answers into plain snapshots.
//
// Everything the devices, the widgets, the scene triggers and the scene
// actions need comes from these snapshots: they never touch the raw answer.
// A missing or malformed field becomes null (or an empty list), never an
// exception: a counter GitHub did not send is not published, not set to 0.
// -----------------------------------------------------------------------------

const count = (node) => (Number.isInteger(node?.totalCount) ? node.totalCount : null);
const integer = (value) => (Number.isInteger(value) ? value : null);
const text = (value) => (typeof value === 'string' ? value : '');
const time = (value) => {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
};
const nodes = (connection) =>
  Array.isArray(connection?.nodes) ? connection.nodes.filter(Boolean) : [];

/**
 * @description An issue, pull request or discussion.
 * @param {object} raw - The node.
 * @returns {{ number: number, title: string, url: string, createdAt: number|null, author: string, draft: boolean }} The item.
 */
function readItem(raw) {
  return {
    number: integer(raw.number),
    title: text(raw.title),
    url: text(raw.url),
    createdAt: time(raw.createdAt),
    author: text(raw.author?.login),
    draft: raw.isDraft === true,
  };
}

/**
 * @description A release. The download count sums its assets (null without any).
 * @param {object} raw - The node.
 * @returns {object} The release.
 */
function readRelease(raw) {
  const assets = nodes(raw.releaseAssets);
  const downloads = assets.reduce((sum, asset) => sum + (integer(asset.downloadCount) ?? 0), 0);
  return {
    id: integer(raw.databaseId),
    name: text(raw.name) || text(raw.tagName),
    tag: text(raw.tagName),
    url: text(raw.url),
    draft: raw.isDraft === true,
    prerelease: raw.isPrerelease === true,
    publishedAt: time(raw.publishedAt) ?? time(raw.createdAt),
    author: text(raw.author?.login),
    downloads: assets.length > 0 ? downloads : null,
  };
}

/**
 * @description A commit of the default branch.
 * @param {object} raw - The node.
 * @returns {object} The commit.
 */
function readCommit(raw) {
  return {
    sha: text(raw.oid),
    shortSha: text(raw.abbreviatedOid) || text(raw.oid).slice(0, 7),
    message: text(raw.messageHeadline),
    url: text(raw.url),
    committedAt: time(raw.committedDate),
    author: text(raw.author?.user?.login) || text(raw.author?.name),
  };
}

/**
 * @description The checks of the head commit, as Gladys shows them.
 * @param {string|undefined} state - EXPECTED | ERROR | FAILURE | PENDING | SUCCESS.
 * @returns {'success'|'failure'|'pending'|null} The state, null without checks.
 */
function readChecks(state) {
  switch (state) {
    case 'SUCCESS':
      return 'success';
    case 'FAILURE':
    case 'ERROR':
      return 'failure';
    case 'PENDING':
    case 'EXPECTED':
      return 'pending';
    default:
      return null;
  }
}

/**
 * @description Read a repository.
 * @param {object} raw - The `repository` node.
 * @returns {object|null} The snapshot, null when it has no stable id.
 * @example
 * readRepository(data.r0).stars; // -> 91418
 */
function readRepository(raw) {
  if (!raw || !Number.isInteger(raw.databaseId)) {
    return null;
  }
  const head = raw.defaultBranchRef?.target ?? null;
  const tag = nodes(raw.tags)[0] ?? null;
  const tagTarget = tag?.target?.url ?? tag?.target?.target?.url ?? '';
  // Draft releases are only visible to maintainers: never announce one.
  const releases = nodes(raw.releases)
    .map(readRelease)
    .filter((release) => !release.draft);
  const discussions = nodes(raw.discussions).map(readItem);
  return {
    id: raw.databaseId,
    fullName: text(raw.nameWithOwner),
    url: text(raw.url),
    description: text(raw.description),
    archived: raw.isArchived === true,
    private: raw.isPrivate === true,
    stars: integer(raw.stargazerCount),
    forks: integer(raw.forkCount),
    watchers: count(raw.watchers),
    openIssues: count(raw.openIssues),
    openPullRequests: count(raw.openPullRequests),
    mergedPullRequests: count(raw.mergedPullRequests),
    discussionCount: count(raw.discussions),
    issues: nodes(raw.latestIssues).map(readItem),
    pullRequests: nodes(raw.latestPullRequests).map(readItem),
    discussions,
    releases,
    tag: tag ? { name: text(tag.name), url: text(tagTarget) } : null,
    branch: text(raw.defaultBranchRef?.name),
    commits: nodes(head?.history).map(readCommit),
    checks: readChecks(head?.statusCheckRollup?.state),
  };
}

/**
 * @description Read the authenticated account.
 * @param {object} raw - The `viewer` node.
 * @returns {object|null} The account, null without a stable id.
 */
function readAccount(raw) {
  if (!raw || !Number.isInteger(raw.databaseId)) {
    return null;
  }
  return {
    id: raw.databaseId,
    login: text(raw.login),
    name: text(raw.name),
    url: text(raw.url),
    followers: count(raw.followers),
    following: count(raw.following),
    publicRepositories: count(raw.repositories),
    publicGists: count(raw.gists),
  };
}

/**
 * @description Read the API quota.
 * @param {object} raw - The `rateLimit` node.
 * @returns {{ limit: number, remaining: number, resetAt: number|null }|null} The quota.
 */
function readRateLimit(raw) {
  if (!raw || !Number.isInteger(raw.limit) || !Number.isInteger(raw.remaining)) {
    return null;
  }
  return { limit: raw.limit, remaining: raw.remaining, resetAt: time(raw.resetAt) };
}

export { readRepository, readAccount, readRateLimit, readChecks, readRelease, readCommit };
