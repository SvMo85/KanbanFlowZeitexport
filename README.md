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

1. KanbanFlow-Board öffnen, oben neben dem Timer auf „Export" klicken, Tag wählen.
   Die Vorschau zeigt IST (KanbanFlow) und SOLL (Personio, nach den Pausen- und Höchstzeitregeln).
2. „Für Personio übernehmen" klicken.
3. In Personio die Zeiterfassung in der Monatsansicht öffnen, neben „Abwesenheit beantragen"
   auf „Zeitexport einfügen" klicken. Während des Eintragens ist die Seite gesperrt.
4. Das ausgefüllte Formular prüfen und selbst speichern.

Zugangsdaten braucht die Erweiterung nicht; sie arbeitet in den offenen, angemeldeten Tabs.
Ein Tag mit bestehenden Einträgen in Personio wird nie überschrieben.

## Testfälle der Umrechnung

`tests/faelle.html` im Browser öffnen: ein Knopf je Regel, ein Klick zeigt die Vorschau.

## Tests

```
node --test "tests/*.test.js"
```
