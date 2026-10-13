# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.2.0] - 2026-10-13

### Added

- follow every repository of an account or organization with an owner/* pattern ([5a95886](https://github.com/William-De71/gladys-github/commit/5a95886374229bbc35746a5347de98af241220ab))

## [0.1.1] - 2026-10-13

### Fixed

- read the repositories with a fine-grained token that may not read every field ([88a4a40](https://github.com/William-De71/gladys-github/commit/88a4a40b13f75ec474a42f867a5458573c212a58))

## [0.1.0] - 2026-10-13

### Added

- A device per followed GitHub repository: stars, forks, watchers, open issues and pull requests, merged pull requests, discussions, downloads of the latest release, and the latest release, tag, commit, issue, pull request and discussion.
- A device for the account of the token: followers, following, public repositories and gists.
- Scene triggers: release published (release or pre-release), issue opened, pull request opened, discussion started, commit pushed on the default branch, star added, checks of the default branch passed or failed.
- Scene action "read a repository": its figures and latest items as outputs.
- Dashboard widgets: a repository at a glance, the latest activity of the followed repositories, the account with its remaining API quota.
- Configuration with a personal access token (read-only access is enough), up to 20 repositories, a refresh interval from 60 seconds to 1 hour and a "Test the connection" button.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.

[0.2.0]: https://github.com/William-De71/gladys-github/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/William-De71/gladys-github/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/William-De71/gladys-github/releases/tag/v0.1.0
