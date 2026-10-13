import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createGithubClient,
  buildQuery,
  buildVariables,
  buildUserAgent,
  partOf,
  GRAPHQL_URL,
} from '../src/github-api.js';
import {
  githubApi,
  rawRepository,
  response,
  RAW_VIEWER,
  RAW_RATE_LIMIT,
} from './helpers/fixtures.js';

const client = (fetch, token = 'github_pat_test') =>
  createGithubClient({ getToken: () => token, getUserAgent: () => 'gladys-github/0.1.0', fetch });

test('one query reads the account, the quota and every repository, names as variables', async () => {
  const fetch = githubApi(() => ({ 'octo/hello': rawRepository() }));
  const answer = await client(fetch).round(['octo/hello', 'octo/gone']);
  assert.equal(fetch.calls.length, 1);
  const [{ url, init, body }] = fetch.calls;
  assert.equal(url, GRAPHQL_URL);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['User-Agent'], 'gladys-github/0.1.0');
  assert.deepEqual(body.variables, { o0: 'octo', n0: 'hello', o1: 'octo', n1: 'gone' });
  assert.doesNotMatch(body.query, /hello|gone/, 'never spliced into the query');
  assert.equal(answer.viewer.login, 'octocat');
  assert.equal(answer.repositories.get('octo/hello').nameWithOwner, 'octo/hello');
  assert.equal(answer.repositories.get('octo/gone'), null);
  assert.deepEqual([...answer.missing], [['octo/gone', 'NOT_FOUND']]);
});

