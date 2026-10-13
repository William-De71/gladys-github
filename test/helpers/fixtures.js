// Shapes of the GitHub GraphQL answers (as the API sends them), a fake fetch
// and a stand-in for the SDK external ids.

export const NOW = Date.parse('2026-10-13T10:00:00Z');
const HOUR = 3600000;
const iso = (ms) => new Date(ms).toISOString();

/**
 * @description A raw `repository` node.
 * @param {object} [options] - Overrides.
 * @returns {object} The node.
 */
export function rawRepository({
  id = 101,
  fullName = 'octo/hello',
  stars = 42,
  issues = [{ number: 12, title: 'Crash on start', author: 'alice', at: NOW - 2 * HOUR }],
  pulls = [{ number: 13, title: 'Fix the crash', author: 'bob', at: NOW - HOUR, draft: false }],
  releases = [
    {
      id: 900,
      name: 'Autumn',
      tag: 'v1.2.0',
      at: NOW - 24 * HOUR,
      prerelease: false,
      downloads: [10, 5],
    },
  ],
  commits = [{ sha: 'a'.repeat(40), message: 'Fix the crash (#13)', at: NOW - HOUR / 2 }],
  checks = 'SUCCESS',
  discussions = [],
} = {}) {
  return {
    databaseId: id,
    nameWithOwner: fullName,
    url: `https://github.com/${fullName}`,
    description: 'A friendly repository',
    isArchived: false,
    isPrivate: false,
    stargazerCount: stars,
    forkCount: 7,
    watchers: { totalCount: 3 },
    openIssues: { totalCount: 4 },
    openPullRequests: { totalCount: 2 },
    mergedPullRequests: { totalCount: 30 },
    discussions: {
      totalCount: discussions.length,
      nodes: discussions.map((item) => ({
        number: item.number,
        title: item.title,
        url: `https://github.com/${fullName}/discussions/${item.number}`,
        createdAt: iso(item.at),
        author: { login: item.author },
      })),
    },
    latestIssues: {
      nodes: issues.map((item) => ({
        number: item.number,
        title: item.title,
        url: `https://github.com/${fullName}/issues/${item.number}`,
        createdAt: iso(item.at),
        author: { login: item.author },
      })),
    },
    latestPullRequests: {
      nodes: pulls.map((item) => ({
        number: item.number,
        title: item.title,
        url: `https://github.com/${fullName}/pull/${item.number}`,
        createdAt: iso(item.at),
        isDraft: item.draft === true,
        author: { login: item.author },
      })),
    },
    releases: {
      nodes: releases.map((release) => ({
        databaseId: release.id,
        name: release.name,
        tagName: release.tag,
        url: `https://github.com/${fullName}/releases/tag/${release.tag}`,
        isDraft: release.draft === true,
        isPrerelease: release.prerelease === true,
        publishedAt: release.draft ? null : iso(release.at),
        createdAt: iso(release.at),
        author: { login: 'alice' },
        releaseAssets: { nodes: (release.downloads ?? []).map((n) => ({ downloadCount: n })) },
      })),
    },
    tags: {
      nodes: releases.length
        ? [
            {
              name: releases[0].tag,
              target: { __typename: 'Commit', url: `https://github.com/${fullName}/commit/x` },
            },
          ]
        : [],
    },
    defaultBranchRef: {
      name: 'main',
      target: {
        oid: commits[0]?.sha,
        statusCheckRollup: checks ? { state: checks } : null,
        history: {
          nodes: commits.map((commit) => ({
            oid: commit.sha,
            abbreviatedOid: commit.sha.slice(0, 7),
            messageHeadline: commit.message,
            url: `https://github.com/${fullName}/commit/${commit.sha}`,
            committedDate: iso(commit.at),
            author: { name: 'Bob', user: { login: 'bob' } },
          })),
        },
      },
    },
  };
}

export const RAW_VIEWER = {
  databaseId: 777,
  login: 'octocat',
  name: 'The Octocat',
  url: 'https://github.com/octocat',
  followers: { totalCount: 12 },
  following: { totalCount: 5 },
  repositories: { totalCount: 8 },
  gists: { totalCount: 2 },
};

export const RAW_RATE_LIMIT = { limit: 5000, remaining: 4990, resetAt: iso(NOW + 30 * 60000) };

/**
 * @description A fetch Response stand-in.
 * @param {number} status - HTTP status.
 * @param {unknown} body - JSON body.
 * @param {object} [headers] - Headers.
 * @returns {object} The response.
 */
export function response(status, body, headers = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => lower[name.toLowerCase()] ?? null, has: (name) => name in lower },
    json: async () => {
      if (typeof body === 'string') {
        throw new SyntaxError('not JSON');
      }
      return JSON.parse(JSON.stringify(body));
    },
  };
}

/**
 * @description A fake GitHub GraphQL endpoint: answers from a map of
 * `owner/name` -> raw repository (null = NOT_FOUND).
 * @param {Function} getRepos - `() => ({ 'owner/name': raw | null })`.
 * @returns {Function & { calls: object[] }} The fetch.
 */
export function githubApi(getRepos) {
  const calls = [];
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, init, body });
    if (init.headers.Authorization !== 'Bearer github_pat_test') {
      return response(401, { message: 'Bad credentials' });
    }
    const repos = getRepos();
    const data = { viewer: RAW_VIEWER, rateLimit: RAW_RATE_LIMIT };
    const errors = [];
    Object.keys(body.variables)
      .filter((key) => key.startsWith('o'))
      .forEach((key) => {
        const i = key.slice(1);
        const full = `${body.variables[`o${i}`]}/${body.variables[`n${i}`]}`;
        const raw = repos[full] ?? null;
        data[`r${i}`] = raw;
        if (!raw) {
          errors.push({ type: 'NOT_FOUND', path: [`r${i}`], message: `Could not resolve ${full}` });
        }
      });
    return response(200, errors.length ? { data, errors } : { data });
  };
  fetch.calls = calls;
  return fetch;
}

/** A stand-in for the SDK, building the same external ids. */
export const fakeGladys = {
  externalIds(type, platformId) {
    const device = `ext:github:${type}:${platformId}`;
    return { device, feature: (key) => `${device}:${key}` };
  },
};

export const silent = { debug() {}, info() {}, warn() {}, error() {} };
