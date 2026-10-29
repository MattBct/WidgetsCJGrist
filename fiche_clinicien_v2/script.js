const FUSEAU = 'Europe/Paris';

// Heures attendues sur l'année (barre de progression)
const OBJECTIF_HEURES = 60;

// Au-delà, les RDV sont répartis sur deux tableaux côte à côte
const SEUIL_RDV_DEUX_COLONNES = 12;

// Taille du texte de la feuille (pt) : réduite par pas jusqu'à ce que la fiche tienne sur une page A4
const TAILLE_MAX = 9.5;
const TAILLE_MIN = 6.5;
const TAILLE_PAS = 0.25;

// Le widget ne lit que des colonnes de la table Cliniciens : les listes arrivent en JSON (colonnes formules, voir README.md)
const COLONNES = [
    { name: "nom", title: "Nom de famille", type: "Text", optional: false },
    { name: "prenom", title: "Prénom", type: "Text", optional: false },
    { name: "niveau", title: "Niveau", type: "Choice,Text", optional: false, description: "Niveau (L3, M1, M2, Doctorat, etc.)" },
    { name: "diplome", title: "Diplôme", type: "Choice,Text", optional: true, description: "Parcours (Master uniquement)" },
    { name: "option", title: "Option clinique", type: "Bool", optional: true },
    { name: "heures_totales", title: "Heures totales", type: "Numeric,Int", optional: false },
    { name: "heures_rdv", title: "Heures de RDV", type: "Numeric,Int", optional: true, description: "À défaut : somme des heures de la liste des RDV" },
    { name: "heures_projets", title: "Heures de projets", type: "Numeric,Int", optional: true, description: "À défaut : somme des heures des actions de projets" },
    { name: "heures_permanences", title: "Heures de permanences", type: "Numeric,Int", optional: true, description: "À défaut : somme des heures des permanences" },
    { name: "heures_regulations", title: "Heures régulées (net)", type: "Numeric,Int", optional: true, description: "Crédit moins débit des régulations individuelles (0 si non associée)" },
    { name: "nb_apprec_tres_satisfaisant", title: "Nb appréciations très satisfaisantes", type: "Int,Numeric", optional: true, description: "À défaut : compté dans la liste des RDV" },
    { name: "nb_apprec_satisfaisant", title: "Nb appréciations satisfaisantes", type: "Int,Numeric", optional: true, description: "À défaut : compté dans la liste des RDV" },
    { name: "nb_apprec_peu_satisfaisant", title: "Nb appréciations peu satisfaisantes", type: "Int,Numeric", optional: true, description: "À défaut : compté dans la liste des RDV" },
    { name: "rdv_json", title: "RDV (JSON)", type: "Text,Any", optional: false, description: "Colonne formule Fiche_RDV : [{id, statut, creneau_1, creneau_2, heures, appreciation}]" },
    { name: "permanences_json", title: "Permanences (JSON)", type: "Text,Any", optional: false, description: "Colonne formule Fiche_permanences : [{date, heures, commentaire}]" },
    { name: "projets_json", title: "Actions de projets (JSON)", type: "Text,Any", optional: false, description: "Colonne formule Fiche_projets : [{projet, action, statut, heures}]" },
    { name: "regulations_json", title: "Régulations (JSON)", type: "Text,Any", optional: true, description: "Colonne formule Fiche_regulations : [{date, motif, heures, validee}]" },
];

const APPRECIATIONS = [
    { cle: 'tres', colonne: 'nb_apprec_tres_satisfaisant', singulier: 'très satisfaisant', pluriel: 'très satisfaisants' },
    { cle: 'sat', colonne: 'nb_apprec_satisfaisant', singulier: 'satisfaisant', pluriel: 'satisfaisants' },
    { cle: 'peu', colonne: 'nb_apprec_peu_satisfaisant', singulier: 'peu satisfaisant', pluriel: 'peu satisfaisants' },
];

const PARTS_HEURES = [
    { cle: 'rdv', libelle: 'RDV', couleur: 'var(--part-rdv)' },
    { cle: 'projets', libelle: 'Projets', couleur: 'var(--part-projets)' },
    { cle: 'permanences', libelle: 'Permanences', couleur: 'var(--part-permanences)' },
    { cle: 'regulations', libelle: 'Régulations', couleur: 'var(--part-regulations)' },
];

// Hors de Grist (fichier ouvert directement, ou ?demo), le widget tourne sur des données fictives
const MODE_DEMO = typeof grist === 'undefined' || window.self === window.top || new URLSearchParams(location.search).has('demo');

const $ = id => document.getElementById(id);

const source = MODE_DEMO ? creerSourceDemo() : creerSourceGrist();

