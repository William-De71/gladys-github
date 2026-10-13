import { test } from 'node:test';
import assert from 'node:assert/strict';

import { expandPatterns, createResolver, EXPAND_MAX_AGE_MS } from '../src/patterns.js';
import { normalizeConfig, parsePattern, parsePatterns } from '../src/config.js';
import { createGithubClient } from '../src/github-api.js';
import { response, silent } from './helpers/fixtures.js';

test('patterns: owner/*, owner/prefix*, as links too, kept apart from full names', () => {
  assert.deepEqual(parsePattern('prohand/*'), { owner: 'prohand', prefix: '', text: 'prohand/*' });
  assert.deepEqual(parsePattern('https://github.com/prohand/gladys-*'), {
    owner: 'prohand',
    prefix: 'gladys-',
    text: 'prohand/gladys-*',
  });
  for (const bad of ['prohand', 'prohand/*x', 'pro*/x', '*/*', 'prohand/gl*dys', 'a/b']) {
    assert.equal(parsePattern(bad), null, bad);
  }
  const config = normalizeConfig({ repositories: 'prohand/gladys-*, octo/a, Prohand/Gladys-*' });
  assert.deepEqual(config.repositories, ['octo/a']);
  assert.deepEqual(
    config.patterns.map((pattern) => pattern.text),
    ['prohand/gladys-*'],
    'duplicates removed, case-insensitive',
  );
  assert.equal(parsePatterns(Array.from({ length: 15 }, (_, i) => `o${i}/*`).join(',')).length, 10);
});

test('expansion: full names first, prefix case-insensitive, no duplicate, cap at 20', () => {
  const listings = new Map([
    ['prohand', ['prohand/gladys-tapo', 'prohand/dotfiles', 'prohand/Gladys-x']],
  ]);
  assert.deepEqual(
    expandPatterns(
      ['octo/a', 'prohand/gladys-tapo'],
      [{ owner: 'Prohand', prefix: 'gladys-' }],
      listings,
    ),
    { repositories: ['octo/a', 'prohand/gladys-tapo', 'prohand/Gladys-x'], matched: 3 },
  );
  const many = new Map([['big', Array.from({ length: 30 }, (_, i) => `big/r${i}`)]]);
  const { repositories, matched } = expandPatterns(
    ['octo/a'],
    [{ owner: 'big', prefix: '' }],
    many,
  );
  assert.equal(repositories.length, 20);
  assert.equal(repositories[0], 'octo/a');
  assert.equal(matched, 31);
});

test('the owners are read once an hour, again when the patterns or the token change', async () => {
  let time = 0;
  const calls = [];
  const github = {
    async listRepositories(owner) {
      calls.push(owner);
      if (owner === 'ghost') {
        return { found: false, repositories: [] };
      }
      return { found: true, repositories: [`${owner}/gladys-a`, `${owner}/other`] };
    },
  };
  let config = normalizeConfig({ token: 't1', repositories: 'prohand/gladys-*, octo/a' });
  const resolver = createResolver({
    github,
    getConfig: () => config,
    now: () => time,
    logger: silent,
  });
  assert.deepEqual(resolver.current(), ['octo/a'], 'nothing read yet: the full names only');
  assert.deepEqual(await resolver.resolve(), ['octo/a', 'prohand/gladys-a']);
  time += EXPAND_MAX_AGE_MS - 1;
  await resolver.resolve();
  assert.equal(calls.length, 1, 'cached within the hour');
  time += 1;
  await resolver.resolve();
  assert.equal(calls.length, 2, 'read again after an hour');
  config = normalizeConfig({ token: 't2', repositories: 'prohand/gladys-*, octo/a' });
  await resolver.resolve();
  assert.equal(calls.length, 3, 'new token');
  config = normalizeConfig({ token: 't2', repositories: 'prohand/*, ghost/*' });
  assert.deepEqual(await resolver.resolve(), ['prohand/gladys-a', 'prohand/other']);
  await resolver.resolve({ force: true });
  assert.deepEqual(calls.slice(3), ['prohand', 'ghost', 'prohand', 'ghost']);
});

test('a failed read keeps the full names followed', async () => {
  const github = {
    async listRepositories() {
      throw new Error('GitHub unreachable');
    },
  };
  const config = normalizeConfig({ token: 't', repositories: 'prohand/*, octo/a' });
  const resolver = createResolver({ github, getConfig: () => config, logger: silent });
  assert.deepEqual(await resolver.resolve(), ['octo/a']);
});

test('the owner list: forks left out by the query, archived ones dropped, pages followed', async () => {
  const bodies = [];
  const pages = [
    {
      nodes: [
        { nameWithOwner: 'prohand/a', isArchived: false },
        { nameWithOwner: 'prohand/old', isArchived: true },
      ],
      pageInfo: { hasNextPage: true, endCursor: 'c1' },
    },
    {
      nodes: [{ nameWithOwner: 'prohand/b', isArchived: false }],
      pageInfo: { hasNextPage: false },
    },
  ];
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    if (body.variables.login === 'ghost') {
      return response(200, { data: { repositoryOwner: null } });
    }
    return response(200, { data: { repositoryOwner: { repositories: pages[bodies.length - 1] } } });
  };
  const github = createGithubClient({ getToken: () => 't', getUserAgent: () => 'ua', fetch });
  assert.deepEqual(await github.listRepositories('prohand'), {
    found: true,
    repositories: ['prohand/a', 'prohand/b'],
  });
  assert.match(bodies[0].query, /isFork: false/);
  assert.deepEqual(bodies[1].variables, { login: 'prohand', cursor: 'c1' });
  assert.deepEqual(await github.listRepositories('ghost'), { found: false, repositories: [] });
});
