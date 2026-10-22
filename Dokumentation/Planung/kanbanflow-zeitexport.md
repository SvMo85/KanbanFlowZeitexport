---
application: KanbanFlowZeitexport
system: KanbanFlowZeitexport
vision: Anforderungen/R00000-vision.md
wireframes: Dokumentation/Wireframes/
sprache: de
zuletzt: 2026-10-22
---

# WBS — KanbanFlowZeitexport

## Knoten

| ID | Ebene | Eltern | Name | Status | Fertig-Kriterium | Eingabe → Ausgabe | Aufwand | Ausbaustufe | Braucht | Requirement | Notiz |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A0001 | Application | — | KanbanFlowZeitexport | rot | alle Dialogs gruen | | | | | | Chrome und Edge; Verteilung nur über das Repository; liest und schreibt in den offenen, angemeldeten Tabs, keine Zugangsdaten; Zeiten auf genau einem Board; Personio-Regeln laut Vision; Datum als Schlüssel steckt in den Fertig-Kriterien |
| D0001 | Dialog | A0001 | Einrichtung | rot | alle Interactions gruen | | | | | | aus Vision, kein Requirement |
| I0001 | Interaction | D0001 | Erweiterung aus dem Repository laden | rot | nach der Anleitung im README lädt die Erweiterung entpackt in Chrome und Edge ohne Fehler | | | | | | aus Vision, kein Requirement |
| D0002 | Dialog | A0001 | Export in KanbanFlow | rot | alle Interactions gruen | | | | | | aus Vision, kein Requirement |
| I0002 | Interaction | D0002 | Export-Knopf auf der KanbanFlow-Seite | rot | auf kanbanflow.com erscheint der Knopf „Export" und öffnet den Export-Dialog | | | | | | aus Vision, kein Requirement |
| I0003 | Interaction | D0002 | Tag wählen und Zeiten einsammeln | rot | heute ist vorbelegt, ein vergangener Tag ist wählbar; die Abschnitte (Arbeit, Pause) des Tages werden mit Datum angezeigt | | | | | | aus Vision, kein Requirement |
| I0004 | Interaction | D0002 | Zielformat wählen | rot | Personio ist wählbar; die Auswahl bestimmt die folgende Vorschau | | | | | | aus Vision, kein Requirement |
| I0005 | Interaction | D0002 | Vorschau Zeitstrahlen IST / WIRD ZU | rot | zwei Zeitstrahlen übereinander zeigen KanbanFlow-Zeiten und Personio-Ergebnis | | | | I0003 | | aus Vision, kein Requirement |
| I0006 | Interaction | D0002 | Vorschau Abschnittstabelle | rot | je Abschnitt eine Zeile mit KanbanFlow-Wert und Personio-Ergebnis | | | | I0003 | | aus Vision, kein Requirement |
| I0007 | Interaction | D0002 | Export übernehmen | rot | der bestätigte Export liegt mit Datum zur Übergabe an Personio bereit | | | | | | aus Vision, kein Requirement |
| D0003 | Dialog | A0001 | Personio befüllen | rot | alle Interactions gruen | | | | | | aus Vision, kein Requirement |
| I0008 | Interaction | D0003 | Einfügen-Knopf im Personio-Formular | rot | auf mahredv.app.personio.com erscheint im Erfassungsformular der Knopf „Einfügen" | | | | | | aus Vision, kein Requirement |
| I0009 | Interaction | D0003 | Formular des Tages ausfüllen | rot | die Zeiten des Exports stehen im Formular des passenden Tages; gespeichert ist nichts | | | | I0007 | | aus Vision, kein Requirement |
| I0010 | Interaction | D0003 | Datum passt nicht | rot | weicht das Export-Datum vom geöffneten Tag ab, erscheint ein Hinweis, nichts wird eingetragen | | | | | | aus Vision, kein Requirement |
| I0011 | Interaction | D0003 | Kein Export vorhanden | rot | ohne bereitliegenden Export erscheint ein Hinweis | | | | | | aus Vision, kein Requirement |

## Offene Fragen

1. Vision-Fragen 1 bis 3 (Regelverstöße, Lücken zwischen Blöcken, Struktur in Personio) bestimmen „WIRD ZU" und das Ausfüllen — vor dem Verfeinern von I0005, I0006 und D0003 klären.
2. CSV ist kein Knoten — die Vision setzt nur Personio um.

## Notizen / Quellen

- Abgeleitet aus `Anforderungen/R00000-vision.md` (Zielbild-Punkte 1 bis 6); noch keine Requirements und User Stories.
