// Content-Script auf kanbanflow.com: Knopf "Export" und Dialog mit den Abschnitten eines Tages.
// Liest nur; die Board-Seite wird per GET mit der Sitzung des Nutzers frisch geladen.
(function () {
    'use strict';

    const kf = globalThis.KfZeitabschnitte;
    const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

    function zweistellig(zahl) {
        return String(Math.abs(zahl)).padStart(2, '0');
    }

    function jetztLokal() {
        const d = new Date();
        const versatz = -d.getTimezoneOffset();
        return d.getFullYear() + '-' + zweistellig(d.getMonth() + 1) + '-' + zweistellig(d.getDate())
            + 'T' + zweistellig(d.getHours()) + ':' + zweistellig(d.getMinutes()) + ':' + zweistellig(d.getSeconds())
            + (versatz >= 0 ? '+' : '-') + zweistellig(Math.trunc(versatz / 60)) + ':' + zweistellig(versatz % 60);
    }

    function tagAnzeige(datum) {
        const wochentag = WOCHENTAGE[new Date(datum + 'T12:00:00').getDay()];
        return wochentag + ', ' + datum.slice(8, 10) + '.' + datum.slice(5, 7) + '.' + datum.slice(0, 4);
    }

    async function ladeBoardDaten() {
        const antwort = await fetch(location.href, { credentials: 'same-origin' });
        if (!antwort.ok) {
            throw new Error('Board-Seite nicht geladen (HTTP ' + antwort.status + ').');
        }
        const html = await antwort.text();
        const seite = new DOMParser().parseFromString(html, 'text/html');
        const skript = [...seite.scripts].find(s => s.textContent.includes('window.kf_board.bootstrap('));
        if (!skript) {
            throw new Error('Board-Daten nicht gefunden. Ist ein Board geöffnet?');
        }
        return kf.leseBoardDaten(skript.textContent);
    }

    function element(tag, klasse, text) {
        const el = document.createElement(tag);
        if (klasse) el.className = klasse;
        if (text !== undefined) el.textContent = text;
        return el;
    }

    // Knöpfe, die nach Personio führen, tragen Personio-Farbe und -Logo; die Beschriftung ist der letzte Kindknoten
    function knopfMitPersonioLogo(text) {
        const knopf = element('button', 'kfze-knopf kfze-knopf-personio');
        knopf.type = 'button';
        const logo = element('img', 'kfze-logo');
        logo.src = chrome.runtime.getURL('assets/logos/personio.svg');
        logo.alt = '';
        knopf.append(logo, document.createTextNode(text));
        return knopf;
    }

    function zeigeTag(inhalt, boardDaten, datum, jetzt) {
        const abschnitte = kf.tagesabschnitte(boardDaten, datum, jetzt);
        inhalt.replaceChildren(globalThis.KfVorschau.inhalt(abschnitte));
    }

    function zeigeDialog(boardDaten) {
        const jetzt = jetztLokal();
        const tage = kf.verfuegbareTage(boardDaten, jetzt);

        const hintergrund = element('div', 'kfze-hintergrund');
        const dialog = element('div', 'kfze-dialog');
        dialog.appendChild(element('h2', '', 'Zeitexport'));

        const inhalt = element('div');
        const status = element('p', 'kfze-hinweis');
        let uebernehmen = null;
        let beiSpeicheraenderung = null;
        if (tage.length === 0) {
            inhalt.textContent = 'Auf diesem Board sind keine eigenen Zeiten erfasst.';
        } else {
            const auswahl = element('select', 'kfze-auswahl');
            tage.forEach(datum => auswahl.appendChild(new Option(tagAnzeige(datum), datum)));
            dialog.appendChild(auswahl);
            zeigeTag(inhalt, boardDaten, tage[0], jetzt);

            uebernehmen = knopfMitPersonioLogo('Für Personio übernehmen');
            const beschriftung = uebernehmen.lastChild;

            // Ausgegraut, solange genau dieser Tag zur Übergabe bereitliegt; liegt ein anderer Tag bereit, warnen
            const zeigeUebergabeZustand = async () => {
                const { personioExport } = await chrome.storage.local.get('personioExport');
                const diesesTag = personioExport && personioExport.datum === auswahl.value;
                uebernehmen.disabled = Boolean(diesesTag);
                beschriftung.textContent = diesesTag ? 'Übernommen' : 'Für Personio übernehmen';
                if (diesesTag) {
                    status.className = 'kfze-info';
                    status.textContent = 'Liegt zur Übergabe bereit. Jetzt in Personio „Zeitexport einfügen" klicken.';
                } else if (personioExport) {
                    status.className = 'kfze-warnung';
                    status.textContent = 'Zur Übergabe liegt noch der ' + tagAnzeige(personioExport.datum) + ' bereit. Übernehmen ersetzt ihn.';
                } else {
                    status.className = 'kfze-hinweis';
                    status.textContent = '';
                }
            };

            auswahl.addEventListener('change', () => {
                zeigeTag(inhalt, boardDaten, auswahl.value, jetzt);
                zeigeUebergabeZustand();
            });
            uebernehmen.addEventListener('click', async () => {
                const abschnitte = kf.tagesabschnitte(boardDaten, auswahl.value, jetzt);
                await chrome.storage.local.set({ personioExport: globalThis.KfPersonioUmrechnung.personioExport(auswahl.value, abschnitte) });
            });
            beiSpeicheraenderung = (aenderungen, bereich) => {
                if (bereich === 'local' && 'personioExport' in aenderungen) zeigeUebergabeZustand();
            };
            chrome.storage.onChanged.addListener(beiSpeicheraenderung);
            zeigeUebergabeZustand();
        }
        dialog.appendChild(inhalt);
        dialog.appendChild(status);

        if (kf.hatManuelleEintraege(boardDaten)) {
            dialog.appendChild(element('p', 'kfze-hinweis', 'Manuell nachgetragene Zeiten sind vorhanden, werden aber noch nicht berücksichtigt.'));
        }
        dialog.appendChild(element('p', 'kfze-hinweis', 'Verfügbar sind nur die Tage, die KanbanFlow auf der Board-Seite mitliefert (derzeit die laufende Woche).'));

        const schliessen = element('button', 'kfze-knopf', 'Schließen');
        schliessen.type = 'button';
        const schliesseDialog = () => {
            hintergrund.remove();
            if (beiSpeicheraenderung) chrome.storage.onChanged.removeListener(beiSpeicheraenderung);
        };
        schliessen.addEventListener('click', schliesseDialog);
        const knoepfe = element('div', 'kfze-knoepfe');
        if (uebernehmen) knoepfe.appendChild(uebernehmen);
        knoepfe.appendChild(schliessen);
        dialog.appendChild(knoepfe);

        hintergrund.appendChild(dialog);
        hintergrund.addEventListener('click', e => { if (e.target === hintergrund) schliesseDialog(); });
        document.body.appendChild(hintergrund);
    }

    async function exportiere(knopf) {
        knopf.disabled = true;
        try {
            zeigeDialog(await ladeBoardDaten());
        } catch (fehler) {
            alert('Zeitexport: ' + fehler.message);
        } finally {
            knopf.disabled = false;
        }
    }

    // Neben den Timer in der Kopfleiste; ohne Kopfleiste unten rechts
    function platziere(knopf) {
        const timer = document.querySelector('.boardHeader-shortcutIcons .collapsedTimer');
        if (timer) {
            if (timer.nextElementSibling !== knopf) {
                knopf.className = 'kfze-knopf kfze-knopf-personio kfze-kopfknopf';
                timer.after(knopf);
            }
        } else if (!knopf.isConnected) {
            knopf.className = 'kfze-knopf kfze-knopf-personio kfze-export';
            document.body.appendChild(knopf);
        }
    }

    // Personio-Farbe und -Logo: der Knopf führt nach Personio
    const knopf = knopfMitPersonioLogo('Export');
    knopf.addEventListener('click', () => exportiere(knopf));
    platziere(knopf);
    new MutationObserver(() => platziere(knopf)).observe(document.body, { childList: true, subtree: true });
})();
