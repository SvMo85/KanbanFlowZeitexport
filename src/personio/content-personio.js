// Content-Script auf Personio: Knopf "Zeitexport einfügen" füllt das Formular des passenden Tages.
// Gespeichert wird nie; den Knopf "Speichern" klickt der Nutzer selbst.
(function () {
    'use strict';

    const tagauswahl = globalThis.KfPersonioTagauswahl;

    function warte(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    async function warteAuf(finde, versuche = 30) {
        for (let i = 0; i < versuche; i++) {
            const gefunden = finde();
            if (gefunden) return gefunden;
            await warte(100);
        }
        return null;
    }

    function meldung(text) {
        let el = document.querySelector('.kfze-meldung');
        if (!el) {
            el = document.createElement('div');
            el.className = 'kfze-meldung';
            document.body.appendChild(el);
        }
        el.textContent = text;
        clearTimeout(el._ausblenden);
        el._ausblenden = setTimeout(() => el.remove(), 8000);
    }

    // Die Zeitsegmente nehmen keine simulierten Tasten an, wohl aber execCommand('insertText') - Ziffer für Ziffer
    async function tippe(segment, ziffern) {
        segment.focus();
        for (const ziffer of ziffern) {
            document.execCommand('insertText', false, ziffer);
            await warte(60);
        }
    }

    async function setzeZeit(formular, feld, uhrzeit) {
        const gruppe = formular.querySelector('[data-test-id="' + feld + '"]');
        const [stunden, minuten] = gruppe.querySelectorAll('[role=spinbutton]');
        const wert = () => gruppe.querySelector('input[type=time]').value;

        await tippe(stunden, uhrzeit.slice(0, 2));
        await tippe(minuten, uhrzeit.slice(3, 5));
        if (wert() !== uhrzeit && uhrzeit[0] === '0') {
            // zweiter Versuch ohne führende Null: "8" statt "08"
            await tippe(stunden, uhrzeit[1]);
            await tippe(minuten, uhrzeit.slice(3, 5));
        }
        if (wert() !== uhrzeit) {
            throw new Error(feld + ': ' + uhrzeit + ' nicht übernommen (steht auf "' + wert() + '").');
        }
    }

    function setzeKommentar(formular, index, text) {
        const feld = formular.querySelector('input[name="periods.' + index + '.comment"]');
        if (!feld) return;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(feld, text);
        feld.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function blockarten(formular) {
        return [...formular.querySelectorAll('[aria-label="Art des Zeitraums"]')].map(k => k.textContent.trim());
    }

    function hatEintraege(formular) {
        return [...formular.querySelectorAll('[role=spinbutton]')].some(s => s.getAttribute('aria-valuenow') !== null);
    }

    // Blöcke passend zum Export herstellen: fehlende per "+ Arbeit"/"+ Pause" anhängen, überzählige hinten löschen
    async function stelleBloeckeHer(formular, bloecke) {
        for (let i = blockarten(formular).length; i < bloecke.length; i++) {
            const knopf = bloecke[i].art === 'Arbeit' ? 'timecard-add-work' : 'timecard-add-break';
            formular.querySelector('[data-test-id="' + knopf + '"]').click();
            await warteAuf(() => blockarten(formular).length > i);
        }
        while (blockarten(formular).length > bloecke.length) {
            const letzter = blockarten(formular).length - 1;
            formular.querySelector('[data-test-id="timecard-delete-period-' + letzter + '"]').click();
            await warteAuf(() => blockarten(formular).length === letzter);
        }
        const arten = blockarten(formular);
        bloecke.forEach((b, i) => {
            if (arten[i] !== b.art) {
                throw new Error('Block ' + (i + 1) + ' ist "' + arten[i] + '", erwartet "' + b.art + '".');
            }
        });
    }

    async function fuegeEin() {
        const gespeichert = await chrome.storage.local.get('personioExport');
        const ausKanbanFlow = gespeichert.personioExport;
        if (!ausKanbanFlow) {
            meldung('Kein Export vorhanden. Zuerst in KanbanFlow „Export" und „Für Personio übernehmen" klicken.');
            return;
        }
        const auswahl = tagauswahl.tagesindex(ausKanbanFlow.datum, location.href);
        if (auswahl.fehler) {
            meldung(auswahl.fehler);
            return;
        }
        const zeile = document.querySelector('div[role=row][data-test-id="timesheet-timecard"][data-day-index="' + auswahl.index + '"]');
        if (!zeile) {
            meldung('Tageszeile zum ' + ausKanbanFlow.datum + ' nicht gefunden.');
            return;
        }
        if (zeile.getAttribute('aria-expanded') !== 'true') zeile.click();
        const formular = await warteAuf(() => document.getElementById(zeile.getAttribute('aria-controls')));
        if (!formular) {
            meldung('Das Formular des Tages hat sich nicht geöffnet.');
            return;
        }
        if (hatEintraege(formular)) {
            meldung('Der Tag hat bereits Einträge in Personio. Es wurde nichts verändert.');
            return;
        }

        await stelleBloeckeHer(formular, ausKanbanFlow.bloecke);
        for (const [i, b] of ausKanbanFlow.bloecke.entries()) {
            await setzeZeit(formular, 'periods.' + i + '.start', b.von);
            await setzeZeit(formular, 'periods.' + i + '.end', b.bis);
            if (b.art === 'Arbeit') setzeKommentar(formular, i, b.kommentar);
        }
        meldung('Eingetragen: ' + ausKanbanFlow.bloecke.length + ' Blöcke. Bitte prüfen und selbst speichern.');
    }

    async function knopfGeklickt(knopf) {
        knopf.disabled = true;
        try {
            await fuegeEin();
        } catch (fehler) {
            meldung('Zeitexport: ' + fehler.message);
        } finally {
            knopf.disabled = false;
        }
    }

    // Personio ist eine Single-Page-App: der Knopf erscheint nur auf der Zeiterfassung
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'kfze-knopf kfze-export';
    knopf.textContent = 'Zeitexport einfügen';
    knopf.addEventListener('click', () => knopfGeklickt(knopf));

    function platziere() {
        const aufZeiterfassung = location.pathname.startsWith('/attendance/');
        if (aufZeiterfassung && !knopf.isConnected) document.body.appendChild(knopf);
        if (!aufZeiterfassung && knopf.isConnected) knopf.remove();
    }

    platziere();
    new MutationObserver(platziere).observe(document.body, { childList: true, subtree: true });
})();
