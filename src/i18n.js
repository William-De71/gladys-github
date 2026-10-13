// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, widget contents, scene summaries,
// messages of the Configuration screen. Vocabulary of the Gladys interface:
// appareil / Gerät / dispositivo, scène / Szene / escena.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // devices
  repositoryDeviceName: {
    en: 'GitHub {repository}',
    fr: 'GitHub {repository}',
    de: 'GitHub {repository}',
    es: 'GitHub {repository}',
  },
  accountDeviceName: {
    en: 'GitHub @{login}',
    fr: 'GitHub @{login}',
    de: 'GitHub @{login}',
    es: 'GitHub @{login}',
  },
  featureStars: { en: 'Stars', fr: 'Étoiles', de: 'Sterne', es: 'Estrellas' },
  featureForks: { en: 'Forks', fr: 'Forks', de: 'Forks', es: 'Forks' },
  featureWatchers: { en: 'Watchers', fr: 'Abonnés', de: 'Beobachter', es: 'Seguidores' },
  featureOpenIssues: {
    en: 'Open issues',
    fr: 'Issues ouvertes',
    de: 'Offene Issues',
    es: 'Issues abiertas',
  },
  featureOpenPullRequests: {
    en: 'Open pull requests',
    fr: 'Pull requests ouvertes',
    de: 'Offene Pull-Requests',
    es: 'Pull requests abiertas',
  },
  featureMergedPullRequests: {
    en: 'Merged pull requests',
    fr: 'Pull requests fusionnées',
    de: 'Gemergte Pull-Requests',
    es: 'Pull requests fusionadas',
  },
  featureDiscussions: {
    en: 'Discussions',
    fr: 'Discussions',
    de: 'Diskussionen',
    es: 'Discusiones',
  },
  featureReleaseDownloads: {
    en: 'Latest release downloads',
    fr: 'Téléchargements de la dernière version',
    de: 'Downloads des neuesten Releases',
    es: 'Descargas de la última versión',
  },
  featureLatestRelease: {
    en: 'Latest release',
    fr: 'Dernière version',
    de: 'Neuestes Release',
    es: 'Última versión',
  },
  featureLatestTag: {
    en: 'Latest tag',
    fr: 'Dernier tag',
    de: 'Neuester Tag',
    es: 'Última etiqueta',
  },
  featureLatestCommit: {
    en: 'Latest commit',
    fr: 'Dernier commit',
    de: 'Neuester Commit',
    es: 'Último commit',
  },
  featureLatestIssue: {
    en: 'Latest issue',
    fr: 'Dernière issue',
    de: 'Neuestes Issue',
    es: 'Última issue',
  },
  featureLatestPullRequest: {
    en: 'Latest pull request',
    fr: 'Dernière pull request',
    de: 'Neuester Pull-Request',
    es: 'Última pull request',
  },
  featureLatestDiscussion: {
    en: 'Latest discussion',
    fr: 'Dernière discussion',
    de: 'Neueste Diskussion',
    es: 'Última discusión',
  },
  featureFollowers: { en: 'Followers', fr: 'Abonnés', de: 'Follower', es: 'Seguidores' },
  featureFollowing: {
    en: 'Following',
    fr: 'Abonnements',
    de: 'Folgt',
    es: 'Siguiendo',
  },
  featurePublicRepositories: {
    en: 'Public repositories',
    fr: 'Dépôts publics',
    de: 'Öffentliche Repositorys',
    es: 'Repositorios públicos',
  },
  featurePublicGists: {
    en: 'Public gists',
    fr: 'Gists publics',
    de: 'Öffentliche Gists',
    es: 'Gists públicos',
  },

  // scene summaries and outputs
  summaryRelease: {
    en: '{repository}: release {release} is out.',
    fr: '{repository} : la version {release} est publiée.',
    de: '{repository}: Release {release} ist erschienen.',
    es: '{repository}: se ha publicado la versión {release}.',
  },
  summaryPrerelease: {
    en: '{repository}: pre-release {release} is out.',
    fr: '{repository} : la préversion {release} est publiée.',
    de: '{repository}: Vorabversion {release} ist erschienen.',
    es: '{repository}: se ha publicado la versión preliminar {release}.',
  },
  summaryIssue: {
    en: '{repository}: new issue #{number} "{title}" by {author}.',
    fr: '{repository} : nouvelle issue #{number} « {title} » de {author}.',
    de: '{repository}: neues Issue #{number} „{title}“ von {author}.',
    es: '{repository}: nueva issue #{number} «{title}» de {author}.',
  },
  summaryPullRequest: {
    en: '{repository}: new pull request #{number} "{title}" by {author}.',
    fr: '{repository} : nouvelle pull request #{number} « {title} » de {author}.',
    de: '{repository}: neuer Pull-Request #{number} „{title}“ von {author}.',
    es: '{repository}: nueva pull request #{number} «{title}» de {author}.',
  },
  summaryDiscussion: {
    en: '{repository}: new discussion #{number} "{title}" by {author}.',
    fr: '{repository} : nouvelle discussion #{number} « {title} » de {author}.',
    de: '{repository}: neue Diskussion #{number} „{title}“ von {author}.',
    es: '{repository}: nueva discusión #{number} «{title}» de {author}.',
  },
  summaryCommit: {
    en: '{repository} ({branch}): "{message}" by {author}.',
    fr: '{repository} ({branch}) : « {message} » de {author}.',
    de: '{repository} ({branch}): „{message}“ von {author}.',
    es: '{repository} ({branch}): «{message}» de {author}.',
  },
  summaryStar: {
    en: '{repository} got a new star: {stars} in total.',
    fr: '{repository} a reçu une nouvelle étoile : {stars} au total.',
    de: '{repository} hat einen neuen Stern: {stars} insgesamt.',
    es: '{repository} ha recibido una nueva estrella: {stars} en total.',
  },
  summaryChecksPassed: {
    en: '{repository} ({branch}): checks passed for "{message}".',
    fr: '{repository} ({branch}) : vérifications réussies pour « {message} ».',
    de: '{repository} ({branch}): Prüfungen bestanden für „{message}“.',
    es: '{repository} ({branch}): comprobaciones superadas para «{message}».',
  },
  summaryChecksFailed: {
    en: '{repository} ({branch}): checks failed for "{message}".',
    fr: '{repository} ({branch}) : échec des vérifications pour « {message} ».',
    de: '{repository} ({branch}): Prüfungen fehlgeschlagen für „{message}“.',
    es: '{repository} ({branch}): comprobaciones fallidas para «{message}».',
  },
  summaryRepository: {
    en: '{repository}: {stars} stars, {issues} open issues, {pulls} open pull requests, latest release {release}.',
    fr: '{repository} : {stars} étoiles, {issues} issues ouvertes, {pulls} pull requests ouvertes, dernière version {release}.',
    de: '{repository}: {stars} Sterne, {issues} offene Issues, {pulls} offene Pull-Requests, neuestes Release {release}.',
    es: '{repository}: {stars} estrellas, {issues} issues abiertas, {pulls} pull requests abiertas, última versión {release}.',
  },
  none: { en: 'none', fr: 'aucune', de: 'keines', es: 'ninguna' },

  // widgets
  stars: { en: 'Stars', fr: 'Étoiles', de: 'Sterne', es: 'Estrellas' },
  forks: { en: 'Forks', fr: 'Forks', de: 'Forks', es: 'Forks' },
  issues: { en: 'Issues', fr: 'Issues', de: 'Issues', es: 'Issues' },
  pullRequests: {
    en: 'Pull requests',
    fr: 'Pull requests',
    de: 'Pull-Requests',
    es: 'Pull requests',
  },
  latestRelease: {
    en: 'Latest release',
    fr: 'Dernière version',
    de: 'Neuestes Release',
    es: 'Última versión',
  },
  checksOf: {
    en: 'Checks ({branch})',
    fr: 'Vérifications ({branch})',
    de: 'Prüfungen ({branch})',
    es: 'Comprobaciones ({branch})',
  },
  checksPassed: { en: 'Passed', fr: 'Réussies', de: 'Bestanden', es: 'Superadas' },
  checksFailed: { en: 'Failed', fr: 'En échec', de: 'Fehlgeschlagen', es: 'Fallidas' },
  checksRunning: { en: 'Running', fr: 'En cours', de: 'Laufen', es: 'En curso' },
  lastCommit: {
    en: 'Last commit',
    fr: 'Dernier commit',
    de: 'Letzter Commit',
    es: 'Último commit',
  },
  state: { en: 'State', fr: 'État', de: 'Status', es: 'Estado' },
  archived: { en: 'Archived', fr: 'Archivé', de: 'Archiviert', es: 'Archivado' },
  openGithub: {
    en: 'Open on GitHub',
    fr: 'Voir sur GitHub',
    de: 'Auf GitHub öffnen',
    es: 'Abrir en GitHub',
  },
  activityOf: {
    en: 'Activity of {repository}',
    fr: 'Activité de {repository}',
    de: 'Aktivität von {repository}',
    es: 'Actividad de {repository}',
  },
  activityAll: {
    en: 'Activity of {count} repositories',
    fr: 'Activité de {count} dépôts',
    de: 'Aktivität von {count} Repositorys',
    es: 'Actividad de {count} repositorios',
  },
  noActivity: {
    en: 'Nothing to show yet.',
    fr: 'Rien à afficher pour l’instant.',
    de: 'Noch nichts anzuzeigen.',
    es: 'Nada que mostrar por ahora.',
  },
  badgeRelease: { en: 'Release', fr: 'Version', de: 'Release', es: 'Versión' },
  badgePrerelease: { en: 'Pre-release', fr: 'Préversion', de: 'Vorabversion', es: 'Preliminar' },
  badgeIssue: { en: 'Issue', fr: 'Issue', de: 'Issue', es: 'Issue' },
  badgePullRequest: {
    en: 'Pull request',
    fr: 'Pull request',
    de: 'Pull-Request',
    es: 'Pull request',
  },
  badgeDraft: { en: 'Draft', fr: 'Brouillon', de: 'Entwurf', es: 'Borrador' },
  badgeCommit: { en: 'Commit', fr: 'Commit', de: 'Commit', es: 'Commit' },
  byAuthor: {
    en: '{repository} · by {author}',
    fr: '{repository} · par {author}',
    de: '{repository} · von {author}',
    es: '{repository} · de {author}',
  },
  followers: { en: 'Followers', fr: 'Abonnés', de: 'Follower', es: 'Seguidores' },
  following: { en: 'Following', fr: 'Abonnements', de: 'Folgt', es: 'Siguiendo' },
  publicRepositories: {
    en: 'Public repos',
    fr: 'Dépôts publics',
    de: 'Öffentl. Repos',
    es: 'Repos públicos',
  },
  apiQuota: {
    en: 'API quota left',
    fr: 'Quota d’API restant',
    de: 'Verbleibendes API-Limit',
    es: 'Cuota de API restante',
  },
  followedRepositories: {
    en: 'Followed repositories',
    fr: 'Dépôts suivis',
    de: 'Verfolgte Repositorys',
    es: 'Repositorios seguidos',
  },
  quotaReset: {
    en: 'Quota reset',
    fr: 'Renouvellement du quota',
    de: 'Limit-Erneuerung',
    es: 'Renovación de la cuota',
  },
  inMinutes: { en: 'in {n} min', fr: 'dans {n} min', de: 'in {n} Min.', es: 'en {n} min' },
  openProfile: {
    en: 'Open the profile',
    fr: 'Voir le profil',
    de: 'Profil öffnen',
    es: 'Abrir el perfil',
  },
  ago_now: { en: 'just now', fr: 'à l’instant', de: 'gerade eben', es: 'ahora mismo' },
  ago_minutes: { en: '{n} min ago', fr: 'il y a {n} min', de: 'vor {n} Min.', es: 'hace {n} min' },
  ago_hours: { en: '{n} h ago', fr: 'il y a {n} h', de: 'vor {n} Std.', es: 'hace {n} h' },
  ago_days: { en: '{n} d ago', fr: 'il y a {n} j', de: 'vor {n} T.', es: 'hace {n} d' },

  // widget messages
  noToken: {
    en: 'Add a GitHub token in the integration settings.',
    fr: 'Ajoutez un jeton GitHub dans la configuration de l’intégration.',
    de: 'Füge in den Einstellungen der Integration ein GitHub-Token hinzu.',
    es: 'Añade un token de GitHub en la configuración de la integración.',
  },
  noRepository: {
    en: 'Follow a repository in the integration settings.',
    fr: 'Suivez un dépôt dans la configuration de l’intégration.',
    de: 'Verfolge in den Einstellungen der Integration ein Repository.',
    es: 'Sigue un repositorio en la configuración de la integración.',
  },
  notReadYet: {
    en: 'GitHub has not been read yet: come back in a minute.',
    fr: 'GitHub n’a pas encore été lu : revenez dans une minute.',
    de: 'GitHub wurde noch nicht gelesen: Schau in einer Minute wieder vorbei.',
    es: 'GitHub aún no se ha leído: vuelve dentro de un minuto.',
  },

  // connection status (200 characters at most)
  statusConnected: {
    en: 'Connected as @{login}, {count} repositories followed.',
    fr: 'Connecté en tant que @{login}, {count} dépôts suivis.',
    de: 'Verbunden als @{login}, {count} Repositorys verfolgt.',
    es: 'Conectado como @{login}, {count} repositorios seguidos.',
  },
  statusMissing: {
    en: 'Connected as @{login}. Not found or not allowed by the token: {missing}.',
    fr: 'Connecté en tant que @{login}. Introuvable ou refusé par le jeton : {missing}.',
    de: 'Verbunden als @{login}. Nicht gefunden oder vom Token nicht erlaubt: {missing}.',
    es: 'Conectado como @{login}. No encontrado o no permitido por el token: {missing}.',
  },
  statusInvalidToken: {
    en: 'GitHub refused the token: check it, or create a new one.',
    fr: 'GitHub a refusé le jeton : vérifiez-le ou créez-en un nouveau.',
    de: 'GitHub hat das Token abgelehnt: Prüfe es oder erstelle ein neues.',
    es: 'GitHub ha rechazado el token: compruébalo o crea uno nuevo.',
  },
  statusForbidden: {
    en: 'GitHub denied access with this token: check its permissions.',
    fr: 'GitHub refuse l’accès avec ce jeton : vérifiez ses autorisations.',
    de: 'GitHub verweigert den Zugriff mit diesem Token: Prüfe seine Berechtigungen.',
    es: 'GitHub deniega el acceso con este token: comprueba sus permisos.',
  },
  statusRateLimited: {
    en: 'GitHub API quota exhausted: reading resumes when it renews.',
    fr: 'Quota de l’API GitHub épuisé : la lecture reprend à son renouvellement.',
    de: 'GitHub-API-Limit erschöpft: Das Lesen geht nach der Erneuerung weiter.',
    es: 'Cuota de la API de GitHub agotada: la lectura se reanuda al renovarse.',
  },
  statusUnreachable: {
    en: 'GitHub cannot be reached for now: new attempt at the next round.',
    fr: 'GitHub est injoignable pour l’instant : nouvel essai au prochain passage.',
    de: 'GitHub ist gerade nicht erreichbar: neuer Versuch bei der nächsten Runde.',
    es: 'GitHub no está accesible por ahora: nuevo intento en la próxima ronda.',
  },

  // configuration screen action
  testOk: {
    en: 'Token accepted for @{login} ({remaining}/{limit} API points left this hour).',
    fr: 'Jeton accepté pour @{login} ({remaining}/{limit} points d’API restants cette heure).',
    de: 'Token für @{login} akzeptiert ({remaining}/{limit} API-Punkte in dieser Stunde übrig).',
    es: 'Token aceptado para @{login} ({remaining}/{limit} puntos de API restantes esta hora).',
  },
  testRepositories: {
    en: 'Repositories read: {ok}/{total}.',
    fr: 'Dépôts lus : {ok}/{total}.',
    de: 'Gelesene Repositorys: {ok}/{total}.',
    es: 'Repositorios leídos: {ok}/{total}.',
  },
  testMissing: {
    en: 'Not found or not allowed: {missing}.',
    fr: 'Introuvables ou refusés : {missing}.',
    de: 'Nicht gefunden oder nicht erlaubt: {missing}.',
    es: 'No encontrados o no permitidos: {missing}.',
  },
};

