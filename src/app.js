// -----------------------------------------------------------------------------
// The GitHub integration: every handler, registered on a Gladys client.
//
// Follows GitHub repositories (public, or private ones the token can read)
// and brings them into Gladys:
//   - a device per repository and one for the account of the token
//     (Discovery screen): stars, forks, open issues and pull requests, the
//     latest release, tag, commit, issue… (see device.js);
//   - scene triggers: release published, issue / pull request / discussion
//     opened, commit pushed, star added, checks of the default branch
//     completed (see tracker.js, events.js);
//   - a scene action: read a repository's figures (see scene-actions.js);
//   - dashboard widgets: a repository, the latest activity, the account and
//     its API quota (see widgets.js).
//
// GitHub has no push without a public webhook endpoint: the integration reads
// the GraphQL API on its own timer, one request per round (see watcher.js).
// It needs a personal access token: read-only access is enough.
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK (test/app.test.js).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, readLanguage, INTERNAL_KEYS, AUTO_LANGUAGE } from './config.js';
import { createGithubClient, buildUserAgent } from './github-api.js';
import { createWatcher } from './watcher.js';
import {
  DEVICE_TYPES,
  idsOf,
  idFromExternalId,
  buildRepositoryDevice,
  buildAccountDevice,
  buildRepositoryStates,
  buildAccountStates,
} from './device.js';
import { buildSceneEvent } from './events.js';
import { SCENE_ACTIONS, buildRepositoryOutputs } from './scene-actions.js';
import {
  WIDGETS,
  messageContent,
  buildRepositoryWidget,
  buildActivityWidget,
  buildAccountWidget,
} from './widgets.js';
import { t, all, LANGUAGES } from './i18n.js';

const { name, version, homepage } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

const ACTIONS = { TEST_CONNECTION: 'test_connection' };
// A widget or a scene action reuses the last round while it is this fresh.
const SNAPSHOT_MAX_AGE_MS = 60000;
// The longest list of missing repositories a status message names.
const MAX_MISSING_LISTED = 3;

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.fetchImpl] - fetch implementation (tests).
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {object} [options.logger] - Logger.
 * @returns {{ watcher: object, getConfig: Function }} Handles for the tests.
 * @example
 * createApp(new GladysIntegration());
 */
