---
id: R00000
titel: Vision — KanbanFlow-Zeitexport
status: Lebend
angelegt: 2026-10-22
zuletzt-ergaenzt: 2026-10-22
---

# R00000: Vision — KanbanFlow-Zeitexport

Kein Anforderungsdokument. Beschreibt das Gesamtziel der Anwendung.
Wird fortgeschrieben, nie abgehakt.

## Kurzfassung

Eine Browser-Erweiterung macht die in KanbanFlow erfassten Arbeitszeiten eines Tages
exportierbar. Der Export kennt mehrere Zielformate, etwa Personio oder CSV; umgesetzt
wird zunächst Personio. Formate mit eigenen Regeln zeigen vor der Übergabe eine
Vorschau, weil die Zeiten dort angepasst werden können, etwa Pausen nach dem
Arbeitszeitgesetz.

## Anlass

Die Arbeitszeiten müssen seit Kurzem zusätzlich zu KanbanFlow auch in Personio stehen.
Das doppelte Abtippen kostet täglich Zeit und ist fehleranfällig.

## Zielbild

1. Auf der KanbanFlow-Seite gibt es einen Knopf „Export", der die Zeiten eines
   gewählten Tages einsammelt. Vorbelegt ist der heutige Tag, vergangene Tage sind
   ebenfalls wählbar.
2. Der Nutzer wählt ein Zielformat. Personio ist umgesetzt, weitere Formate wie CSV
   lassen sich ergänzen, ohne den Leseteil anzufassen.
3. Bei Formaten mit eigenen Regeln zeigt eine Vorschau zwei Zeitstrahlen
   übereinander: IST (KanbanFlow) und WIRD ZU (Zielformat). Darunter eine Tabelle
   mit einer Zeile je Abschnitt (Arbeit oder Pause), jeweils mit dem KanbanFlow-Wert
   und dem, was daraus im Zielformat wird.
4. Auf der Personio-Seite füllt ein Knopf das Erfassungsformular des passenden Tages
   mit den übernommenen Zeiten aus. Gespeichert wird vom Nutzer selbst.
5. Die Kollegen installieren die Erweiterung ohne Programmierkenntnisse und tragen
   ihre eigenen Zugangsdaten ein.
6. Das Datum ist der Schlüssel jedes Exports. Es reist mit den Zeiten mit, damit sie
   in Personio nie am falschen Tag landen.

## Nutzer und Nutzen

Zunächst der Entwickler selbst, später alle Kollegen, die KanbanFlow und Personio
nutzen. Nutzen: die tägliche Doppelerfassung entfällt, die Personio-Regeln werden
vor dem Speichern sichtbar eingehalten.

## Leitplanken

- Browser-Erweiterung: ein Repository, eine Erweiterung, kein Server.
- Browser: Chrome und Edge (gemeinsame Chromium-Erweiterungsschnittstelle).
- Verteilung nur über das Repository, kein Store: klonen und als entpackte
  Erweiterung im Entwicklermodus laden.
- Kein Zugriff über die Personio-API: die Erweiterung arbeitet im angemeldeten
  Personio-Tab mit den Rechten des Nutzers, ohne Admin-Credentials oder Freigabe.
- Der Nutzer speichert in Personio selbst; die Erweiterung schickt nie ab.
- Die Daten bleiben im Browser des Nutzers, keine Übertragung an Dritte.
- Oberfläche auf Deutsch.
- Personio-Regeln, wie im Konto hinterlegt: höchstens 10 h Arbeitszeit je Tag;
  höchstens 6 h am Stück; Mindestpause an einem Stück 30 min bei weniger als 9 h
  Tagesarbeitszeit, sonst 45 min.

## Ausdrücklich nicht Ziel

- Keine Zeiterfassung: erfasst wird weiter in KanbanFlow.
- Kein automatisches Speichern in Personio.
- Keine Änderungen in KanbanFlow: der Leseteil schreibt nie zurück.
- Keine Auswertungen oder Berichte über Zeiten.
- Keine Synchronisation im Hintergrund: nur auf Knopfdruck, Tag für Tag.

## Offene Richtungsfragen

1. Was tut die Vorschau, wenn die KanbanFlow-Zeiten gegen eine Personio-Regel
   verstoßen? Bei mehr als 10 h kappen oder nur warnen? Eine fehlende Pause
   einschieben und Zeiten verschieben, oder nur anzeigen?
2. Wie werden aus den Zeitblöcken je Aufgabe Arbeitszeiträume und Pausen je Tag?
   Gilt eine Lücke zwischen zwei Blöcken als Pause oder als ungebuchte Arbeit?
3. Erwartet Personio je Tag einen Zeitraum mit Pause oder mehrere Zeiträume, und
   sind dort Projekte zuzuordnen?
4. Soll später Firefox dazukommen? Ohne Mozilla-Signatur hält eine Erweiterung im
   normalen Firefox nur bis zum Neustart; die Signatur verlangt ein Hochladen zu
   Mozilla und widerspricht damit der Verteilung nur über das Repository.
5. Erlaubt die IT-Richtlinie den Entwicklermodus und entpackte Erweiterungen in
   Chrome und Edge?
6. Woher liest der KanbanFlow-Teil: REST-API mit Token oder aus der Seite selbst?
   Was passiert, wenn ein Nutzer Zeiten auf mehreren Boards führt?

## Ergänzungshistorie

| Datum | Ergänzung |
|---|---|
| 2026-10-22 | Vision angelegt (Export mit Zielformaten, Personio zuerst, Vorschau mit zwei Zeitstrahlen, Datum als Schlüssel, Personio-Regeln als Leitplanke, Chrome und Edge, Verteilung nur über das Repository) |
