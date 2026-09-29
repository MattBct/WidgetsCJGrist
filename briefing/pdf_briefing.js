// ---------- PDF du briefing ----------
// PDF unique généré avec pdf-lib, pour les personnes n'ayant pas accès à Grist :
// - occupation des salles (grille heures × salles, cartes RDV) ;
// - feuille d'émargement avec de vrais champs de formulaire (cases à cocher, boutons radio, zones de texte)
//   remplissables dans Acrobat Reader, Aperçu, le lecteur PDF du navigateur…
// Utilise les données préparées par script.js.

const PDF_POLICES_URL = 'https://cdn.jsdelivr.net/npm/@fontsource/montserrat@5.2.8/files/montserrat-latin-';
const PDF_POLICES = { regular: '400-normal', bold: '700-normal', extraBold: '800-normal', italique: '400-italic' };

const MM = 72 / 25.4;
const PDF_PAGE = { largeur: 595.28, hauteur: 841.89, marge: 10 * MM, margeBas: 14 * MM };
const PDF_LARGEUR_UTILE = PDF_PAGE.largeur - 2 * PDF_PAGE.marge;
// Mêmes proportions que le tableau d'émargement HTML : heure/salle, RDV, cliniciens, patient, motif/notes
const PDF_COLONNES = [0.12, 0.18, 0.30, 0.11, 0.29];
const PDF_TITRES_COLONNES = ['Heure / salle', 'RDV', 'Cliniciens présents', 'Patient', 'Motif, commentaires / notes'];
const PDF_PADDING = 5;
const PDF_LIGNE_CLINICIEN = 15;
const PDF_HAUTEUR_ENTETE_TABLEAU = 18;
const PDF_HAUTEUR_NOTES_MIN = 30;
const PDF_LARGEUR_COL_HEURE = 40;
const PDF_MOTIF_LIGNES_MAX = 4;

const PDF_COULEURS = {
    clinique: '#C03737',
    cliniqueFonce: '#8E2626',
    rdv1: '#F6DFDF',
    rdv2: '#DB8080',
    texte: '#1D1D1D',
    doux: '#5F5F5F',
    bordure: '#D9D9D9',
    fondDoux: '#F5F5F5',
    champ: '#FBF3F3',
    hachures: '#EEEEEE',
    alerteFond: '#FFF3CD',
    alerteTexte: '#7A5B00',
    blanc: '#FFFFFF',
};

function pdfCouleur(hex) {
    const n = parseInt(hex.slice(1), 16);
    return PDFLib.rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255);
}

// Les coordonnées sont manipulées de haut en bas (comme en HTML) puis converties pour pdf-lib (origine en bas à gauche)
function pdfY(y) {
    return PDF_PAGE.hauteur - y;
}

// ---------- Polices ----------

// Montserrat n'est publié sur le CDN qu'en WOFF : pdf-lib doit recevoir un TTF pour intégrer la police complète
// (et non un sous-ensemble), ce qui permet d'écrire dans les champs avec n'importe quel caractère de la police.
async function woffVersTtf(woff) {
    const source = new DataView(woff);
    if (source.getUint32(0) !== 0x774F4646) { // signature "wOFF"
        return woff;
    }
    const nbTables = source.getUint16(12);
    const tables = [];
    for (let i = 0; i < nbTables; i++) {
        const entree = 44 + i * 20;
        const offset = source.getUint32(entree + 4);
        const longueurCompressee = source.getUint32(entree + 8);
        const longueur = source.getUint32(entree + 12);
        let donnees = new Uint8Array(woff, offset, longueurCompressee);
        if (longueurCompressee < longueur) {
            const flux = new Blob([donnees]).stream().pipeThrough(new DecompressionStream('deflate'));
            donnees = new Uint8Array(await new Response(flux).arrayBuffer());
        }
        tables.push({ tag: source.getUint32(entree), checksum: source.getUint32(entree + 16), donnees });
    }

    const tailleEntete = 12 + 16 * nbTables;
    const aligner = n => (n + 3) & ~3;
    const ttf = new Uint8Array(tailleEntete + tables.reduce((total, table) => total + aligner(table.donnees.length), 0));
    const sortie = new DataView(ttf.buffer);
    const puissance = 2 ** Math.floor(Math.log2(nbTables));
    sortie.setUint32(0, source.getUint32(4)); // flavor (TrueType / CFF)
    sortie.setUint16(4, nbTables);
    sortie.setUint16(6, puissance * 16);
    sortie.setUint16(8, Math.log2(puissance));
    sortie.setUint16(10, nbTables * 16 - puissance * 16);

    let position = tailleEntete;
    tables.forEach((table, i) => {
        const entree = 12 + i * 16;
        sortie.setUint32(entree, table.tag);
        sortie.setUint32(entree + 4, table.checksum);
        sortie.setUint32(entree + 8, position);
        sortie.setUint32(entree + 12, table.donnees.length);
        ttf.set(table.donnees, position);
        position += aligner(table.donnees.length);
    });
    return ttf.buffer;
}

async function chargerPolicesPdf(doc) {
    try {
        doc.registerFontkit(window.fontkit);
        const polices = await Promise.all(Object.entries(PDF_POLICES).map(async ([cle, fichier]) => {
            const reponse = await fetch(`${PDF_POLICES_URL}${fichier}.woff`);
            if (!reponse.ok) {
                throw new Error(`Police ${fichier} : HTTP ${reponse.status}`);
            }
            const ttf = await woffVersTtf(await reponse.arrayBuffer());
            // Ligatures désactivées : la ligature "fi" de Montserrat laisse un blanc parasite ("fi chier")
            return [cle, await doc.embedFont(ttf, { subset: false, features: { liga: false, clig: false } })];
        }));
        return Object.fromEntries(polices);
    } catch (e) {
        console.warn('Montserrat indisponible, repli sur Helvetica :', e);
        const { StandardFonts } = PDFLib;
        return {
            regular: await doc.embedFont(StandardFonts.Helvetica),
            bold: await doc.embedFont(StandardFonts.HelveticaBold),
            extraBold: await doc.embedFont(StandardFonts.HelveticaBold),
            italique: await doc.embedFont(StandardFonts.HelveticaOblique),
        };
    }
}

