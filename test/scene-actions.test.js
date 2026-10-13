import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildRepositoryOutputs, SCENE_ACTIONS, UNKNOWN } from '../src/scene-actions.js';
import { readRepository } from '../src/read.js';
import { rawRepository } from './helpers/fixtures.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const action = manifest.scene_actions.find((x) => x.key === SCENE_ACTIONS.GET_REPOSITORY);

test('returns exactly the declared outputs, with their types', () => {
  const outputs = buildRepositoryOutputs(readRepository(rawRepository()), 'en');
  assert.deepEqual(Object.keys(outputs).sort(), action.outputs.map((o) => o.key).sort());
  for (const output of action.outputs) {
    assert.equal(typeof outputs[output.key], output.type, output.key);
  }
  assert.equal(outputs.stars, 42);
  assert.equal(outputs.latest_release, 'Autumn (v1.2.0)');
  assert.equal(outputs.checks, 'success');
  assert.equal(
    outputs.summary,
    'octo/hello: 42 stars, 4 open issues, 2 open pull requests, latest release v1.2.0.',
  );
});

test('unknown counters are -1, unknown texts empty', () => {
  const outputs = buildRepositoryOutputs(readRepository({ databaseId: 1 }), 'fr');
  assert.equal(outputs.stars, UNKNOWN);
  assert.equal(outputs.latest_release, '');
  assert.equal(outputs.checks, '');
  assert.match(outputs.summary, /dernière version aucune/);
});
