// Baut die Vorschau eines Tages: Zeitstrahlen IST (KanbanFlow) und SOLL (Personio) auf gemeinsamer
// Stundenachse, darunter die KanbanFlow-Tabelle und die bearbeitbare Personio-Tabelle.
// Genutzt vom Content-Script und von tests/faelle.html.
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

    function tabelleFuer(titel, letzteSpalte, bloecke, kachelKlasse) {
        const teil = element('div', 'kfze-teil kfze-kachel ' + kachelKlasse);
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
        teil.appendChild(summeFuer(bloecke));
        return teil;
    }

    function summeFuer(bloecke) {
        const summe = art => umrechnung.dauerOhneUeberlappung(bloecke, art);
        return element('p', 'kfze-summe', 'Arbeit ' + dauerAnzeige(summe('Arbeit')) + ' h · Pause ' + dauerAnzeige(summe('Pause')) + ' h');
    }

    function knopf(text, beiKlick, klasse) {
        const k = element('button', 'kfze-knopf kfze-knopf-klein' + (klasse ? ' ' + klasse : ''), text);
        k.type = 'button';
        k.addEventListener('click', beiKlick);
        return k;
    }

    function zeitfeld(minuten, beiAenderung) {
        const feld = element('input', 'kfze-zeitfeld');
        feld.type = 'time';
        feld.value = uhrzeit(minuten);
        feld.addEventListener('change', () => { if (feld.value) beiAenderung(umrechnung.alsMinuten(feld.value)); });
        return feld;
    }

    // Die SOLL-Tabelle zum Bearbeiten: je Zeile Art, Von, Bis, Dauer, Kommentar, Löschen.
    // Zeitänderungen gehen an beiZeit(feld, minuten), weil sie angrenzende Blöcke mitziehen können.
    // Die Zeile merkt sich ihre Felder (zeile.felder), damit Zeitänderungen ohne Neuzeichnen
    // nachgetragen werden können - Neuzeichnen nähme dem Feld unter dem Cursor den Fokus.
    // kommentareAktiv() sagt, ob Kommentare übertragen werden; sonst ist das Feld gesperrt.
    function sollZeile(b, beiAenderung, beiZeit, beiLoeschen, kommentareAktiv) {
        const zeile = element('tr', b.art === 'Pause' ? 'kfze-pause' : '');
        const dauer = element('td', '', dauerAnzeige(b.bis - b.von));
        const von = zeitfeld(b.von, m => beiZeit('von', m));
        const bis = zeitfeld(b.bis, m => beiZeit('bis', m));

        const art = element('select', 'kfze-artfeld');
        ['Arbeit', 'Pause'].forEach(a => art.appendChild(new Option(a, a, false, a === b.art)));
        const kommentar = element('input', 'kfze-kommentarfeld');
        kommentar.type = 'text';
        kommentar.value = b.text;
        const sperreKommentar = () => { kommentar.disabled = b.art === 'Pause' || !kommentareAktiv(); };
        sperreKommentar();
        zeile.felder = { von, bis, dauer, sperreKommentar };
        art.addEventListener('change', () => {
            b.art = art.value;
            zeile.className = b.art === 'Pause' ? 'kfze-pause' : '';
            sperreKommentar();
            beiAenderung();
        });
        kommentar.addEventListener('input', () => { b.text = kommentar.value; beiAenderung(); });

        const zelle = inhaltEl => { const td = element('td'); td.appendChild(inhaltEl); return td; };
        zeile.append(
            zelle(art),
            zelle(von),
            zelle(bis),
            dauer,
            zelle(kommentar),
            zelle(knopf('Löschen', beiLoeschen, 'kfze-knopf-leise')));
        return zeile;
    }

    function kommentarSchalter(an, beiUmschalten) {
        const haken = element('input');
        haken.type = 'checkbox';
        haken.checked = an;
        haken.addEventListener('change', () => beiUmschalten(haken.checked));
        const schalter = element('label', 'kfze-schalter');
        schalter.append(haken, document.createTextNode('Kommentare übertragen'));
        return schalter;
    }

    // Was an Personio geht: nach Beginn sortiert, Zeiten als HH:MM, Kommentar nur bei Arbeit
    function alsExportBloecke(soll) {
        return soll.slice().sort((a, b) => a.von - b.von)
            .map(b => ({ art: b.art, von: uhrzeit(b.von), bis: uhrzeit(b.bis), kommentar: b.art === 'Arbeit' ? b.text : '' }));
    }

    // beiAenderung (optional) erhält nach jeder Änderung { bloecke, verstoesse } - die bearbeiteten SOLL-Blöcke
    // im Übergabeformat und die Regelverstöße; ohne Verstöße darf übernommen werden.
    // kommentare (optional) { uebertragen, beiUmschalten(wert) } zeigt rechtsbündig in der Kopfzeile der
    // Personio-Kachel den Schalter "Kommentare übertragen"; aus heißt: Kommentarfelder gesperrt, Übergabe ohne Kommentare
    function inhalt(abschnitte, beiAenderung, kommentare) {
        const ist = istBloecke(abschnitte);
        let soll = personioBloecke(abschnitte);
        let kommentareUebertragen = kommentare ? kommentare.uebertragen : true;

        const el = element('div', 'kfze-vorschau');
        const strahlenPlatz = element('div');
        const sollTeil = element('div', 'kfze-teil kfze-kachel kfze-kachel-personio');
        const rumpf = element('tbody');
        const summenPlatz = element('div');
        const verstossPlatz = element('div');

        const zeigeStand = () => {
            strahlenPlatz.replaceChildren(strahlenFuer(ist, soll));
            summenPlatz.replaceChildren(summeFuer(soll));
            const verstoesse = umrechnung.regelverstoesse(soll);
            verstossPlatz.replaceChildren(...verstoesse.map(v => element('p', 'kfze-warnung', v)));
            const bloecke = alsExportBloecke(soll);
            if (beiAenderung) beiAenderung({ bloecke: kommentareUebertragen ? bloecke : umrechnung.ohneKommentare(bloecke), verstoesse });
        };
        const zeichneSoll = () => {
            rumpf.replaceChildren(...soll.map((b, index) => sollZeile(b, zeigeStand,
                (feld, minuten) => aendereZeit(index, feld, minuten),
                () => { soll = soll.filter(x => x !== b); zeichneSoll(); },
                () => kommentareUebertragen)));
            zeigeStand();
        };
        // Zeit geändert: Werte in die vorhandenen Blöcke übernehmen (Nachbar wandert mit) und nur die
        // Felder nachtragen, die sich geändert haben - das Feld unter dem Cursor bleibt unberührt
        const aendereZeit = (index, feld, minuten) => {
            const neu = umrechnung.verschiebeGrenze(soll, index, feld, minuten);
            soll.forEach((b, i) => { b.von = neu[i].von; b.bis = neu[i].bis; });
            [...rumpf.children].forEach((zeile, i) => {
                const { von, bis, dauer } = zeile.felder;
                if (document.activeElement !== von) von.value = uhrzeit(soll[i].von);
                if (document.activeElement !== bis) bis.value = uhrzeit(soll[i].bis);
                dauer.textContent = dauerAnzeige(soll[i].bis - soll[i].von);
            });
            zeigeStand();
        };
        const haengeAn = art => {
            const ende = soll.reduce((m, b) => Math.max(m, b.bis), 0) || 8 * 60;
            soll.push({ art, von: ende, bis: Math.min(ende + 30, 24 * 60 - 1), text: '', laeuft: false });
            zeichneSoll();
        };

        const tabelle = element('table', 'kfze-tabelle');
        const kopf = tabelle.createTHead().insertRow();
        ['Art', 'Von', 'Bis', 'Dauer', 'Kommentar', ''].forEach(t => kopf.appendChild(element('th', '', t)));
        tabelle.appendChild(rumpf);

        const werkzeuge = element('div', 'kfze-knoepfe');
        werkzeuge.append(
            knopf('+ Arbeit', () => haengeAn('Arbeit')),
            knopf('+ Pause', () => haengeAn('Pause')),
            knopf('Auto', () => { soll = personioBloecke(abschnitte); zeichneSoll(); }, 'kfze-knopf-auto'));
        werkzeuge.lastChild.title = 'Bearbeitungen verwerfen und die Zeiten neu aus KanbanFlow berechnen';

        const sollKopf = element('div', 'kfze-kachel-kopf');
        sollKopf.appendChild(element('h3', '', 'Personio'));
        if (kommentare) sollKopf.appendChild(kommentarSchalter(kommentareUebertragen, wert => {
            kommentareUebertragen = wert;
            [...rumpf.children].forEach(zeile => zeile.felder.sperreKommentar());
            zeigeStand();
            kommentare.beiUmschalten(wert);
        }));

        sollTeil.append(sollKopf, tabelle, werkzeuge, summenPlatz, verstossPlatz);
        el.append(strahlenPlatz, tabelleFuer('KanbanFlow', 'Aufgabe', ist, 'kfze-kachel-kanbanflow'), sollTeil);
        zeichneSoll();
        return el;
    }

    global.KfVorschau = { inhalt };
})(globalThis);