test('repositories are read in batches of 10, the account once, the quota from the last batch', async () => {
  const names = Array.from({ length: 23 }, (_, i) => `octo/r${i}`);
  const repos = Object.fromEntries(
    names.filter((full) => full !== 'octo/r12').map((full) => [full, rawRepository()]),
  );
  const fetch = githubApi(() => repos);
  const answer = await client(fetch).round(names);
  assert.deepEqual(
    fetch.calls.map(({ body }) => Object.keys(body.variables).length / 2),
    [10, 10, 3],
  );
  assert.deepEqual(
    fetch.calls.map(({ body }) => /viewer \{/.test(body.query)),
    [true, false, false],
  );
  assert.ok(fetch.calls.every(({ body }) => /rateLimit \{/.test(body.query)));
  assert.equal(fetch.calls[2].body.variables.n2, 'r22');
  assert.equal(answer.viewer.login, 'octocat');
  assert.equal(answer.rateLimit.remaining, RAW_RATE_LIMIT.remaining);
  assert.equal(answer.repositories.size, 23);
  assert.ok(answer.repositories.get('octo/r22'));
  assert.equal(answer.repositories.get('octo/r12'), null);
  assert.deepEqual([...answer.missing], [['octo/r12', 'NOT_FOUND']]);
});

test('one failed batch fails the round', async () => {
  let calls = 0;
  const ok = githubApi(() => ({}));
  const fetch = async (url, init) => {
    calls += 1;
    return calls === 2 ? response(502, {}) : ok(url, init);
  };
  const names = Array.from({ length: 15 }, (_, i) => `octo/r${i}`);
  await assert.rejects(client(fetch).round(names), (err) => err.kind === 'server');
});

test('the query is valid without any repository (no unused fragment)', () => {
  assert.doesNotMatch(buildQuery(0), /fragment/);
  assert.match(buildQuery(2), /r1: repository\(owner: \$o1, name: \$n1\)/);
  assert.deepEqual(buildVariables(['a/b']), { o0: 'a', n0: 'b' });
});

test('errors carry a kind the status message is chosen from', async () => {
  const kinds = [
    [async () => response(401, {}), 'auth'],
    [
      async () =>
        response(403, {}, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' }),
      'rate_limit',
    ],
    [async () => response(429, {}), 'rate_limit'],
    [async () => response(403, {}), 'forbidden'],
    [async () => response(502, {}), 'server'],
    [async () => response(200, 'oops'), 'invalid'],
    [async () => response(200, { errors: [{ type: 'RATE_LIMITED', message: 'x' }] }), 'rate_limit'],
    [async () => response(200, { errors: [{ message: 'Parse error' }] }), 'invalid'],
    [
      async () => {
        throw new TypeError('fetch failed');
      },
      'network',
    ],
  ];
  for (const [fetch, kind] of kinds) {
    await assert.rejects(client(fetch).round([]), (err) => err.kind === kind, kind);
  }
  await assert.rejects(
    client(fetch, '').round([]),
    (err) => err.kind === 'auth',
    'no token: no call',
  );
  const err = await client(async () =>
    response(403, {}, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' }),
  )
    .round([])
    .catch((e) => e);
  assert.equal(err.resetAt, 1800000000000);
});

const REFUSED = 'Resource not accessible by personal access token';

test('fields a fine-grained token may not read are left out, the rest is read', async () => {
  // As GitHub answers: a refused non-null field nulls its parents up to `data`.
  const calls = [];
  const fetch = async (url, init) => {
    const { query } = JSON.parse(init.body);
    calls.push(query);
    const errors = [];
    if (/followers \{/.test(query)) {
      errors.push({ type: 'FORBIDDEN', path: ['viewer', 'followers'], message: REFUSED });
    }
    if (/statusCheckRollup/.test(query)) {
      errors.push({
        type: 'FORBIDDEN',
        path: ['r0', 'defaultBranchRef', 'target', 'statusCheckRollup'],
        message: REFUSED,
      });
    }
    if (errors.length > 0) {
      return response(200, { data: null, errors });
    }
    const viewer = { ...RAW_VIEWER, followers: undefined };
    return response(200, {
      data: { viewer, rateLimit: RAW_RATE_LIMIT, r0: rawRepository({ checks: null }) },
    });
  };
  const skipped = [];
  const github = createGithubClient({
    getToken: () => 'github_pat_test',
    getUserAgent: () => 'ua',
    fetch,
    onSkip: (parts) => skipped.push(...parts),
  });
  const answer = await github.round(['octo/hello']);
  assert.equal(calls.length, 2, 'one more request to leave the refused fields out');
  assert.deepEqual(skipped, ['viewer.followers', 'commit.statusCheckRollup']);
  assert.equal(answer.viewer.login, 'octocat');
  assert.equal(answer.repositories.get('octo/hello').nameWithOwner, 'octo/hello');
  assert.equal(answer.missing.size, 0);
  assert.doesNotMatch(calls[1], /followers \{|statusCheckRollup/);
  assert.match(calls[1], /following \{/);

  await github.round(['octo/hello']);
  assert.equal(calls.length, 3, 'remembered: no more refused request');
});

test('a token refused everywhere still fails, after a bounded number of tries', async () => {
  let calls = 0;
  const fetch = async () => {
    calls += 1;
    return response(200, {
      data: null,
      errors: [{ type: 'FORBIDDEN', path: ['viewer'], message: REFUSED }],
    });
  };
  await assert.rejects(client(fetch).round([]), (err) => err.kind === 'invalid');
  assert.equal(calls, 1, 'nothing optional to leave out: no retry');
});

test('the refused part is found from the error path', () => {
  assert.equal(partOf(['viewer', 'gists']), 'viewer.gists');
  assert.equal(partOf(['r3', 'discussions']), 'repo.discussions');
  assert.equal(partOf(['r0', 'defaultBranchRef', 'target', 'history']), 'commit.history');
  assert.equal(partOf(['r0']), null);
  assert.equal(partOf(['viewer', 'login']), null);
  assert.equal(partOf(undefined), null);
});

test('the User-Agent names the integration and its home page', () => {
  assert.equal(
    buildUserAgent({ name: 'gladys-github', version: '0.1.0', homepage: 'https://x.y' }),
    'gladys-github/0.1.0 (+https://x.y)',
  );
});
