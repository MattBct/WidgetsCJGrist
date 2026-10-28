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

brancherInterface();
source.demarrer(afficher);

// ---------- Sources de données ----------

function creerSourceGrist() {
    return {
        demarrer(rappel) {
            grist.ready({ requiredAccess: 'read table', columns: COLONNES });
            grist.onRecord(record => {
                const colonnes = record ? grist.mapColumnNames(record) : null;
                rappel(colonnes, !record || Boolean(colonnes));
            });
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
        demarrer(rappel) {
            const select = $('demo-clinicien');
            select.innerHTML = records.map(r => `<option value="${r.id}">${echapper(r.prenom + ' ' + r.nom)}</option>`).join('');
            select.addEventListener('change', () => rappel(records.find(r => r.id === Number(select.value)), true));
            $('choix-demo').hidden = false;
            rappel(records[0], true);
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

// « 2 h », « 2 h 15 », « 45 min », « - 1 h »
function formatHeures(valeur) {
    const { signe, heures, minutes } = decomposeHeures(valeur);
    const prefixe = signe < 0 ? '- ' : '';
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
        heures: {
            totales: nombre(record.heures_totales),
            rdv: valeurOu(record.heures_rdv, somme(rdv)),
            projets: valeurOu(record.heures_projets, somme(actions)),
            permanences: valeurOu(record.heures_permanences, somme(permanences)),
            regulations: nombre(record.heures_regulations),
        },
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

function rendreChiffres(d) {
    const h = d.heures;
    const pourcentage = Math.round(h.totales / OBJECTIF_HEURES * 100);
    // Seules les parts positives figurent dans la barre ; la légende garde le signe des régulations
    const parts = PARTS_HEURES.filter(p => h[p.cle] !== 0 || p.cle !== 'regulations');
    const totalBarre = parts.reduce((total, p) => total + Math.max(0, h[p.cle]), 0);

    const tuileHeures = `
        <div class="tuile">
            <span class="tuile-label">Heures réalisées</span>
            <span class="tuile-valeur">${valeurHeures(h.totales)}</span>
            <div class="progression" title="${pourcentage} % de ${OBJECTIF_HEURES} h"><span style="width:${Math.min(100, Math.max(0, pourcentage))}%"></span></div>
            <span class="tuile-detail"><strong>${pourcentage} %</strong> de l’objectif de ${OBJECTIF_HEURES} h</span>
            <div class="repartition">
                ${totalBarre > 0 ? parts.filter(p => h[p.cle] > 0).map(p => `<span style="width:${h[p.cle] / totalBarre * 100}%; background:${p.couleur}"></span>`).join('') : ''}
            </div>
            <div class="legende">
                ${parts.map(p => `<span><i class="pastille" style="background:${p.couleur}"></i>${p.libelle} <strong>${formatHeures(h[p.cle])}</strong></span>`).join('')}
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
             <span class="tuile-detail"><strong>${formatHeures(d.heures.rdv)}</strong> attribuées</span>`)
        + tuile(plur(nbPermanences, 'Permanence'), nbPermanences,
            `<span class="tuile-detail"><strong>${formatHeures(d.heures.permanences)}</strong> attribuées</span>`)
        + tuile(plur(nbProjets, 'Projet'), nbProjets,
            `<span class="tuile-detail"><strong>${d.nb_actions}</strong> ${plur(d.nb_actions, 'action')}</span>
             <span class="tuile-detail"><strong>${formatHeures(d.heures.projets)}</strong> attribuées</span>`)
        + tuileAppreciations;
}

function celluleHeures(valeur) {
    return `<td class="num"><span class="heures${nombre(valeur) === 0 ? ' zero' : ''}">${formatHeures(valeur)}</span></td>`;
}

function pastilleStatut(statut) {
    return texte(statut) ? `<span class="statut ${classeStatut(statut)}">${echapper(statut)}</span>` : '';
}

function pastilleAppreciation(valeur) {
    const classe = classeAppreciation(valeur);
    return classe ? `<span class="apprec apprec-${classe}">${echapper(valeur)}</span>` : '<span class="detail">—</span>';
}

function tableRdv(liste) {
    return `
        <table class="liste">
            <thead><tr><th>N°</th><th>Créneau(x)</th><th>Statut</th><th>Appréciation</th><th class="num">Heures</th></tr></thead>
            <tbody>
                ${liste.map(r => `
                <tr>
                    <td class="nowrap"><span class="id-rdv">${echapper(r.id) || '—'}</span></td>
                    <td>${echapper(formatDate(r.creneau_1)) || '<span class="detail">Non fixé</span>'}${r.creneau_2 ? `<span class="detail">puis ${echapper(formatDate(r.creneau_2))}</span>` : ''}</td>
                    <td>${pastilleStatut(r.statut)}</td>
                    <td>${pastilleAppreciation(r.appreciation)}</td>
                    ${celluleHeures(r.heures)}
                </tr>`).join('')}
            </tbody>
        </table>`;
}

function rendreRdv(d) {
    if (!d.rdv.length) {
        return '<p class="vide">Aucun rendez-vous.</p>';
    }
    if (d.rdv.length <= SEUIL_RDV_DEUX_COLONNES) {
        return `<div class="tables">${tableRdv(d.rdv)}</div>`;
    }
    const moitie = Math.ceil(d.rdv.length / 2);
    return `<div class="tables x2">${tableRdv(d.rdv.slice(0, moitie))}${tableRdv(d.rdv.slice(moitie))}</div>`;
}

function rendrePermanences(d) {
    if (!d.permanences.length) {
        return '<p class="vide">Aucune permanence.</p>';
    }
    return `
        <table class="liste">
            <thead><tr><th>Date</th><th>Commentaire</th><th class="num">Heures</th></tr></thead>
            <tbody>
                ${d.permanences.map(p => `
                <tr>
                    <td class="nowrap"><strong>${echapper(formatDate(p.date)) || '—'}</strong></td>
                    <td>${echapper(texte(p.commentaire))}</td>
                    ${celluleHeures(p.heures)}
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
                    <span class="heures">${formatHeures(somme(projet.actions))}</span>
                </div>
                <table class="liste">
                    <tbody>
                        ${projet.actions.map(a => `
                        <tr>
                            <td>${echapper(texte(a.action)) || '<span class="detail">Action sans intitulé</span>'}</td>
                            <td>${pastilleStatut(a.statut)}</td>
                            ${celluleHeures(a.heures)}
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`).join('')}
        </div>`;
}

function rendreFiche(d) {
    const maintenant = new Date();
    $('annee').textContent = anneeUniversitaire(maintenant);
    $('identite').textContent = d.identite;
    $('etiquettes').innerHTML = [
        `<span class="etiquette claire">${echapper([d.niveau, d.diplome].filter(Boolean).join(' '))}</span>`,
        d.option ? '<span class="etiquette">Option clinique</span>' : '',
    ].join('');

    $('chiffres').innerHTML = rendreChiffres(d);

    $('compte-rdv').textContent = `${d.rdv.length} · ${formatHeures(d.heures.rdv)}`;
    $('rdv').innerHTML = rendreRdv(d);

    $('compte-permanences').textContent = `${d.permanences.length} · ${formatHeures(d.heures.permanences)}`;
    $('permanences').innerHTML = rendrePermanences(d);

    $('compte-projets').textContent = `${d.projets.length} · ${formatHeures(d.heures.projets)}`;
    $('projets').innerHTML = rendreProjets(d);

    $('date-edition').textContent = `Fiche éditée le ${dateLongue(maintenant)}`;
}

// ---------- Mise en page A4 ----------

// Réduit la taille du texte jusqu'à ce que la fiche tienne sur la hauteur utile de la feuille
function ajusterTaille() {
    const feuille = $('feuille');
    const contenu = $('contenu');
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
    $('etat-echelle').textContent = taille < TAILLE_MAX ? `Texte réduit à ${Math.round(taille / TAILLE_MAX * 100)} % pour tenir sur une page A4` : '';
    return deborde;
}

// À l'écran, la feuille (210 mm) est réduite pour tenir dans la largeur du panneau
function ajusterApercu() {
    const apercu = $('apercu');
    const feuille = $('feuille');
    const cadre = $('cadre');
    const style = getComputedStyle(apercu);
    const largeurDispo = apercu.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const echelle = Math.min(1, largeurDispo / feuille.offsetWidth);

    feuille.style.transform = echelle < 1 ? `scale(${echelle})` : '';
    cadre.style.width = feuille.offsetWidth * echelle + 'px';
    cadre.style.height = feuille.offsetHeight * echelle + 'px';
}

// ---------- Affichage ----------

function message(texteMessage, type = 'alerte') {
    const bandeau = $('message');
    bandeau.hidden = !texteMessage;
    bandeau.className = `bandeau-message ${type} no-print`;
    bandeau.textContent = texteMessage || '';
}

function afficher(record, colonnesOk) {
    const feuille = $('feuille');
    const imprimer = $('imprimer');

    if (!colonnesOk || !record) {
        message(colonnesOk
            ? 'Sélectionnez un clinicien dans la table pour afficher sa fiche.'
            : 'Associez les colonnes du widget (panneau de droite, rubrique « Colonnes ») pour afficher la fiche. Les colonnes JSON à créer sont décrites dans le README du widget.', 'info');
        feuille.hidden = true;
        imprimer.disabled = true;
        $('etat-echelle').textContent = '';
        return;
    }

    const d = donnees(record);
    rendreFiche(d);
    feuille.hidden = false;
    imprimer.disabled = false;

    const deborde = ajusterTaille();
    ajusterApercu();

    const alertes = [];
    if (d.erreurs.length) {
        alertes.push(`Liste${d.erreurs.length > 1 ? 's' : ''} illisible${d.erreurs.length > 1 ? 's' : ''} (${d.erreurs.join(', ')}) : vérifiez que la formule renvoie du JSON (json.dumps) et ne contient pas d’erreur.`);
    }
    if (deborde) {
        alertes.push('Contenu trop long pour une seule page, même avec le texte réduit : l’impression continuera sur une seconde page.');
    }
    message(alertes.join(' '), d.erreurs.length ? 'critique' : 'alerte');
}

// ---------- Événements ----------

function brancherInterface() {
    $('imprimer').addEventListener('click', async () => {
        await document.fonts.ready;
        window.print();
    });

    new ResizeObserver(() => {
        if (!$('feuille').hidden) {
            ajusterApercu();
        }
    }).observe($('apercu'));

    // Polices et images chargées après le premier rendu : la hauteur du contenu change
    const reajuster = () => {
        if (!$('feuille').hidden) {
            ajusterTaille();
            ajusterApercu();
        }
    };
    document.fonts.ready.then(reajuster);
    document.querySelectorAll('.feuille img').forEach(img => img.addEventListener('load', reajuster));
}
