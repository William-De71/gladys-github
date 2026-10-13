// -----------------------------------------------------------------------------
// Dashboard widgets of the GitHub integration.
//
//   - `repository`  one repository at a glance: stars, forks, open issues and
//                   pull requests, the latest release, the checks of the
//                   default branch, a link to GitHub;
//   - `activity`    the latest releases, issues, pull requests and commits of
//                   the followed repositories (or of one), newest first;
//   - `account`     the account of the token: followers, following, public
//                   repositories, and the remaining GitHub API quota.
//
// The contents come from the snapshots of the last round: a widget never
// costs a GitHub call. Every text exists in the four languages (the content
// is cached per language).
// -----------------------------------------------------------------------------

import { t, ago } from './i18n.js';

const WIDGETS = { REPOSITORY: 'repository', ACTIVITY: 'activity', ACCOUNT: 'account' };

const ACTIVITY_KINDS = ['all', 'releases', 'issues', 'pull_requests', 'commits'];
const ACTIVITY_COUNT = { min: 1, max: 8, default: 6 };
const TTL = { min: 30, max: 3600, message: 300 };

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 * @example
 * clip('A very long title', 10); // -> 'A very lo…'
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const httpsLink = (url) => (typeof url === 'string' && url.startsWith('https://') ? url : null);

/**
 * @description The freshness of a content: the poll interval, bounded.
 * @param {number} pollSeconds - The poll interval.
 * @returns {number} The TTL in seconds.
 */
function ttlOf(pollSeconds) {
  return Math.min(TTL.max, Math.max(TTL.min, Math.round(pollSeconds)));
}

/**
 * @description Read a bounded integer setting.
 * @param {unknown} raw - The raw setting.
 * @param {{ min: number, max: number, default: number }} bounds - The bounds.
 * @returns {number} The value.
 */
