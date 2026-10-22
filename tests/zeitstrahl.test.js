const { test } = require('node:test');
const assert = require('node:assert/strict');
const { zeitstrahl } = require('../src/kanbanflow/zeitstrahl.js');

function abschnitt(art, start, ende, aufgabe) {
    return { art, start: '2026-10-21T' + start + '+02:00', ende: '2026-10-21T' + ende + '+02:00', aufgabe };
}

test('Wenn_Tag_von_08_25_bis_17_33_dann_reicht_der_Strahl_von_8_bis_18_Uhr', () => {
    const strahl = zeitstrahl([
        abschnitt('Arbeit', '08:25:02', '12:00:52', 'Allgemein'),
        abschnitt('Arbeit', '12:44:57', '17:33:32', 'Portal')
    ]);

    assert.equal(strahl.vonStunde, 8);    // 08:25 abgerundet
    assert.equal(strahl.bisStunde, 18);   // 17:33 aufgerundet
    assert.deepEqual(strahl.stunden.map(s => s.stunde), [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
});

test('Wenn_Abschnitt_von_9_bis_10_auf_Strahl_8_bis_12_dann_liegt_er_bei_25_Prozent_mit_25_Prozent_Breite', () => {
    const strahl = zeitstrahl([
        abschnitt('Arbeit', '08:00:00', '09:00:00', 'A'),
        abschnitt('Pause', '09:00:00', '10:00:00', ''),
        abschnitt('Arbeit', '10:00:00', '12:00:00', 'B')
    ]);

    const pause = strahl.balken[1];
    assert.equal(pause.art, 'Pause');
    assert.equal(pause.linksProzent, 25);    // 1 h von 4 h Spanne
    assert.equal(pause.breiteProzent, 25);   // 1 h Dauer
    assert.equal(strahl.balken[2].breiteProzent, 50);   // 2 h von 4 h
});

test('Wenn_keine_Abschnitte_dann_ist_der_Strahl_leer', () => {
    const strahl = zeitstrahl([]);

    assert.deepEqual(strahl.balken, []);
    assert.deepEqual(strahl.stunden, []);
});
