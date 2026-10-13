import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createGithubClient,
  buildQuery,
  buildVariables,
  buildUserAgent,
  GRAPHQL_URL,
} from '../src/github-api.js';
import { githubApi, rawRepository, response } from './helpers/fixtures.js';

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

test('the User-Agent names the integration and its home page', () => {
  assert.equal(
    buildUserAgent({ name: 'gladys-github', version: '0.1.0', homepage: 'https://x.y' }),
    'gladys-github/0.1.0 (+https://x.y)',
  );
});
