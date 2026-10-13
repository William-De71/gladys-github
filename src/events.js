// -----------------------------------------------------------------------------
// Scene events of the integration.
//
// The tracker says what happened; this module writes the flat `data` of the
// event the core matches against the scene triggers. Every event carries:
//   - `repository`       the device external id of the repository: the value
//                        of the "Repository" filter (a `source: "devices"`
//                        select);
//   - `repository_name`  `owner/name`, readable by the actions;
//   - `summary`          a sentence ready to put in a message;
// plus the fields of its kind. Values are scalars, texts cut at 1,000
// characters.
// -----------------------------------------------------------------------------

import { SCENE_TRIGGERS } from './tracker.js';
import { DEVICE_TYPES, idsOf } from './device.js';
import { t } from './i18n.js';

const MAX_TEXT = 1000;
const RELEASE_TYPES = { STABLE: 'stable', PRERELEASE: 'prerelease' };
const CHECK_STATES = ['success', 'failure'];

const clip = (value) => String(value ?? '').slice(0, MAX_TEXT);

/**
 * @description The event of a transition.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} repo - The repository snapshot.
 * @param {object} event - From diffRepository.
 * @param {string} language - Language of the summary.
 * @returns {{ key: string, data: object }} The event.
 * @example
 * const { key, data } = buildSceneEvent(gladys, repo, event, 'fr');
 * await gladys.publishSceneEvent(key, data);
 */
function buildSceneEvent(gladys, repo, event, language) {
  const data = {
    repository: idsOf(gladys, DEVICE_TYPES.REPOSITORY, repo.id).device,
    repository_name: clip(repo.fullName),
  };
  const values = { repository: repo.fullName };
  switch (event.key) {
    case SCENE_TRIGGERS.RELEASE_PUBLISHED: {
      const { release } = event;
      Object.assign(data, {
        release_type: release.prerelease ? RELEASE_TYPES.PRERELEASE : RELEASE_TYPES.STABLE,
        name: clip(release.name),
        tag: clip(release.tag),
        author: clip(release.author),
        url: clip(release.url),
        summary: clip(
          t(release.prerelease ? 'summaryPrerelease' : 'summaryRelease', language, {
            ...values,
            release: release.name && release.name !== release.tag ? release.name : release.tag,
          }),
        ),
      });
      break;
    }
    case SCENE_TRIGGERS.ISSUE_OPENED:
    case SCENE_TRIGGERS.PULL_REQUEST_OPENED:
    case SCENE_TRIGGERS.DISCUSSION_CREATED: {
      const { item } = event;
      const summaryKey = {
        [SCENE_TRIGGERS.ISSUE_OPENED]: 'summaryIssue',
        [SCENE_TRIGGERS.PULL_REQUEST_OPENED]: 'summaryPullRequest',
        [SCENE_TRIGGERS.DISCUSSION_CREATED]: 'summaryDiscussion',
      }[event.key];
      Object.assign(data, {
        number: item.number,
        title: clip(item.title),
        author: clip(item.author),
        url: clip(item.url),
      });
      if (event.key === SCENE_TRIGGERS.PULL_REQUEST_OPENED) {
        data.draft = item.draft;
      }
      data.summary = clip(
        t(summaryKey, language, {
          ...values,
          number: item.number,
          title: item.title,
          author: item.author || '?',
        }),
      );
      break;
    }
    case SCENE_TRIGGERS.COMMIT_PUSHED: {
      const { commit } = event;
      Object.assign(data, {
        branch: clip(repo.branch),
        sha: clip(commit.sha),
        message: clip(commit.message),
        author: clip(commit.author),
        url: clip(commit.url),
        summary: clip(
          t('summaryCommit', language, {
            ...values,
            branch: repo.branch,
            message: commit.message,
            author: commit.author || '?',
          }),
        ),
      });
      break;
    }
    case SCENE_TRIGGERS.STAR_ADDED:
      Object.assign(data, {
        stars: event.stars,
        added: event.added,
        url: clip(repo.url),
        summary: clip(t('summaryStar', language, { ...values, stars: event.stars })),
      });
      break;
    case SCENE_TRIGGERS.CHECKS_COMPLETED: {
      const { commit } = event;
      Object.assign(data, {
        state: event.state,
        branch: clip(repo.branch),
        sha: clip(commit.sha),
        message: clip(commit.message),
        url: clip(commit.url),
        summary: clip(
          t(event.state === 'success' ? 'summaryChecksPassed' : 'summaryChecksFailed', language, {
            ...values,
            branch: repo.branch,
            message: commit.message,
          }),
        ),
      });
      break;
    }
    default:
      break;
  }
  return { key: event.key, data };
}

export { RELEASE_TYPES, CHECK_STATES, buildSceneEvent };
