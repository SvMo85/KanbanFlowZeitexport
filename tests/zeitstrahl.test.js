const { test } = require('node:test');
const assert = require('node:assert/strict');
const { minutenSeitMitternacht, rahmen, zeitstrahl } = require('../src/kanbanflow/zeitstrahl.js');

function block(art, von, bis) {
    const minuten = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    return { art, von: minuten(von), bis: minuten(bis) };
}

test('Wenn_Zeitstempel_12_46_30_dann_766_5_Minuten_seit_Mitternacht', () => {
    assert.equal(minutenSeitMitternacht('2026-10-21T12:46:30+02:00'), 766.5);   // 12*60 + 46 + 0,5
});

test('Wenn_Tag_von_08_25_bis_17_33_dann_reicht_der_Rahmen_von_8_bis_18_Uhr', () => {
    const r = rahmen([[block('Arbeit', '08:25', '12:00'), block('Arbeit', '12:44', '17:33')]]);

    assert.deepEqual(r, { vonStunde: 8, bisStunde: 18 });   // abgerundet, aufgerundet
});

test('Wenn_zwei_Strahlen_dann_umfasst_der_Rahmen_beide', () => {
    const ist = [block('Arbeit', '08:00', '15:00')];
    const soll = [block('Arbeit', '08:00', '14:00'), block('Pause', '14:00', '14:30'), block('Arbeit', '14:30', '15:30')];

    assert.deepEqual(rahmen([ist, soll]), { vonStunde: 8, bisStunde: 16 });   // 15:30 aus SOLL zählt mit
});

test('Wenn_Pause_von_9_bis_10_auf_Strahl_8_bis_12_dann_liegt_sie_bei_25_Prozent_mit_25_Prozent_Breite', () => {
    const strahl = zeitstrahl(
        [block('Arbeit', '08:00', '09:00'), block('Pause', '09:00', '10:00'), block('Arbeit', '10:00', '12:00')],
        { vonStunde: 8, bisStunde: 12 });

    assert.equal(strahl.balken[1].linksProzent, 25);    // 1 h von 4 h Spanne
    assert.equal(strahl.balken[1].breiteProzent, 25);   // 1 h Dauer
    assert.equal(strahl.balken[2].breiteProzent, 50);   // 2 h von 4 h
    assert.deepEqual(strahl.stunden.map(s => s.stunde), [8, 9, 10, 11, 12]);
});

test('Wenn_keine_Bloecke_dann_ist_der_Strahl_leer', () => {
    const strahl = zeitstrahl([], rahmen([]));

    assert.deepEqual(strahl.balken, []);
    assert.deepEqual(strahl.stunden, []);
});
