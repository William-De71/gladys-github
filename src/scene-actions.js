// -----------------------------------------------------------------------------
// Scene actions of the integration.
//
//   - `get_repository`  the figures and latest items of a repository, as
//                       outputs a scene can put in a message or compare
//                       ("send me the open issues every Monday").
//
// Outputs are scalars only, exactly the keys the manifest declares. An
// unknown counter is -1 (an output cannot be empty and 0 would be a lie);
// an unknown text is ''.
// -----------------------------------------------------------------------------

import { releaseLabel, commitLabel } from './device.js';
import { t } from './i18n.js';

const SCENE_ACTIONS = { GET_REPOSITORY: 'get_repository' };
const UNKNOWN = -1;
const MAX_TEXT = 10000;

const clip = (value) => String(value ?? '').slice(0, MAX_TEXT);
const number = (value) => (Number.isInteger(value) ? value : UNKNOWN);

/**
 * @description The outputs of `get_repository`.
 * @param {object} repo - The repository snapshot.
 * @param {string} language - Language of the summary.
 * @returns {object} The outputs.
 * @example
 * buildRepositoryOutputs(snapshot, 'fr').summary;
 */
function buildRepositoryOutputs(repo, language) {
  const release = repo.releases[0] ?? null;
  const checks = repo.checks ?? '';
  return {
    repository_name: clip(repo.fullName),
    url: clip(repo.url),
    stars: number(repo.stars),
    forks: number(repo.forks),
    watchers: number(repo.watchers),
    open_issues: number(repo.openIssues),
    open_pull_requests: number(repo.openPullRequests),
    latest_release: clip(releaseLabel(repo)),
    latest_release_url: clip(release?.url),
    latest_commit: clip(commitLabel(repo)),
    checks,
    summary: clip(
      t('summaryRepository', language, {
        repository: repo.fullName,
        stars: number(repo.stars),
        issues: number(repo.openIssues),
        pulls: number(repo.openPullRequests),
        release: release ? release.tag : t('none', language),
      }),
    ),
  };
}

export { SCENE_ACTIONS, UNKNOWN, buildRepositoryOutputs };