let courant = null;      // clinicien sélectionné dans la table (colonnes du widget)
let colonnesOk = true;
let cliniciens = [];     // cliniciens de la vue : choix dans le widget et « Imprimer tout »
let idAffiche = null;    // clinicien affiché : celui de la table, ou choisi dans le widget

brancherInterface();
source.demarrer({
    surEnregistrement(record, ok) {
        // Un changement de ligne dans la table reprend la main sur le choix fait dans le widget
        courant = record;
        colonnesOk = ok;
        idAffiche = record?.id ?? null;
        afficher();
    },
    surEnregistrements(records) {
        cliniciens = records;
        afficher();
    },
});

// ---------- Sources de données ----------

function creerSourceGrist() {
    return {
        demarrer(rappels) {
            grist.ready({ requiredAccess: 'read table', columns: COLONNES });
            grist.onRecord(record => {
                const colonnes = record ? grist.mapColumnNames(record) : null;
                rappels.surEnregistrement(colonnes ? { ...colonnes, id: record.id } : null, !record || Boolean(colonnes));
            });
            // Tous les cliniciens de la vue (filtres compris), dans l'ordre affiché
            grist.onRecords(records => rappels.surEnregistrements((grist.mapColumnNames(records) || []).map((r, i) => ({ ...r, id: records[i].id }))));
        },
    };
}

function creerSourceDemo() {
    // Créneau en heure de Paris (UTC+1 / +2 selon la période : approximation suffisante pour la démo)
    const creneau = (mois, jour, heure, minute = 0) => `2026-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}T${String(heure).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+02:00`;
    const ids = ['K7QXM', '3HPAT', 'WD9RC', 'B4NZE', 'P2LMA', 'ZT8QE', 'H5VRN', 'C9KDS', 'M3XWB', 'R6TJY', 'F1GQP', 'N4BHU', 'S8DLE', 'Y2VKC', 'A7PMR', 'E5QZT', 'J3WNX', 'U9LCB'];
    const appreciations = ['Très satisfaisant', 'Satisfaisant', 'Très satisfaisant', 'Peu satisfaisant', null];
    const statuts = ['Terminé', 'Terminé', 'Terminé', 'Confirmé', 'Annulé', 'Créneaux proposés'];

    const rdvCamille = ids.map((id, i) => {
        const statut = statuts[i % statuts.length];
        return {
            id,
            statut,
            creneau_1: creneau(9 + Math.floor(i / 6), 1 + (i * 5) % 27, 18, i % 2 ? 30 : 0),
            creneau_2: i % 4 === 0 ? creneau(10 + Math.floor(i / 6), 2 + (i * 3) % 26, 17, 30) : null,
            heures: statut === 'Terminé' ? (i % 4 === 0 ? 3 : 1.5) : 0,
            appreciation: statut === 'Terminé' ? appreciations[i % appreciations.length] : null,
        };
    });

    const records = [
        {
            id: 1, prenom: 'Camille', nom: 'Durand', niveau: 'M2', diplome: 'Droit des affaires', option: true,
            heures_totales: 47.75, heures_rdv: 22.5, heures_projets: 14.25, heures_permanences: 12, heures_regulations: -1,
            rdv_json: JSON.stringify(rdvCamille),
            permanences_json: JSON.stringify([
                { date: '2026-09-23', heures: 3, commentaire: 'Permanence Maison de justice et du droit' },
                { date: '2026-10-07', heures: 3, commentaire: null },
                { date: '2026-10-21', heures: 3, commentaire: 'Forum des associations' },
                { date: '2026-11-04', heures: 3, commentaire: null },
            ]),
            projets_json: JSON.stringify([
                { projet: 'Journée d’accès au droit', action: 'Conception des fiches pratiques', statut: 'Terminé', heures: 6 },
                { projet: 'Journée d’accès au droit', action: 'Animation du stand', statut: 'En cours', heures: 4 },
                { projet: 'Podcast « Le droit en 5 minutes »', action: 'Écriture de l’épisode sur le bail', statut: 'Terminé', heures: 3.25 },
                { projet: 'Podcast « Le droit en 5 minutes »', action: 'Enregistrement', statut: 'À faire', heures: 1 },
            ]),
            regulations_json: JSON.stringify([
                { date: '2026-09-30T10:12:00+02:00', motif: 'Accueil des nouveaux cliniciens (réunion de rentrée)', heures: 2, validee: true },
                { date: '2026-10-15T09:40:00+02:00', motif: 'Absence non excusée à un RDV', heures: -3, validee: true },
                { date: '2026-10-27T18:05:00+01:00', motif: 'Relecture des fiches pratiques', heures: 1, validee: false },
            ]),
        },
        {
            id: 2, prenom: 'Lucas', nom: 'Martin', niveau: 'L3', diplome: '', option: false,
            heures_totales: 7.5,
            rdv_json: JSON.stringify(rdvCamille.slice(0, 3)),
            permanences_json: JSON.stringify([{ date: '2026-10-14', heures: 3, commentaire: null }]),
            projets_json: '[]',
        },
        {
            id: 3, prenom: 'Inès', nom: 'Benali', niveau: 'M1', diplome: 'Droit public', option: false,
            heures_totales: 0,
            rdv_json: '[]', permanences_json: '[]', projets_json: '',
        },
    ];

    return {
        demarrer(rappels) {
            $('label-clinicien').textContent = 'Clinicien (démo)';
            rappels.surEnregistrements(records);
            rappels.surEnregistrement(records[0], true);
        },
    };
}

