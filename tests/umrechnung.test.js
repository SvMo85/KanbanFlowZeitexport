const { test } = require('node:test');
const assert = require('node:assert/strict');
const { personioBloecke, regelverstoesse, verschiebeGrenze, alsUhrzeit, alsMinuten, kommentar, arbeitszeit, dauerOhneUeberlappung } = require('../src/personio/umrechnung.js');

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

test('Wenn_Arbeitsabschnitte_sich_ueberlappen_dann_ein_Block_ueber_beide', () => {
    // wie im Screenshot: derselbe Abschnitt doppelt, dazu ein teilweise überlappender
    const bloecke = personioBloecke(tag('A 14:53 17:19 Portal', 'A 14:53 17:19 Portal', 'A 17:00 17:30 Allgemein'));

    assert.deepEqual(lesbar(bloecke), ['A 14:53 17:30']);
    assert.equal(kommentar(bloecke[0]), 'Portal, Allgemein');
    assert.equal(arbeitszeit(bloecke), 2 * 60 + 37);   // nicht doppelt gezählt
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

// Bearbeitete Blöcke: "A 08:00 12:00" bzw. "P 12:00 12:30", Zeiten in Minuten
function bearbeitet(...zeilen) {
    return zeilen.map(z => {
        const [art, von, bis] = z.split(' ');
        return { art: art === 'A' ? 'Arbeit' : 'Pause', von: alsMinuten(von), bis: alsMinuten(bis) };
    });
}

test('Wenn_bearbeitete_Bloecke_regelkonform_dann_keine_Verstoesse', () => {
    assert.deepEqual(regelverstoesse(bearbeitet('A 08:00 12:00', 'P 12:00 12:30', 'A 12:30 17:00')), []);
});

test('Wenn_Bis_vor_Von_dann_Verstoss_mit_Blocknummer', () => {
    assert.deepEqual(regelverstoesse(bearbeitet('A 08:00 12:00', 'P 12:30 12:00')), ['Block 2: Bis liegt nicht nach Von.']);
});

test('Wenn_Bloecke_sich_ueberschneiden_dann_Verstoss_mit_beiden_Zeitraeumen', () => {
    const verstoesse = regelverstoesse(bearbeitet('A 08:00 12:00', 'A 11:30 13:00'));

    assert.deepEqual(verstoesse, ['Blöcke 08:00–12:00 und 11:30–13:00 überschneiden sich.']);
});

test('Wenn_mehr_als_10_h_Arbeit_dann_Verstoss', () => {
    const verstoesse = regelverstoesse(bearbeitet('A 06:00 12:00', 'P 12:00 12:45', 'A 12:45 17:00'));

    assert.ok(verstoesse.includes('Mehr als 10 h Arbeit (10:15 h).'));   // 6:00 + 4:15
});

test('Wenn_7_h_ohne_Pause_dann_Verstoss_6_h_am_Stueck_und_fehlende_Pause', () => {
    const verstoesse = regelverstoesse(bearbeitet('A 08:00 15:00'));

    assert.deepEqual(verstoesse, [
        'Mehr als 6 h am Stück ohne Pause von 30 min (bis 15:00).',
        'Bei 7:00 h Arbeit fehlt eine Pause von mindestens 30 min an einem Stück.'
    ]);
});

test('Wenn_Luecke_von_30_min_ohne_Pausenblock_dann_zaehlt_sie_als_Pause', () => {
    assert.deepEqual(regelverstoesse(bearbeitet('A 08:00 12:00', 'A 12:30 16:00')), []);
});

test('Wenn_nur_20_min_Pause_bei_8_h_dann_Verstoss_6_h_am_Stueck_und_fehlende_Pause', () => {
    const verstoesse = regelverstoesse(bearbeitet('A 08:00 12:00', 'P 12:00 12:20', 'A 12:20 16:20'));

    assert.deepEqual(verstoesse, [
        'Mehr als 6 h am Stück ohne Pause von 30 min (bis 16:20).',   // 20 min unterbrechen nicht
        'Bei 8:00 h Arbeit fehlt eine Pause von mindestens 30 min an einem Stück.'
    ]);
});

test('Wenn_KanbanFlow_Abschnitte_sich_ueberlappen_dann_zaehlt_die_Summe_die_Zeit_einmal', () => {
    // wie im Screenshot: 14:53-17:19 doppelt, dazu 17:00-17:30
    const bloecke = bearbeitet('A 08:52 14:25', 'P 14:25 14:53', 'A 14:53 17:19', 'A 14:53 17:19', 'A 17:00 17:30');

    assert.equal(dauerOhneUeberlappung(bloecke, 'Arbeit'), 8 * 60 + 10);   // 5:33 + 2:37, nicht 10:55
    assert.equal(dauerOhneUeberlappung(bloecke, 'Pause'), 28);
});

test('Wenn_KanbanFlow_Abschnitte_sich_ueberlappen_dann_zaehlt_die_Summe_die_Zeit_einmal', () => {
    // wie im Screenshot: 14:53-17:19 doppelt, dazu 17:00-17:30
    const bloecke = bearbeitet('A 08:52 14:25', 'P 14:25 14:53', 'A 14:53 17:19', 'A 14:53 17:19', 'A 17:00 17:30');

    assert.equal(dauerOhneUeberlappung(bloecke, 'Arbeit'), 8 * 60 + 10);   // 5:33 + 2:37, nicht 10:55
    assert.equal(dauerOhneUeberlappung(bloecke, 'Pause'), 28);
});

test('Wenn_KanbanFlow_Abschnitte_sich_ueberlappen_dann_zaehlt_die_Summe_die_Zeit_einmal', () => {
    // wie im Screenshot: 14:53-17:19 doppelt, dazu 17:00-17:30
    const bloecke = bearbeitet('A 08:52 14:25', 'P 14:25 14:53', 'A 14:53 17:19', 'A 14:53 17:19', 'A 17:00 17:30');

    assert.equal(dauerOhneUeberlappung(bloecke, 'Arbeit'), 8 * 60 + 10);   // 5:33 + 2:37, nicht 10:55
    assert.equal(dauerOhneUeberlappung(bloecke, 'Pause'), 28);
});

test('Wenn_Ende_der_Arbeit_verschoben_dann_wandert_der_Beginn_der_folgenden_Pause_mit', () => {
    const bloecke = bearbeitet('A 08:00 12:00', 'P 12:00 12:30', 'A 12:30 17:00');

    const neu = verschiebeGrenze(bloecke, 0, 'bis', alsMinuten('12:15'));

    assert.deepEqual(lesbar(neu), ['A 08:00 12:15', 'P 12:15 12:30', 'A 12:30 17:00']);
    assert.deepEqual(lesbar(bloecke), ['A 08:00 12:00', 'P 12:00 12:30', 'A 12:30 17:00']);   // Eingabe unverändert
});

test('Wenn_Beginn_der_Arbeit_verschoben_dann_wandert_das_Ende_der_vorigen_Pause_mit', () => {
    const neu = verschiebeGrenze(bearbeitet('A 08:00 12:00', 'P 12:00 12:30', 'A 12:30 17:00'), 2, 'von', alsMinuten('12:45'));

    assert.deepEqual(lesbar(neu), ['A 08:00 12:00', 'P 12:00 12:45', 'A 12:45 17:00']);
});

test('Wenn_Luecke_zum_Nachbarn_dann_wandert_nichts_mit', () => {
    const neu = verschiebeGrenze(bearbeitet('A 08:00 12:00', 'A 12:30 17:00'), 0, 'bis', alsMinuten('12:10'));

    assert.deepEqual(lesbar(neu), ['A 08:00 12:10', 'A 12:30 17:00']);
});

test('Wenn_Auto_Ergebnis_geprueft_wird_dann_ist_es_regelkonform', () => {
    // was die Umrechnung liefert, muss die Prüfung bestehen
    const bloecke = personioBloecke(tag('A 07:00 12:00 X', 'P 12:00 12:10', 'A 12:10 18:30 X'));

    assert.deepEqual(regelverstoesse(bloecke), []);
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
