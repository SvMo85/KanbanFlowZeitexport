// Liest die Zeiten aus den Board-Daten von KanbanFlow und bildet daraus die Abschnitte eines Tages.
// Reine Funktionen ohne DOM-Zugriff, damit sie in Node testbar sind.
(function (global) {
    'use strict';

    const BOOTSTRAP_PRAEFIX = 'window.kf_board.bootstrap(';

    function leseBoardDaten(skripttext) {
        const anfang = skripttext.indexOf(BOOTSTRAP_PRAEFIX);
        if (anfang < 0) {
            throw new Error('Board-Daten nicht gefunden: kein Aufruf von kf_board.bootstrap auf der Seite.');
        }
        const jsonAnfang = anfang + BOOTSTRAP_PRAEFIX.length;
        const jsonEnde = skripttext.lastIndexOf(')');
        return JSON.parse(skripttext.slice(jsonAnfang, jsonEnde));
    }

    // Mit KanbanFlow auf mehreren Maschinen führt timerState je Maschine einen Client - auch gestoppte Clients
    // halten noch ihren letzten Lauf. Gezählt werden nur laufende Clients, und jeder Lauf (Startzeitpunkt)
    // nur einmal; der Eintrag aus dem Protokoll hat Vorrang.
    function eigeneTimerlaeufe(boardDaten) {
        const abgeschlossene = boardDaten.timerLogData.workEntries
            .filter(lauf => lauf.userId === boardDaten.userId);
        const laufende = boardDaten.timerState.clients
            .filter(client => client.userId === boardDaten.userId && client.mode === 'running' && client.workEntry)
            .map(client => client.workEntry);
        const jeStart = new Map();
        abgeschlossene.concat(laufende).forEach(lauf => {
            if (!jeStart.has(lauf.startTimestamp)) jeStart.set(lauf.startTimestamp, lauf);
        });
        return [...jeStart.values()];
    }

    function arbeitsabschnitte(timerlauf, jetztLokal) {
        const abschnitte = [];
        let start = timerlauf.startTimestampLocal;
        for (const action of timerlauf.actions) {
            const ende = action.end ? action.end.timestampLocal : jetztLokal;
            abschnitte.push({ art: 'Arbeit', start: start, ende: ende, aufgabe: action.taskName, laeuft: !action.end });
            start = ende;
        }
        return abschnitte;
    }

    function datumVon(zeitstempelLokal) {
        return zeitstempelLokal.slice(0, 10);
    }

    // Pause ist nur, was nach dem bisher spätesten Arbeitsende liegt - überlappende Abschnitte
    // (Timer auf zwei Maschinen) erzeugen keine Pause in der Überlappung
    function mitPausen(arbeit) {
        const ergebnis = [];
        let spaetestesEnde = null;
        arbeit.forEach(abschnitt => {
            if (spaetestesEnde && Date.parse(abschnitt.start) > Date.parse(spaetestesEnde)) {
                ergebnis.push({ art: 'Pause', start: spaetestesEnde, ende: abschnitt.start, aufgabe: '', laeuft: false });
            }
            ergebnis.push(abschnitt);
            if (!spaetestesEnde || Date.parse(abschnitt.ende) > Date.parse(spaetestesEnde)) spaetestesEnde = abschnitt.ende;
        });
        return ergebnis;
    }

    function alleArbeitsabschnitte(boardDaten, jetztLokal) {
        return eigeneTimerlaeufe(boardDaten)
            .flatMap(lauf => arbeitsabschnitte(lauf, jetztLokal))
            .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    }

    function verfuegbareTage(boardDaten, jetztLokal) {
        const tage = alleArbeitsabschnitte(boardDaten, jetztLokal).map(a => datumVon(a.start));
        return [...new Set(tage)].sort().reverse();
    }

    function tagesabschnitte(boardDaten, datum, jetztLokal) {
        const arbeit = alleArbeitsabschnitte(boardDaten, jetztLokal)
            .filter(a => datumVon(a.start) === datum);
        return mitPausen(arbeit);
    }

    function dauerInMinuten(abschnitt) {
        return Math.round((Date.parse(abschnitt.ende) - Date.parse(abschnitt.start)) / 60000);
    }

    function hatManuelleEintraege(boardDaten) {
        return boardDaten.timerLogData.manualTimeEntries.length > 0;
    }

    const api = { leseBoardDaten, verfuegbareTage, tagesabschnitte, dauerInMinuten, hatManuelleEintraege };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        global.KfZeitabschnitte = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
