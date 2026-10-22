const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tagesindex } = require('../src/personio/tagauswahl.js');
const { personioExport } = require('../src/personio/umrechnung.js');

const MONATSANSICHT_OKTOBER = 'https://mahredv.app.personio.com/attendance/employee/31589351?hideEmployeeHeader=true&viewMode=monthly&startDate=2026-10-01';

test('Wenn_22_10_in_der_Oktoberansicht_dann_Tagesindex_21', () => {
    // beobachtet: Zeile "Do 22. Okt." trägt data-day-index="21"
    assert.deepEqual(tagesindex('2026-10-22', MONATSANSICHT_OKTOBER), { index: 21 });
});

test('Wenn_Datum_in_anderem_Monat_dann_Hinweis_statt_Index', () => {
    const ergebnis = tagesindex('2026-11-02', MONATSANSICHT_OKTOBER);

    assert.equal(ergebnis.index, undefined);
    assert.match(ergebnis.fehler, /02\.11\.2026.*anderer Monat/);
});

test('Wenn_nicht_Monatsansicht_dann_Hinweis', () => {
    const wochenansicht = MONATSANSICHT_OKTOBER.replace('viewMode=monthly', 'viewMode=weekly');

    assert.match(tagesindex('2026-10-22', wochenansicht).fehler, /Monatsansicht/);
});

test('Wenn_Export_erstellt_dann_Datum_und_Bloecke_als_HH_MM_mit_Kommentar', () => {
    const abschnitte = [
        { art: 'Arbeit', start: '2026-10-22T08:52:39+02:00', ende: '2026-10-22T09:14:49+02:00', aufgabe: 'Allgemein' },
        { art: 'Arbeit', start: '2026-10-22T09:14:49+02:00', ende: '2026-10-22T11:30:00+02:00', aufgabe: 'Portal' }
    ];

    assert.deepEqual(personioExport('2026-10-22', abschnitte), {
        datum: '2026-10-22',
        bloecke: [{ art: 'Arbeit', von: '08:52', bis: '11:30', kommentar: 'Allgemein, Portal' }]
    });
});
