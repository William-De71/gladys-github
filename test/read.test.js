import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readRepository, readAccount, readRateLimit, readChecks } from '../src/read.js';
import { rawRepository, RAW_VIEWER, RAW_RATE_LIMIT, NOW } from './helpers/fixtures.js';

test('reads a repository into a plain snapshot', () => {
  const repo = readRepository(rawRepository());
  assert.equal(repo.id, 101);
  assert.equal(repo.fullName, 'octo/hello');
  assert.deepEqual(
    [repo.stars, repo.forks, repo.watchers, repo.openIssues, repo.openPullRequests],
    [42, 7, 3, 4, 2],
  );
  assert.equal(repo.mergedPullRequests, 30);
  assert.equal(repo.releases[0].tag, 'v1.2.0');
  assert.equal(repo.releases[0].downloads, 15);
  assert.equal(repo.issues[0].number, 12);
  assert.equal(repo.commits[0].shortSha, 'aaaaaaa');
  assert.equal(repo.commits[0].author, 'bob');
  assert.equal(repo.checks, 'success');
  assert.equal(repo.branch, 'main');
  assert.deepEqual(repo.tag, { name: 'v1.2.0', url: 'https://github.com/octo/hello/commit/x' });
});

test('drafts are never visible, a release without files has no download count', () => {
  const repo = readRepository(
    rawRepository({
      releases: [
        { id: 2, tag: 'v2', name: 'v2', at: NOW, draft: true },
        { id: 1, tag: 'v1', name: 'v1', at: NOW - 1000 },
      ],
    }),
  );
  assert.deepEqual(
    repo.releases.map((release) => release.tag),
    ['v1'],
  );
  assert.equal(repo.releases[0].downloads, null);
});

test('missing pieces become null or empty, never an exception', () => {
  assert.equal(readRepository(null), null);
  assert.equal(readRepository({ nameWithOwner: 'x/y' }), null, 'no stable id');
  const bare = readRepository({ databaseId: 5 });
  assert.equal(bare.stars, null);
  assert.deepEqual(bare.commits, []);
  assert.equal(bare.checks, null);
  assert.equal(bare.tag, null);
});

test('maps the check states', () => {
  assert.equal(readChecks('SUCCESS'), 'success');
  assert.equal(readChecks('FAILURE'), 'failure');
  assert.equal(readChecks('ERROR'), 'failure');
  assert.equal(readChecks('PENDING'), 'pending');
  assert.equal(readChecks('EXPECTED'), 'pending');
  assert.equal(readChecks(undefined), null);
});

test('reads the account and the quota', () => {
  assert.deepEqual(readAccount(RAW_VIEWER), {
    id: 777,
    login: 'octocat',
    name: 'The Octocat',
    url: 'https://github.com/octocat',
    followers: 12,
    following: 5,
    publicRepositories: 8,
    publicGists: 2,
  });
  assert.equal(readAccount({ ...RAW_VIEWER, gists: null }).publicGists, null);
  assert.equal(readAccount(null), null);
  assert.deepEqual(readRateLimit(RAW_RATE_LIMIT), {
    limit: 5000,
    remaining: 4990,
    resetAt: NOW + 30 * 60000,
  });
  assert.equal(readRateLimit({}), null);
});