/**
 * @description Whether a value is one of the supported languages.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de or es.
 * @example
 * isLanguage('fr'); // -> true
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language (English fallback), with its
 * substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language.
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('summaryStar', 'fr', { repository: 'octo/hello', stars: 12 });
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description The text in every language, for a multi-language message.
 * @param {string} key - The TEXTS key.
 * @param {object} [values] - The substitutions.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 * @example
 * all('statusConnected', { login: 'octocat', count: 2 });
 */
function all(key, values = {}) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, t(key, language, values)]));
}

/**
 * @description "12 min ago" for an instant.
 * @param {number} instant - The instant, in ms.
 * @param {number} now - Now, in ms.
 * @param {string} language - The language.
 * @returns {string} The relative time.
 * @example
 * ago(Date.now() - 600000, Date.now(), 'en'); // -> '10 min ago'
 */
function ago(instant, now, language) {
  const minutes = Math.max(0, Math.floor((now - instant) / 60000));
  if (minutes < 1) {
    return t('ago_now', language);
  }
  if (minutes < 60) {
    return t('ago_minutes', language, { n: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t('ago_hours', language, { n: hours });
  }
  return t('ago_days', language, { n: Math.floor(hours / 24) });
}

export { LANGUAGES, TEXTS, isLanguage, t, all, ago };
