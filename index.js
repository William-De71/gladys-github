// -----------------------------------------------------------------------------
// Entry point of the GitHub external integration.
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
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the GitHub integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
