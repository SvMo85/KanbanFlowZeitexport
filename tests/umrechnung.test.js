const { test } = require('node:test');
const assert = require('node:assert/strict');
const { personioBloecke, alsUhrzeit, kommentar, arbeitszeit } = require('../src/personio/umrechnung.js');

// Abschnitte wie aus tagesabschnitte(): "A 08:00 12:00 Aufgabe" bzw. "P 12:00 12:30"
function tag(...zeilen) {
    return zeilen.map(z => {
        const [art, von, bis, ...aufgabe] = z.split(' ');
        const zeit = t => '2026-10-21T' + (t.length === 5 ? t + ':00' : t) + '+02:00';
        return { art: art === 'A' ? 'Arbeit' : 'Pause', start: zeit(von), ende: zeit(bis), aufgabe: aufgabe.join(' ') };
    });
}

function lesbar(bloecke) {
    return bloecke.map(b => (b.art === 'Arbeit' ? 'A ' : 'P ') + alsUhrzeit(b.von) + ' ' + alsUhrzeit(b.bis));
}

test('Wenn_zwei_Aufgaben_aufeinander_folgen_dann_ein_Arbeitsblock_mit_beiden_Namen_als_Kommentar', () => {
    const bloecke = personioBloecke(tag('A 08:52 09:14 Allgemein', 'A 09:14 11:37 Portal', 'A 11:37 12:00 Allgemein'));

    assert.deepEqual(lesbar(bloecke), ['A 08:52 12:00']);
    assert.equal(kommentar(bloecke[0]), 'Allgemein, Portal');   // jede Aufgabe einmal, in Reihenfolge
});

test('Wenn_Sekunden_vorhanden_dann_wird_auf_die_Minute_abgerundet', () => {
    const bloecke = personioBloecke(tag('A 08:52:59 09:14:29 Allgemein'));

    assert.deepEqual(lesbar(bloecke), ['A 08:52 09:14']);   // auch 59 s werden abgeschnitten
});

test('Wenn_genau_6_h_ohne_Pause_dann_bleibt_alles_unveraendert', () => {
    assert.deepEqual(lesbar(personioBloecke(tag('A 08:00 14:00 X'))), ['A 08:00 14:00']);
});

test('Wenn_7_h_ohne_Pause_dann_30_min_nach_6_h_eingeschoben_und_Rest_rueckt_nach_hinten', () => {
    const bloecke = personioBloecke(tag('A 08:00 15:00 X'));

    assert.deepEqual(lesbar(bloecke), ['A 08:00 14:00', 'P 14:00 14:30', 'A 14:30 15:30']);
    assert.equal(arbeitszeit(bloecke), 7 * 60);   // keine Arbeitszeit verloren
});

test('Wenn_Pause_in_Mindestlaenge_rechtzeitig_dann_bleibt_alles_unveraendert', () => {
    const abschnitte = tag('A 08:00 12:00 X', 'P 12:00 12:30', 'A 12:30 17:00 X');

    assert.deepEqual(lesbar(personioBloecke(abschnitte)), ['A 08:00 12:00', 'P 12:00 12:30', 'A 12:30 17:00']);
});

test('Wenn_einzige_Pause_zu_kurz_dann_verlaengert_sie_sich_in_die_folgende_Arbeit', () => {
    const bloecke = personioBloecke(tag('A 08:00 12:00 X', 'P 12:00 12:20', 'A 12:20 17:00 X'));

    assert.deepEqual(lesbar(bloecke), ['A 08:00 12:00', 'P 12:00 12:30', 'A 12:30 17:00']);
    assert.equal(arbeitszeit(bloecke), 8 * 60 + 30);   // 10 min Arbeit verloren
});

test('Wenn_5_min_und_spaeter_30_min_Pause_dann_werden_die_5_min_nicht_verlaengert', () => {
    const abschnitte = tag('A 08:00 10:00 X', 'P 10:00 10:05', 'A 10:05 12:00 X', 'P 12:00 12:30', 'A 12:30 16:00 X');

    assert.deepEqual(lesbar(personioBloecke(abschnitte)),
        ['A 08:00 10:00', 'P 10:00 10:05', 'A 10:05 12:00', 'P 12:00 12:30', 'A 12:30 16:00']);
});

test('Wenn_alle_Pausen_zu_kurz_dann_wird_die_laengste_verlaengert', () => {
    const abschnitte = tag('A 08:00 10:00 X', 'P 10:00 10:10', 'A 10:10 12:30 X', 'P 12:30 12:50', 'A 12:50 16:00 X');

    assert.deepEqual(lesbar(personioBloecke(abschnitte)),
        ['A 08:00 10:00', 'P 10:00 10:10', 'A 10:10 12:30', 'P 12:30 13:00', 'A 13:00 16:00']);   // 20 min auf 30 min
});

test('Wenn_Mindestpause_zu_spaet_dann_an_die_6_h_Grenze_vorgezogen', () => {
    const bloecke = personioBloecke(tag('A 08:00 15:00 X', 'P 15:00 15:30', 'A 15:30 16:00 X'));

    assert.deepEqual(lesbar(bloecke), ['A 08:00 14:00', 'P 14:00 14:30', 'A 14:30 16:00']);
    assert.equal(arbeitszeit(bloecke), 7 * 60 + 30);   // Arbeitszeit unverändert
});

test('Wenn_9_h_Arbeit_dann_gelten_45_min_Pause', () => {
    const bloecke = personioBloecke(tag('A 07:00 13:00 X', 'P 13:00 13:30', 'A 13:30 16:30 X'));

    assert.deepEqual(lesbar(bloecke), ['A 07:00 13:00', 'P 13:00 13:45', 'A 13:45 16:30']);
});

test('Wenn_mehr_als_10_h_Arbeit_dann_bei_10_h_gekappt', () => {
    const bloecke = personioBloecke(tag('A 07:00 12:00 X', 'P 12:00 12:45', 'A 12:45 18:30 X'));

    assert.deepEqual(lesbar(bloecke), ['A 07:00 12:00', 'P 12:00 12:45', 'A 12:45 17:45']);
    assert.equal(arbeitszeit(bloecke), 10 * 60);
});

test('Wenn_Tag_aus_KanbanFlow_vom_21_10_dann_bleibt_er_regelkonform_unveraendert', () => {
    // 8:24 h Arbeit, 44 min Pause zwischen 12:00 und 12:44, längstes Stück 3:35 h
    const abschnitte = tag(
        'A 08:25:02 09:24:00 Allgemein', 'A 09:24:00 12:00:52 Portal', 'P 12:00:52 12:44:57',
        'A 12:44:57 12:57:18 Allgemein', 'A 12:57:18 17:33:32 Portal');

    const bloecke = personioBloecke(abschnitte);

    assert.deepEqual(lesbar(bloecke), ['A 08:25 12:00', 'P 12:00 12:44', 'A 12:44 17:33']);
    assert.equal(arbeitszeit(bloecke), 8 * 60 + 24);   // wie KanbanFlow: 8:24:25 h
});