// ---------- Formats ----------

function texte(valeur) {
    return valeur == null ? '' : String(valeur).trim();
}

function nombre(valeur) {
    return Number(valeur) || 0;
}

function plur(n, singulier, pluriel) {
    return Math.abs(n) <= 1 ? singulier : (pluriel ?? singulier + 's');
}

function echapper(valeur) {
    return String(valeur ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Décompose une valeur décimale d'heures (ex : 2.25) en heures et minutes (2 h 15)
function decomposeHeures(valeur) {
    const total_minutes = Math.round(nombre(valeur) * 60);
    const minutes_absolues = Math.abs(total_minutes);
    return {
        signe: total_minutes < 0 ? -1 : 1,
        heures: Math.floor(minutes_absolues / 60),
        minutes: minutes_absolues % 60,
    };
}

// « 2 h », « 2 h 15 », « 45 min », « - 1 h » (« + 2 h » avec signe)
function formatHeures(valeur, { signe: avecSigne = false } = {}) {
    const { signe, heures, minutes } = decomposeHeures(valeur);
    const prefixe = signe < 0 ? '- ' : (avecSigne && (heures || minutes) ? '+ ' : '');
    if (heures === 0 && minutes > 0) {
        return prefixe + minutes + ' min';
    }
    return prefixe + heures + ' h' + (minutes > 0 ? ' ' + String(minutes).padStart(2, '0') : '');
}

function anneeUniversitaire(date) {
    const [annee, mois] = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit' }).format(date).split('-').map(Number);
    const debut = mois >= 9 ? annee : annee - 1;
    return `${debut}/${debut + 1}`;
}

// Date reçue du JSON : « AAAA-MM-JJ » (colonne Date, sans heure), ISO avec heure, ou secondes depuis 1970
function lireDate(valeur) {
    if (valeur == null || valeur === '') {
        return null;
    }
    if (typeof valeur === 'number') {
        return { date: new Date(valeur * 1000), avecHeure: true };
    }
    const jour = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur);
    if (jour) {
        // Midi UTC : même jour calendaire quel que soit le fuseau d'affichage
        return { date: new Date(Date.UTC(+jour[1], +jour[2] - 1, +jour[3], 12)), avecHeure: false };
    }
    const date = new Date(valeur);
    return Number.isNaN(date.getTime()) ? null : { date, avecHeure: true };
}

function horodatage(valeur) {
    const d = lireDate(valeur);
    return d ? d.date.getTime() : Infinity;
}

// « 14/10/2026 » ou « 14/10/26 18h30 » (année courte quand l'heure est affichée)
function formatDate(valeur) {
    const d = lireDate(valeur);
    if (!d) {
        return '';
    }
    const jour = d.date.toLocaleDateString('fr-FR', { timeZone: FUSEAU, day: '2-digit', month: '2-digit', year: d.avecHeure ? '2-digit' : 'numeric' });
    if (!d.avecHeure) {
        return jour;
    }
    const heure = d.date.toLocaleTimeString('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    return `${jour} ${heure}`;
}

function dateLongue(date) {
    return date.toLocaleDateString('fr-FR', { timeZone: FUSEAU, day: 'numeric', month: 'long', year: 'numeric' }).replace(/^1 /, '1er ');
}

// ---------- Données ----------

// Liste JSON d'une colonne formule (texte JSON, ou liste si la colonne est de type « Toutes »)
function lireListe(valeur, libelle, erreurs) {
    if (Array.isArray(valeur)) {
        return valeur;
    }
    if (valeur == null || texte(valeur) === '') {
        return [];
    }
    try {
        const liste = JSON.parse(valeur);
        if (Array.isArray(liste)) {
            return liste.filter(element => element && typeof element === 'object');
        }
    } catch (e) {
        // Signalé ci-dessous
    }
    erreurs.push(libelle);
    return [];
}

function classeAppreciation(valeur) {
    const t = texte(valeur).toLocaleLowerCase('fr');
    if (!t) {
        return null;
    }
    if (t.includes('très') || t.includes('tres')) {
        return 'tres';
    }
    if (t.includes('peu') || t.includes('insatisf') || t.includes('pas satisf')) {
        return 'peu';
    }
    return t.includes('satisf') ? 'sat' : 'autre';
}

function classeStatut(valeur) {
    const t = texte(valeur).toLocaleLowerCase('fr');
    if (t.includes('termin')) {
        return 'termine';
    }
    if (/annul|rejet|absent|report|abandon/.test(t)) {
        return 'annule';
    }
    if (t.includes('propos')) {
        return 'propose';
    }
    if (t.includes('confirm')) {
        return 'confirme';
    }
    return t.includes('cours') ? 'en-cours' : '';
}

function somme(liste) {
    return liste.reduce((total, element) => total + nombre(element.heures), 0);
}

// Valeur de la colonne associée, sinon calcul à partir des listes
function valeurOu(valeur, calcul) {
    return typeof valeur === 'number' ? valeur : calcul;
}

function donnees(record) {
    const erreurs = [];
    const rdv = lireListe(record.rdv_json, 'RDV', erreurs)
        .slice()
        .sort((a, b) => horodatage(a.creneau_1) - horodatage(b.creneau_1));
    const permanences = lireListe(record.permanences_json, 'permanences', erreurs)
        .slice()
        .sort((a, b) => horodatage(a.date) - horodatage(b.date));
    const actions = lireListe(record.projets_json, 'actions de projets', erreurs);
    const regulations = lireListe(record.regulations_json, 'régulations', erreurs)
        .slice()
        .sort((a, b) => horodatage(a.date) - horodatage(b.date));
    // Seules les régulations validées comptent (sans la colonne Validee, toutes sont comptées)
    const validees = regulations.filter(r => r.validee !== false);

    // Actions regroupées par projet, dans l'ordre de la liste
    const projets = [];
    for (const action of actions) {
        const nom = texte(action.projet) || 'Projet sans nom';
        let projet = projets.find(p => p.nom === nom);
        if (!projet) {
            projet = { nom, actions: [] };
            projets.push(projet);
        }
        projet.actions.push(action);
    }

    const appreciations = Object.fromEntries(APPRECIATIONS.map(a => [
        a.cle,
        valeurOu(record[a.colonne], rdv.filter(r => classeAppreciation(r.appreciation) === a.cle).length),
    ]));

    const prenom = texte(record.prenom);
    const nom = texte(record.nom);

    return {
        identite: [prenom, nom.toLocaleUpperCase('fr')].filter(Boolean).join(' '),
        niveau: texte(record.niveau),
        diplome: texte(record.diplome),
        option: record.option === true,
        // Heures affichées sauf si la colonne « Option clinique » est associée et décochée
        avecHeures: record.option !== false,
        heures: {
            totales: nombre(record.heures_totales),
            rdv: valeurOu(record.heures_rdv, somme(rdv)),
            projets: valeurOu(record.heures_projets, somme(actions)),
            permanences: valeurOu(record.heures_permanences, somme(permanences)),
            regulations: valeurOu(record.heures_regulations, somme(validees)),
        },
        regulations,
        credit: somme(validees.filter(r => nombre(r.heures) > 0)),
        debit: somme(validees.filter(r => nombre(r.heures) < 0)),
        rdv,
        nb_rdv_termines: rdv.filter(r => classeStatut(r.statut) === 'termine').length,
        permanences,
        projets,
        nb_actions: actions.length,
        appreciations,
        erreurs,
    };
}

// ---------- Rendu ----------

function valeurHeures(valeur) {
    const { signe, heures, minutes } = decomposeHeures(valeur);
    return `${signe < 0 ? '- ' : ''}${heures}<small> h${minutes > 0 ? ' ' + String(minutes).padStart(2, '0') : ''}</small>`;
}

function tuile(label, valeur, detail) {
    return `
        <div class="tuile">
            <span class="tuile-label">${label}</span>
            <span class="tuile-valeur">${valeur}</span>
            ${detail}
        </div>`;
}

// « 22 h 30 attribuées » dans les tuiles, seulement pour les cliniciens dont les heures sont suivies
function detailHeures(d, valeur) {
    return d.avecHeures ? `<span class="tuile-detail"><strong>${formatHeures(valeur)}</strong> attribuées</span>` : '';
}

function rendreChiffres(d) {
    const h = d.heures;
    const pourcentage = Math.round(h.totales / OBJECTIF_HEURES * 100);
    // Seules les parts positives figurent dans la barre ; la légende garde le signe des régulations
    const parts = PARTS_HEURES.filter(p => h[p.cle] !== 0 || p.cle !== 'regulations');
    const totalBarre = parts.reduce((total, p) => total + Math.max(0, h[p.cle]), 0);

    const tuileHeures = !d.avecHeures ? '' : `
        <div class="tuile">
            <span class="tuile-label">Heures réalisées</span>
            <span class="tuile-valeur">${valeurHeures(h.totales)}</span>
            <div class="progression" title="${pourcentage} % de ${OBJECTIF_HEURES} h"><span style="width:${Math.min(100, Math.max(0, pourcentage))}%"></span></div>
            <span class="tuile-detail"><strong>${pourcentage} %</strong> de l’objectif de ${OBJECTIF_HEURES} h</span>
            <div class="repartition">
                ${totalBarre > 0 ? parts.filter(p => h[p.cle] > 0).map(p => `<span style="width:${h[p.cle] / totalBarre * 100}%; background:${p.couleur}"></span>`).join('') : ''}
            </div>
            <div class="legende">
                ${parts.map(p => `<span><i class="pastille" style="background:${p.couleur}"></i>${p.libelle} <strong>${formatHeures(h[p.cle], { signe: p.cle === 'regulations' })}</strong></span>`).join('')}
            </div>
        </div>`;

    const nbRdv = d.rdv.length;
    const nbPermanences = d.permanences.length;
    const nbProjets = d.projets.length;

    const tuileAppreciations = `
        <div class="tuile">
            <span class="tuile-label">Appréciations des RDV</span>
            <div class="appreciations">
                ${APPRECIATIONS.map(a => `
                <div class="appreciation-ligne">
                    <span class="appreciation-nb apprec-${a.cle}">${d.appreciations[a.cle]}</span>
                    <span>${plur(d.appreciations[a.cle], a.singulier, a.pluriel)}</span>
                </div>`).join('')}
            </div>
        </div>`;

    return tuileHeures
        + tuile(plur(nbRdv, 'Rendez-vous', 'Rendez-vous'), nbRdv,
            `<span class="tuile-detail">dont <strong>${d.nb_rdv_termines}</strong> ${plur(d.nb_rdv_termines, 'terminé')}</span>
             ${detailHeures(d, h.rdv)}`)
        + tuile(plur(nbPermanences, 'Permanence'), nbPermanences, detailHeures(d, h.permanences))
        + tuile(plur(nbProjets, 'Projet'), nbProjets,
            `<span class="tuile-detail"><strong>${d.nb_actions}</strong> ${plur(d.nb_actions, 'action')}</span>
             ${detailHeures(d, h.projets)}`)
        + tuileAppreciations;
}

function celluleHeures(d, valeur) {
    return d.avecHeures ? `<td class="num"><span class="heures${nombre(valeur) === 0 ? ' zero' : ''}">${formatHeures(valeur)}</span></td>` : '';
}

function enteteHeures(d) {
    return d.avecHeures ? '<th class="num">Heures</th>' : '';
}

function pastilleStatut(statut) {
    return texte(statut) ? `<span class="statut ${classeStatut(statut)}">${echapper(statut)}</span>` : '';
}

function pastilleAppreciation(valeur) {
    const classe = classeAppreciation(valeur);
    return classe ? `<span class="apprec apprec-${classe}">${echapper(valeur)}</span>` : '<span class="detail">—</span>';
}

function tableRdv(d, liste) {
    return `
        <table class="liste">
            <thead><tr><th>N°</th><th>Créneau(x)</th><th>Statut</th><th>Appréciation</th>${enteteHeures(d)}</tr></thead>
            <tbody>
                ${liste.map(r => `
                <tr>
                    <td class="nowrap"><span class="id-rdv">${echapper(r.id) || '—'}</span></td>
                    <td>${echapper(formatDate(r.creneau_1)) || '<span class="detail">Non fixé</span>'}${r.creneau_2 ? `<span class="detail">puis ${echapper(formatDate(r.creneau_2))}</span>` : ''}</td>
                    <td>${pastilleStatut(r.statut)}</td>
                    <td>${pastilleAppreciation(r.appreciation)}</td>
                    ${celluleHeures(d, r.heures)}
                </tr>`).join('')}
            </tbody>
        </table>`;
}

function rendreRdv(d) {
    if (!d.rdv.length) {
        return '<p class="vide">Aucun rendez-vous.</p>';
    }
    if (d.rdv.length <= SEUIL_RDV_DEUX_COLONNES) {
        return `<div class="tables">${tableRdv(d, d.rdv)}</div>`;
    }
    const moitie = Math.ceil(d.rdv.length / 2);
    return `<div class="tables x2">${tableRdv(d, d.rdv.slice(0, moitie))}${tableRdv(d, d.rdv.slice(moitie))}</div>`;
}

function rendrePermanences(d) {
    if (!d.permanences.length) {
        return '<p class="vide">Aucune permanence.</p>';
    }
    return `
        <table class="liste">
            <thead><tr><th>Date</th><th>Commentaire</th>${enteteHeures(d)}</tr></thead>
            <tbody>
                ${d.permanences.map(p => `
                <tr>
                    <td class="nowrap"><strong>${echapper(formatDate(p.date)) || '—'}</strong></td>
                    <td>${echapper(texte(p.commentaire))}</td>
                    ${celluleHeures(d, p.heures)}
                </tr>`).join('')}
            </tbody>
        </table>`;
}

function rendreProjets(d) {
    if (!d.projets.length) {
        return '<p class="vide">Aucun projet.</p>';
    }
    return `
        <div class="projets">
            ${d.projets.map(projet => `
            <div>
                <div class="projet-entete">
                    <span>${echapper(projet.nom)}</span>
                    ${d.avecHeures ? `<span class="heures">${formatHeures(somme(projet.actions))}</span>` : ''}
                </div>
                <table class="liste">
                    <tbody>
                        ${projet.actions.map(a => `
                        <tr>
                            <td>${echapper(texte(a.action)) || '<span class="detail">Action sans intitulé</span>'}</td>
                            <td>${pastilleStatut(a.statut)}</td>
                            ${celluleHeures(d, a.heures)}
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`).join('')}
        </div>`;
}

// Balance crédit / débit (barres partant du centre, à l'échelle du plus grand des deux) puis détail des régulations
function rendreRegulations(d) {
    const echelle = Math.max(d.credit, -d.debit) || 1;
    const net = d.heures.regulations;
    return `
        <div class="balance">
            <span class="balance-libelle debit">Débit <strong>${formatHeures(d.debit)}</strong></span>
            <div class="balance-barre">
                <span class="balance-moitie gauche"><span class="balance-debit" style="width:${-d.debit / echelle * 100}%"></span></span>
                <span class="balance-moitie"><span class="balance-credit" style="width:${d.credit / echelle * 100}%"></span></span>
            </div>
            <span class="balance-libelle credit">Crédit <strong>${formatHeures(d.credit, { signe: true })}</strong></span>
        </div>
        <p class="balance-net">Net : <strong class="${net < 0 ? 'negatif' : net > 0 ? 'positif' : ''}">${formatHeures(net, { signe: true })}</strong></p>
        <table class="liste">
            <thead><tr><th>Date</th><th>Motif</th><th class="num">Heures</th></tr></thead>
            <tbody>
                ${d.regulations.map(r => {
                    const heures = nombre(r.heures);
                    const enAttente = r.validee === false;
                    return `
                <tr${enAttente ? ' class="en-attente"' : ''}>
                    <td class="nowrap">${echapper(formatDate(r.date).split(' ')[0]) || '—'}</td>
                    <td>${echapper(texte(r.motif)) || '<span class="detail">Sans motif</span>'}${enAttente ? ' <span class="statut">Non validée</span>' : ''}</td>
                    <td class="num"><span class="heures ${heures < 0 ? 'negatif' : 'positif'}">${formatHeures(heures, { signe: true })}</span></td>
                </tr>`;
                }).join('')}
            </tbody>
        </table>`;
}

function feuilleHtml(d) {
    const maintenant = new Date();
    const compte = (nombre, heures) => d.avecHeures ? `${nombre} · ${formatHeures(heures)}` : String(nombre);
    // Régulations : uniquement des heures, masquées hors option ou sans régulation
    const avecRegulations = d.avecHeures && d.regulations.length > 0;

    return `
        <article class="feuille">
          <div class="contenu">
            <header class="bandeau">
              <img src="facade_blanc.png" alt="" class="bandeau-facade" aria-hidden="true">
              <img src="logoCJ_blanc.png" alt="Clinique juridique" class="bandeau-logo">
              <div class="bandeau-titre">
                <span class="bandeau-surtitre">Fiche clinicien · ${anneeUniversitaire(maintenant)}</span>
                <h1>${echapper(d.identite)}</h1>
                <div class="bandeau-etiquettes">
                  <span class="etiquette claire">${echapper([d.niveau, d.diplome].filter(Boolean).join(' '))}</span>
                  ${d.option ? '<span class="etiquette">Option clinique</span>' : ''}
                </div>
              </div>
            </header>

            <section class="chiffres${d.avecHeures ? '' : ' sans-heures'}">${rendreChiffres(d)}</section>

            <section class="bloc">
              <h2 class="bloc-titre">Rendez-vous <span class="bloc-compte">${compte(d.rdv.length, d.heures.rdv)}</span></h2>
              ${rendreRdv(d)}
            </section>

            <div class="deux-blocs">
              <div class="colonne">
                <section class="bloc">
                  <h2 class="bloc-titre">Permanences <span class="bloc-compte">${compte(d.permanences.length, d.heures.permanences)}</span></h2>
                  ${rendrePermanences(d)}
                </section>
                ${avecRegulations ? `
                <section class="bloc">
                  <h2 class="bloc-titre">Régulations individuelles <span class="bloc-compte">${d.regulations.length}</span></h2>
                  ${rendreRegulations(d)}
                </section>` : ''}
              </div>

              <section class="bloc">
                <h2 class="bloc-titre">Projets et actions <span class="bloc-compte">${compte(d.projets.length, d.heures.projets)}</span></h2>
                ${rendreProjets(d)}
              </section>
            </div>

            <footer class="pied">
              <span>Fiche éditée le ${dateLongue(maintenant)}</span>
              <span>Document interne à la Clinique juridique — ne pas diffuser.</span>
            </footer>
          </div>
        </article>`;
}

// ---------- Mise en page A4 ----------

// Réduit la taille du texte jusqu'à ce que la fiche tienne sur la hauteur utile de la feuille
function ajusterTaille(feuille) {
    const contenu = feuille.querySelector('.contenu');
    const style = getComputedStyle(feuille);
    const hauteurUtile = feuille.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);

    // Trop haut, ou trop large (tableaux de RDV côte à côte)
    const trop = () => contenu.offsetHeight > hauteurUtile + 1 || contenu.scrollWidth > contenu.clientWidth + 1;

    let taille = TAILLE_MAX;
    contenu.style.setProperty('--taille', taille + 'pt');
    while (trop() && taille > TAILLE_MIN) {
        taille -= TAILLE_PAS;
        contenu.style.setProperty('--taille', taille + 'pt');
    }

    const deborde = contenu.offsetHeight > hauteurUtile + 1;
    feuille.classList.toggle('deborde', deborde);
    return { taille, deborde };
}

// À l'écran, la feuille (210 mm) est réduite pour tenir dans la largeur du panneau
function ajusterApercu() {
    const apercu = $('apercu');
    const cadre = $('cadre');
    const feuille = cadre.querySelector('.feuille');
    if (!feuille) {
        return;
    }
    const style = getComputedStyle(apercu);
    const largeurDispo = apercu.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const echelle = Math.min(1, largeurDispo / feuille.offsetWidth);

    feuille.style.transform = echelle < 1 ? `scale(${echelle})` : '';
    cadre.style.width = feuille.offsetWidth * echelle + 'px';
    cadre.style.height = feuille.offsetHeight * echelle + 'px';
}

// Images (logo, façade) et polices chargées : la hauteur du contenu est alors définitive
async function imagesChargees(conteneur) {
    await Promise.all([...conteneur.querySelectorAll('img')].map(img => img.decode().catch(() => {})));
    await document.fonts.ready;
}

// ---------- Affichage ----------

function message(texteMessage, type = 'alerte') {
    const bandeau = $('message');
    bandeau.hidden = !texteMessage;
    bandeau.className = `bandeau-message ${type} no-print`;
    bandeau.textContent = texteMessage || '';
}

function texteErreurs(erreurs) {
    return `Liste${erreurs.length > 1 ? 's' : ''} illisible${erreurs.length > 1 ? 's' : ''} (${erreurs.join(', ')}) : vérifiez que la formule renvoie du JSON (json.dumps) et ne contient pas d’erreur.`;
}

// Clinicien affiché : version de la liste de la vue (à jour), sinon la ligne sélectionnée dans la table
function clinicienAffiche() {
    return cliniciens.find(c => c.id === idAffiche) ?? (courant?.id === idAffiche ? courant : null);
}

function afficher() {
    const cadre = $('cadre');
    const clinicien = clinicienAffiche();
    $('imprimer').disabled = !colonnesOk || !clinicien;
    majBoutonLot();
    majChoixClinicien();

    if (!colonnesOk || !clinicien) {
        message(colonnesOk
            ? 'Sélectionnez un clinicien dans la table pour afficher sa fiche.'
            : 'Associez les colonnes du widget (panneau de droite, rubrique « Colonnes ») pour afficher la fiche. Les colonnes JSON à créer sont décrites dans le README du widget.', 'info');
        cadre.innerHTML = '';
        cadre.style.width = cadre.style.height = '';
        $('etat-echelle').textContent = '';
        return;
    }

    const d = donnees(clinicien);
    cadre.innerHTML = feuilleHtml(d);
    const feuille = cadre.querySelector('.feuille');

    const ajuster = () => {
        const { taille, deborde } = ajusterTaille(feuille);
        ajusterApercu();
        $('etat-echelle').textContent = taille < TAILLE_MAX ? `Texte réduit à ${Math.round(taille / TAILLE_MAX * 100)} % pour tenir sur une page A4` : '';

        const alertes = [];
        if (d.erreurs.length) {
            alertes.push(texteErreurs(d.erreurs));
        }
        if (deborde) {
            alertes.push('Contenu trop long pour une seule page, même avec le texte réduit : l’impression continuera sur une seconde page.');
        }
        message(alertes.join(' '), d.erreurs.length ? 'critique' : 'alerte');
    };
    ajuster();
    // Réajustement une fois les images et polices chargées (la feuille a pu être remplacée entre-temps)
    imagesChargees(feuille).then(() => {
        if (feuille.isConnected) {
            ajuster();
        }
    });
}

// ---------- Plusieurs cliniciens ----------

function libelleClinicien(record) {
    return [texte(record.prenom), texte(record.nom).toLocaleUpperCase('fr')].filter(Boolean).join(' ') || `Ligne ${record.id}`;
}

// Liste déroulante des cliniciens de la vue, et boutons précédent / suivant
function majChoixClinicien() {
    const visible = colonnesOk && cliniciens.length > 1;
    $('choix-clinicien').hidden = !visible;
    if (!visible) {
        return;
    }
    const select = $('clinicien');
    select.innerHTML = cliniciens.map(c => `<option value="${c.id}">${echapper(libelleClinicien(c))}</option>`).join('');
    const index = cliniciens.findIndex(c => c.id === idAffiche);
    select.value = index >= 0 ? String(idAffiche) : '';
    $('precedent').disabled = index <= 0;
    $('suivant').disabled = index < 0 || index >= cliniciens.length - 1;
}

function choisirClinicien(id) {
    if (id !== idAffiche && cliniciens.some(c => c.id === id)) {
        idAffiche = id;
        afficher();
    }
}

function decalerClinicien(pas) {
    const index = cliniciens.findIndex(c => c.id === idAffiche);
    const cible = cliniciens[index + pas];
    if (index >= 0 && cible) {
        choisirClinicien(cible.id);
    }
}

function majBoutonLot() {
    const bouton = $('imprimer-tout');
    bouton.hidden = !colonnesOk || cliniciens.length < 2;
    bouton.textContent = `Imprimer tout (${cliniciens.length})`;
    bouton.title = `Une fiche A4 par clinicien de la vue (${cliniciens.length}, filtres compris), dans l’ordre de la table`;
}

// Une feuille par clinicien, chacune ajustée à sa propre taille de texte, puis impression
async function imprimerTout() {
    const bouton = $('imprimer-tout');
    bouton.disabled = true;
    bouton.textContent = 'Préparation…';
    try {
        const lot = $('lot');
        const fiches = cliniciens.map(donnees);
        lot.innerHTML = fiches.map(feuilleHtml).join('');
        await imagesChargees(lot);

        const feuilles = [...lot.querySelectorAll('.feuille')];
        const debordent = fiches.filter((d, i) => ajusterTaille(feuilles[i]).deborde).map(d => d.identite);
        const enErreur = fiches.filter(d => d.erreurs.length).map(d => d.identite);
        const alertes = [];
        if (enErreur.length) {
            alertes.push(`Listes illisibles pour : ${enErreur.join(', ')}.`);
        }
        if (debordent.length) {
            alertes.push(`Fiche${debordent.length > 1 ? 's' : ''} sur deux pages : ${debordent.join(', ')}.`);
        }
        if (alertes.length) {
            message(alertes.join(' '), enErreur.length ? 'critique' : 'alerte');
        }

        document.body.classList.add('impression-lot');
        window.print();
    } finally {
        bouton.disabled = false;
        majBoutonLot();
    }
}

window.addEventListener('afterprint', () => {
    document.body.classList.remove('impression-lot');
    $('lot').innerHTML = '';
});

// ---------- Événements ----------

function brancherInterface() {
    $('imprimer').addEventListener('click', async () => {
        document.body.classList.remove('impression-lot');
        await document.fonts.ready;
        window.print();
    });
    $('imprimer-tout').addEventListener('click', imprimerTout);

    $('clinicien').addEventListener('change', e => choisirClinicien(Number(e.target.value)));
    $('precedent').addEventListener('click', () => decalerClinicien(-1));
    $('suivant').addEventListener('click', () => decalerClinicien(1));

    new ResizeObserver(ajusterApercu).observe($('apercu'));
}
