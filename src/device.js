// -----------------------------------------------------------------------------
// The devices of the GitHub integration, offered on the Discovery screen.
//
// One device per followed repository, "GitHub owner/name":
//   - counters (counter-sensor / integer): stars, forks, watchers, open
//     issues, open pull requests, merged pull requests, discussions and the
//     downloads of the latest release's files;
//   - texts (text / text): the latest release, tag, commit of the default
//     branch, issue, pull request and discussion.
// One device for the account that owns the token, "GitHub @login": followers,
// following, public repositories, public gists.
//
// External ids are built on the numeric ids GitHub gives repositories and
// accounts (`databaseId`): renaming or transferring a repository, or changing
// a login, keeps the device. The `owner/name` in the device params is only
// informative.
//
// GitHub has no push: the integration reads it on its own timer (every 120 s
// by default, beyond the 60 s Gladys polls at most), so `should_poll` is false.
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';
import { t } from './i18n.js';

const DEVICE_TYPES = { REPOSITORY: 'repository', ACCOUNT: 'account' };

// Bounds of the counters: far beyond the largest repositories and accounts.
const MAX_COUNT = 100000000;
// A text state is a short label; longer ones are cut with an ellipsis.
const MAX_TEXT = 200;

const REPOSITORY_COUNTERS = [
  { key: 'stars', text: 'featureStars', read: (repo) => repo.stars },
  { key: 'forks', text: 'featureForks', read: (repo) => repo.forks },
  { key: 'watchers', text: 'featureWatchers', read: (repo) => repo.watchers },
  { key: 'open_issues', text: 'featureOpenIssues', read: (repo) => repo.openIssues },
  {
    key: 'open_pull_requests',
    text: 'featureOpenPullRequests',
    read: (repo) => repo.openPullRequests,
  },
  {
    key: 'merged_pull_requests',
    text: 'featureMergedPullRequests',
    read: (repo) => repo.mergedPullRequests,
  },
  { key: 'discussions', text: 'featureDiscussions', read: (repo) => repo.discussionCount },
  {
    key: 'release_downloads',
    text: 'featureReleaseDownloads',
    read: (repo) => repo.releases[0]?.downloads ?? null,
  },
];

const REPOSITORY_TEXTS = [
  { key: 'latest_release', text: 'featureLatestRelease', read: (repo) => releaseLabel(repo) },
  { key: 'latest_tag', text: 'featureLatestTag', read: (repo) => repo.tag?.name || null },
  { key: 'latest_commit', text: 'featureLatestCommit', read: (repo) => commitLabel(repo) },
  {
    key: 'latest_issue',
    text: 'featureLatestIssue',
    read: (repo) => itemLabel(repo.issues[0]),
  },
  {
    key: 'latest_pull_request',
    text: 'featureLatestPullRequest',
    read: (repo) => itemLabel(repo.pullRequests[0]),
  },
  {
    key: 'latest_discussion',
    text: 'featureLatestDiscussion',
    read: (repo) => itemLabel(repo.discussions[0]),
  },
];

const ACCOUNT_COUNTERS = [
  { key: 'followers', text: 'featureFollowers', read: (account) => account.followers },
  { key: 'following', text: 'featureFollowing', read: (account) => account.following },
  {
    key: 'public_repositories',
    text: 'featurePublicRepositories',
    read: (account) => account.publicRepositories,
  },
  { key: 'public_gists', text: 'featurePublicGists', read: (account) => account.publicGists },
];

