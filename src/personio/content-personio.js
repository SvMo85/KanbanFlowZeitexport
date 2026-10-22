// Content-Script auf Personio: Knopf "Zeitexport einfügen" füllt das Formular des passenden Tages.
// Gespeichert wird nie; den Knopf "Speichern" klickt der Nutzer selbst.
(function () {
    'use strict';

    const tagauswahl = globalThis.KfPersonioTagauswahl;
    const PAUSE_ZWISCHEN_ZIFFERN_MS = 150;

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

    // Die Zeitsegmente nehmen keine simulierten Tasten an, wohl aber execCommand('insertText').
    // Personio verarbeitet jede Ziffer verzögert und springt selbst zwischen den Segmenten: deshalb nach
    // jeder Ziffer warten, bis genau dieser Wert angekommen ist - sonst landen Ziffern im falschen Segment.
    // Nach der ersten Ziffer zeigt Personio je nach Segment "5" oder schon "50" - dort zählt, dass sich
    // etwas getan hat oder das Segment schon ihren Wert zeigt ("0" in ein Segment, das bereits 0 zeigt,
    // ändert nichts sichtbar). Nach der zweiten Ziffer muss genau der Zielwert stehen ("08" -> 8, "52" -> 52).
    async function tippe(segment, ziffern, feld, uhrzeit) {
        segment.focus();
        await warteAuf(() => document.activeElement === segment, 20);
        const wert = () => segment.getAttribute('aria-valuenow');
        const stand = () => wert() + '|' + segment.textContent;
        for (const [index, ziffer] of [...ziffern].entries()) {
            const vorher = wert();
            const vorherStand = stand();
            if (document.activeElement !== segment) segment.focus();
            document.execCommand('insertText', false, ziffer);
            const letzte = index === ziffern.length - 1;
            const ersteAngekommen = () => stand() !== vorherStand
                || wert() === String(Number(ziffer)) || wert() === String(Number(ziffer) * 10);
            const angekommen = await warteAuf(() => letzte ? wert() === String(Number(ziffern)) : ersteAngekommen(), 20);
            if (!angekommen) {
                throw new Error(feld + ' ' + segment.getAttribute('aria-label') + ', Soll ' + uhrzeit + ': Ziffer "' + ziffer
                    + '" nicht angekommen (Wert vorher ' + vorher + ', nachher ' + wert() + ', Anzeige "' + segment.textContent + '").');
            }
            await warte(PAUSE_ZWISCHEN_ZIFFERN_MS);
        }
    }

    async function setzeZeit(formular, feld, uhrzeit) {
        const gruppe = formular.querySelector('[data-test-id="' + feld + '"]');
        const [stunden, minuten] = gruppe.querySelectorAll('[role=spinbutton]');
        const wert = () => gruppe.querySelector('input[type=time]').value;

        await tippe(stunden, uhrzeit.slice(0, 2), feld, uhrzeit);
        await tippe(minuten, uhrzeit.slice(3, 5), feld, uhrzeit);
        await warteAuf(() => wert() === uhrzeit, 20);
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

    // Blöcke passend zum Export herstellen: die vorhandenen Blöcke bis zur ersten abweichenden Art behalten,
    // den Rest hinten löschen und per "+ Arbeit"/"+ Pause" in der Reihenfolge des Exports neu anhängen
    async function stelleBloeckeHer(formular, bloecke) {
        const vorhanden = blockarten(formular);
        let behalten = 0;
        while (behalten < vorhanden.length && behalten < bloecke.length && vorhanden[behalten] === bloecke[behalten].art) behalten++;

        while (blockarten(formular).length > behalten) {
            const letzter = blockarten(formular).length - 1;
            formular.querySelector('[data-test-id="timecard-delete-period-' + letzter + '"]').click();
            await warteAuf(() => blockarten(formular).length === letzter);
        }
        for (let i = behalten; i < bloecke.length; i++) {
            const knopf = bloecke[i].art === 'Arbeit' ? 'timecard-add-work' : 'timecard-add-break';
            formular.querySelector('[data-test-id="' + knopf + '"]').click();
            await warteAuf(() => blockarten(formular).length > i);
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
        // Verbraucht: ein alter Export soll beim nächsten Seitenaufruf nicht wieder bereitliegen
        await chrome.storage.local.remove('personioExport');
        const anzahl = ausKanbanFlow.bloecke.length;
        meldung('Eingetragen: ' + anzahl + (anzahl === 1 ? ' Block' : ' Blöcke') + '. Bitte prüfen und selbst speichern.');
    }

    // Während des Einfügens darf nichts den Fokus aus dem Zeitfeld ziehen: Klicks, Scrollen und Tasten
    // werden abgefangen. Das Einfügen selbst nutzt execCommand, keine Tastenereignisse.
    const GESPERRTE_EREIGNISSE = ['mousedown', 'mouseup', 'click', 'dblclick', 'pointerdown', 'pointerup',
        'wheel', 'touchstart', 'touchmove', 'keydown', 'keyup', 'keypress'];

    // Nur echte Eingaben des Nutzers verwerfen; die eigenen Klicks des Skripts (Zeile aufklappen,
    // "+ Arbeit", Löschen) sind programmatisch (isTrusted = false) und müssen durchgehen
    function verwerfe(ereignis) {
        if (!ereignis.isTrusted) return;
        ereignis.preventDefault();
        ereignis.stopPropagation();
    }

    function sperreSeite() {
        const blocker = document.createElement('div');
        blocker.className = 'kfze-blocker';
        const text = document.createElement('div');
        text.className = 'kfze-blocker-text';
        text.textContent = 'Zeitexport trägt ein … bitte warten';
        blocker.appendChild(text);
        document.body.appendChild(blocker);
        GESPERRTE_EREIGNISSE.forEach(art => window.addEventListener(art, verwerfe, { capture: true, passive: false }));
        return () => {
            GESPERRTE_EREIGNISSE.forEach(art => window.removeEventListener(art, verwerfe, { capture: true }));
            blocker.remove();
        };
    }

    async function knopfGeklickt(knopf) {
        knopf.disabled = true;
        const entsperre = sperreSeite();
        try {
            await fuegeEin();
        } catch (fehler) {
            meldung('Zeitexport: ' + fehler.message);
        } finally {
            entsperre();
            await zeigeExportZustand();
        }
    }

    // Ausgegraut, solange kein Export aus KanbanFlow bereitliegt
    async function zeigeExportZustand() {
        const { personioExport } = await chrome.storage.local.get('personioExport');
        knopf.disabled = !personioExport;
        knopf.title = personioExport
            ? 'Zeiten vom ' + personioExport.datum.slice(8, 10) + '.' + personioExport.datum.slice(5, 7) + '.' + personioExport.datum.slice(0, 4) + ' einfügen'
            : 'Kein Export vorhanden. Zuerst in KanbanFlow „Für Personio übernehmen" klicken.';
    }

    // KanbanFlow-Farbe und -Logo: der Knopf holt die Zeiten aus KanbanFlow
    const knopf = document.createElement('button');
    knopf.type = 'button';
    const logo = document.createElement('img');
    logo.className = 'kfze-logo';
    logo.src = chrome.runtime.getURL('assets/logos/kanbanflow.svg');
    logo.alt = '';
    knopf.append(logo, 'Zeitexport einfügen');
    knopf.addEventListener('click', () => knopfGeklickt(knopf));

    function abwesenheitKnopf() {
        return [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Abwesenheit beantragen');
    }

    // Seite fertig aufgebaut: Kopfknopf und Tageszeilen sind da - vorher würde der Knopf mitspringen
    function seiteAufgebaut() {
        return abwesenheitKnopf() && document.querySelector('div[role=row][data-test-id="timesheet-timecard"]');
    }

    // Fehlt "Abwesenheit beantragen" auch nach einigen Sekunden, erscheint der Knopf unten rechts
    const ERSATZPLATZ_NACH_MS = 5000;
    let ersatzplatzErlaubt = false;
    let ersatzplatzZeitgeber = null;

    // Personio ist eine Single-Page-App: der Knopf erscheint nur auf der Zeiterfassung,
    // links neben "Abwesenheit beantragen", und erst wenn die Seite aufgebaut ist
    function platziere() {
        if (!location.pathname.startsWith('/attendance/')) {
            if (knopf.isConnected) knopf.remove();
            clearTimeout(ersatzplatzZeitgeber);
            ersatzplatzZeitgeber = null;
            ersatzplatzErlaubt = false;
            return;
        }
        if (!ersatzplatzZeitgeber && !ersatzplatzErlaubt) {
            ersatzplatzZeitgeber = setTimeout(() => { ersatzplatzErlaubt = true; platziere(); }, ERSATZPLATZ_NACH_MS);
        }
        if (seiteAufgebaut()) {
            const nachbar = abwesenheitKnopf();
            if (nachbar.previousElementSibling !== knopf) {
                knopf.className = 'kfze-knopf kfze-knopf-kanbanflow kfze-kopfknopf-personio';
                nachbar.before(knopf);
            }
        } else if (ersatzplatzErlaubt && !knopf.isConnected) {
            knopf.className = 'kfze-knopf kfze-knopf-kanbanflow kfze-export';
            document.body.appendChild(knopf);
        }
    }

    zeigeExportZustand();
    chrome.storage.onChanged.addListener((aenderungen, bereich) => {
        if (bereich === 'local' && 'personioExport' in aenderungen) zeigeExportZustand();
    });

    platziere();
    new MutationObserver(platziere).observe(document.body, { childList: true, subtree: true });
})();
