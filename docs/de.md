# GitHub

## Überblick

Verfolge GitHub-Repositorys in Gladys: Jedes Repository wird zu einem Gerät mit seinen Sternen, Forks, offenen Issues und Pull-Requests sowie seinem neuesten Release, Tag, Commit, Issue, Pull-Request und seiner neuesten Diskussion. Szenen reagieren auf ein neues Release, Issue, einen Pull-Request, eine Diskussion, einen Commit, einen Stern oder auf die Prüfungen (CI) des Standard-Branches. Drei Dashboard-Widgets zeigen ein Repository, die neueste Aktivität und dein Konto.

Die Integration liest die GitHub-API (Cloud): Sonst verlässt nichts dein Netzwerk, und sie liest nur, sie schreibt nie auf GitHub.

![Repository-Widget (Illustration)](https://raw.githubusercontent.com/William-De71/gladys-github/main/docs/assets/widget-repository.svg)

## Voraussetzungen

- Gladys Assistant 5.1.0 oder neuer.
- Ein GitHub-Konto und ein persönliches Zugriffstoken. Ein **feingranulares** Token mit dem Zugriff „Public repositories“ (nur lesend) genügt für öffentliche Repositorys. Für private Repositorys wähle sie aus und erteile nur lesend „Metadata“, „Contents“, „Issues“, „Pull requests“ und „Discussions“. Ein klassisches Token ohne Bereich funktioniert für öffentliche Repositorys ebenfalls.

## Konfiguration

1. Erstelle das Token auf [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new).
2. Öffne **Integrationen → GitHub**, füge das Token ein und liste die zu verfolgenden Repositorys auf.
3. Speichere und klicke dann auf **Verbindung testen**: Es zeigt dein Konto, das verbleibende API-Limit und die gelesenen Repositorys.

| Feld                       | Beschreibung                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Persönliches Zugriffstoken | Pflichtfeld. Wird nie wieder angezeigt und nie protokolliert.                                                |
| Zu verfolgende Repositorys | `Besitzer/Name` oder der github.com-Link, oder ein Muster `Besitzer/*`, durch Kommas getrennt, höchstens 50. |
| Abfrageintervall (s)       | 60 bis 3600, standardmäßig 120. Auch die Reaktionszeit der Szenenauslöser.                                   |
| Sprache der Texte          | Gerätenamen und Szenen-Zusammenfassungen. Automatisch: die Sprache deines Dashboards.                        |

Um alle Repositorys eines Kontos oder einer Organisation zu verfolgen, ohne sie einzeln einzugeben, schreibe `Besitzer/*`, oder `Besitzer/gladys-*` für die, deren Name mit `gladys-` beginnt. Forks und archivierte Repositorys werden ausgelassen. Muster lassen sich mit vollständigen Namen kombinieren, zum Beispiel `prohand/gladys-*, GladysAssistant/Gladys`. Bei mehr als 50 Repositorys kommen die vollständig genannten zuerst, dann die zuletzt aktualisierten. Die Liste wird stündlich neu gelesen: Ein neues Repository erscheint innerhalb einer Stunde im Reiter Entdecken.

Jede Runde liest die Repositorys in Gruppen von 10, eine Anfrage pro Gruppe: Mit 50 Repositorys bei 120 Sekunden nutzt die Integration etwa 3 % der 5.000 Punkte pro Stunde, die GitHub einem Token gewährt.

## Verwendung

### Geräte

Füge im Reiter **Entdecken** die Repositorys und dein Konto hinzu. Ein Repository bietet: Sterne, Forks, Beobachter, offene Issues, offene Pull-Requests, gemergte Pull-Requests, Diskussionen, Downloads des neuesten Releases (wenn es Dateien hat) sowie als Text das neueste Release, Tag, Commit, Issue, Pull-Request und die neueste Diskussion. Das Konto bietet Follower, gefolgte Konten, öffentliche Repositorys und öffentliche Gists.

### Szenenauslöser

| Auslöser                | Filter                                    | Variablen                                            |
| ----------------------- | ----------------------------------------- | ---------------------------------------------------- |
| Release veröffentlicht  | Repository, Release oder Vorabversion     | Name, Tag, Autor, Link, Zusammenfassung              |
| Issue eröffnet          | Repository                                | Nummer, Titel, Autor, Link, Zusammenfassung          |
| Pull-Request eröffnet   | Repository                                | Nummer, Titel, Autor, Entwurf, Link, Zusammenfassung |
| Diskussion gestartet    | Repository                                | Nummer, Titel, Autor, Link, Zusammenfassung          |
| Neuer Commit            | Repository                                | Branch, SHA, Nachricht, Autor, Link, Zusammenfassung |
| Neuer Stern             | Repository                                | Sterne, neue Sterne, Link, Zusammenfassung           |
| Prüfungen abgeschlossen | Repository, bestanden oder fehlgeschlagen | Branch, SHA, Nachricht, Link, Zusammenfassung        |

Beispiele:

- Wenn ein Release eines Projekts erscheint, das du nutzt → schicke dir eine Nachricht mit `{{triggerEvent.data.summary}}`.
- Wenn die Prüfungen deines Projekts fehlschlagen → schalte die Bürolampe auf Rot.
- Wenn dein Repository einen Stern bekommt → spiele einen Ton auf dem Lautsprecher ab.

Die erste Abfrage nach einem Start dient als Referenz: Was passiert ist, während Gladys aus war, wird nicht nachgeholt.

### Szenenaktion

**GitHub: Repository lesen** liefert Sterne, Forks, Beobachter, offene Issues und Pull-Requests, das neueste Release (und seinen Link), den neuesten Commit, die Prüfungen und einen zusammenfassenden Satz. Ein unbekannter Zähler ist -1.

### Widgets

- **GitHub-Repository**: Sterne, Forks, Issues, Pull-Requests, neuestes Release, Prüfungen des Standard-Branches und ein Link.
- **GitHub-Aktivität**: die neuesten Releases, Issues, Pull-Requests und Commits aller Repositorys (oder eines), filterbar.
- **GitHub-Konto**: Follower, gefolgte Konten, öffentliche Repositorys und das verbleibende API-Limit.

## Fehlerbehebung

- **„GitHub hat das Token abgelehnt“**: Das Token ist abgelaufen oder wurde widerrufen: Erstelle ein neues.
- **„Nicht gefunden oder vom Token nicht erlaubt“**: Prüfe die Schreibweise des Repositorys oder gib dem Token Zugriff darauf (privates Repository).
- **„GitHub-API-Limit erschöpft“**: Ein anderes Werkzeug nutzt dasselbe Token: Erhöhe das Abfrageintervall oder nutze ein eigenes Token. Das Lesen geht von selbst weiter.
- **Kein Autor bei Sternen**: Die Integration erhält von GitHub nur die Zahl der Sterne, nicht, wer sie vergeben hat.
- Um ein Problem zu melden, eröffne ein Issue auf [GitHub](https://github.com/William-De71/gladys-github/issues) mit den Versionen von Gladys und der Integration und den Protokollen (`DEBUG=gladys-integration-sdk`).
