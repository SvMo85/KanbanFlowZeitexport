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

    function uhrzeit(zeitstempelLokal) {
        return zeitstempelLokal.slice(11, 16);
    }

    function dauerAnzeige(minuten) {
        return Math.floor(minuten / 60) + ':' + zweistellig(minuten % 60);
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

    function tabelleFuer(abschnitte) {
        const tabelle = element('table', 'kfze-tabelle');
        const kopf = tabelle.createTHead().insertRow();
        ['Art', 'Von', 'Bis', 'Dauer', 'Aufgabe'].forEach(t => kopf.appendChild(element('th', '', t)));
        const rumpf = tabelle.createTBody();
        abschnitte.forEach(a => {
            const zeile = rumpf.insertRow();
            zeile.className = a.art === 'Pause' ? 'kfze-pause' : '';
            [a.art, uhrzeit(a.start), a.laeuft ? 'läuft' : uhrzeit(a.ende), dauerAnzeige(kf.dauerInMinuten(a)), a.aufgabe]
                .forEach(t => zeile.insertCell().textContent = t);
        });
        return tabelle;
    }

    function zeitstrahlFuer(abschnitte) {
        const strahl = globalThis.KfZeitstrahl.zeitstrahl(abschnitte);
        const rahmen = element('div', 'kfze-strahl');
        rahmen.appendChild(element('div', 'kfze-strahl-titel', 'IST (KanbanFlow)'));

        const spur = element('div', 'kfze-strahl-spur');
        strahl.balken.forEach((b, index) => {
            const a = abschnitte[index];
            const balken = element('div', 'kfze-strahl-balken');
            balken.classList.add(b.art === 'Pause' ? 'kfze-strahl-pause' : 'kfze-strahl-arbeit');
            balken.style.left = b.linksProzent + '%';
            balken.style.width = b.breiteProzent + '%';
            balken.title = a.art + ' ' + uhrzeit(a.start) + '–' + (a.laeuft ? 'läuft' : uhrzeit(a.ende)) + (a.aufgabe ? ' · ' + a.aufgabe : '');
            spur.appendChild(balken);
        });
        rahmen.appendChild(spur);

        const achse = element('div', 'kfze-strahl-achse');
        strahl.stunden.forEach(s => {
            const marke = element('span', 'kfze-strahl-stunde', zweistellig(s.stunde));
            marke.style.left = s.linksProzent + '%';
            achse.appendChild(marke);
        });
        rahmen.appendChild(achse);
        return rahmen;
    }

    function summenFuer(abschnitte) {
        const summe = art => abschnitte.filter(a => a.art === art).reduce((s, a) => s + kf.dauerInMinuten(a), 0);
        return element('p', 'kfze-summe', 'Arbeit ' + dauerAnzeige(summe('Arbeit')) + ' h · Pause ' + dauerAnzeige(summe('Pause')) + ' h');
    }

    function zeigeTag(inhalt, boardDaten, datum, jetzt) {
        const abschnitte = kf.tagesabschnitte(boardDaten, datum, jetzt);
        inhalt.replaceChildren(zeitstrahlFuer(abschnitte), tabelleFuer(abschnitte), summenFuer(abschnitte));
    }

    function zeigeDialog(boardDaten) {
        const jetzt = jetztLokal();
        const tage = kf.verfuegbareTage(boardDaten, jetzt);

        const hintergrund = element('div', 'kfze-hintergrund');
        const dialog = element('div', 'kfze-dialog');
        dialog.appendChild(element('h2', '', 'Zeitexport'));

        const inhalt = element('div');
        if (tage.length === 0) {
            inhalt.textContent = 'Auf diesem Board sind keine eigenen Zeiten erfasst.';
        } else {
            const auswahl = element('select', 'kfze-auswahl');
            tage.forEach(datum => auswahl.appendChild(new Option(tagAnzeige(datum), datum)));
            auswahl.addEventListener('change', () => zeigeTag(inhalt, boardDaten, auswahl.value, jetzt));
            dialog.appendChild(auswahl);
            zeigeTag(inhalt, boardDaten, tage[0], jetzt);
        }
        dialog.appendChild(inhalt);

        if (kf.hatManuelleEintraege(boardDaten)) {
            dialog.appendChild(element('p', 'kfze-hinweis', 'Manuell nachgetragene Zeiten sind vorhanden, werden aber noch nicht berücksichtigt.'));
        }
        dialog.appendChild(element('p', 'kfze-hinweis', 'Verfügbar sind nur die Tage, die KanbanFlow auf der Board-Seite mitliefert (derzeit die laufende Woche).'));

        const schliessen = element('button', 'kfze-knopf', 'Schließen');
        schliessen.type = 'button';
        schliessen.addEventListener('click', () => hintergrund.remove());
        dialog.appendChild(schliessen);

        hintergrund.appendChild(dialog);
        hintergrund.addEventListener('click', e => { if (e.target === hintergrund) hintergrund.remove(); });
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
                knopf.className = 'kfze-knopf kfze-kopfknopf';
                timer.after(knopf);
            }
        } else if (!knopf.isConnected) {
            knopf.className = 'kfze-knopf kfze-export';
            document.body.appendChild(knopf);
        }
    }

    const knopf = element('button', '', 'Export');
    knopf.type = 'button';
    knopf.addEventListener('click', () => exportiere(knopf));
    platziere(knopf);
    new MutationObserver(() => platziere(knopf)).observe(document.body, { childList: true, subtree: true });
})();
