// -----------------------------------------------------------------------------
// The watcher: reads GitHub on a loop.
//
// One GraphQL request per round reads the account, the quota and every
// followed repository (see github-api.js). Each round leaves a snapshot per
// repository, the single source the devices, the widgets and the scene
// actions read from, and the transitions since the previous round (see
// tracker.js).
//
// The loop is a chain of timeouts, not an interval: a slow round never
// overlaps the next one, and a new poll interval takes effect at once. When
// the quota is exhausted, the next round waits for its renewal.
// -----------------------------------------------------------------------------

import { diffRepository } from './tracker.js';
import { readRepository, readAccount, readRateLimit } from './read.js';

/**
 * @description Create the watcher.
 * @param {object} options - Options.
 * @param {object} options.github - The GitHub client.
 * @param {Function} options.getRepositories - `() => string[]` (`owner/name`).
 * @param {Function} options.isEnabled - `() => boolean` (a token is set).
 * @param {Function} options.getIntervalMs - `() => number`.
 * @param {Function} [options.onRound] - `(round)` after every successful read.
 * @param {Function} [options.onError] - `(error)` after every failed read.
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {object} [options.logger] - Logger.
 * @returns {object} The watcher.
 * @example
 * const watcher = createWatcher({ github, getRepositories: () => ['octo/hello'], … });
 */
function createWatcher({
  github,
  getRepositories,
  isEnabled,
  getIntervalMs,
  onRound = () => {},
  onError = () => {},
  now = () => Date.now(),
  logger = console,
}) {
  // lowercased `owner/name` -> repository snapshot
  const snapshots = new Map();
  let account = null;
  let rateLimit = null;
  let fetchedAt = null;
  let timer = null;
  let running = false;
  let inFlight = null;
  let retryAt = null;

  /**
   * @description Read GitHub once, update the snapshots, report the round.
   * @returns {Promise<object>} The round.
   * @throws {Error} When the read fails (after onError).
   */
  async function read() {
    const repositories = getRepositories();
    let answer;
    try {
      answer = await github.round(repositories);
    } catch (err) {
      if (err.kind === 'rate_limit' && Number.isFinite(err.resetAt)) {
        retryAt = err.resetAt;
      }
      await onError(err);
      throw err;
    }
    retryAt = null;
    const time = now();
    const repos = [];
    for (const name of repositories) {
      const raw = answer.repositories.get(name);
      const snapshot = readRepository(raw);
      if (!snapshot) {
        continue;
      }
      const key = name.toLowerCase();
      const previous = snapshots.get(key) ?? null;
      const events = diffRepository(previous, snapshot);
      const signature = JSON.stringify(snapshot);
      snapshots.set(key, { ...snapshot, fetchedAt: time, signature });
      repos.push({ name, snapshot, events, changed: previous?.signature !== signature });
    }
    const previousAccount = account;
    account = readAccount(answer.viewer) ?? account;
    rateLimit = readRateLimit(answer.rateLimit) ?? rateLimit;
    fetchedAt = time;
    const missing = repositories.filter((name) => !readRepository(answer.repositories.get(name)));
    const round = {
      repos,
      account,
      accountChanged: JSON.stringify(previousAccount) !== JSON.stringify(account),
      rateLimit,
      missing,
    };
    await onRound(round);
    return round;
  }

  /**
   * @description One round now, shared with a round already running.
   * @returns {Promise<object|null>} The round, null when disabled or failed.
   */
  function round() {
    if (!isEnabled()) {
      return Promise.resolve(null);
    }
    if (!inFlight) {
      inFlight = read()
        .catch((err) => {
          logger.warn(`GitHub read failed: ${err.message}`);
          return null;
        })
        .finally(() => {
          inFlight = null;
        });
    }
    return inFlight;
  }

  /**
   * @description Delay before the next round.
   * @returns {number} In ms.
   */
  function nextDelay() {
    const interval = getIntervalMs();
    if (retryAt && retryAt > now()) {
      return Math.max(interval, retryAt - now() + 5000);
    }
    return interval;
  }

  /**
   * @description Schedule the next round.
   */
  function schedule() {
    clearTimeout(timer);
    if (!running) {
      return;
    }
    timer = setTimeout(async () => {
      await round();
      schedule();
    }, nextDelay());
    timer.unref?.();
  }

  return {
    /** Start the loop: one round per interval (the caller reads once first). */
    start() {
      if (running) {
        return;
      }
      running = true;
      schedule();
    },
    /** Stop the loop. */
    stop() {
      running = false;
      clearTimeout(timer);
    },
    /** Apply a new interval at once. */
    reschedule() {
      schedule();
    },
    round,
    /**
     * @description A fresh enough snapshot of a repository, read now otherwise.
     * @param {string} name - `owner/name`.
     * @param {number} maxAgeMs - Accepted age.
     * @returns {Promise<object|null>} The snapshot.
     */
    async get(name, maxAgeMs) {
      const cached = snapshots.get(name.toLowerCase());
      if (cached && now() - cached.fetchedAt <= maxAgeMs) {
        return cached;
      }
      await round();
      return snapshots.get(name.toLowerCase()) ?? null;
    },
    /**
     * @description The last snapshot of a repository, without reading.
     * @param {string} name - `owner/name`.
     * @returns {object|null} The snapshot.
     */
    peek(name) {
      return snapshots.get(name.toLowerCase()) ?? null;
    },
    /** @returns {object|null} The account of the token. */
    account: () => account,
    /** @returns {object|null} The last known API quota. */
    rateLimit: () => rateLimit,
    /** @returns {number|null} When GitHub was last read, in ms. */
    fetchedAt: () => fetchedAt,
    /** Forget the repositories that are not followed any more. */
    prune() {
      const followed = new Set(getRepositories().map((name) => name.toLowerCase()));
      [...snapshots.keys()].forEach((key) => {
        if (!followed.has(key)) {
          snapshots.delete(key);
        }
      });
    },
    /** Forget everything (new token: maybe another account). */
    reset() {
      snapshots.clear();
      account = null;
      rateLimit = null;
      fetchedAt = null;
    },
  };
}

export { createWatcher };
