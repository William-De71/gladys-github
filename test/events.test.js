import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildSceneEvent, RELEASE_TYPES, CHECK_STATES } from '../src/events.js';
import { SCENE_TRIGGERS } from '../src/tracker.js';
import { readRepository } from '../src/read.js';
import { fakeGladys, rawRepository } from './helpers/fixtures.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const repo = readRepository(rawRepository());

/** One event of each trigger. */
export const EVENTS = [
  { key: SCENE_TRIGGERS.RELEASE_PUBLISHED, release: repo.releases[0] },
  { key: SCENE_TRIGGERS.ISSUE_OPENED, item: repo.issues[0] },
  { key: SCENE_TRIGGERS.PULL_REQUEST_OPENED, item: repo.pullRequests[0] },
  { key: SCENE_TRIGGERS.DISCUSSION_CREATED, item: { ...repo.issues[0], number: 20 } },
  { key: SCENE_TRIGGERS.COMMIT_PUSHED, commit: repo.commits[0] },
  { key: SCENE_TRIGGERS.STAR_ADDED, stars: 43, added: 1 },
  { key: SCENE_TRIGGERS.CHECKS_COMPLETED, state: 'failure', commit: repo.commits[0] },
];

test('every trigger has an event carrying its filters and exactly its variables', () => {
  assert.deepEqual(EVENTS.map((event) => event.key).sort(), Object.values(SCENE_TRIGGERS).sort());
  for (const event of EVENTS) {
    const { key, data } = buildSceneEvent(fakeGladys, repo, event, 'en');
    const trigger = manifest.scene_triggers.find((entry) => entry.key === key);
    const declared = new Set([
      ...trigger.fields.map((field) => field.key),
      ...trigger.variables.map((variable) => variable.key),
    ]);
    assert.deepEqual(Object.keys(data).sort(), [...declared].sort(), key);
    for (const variable of trigger.variables) {
      const expected = variable.type;
      assert.equal(typeof data[variable.key], expected, `${key}.${variable.key}`);
    }
  }
});

test('payloads stay flat and within the limits', () => {
  for (const event of EVENTS) {
    const { data } = buildSceneEvent(fakeGladys, repo, event, 'fr');
    assert.ok(Object.keys(data).length <= 30);
    for (const value of Object.values(data)) {
      assert.ok(['string', 'number', 'boolean'].includes(typeof value));
      if (typeof value === 'string') {
        assert.ok(value.length <= 1000);
      }
    }
  }
  const long = { ...repo.commits[0], message: 'x'.repeat(5000) };
  const { data } = buildSceneEvent(
    fakeGladys,
    repo,
    { key: SCENE_TRIGGERS.COMMIT_PUSHED, commit: long },
    'en',
  );
  assert.equal(data.message.length, 1000);
});

test('the filter values match the options of the manifest', () => {
  const release = manifest.scene_triggers.find((x) => x.key === 'release_published');
  assert.deepEqual(
    release.fields.find((f) => f.key === 'release_type').options.map((o) => o.value),
    Object.values(RELEASE_TYPES),
  );
  const checks = manifest.scene_triggers.find((x) => x.key === 'checks_completed');
  assert.deepEqual(
    checks.fields.find((f) => f.key === 'state').options.map((o) => o.value),
    CHECK_STATES,
  );
});

test('summaries in the language of the texts', () => {
  const { data } = buildSceneEvent(fakeGladys, repo, EVENTS[0], 'fr');
  assert.equal(data.repository, 'ext:github:repository:101');
  assert.equal(data.release_type, 'stable');
  assert.equal(data.summary, 'octo/hello : la version Autumn est publiée.');
  const star = buildSceneEvent(fakeGladys, repo, EVENTS[5], 'es').data;
  assert.equal(star.summary, 'octo/hello ha recibido una nueva estrella: 43 en total.');
  const checks = buildSceneEvent(fakeGladys, repo, EVENTS[6], 'de').data;
  assert.match(checks.summary, /fehlgeschlagen/);
});
