import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GladysIntegration,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
} from '@gladysassistant/integration-sdk';

import {
  DEVICE_TYPES,
  MAX_COUNT,
  idsOf,
  idFromExternalId,
  buildRepositoryDevice,
  buildAccountDevice,
  buildRepositoryStates,
  buildAccountStates,
} from '../src/device.js';
import { readRepository, readAccount } from '../src/read.js';
import { fakeGladys, rawRepository, RAW_VIEWER } from './helpers/fixtures.js';

const repo = readRepository(rawRepository());
const account = readAccount(RAW_VIEWER);

test('a repository device on its numeric GitHub id, named after owner/name', () => {
  const device = buildRepositoryDevice(fakeGladys, repo, 'fr');
  assert.equal(device.name, 'GitHub octo/hello');
  assert.equal(device.external_id, 'ext:github:repository:101');
  assert.equal(device.should_poll, false);
  assert.equal(device.poll_frequency, undefined);
  assert.deepEqual(device.params, [{ name: 'GITHUB_REPOSITORY', value: 'octo/hello' }]);
  assert.equal(device.features.length, 14);
  assert.equal(device.features[0].name, 'Étoiles');
});

test('every feature declares min, max, read_only and has_feedback, with a known pair', () => {
  const pairs = new Set([
    `${DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR}/${DEVICE_FEATURE_TYPES.SENSOR.INTEGER}`,
    `${DEVICE_FEATURE_CATEGORIES.TEXT}/${DEVICE_FEATURE_TYPES.TEXT.TEXT}`,
  ]);
  for (const device of [
    buildRepositoryDevice(fakeGladys, repo),
    buildAccountDevice(fakeGladys, account),
  ]) {
    for (const feature of device.features) {
      for (const field of ['min', 'max', 'read_only', 'has_feedback']) {
        assert.notEqual(feature[field], undefined, `${feature.external_id}.${field}`);
      }
      assert.ok(pairs.has(`${feature.category}/${feature.type}`), feature.external_id);
      assert.equal(feature.read_only, true);
      assert.ok(feature.external_id.startsWith(`${device.external_id}:`));
    }
    const names = device.features.map((feature) => feature.name);
    assert.equal(new Set(names).size, names.length, 'distinguishable names');
  }
});

test('the account device', () => {
  const device = buildAccountDevice(fakeGladys, account, 'de');
  assert.equal(device.name, 'GitHub @octocat');
  assert.equal(device.external_id, 'ext:github:account:777');
  assert.deepEqual(
    device.features.map((feature) => feature.name),
    ['Follower', 'Folgt', 'Öffentliche Repositorys', 'Öffentliche Gists'],
  );
});

test('states: counters as numbers, texts as text, unknown values left out', () => {
  const states = buildRepositoryStates(fakeGladys, repo);
  const byKey = Object.fromEntries(
    states.map((state) => [state.device_feature_external_id.split(':').pop(), state]),
  );
  assert.equal(byKey.stars.state, 42);
  assert.equal(byKey.release_downloads.state, 15);
  assert.equal(byKey.latest_release.text, 'Autumn (v1.2.0)');
  assert.equal(byKey.latest_tag.text, 'v1.2.0');
  assert.equal(byKey.latest_commit.text, 'aaaaaaa Fix the crash (#13)');
  assert.equal(byKey.latest_issue.text, '#12 Crash on start');
  assert.equal(byKey.latest_pull_request.text, '#13 Fix the crash');
  assert.equal(byKey.latest_discussion, undefined, 'no discussion yet');

  const bare = readRepository({ databaseId: 5 });
  assert.deepEqual(buildRepositoryStates(fakeGladys, bare), []);
  const huge = { ...repo, stars: MAX_COUNT * 2 };
  assert.equal(buildRepositoryStates(fakeGladys, huge)[0].state, MAX_COUNT);
  assert.equal(buildAccountStates(fakeGladys, account).length, 4);
});

test('uses the real SDK ids, and maps them back', () => {
  const gladys = new GladysIntegration({
    selector: 'ext-dev-github',
    hostApiUrl: 'http://localhost',
    token: 't',
  });
  const ids = idsOf(gladys, DEVICE_TYPES.REPOSITORY, 101);
  assert.equal(ids.device, 'ext:ext-dev-github:repository:101');
  assert.equal(idFromExternalId(ids.device, DEVICE_TYPES.REPOSITORY), 101);
  assert.equal(idFromExternalId(ids.feature('stars'), DEVICE_TYPES.REPOSITORY), 101);
  assert.equal(idFromExternalId(ids.device, DEVICE_TYPES.ACCOUNT), null);
  assert.equal(idFromExternalId(undefined, DEVICE_TYPES.REPOSITORY), null);
});
