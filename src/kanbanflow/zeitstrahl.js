// Rechnet die Lage der Abschnitte eines Tages auf einem Zeitstrahl, gerahmt auf volle Stunden.
// Reine Funktion ohne DOM-Zugriff, damit sie in Node testbar ist.
(function (global) {
    'use strict';

    function minutenSeitMitternacht(zeitstempelLokal) {
        const stunden = Number(zeitstempelLokal.slice(11, 13));
        const minuten = Number(zeitstempelLokal.slice(14, 16));
        const sekunden = Number(zeitstempelLokal.slice(17, 19));
        return stunden * 60 + minuten + sekunden / 60;
    }

    function zeitstrahl(abschnitte) {
        if (abschnitte.length === 0) {
            return { vonStunde: 0, bisStunde: 0, stunden: [], balken: [] };
        }
        const vonStunde = Math.floor(minutenSeitMitternacht(abschnitte[0].start) / 60);
        const bisStunde = Math.ceil(minutenSeitMitternacht(abschnitte[abschnitte.length - 1].ende) / 60);
        const spanne = (bisStunde - vonStunde) * 60;
        const prozent = minuten => (minuten - vonStunde * 60) / spanne * 100;

        const balken = abschnitte.map(a => {
            const links = prozent(minutenSeitMitternacht(a.start));
            const rechts = prozent(minutenSeitMitternacht(a.ende));
            return { art: a.art, aufgabe: a.aufgabe, linksProzent: links, breiteProzent: rechts - links };
        });
        const stunden = [];
        for (let h = vonStunde; h <= bisStunde; h++) {
            stunden.push({ stunde: h, linksProzent: prozent(h * 60) });
        }
        return { vonStunde, bisStunde, stunden, balken };
    }

    const api = { zeitstrahl };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        global.KfZeitstrahl = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
