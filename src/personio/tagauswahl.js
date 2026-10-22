// Findet zu einem Datum die Tageszeile der Personio-Zeiterfassung (Monatsansicht).
// Das datetime-Attribut der Zeile liegt einen Tag daneben (UTC); verlässlich ist data-day-index,
// der Tag im Monat ab 0, zusammen mit startDate aus der Adresse.
(function (global) {
    'use strict';

    function tagesindex(datum, adresse) {
        const parameter = new URL(adresse).searchParams;
        if (parameter.get('viewMode') !== 'monthly') {
            return { fehler: 'Bitte in Personio die Monatsansicht öffnen.' };
        }
        const startDate = parameter.get('startDate') || '';
        if (startDate.slice(0, 7) !== datum.slice(0, 7)) {
            return { fehler: 'Der Export ist vom ' + datum.slice(8, 10) + '.' + datum.slice(5, 7) + '.' + datum.slice(0, 4)
                + ', angezeigt ist ein anderer Monat. Bitte zum passenden Monat wechseln.' };
        }
        return { index: Number(datum.slice(8, 10)) - 1 };
    }

    const api = { tagesindex };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        global.KfPersonioTagauswahl = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
