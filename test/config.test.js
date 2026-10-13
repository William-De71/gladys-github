import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeConfig,
  parseRepository,
  parseRepositories,
  readLanguage,
  POLL_INTERVAL,
} from '../src/config.js';

test('reads owner/name, github.com links and .git suffixes', () => {
  assert.equal(parseRepository('octo/hello'), 'octo/hello');
  assert.equal(
    parseRepository('https://github.com/GladysAssistant/Gladys'),
    'GladysAssistant/Gladys',
  );
  assert.equal(parseRepository('github.com/octo/hello.git'), 'octo/hello');
  assert.equal(parseRepository('https://github.com/octo/hello/issues/3'), 'octo/hello');
  assert.equal(parseRepository('octo/my.repo_2-x'), 'octo/my.repo_2-x');
  for (const bad of ['octo', 'octo/', '/hello', 'a/b/c', 'octo/..', '-octo/x', 'oc to/x']) {
    assert.equal(parseRepository(bad), null, bad);
  }
});

test('repositories: separators, duplicates (case-insensitive), cap at 20', () => {
  assert.deepEqual(parseRepositories('octo/a, Octo/A; octo/b\nocto/c  nope'), [
    'octo/a',
    'octo/b',
    'octo/c',
  ]);
  const many = Array.from({ length: 30 }, (_, i) => `octo/r${i}`).join(',');
  assert.equal(parseRepositories(many).length, 20);
  assert.deepEqual(parseRepositories(undefined), []);
});

test('normalizes the whole config, with defaults and bounds', () => {
  assert.deepEqual(normalizeConfig(), {
    token: '',
    repositories: [],
    pollInterval: POLL_INTERVAL.default,
    language: 'auto',
  });
  const config = normalizeConfig({
    token: ' github_pat_abc\n',
    repositories: 'octo/a',
    poll_interval: '5',
    language: 'de',
  });
  assert.equal(config.token, 'github_pat_abc');
  assert.equal(config.pollInterval, POLL_INTERVAL.min);
  assert.equal(config.language, 'de');
  assert.equal(normalizeConfig({ poll_interval: 99999 }).pollInterval, POLL_INTERVAL.max);
  assert.equal(normalizeConfig({ poll_interval: '' }).pollInterval, POLL_INTERVAL.default);
  assert.equal(normalizeConfig({ language: 'it' }).language, 'auto');
  assert.equal(normalizeConfig(null).token, '');
});

test('reads the stored language', () => {
  assert.equal(readLanguage({ last_language: 'fr' }, 'en'), 'fr');
  assert.equal(readLanguage({ last_language: 'french' }, 'en'), 'en');
  assert.equal(readLanguage(undefined, 'es'), 'es');
});