// ---------- Texte ----------

// Remplace les caractères absents de la police (ex. lettres accentuées rares, emojis) par leur lettre de base ou "?"
const jeuxCaracteres = new WeakMap();
function pdfTexte(police, texte) {
    if (!jeuxCaracteres.has(police)) {
        jeuxCaracteres.set(police, new Set(police.getCharacterSet()));
    }
    const jeu = jeuxCaracteres.get(police);
    return [...String(texte ?? '')].map(c => {
        if (jeu.has(c.codePointAt(0))) {
            return c;
        }
        const base = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
        if (base && [...base].every(b => jeu.has(b.codePointAt(0)))) {
            return base;
        }
        return /\s/.test(c) ? ' ' : '?';
    }).join('');
}

// Découpe un texte en lignes tenant dans la largeur donnée ; tronque avec "…" au-delà de maxLignes
function pdfLignes(texte, police, taille, largeur, maxLignes = Infinity) {
    const mesure = t => police.widthOfTextAtSize(t, taille);
    const lignes = [];
    String(texte ?? '').split(/\r?\n/).forEach(paragraphe => {
        let ligne = '';
        pdfTexte(police, paragraphe).split(/\s+/).filter(Boolean).forEach(mot => {
            while (mesure(mot) > largeur && mot.length > 1) { // mot plus long que la ligne : coupé
                let n = mot.length - 1;
                while (n > 1 && mesure(mot.slice(0, n)) > largeur) {
                    n--;
                }
                if (ligne) {
                    lignes.push(ligne);
                    ligne = '';
                }
                lignes.push(mot.slice(0, n));
                mot = mot.slice(n);
            }
            const essai = ligne ? `${ligne} ${mot}` : mot;
            if (mesure(essai) <= largeur) {
                ligne = essai;
            } else {
                lignes.push(ligne);
                ligne = mot;
            }
        });
        lignes.push(ligne);
    });
    while (lignes.length > 1 && !lignes[lignes.length - 1]) {
        lignes.pop();
    }
    if (lignes.length <= maxLignes) {
        return lignes;
    }
    const tronquees = lignes.slice(0, maxLignes);
    const points = pdfTexte(police, '…');
    let derniere = tronquees[maxLignes - 1];
    while (derniere && mesure(derniere + points) > largeur) {
        derniere = derniere.slice(0, -1);
    }
    tronquees[maxLignes - 1] = derniere.trimEnd() + points;
    return tronquees;
}

// Tronque une ligne unique avec "…" si elle dépasse la largeur
function pdfLigneTronquee(texte, police, taille, largeur) {
    return pdfLignes(String(texte ?? '').replace(/\s+/g, ' '), police, taille, largeur, 1)[0] || '';
}

function pdfEcrire(page, texte, x, yHaut, police, taille, couleur = PDF_COULEURS.texte) {
    if (!texte) {
        return;
    }
    page.drawText(pdfTexte(police, texte), { x, y: pdfY(yHaut + taille * 0.8), size: taille, font: police, color: pdfCouleur(couleur) });
}

