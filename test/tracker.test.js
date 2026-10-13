import { test } from 'node:test';
import assert from 'node:assert/strict';

import { diffRepository, SCENE_TRIGGERS } from '../src/tracker.js';
import { readRepository } from '../src/read.js';
import { rawRepository, NOW } from './helpers/fixtures.js';

const snap = (options) => readRepository(rawRepository(options));
const keys = (events) => events.map((event) => event.key);
const SHA = (c) => c.repeat(40);

test('the first round is the baseline: nothing is reported', () => {
  assert.deepEqual(diffRepository(null, snap()), []);
});

test('nothing changed: no event', () => {
  assert.deepEqual(diffRepository(snap(), snap()), []);
});

test('a new release, issue, pull request and discussion each fire once', () => {
  const before = snap();
  const after = snap({
    releases: [
      { id: 901, tag: 'v1.3.0', name: 'v1.3.0', at: NOW, prerelease: true },
      { id: 900, tag: 'v1.2.0', name: 'Autumn', at: NOW - 86400000 },
    ],
    issues: [
      { number: 15, title: 'B', author: 'c', at: NOW },
      { number: 14, title: 'A', author: 'c', at: NOW - 1 },
      { number: 12, title: 'Crash on start', author: 'alice', at: NOW - 7200000 },
    ],
    pulls: [
      { number: 16, title: 'Draft', author: 'd', at: NOW, draft: true },
      { number: 13, title: 'Fix the crash', author: 'bob', at: NOW - 3600000 },
    ],
    discussions: [{ number: 17, title: 'Idea', author: 'e', at: NOW }],
  });
  const events = diffRepository(before, after);
  assert.deepEqual(keys(events), [
    SCENE_TRIGGERS.RELEASE_PUBLISHED,
    SCENE_TRIGGERS.ISSUE_OPENED,
    SCENE_TRIGGERS.ISSUE_OPENED,
    SCENE_TRIGGERS.PULL_REQUEST_OPENED,
    SCENE_TRIGGERS.DISCUSSION_CREATED,
  ]);
  assert.deepEqual(
    events.filter((e) => e.item).map((e) => e.item.number),
    [14, 15, 16, 17],
    'oldest first',
  );
  assert.equal(events[0].release.prerelease, true);
});

test('a draft published later fires, an old release surfacing again does not', () => {
  const before = snap({
    releases: [
      { id: 2, tag: 'v2', name: 'v2', at: NOW - 1000, draft: true },
      { id: 1, tag: 'v1', name: 'v1', at: NOW - 5000 },
    ],
  });
  const published = snap({
    releases: [
      { id: 2, tag: 'v2', name: 'v2', at: NOW },
      { id: 1, tag: 'v1', name: 'v1', at: NOW - 5000 },
    ],
  });
  assert.deepEqual(keys(diffRepository(before, published)), [SCENE_TRIGGERS.RELEASE_PUBLISHED]);
  // v3 deleted: v0, older than every known release, shows up in the window.
  const withV3 = snap({ releases: [{ id: 3, tag: 'v3', name: 'v3', at: NOW }] });
  const afterDelete = snap({ releases: [{ id: 0, tag: 'v0', name: 'v0', at: NOW - 9e6 }] });
  assert.deepEqual(diffRepository(withV3, afterDelete), []);
});

test('new commits on the default branch, oldest first, up to the previous head', () => {
  const before = snap({ commits: [{ sha: SHA('a'), message: 'one', at: NOW - 3000 }] });
  const after = snap({
    commits: [
      { sha: SHA('c'), message: 'three', at: NOW },
      { sha: SHA('b'), message: 'two', at: NOW - 1000 },
      { sha: SHA('a'), message: 'one', at: NOW - 3000 },
    ],
    checks: 'PENDING',
  });
  const events = diffRepository(before, after);
  assert.deepEqual(
    events.map((e) => e.commit.message),
    ['two', 'three'],
  );
});

test('a rewritten history reports only the commits newer than the old head', () => {
  const before = snap({ commits: [{ sha: SHA('a'), message: 'old', at: NOW - 3000 }] });
  const after = snap({
    commits: [
      { sha: SHA('d'), message: 'new', at: NOW },
      { sha: SHA('e'), message: 'rewritten', at: NOW - 9000 },
    ],
    checks: null,
  });
  assert.deepEqual(
    diffRepository(before, after).map((e) => e.commit.message),
    ['new'],
  );
});

test('stars going up fire with the count; going down does not', () => {
  const [event] = diffRepository(snap({ stars: 10 }), snap({ stars: 12 }));
  assert.deepEqual(event, { key: SCENE_TRIGGERS.STAR_ADDED, stars: 12, added: 2 });
  assert.deepEqual(diffRepository(snap({ stars: 12 }), snap({ stars: 11 })), []);
});

test('checks: pending then failure fires once, same result again does not', () => {
  const commits = [{ sha: SHA('a'), message: 'm', at: NOW }];
  const pending = snap({ commits, checks: 'PENDING' });
  const failed = snap({ commits, checks: 'FAILURE' });
  const [event] = diffRepository(pending, failed);
  assert.equal(event.key, SCENE_TRIGGERS.CHECKS_COMPLETED);
  assert.equal(event.state, 'failure');
  assert.deepEqual(diffRepository(failed, failed), []);
  // A new head commit already green: commit then checks.
  const next = snap({
    commits: [{ sha: SHA('b'), message: 'n', at: NOW + 1 }, ...commits],
    checks: 'SUCCESS',
  });
  assert.deepEqual(keys(diffRepository(failed, next)), [
    SCENE_TRIGGERS.COMMIT_PUSHED,
    SCENE_TRIGGERS.CHECKS_COMPLETED,
  ]);
});
