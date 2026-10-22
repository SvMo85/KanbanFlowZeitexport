// Rechnet die Abschnitte eines Tages in Personio-Blöcke um ("SOLL"), nach den Regeln der Vision.
// Reine Funktionen ohne DOM-Zugriff, damit sie in Node testbar sind. Zeiten in Minuten seit Mitternacht.
(function (global) {
    'use strict';

    const OHNE_PAUSE_ERLAUBT = 6 * 60;
    const HOECHSTENS_AM_STUECK = 6 * 60;
    const HOECHSTENS_JE_TAG = 10 * 60;
    const LANGER_TAG_AB = 9 * 60;

    function minutenSeitMitternacht(zeitstempelLokal) {
        const stunden = Number(zeitstempelLokal.slice(11, 13));
        const minuten = Number(zeitstempelLokal.slice(14, 16));
        const sekunden = Number(zeitstempelLokal.slice(17, 19));
        // Personio erfasst Minuten: Sekunden werden abgeschnitten
        return Math.floor(stunden * 60 + minuten + sekunden / 60);
    }

    function dauer(block) {
        return block.bis - block.von;
    }

    function istArbeit(block) {
        return block.art === 'Arbeit';
    }

    function arbeitszeit(bloecke) {
        return bloecke.filter(istArbeit).reduce((summe, b) => summe + dauer(b), 0);
    }

    function alsBloecke(abschnitte) {
        return abschnitte
            .map(a => ({ art: a.art, von: minutenSeitMitternacht(a.start), bis: minutenSeitMitternacht(a.ende), aufgaben: a.aufgabe ? [a.aufgabe] : [] }))
            .filter(b => dauer(b) > 0);
    }

    // Aneinanderstoßende Blöcke gleicher Art werden einer
    function zusammengefasst(bloecke) {
        const ergebnis = [];
        for (const b of bloecke) {
            const vorheriger = ergebnis[ergebnis.length - 1];
            if (vorheriger && vorheriger.art === b.art && vorheriger.bis === b.von) {
                vorheriger.bis = b.bis;
                vorheriger.aufgaben = [...new Set(vorheriger.aufgaben.concat(b.aufgaben))];
            } else {
                ergebnis.push({ ...b, aufgaben: b.aufgaben.slice() });
            }
        }
        return ergebnis;
    }

    function gekappt(bloecke) {
        const ergebnis = [];
        let summe = 0;
        for (const b of bloecke) {
            if (istArbeit(b)) {
                if (summe >= HOECHSTENS_JE_TAG) break;
                const rest = HOECHSTENS_JE_TAG - summe;
                if (dauer(b) > rest) {
                    ergebnis.push({ ...b, bis: b.von + rest });
                    break;
                }
                summe += dauer(b);
            }
            ergebnis.push(b);
        }
        while (ergebnis.length > 0 && !istArbeit(ergebnis[ergebnis.length - 1])) ergebnis.pop();
        return ergebnis;
    }

    // Sind alle Pausen zu kurz, wird die längste verlängert und schneidet in die folgende Arbeit
    function verlaengereLaengstePause(bloecke, mindestpause) {
        const pausen = bloecke.filter(b => !istArbeit(b));
        if (pausen.length === 0 || pausen.some(p => dauer(p) >= mindestpause)) return bloecke;

        const laengste = pausen.reduce((a, p) => dauer(p) > dauer(a) ? p : a);
        let fehlend = mindestpause - dauer(laengste);
        laengste.bis += fehlend;
        for (let j = bloecke.indexOf(laengste) + 1; j < bloecke.length && fehlend > 0; j++) {
            const weg = Math.min(fehlend, dauer(bloecke[j]));
            bloecke[j].von += weg;
            fehlend -= weg;
        }
        return bloecke.filter(b => dauer(b) > 0);
    }

    function verschiebe(bloecke, minuten) {
        bloecke.forEach(b => { b.von += minuten; b.bis += minuten; });
    }

    // Nur eine Pause in Mindestlänge unterbricht die 6 h am Stück. Liegt sie zu spät, wird sie an die
    // 6-h-Grenze vorgezogen; fehlt sie, wird sie dort eingeschoben. Die Arbeit dahinter rückt nach hinten.
    function haltSechsStundenEin(bloecke, mindestpause) {
        let amStueck = 0;
        let i = 0;
        while (i < bloecke.length) {
            const b = bloecke[i];
            if (!istArbeit(b)) {
                if (dauer(b) >= mindestpause) amStueck = 0;
                i++;
                continue;
            }
            if (amStueck + dauer(b) <= HOECHSTENS_AM_STUECK) {
                amStueck += dauer(b);
                i++;
                continue;
            }

            const grenze = b.von + (HOECHSTENS_AM_STUECK - amStueck);
            const rest = { art: 'Arbeit', von: grenze, bis: b.bis, aufgaben: b.aufgaben.slice() };
            b.bis = grenze;

            const spaetere = bloecke.findIndex((p, k) => k > i && !istArbeit(p) && dauer(p) >= mindestpause);
            let pausendauer;
            if (spaetere >= 0) {
                pausendauer = dauer(bloecke.splice(spaetere, 1)[0]);
                verschiebe([rest].concat(bloecke.slice(i + 1, spaetere)), pausendauer);
            } else {
                pausendauer = mindestpause;
                verschiebe([rest].concat(bloecke.slice(i + 1)), pausendauer);
            }
            bloecke.splice(i + 1, 0, { art: 'Pause', von: grenze, bis: grenze + pausendauer, aufgaben: [] }, rest);
            amStueck = 0;
            i += 2;
        }
        return bloecke;
    }

    function personioBloecke(abschnitte) {
        const bloecke = gekappt(zusammengefasst(alsBloecke(abschnitte)));
        const arbeit = arbeitszeit(bloecke);
        if (arbeit <= OHNE_PAUSE_ERLAUBT) return bloecke;

        const mindestpause = arbeit < LANGER_TAG_AB ? 30 : 45;
        const mitPause = verlaengereLaengstePause(bloecke, mindestpause);
        return zusammengefasst(haltSechsStundenEin(mitPause, mindestpause));
    }

    function alsUhrzeit(minuten) {
        return String(Math.floor(minuten / 60)).padStart(2, '0') + ':' + String(minuten % 60).padStart(2, '0');
    }

    function kommentar(block) {
        return block.aufgaben.join(', ');
    }

    const api = { personioBloecke, alsUhrzeit, kommentar, arbeitszeit };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        global.KfPersonioUmrechnung = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
