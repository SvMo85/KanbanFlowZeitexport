// Baut die Vorschau eines Tages: Zeitstrahlen IST (KanbanFlow) und SOLL (Personio) auf gemeinsamer
// Stundenachse, darunter je eine Tabelle. Genutzt vom Content-Script und von tests/faelle.html.
(function (global) {
    'use strict';

    const strahl = global.KfZeitstrahl;
    const umrechnung = global.KfPersonioUmrechnung;

    function zweistellig(zahl) {
        return String(Math.abs(zahl)).padStart(2, '0');
    }

    function uhrzeit(minuten) {
        const ganz = Math.floor(minuten);
        return zweistellig(Math.floor(ganz / 60)) + ':' + zweistellig(ganz % 60);
    }

    function dauerAnzeige(minuten) {
        const ganz = Math.round(minuten);
        return Math.floor(ganz / 60) + ':' + zweistellig(ganz % 60);
    }

    function element(tag, klasse, text) {
        const el = document.createElement(tag);
        if (klasse) el.className = klasse;
        if (text !== undefined) el.textContent = text;
        return el;
    }

    function istBloecke(abschnitte) {
        return abschnitte.map(a => ({
            art: a.art,
            von: strahl.minutenSeitMitternacht(a.start),
            bis: strahl.minutenSeitMitternacht(a.ende),
            text: a.aufgabe,
            laeuft: a.laeuft
        }));
    }

    function personioBloecke(abschnitte) {
        return umrechnung.personioBloecke(abschnitte)
            .map(b => ({ art: b.art, von: b.von, bis: b.bis, text: umrechnung.kommentar(b), laeuft: false }));
    }

    function nameFuer(name, kuerzel, klasse, quelle) {
        const el = element('div', 'kfze-strahl-name', name);
        const badge = element('span', 'kfze-badge ' + klasse, kuerzel);
        badge.title = quelle;
        el.appendChild(badge);
        return el;
    }

    function spurFuer(bloecke, strahlRahmen) {
        const lage = strahl.zeitstrahl(bloecke, strahlRahmen);
        const spur = element('div', 'kfze-strahl-spur');
        lage.balken.forEach((b, index) => {
            const block = bloecke[index];
            const balken = element('div', 'kfze-strahl-balken ' + (b.art === 'Pause' ? 'kfze-strahl-pause' : 'kfze-strahl-arbeit'));
            balken.style.left = b.linksProzent + '%';
            balken.style.width = b.breiteProzent + '%';
            balken.title = block.art + ' ' + uhrzeit(block.von) + '–' + (block.laeuft ? 'läuft' : uhrzeit(block.bis)) + (block.text ? ' · ' + block.text : '');
            spur.appendChild(balken);
        });
        return spur;
    }

    function achseFuer(strahlRahmen) {
        const achse = element('div', 'kfze-strahl-achse');
        strahl.zeitstrahl([], strahlRahmen).stunden.forEach(s => {
            const marke = element('span', 'kfze-strahl-stunde', zweistellig(s.stunde));
            marke.style.left = s.linksProzent + '%';
            achse.appendChild(marke);
        });
        return achse;
    }

    // Beide Strahlen dicht untereinander, Name links davor, eine gemeinsame Stundenachse darunter
    function strahlenFuer(ist, soll) {
        const gemeinsamerRahmen = strahl.rahmen([ist, soll]);
        const el = element('div', 'kfze-strahlen');
        el.append(
            nameFuer('IST', 'KF', 'kfze-badge-kanbanflow', 'KanbanFlow'), spurFuer(ist, gemeinsamerRahmen),
            nameFuer('SOLL', 'P', 'kfze-badge-personio', 'Personio'), spurFuer(soll, gemeinsamerRahmen),
            element('div'), achseFuer(gemeinsamerRahmen));
        return el;
    }

    function tabelleFuer(titel, letzteSpalte, bloecke) {
        const teil = element('div', 'kfze-teil');
        teil.appendChild(element('h3', '', titel));

        const tabelle = element('table', 'kfze-tabelle');
        const kopf = tabelle.createTHead().insertRow();
        ['Art', 'Von', 'Bis', 'Dauer', letzteSpalte].forEach(t => kopf.appendChild(element('th', '', t)));
        const rumpf = tabelle.createTBody();
        bloecke.forEach(b => {
            const zeile = rumpf.insertRow();
            zeile.className = b.art === 'Pause' ? 'kfze-pause' : '';
            [b.art, uhrzeit(b.von), b.laeuft ? 'läuft' : uhrzeit(b.bis), dauerAnzeige(b.bis - b.von), b.text]
                .forEach(t => zeile.insertCell().textContent = t);
        });
        teil.appendChild(tabelle);

        const summe = art => bloecke.filter(b => b.art === art).reduce((s, b) => s + (b.bis - b.von), 0);
        teil.appendChild(element('p', 'kfze-summe', 'Arbeit ' + dauerAnzeige(summe('Arbeit')) + ' h · Pause ' + dauerAnzeige(summe('Pause')) + ' h'));
        return teil;
    }

    function inhalt(abschnitte) {
        const ist = istBloecke(abschnitte);
        const soll = personioBloecke(abschnitte);

        const el = element('div', 'kfze-vorschau');
        el.appendChild(strahlenFuer(ist, soll));
        el.appendChild(tabelleFuer('KanbanFlow', 'Aufgabe', ist));
        el.appendChild(tabelleFuer('Personio', 'Kommentar', soll));
        return el;
    }

    global.KfVorschau = { inhalt };
})(globalThis);
