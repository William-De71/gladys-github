# GitHub

## Présentation

Suivez vos dépôts GitHub depuis Gladys : chaque dépôt devient un appareil avec ses étoiles, ses forks, ses issues et pull requests ouvertes, et sa dernière version, son dernier tag, commit, issue, pull request et discussion. Les scènes réagissent à une nouvelle version, issue, pull request, discussion, à un commit, à une étoile, ou aux vérifications (CI) de la branche par défaut. Trois widgets de tableau de bord montrent un dépôt, l'activité récente et votre compte.

L'intégration interroge l'API de GitHub (cloud) : rien d'autre ne sort de votre réseau, et elle ne fait que lire, elle n'écrit jamais sur GitHub.

![Widget dépôt (illustration)](https://raw.githubusercontent.com/William-De71/gladys-github/main/docs/assets/widget-repository.svg)

## Prérequis

- Gladys Assistant 5.1.0 ou plus récent.
- Un compte GitHub et un jeton d'accès personnel. Un jeton **à granularité fine** avec l'accès « Public repositories » (lecture seule) suffit pour les dépôts publics. Pour des dépôts privés, sélectionnez-les et accordez en lecture seule « Metadata », « Contents », « Issues », « Pull requests » et « Discussions ». Un jeton classique sans aucune portée fonctionne aussi pour les dépôts publics.

## Configuration

1. Créez le jeton sur [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new).
2. Ouvrez **Intégrations → GitHub**, collez le jeton et listez les dépôts à suivre.
3. Enregistrez, puis cliquez sur **Tester la connexion** : elle affiche votre compte, le quota d'API restant et les dépôts lus.

| Champ                     | Description                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Jeton d'accès personnel   | Obligatoire. Jamais réaffiché, jamais écrit dans les journaux.                              |
| Dépôts à suivre           | `propriétaire/nom` ou le lien github.com, séparés par des virgules, 20 au maximum.          |
| Intervalle de lecture (s) | De 60 à 3600, 120 par défaut. C'est aussi le délai des déclencheurs de scène.               |
| Langue des textes         | Noms des appareils et résumés des scènes. Automatique : la langue de votre tableau de bord. |

Une seule requête lit tout à chaque passage : à 120 secondes, l'intégration utilise environ 1 % des 5 000 points par heure que GitHub accorde à un jeton.

## Utilisation

### Appareils

Dans l'écran **Découverte**, ajoutez les dépôts et votre compte. Un dépôt propose : étoiles, forks, abonnés, issues ouvertes, pull requests ouvertes, pull requests fusionnées, discussions, téléchargements de la dernière version (si elle a des fichiers), et en texte la dernière version, le dernier tag, commit, issue, pull request et discussion. Le compte propose abonnés, abonnements, dépôts publics et gists publics.

### Déclencheurs de scène

| Déclencheur             | Filtres                      | Variables                                      |
| ----------------------- | ---------------------------- | ---------------------------------------------- |
| Version publiée         | dépôt, version ou préversion | nom, tag, auteur, lien, résumé                 |
| Issue ouverte           | dépôt                        | numéro, titre, auteur, lien, résumé            |
| Pull request ouverte    | dépôt                        | numéro, titre, auteur, brouillon, lien, résumé |
| Discussion lancée       | dépôt                        | numéro, titre, auteur, lien, résumé            |
| Nouveau commit          | dépôt                        | branche, SHA, message, auteur, lien, résumé    |
| Nouvelle étoile         | dépôt                        | étoiles, étoiles ajoutées, lien, résumé        |
| Vérifications terminées | dépôt, réussies ou en échec  | branche, SHA, message, lien, résumé            |

Exemples :

- Quand une version d'un projet que vous utilisez sort → envoyez-vous un message avec `{{triggerEvent.data.summary}}`.
- Quand les vérifications de votre projet échouent → passez la lampe du bureau en rouge.
- Quand votre dépôt reçoit une étoile → jouez un son sur l'enceinte.

La première lecture après un démarrage sert de référence : rien de ce qui s'est passé pendant que Gladys était arrêté n'est rejoué.

### Action de scène

**GitHub : lire un dépôt** renvoie ses étoiles, forks, abonnés, issues et pull requests ouvertes, sa dernière version (et son lien), son dernier commit, ses vérifications et une phrase de résumé. Un compteur inconnu vaut -1.

### Widgets

- **Dépôt GitHub** : étoiles, forks, issues, pull requests, dernière version, vérifications de la branche par défaut et un lien.
- **Activité GitHub** : les dernières versions, issues, pull requests et commits de tous les dépôts (ou d'un seul), avec un filtre.
- **Compte GitHub** : abonnés, abonnements, dépôts publics et quota d'API restant.

## Dépannage

- **« GitHub a refusé le jeton »** : le jeton a expiré ou a été révoqué : créez-en un nouveau.
- **« Introuvable ou refusé par le jeton »** : vérifiez l'orthographe du dépôt, ou donnez-lui accès au jeton (dépôt privé).
- **« Quota de l'API GitHub épuisé »** : un autre outil utilise le même jeton : augmentez l'intervalle de lecture ou utilisez un jeton dédié. La lecture reprend d'elle-même.
- **Pas d'auteur pour les étoiles** : GitHub ne donne à l'intégration que le nombre d'étoiles, pas qui les a ajoutées.
- Pour signaler un problème, ouvrez une issue sur [GitHub](https://github.com/William-De71/gladys-github/issues) avec les versions de Gladys et de l'intégration et les journaux (`DEBUG=gladys-integration-sdk`).