const clip = (value, max = MAX_TEXT) => {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

/**
 * @description "#12 Title" for an issue, a pull request or a discussion.
 * @param {object|undefined} item - The item.
 * @returns {string|null} The label.
 */
function itemLabel(item) {
  return item && Number.isInteger(item.number) ? clip(`#${item.number} ${item.title}`) : null;
}

/**
 * @description "v1.2.0" or "Name (v1.2.0)" for the latest release.
 * @param {object} repo - The repository snapshot.
 * @returns {string|null} The label.
 */
function releaseLabel(repo) {
  const release = repo.releases[0];
  if (!release) {
    return null;
  }
  return clip(
    release.name && release.name !== release.tag ? `${release.name} (${release.tag})` : release.tag,
  );
}

/**
 * @description "abc1234 Message" for the head commit of the default branch.
 * @param {object} repo - The repository snapshot.
 * @returns {string|null} The label.
 */
function commitLabel(repo) {
  const commit = repo.commits[0];
  return commit ? clip(`${commit.shortSha} ${commit.message}`) : null;
}

/**
 * @description The external ids of a repository or of the account.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} type - A DEVICE_TYPES value.
 * @param {number} id - The GitHub databaseId.
 * @returns {{ device: string, feature: Function }} The ids.
 * @example
 * idsOf(gladys, 'repository', 12888993).device; // -> 'ext:github:repository:12888993'
 */
function idsOf(gladys, type, id) {
  return gladys.externalIds(type, String(id));
}

/**
 * @description The GitHub id a device (or feature) external id stands for.
 * @param {unknown} externalId - The external id.
 * @param {string} type - A DEVICE_TYPES value.
 * @returns {number|null} The id.
 * @example
 * idFromExternalId('ext:github:repository:42:stars', 'repository'); // -> 42
 */
function idFromExternalId(externalId, type) {
  const match = new RegExp(`:${type}:(\\d+)(?::[a-z_]+)?$`).exec(String(externalId ?? ''));
  return match ? Number(match[1]) : null;
}

const counter = (ids, language, spec) => ({
  name: t(spec.text, language),
  external_id: ids.feature(spec.key),
  category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
  type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  min: 0,
  max: MAX_COUNT,
});

const label = (ids, language, spec) => ({
  name: t(spec.text, language),
  external_id: ids.feature(spec.key),
  category: DEVICE_FEATURE_CATEGORIES.TEXT,
  type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
  read_only: true,
  has_feedback: false,
  keep_history: false,
  min: 0,
  max: 0,
});

/**
 * @description The device of a repository.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} repo - The repository snapshot.
 * @param {string} [language] - Language of the names.
 * @returns {object} The discovered device.
 * @example
 * buildRepositoryDevice(gladys, snapshot, 'fr');
 */
function buildRepositoryDevice(gladys, repo, language = 'en') {
  const ids = idsOf(gladys, DEVICE_TYPES.REPOSITORY, repo.id);
  return {
    name: t('repositoryDeviceName', language, { repository: repo.fullName }),
    external_id: ids.device,
    should_poll: false,
    params: [{ name: 'GITHUB_REPOSITORY', value: repo.fullName }],
    features: [
      ...REPOSITORY_COUNTERS.map((spec) => counter(ids, language, spec)),
      ...REPOSITORY_TEXTS.map((spec) => label(ids, language, spec)),
    ],
  };
}

/**
 * @description The device of the account that owns the token.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} account - The account snapshot.
 * @param {string} [language] - Language of the names.
 * @returns {object} The discovered device.
 */
function buildAccountDevice(gladys, account, language = 'en') {
  const ids = idsOf(gladys, DEVICE_TYPES.ACCOUNT, account.id);
  return {
    name: t('accountDeviceName', language, { login: account.login }),
    external_id: ids.device,
    should_poll: false,
    params: [{ name: 'GITHUB_LOGIN', value: account.login }],
    features: ACCOUNT_COUNTERS.map((spec) => counter(ids, language, spec)),
  };
}

/**
 * @description States of a list of feature specs. An unknown value is
 * omitted, never published as 0 or an empty text.
 * @param {object} ids - The ids.
 * @param {object[]} specs - The feature specs.
 * @param {object} source - The snapshot.
 * @param {boolean} isText - Text features.
 * @returns {Array<object>} The states.
 */
function statesOf(ids, specs, source, isText) {
  return specs.flatMap((spec) => {
    const value = spec.read(source);
    if (isText) {
      return value ? [{ device_feature_external_id: ids.feature(spec.key), text: value }] : [];
    }
    return Number.isInteger(value)
      ? [{ device_feature_external_id: ids.feature(spec.key), state: Math.min(value, MAX_COUNT) }]
      : [];
  });
}

/**
 * @description The states of a repository.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} repo - The repository snapshot.
 * @returns {Array<object>} The states.
 */
function buildRepositoryStates(gladys, repo) {
  const ids = idsOf(gladys, DEVICE_TYPES.REPOSITORY, repo.id);
  return [
    ...statesOf(ids, REPOSITORY_COUNTERS, repo, false),
    ...statesOf(ids, REPOSITORY_TEXTS, repo, true),
  ];
}

/**
 * @description The states of the account.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} account - The account snapshot.
 * @returns {Array<object>} The states.
 */
function buildAccountStates(gladys, account) {
  return statesOf(
    idsOf(gladys, DEVICE_TYPES.ACCOUNT, account.id),
    ACCOUNT_COUNTERS,
    account,
    false,
  );
}

export {
  DEVICE_TYPES,
  MAX_COUNT,
  REPOSITORY_COUNTERS,
  REPOSITORY_TEXTS,
  ACCOUNT_COUNTERS,
  idsOf,
  idFromExternalId,
  itemLabel,
  releaseLabel,
  commitLabel,
  buildRepositoryDevice,
  buildAccountDevice,
  buildRepositoryStates,
  buildAccountStates,
};
