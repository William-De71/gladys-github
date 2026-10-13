import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createWatcher } from '../src/watcher.js';
import { createGithubClient, GithubError } from '../src/github-api.js';
import { githubApi, rawRepository, silent, NOW } from './helpers/fixtures.js';

/**
 * @description A watcher on a fake GitHub.
 * @param {object} repos - `owner/name` -> raw.
 * @returns {object} `{ watcher, rounds, errors, state }`.
 */
function setup(repos) {
  const state = { repos, names: Object.keys(repos), time: NOW };
  const github = createGithubClient({
    getToken: () => 'github_pat_test',
    getUserAgent: () => 'test',
    fetch: githubApi(() => state.repos),
  });
  const rounds = [];
  const errors = [];
  const watcher = createWatcher({
    github,
    getRepositories: () => state.names,
    isEnabled: () => true,
    getIntervalMs: () => 120000,
    onRound: (round) => rounds.push(round),
    onError: (err) => errors.push(err),
    now: () => state.time,
    logger: silent,
  });
  return { watcher, rounds, errors, state };
}

test('the first round is a baseline, the next reports the transitions and changes', async () => {
  const { watcher, rounds, state } = setup({ 'octo/hello': rawRepository() });
  await watcher.round();
  assert.equal(rounds[0].repos[0].events.length, 0);
  assert.equal(rounds[0].repos[0].changed, true);
  assert.equal(rounds[0].account.login, 'octocat');
  assert.equal(rounds[0].accountChanged, true);

  await watcher.round();
  assert.equal(rounds[1].repos[0].changed, false, 'same data: nothing to publish');
  assert.equal(rounds[1].accountChanged, false);

  state.repos = { 'octo/hello': rawRepository({ stars: 43 }) };
  await watcher.round();
  assert.deepEqual(rounds[2].repos[0].events, [{ key: 'star_added', stars: 43, added: 1 }]);
  assert.equal(rounds[2].repos[0].changed, true);
});

test('a missing repository is reported, the others are read', async () => {
  const { watcher, rounds } = setup({ 'octo/hello': rawRepository(), 'octo/gone': null });
  await watcher.round();
  assert.deepEqual(rounds[0].missing, ['octo/gone']);
  assert.equal(rounds[0].repos.length, 1);
  assert.equal(watcher.peek('OCTO/HELLO').id, 101, 'case-insensitive');
});

test('concurrent rounds share one request; get() reuses a fresh snapshot', async () => {
  const { watcher, state } = setup({ 'octo/hello': rawRepository() });
  await Promise.all([watcher.round(), watcher.round()]);
  const fresh = await watcher.get('octo/hello', 60000);
  assert.equal(fresh.fetchedAt, NOW);
  state.time = NOW + 120000;
  const reread = await watcher.get('octo/hello', 60000);
  assert.equal(reread.fetchedAt, NOW + 120000);
});

test('a failed round reports the error and keeps the last snapshots', async () => {
  const { watcher, errors, state } = setup({ 'octo/hello': rawRepository() });
  await watcher.round();
  state.repos = new Proxy(
    {},
    {
      get() {
        throw new GithubError('server', 'down');
      },
    },
  );
  assert.equal(await watcher.round(), null);
  assert.equal(errors.length, 1);
  assert.ok(watcher.peek('octo/hello'));
});

test('prune and reset forget repositories, the account and the baseline', async () => {
  const { watcher, state } = setup({
    'octo/hello': rawRepository(),
    'octo/b': rawRepository({ id: 2, fullName: 'octo/b' }),
  });
  await watcher.round();
  state.names = ['octo/b'];
  watcher.prune();
  assert.equal(watcher.peek('octo/hello'), null);
  assert.ok(watcher.peek('octo/b'));
  watcher.reset();
  assert.equal(watcher.peek('octo/b'), null);
  assert.equal(watcher.account(), null);
  assert.equal(watcher.fetchedAt(), null);
});
