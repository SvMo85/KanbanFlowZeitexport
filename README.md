# KanbanFlow-Zeitexport

Browser-Erweiterung für Chrome und Edge: exportiert die in KanbanFlow erfassten Zeiten eines Tages.
Zielbild: [Anforderungen/R00000-vision.md](Anforderungen/R00000-vision.md).

## Installation

1. Repository klonen.
2. Chrome: `chrome://extensions` öffnen, Edge: `edge://extensions`.
3. Entwicklermodus einschalten.
4. „Entpackte Erweiterung laden" und den Ordner des Repositorys wählen.
5. Nach `git pull` auf der Erweiterungsseite „Neu laden" klicken.

## Benutzung

Ein KanbanFlow-Board öffnen, unten rechts auf „Export" klicken, Tag wählen.
Zugangsdaten braucht die Erweiterung nicht; sie liest die Board-Seite mit der bestehenden Anmeldung.

## Tests

```
node --test "tests/*.test.js"
```
