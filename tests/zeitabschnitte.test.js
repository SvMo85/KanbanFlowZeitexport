const { test } = require('node:test');
const assert = require('node:assert/strict');
const kf = require('../src/kanbanflow/zeitabschnitte.js');

// Aufbau wie in window.kf_board.bootstrap({...}) auf kanbanflow.com beobachtet (22.10.2026)
function boardDaten() {
    return {
        userId: 'ich',
        timerLogData: {
            manualTimeEntries: [],
            workEntries: [
                {
                    userId: 'ich',
                    startTimestampLocal: '2026-10-20T07:44:05+02:00',
                    actions: [
                        { taskName: 'Allgemein', end: { timestampLocal: '2026-10-20T08:00:00+02:00', reason: 'taskChange' } },
                        { taskName: 'Portal', end: { timestampLocal: '2026-10-20T12:46:31+02:00', reason: 'stopped' } }
                    ]
                },
                {
                    userId: 'ich',
                    startTimestampLocal: '2026-10-20T14:08:25+02:00',
                    actions: [
                        { taskName: 'Portal', end: { timestampLocal: '2026-10-20T17:00:39+02:00', reason: 'stopped' } }
                    ]
                }
            ]
        },
        timerState: {
            clients: [
                {
                    userId: 'kollege',
                    workEntry: {
                        userId: 'kollege',
                        startTimestampLocal: '2026-10-22T06:27:33+02:00',
                        actions: [{ taskName: 'Fremde Aufgabe' }]
                    }
                },
                {
                    userId: 'ich',
                    workEntry: {
                        userId: 'ich',
                        startTimestampLocal: '2026-10-22T08:52:39+02:00',
                        actions: [
                            { taskName: 'Allgemein', end: { timestampLocal: '2026-10-22T09:14:49+02:00', reason: 'taskChange' } },
                            { taskName: 'Portal' }
                        ]
                    }
                }
            ]
        }
    };
}

const JETZT = '2026-10-22T11:30:00+02:00';

test('Wenn_Skripttext_den_Bootstrap_Aufruf_enthaelt_dann_werden_die_Board_Daten_gelesen', () => {
    const skripttext = 'window.kf_board.bootstrap({"userId":"ich","boardName":"Test (mit Klammer)"});';

    const daten = kf.leseBoardDaten(skripttext);

    assert.equal(daten.userId, 'ich');                        // JSON vollständig geparst
    assert.equal(daten.boardName, 'Test (mit Klammer)');      // Klammern im Text stören nicht
});

test('Wenn_kein_Bootstrap_Aufruf_vorhanden_dann_Fehler_mit_Hinweis', () => {
    assert.throws(() => kf.leseBoardDaten('window.irgendwas();'), /Board-Daten nicht gefunden/);
});

test('Wenn_zwei_Timerlaeufe_an_einem_Tag_dann_liegt_dazwischen_eine_Pause', () => {
    const abschnitte = kf.tagesabschnitte(boardDaten(), '2026-10-20', JETZT);

    assert.deepEqual(abschnitte.map(a => a.art), ['Arbeit', 'Arbeit', 'Pause', 'Arbeit']);
    const pause = abschnitte[2];
    assert.equal(pause.start, '2026-10-20T12:46:31+02:00');  // Ende des ersten Laufs
    assert.equal(pause.ende, '2026-10-20T14:08:25+02:00');   // Start des zweiten Laufs
});

test('Wenn_Aufgabenwechsel_im_Lauf_dann_beginnt_der_naechste_Abschnitt_am_Ende_des_vorigen', () => {
    const abschnitte = kf.tagesabschnitte(boardDaten(), '2026-10-20', JETZT);

    assert.equal(abschnitte[0].aufgabe, 'Allgemein');
    assert.equal(abschnitte[0].start, '2026-10-20T07:44:05+02:00');   // Start des Laufs
    assert.equal(abschnitte[1].aufgabe, 'Portal');
    assert.equal(abschnitte[1].start, '2026-10-20T08:00:00+02:00');   // Ende von "Allgemein"
});

test('Wenn_heute_ein_Timer_laeuft_dann_zaehlt_nur_der_eigene_und_endet_jetzt', () => {
    const abschnitte = kf.tagesabschnitte(boardDaten(), '2026-10-22', JETZT);

    assert.deepEqual(abschnitte.map(a => a.aufgabe), ['Allgemein', 'Portal']);   // Timer des Kollegen fehlt
    assert.equal(abschnitte[1].ende, JETZT);                                     // offener Abschnitt bis jetzt
    assert.equal(abschnitte[1].laeuft, true);
});

test('Wenn_Zeiten_an_mehreren_Tagen_dann_sind_die_Tage_absteigend_verfuegbar', () => {
    assert.deepEqual(kf.verfuegbareTage(boardDaten(), JETZT), ['2026-10-22', '2026-10-20']);
});

test('Wenn_Abschnitt_von_12_46_31_bis_14_08_25_dann_dauert_er_82_Minuten', () => {
    const abschnitt = { start: '2026-10-20T12:46:31+02:00', ende: '2026-10-20T14:08:25+02:00' };

    assert.equal(kf.dauerInMinuten(abschnitt), 82);   // 81 min 54 s, gerundet
});

test('Wenn_manuelle_Eintraege_vorhanden_dann_wird_das_erkannt', () => {
    const daten = boardDaten();
    assert.equal(kf.hatManuelleEintraege(daten), false);

    daten.timerLogData.manualTimeEntries.push({});

    assert.equal(kf.hatManuelleEintraege(daten), true);
});