// Rectangle arrondi (pastilles, bandeau)
function pdfRectangleArrondi(page, x, yHaut, largeur, hauteur, rayon, options) {
    const r = Math.min(rayon, hauteur / 2, largeur / 2);
    const chemin = `M ${r} 0 H ${largeur - r} A ${r} ${r} 0 0 1 ${largeur} ${r} V ${hauteur - r} A ${r} ${r} 0 0 1 ${largeur - r} ${hauteur}`
        + ` H ${r} A ${r} ${r} 0 0 1 0 ${hauteur - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    page.drawSvgPath(chemin, {
        x,
        y: pdfY(yHaut),
        color: options.fond ? pdfCouleur(options.fond) : undefined,
        borderColor: options.bordure ? pdfCouleur(options.bordure) : undefined,
        borderWidth: options.bordure ? (options.epaisseur ?? 0.8) : 0,
    });
}

function pdfLignePointillee(page, x1, x2, y) {
    page.drawLine({ start: { x: x1, y: pdfY(y) }, end: { x: x2, y: pdfY(y) }, thickness: 0.5, color: pdfCouleur('#8A8A8A'), dashArray: [1, 1.5] });
}

// Pastilles (badges RDV, motifs standardisés) disposées sur plusieurs lignes si besoin.
// Retourne les positions calculées et la hauteur totale, pour mesurer avant de dessiner.
function pdfDisposerPastilles(pastilles, police, taille, largeurMax) {
    const hauteur = taille + 4;
    const ecart = 3;
    const positions = [];
    let x = 0;
    let y = 0;
    pastilles.forEach(pastille => {
        const texte = pdfLigneTronquee(pastille.texte, police, taille, largeurMax - 10);
        const largeur = police.widthOfTextAtSize(texte, taille) + 10;
        if (x > 0 && x + largeur > largeurMax) {
            x = 0;
            y += hauteur + ecart;
        }
        positions.push({ ...pastille, texte, x, y, largeur, hauteur });
        x += largeur + ecart;
    });
    return { positions, hauteur: pastilles.length > 0 ? y + hauteur : 0 };
}

function pdfDessinerPastilles(page, disposition, x, yHaut, police, taille) {
    disposition.positions.forEach(p => {
        pdfRectangleArrondi(page, x + p.x, yHaut + p.y, p.largeur, p.hauteur, p.hauteur / 2, { fond: p.fond, bordure: p.bordure });
        pdfEcrire(page, p.texte, x + p.x + 5, yHaut + p.y + 2.2, police, taille, p.couleur);
    });
}

// ---------- Mise en page d'une ligne d'émargement ----------

function pdfColonnes() {
    let x = PDF_PAGE.marge;
    return PDF_COLONNES.map(part => {
        const colonne = { x, largeur: PDF_LARGEUR_UTILE * part };
        x += colonne.largeur;
        return colonne;
    });
}

// Prépare le contenu d'une ligne (textes découpés, pastilles) et calcule sa hauteur
function pdfPreparerLigne(rdv, polices, colonnes, motifComplet) {
    const interieur = i => colonnes[i].largeur - 2 * PDF_PADDING;

    const salle = pdfLignes(rdv.salle.libelle, polices.regular, 7, interieur(0));
    const hauteurHoraire = 12 + 2 + salle.length * 9;

    const badges = pdfDisposerPastilles([
        { texte: rdv.creneau.badge, fond: PDF_COULEURS.blanc, bordure: PDF_COULEURS.bordure, couleur: PDF_COULEURS.cliniqueFonce },
        ...(rdv.visio ? [{ texte: 'Visio', fond: PDF_COULEURS.texte, couleur: PDF_COULEURS.blanc }] : []),
    ], polices.bold, 6.5, interieur(1));
    const patient = pdfLignes(`${rdv.nom} ${rdv.prenom}`.trim(), polices.bold, 8, interieur(1));
    const motifs = pdfDisposerPastilles(
        rdv.motifsStandardises.map(motif => ({ texte: motif, bordure: PDF_COULEURS.cliniqueFonce, couleur: PDF_COULEURS.cliniqueFonce })),
        polices.bold, 6.5, interieur(1));
    const hauteurRdv = 13 + 3 + badges.hauteur + 3 + patient.length * 10 + 3 + (motifs.hauteur || 9);

    const nbLignesCliniciens = Math.max(NB_LIGNES_CLINICIENS_MIN, rdv.cliniciens.length);
    const hauteurCliniciens = (rdv.cliniciens.length === 0 ? 10 : 0) + nbLignesCliniciens * PDF_LIGNE_CLINICIEN;

    const hauteurPatient = 2 * PDF_LIGNE_CLINICIEN + 16;

    const maxLignesMotif = motifComplet ? 30 : PDF_MOTIF_LIGNES_MAX;
    const blocs = [
        { titre: 'Motif détaillé', lignes: rdv.motif ? pdfLignes(rdv.motif, polices.italique, 7.5, interieur(4) - 6, maxLignesMotif) : ['Non renseigné'] },
        ...(rdv.commentaires ? [{ titre: 'Commentaire', lignes: pdfLignes(rdv.commentaires, polices.italique, 7.5, interieur(4) - 6, maxLignesMotif) }] : []),
    ].map(bloc => ({ ...bloc, hauteur: 3 + 8 + bloc.lignes.length * 9.5 + 3 }));
    const hauteurBlocs = blocs.reduce((total, bloc) => total + bloc.hauteur + 3, 0);
    const hauteurNotes = hauteurBlocs + 9 + PDF_HAUTEUR_NOTES_MIN;

    const hauteur = 2 * PDF_PADDING + Math.max(hauteurHoraire, hauteurRdv, hauteurCliniciens, hauteurPatient, hauteurNotes);
    return { salle, badges, patient, motifs, blocs, hauteurBlocs, hauteur };
}

function pdfDessinerLigne(ctx, rdv, prep, yHaut, index) {
    const { page, polices, form, colonnes } = ctx;
    const { hauteur } = prep;
    const pad = PDF_PADDING;
    const nomChamp = `R${String(index + 1).padStart(2, '0')}_${rdv.identifiant || 'RDV'}_${rdv.creneau.badge}`.replace(/[^A-Za-z0-9]+/g, '_');
    const blanc = pdfCouleur(PDF_COULEURS.blanc);
    const bordureChamp = pdfCouleur('#8A8A8A');
    const fondChamp = pdfCouleur(PDF_COULEURS.champ);

    // Cellules : fond de la colonne horaire, liseré couleur du RDV, bordures
    page.drawRectangle({ x: colonnes[0].x, y: pdfY(yHaut + hauteur), width: colonnes[0].largeur, height: hauteur, color: pdfCouleur(PDF_COULEURS.fondDoux) });
    page.drawRectangle({ x: colonnes[1].x, y: pdfY(yHaut + hauteur), width: 4, height: hauteur, color: pdfCouleur(rdv.creneau.ordre === 2 ? PDF_COULEURS.rdv2 : PDF_COULEURS.rdv1) });
    colonnes.forEach(c => page.drawRectangle({
        x: c.x, y: pdfY(yHaut + hauteur), width: c.largeur, height: hauteur,
        borderColor: pdfCouleur(PDF_COULEURS.bordure), borderWidth: 0.6,
    }));

    // 1. Heure / salle
    let x = colonnes[0].x + pad;
    let y = yHaut + pad;
    pdfEcrire(page, rdv.horaire, x, y, polices.extraBold, 10);
    y += 14;
    prep.salle.forEach(ligne => {
        pdfEcrire(page, ligne, x, y, polices.regular, 7, PDF_COULEURS.doux);
        y += 9;
    });

    // 2. RDV : identifiant, badges, patient, motifs standardisés
    x = colonnes[1].x + pad + 2;
    y = yHaut + pad;
    pdfEcrire(page, rdv.identifiant || '—', x, y, polices.extraBold, 10.5);
    y += 16;
    pdfDessinerPastilles(page, prep.badges, x, y, polices.bold, 6.5);
    y += prep.badges.hauteur + 3;
    prep.patient.forEach(ligne => {
        pdfEcrire(page, ligne, x, y, polices.bold, 8);
        y += 10;
    });
    y += 3;
    if (prep.motifs.positions.length > 0) {
        pdfDessinerPastilles(page, prep.motifs, x, y, polices.bold, 6.5);
    } else {
        pdfEcrire(page, 'Motif non qualifié', x, y, polices.italique, 7, PDF_COULEURS.doux);
    }

    // 3. Cliniciens : une case par clinicien inscrit, complétée par des lignes à remplir
    const cliniciens = colonnes[2];
    x = cliniciens.x + pad;
    y = yHaut + pad;
    if (rdv.cliniciens.length === 0) {
        pdfEcrire(page, 'Non renseignés', x, y, polices.italique, 7, PDF_COULEURS.doux);
        y += 10;
    }
    const nbLignes = Math.max(NB_LIGNES_CLINICIENS_MIN, rdv.cliniciens.length);
    for (let j = 0; j < nbLignes; j++) {
        const clinicien = rdv.cliniciens[j];
        const haut = y + j * PDF_LIGNE_CLINICIEN;
        const caseCochee = form.createCheckBox(`${nomChamp}_clinicien_${j + 1}_present`);
        caseCochee.addToPage(page, { x, y: pdfY(haut + 11), width: 9, height: 9, borderColor: bordureChamp, borderWidth: 0.8, backgroundColor: blanc });
        const xTexte = x + 13;
        const largeurTexte = cliniciens.x + cliniciens.largeur - pad - xTexte;
        if (clinicien) {
            const telephone = clinicien.telephone ? pdfTexte(polices.regular, `Tél. ${clinicien.telephone}`) : '';
            const largeurTel = telephone ? polices.regular.widthOfTextAtSize(telephone, 6.5) : 0;
            pdfEcrire(page, pdfLigneTronquee(clinicien.nom, polices.regular, 8, largeurTexte - largeurTel - 4), xTexte, haut + 2.5, polices.regular, 8);
            pdfEcrire(page, telephone, cliniciens.x + cliniciens.largeur - pad - largeurTel, haut + 3.5, polices.regular, 6.5, PDF_COULEURS.doux);
        } else {
            const champNom = form.createTextField(`${nomChamp}_clinicien_${j + 1}_nom`);
            champNom.addToPage(page, { x: xTexte, y: pdfY(haut + 12), width: largeurTexte, height: 11, font: polices.regular, backgroundColor: fondChamp, borderWidth: 0 });
            champNom.setFontSize(8);
            pdfLignePointillee(page, xTexte, xTexte + largeurTexte, haut + 12.5);
        }
    }

    // 4. Patient : arrivé / absent (choix exclusif) et heure d'arrivée
    const patient = colonnes[3];
    x = patient.x + pad;
    y = yHaut + pad;
    const presence = form.createRadioGroup(`${nomChamp}_patient`);
    [['Arrive', 'Arrivé'], ['Absent', 'Absent']].forEach(([valeur, libelle], k) => {
        const haut = y + k * PDF_LIGNE_CLINICIEN;
        presence.addOptionToPage(valeur, page, { x, y: pdfY(haut + 11), width: 9, height: 9, borderColor: bordureChamp, borderWidth: 0.8, backgroundColor: blanc });
        pdfEcrire(page, libelle, x + 13, haut + 2.5, polices.regular, 8);
    });
    y += 2 * PDF_LIGNE_CLINICIEN + 2;
    pdfEcrire(page, 'à', x, y + 2, polices.regular, 8);
    const champHeure = form.createTextField(`${nomChamp}_heure_arrivee`);
    const largeurHeure = patient.x + patient.largeur - pad - (x + 9);
    // La taille de police se fixe après addToPage (pdf-lib crée l'apparence par défaut à ce moment-là)
    champHeure.addToPage(page, { x: x + 9, y: pdfY(y + 12), width: largeurHeure, height: 12, font: polices.regular, backgroundColor: fondChamp, borderWidth: 0 });
    champHeure.setFontSize(8);
    pdfLignePointillee(page, x + 9, x + 9 + largeurHeure, y + 12.5);

    // 5. Motif détaillé, commentaire Grist, puis zone de notes libre
    const notes = colonnes[4];
    x = notes.x + pad;
    y = yHaut + pad;
    const largeurNotes = notes.largeur - 2 * pad;
    prep.blocs.forEach(bloc => {
        page.drawRectangle({ x, y: pdfY(y + bloc.hauteur), width: largeurNotes, height: bloc.hauteur, color: pdfCouleur(PDF_COULEURS.fondDoux) });
        page.drawRectangle({ x, y: pdfY(y + bloc.hauteur), width: 2, height: bloc.hauteur, color: pdfCouleur(PDF_COULEURS.bordure) });
        pdfEcrire(page, bloc.titre.toUpperCase(), x + 6, y + 3, polices.bold, 5.5, PDF_COULEURS.doux);
        bloc.lignes.forEach((ligne, k) => pdfEcrire(page, ligne, x + 6, y + 11 + k * 9.5, polices.italique, 7.5));
        y += bloc.hauteur + 3;
    });
    pdfEcrire(page, 'NOTES', x, y + 1, polices.bold, 5.5, PDF_COULEURS.doux);
    y += 8;
    const champNotes = form.createTextField(`${nomChamp}_notes`);
    champNotes.enableMultiline();
    champNotes.addToPage(page, {
        x, y: pdfY(yHaut + hauteur - pad), width: largeurNotes, height: yHaut + hauteur - pad - y,
        font: polices.regular, backgroundColor: fondChamp, borderColor: pdfCouleur(PDF_COULEURS.bordure), borderWidth: 0.5,
    });
    champNotes.setFontSize(8);
}

// ---------- Occupation des salles ----------

// Icône caméra (visioconférence), dessinée en vectoriel
function pdfIconeVisio(page, x, yHaut, taille, couleur) {
    const echelle = taille / 24;
    page.drawSvgPath('M 4 6 H 14 A 2 2 0 0 1 16 8 V 16 A 2 2 0 0 1 14 18 H 4 A 2 2 0 0 1 2 16 V 8 A 2 2 0 0 1 4 6 Z M 16 10.5 L 22 7 V 17 L 16 13.5 Z',
        { x, y: pdfY(yHaut), scale: echelle, color: pdfCouleur(couleur) });
}

// Hachures des créneaux libres (tracées dans une zone de découpe pour ne pas déborder de la cellule)
function pdfHachures(page, x, yHaut, largeur, hauteur) {
    const { pushGraphicsState, popGraphicsState, rectangle, clip, endPath } = PDFLib;
    page.pushOperators(pushGraphicsState(), rectangle(x, pdfY(yHaut + hauteur), largeur, hauteur), clip(), endPath());
    for (let d = -hauteur; d < largeur; d += 7) {
        page.drawLine({ start: { x: x + d, y: pdfY(yHaut + hauteur) }, end: { x: x + d + hauteur, y: pdfY(yHaut) }, thickness: 1.5, color: pdfCouleur(PDF_COULEURS.hachures) });
    }
    page.pushOperators(popGraphicsState());
}

// Adresse mail d'une carte : réduite si besoin pour tenir sur une ligne, sinon coupée après "@" ou un point
function pdfLignesMail(mail, police, largeur) {
    const texte = pdfTexte(police, mail);
    for (const taille of [7, 6.3]) {
        if (police.widthOfTextAtSize(texte, taille) <= largeur) {
            return [{ texte, taille }];
        }
    }
    const lignes = [];
    let ligne = '';
    texte.split(/(?<=[@.])/).forEach(segment => {
        if (ligne && police.widthOfTextAtSize(ligne + segment, 6.3) > largeur) {
            lignes.push(ligne);
            ligne = '';
        }
        ligne += segment;
    });
    lignes.push(ligne);
    // Un segment encore trop long (sans "@" ni point) est découpé par pdfLignes
    return lignes.flatMap(l => pdfLignes(l, police, 6.3, largeur)).map(l => ({ texte: l, taille: 6.3 }));
}

// Carte RDV de la grille : identifiant, badge, patient, coordonnées, motifs standardisés
function pdfPreparerCarte(rdv, polices, largeur) {
    const interieur = largeur - 3 - 2 * 4;
    const badge = pdfDisposerPastilles([{ texte: rdv.creneau.badge, fond: PDF_COULEURS.blanc, couleur: PDF_COULEURS.cliniqueFonce }], polices.bold, 6, interieur);
    const largeurBadge = badge.positions[0].largeur;
    const identifiant = pdfLigneTronquee(rdv.identifiant || '—', polices.extraBold, 9.5, interieur - largeurBadge - 4);
    const patient = pdfLignes(`${rdv.nom} ${rdv.prenom}`.trim(), polices.bold, 7.5, interieur);
    const contact = [
        ...(rdv.telephone ? pdfLignes(`Tél. ${rdv.telephone}`, polices.regular, 7, interieur).map(texte => ({ texte, taille: 7 })) : []),
        ...(rdv.mail ? pdfLignesMail(rdv.mail, polices.regular, interieur) : []),
    ];
    const motifs = pdfDisposerPastilles(
        rdv.motifsStandardises.map(motif => ({ texte: motif, bordure: PDF_COULEURS.cliniqueFonce, couleur: PDF_COULEURS.cliniqueFonce })),
        polices.bold, 6, interieur);
    const hauteur = 4 + (rdv.visio ? 12 : 0) + 12 + patient.length * 9.5 + contact.length * 9 + 4 + (motifs.hauteur || 9) + 4;
    return { rdv, badge, largeurBadge, identifiant, patient, contact, motifs, hauteur };
}

function pdfDessinerCarte(page, polices, carte, x, yHaut, largeur) {
    const { rdv, hauteur } = carte;
    const second = rdv.creneau.ordre === 2;
    page.drawRectangle({ x, y: pdfY(yHaut + hauteur), width: largeur, height: hauteur, color: pdfCouleur(second ? PDF_COULEURS.rdv2 : PDF_COULEURS.rdv1) });
    page.drawRectangle({ x, y: pdfY(yHaut + hauteur), width: 3, height: hauteur, color: pdfCouleur(second ? PDF_COULEURS.cliniqueFonce : PDF_COULEURS.clinique) });

    const xTexte = x + 3 + 4;
    let y = yHaut;
    if (rdv.visio) {
        page.drawRectangle({ x, y: pdfY(y + 10), width: largeur, height: 10, color: pdfCouleur(PDF_COULEURS.texte) });
        pdfIconeVisio(page, xTexte, y + 1, 8, PDF_COULEURS.blanc);
        pdfEcrire(page, 'VISIOCONFÉRENCE', xTexte + 10, y + 2.3, polices.extraBold, 5.5, PDF_COULEURS.blanc);
        page.drawRectangle({ x, y: pdfY(yHaut + hauteur), width: largeur, height: hauteur, borderColor: pdfCouleur(PDF_COULEURS.texte), borderWidth: 0.8, borderDashArray: [2, 1.5] });
        y += 12;
    }
    y += 4;
    pdfEcrire(page, carte.identifiant, xTexte, y, polices.extraBold, 9.5);
    pdfDessinerPastilles(page, carte.badge, x + largeur - 4 - carte.largeurBadge, y + 0.5, polices.bold, 6);
    y += 12;
    carte.patient.forEach(ligne => {
        pdfEcrire(page, ligne, xTexte, y, polices.bold, 7.5);
        y += 9.5;
    });
    carte.contact.forEach(ligne => {
        pdfEcrire(page, ligne.texte, xTexte, y, polices.regular, ligne.taille, '#333333');
        y += 9;
    });
    y += 1.5;
    page.drawLine({ start: { x: xTexte, y: pdfY(y) }, end: { x: x + largeur - 4, y: pdfY(y) }, thickness: 0.5, color: pdfCouleur('#B9A0A0'), dashArray: [2, 1.5] });
    y += 2.5;
    if (carte.motifs.positions.length > 0) {
        pdfDessinerPastilles(page, carte.motifs, xTexte, y, polices.bold, 6);
    } else {
        pdfEcrire(page, 'Motif non qualifié', xTexte, y + 1, polices.italique, 6.5, PDF_COULEURS.doux);
    }
}

function pdfColonnesOccupation(salles) {
    const largeurSalle = (PDF_LARGEUR_UTILE - PDF_LARGEUR_COL_HEURE) / salles.length;
    return [
        { x: PDF_PAGE.marge, largeur: PDF_LARGEUR_COL_HEURE },
        ...salles.map((salle, i) => ({ salle, x: PDF_PAGE.marge + PDF_LARGEUR_COL_HEURE + i * largeurSalle, largeur: largeurSalle })),
    ];
}

function pdfDessinerEnteteOccupation(ctx, colonnes, rdvs, yHaut) {
    const { page, polices } = ctx;
    const titres = colonnes.map((c, i) => i === 0
        ? { lignes: ['Heure'], compte: '' }
        : { lignes: pdfLignes(c.salle.libelle, polices.bold, 7.5, c.largeur - 2 * PDF_PADDING, 2), compte: (n => `${n} RDV`)(rdvs.filter(rdv => rdv.salle.cle === c.salle.cle).length) });
    const hauteur = 2 * PDF_PADDING + Math.max(...titres.map(t => t.lignes.length * 9.5 + (t.compte ? 8 : 0)));
    colonnes.forEach((c, i) => {
        page.drawRectangle({ x: c.x, y: pdfY(yHaut + hauteur), width: c.largeur, height: hauteur, color: pdfCouleur(PDF_COULEURS.cliniqueFonce), borderColor: pdfCouleur(PDF_COULEURS.bordure), borderWidth: 0.6 });
        let y = yHaut + PDF_PADDING;
        titres[i].lignes.forEach(ligne => {
            pdfEcrire(page, ligne, c.x + PDF_PADDING, y, polices.bold, 7.5, PDF_COULEURS.blanc);
            y += 9.5;
        });
        pdfEcrire(page, titres[i].compte, c.x + PDF_PADDING, y, polices.regular, 6, '#F0D6D6');
    });
    return yHaut + hauteur;
}

// Grille heures × salles, paginée (l'en-tête des salles est répété sur chaque page)
function pdfDessinerOccupation(ctx, rdvs, salles, yHaut) {
    const colonnes = pdfColonnesOccupation(salles);
    const horaires = [...new Set(rdvs.map(rdv => rdv.horaire))];
    const ecart = 3;
    let y = pdfDessinerEnteteOccupation(ctx, colonnes, rdvs, yHaut);

    horaires.forEach(horaire => {
        const cellules = colonnes.slice(1).map(c => {
            const cartes = rdvs.filter(rdv => rdv.horaire === horaire && rdv.salle.cle === c.salle.cle)
                .map(rdv => pdfPreparerCarte(rdv, ctx.polices, c.largeur - 2 * ecart));
            const conflit = cartes.length > 1 && c.salle !== SANS_SALLE;
            const hauteur = cartes.reduce((total, carte) => total + carte.hauteur + ecart, conflit ? 13 : 0);
            return { colonne: c, cartes, conflit, hauteur };
        });
        const hauteurLigne = Math.max(24, ecart + Math.max(...cellules.map(cellule => cellule.hauteur)));

        if (y + hauteurLigne > ctx.basDePage) {
            ctx.page = ctx.doc.addPage([PDF_PAGE.largeur, PDF_PAGE.hauteur]);
            y = pdfDessinerEnteteOccupation(ctx, colonnes, rdvs, PDF_PAGE.marge);
        }
        const { page, polices } = ctx;

        const heure = colonnes[0];
        page.drawRectangle({ x: heure.x, y: pdfY(y + hauteurLigne), width: heure.largeur, height: hauteurLigne, color: pdfCouleur(PDF_COULEURS.fondDoux), borderColor: pdfCouleur(PDF_COULEURS.bordure), borderWidth: 0.6 });
        const texteHeure = pdfTexte(polices.extraBold, horaire);
        pdfEcrire(page, texteHeure, heure.x + (heure.largeur - polices.extraBold.widthOfTextAtSize(texteHeure, 9)) / 2, y + PDF_PADDING, polices.extraBold, 9);

        cellules.forEach(cellule => {
            const c = cellule.colonne;
            if (cellule.cartes.length === 0) {
                pdfHachures(page, c.x, y, c.largeur, hauteurLigne);
            }
            page.drawRectangle({ x: c.x, y: pdfY(y + hauteurLigne), width: c.largeur, height: hauteurLigne, borderColor: pdfCouleur(PDF_COULEURS.bordure), borderWidth: 0.6 });
            let yCarte = y + ecart;
            if (cellule.conflit) {
                page.drawRectangle({ x: c.x + ecart, y: pdfY(yCarte + 10), width: c.largeur - 2 * ecart, height: 10, color: pdfCouleur(PDF_COULEURS.alerteFond) });
                const alerte = pdfLigneTronquee(`${cellule.cartes.length} RDV sur ce créneau`, polices.bold, 6, c.largeur - 2 * ecart - 6);
                pdfEcrire(page, alerte, c.x + ecart + 3, yCarte + 2.3, polices.bold, 6, PDF_COULEURS.alerteTexte);
                yCarte += 13;
            }
            cellule.cartes.forEach(carte => {
                pdfDessinerCarte(page, polices, carte, c.x + ecart, yCarte, c.largeur - 2 * ecart);
                yCarte += carte.hauteur + ecart;
            });
        });
        y += hauteurLigne;
    });
    return y;
}

// ---------- Émargement ----------

function pdfDessinerEnteteEmargement(ctx, yHaut) {
    const { page, polices, colonnes } = ctx;
    colonnes.forEach((c, i) => {
        page.drawRectangle({ x: c.x, y: pdfY(yHaut + PDF_HAUTEUR_ENTETE_TABLEAU), width: c.largeur, height: PDF_HAUTEUR_ENTETE_TABLEAU, color: pdfCouleur(PDF_COULEURS.cliniqueFonce) });
        pdfEcrire(page, pdfLigneTronquee(PDF_TITRES_COLONNES[i], polices.bold, 7.5, c.largeur - 2 * PDF_PADDING), c.x + PDF_PADDING, yHaut + 5.5, polices.bold, 7.5, PDF_COULEURS.blanc);
    });
    return yHaut + PDF_HAUTEUR_ENTETE_TABLEAU;
}

// Titre de section, consigne de remplissage puis tableau d'émargement paginé
function pdfDessinerEmargement(ctx, rdvs, yHaut) {
    const { polices } = ctx;
    const x = PDF_PAGE.marge;
    let y = yHaut;

    ctx.page.drawRectangle({ x, y: pdfY(y + 20), width: PDF_LARGEUR_UTILE, height: 20, color: pdfCouleur(PDF_COULEURS.rdv1) });
    ctx.page.drawRectangle({ x, y: pdfY(y + 20), width: 4, height: 20, color: pdfCouleur(PDF_COULEURS.clinique) });
    pdfEcrire(ctx.page, pdfLigneTronquee(`Émargement des RDV - ${libelleJour(jourSelectionne)}`, polices.extraBold, 10.5, PDF_LARGEUR_UTILE - 20), x + 12, y + 5, polices.extraBold, 10.5, PDF_COULEURS.cliniqueFonce);
    y += 26;

    const consigne = 'À compléter : cochez les présences et écrivez directement dans les zones teintées (Acrobat Reader, Aperçu, navigateur…), puis enregistrez le fichier.';
    pdfLignes(consigne, polices.italique, 7, PDF_LARGEUR_UTILE).forEach(ligne => {
        pdfEcrire(ctx.page, ligne, x, y, polices.italique, 7, PDF_COULEURS.doux);
        y += 9;
    });
    y += 4;

    const motifComplet = document.body.classList.contains('motif-complet');
    y = pdfDessinerEnteteEmargement(ctx, y);
    rdvs.forEach((rdv, index) => {
        const prep = pdfPreparerLigne(rdv, polices, ctx.colonnes, motifComplet);
        if (y + prep.hauteur > ctx.basDePage) {
            ctx.page = ctx.doc.addPage([PDF_PAGE.largeur, PDF_PAGE.hauteur]);
            y = pdfDessinerEnteteEmargement(ctx, PDF_PAGE.marge);
        }
        pdfDessinerLigne(ctx, rdv, prep, y, index);
        y += prep.hauteur;
    });
    return y;
}

// ---------- En-tête, synthèse et pieds de page ----------

// Bandeau rouge : façade en filigrane (découpée au bandeau), logo et titre
function pdfDessinerBandeau(ctx, images) {
    const { page, polices } = ctx;
    const { pushGraphicsState, popGraphicsState, rectangle, clip, endPath } = PDFLib;
    const x = PDF_PAGE.marge;
    const y = PDF_PAGE.marge;
    const hauteur = 50;
    pdfRectangleArrondi(page, x, y, PDF_LARGEUR_UTILE, hauteur, 4, { fond: PDF_COULEURS.clinique });

    if (images.facade) {
        const largeurFacade = PDF_LARGEUR_UTILE * 0.42;
        const hauteurFacade = images.facade.height * largeurFacade / images.facade.width;
        page.pushOperators(pushGraphicsState(), rectangle(x, pdfY(y + hauteur), PDF_LARGEUR_UTILE - 4, hauteur), clip(), endPath());
        page.drawImage(images.facade, { x: x + PDF_LARGEUR_UTILE * 0.6, y: pdfY(y + hauteur / 2 - hauteurFacade * 0.38 + hauteurFacade), width: largeurFacade, height: hauteurFacade, opacity: 0.22 });
        page.pushOperators(popGraphicsState());
    }

    let xTitre = x + 14;
    if (images.logo) {
        const hauteurLogo = 34;
        const largeurLogo = images.logo.width * hauteurLogo / images.logo.height;
        page.drawImage(images.logo, { x: xTitre, y: pdfY(y + (hauteur + hauteurLogo) / 2), width: largeurLogo, height: hauteurLogo });
        xTitre += largeurLogo + 12;
        page.drawLine({ start: { x: xTitre, y: pdfY(y + 13) }, end: { x: xTitre, y: pdfY(y + hauteur - 13) }, thickness: 1.2, color: pdfCouleur('#E6A6A6') });
        xTitre += 12;
    }
    const titre = pdfLigneTronquee(`Briefing RDV du jour - ${libelleJour(jourSelectionne)}`, polices.bold, 14, x + PDF_LARGEUR_UTILE - 14 - xTitre);
    pdfEcrire(page, titre, xTitre, y + (hauteur - 14) / 2, polices.bold, 14, PDF_COULEURS.blanc);
    return y + hauteur + 8;
}

// Encadré de synthèse : chiffres du jour et légende des couleurs
function pdfDessinerSynthese(ctx, rdvs, salles, yHaut) {
    const { page, polices } = ctx;
    const x = PDF_PAGE.marge;
    const hauteur = 22;
    pdfRectangleArrondi(page, x, yHaut, PDF_LARGEUR_UTILE, hauteur, 4, { bordure: PDF_COULEURS.bordure });

    const horaires = [...new Set(rdvs.map(rdv => rdv.horaire))];
    const nbRdv1 = rdvs.filter(rdv => rdv.creneau.ordre === 1).length;
    const nbRdv2 = rdvs.length - nbRdv1;
    const nbSalles = salles.filter(s => s !== SANS_SALLE).length;
    const nbVisio = rdvs.filter(rdv => rdv.visio).length;
    const chiffres = [
        [rdvs.length, 'RDV'],
        [nbRdv1, plur(nbRdv1, 'premier', 'premiers')],
        [nbRdv2, plur(nbRdv2, 'second', 'seconds')],
        [nbSalles, plur(nbSalles, 'salle occupée', 'salles occupées')],
        ...(nbVisio > 0 ? [[nbVisio, 'en visio']] : []),
        [`${horaires[0]} – ${horaires[horaires.length - 1]}`, ''],
    ];
    let xChiffre = x + 8;
    const yTexte = yHaut + (hauteur - 9) / 2;
    chiffres.forEach(([valeur, libelle]) => {
        const texteValeur = pdfTexte(polices.extraBold, String(valeur));
        pdfEcrire(page, texteValeur, xChiffre, yTexte, polices.extraBold, 9, PDF_COULEURS.clinique);
        xChiffre += polices.extraBold.widthOfTextAtSize(texteValeur, 9) + 2.5;
        if (libelle) {
            const texteLibelle = pdfTexte(polices.regular, libelle);
            pdfEcrire(page, texteLibelle, xChiffre, yTexte + 0.8, polices.regular, 7.5);
            xChiffre += polices.regular.widthOfTextAtSize(texteLibelle, 7.5);
        }
        xChiffre += 10;
    });

    // Légende des couleurs, alignée à droite
    let xLegende = x + PDF_LARGEUR_UTILE - 8;
    const yLegende = yHaut + (hauteur - 8) / 2;
    [...CRENEAUX_RDV].reverse().forEach(creneau => {
        const libelle = pdfTexte(polices.regular, creneau.label);
        xLegende -= polices.regular.widthOfTextAtSize(libelle, 6.5);
        pdfEcrire(page, libelle, xLegende, yLegende + 1, polices.regular, 6.5, PDF_COULEURS.doux);
        xLegende -= 12;
        page.drawRectangle({ x: xLegende, y: pdfY(yLegende + 8.5), width: 8.5, height: 8.5, color: pdfCouleur(creneau.ordre === 2 ? PDF_COULEURS.rdv2 : PDF_COULEURS.rdv1) });
        page.drawRectangle({ x: xLegende, y: pdfY(yLegende + 8.5), width: 2.5, height: 8.5, color: pdfCouleur(creneau.ordre === 2 ? PDF_COULEURS.cliniqueFonce : PDF_COULEURS.clinique) });
        xLegende -= 10;
    });
    return yHaut + hauteur + 8;
}

function pdfDessinerPiedsDePage(doc, polices) {
    const pages = doc.getPages();
    const genere = new Date().toLocaleString('fr-FR', { timeZone: FUSEAU, dateStyle: 'short', timeStyle: 'short' });
    pages.forEach((page, i) => {
        const y = PDF_PAGE.hauteur - PDF_PAGE.margeBas + 16;
        pdfEcrire(page, 'Document contenant des données personnelles — usage interne à la Clinique juridique, ne pas diffuser et détruire après usage.',
            PDF_PAGE.marge, y, polices.italique, 6, PDF_COULEURS.doux);
        pdfEcrire(page, `Briefing RDV du ${libelleJour(jourSelectionne).toLowerCase()} · généré le ${genere}`, PDF_PAGE.marge, y + 9, polices.regular, 6, PDF_COULEURS.doux);
        const numero = pdfTexte(polices.regular, `Page ${i + 1} / ${pages.length}`);
        pdfEcrire(page, numero, PDF_PAGE.largeur - PDF_PAGE.marge - polices.regular.widthOfTextAtSize(numero, 7.5), y + 4, polices.regular, 7.5, PDF_COULEURS.doux);
    });
}

// ---------- Génération ----------

async function chargerImagePdf(doc, fichier) {
    try {
        return await doc.embedPng(await fetch(fichier).then(r => r.arrayBuffer()));
    } catch (e) {
        console.warn(`Image ${fichier} indisponible pour le PDF :`, e);
        return null;
    }
}

async function genererPdfBriefing() {
    const { PDFDocument } = PDFLib;
    const rdvs = getRdvDuJour(jourSelectionne);
    const salles = getSallesDuJour(rdvs);
    if (rdvs.length === 0) {
        return;
    }

    const doc = await PDFDocument.create();
    doc.setTitle(`Briefing RDV du jour - ${libelleJour(jourSelectionne)}`);
    doc.setAuthor('Clinique juridique');
    doc.setCreator('Widget Grist Briefing RDV');
    doc.setLanguage('fr-FR');

    const polices = await chargerPolicesPdf(doc);
    const [logo, facade] = await Promise.all([chargerImagePdf(doc, 'logoCJ_blanc.png'), chargerImagePdf(doc, 'facade_blanc.png')]);

    const ctx = {
        doc,
        polices,
        form: doc.getForm(),
        colonnes: pdfColonnes(),
        page: doc.addPage([PDF_PAGE.largeur, PDF_PAGE.hauteur]),
        basDePage: PDF_PAGE.hauteur - PDF_PAGE.margeBas - 10,
    };

    // 1. Occupation des salles
    let y = pdfDessinerBandeau(ctx, { logo, facade });
    y = pdfDessinerSynthese(ctx, rdvs, salles, y);
    pdfDessinerOccupation(ctx, rdvs, salles, y);

    // 2. Émargement à remplir, sur une nouvelle page
    ctx.page = doc.addPage([PDF_PAGE.largeur, PDF_PAGE.hauteur]);
    pdfDessinerEmargement(ctx, trierRdvEmargement(rdvs, salles), PDF_PAGE.marge);

    pdfDessinerPiedsDePage(doc, polices);
    ctx.form.updateFieldAppearances(polices.regular);

    const octets = await doc.save();
    saveAs(new Blob([octets], { type: 'application/pdf' }), `Briefing_RDV_${jourSelectionne}.pdf`);
}