function readCount(raw, bounds) {
  const value = Number(raw);
  if (raw === undefined || raw === null || raw === '' || !Number.isFinite(value)) {
    return bounds.default;
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 * @example
 * messageContent('No repository');
 */
function messageContent(message, ttl = TTL.message) {
  return {
    ttl_seconds: ttl,
    components: [{ type: 'text', variant: 'body', text: clip(message, 300) }],
  };
}

/**
 * @description A short number for a tile (12 characters at most): 91418 -> "91.4k".
 * @param {number|null} value - The value.
 * @param {string} language - The language.
 * @returns {number|string} The tile value.
 */
function tileValue(value, language) {
  if (!Number.isInteger(value)) {
    return '–';
  }
  if (value < 100000) {
    return value;
  }
  return new Intl.NumberFormat(language, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

const CHECKS = {
  success: { text: 'checksPassed', color: 'success' },
  failure: { text: 'checksFailed', color: 'danger' },
  pending: { text: 'checksRunning', color: 'warning' },
};

/**
 * @description The `repository` widget.
 * @param {object} options - Options.
 * @param {object} options.repo - The repository snapshot.
 * @param {string} options.language - The user language.
 * @param {number} options.now - Now, in ms.
 * @param {number} options.pollSeconds - The poll interval.
 * @returns {object} The content.
 * @example
 * buildRepositoryWidget({ repo, language: 'fr', now: Date.now(), pollSeconds: 120 });
 */
function buildRepositoryWidget({ repo, language, now, pollSeconds }) {
  const components = [{ type: 'text', variant: 'heading', text: clip(repo.fullName, 40) }];
  if (repo.description) {
    components.push({ type: 'text', variant: 'caption', text: clip(repo.description, 80) });
  }
  components.push(
    {
      type: 'value',
      value: tileValue(repo.stars, language),
      label: t('stars', language),
      icon: 'star',
      color: 'warning',
    },
    {
      type: 'value',
      value: tileValue(repo.forks, language),
      label: t('forks', language),
      icon: 'git-branch',
    },
    {
      type: 'value',
      value: tileValue(repo.openIssues, language),
      label: t('issues', language),
      icon: 'alert-circle',
      color: 'info',
    },
    {
      type: 'value',
      value: tileValue(repo.openPullRequests, language),
      label: t('pullRequests', language),
      icon: 'git-pull-request',
      color: 'primary',
    },
  );
  const items = [];
  const release = repo.releases[0];
  items.push({
    label: t('latestRelease', language),
    value: release
      ? clip(
          Number.isFinite(release.publishedAt)
            ? `${release.tag} · ${ago(release.publishedAt, now, language)}`
            : release.tag,
          40,
        )
      : t('none', language),
    color: release ? 'primary' : 'neutral',
  });
  const checks = CHECKS[repo.checks];
  if (checks) {
    items.push({
      label: clip(t('checksOf', language, { branch: repo.branch }), 40),
      value: t(checks.text, language),
      color: checks.color,
    });
  }
  const commit = repo.commits[0];
  if (commit && Number.isFinite(commit.committedAt)) {
    items.push({ label: t('lastCommit', language), value: ago(commit.committedAt, now, language) });
  }
  if (repo.archived) {
    items.push({ label: t('state', language), value: t('archived', language), color: 'warning' });
  }
  components.push({ type: 'status', items });
  const link = httpsLink(repo.url);
  if (link) {
    components.push({
      type: 'button',
      label: t('openGithub', language),
      icon: 'github',
      style: 'secondary',
      link: { url: link },
    });
  }
  return { ttl_seconds: ttlOf(pollSeconds), components };
}

/**
 * @description Read the settings of the `activity` widget.
 * @param {object} [settings] - The raw settings.
 * @returns {{ kind: string, count: number }} The settings.
 * @example
 * readActivitySettings({ kind: 'releases' }); // -> { kind: 'releases', count: 6 }
 */
function readActivitySettings(settings = {}) {
  return {
    kind: ACTIVITY_KINDS.includes(settings.kind) ? settings.kind : ACTIVITY_KINDS[0],
    count: readCount(settings.count, ACTIVITY_COUNT),
  };
}

/**
 * @description The activity entries of a repository, of one kind or all.
 * @param {object} repo - The repository snapshot.
 * @param {string} kind - An ACTIVITY_KINDS value.
 * @returns {Array<object>} `{ kind, title, date, url, author, repository }`.
 */
function activityOf(repo, kind) {
  const entries = [];
  const want = (value) => kind === 'all' || kind === value;
  if (want('releases')) {
    repo.releases.forEach((release) =>
      entries.push({
        kind: release.prerelease ? 'prerelease' : 'release',
        title:
          release.name && release.name !== release.tag
            ? `${release.tag} ${release.name}`
            : release.tag,
        date: release.publishedAt,
        url: release.url,
        author: release.author,
      }),
    );
  }
  if (want('issues')) {
    repo.issues.forEach((item) =>
      entries.push({
        kind: 'issue',
        title: `#${item.number} ${item.title}`,
        date: item.createdAt,
        url: item.url,
        author: item.author,
      }),
    );
  }
  if (want('pull_requests')) {
    repo.pullRequests.forEach((item) =>
      entries.push({
        kind: item.draft ? 'draft' : 'pull_request',
        title: `#${item.number} ${item.title}`,
        date: item.createdAt,
        url: item.url,
        author: item.author,
      }),
    );
  }
  if (want('commits')) {
    repo.commits.forEach((commit) =>
      entries.push({
        kind: 'commit',
        title: `${commit.shortSha} ${commit.message}`,
        date: commit.committedAt,
        url: commit.url,
        author: commit.author,
      }),
    );
  }
  return entries.map((entry) => ({ ...entry, repository: repo.fullName }));
}

const BADGES = {
  release: { text: 'badgeRelease', color: 'success' },
  prerelease: { text: 'badgePrerelease', color: 'warning' },
  issue: { text: 'badgeIssue', color: 'info' },
  pull_request: { text: 'badgePullRequest', color: 'primary' },
  draft: { text: 'badgeDraft', color: 'neutral' },
  commit: { text: 'badgeCommit', color: 'neutral' },
};

/**
 * @description The `activity` widget.
 * @param {object} options - Options.
 * @param {object[]} options.repos - The repository snapshots to list.
 * @param {string} options.language - The user language.
 * @param {object} [options.settings] - `{ kind, count }`.
 * @param {number} options.pollSeconds - The poll interval.
 * @returns {object} The content.
 * @example
 * buildActivityWidget({ repos, language: 'en', settings: { kind: 'all' }, pollSeconds: 120 });
 */
function buildActivityWidget({ repos, language, settings = {}, pollSeconds }) {
  const { kind, count } = readActivitySettings(settings);
  const entries = repos
    .flatMap((repo) => activityOf(repo, kind))
    .filter((entry) => Number.isFinite(entry.date))
    .sort((a, b) => b.date - a.date)
    .slice(0, count);
  const caption = {
    type: 'text',
    variant: 'caption',
    text: clip(
      repos.length === 1
        ? t('activityOf', language, { repository: repos[0].fullName })
        : t('activityAll', language, { count: repos.length }),
      80,
    ),
  };
  if (entries.length === 0) {
    return {
      ttl_seconds: ttlOf(pollSeconds),
      components: [caption, { type: 'text', variant: 'body', text: t('noActivity', language) }],
    };
  }
  const items = entries.map((entry) => {
    const badge = BADGES[entry.kind];
    const item = {
      title: clip(entry.title, 60),
      date: new Date(entry.date).toISOString(),
      badge: { text: clip(t(badge.text, language), 16), color: badge.color },
      description: clip(
        entry.author
          ? t('byAuthor', language, { repository: entry.repository, author: entry.author })
          : entry.repository,
        2000,
      ),
    };
    const link = httpsLink(entry.url);
    if (link) {
      item.links = [{ url: link, label: 'GitHub' }];
    }
    return item;
  });
  return {
    ttl_seconds: ttlOf(pollSeconds),
    components: [caption, { type: 'card-list', display: 'list', items }],
  };
}

/**
 * @description The `account` widget.
 * @param {object} options - Options.
 * @param {object} options.account - The account snapshot.
 * @param {object|null} options.rateLimit - The API quota.
 * @param {number} options.repositories - How many repositories are followed.
 * @param {string} options.language - The user language.
 * @param {number} options.now - Now, in ms.
 * @param {number} options.pollSeconds - The poll interval.
 * @returns {object} The content.
 */
function buildAccountWidget({ account, rateLimit, repositories, language, now, pollSeconds }) {
  const components = [{ type: 'text', variant: 'heading', text: clip(`@${account.login}`, 40) }];
  if (account.name) {
    components.push({ type: 'text', variant: 'caption', text: clip(account.name, 80) });
  }
  components.push(
    {
      type: 'value',
      value: tileValue(account.followers, language),
      label: t('followers', language),
      icon: 'users',
      color: 'primary',
    },
    {
      type: 'value',
      value: tileValue(account.following, language),
      label: t('following', language),
      icon: 'user-plus',
    },
    {
      type: 'value',
      value: tileValue(account.publicRepositories, language),
      label: t('publicRepositories', language),
      icon: 'book',
    },
  );
  if (rateLimit && rateLimit.limit > 0) {
    const share = rateLimit.remaining / rateLimit.limit;
    components.push({
      type: 'gauge',
      value: rateLimit.remaining,
      min: 0,
      max: rateLimit.limit,
      label: t('apiQuota', language),
      color: share < 0.1 ? 'danger' : share < 0.3 ? 'warning' : 'success',
    });
  }
  const items = [{ label: t('followedRepositories', language), value: String(repositories) }];
  if (rateLimit && Number.isFinite(rateLimit.resetAt) && rateLimit.resetAt > now) {
    items.push({
      label: t('quotaReset', language),
      value: t('inMinutes', language, { n: Math.ceil((rateLimit.resetAt - now) / 60000) }),
    });
  }
  components.push({ type: 'status', items });
  const link = httpsLink(account.url);
  if (link) {
    components.push({
      type: 'button',
      label: t('openProfile', language),
      icon: 'github',
      style: 'secondary',
      link: { url: link },
    });
  }
  return { ttl_seconds: ttlOf(pollSeconds), components };
}

export {
  WIDGETS,
  ACTIVITY_KINDS,
  ACTIVITY_COUNT,
  messageContent,
  readActivitySettings,
  tileValue,
  buildRepositoryWidget,
  buildActivityWidget,
  buildAccountWidget,
};
