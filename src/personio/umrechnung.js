// Rechnet die Abschnitte eines Tages in Personio-Blöcke um ("SOLL"), nach den Regeln der Vision.
// Reine Funktionen ohne DOM-Zugriff, damit sie in Node testbar sind. Zeiten in Minuten seit Mitternacht.
(function (global) {
    'use strict';

    const OHNE_PAUSE_ERLAUBT = 6 * 60;
    const HOECHSTENS_AM_STUECK = 6 * 60;
    const HOECHSTENS_JE_TAG = 10 * 60;
    const LANGER_TAG_AB = 9 * 60;
    const KUERZESTE_PAUSE = 15;   // Personio verwirft kürzere Pausenblöcke

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

    // Dauer aller Blöcke einer Art, überlappende Zeit nur einmal gezählt (Timer auf zwei Maschinen)
    function dauerOhneUeberlappung(bloecke, art) {
        let summe = 0;
        let bisher = -Infinity;
        bloecke.filter(b => b.art === art).sort((x, y) => x.von - y.von).forEach(b => {
            const von = Math.max(b.von, bisher);
            if (b.bis > von) summe += b.bis - von;
            bisher = Math.max(bisher, b.bis);
        });
        return summe;
    }

    function alsBloecke(abschnitte) {
        return abschnitte
            .map(a => ({ art: a.art, von: minutenSeitMitternacht(a.start), bis: minutenSeitMitternacht(a.ende), aufgaben: a.aufgabe ? [a.aufgabe] : [] }))
            .filter(b => dauer(b) > 0);
    }

    // Aneinanderstoßende oder überlappende Blöcke gleicher Art werden einer (Arbeit lässt sich nicht doppelt leisten)
    function zusammengefasst(bloecke) {
        const ergebnis = [];
        for (const b of bloecke.slice().sort((x, y) => x.von - y.von)) {
            const vorheriger = ergebnis[ergebnis.length - 1];
            if (vorheriger && vorheriger.art === b.art && b.von <= vorheriger.bis) {
                vorheriger.bis = Math.max(vorheriger.bis, b.bis);
                vorheriger.aufgaben = [...new Set(vorheriger.aufgaben.concat(b.aufgaben))];
            } else {
                ergebnis.push({ ...b, aufgaben: b.aufgaben.slice() });
            }
        }
        return ergebnis;
    }

    // Pausen unter 15 min nimmt Personio nicht an: sie entfallen, alles Folgende rückt um ihre Länge nach vorn
    function ohneKurzePausen(bloecke) {
        const ergebnis = [];
        let versatz = 0;
        for (const b of bloecke) {
            if (!istArbeit(b) && dauer(b) < KUERZESTE_PAUSE) {
                versatz += dauer(b);
                continue;
            }
            ergebnis.push({ ...b, von: b.von - versatz, bis: b.bis - versatz });
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
        const bloecke = gekappt(zusammengefasst(ohneKurzePausen(zusammengefasst(alsBloecke(abschnitte)))));
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

    function alsMinuten(uhrzeit) {
        return Number(uhrzeit.slice(0, 2)) * 60 + Number(uhrzeit.slice(3, 5));
    }

    function alsDauer(minuten) {
        return Math.floor(minuten / 60) + ':' + String(minuten % 60).padStart(2, '0') + ' h';
    }

    // Prüft von Hand bearbeitete Blöcke gegen die Personio-Regeln. Lücken zwischen Blöcken zählen wie Pausen.
    // Liefert je Verstoß einen Satz; leer heißt regelkonform.
    function regelverstoesse(bloecke) {
        const verstoesse = [];
        bloecke.forEach((b, i) => {
            if (b.bis <= b.von) verstoesse.push('Block ' + (i + 1) + ': Bis liegt nicht nach Von.');
            else if (!istArbeit(b) && dauer(b) < KUERZESTE_PAUSE) {
                verstoesse.push('Pause ' + alsUhrzeit(b.von) + '–' + alsUhrzeit(b.bis) + ' ist kürzer als 15 min; Personio nimmt sie nicht an.');
            }
        });
        if (verstoesse.length > 0) return verstoesse;

        const sortiert = bloecke.slice().sort((a, b) => a.von - b.von);
        for (let i = 1; i < sortiert.length; i++) {
            if (sortiert[i].von < sortiert[i - 1].bis) {
                verstoesse.push('Blöcke ' + alsUhrzeit(sortiert[i - 1].von) + '–' + alsUhrzeit(sortiert[i - 1].bis)
                    + ' und ' + alsUhrzeit(sortiert[i].von) + '–' + alsUhrzeit(sortiert[i].bis) + ' überschneiden sich.');
            }
        }
        if (verstoesse.length > 0) return verstoesse;

        const arbeit = arbeitszeit(sortiert);
        if (arbeit > HOECHSTENS_JE_TAG) {
            verstoesse.push('Mehr als 10 h Arbeit (' + alsDauer(arbeit) + ').');
        }
        if (arbeit <= OHNE_PAUSE_ERLAUBT) return verstoesse;

        // Pausen = Pausenblöcke und Lücken, jeweils als zusammenhängende Spanne ohne Arbeit
        const mindestpause = arbeit < LANGER_TAG_AB ? 30 : 45;
        const arbeitsbloecke = sortiert.filter(istArbeit);
        let laengstePause = 0;
        let amStueck = 0;
        let zuLangAmStueck = false;
        arbeitsbloecke.forEach((b, i) => {
            if (i > 0) {
                const pause = b.von - arbeitsbloecke[i - 1].bis;
                laengstePause = Math.max(laengstePause, pause);
                if (pause >= mindestpause) amStueck = 0;
            }
            amStueck += dauer(b);
            if (amStueck > HOECHSTENS_AM_STUECK && !zuLangAmStueck) {
                zuLangAmStueck = true;
                verstoesse.push('Mehr als 6 h am Stück ohne Pause von ' + mindestpause + ' min (bis ' + alsUhrzeit(b.bis) + ').');
            }
        });
        if (laengstePause < mindestpause) {
            verstoesse.push('Bei ' + alsDauer(arbeit) + ' Arbeit fehlt eine Pause von mindestens ' + mindestpause + ' min an einem Stück.');
        }
        return verstoesse;
    }

    // Bearbeiten einer Grenze: stößt ein anderer Block genau an der alten Grenze an, wandert dessen Grenze mit
    // (Ende von A verschoben -> Beginn der folgenden Pause wandert mit, und umgekehrt). Liefert neue Blöcke.
    function verschiebeGrenze(bloecke, index, feld, minuten) {
        const neu = bloecke.map(b => ({ ...b }));
        const alt = neu[index][feld];
        const gegenueber = feld === 'bis' ? 'von' : 'bis';
        const nachbar = neu.find((b, i) => i !== index && b[gegenueber] === alt);
        neu[index][feld] = minuten;
        if (nachbar) nachbar[gegenueber] = minuten;
        return neu;
    }

    // Übergabe an den Personio-Teil über chrome.storage: Datum als Schlüssel, Zeiten als HH:MM
    function personioExport(datum, abschnitte) {
        return {
            datum: datum,
            bloecke: personioBloecke(abschnitte).map(b => ({ art: b.art, von: alsUhrzeit(b.von), bis: alsUhrzeit(b.bis), kommentar: kommentar(b) }))
        };
    }

    const api = { personioBloecke, personioExport, regelverstoesse, verschiebeGrenze, alsUhrzeit, alsMinuten, kommentar, arbeitszeit, dauerOhneUeberlappung };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        global.KfPersonioUmrechnung = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