function createApp(
  gladys,
  { fetchImpl = globalThis.fetch, now = () => Date.now(), logger = sdkLogger } = {},
) {
  let config = normalizeConfig();
  // Language of the last widget request: the fallback of the texts Gladys does
  // not ask for in a language, when the `language` setting is `auto`.
  let language = 'en';
  // Device external ids the user created (states are only published for them).
  let createdDevices = new Set();
  // Last connection status sent, to send it again only when it changes.
  let lastStatus = null;

  const github = createGithubClient({
    getToken: () => config.token,
    getUserAgent: () => buildUserAgent({ name, version, homepage }),
    fetch: fetchImpl,
    onSkip: (parts) => logger.warn(`Not readable with this token, left out: ${parts.join(', ')}`),
  });

  /**
   * @description Remember the language of a request, and store it when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (typeof next !== 'string' || !/^[a-z]{2}$/.test(next) || next === language) {
      return;
    }
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Language of the texts Gladys does not ask for in a language
   * (device names, scene summaries and outputs).
   * @returns {string} The language.
   */
  function textLanguage() {
    return config.language === AUTO_LANGUAGE ? language : config.language;
  }

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const signature = JSON.stringify([connected, message]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description The multi-language message of a failed read.
   * @param {Error} err - A GithubError.
   * @returns {object} The message.
   */
  function errorMessage(err) {
    switch (err.kind) {
      case 'auth':
        return all(config.token ? 'statusInvalidToken' : 'noToken');
      case 'forbidden':
        return all('statusForbidden');
      case 'rate_limit':
        return all('statusRateLimited');
      default:
        return all('statusUnreachable');
    }
  }

  /**
   * @description `a/b, c/d and 2 more` style list of missing repositories.
   * @param {string[]} missing - The repositories.
   * @returns {string} The list.
   */
  function listMissing(missing) {
    const shown = missing.slice(0, MAX_MISSING_LISTED).join(', ');
    return missing.length > MAX_MISSING_LISTED
      ? `${shown} (+${missing.length - MAX_MISSING_LISTED})`
      : shown;
  }

  /**
   * @description Refresh the list of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  /**
   * @description Publish the states of the created devices that changed. The
   * SDK remembers what it sent (publishChangedStates) and forgets a device when
   * the user creates it: its states then go out again in full.
   * @param {object[]} repos - Repository snapshots.
   * @param {object|null} account - The account snapshot.
   * @returns {Promise<void>}
   */
  async function publishStates(repos, account) {
    const states = [];
    repos.forEach((repo) => {
      if (createdDevices.has(idsOf(gladys, DEVICE_TYPES.REPOSITORY, repo.id).device)) {
        states.push(...buildRepositoryStates(gladys, repo));
      }
    });
    if (account && createdDevices.has(idsOf(gladys, DEVICE_TYPES.ACCOUNT, account.id).device)) {
      states.push(...buildAccountStates(gladys, account));
    }
    if (states.length > 0) {
      await gladys.publishChangedStates(states);
    }
  }

  /**
   * @description The repository snapshots of the last round, in the configured order.
   * @returns {object[]} The snapshots.
   */
  function knownRepositories() {
    return config.repositories.map((full) => watcher.peek(full)).filter(Boolean);
  }

  /**
   * @description Ask the dashboards to re-read the widgets.
   */
  function refreshWidgets() {
    Object.values(WIDGETS).forEach((key) => gladys.requestWidgetRefresh(key));
  }

  // --- The watcher -----------------------------------------------------------------
  const watcher = createWatcher({
    github,
    getRepositories: () => config.repositories,
    isEnabled: () => Boolean(config.token),
    getIntervalMs: () => config.pollInterval * 1000,
    onRound: async ({ repos, account, accountChanged, missing }) => {
      for (const { snapshot, events } of repos) {
        for (const event of events) {
          const { key, data } = buildSceneEvent(gladys, snapshot, event, textLanguage());
          logger.info(`${snapshot.fullName}: ${key}`);
          try {
            await gladys.publishSceneEvent(key, data);
          } catch (err) {
            logger.warn(`Unable to publish the scene event ${key}: ${err.message}`);
          }
        }
      }
      const changed = repos.filter((repo) => repo.changed).map((repo) => repo.snapshot);
      if (changed.length > 0 || accountChanged) {
        await publishStates(changed, accountChanged ? account : null).catch((err) =>
          logger.warn(`Unable to publish the states: ${err.message}`),
        );
        refreshWidgets();
      }
      if (missing.length > 0) {
        logger.warn(`Not found or not allowed by the token: ${missing.join(', ')}`);
        await reportStatus(
          true,
          all('statusMissing', { login: account?.login ?? '?', missing: listMissing(missing) }),
        );
      } else {
        await reportStatus(
          true,
          all('statusConnected', { login: account?.login ?? '?', count: repos.length }),
        );
      }
    },
    onError: async (err) => {
      await reportStatus(false, errorMessage(err));
    },
    now,
    logger,
  });

  /**
   * @description Offer the account and every repository read on the Discovery
   * screen.
   * @returns {Promise<number>} How many devices were offered.
   */
  async function publishDiscoveredDevices() {
    const devices = [];
    const account = watcher.account();
    if (config.token && account) {
      devices.push(buildAccountDevice(gladys, account, textLanguage()));
    }
    if (config.token) {
      knownRepositories().forEach((repo) =>
        devices.push(buildRepositoryDevice(gladys, repo, textLanguage())),
      );
    }
    await gladys.publishDiscoveredDevices(devices);
    return devices.length;
  }

  // --- Repositories of the widgets and scene actions ---------------------------------

  /**
   * @description The repository a widget or a scene action targets: the chosen
   * device, or the first followed repository.
   * @param {unknown} deviceExternalId - The `source: "devices"` value.
   * @returns {object|null} The snapshot, null when none is known.
   */
  function resolveRepository(deviceExternalId) {
    const repos = knownRepositories();
    const id = idFromExternalId(deviceExternalId, DEVICE_TYPES.REPOSITORY);
    if (id !== null) {
      const chosen = repos.find((repo) => repo.id === id);
      if (chosen) {
        return chosen;
      }
    }
    return repos[0] ?? null;
  }

  /**
   * @description The content explaining why a widget has nothing to show, or null.
   * @param {string} lang - The user language.
   * @returns {object|null} The content.
   */
  function widgetBlocker(lang) {
    if (!config.token) {
      return messageContent(t('noToken', lang));
    }
    if (watcher.fetchedAt() === null) {
      return messageContent(t('notReadYet', lang), 30);
    }
    return null;
  }

  // --- Dashboard widgets -------------------------------------------------------------
  gladys.onWidgetGet(WIDGETS.REPOSITORY, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const blocker = widgetBlocker(lang);
    if (blocker) {
      return blocker;
    }
    const repo = resolveRepository(settings.repository);
    if (!repo) {
      return messageContent(t('noRepository', lang));
    }
    return buildRepositoryWidget({
      repo,
      language: lang,
      now: now(),
      pollSeconds: config.pollInterval,
    });
  });

  gladys.onWidgetGet(WIDGETS.ACTIVITY, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const blocker = widgetBlocker(lang);
    if (blocker) {
      return blocker;
    }
    const repos = settings.repository
      ? [resolveRepository(settings.repository)].filter(Boolean)
      : knownRepositories();
    if (repos.length === 0) {
      return messageContent(t('noRepository', lang));
    }
    return buildActivityWidget({
      repos,
      language: lang,
      settings,
      pollSeconds: config.pollInterval,
    });
  });

  gladys.onWidgetGet(WIDGETS.ACCOUNT, async ({ language: lang }) => {
    rememberLanguage(lang);
    const blocker = widgetBlocker(lang);
    if (blocker) {
      return blocker;
    }
    const account = watcher.account();
    if (!account) {
      return messageContent(t('notReadYet', lang), 30);
    }
    return buildAccountWidget({
      account,
      rateLimit: watcher.rateLimit(),
      repositories: knownRepositories().length,
      language: lang,
      now: now(),
      pollSeconds: config.pollInterval,
    });
  });

  // --- Scene actions -----------------------------------------------------------------
  gladys.onSceneAction(SCENE_ACTIONS.GET_REPOSITORY, async (fields) => {
    if (!config.token) {
      throw new Error('No GitHub token is configured');
    }
    const target = resolveRepository(fields.repository);
    if (!target) {
      throw new Error('No GitHub repository is followed, or GitHub has not been read yet');
    }
    const fresh = await watcher.get(target.fullName, SNAPSHOT_MAX_AGE_MS);
    return buildRepositoryOutputs(fresh ?? target, textLanguage());
  });

  // --- Configuration screen actions --------------------------------------------------
  gladys.onAction(ACTIONS.TEST_CONNECTION, async () => {
    if (!config.token) {
      return all('noToken');
    }
    let answer;
    try {
      answer = await github.round(config.repositories);
    } catch (err) {
      return errorMessage(err);
    }
    const login = answer.viewer?.login ?? '?';
    const quota = answer.rateLimit ?? {};
    const missing = config.repositories.filter((full) => !answer.repositories.get(full));
    const parts = [
      all('testOk', { login, remaining: quota.remaining ?? '?', limit: quota.limit ?? '?' }),
      all('testRepositories', {
        ok: config.repositories.length - missing.length,
        total: config.repositories.length,
      }),
    ];
    if (missing.length > 0) {
      parts.push(all('testMissing', { missing: listMissing(missing) }));
    }
    return Object.fromEntries(
      LANGUAGES.map((lang) => [lang, parts.map((part) => part[lang]).join(' ')]),
    );
  });

  // --- Devices -----------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    await watcher.round();
    const count = await publishDiscoveredDevices();
    logger.info(`Scan: ${count} GitHub device(s) offered`);
  });

  gladys.onDeviceCreated(async () => {
    await refreshCreatedDevices();
    // States sent before the device existed were dropped by Gladys, and the SDK
    // forgot what it sent for this device: send everything known again.
    await publishStates(knownRepositories(), watcher.account()).catch((err) =>
      logger.warn(`Unable to publish the states: ${err.message}`),
    );
    refreshWidgets();
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration -----------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallback] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallback) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      language = readLanguage(raw, language);
    } catch (err) {
      if (fallback) {
        config = normalizeConfig(fallback);
      }
      logger.error('Unable to read the configuration', err);
    }
  }

  /**
   * @description Read GitHub now and offer the devices; report a missing token.
   * @returns {Promise<void>}
   */
  async function refreshAll() {
    if (!config.token) {
      await reportStatus(false, all('noToken'));
    }
    await watcher.round();
    await publishDiscoveredDevices().catch((err) =>
      logger.warn(`Unable to offer the devices: ${err.message}`),
    );
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    const previousToken = config.token;
    await loadConfig(rawConfig);
    logger.info(
      `Configuration updated: ${config.repositories.length} repository(ies), read every ${config.pollInterval} s`,
    );
    if (config.token !== previousToken) {
      // Maybe another account: start again from a fresh baseline.
      watcher.reset();
    }
    watcher.prune();
    watcher.reschedule();
    await refreshAll();
  });

  // --- Connection lifecycle ----------------------------------------------------------
  // Each step on its own: a failing one must not keep the watcher from starting.
  gladys.on('connected', async () => {
    await loadConfig();
    await refreshCreatedDevices();
    lastStatus = null;
    await refreshAll();
    watcher.start();
  });

  // --- Graceful shutdown -------------------------------------------------------------
  gladys.handleShutdown((signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    watcher.stop();
  });

  return { watcher, getConfig: () => config };
}

export { createApp };
