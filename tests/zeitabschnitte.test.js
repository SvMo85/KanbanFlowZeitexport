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
                    startTimestamp: '2026-10-20T05:44:05Z',
                    startTimestampLocal: '2026-10-20T07:44:05+02:00',
                    actions: [
                        { taskName: 'Allgemein', end: { timestampLocal: '2026-10-20T08:00:00+02:00', reason: 'taskChange' } },
                        { taskName: 'Portal', end: { timestampLocal: '2026-10-20T12:46:31+02:00', reason: 'stopped' } }
                    ]
                },
                {
                    userId: 'ich',
                    startTimestamp: '2026-10-20T12:08:25Z',
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
                    mode: 'running',
                    workEntry: {
                        userId: 'kollege',
                        startTimestampLocal: '2026-10-22T06:27:33+02:00',
                        actions: [{ taskName: 'Fremde Aufgabe' }]
                    }
                },
                {
                    userId: 'ich',
                    mode: 'running',
                    workEntry: {
                        userId: 'ich',
                        startTimestamp: '2026-10-22T06:52:39Z',
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

// Mehrere Maschinen: je Maschine ein Client in timerState
test('Wenn_gestoppter_Client_einer_zweiten_Maschine_den_beendeten_Lauf_noch_haelt_dann_zaehlt_er_einmal', () => {
    const daten = boardDaten();
    const beendet = daten.timerLogData.workEntries[1];   // 14:08:25 bis 17:00:39
    daten.timerState.clients.push({ userId: 'ich', mode: 'stopped', workEntry: JSON.parse(JSON.stringify(beendet)) });

    const abschnitte = kf.tagesabschnitte(daten, '2026-10-20', JETZT);

    assert.deepEqual(abschnitte.map(a => a.art + ' ' + a.start.slice(11, 16)), ['Arbeit 07:44', 'Arbeit 08:00', 'Pause 12:46', 'Arbeit 14:08']);
});

test('Wenn_derselbe_Lauf_auf_zwei_Maschinen_laeuft_dann_zaehlt_er_einmal', () => {
    const daten = boardDaten();
    const laufend = daten.timerState.clients[1];
    daten.timerState.clients.push(JSON.parse(JSON.stringify(laufend)));

    const abschnitte = kf.tagesabschnitte(daten, '2026-10-22', JETZT);

    assert.deepEqual(abschnitte.map(a => a.aufgabe), ['Allgemein', 'Portal']);   // nicht viermal
});

test('Wenn_Abschnitte_sich_ueberlappen_dann_entsteht_darin_keine_Pause', () => {
    const daten = boardDaten();
    // zweiter Lauf auf einer anderen Maschine, 08:30 bis 09:00, mitten im ersten Lauf
    daten.timerLogData.workEntries.push({
        userId: 'ich', startTimestamp: '2026-10-20T06:30:00Z', startTimestampLocal: '2026-10-20T08:30:00+02:00',
        actions: [{ taskName: 'Andere Maschine', end: { timestampLocal: '2026-10-20T09:00:00+02:00' } }]
    });

    const pausen = kf.tagesabschnitte(daten, '2026-10-20', JETZT).filter(a => a.art === 'Pause');

    assert.deepEqual(pausen.map(p => p.start.slice(11, 16) + '-' + p.ende.slice(11, 16)), ['12:46-14:08']);   // nur die echte Lücke
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
