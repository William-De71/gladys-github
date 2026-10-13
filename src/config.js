// -----------------------------------------------------------------------------
// Configuration of the GitHub integration.
//
// Fields of the config_schema:
//   - `token`          a GitHub personal access token (fine-grained, read-only
//                      access is enough): the GraphQL API needs one;
//   - `repositories`   the repositories to follow, `owner/name` or their
//                      github.com URL, separated by commas or new lines;
//   - `poll_interval`  how often GitHub is read, in seconds;
//   - `language`       language of the texts Gladys does not ask for in a
//                      language (device names, scene summaries): `auto`
//                      follows the language of the last widget request.
//
// Internal key, outside the config_schema (never shown in the UI):
//   - `last_language`  language of the last widget request, for the device
//                      names and the scene texts after a restart.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';
import { MAX_REPOSITORIES } from './github-api.js';

const POLL_INTERVAL = { min: 60, max: 3600, default: 120 };
const AUTO_LANGUAGE = 'auto';
// GitHub logins: 1 to 39 letters, digits or single hyphens. Repository names:
// letters, digits, ".", "_" and "-", 100 at most.
const REPOSITORY_REGEX = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/;

const INTERNAL_KEYS = { language: 'last_language' };

/**
 * @description Read a bounded number field, falling back to its default.
 * @param {unknown} raw - The raw value (the form can send numbers as strings).
 * @param {{ min: number, max: number, default: number }} bounds - The bounds.
 * @returns {number} The value.
 * @example
 * readNumber('300', POLL_INTERVAL); // -> 300
 */
function readNumber(raw, bounds) {
  const value = Number(raw ?? bounds.default);
  if (raw === '' || !Number.isFinite(value)) {
    return bounds.default;
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

const readString = (raw) => (typeof raw === 'string' ? raw.trim() : '');

/**
 * @description Read one repository: `owner/name`, a github.com URL, with or
 * without `.git` or a trailing path.
 * @param {string} raw - The entry.
 * @returns {string|null} `owner/name`, null when it cannot be one.
 * @example
 * parseRepository('https://github.com/GladysAssistant/Gladys/issues'); // -> 'GladysAssistant/Gladys'
 */
function parseRepository(raw) {
  let value = raw.trim();
  const url = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s?#]+)/i.exec(value);
  if (url) {
    value = `${url[1]}/${url[2]}`;
  }
  value = value.replace(/\.git$/i, '');
  if (value === '..' || value.endsWith('/.') || value.endsWith('/..')) {
    return null;
  }
  return REPOSITORY_REGEX.test(value) ? value : null;
}

/**
 * @description Parse the repositories field: separated by commas, semicolons,
 * spaces or new lines, invalid entries dropped, duplicates removed
 * (GitHub names are case-insensitive), capped.
 * @param {unknown} raw - The raw field.
 * @returns {string[]} The repositories, as typed.
 * @example
 * parseRepositories('octo/a, Octo/A; octo/b'); // -> ['octo/a', 'octo/b']
 */
function parseRepositories(raw) {
  const seen = new Set();
  const list = [];
  readString(raw)
    .split(/[\s,;]+/)
    .map(parseRepository)
    .filter(Boolean)
    .forEach((full) => {
      const key = full.toLowerCase();
      if (!seen.has(key) && list.length < MAX_REPOSITORIES) {
        seen.add(key);
        list.push(full);
      }
    });
  return list;
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {{ token: string, repositories: string[], pollInterval: number, language: string }}
 * The config (poll interval in seconds, language 'auto' or a language code).
 * @example
 * normalizeConfig({ token: 'github_pat_…', repositories: 'octo/hello' });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  return {
    // A token never holds spaces: a pasted one may carry a new line.
    token: readString(config.token).replace(/\s+/g, ''),
    repositories: parseRepositories(config.repositories),
    pollInterval: readNumber(config.poll_interval, POLL_INTERVAL),
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

/**
 * @description Read the stored language of the last request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 * @example
 * readLanguage({ last_language: 'fr' }, 'en'); // -> 'fr'
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : fallback;
}

export {
  POLL_INTERVAL,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  normalizeConfig,
  parseRepository,
  parseRepositories,
  readLanguage,
};
