// Rechnet die Lage von Blöcken auf einem Zeitstrahl, gerahmt auf volle Stunden.
// Mehrere Strahlen mit demselben Rahmen stehen bündig untereinander.
// Reine Funktionen ohne DOM-Zugriff, damit sie in Node testbar sind. Zeiten in Minuten seit Mitternacht.
(function (global) {
    'use strict';

    function minutenSeitMitternacht(zeitstempelLokal) {
        const stunden = Number(zeitstempelLokal.slice(11, 13));
        const minuten = Number(zeitstempelLokal.slice(14, 16));
        const sekunden = Number(zeitstempelLokal.slice(17, 19));
        return stunden * 60 + minuten + sekunden / 60;
    }

    function rahmen(blockListen) {
        const alle = blockListen.flat();
        if (alle.length === 0) {
            return { vonStunde: 0, bisStunde: 0 };
        }
        return {
            vonStunde: Math.floor(Math.min(...alle.map(b => b.von)) / 60),
            bisStunde: Math.ceil(Math.max(...alle.map(b => b.bis)) / 60)
        };
    }

    function zeitstrahl(bloecke, strahlRahmen) {
        const spanne = (strahlRahmen.bisStunde - strahlRahmen.vonStunde) * 60;
        if (spanne <= 0) {
            return { stunden: [], balken: [] };
        }
        const prozent = minuten => (minuten - strahlRahmen.vonStunde * 60) / spanne * 100;

        const balken = bloecke.map(b => ({ art: b.art, linksProzent: prozent(b.von), breiteProzent: prozent(b.bis) - prozent(b.von) }));
        const stunden = [];
        for (let h = strahlRahmen.vonStunde; h <= strahlRahmen.bisStunde; h++) {
            stunden.push({ stunde: h, linksProzent: prozent(h * 60) });
        }
        return { stunden, balken };
    }

    const api = { minutenSeitMitternacht, rahmen, zeitstrahl };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        global.KfZeitstrahl = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
