const FUSEAU = 'Europe/Paris';

const COLONNES = [
    { name: "nom", title: "Nom de famille", type: "Text", optional: false },
    { name: "prenom", title: "Prénom", type: "Text", optional: false },
    { name: "niveau", title: "Niveau", type: "Choice,Text", optional: false, description: "Niveau (L3, M1, M2, Doctorat, etc.)" },
    { name: "diplome", title: "Diplôme", type: "Choice,Text", optional: true, description: "Parcours (Master uniquement)" },
    { name: "nb_rdv_termines", title: "Nombre de RDV terminés", type: "Int,Numeric", optional: false },
    { name: "nb_projets", title: "Nombre de projets", type: "Int,Numeric", optional: false },
    { name: "nb_permanences", title: "Nombre de permanences", type: "Int,Numeric", optional: true, description: "Compté dans les participations et dans la liste des activités (0 si la colonne n'est pas associée)" },
    { name: "texte_personnalise", title: "Texte personnalisé", type: "Text", optional: true, description: "Texte ajouté à l'attestation, modifiable depuis le widget. Sans cette colonne, le texte n'est pas conservé" },
];

// Grandeur comparée aux bornes de la condition d'un modèle
const CRITERES = {
    total: { libelle: 'Participations (RDV + projets + permanences)', sujet: 'participations', valeur: d => d.nb_participations },
    rdv: { libelle: 'RDV terminés', sujet: 'RDV terminés', valeur: d => d.nb_rdv },
    projets: { libelle: 'Projets', sujet: 'projets', valeur: d => d.nb_projets },
    permanences: { libelle: 'Permanences', sujet: 'permanences', valeur: d => d.nb_permanences },
};

// Variables utilisables dans le titre et le texte des modèles : {{cle}}.
// « bloc » : variable prévue seule dans son paragraphe (liste, texte libre)
const VARIABLES = [
    { cle: 'identite', libelle: 'Prénom NOM', valeur: d => d.identite },
    { cle: 'prenom', libelle: 'Prénom', valeur: d => d.prenom },
    { cle: 'nom', libelle: 'Nom', valeur: d => d.nom },
    { cle: 'formation', libelle: 'Niveau et diplôme', valeur: d => d.formation },
    { cle: 'niveau', libelle: 'Niveau', valeur: d => d.niveau },
    { cle: 'diplome', libelle: 'Diplôme', valeur: d => d.diplome },
    { cle: 'nb_rdv', libelle: 'Nb RDV', valeur: d => String(d.nb_rdv) },
    { cle: 'nb_projets', libelle: 'Nb projets', valeur: d => String(d.nb_projets) },
    { cle: 'nb_permanences', libelle: 'Nb permanences', valeur: d => String(d.nb_permanences) },
    { cle: 'nb_participations', libelle: 'Nb participations', valeur: d => String(d.nb_participations) },
    { cle: 'activites', libelle: 'Liste des activités', bloc: true, valeur: d => listeEnTexte(activites(d)) },
    { cle: 'texte_personnalise', libelle: 'Texte personnalisé', bloc: true, valeur: d => d.texte_personnalise },
    { cle: 'annee_universitaire', libelle: 'Année universitaire', valeur: d => d.annee_universitaire },
    { cle: 'lieu', libelle: 'Lieu', valeur: d => d.lieu },
    { cle: 'date', libelle: 'Date du jour', valeur: d => d.date },
];
const VARIABLES_PAR_CLE = Object.fromEntries(VARIABLES.map(v => [v.cle, v]));

const INTRODUCTION = "Nous soussignés, Mathieu Rouy, Maître de conférences en droit public, et Marylou Françoise, Maîtresse de conférences en droit privé et sciences criminelles, pris en nos qualités de co-directeur et co-directrice de la Clinique juridique de l’Université Jean Moulin Lyon 3 et de l’École des avocats Rhône-Alpes, attestons ce qui suit.";
const PRESENTATION = "La Clinique juridique de l’Université Jean Moulin Lyon 3 vise un double objectif pédagogique et social, en offrant la possibilité aux étudiants et élèves avocats de Lyon de mettre leurs connaissances juridiques au service de la société. En s’engageant en tant que clinicien(ne) sur l’année universitaire {{annee_universitaire}}, **{{identite}}**, *étudiant(e) en {{formation}}* à la Faculté de droit Lyon 3, a participé au renforcement de l’accès au droit en participant aux activités suivantes :";
const CONCLUSION = "Établie à la demande de l’intéressé(e) pour servir et valoir ce que de droit.\n\nFait à {{lieu}}, le {{date}}.";

// Modèles proposés à la première utilisation (et par « Restaurer les modèles par défaut »)
const MODELES_DEFAUT = [
    {
        id: 'engagement-soutenu',
        nom: 'Engagement soutenu',
        condition: { critere: 'total', min: 10, max: null },
        titre: 'Attestation de participation à la Clinique juridique',
        corps: [
            INTRODUCTION,
            PRESENTATION,
            '{{activites}}',
            "Par un investissement particulièrement soutenu tout au long de l’année, totalisant {{nb_participations}} participations, {{identite}} a pu développer des compétences juridiques certaines telles que l’écoute, la recherche juridique en temps restreint et la restitution accessible de l’information juridique. Son engagement remarquable traduit indéniablement sa volonté de mettre en œuvre la responsabilité sociale qui incombe à chacun.",
            '{{texte_personnalise}}',
            CONCLUSION,
        ].join('\n\n'),
    },
    {
        id: 'standard',
        nom: 'Attestation standard',
        condition: { critere: 'total', min: 1, max: null },
        titre: 'Attestation de participation à la Clinique juridique',
        corps: [
            INTRODUCTION,
            PRESENTATION,
            '{{activites}}',
            "Grâce à un investissement certain dans la clinique, {{identite}} a pu développer des compétences juridiques certaines telles que l’écoute, la recherche juridique en temps restreint et la restitution accessible de l’information juridique. Son engagement traduit indéniablement sa volonté de mettre en œuvre la responsabilité sociale qui incombe à chacun.",
            '{{texte_personnalise}}',
            CONCLUSION,
        ].join('\n\n'),
    },
];

const PARAMETRES_DEFAUT = {
    annee_universitaire: '', // vide : calculée (nouvelle année au 1er septembre)
    lieu: 'Lyon',
    signataires: [
        { nom: 'Mathieu ROUY', qualite: 'Maître de conférences en droit public et co-directeur de la Clinique juridique', signature: null },
        { nom: 'Marylou FRANÇOISE', qualite: 'Maîtresse de conférences en droit privé et co-directrice de la Clinique juridique', signature: null },
    ],
};

// Signatures scannées : jamais publiées avec le widget. Elles sont lues dans cette table du document
// (une colonne Pièces jointes, une colonne Texte pour le nom), avec un jeton d'accès temporaire.
// Les options du widget ne gardent que l'id de la ligne choisie pour chaque signataire.
const TABLE_SIGNATURES = 'Signatures';

// Hors de Grist (fichier ouvert directement, ou ?demo), le widget tourne sur des données fictives
const MODE_DEMO = typeof grist === 'undefined' || window.self === window.top || new URLSearchParams(location.search).has('demo');

const DELAI_ENREGISTREMENT_TEXTE_MS = 900;

let config = normaliserConfig(null); // configuration enregistrée (options du widget)
let brouillon = null;                // copie modifiée pendant la configuration (null : panneau fermé)
let idModeleEdite = null;
let choixManuel = '';                // id du modèle imposé, '' : choix automatique
let clinicien = null;                // enregistrement sélectionné (colonnes du widget)
let cliniciens = [];                 // enregistrements de la vue, pour « Imprimer tout »
let colonnesAssociees = true;
const textesLocaux = new Map();      // rowId -> texte personnalisé saisi (non associé, ou en cours d'enregistrement)
let saisieTexte = null;              // { rowId, minuteur } : enregistrement du texte en attente
let dernierChampModele = null;       // champ (titre ou texte) recevant les variables insérées
let signatures = { etat: 'chargement', liste: [] }; // lignes de la table Signatures : [{ id, libelle, attId }]
const imagesSignatures = new Map();  // attId -> { url, expire } ou promesse de chargement
let avecSignatures = true;           // case « Signatures scannées » de la barre d'outils

const $ = id => document.getElementById(id);

const source = MODE_DEMO ? creerSourceDemo() : creerSourceGrist();

brancherInterface();

source.demarrer({
    surOptions(options) {
        config = normaliserConfig(options);
        if (brouillon) {
            // Le brouillon et le formulaire en cours de saisie sont conservés
            rendreListeModeles();
            etatConfiguration();
        }
        afficher();
    },
    surEnregistrement(record, colonnesOk) {
        changerClinicien(record, colonnesOk);
    },
    surEnregistrements(records) {
        cliniciens = records;
        majBoutonLot();
    },
    surConfiguration() {
        ouvrirConfiguration();
    },
});

chargerSignatures();

// ---------- Sources de données ----------

function creerSourceGrist() {
    let mappings = null;

    return {
        demarrer(rappels) {
            // Accès complet : écriture du texte personnalisé dans la table
            grist.ready({ requiredAccess: 'full', columns: COLONNES, onEditOptions: rappels.surConfiguration });
            grist.onOptions(options => rappels.surOptions(options));
            grist.onRecords(records => rappels.surEnregistrements((grist.mapColumnNames(records) || []).map((r, i) => ({ ...r, id: records[i].id }))));
            grist.onRecord((record, nouvellesMappings) => {
                mappings = nouvellesMappings;
                const colonnes = record ? grist.mapColumnNames(record) : null;
                rappels.surEnregistrement(colonnes ? { ...colonnes, id: record.id } : null, !record || Boolean(colonnes));
            });
        },

        texteAssocie() {
            return Boolean(mappings?.texte_personnalise);
        },

        async enregistrerTexte(rowId, texte) {
            await grist.selectedTable.update({ id: rowId, fields: { [mappings.texte_personnalise]: texte } });
        },

        async enregistrerOptions(options) {
            await grist.setOptions(options);
        },

        // Lignes de la table Signatures ayant une image ; null si la table ou sa colonne Pièces jointes n'existe pas.
        // Échoue si les règles d'accès interdisent la lecture de la table à l'utilisateur.
        async listerSignatures() {
            const [tables, colonnes] = await Promise.all([
                grist.docApi.fetchTable('_grist_Tables'),
                grist.docApi.fetchTable('_grist_Tables_column'),
            ]);
            const iTable = tables.tableId.indexOf(TABLE_SIGNATURES);
            if (iTable < 0) {
                return null;
            }
            const indices = colonnes.id.map((_, i) => i).filter(i => colonnes.parentId[i] === tables.id[iTable] && !colonnes.colId[i].startsWith('gristHelper_'));
            const iImage = indices.find(i => colonnes.type[i] === 'Attachments');
            if (iImage == null) {
                return null;
            }
            const iNom = indices.find(i => colonnes.colId[i] === 'Nom') ?? indices.find(i => colonnes.type[i] === 'Text');
            const table = await grist.docApi.fetchTable(TABLE_SIGNATURES);
            const images = table[colonnes.colId[iImage]];
            const noms = iNom != null ? table[colonnes.colId[iNom]] : [];
            return table.id
                .map((id, k) => ({ id, libelle: texte(noms[k]) || `Signature n° ${id}`, attId: premierePieceJointe(images[k]) }))
                .filter(s => s.attId != null);
        },

        // Image téléchargée avec un jeton en lecture seule et gardée en mémoire (URL locale « blob: »)
        async imageSignature(attId) {
            const { token, baseUrl, ttlMsecs } = await grist.docApi.getAccessToken({ readOnly: true });
            const url = `${baseUrl}/attachments/${attId}/download?auth=${encodeURIComponent(token)}`;
            let reponse;
            try {
                reponse = await fetch(url);
            } catch (e) {
                // Lecture refusée par le navigateur (CORS) : l'image est affichée par son URL, valable le temps du jeton
                return { url, expire: Date.now() + (ttlMsecs || 60000) * 0.8 };
            }
            if (!reponse.ok) {
                throw new Error(`Pièce jointe ${attId} : HTTP ${reponse.status}`);
            }
            return { url: URL.createObjectURL(await reponse.blob()), expire: Infinity };
        },
    };
}

// Cellule Pièces jointes : ['L', id1, id2…] (ou [id1, id2…]) -> id1
function premierePieceJointe(valeur) {
    if (!Array.isArray(valeur)) {
        return null;
    }
    const ids = valeur[0] === 'L' ? valeur.slice(1) : valeur;
    return ids.length ? ids[0] : null;
}

function creerSourceDemo() {
    const records = [
        { id: 1, prenom: 'Camille', nom: 'Durand', niveau: 'M2', diplome: 'Droit des affaires', nb_rdv_termines: 9, nb_projets: 3, nb_permanences: 2, texte_personnalise: '' },
        { id: 2, prenom: 'Lucas', nom: 'Martin', niveau: 'L3', diplome: '', nb_rdv_termines: 2, nb_projets: 0, nb_permanences: 1, texte_personnalise: '' },
        { id: 3, prenom: 'Inès', nom: 'Benali', niveau: 'M1', diplome: 'Droit public', nb_rdv_termines: 0, nb_projets: 1, nb_permanences: 0, texte_personnalise: 'Mention particulière : conception d’une fiche pratique sur le droit au logement, diffusée lors de la journée d’accès au droit.' },
        { id: 4, prenom: 'Hugo', nom: 'Petit', niveau: 'M1', diplome: 'Droit pénal', nb_rdv_termines: 0, nb_projets: 0, nb_permanences: 0, texte_personnalise: '' },
    ];
    const attendre = ms => new Promise(resolve => setTimeout(resolve, ms));

    return {
        demarrer(rappels) {
            const select = $('demo-clinicien');
            select.innerHTML = records.map(r => `<option value="${r.id}">${echapper(r.prenom + ' ' + r.nom)}</option>`).join('');
            // Mêmes objets que la « table » : le texte enregistré est relu comme depuis Grist
            select.addEventListener('change', () => rappels.surEnregistrement(records.find(r => r.id === Number(select.value)), true));
            $('choix-demo').hidden = false;

            let options = null;
            try {
                options = JSON.parse(localStorage.getItem('attestation-demo-options'));
            } catch (e) {
                options = null;
            }
            rappels.surOptions(options);
            rappels.surEnregistrements(records);
            rappels.surEnregistrement(records[0], true);
        },

        texteAssocie() {
            return true;
        },

        async enregistrerTexte(rowId, texte) {
            await attendre(300);
            records.find(r => r.id === rowId).texte_personnalise = texte;
        },

        async enregistrerOptions(options) {
            await attendre(200);
            try {
                localStorage.setItem('attestation-demo-options', JSON.stringify(options));
            } catch (e) {
                // Stockage indisponible : la configuration reste en mémoire
            }
        },

        // Signatures fictives (tracés générés), aucune vraie signature dans le dépôt
        async listerSignatures() {
            await attendre(200);
            return [
                { id: 1, libelle: 'Signature fictive A (démo)', attId: 'demo-a' },
                { id: 2, libelle: 'Signature fictive B (démo)', attId: 'demo-b' },
            ];
        },

        async imageSignature(attId) {
            await attendre(150);
            const trace = attId === 'demo-a'
                ? 'M10 60 C 30 10, 45 10, 50 45 S 70 80, 85 35 S 120 20, 130 50 S 160 70, 190 30'
                : 'M10 50 C 25 20, 40 70, 60 40 S 90 15, 100 55 S 140 65, 150 30 L 190 45';
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80"><path d="${trace}" fill="none" stroke="#1f2a6b" stroke-width="3" stroke-linecap="round"/></svg>`;
            return { url: 'data:image/svg+xml,' + encodeURIComponent(svg), expire: Infinity };
        },
    };
}

// ---------- Configuration (options du widget) ----------

function cloner(objet) {
    return JSON.parse(JSON.stringify(objet));
}

function nouvelId() {
    return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function entierOuNull(valeur) {
    if (valeur === '' || valeur == null) {
        return null;
    }
    const n = Math.floor(Number(valeur));
    return Number.isFinite(n) && n >= 0 ? n : null;
}

function normaliserModele(m) {
    const critere = CRITERES[m.condition?.critere] ? m.condition.critere : 'total';
    return {
        id: String(m.id || nouvelId()),
        nom: String(m.nom ?? ''),
        condition: { critere, min: entierOuNull(m.condition?.min), max: entierOuNull(m.condition?.max) },
        titre: String(m.titre ?? ''),
        corps: String(m.corps ?? ''),
    };
}

function normaliserConfig(options) {
    const parametres = options?.parametres ?? {};
    return {
        modeles: Array.isArray(options?.modeles)
            ? options.modeles.filter(m => m && typeof m === 'object').map(normaliserModele)
            : cloner(MODELES_DEFAUT),
        parametres: {
            annee_universitaire: typeof parametres.annee_universitaire === 'string' ? parametres.annee_universitaire : PARAMETRES_DEFAUT.annee_universitaire,
            lieu: typeof parametres.lieu === 'string' ? parametres.lieu : PARAMETRES_DEFAUT.lieu,
            signataires: Array.isArray(parametres.signataires)
                ? parametres.signataires.map(s => ({ nom: String(s?.nom ?? ''), qualite: String(s?.qualite ?? ''), signature: entierOuNull(s?.signature) }))
                : cloner(PARAMETRES_DEFAUT.signataires),
        },
    };
}

// Configuration utilisée pour l'aperçu : le brouillon pendant la modification
function configActive() {
    return brouillon ?? config;
}

function conditionRemplie(condition, d) {
    const valeur = CRITERES[condition.critere].valeur(d);
    return (condition.min == null || valeur >= condition.min) && (condition.max == null || valeur <= condition.max);
}

function resumeCondition(condition) {
    const { min, max } = condition;
    const sujet = CRITERES[condition.critere].sujet;
    if (min == null && max == null) {
        return 'Toujours applicable';
    }
    if (max == null) {
        return `${sujet} ≥ ${min}`;
    }
    if (min == null) {
        return `${sujet} ≤ ${max}`;
    }
    return min === max ? `${sujet} = ${min}` : `${sujet} entre ${min} et ${max}`;
}

function modeleAutomatique(d, cfg) {
    return cfg.modeles.find(m => conditionRemplie(m.condition, d)) ?? null;
}

// Modèle de l'attestation : modèle en cours de modification (aperçu), choix manuel, sinon le premier applicable
function modelePour(d, cfg, { apercuEdition = false } = {}) {
    if (apercuEdition && brouillon && idModeleEdite) {
        const edite = brouillon.modeles.find(m => m.id === idModeleEdite);
        if (edite) {
            return edite;
        }
    }
    if (choixManuel) {
        const impose = cfg.modeles.find(m => m.id === choixManuel);
        if (impose) {
            return impose;
        }
    }
    return modeleAutomatique(d, cfg);
}

// ---------- Données d'un clinicien ----------

function texte(valeur) {
    return valeur == null ? '' : String(valeur).trim();
}

function nombre(valeur) {
    return Number(valeur) || 0;
}

function plur(n, singulier, pluriel) {
    return Math.abs(n) <= 1 ? singulier : (pluriel ?? singulier + 's');
}

function anneeUniversitaire(date) {
    const [annee, mois] = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit' }).format(date).split('-').map(Number);
    const debut = mois >= 9 ? annee : annee - 1;
    return `${debut}/${debut + 1}`;
}

// « 1er octobre 2026 », « 9 octobre 2026 »
function dateLongue(date) {
    const texteDate = date.toLocaleDateString('fr-FR', { timeZone: FUSEAU, day: 'numeric', month: 'long', year: 'numeric' });
    return texteDate.replace(/^1 /, '1er ');
}

function texteDe(record) {
    if (textesLocaux.has(record.id)) {
        return textesLocaux.get(record.id);
    }
    return source.texteAssocie() ? texte(record.texte_personnalise) : '';
}

function donnees(record, cfg) {
    const prenom = texte(record.prenom);
    const nom = texte(record.nom);
    const niveau = texte(record.niveau);
    const diplome = texte(record.diplome);
    const nb_rdv = nombre(record.nb_rdv_termines);
    const nb_projets = nombre(record.nb_projets);
    const nb_permanences = nombre(record.nb_permanences);
    const maintenant = new Date();

    return {
        id: record.id,
        prenom,
        nom,
        identite: [prenom, nom.toLocaleUpperCase('fr')].filter(Boolean).join(' '),
        niveau,
        diplome,
        formation: [niveau, diplome].filter(Boolean).join(' '),
        nb_rdv,
        nb_projets,
        nb_permanences,
        nb_participations: nb_rdv + nb_projets + nb_permanences,
        texte_personnalise: texteDe(record),
        annee_universitaire: texte(cfg.parametres.annee_universitaire) || anneeUniversitaire(maintenant),
        lieu: texte(cfg.parametres.lieu),
        date: dateLongue(maintenant),
    };
}

function activites(d) {
    const liste = [];
    if (d.nb_rdv > 0) {
        liste.push(`${d.nb_rdv} rendez-vous d’information et d’orientation juridiques`);
    }
    if (d.nb_projets > 0) {
        liste.push(`${d.nb_projets} ${plur(d.nb_projets, 'projet visant', 'projets visant')} à informer le grand public sur certaines notions de droit`);
    }
    if (d.nb_permanences > 0) {
        liste.push(`${d.nb_permanences} ${plur(d.nb_permanences, 'permanence')} d’accès au droit`);
    }
    return liste;
}

// « a, b et c »
function listeEnTexte(elements) {
    return elements.length <= 1 ? (elements[0] ?? '') : elements.slice(0, -1).join(', ') + ' et ' + elements[elements.length - 1];
}

function resumeChiffres(d) {
    return `${d.nb_rdv} ${plur(d.nb_rdv, 'RDV terminé', 'RDV terminés')}, ${d.nb_projets} ${plur(d.nb_projets, 'projet')}, ${d.nb_permanences} ${plur(d.nb_permanences, 'permanence')}`;
}

// ---------- Rendu des modèles ----------

function echapper(valeur) {
    return String(valeur ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// **gras** et *italique*, sur du texte déjà échappé
function enrichir(html) {
    return html
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function manquant(libelle) {
    return `<span class="manquant" title="Sans valeur pour ce clinicien (masqué à l'impression)">${echapper(libelle)}</span>`;
}

// Valeur HTML d'une variable {{...}}
function valeurVariable(contenu, d) {
    const variable = VARIABLES_PAR_CLE[contenu];
    if (!variable) {
        return `<span class="manquant" title="Variable inconnue">{{${echapper(contenu)}}}</span>`;
    }
    const valeur = variable.valeur(d);
    return valeur ? echapper(valeur) : manquant(variable.libelle);
}

// Une ligne de texte : variables remplacées (valeurs jamais interprétées comme mise en forme), puis gras / italique
function rendreLigne(ligne, d) {
    const valeurs = [];
    const avecJetons = ligne.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (tout, contenu) => {
        valeurs.push(valeurVariable(contenu, d));
        return `${valeurs.length - 1}`;
    });
    return enrichir(echapper(avecJetons)).replace(/(\d+)/g, (tout, i) => valeurs[i]);
}

function rendreParagraphe(bloc, d, classe = '') {
    const lignes = bloc.split('\n').map(l => l.trim()).filter(Boolean);
    if (lignes.length && lignes.every(l => /^[-•]\s+/.test(l))) {
        return `<ul>${lignes.map(l => `<li>${rendreLigne(l.replace(/^[-•]\s+/, ''), d)}</li>`).join('')}</ul>`;
    }
    return `<p${classe ? ` class="${classe}"` : ''}>${lignes.map(l => rendreLigne(l, d)).join('<br>')}</p>`;
}

function rendreTextePersonnalise(d) {
    return d.texte_personnalise
        .split(/\n\s*\n/)
        .filter(bloc => bloc.trim())
        .map(bloc => rendreParagraphe(bloc, d, 'texte-personnalise'))
        .join('');
}

function rendreCorps(corps, d) {
    let textePlace = false;
    const html = corps.replace(/\r/g, '').split(/\n\s*\n/).map(bloc => {
        const contenu = bloc.trim();
        if (!contenu) {
            return '';
        }
        if (/^\{\{\s*activites\s*\}\}$/.test(contenu)) {
            const liste = activites(d);
            return liste.length
                ? `<ul class="activites">${liste.map((a, i) => `<li>${echapper(a)}${i === liste.length - 1 ? '.' : ' ;'}</li>`).join('')}</ul>`
                : `<p>${manquant('Aucune activité')}</p>`;
        }
        if (/^\{\{\s*texte_personnalise\s*\}\}$/.test(contenu)) {
            textePlace = true;
            return rendreTextePersonnalise(d);
        }
        return rendreParagraphe(contenu, d);
    }).join('');

    // Modèle sans emplacement prévu : le texte personnalisé est ajouté à la fin
    return textePlace ? html : html + rendreTextePersonnalise(d);
}

function feuilleHtml(d, modele, cfg) {
    const signataires = cfg.parametres.signataires.filter(s => s.nom.trim() || s.qualite.trim());
    return `
        <article class="feuille">
            <img class="doc-facade" src="facade_rouge.png" alt="" aria-hidden="true">
            <header class="doc-entete">
                <img class="doc-logo" src="logoCJ.png" alt="Clinique juridique — Faculté de droit, Université Jean Moulin Lyon III — École des avocats Rhône-Alpes">
            </header>
            <h1 class="doc-titre">${rendreLigne(modele.titre || 'Attestation', d)}</h1>
            <div class="doc-corps">${rendreCorps(modele.corps, d)}</div>
            ${signataires.length ? `
            <footer class="doc-signatures">
                ${signataires.map(s => `
                <div class="signataire">
                    <span class="signataire-nom">${echapper(s.nom)}</span>
                    <span class="signataire-qualite">${echapper(s.qualite)}</span>
                    <div class="signataire-espace">${imageSignatureHtml(s)}</div>
                </div>`).join('')}
            </footer>` : ''}
        </article>`;
}

// ---------- Affichage ----------

function message(texteMessage, type = 'alerte') {
    const bandeau = $('message');
    bandeau.hidden = !texteMessage;
    bandeau.className = `bandeau ${type} no-print`;
    bandeau.textContent = texteMessage || '';
}

function afficher() {
    majChoixModele();
    majBoutonLot();
    majOptionSignatures();

    const apercu = $('apercu');
    const enTete = $('clinicien-courant');
    const imprimer = $('imprimer');

    if (!colonnesAssociees || !clinicien) {
        message(colonnesAssociees
            ? 'Sélectionnez un clinicien dans la table pour afficher son attestation.'
            : 'Associez les colonnes du widget (panneau de droite, rubrique « Colonnes ») pour afficher l’attestation.', 'info');
        apercu.innerHTML = '';
        enTete.hidden = true;
        $('panneau-texte').hidden = true;
        imprimer.disabled = true;
        return;
    }

    const cfg = configActive();
    const d = donnees(clinicien, cfg);
    const modele = modelePour(d, cfg, { apercuEdition: true });

    enTete.hidden = false;
    enTete.textContent = `${d.identite} · ${d.nb_participations} ${plur(d.nb_participations, 'participation')}`;
    afficherPanneauTexte(d);

    if (!modele) {
        message(d.nb_participations === 0
            ? `${d.identite} n’a aucune activité enregistrée (${resumeChiffres(d)}) : aucun modèle ne s’applique.`
            : `Aucun modèle ne s’applique à ${d.identite} (${resumeChiffres(d)}). Choisissez un modèle dans la liste « Modèle » ou ajustez les conditions des modèles.`, 'critique');
        apercu.innerHTML = '';
        imprimer.disabled = true;
        return;
    }

    if (brouillon && modele.id === idModeleEdite) {
        message(`Aperçu du modèle « ${modele.nom || 'Sans nom'} » en cours de modification${conditionRemplie(modele.condition, d) ? '' : ` (il ne s’applique pas automatiquement à ce clinicien : ${resumeCondition(modele.condition)})`}.`, 'info');
    } else {
        message('');
    }

    apercu.innerHTML = feuilleHtml(d, modele, cfg);
    imprimer.disabled = false;
}

function majChoixModele() {
    const select = $('choix-modele');
    const cfg = configActive();
    if (choixManuel && !cfg.modeles.some(m => m.id === choixManuel)) {
        choixManuel = '';
    }
    const auto = clinicien && colonnesAssociees ? modeleAutomatique(donnees(clinicien, cfg), cfg) : null;
    const libelleAuto = clinicien ? `Automatique : ${auto ? auto.nom || 'Sans nom' : 'aucun'}` : 'Automatique';
    select.innerHTML = `<option value="">${echapper(libelleAuto)}</option>`
        + cfg.modeles.map(m => `<option value="${echapper(m.id)}">${echapper(m.nom || 'Sans nom')}</option>`).join('');
    select.value = choixManuel;
    select.disabled = Boolean(brouillon);
    select.title = brouillon ? 'L’aperçu affiche le modèle en cours de modification' : '';
}

// Cliniciens de la vue ayant un modèle applicable (même règle que l'aperçu)
function cliniciensImprimables() {
    return cliniciens
        .map(record => donnees(record, configActive()))
        .map(d => ({ d, modele: modelePour(d, configActive()) }))
        .filter(x => x.modele);
}

function majBoutonLot() {
    const bouton = $('imprimer-tout');
    bouton.hidden = cliniciens.length < 2;
    if (bouton.hidden) {
        return;
    }
    const imprimables = cliniciensImprimables();
    const ignores = cliniciens.length - imprimables.length;
    bouton.textContent = `Imprimer tout (${imprimables.length})`;
    bouton.disabled = imprimables.length === 0;
    bouton.title = 'Une attestation par page pour chaque clinicien de la vue'
        + (ignores ? ` — ${ignores} ${plur(ignores, 'clinicien ignoré', 'cliniciens ignorés')} (aucun modèle applicable)` : '');
}

// Images (logo, filigrane, signatures) et polices chargées avant l'ouverture de la fenêtre d'impression
async function imagesChargees(conteneur) {
    await Promise.all([...conteneur.querySelectorAll('img')].map(img => img.decode().catch(() => {})));
    await document.fonts.ready;
}

async function imprimer() {
    await signaturesPretes();
    afficher();
    await imagesChargees($('apercu'));
    document.body.classList.remove('impression-lot');
    window.print();
}

async function imprimerTout() {
    await signaturesPretes();
    const cfg = configActive();
    const lot = $('lot');
    lot.innerHTML = cliniciensImprimables().map(({ d, modele }) => feuilleHtml(d, modele, cfg)).join('');
    await imagesChargees(lot);
    document.body.classList.add('impression-lot');
    window.print();
}

window.addEventListener('afterprint', () => {
    document.body.classList.remove('impression-lot');
    $('lot').innerHTML = '';
});

// ---------- Signatures scannées ----------

async function chargerSignatures() {
    signatures = { etat: 'chargement', liste: [] };
    majSignaturesConfiguration();
    try {
        const liste = await source.listerSignatures();
        signatures = liste ? { etat: 'ok', liste } : { etat: 'absente', liste: [] };
    } catch (e) {
        console.warn('Lecture de la table des signatures impossible :', e);
        signatures = { etat: 'erreur', liste: [] };
    }
    imagesSignatures.clear();
    majSignaturesConfiguration();
    afficher();
}

function ligneSignature(signataire) {
    return signataire.signature == null ? null : signatures.liste.find(s => s.id === signataire.signature) ?? null;
}

// Charge l'image si besoin (puis réaffiche) ; renvoie la promesse en cours, ou null si rien n'est à attendre
function chargerImageSignature(signataire) {
    const ligne = ligneSignature(signataire);
    if (!ligne) {
        return null;
    }
    const image = imagesSignatures.get(ligne.attId);
    if (image instanceof Promise) {
        return image;
    }
    if (image && image.expire > Date.now()) {
        return null;
    }
    const chargement = source.imageSignature(ligne.attId)
        .catch(e => {
            console.warn('Signature illisible :', e);
            return { url: null, expire: Infinity };
        })
        .then(resultat => {
            imagesSignatures.set(ligne.attId, resultat);
            afficher();
        });
    imagesSignatures.set(ligne.attId, chargement);
    return chargement;
}

function imageSignatureHtml(signataire) {
    if (!avecSignatures) {
        return '';
    }
    chargerImageSignature(signataire);
    const ligne = ligneSignature(signataire);
    const image = ligne && imagesSignatures.get(ligne.attId);
    return image?.url ? `<img class="signataire-image" src="${echapper(image.url)}" alt="Signature de ${echapper(signataire.nom)}">` : '';
}

async function signaturesPretes() {
    if (avecSignatures) {
        await Promise.all(configActive().parametres.signataires.map(chargerImageSignature));
    }
}

// Case « Signatures scannées » : proposée dès qu'un signataire a une signature
function majOptionSignatures() {
    $('option-signatures').hidden = !configActive().parametres.signataires.some(s => s.signature != null);
}

// Listes déroulantes et aide du panneau de configuration
function majSignaturesConfiguration() {
    if (brouillon) {
        for (const select of $('p-signataires').querySelectorAll('select[data-champ="signature"]')) {
            select.innerHTML = optionsSignature(brouillon.parametres.signataires[Number(select.closest('.signataire-edition').dataset.index)]);
        }
    }

    const nb = signatures.liste.length;
    $('aide-signatures').innerHTML = {
        chargement: `Lecture de la table « ${TABLE_SIGNATURES} »…`,
        ok: `${nb} ${plur(nb, 'signature disponible', 'signatures disponibles')} dans la table « ${TABLE_SIGNATURES} ». Les images restent dans le document Grist : elles ne sont lues qu’avec un accès au document.`,
        absente: `Pour apposer des signatures scannées, créez une table « ${TABLE_SIGNATURES} » avec une colonne <code>Nom</code> (Texte) et une colonne Pièces jointes contenant l’image (PNG à fond transparent de préférence). Restreignez son accès avec les règles d’accès si besoin.`,
        erreur: `Table « ${TABLE_SIGNATURES} » illisible (règles d’accès ?) : les attestations sont imprimées sans signature scannée, avec l’espace pour signer à la main.`,
    }[signatures.etat];
}

function optionsSignature(signataire) {
    const choisie = signataire?.signature ?? null;
    const options = [`<option value="">${signatures.etat === 'chargement' ? 'Chargement…' : 'Sans signature scannée'}</option>`]
        .concat(signatures.liste.map(s => `<option value="${s.id}"${s.id === choisie ? ' selected' : ''}>${echapper(s.libelle)}</option>`));
    // Signature enregistrée mais introuvable (ligne supprimée, accès refusé) : conservée telle quelle
    if (choisie != null && !signatures.liste.some(s => s.id === choisie)) {
        options.push(`<option value="${choisie}" selected>Signature introuvable (n° ${choisie})</option>`);
    }
    return options.join('');
}

// ---------- Texte personnalisé ----------

function afficherPanneauTexte(d) {
    $('panneau-texte').hidden = false;
    $('texte-pour').textContent = d.identite;
    const zone = $('texte-perso');
    // Ne pas écraser la saisie en cours
    if (document.activeElement !== zone || zone.dataset.rowId !== String(d.id)) {
        if (zone.value !== d.texte_personnalise) {
            zone.value = d.texte_personnalise;
        }
        zone.dataset.rowId = String(d.id);
    }
    $('aide-texte').innerHTML = source.texteAssocie()
        ? 'Enregistré dans Grist pour ce clinicien. Placé à l’emplacement <code>{{texte_personnalise}}</code> du modèle (sinon à la fin).'
        : '⚠ Non conservé : associez la colonne facultative « Texte personnalisé » du widget pour l’enregistrer dans Grist.';
}

function changerClinicien(record, colonnesOk) {
    if (saisieTexte && record?.id !== clinicien?.id) {
        enregistrerTexte();
    }
    clinicien = record;
    colonnesAssociees = colonnesOk;
    afficher();
}

function etatChampTexte(etat) {
    const champ = $('champ-texte');
    champ.classList.remove('enregistrement', 'enregistre', 'erreur');
    if (etat) {
        champ.classList.add(etat);
    }
}

function surSaisieTexte() {
    const zone = $('texte-perso');
    const rowId = Number(zone.dataset.rowId);
    textesLocaux.set(rowId, zone.value);
    etatChampTexte(null);
    clearTimeout(saisieTexte?.minuteur);
    saisieTexte = { rowId, minuteur: setTimeout(enregistrerTexte, DELAI_ENREGISTREMENT_TEXTE_MS) };
    afficher();
}

async function enregistrerTexte() {
    if (!saisieTexte) {
        return;
    }
    const { rowId, minuteur } = saisieTexte;
    clearTimeout(minuteur);
    saisieTexte = null;
    // Colonne non associée : le texte reste en mémoire le temps de la session
    if (!source.texteAssocie()) {
        return;
    }
    const valeur = textesLocaux.get(rowId);
    const courant = () => clinicien?.id === rowId;
    if (courant()) {
        etatChampTexte('enregistrement');
    }
    try {
        await source.enregistrerTexte(rowId, valeur);
        // Une saisie plus récente reste prioritaire sur la valeur relue depuis Grist
        if (textesLocaux.get(rowId) === valeur && !(saisieTexte?.rowId === rowId)) {
            textesLocaux.delete(rowId);
        }
        if (courant()) {
            etatChampTexte('enregistre');
            setTimeout(() => $('champ-texte').classList.remove('enregistre'), 2000);
        }
    } catch (e) {
        console.error('Enregistrement du texte personnalisé impossible :', e);
        if (courant()) {
            etatChampTexte('erreur');
        }
    }
}

// ---------- Panneau de configuration ----------

function ouvrirConfiguration() {
    if (brouillon) {
        $('config').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }
    brouillon = cloner(config);
    const applique = clinicien && colonnesAssociees ? modelePour(donnees(clinicien, config), config) : null;
    idModeleEdite = applique?.id ?? brouillon.modeles[0]?.id ?? null;
    $('config').hidden = false;
    document.body.classList.add('config-ouverte');
    // Relecture de la table Signatures : une signature a pu être ajoutée depuis le chargement
    chargerSignatures();
    $('ouvrir-config').setAttribute('aria-expanded', 'true');
    rendreConfiguration();
    afficher();
}

function fermerConfiguration() {
    if (configModifiee() && !confirm('Abandonner les modifications non enregistrées des modèles ?')) {
        return;
    }
    brouillon = null;
    idModeleEdite = null;
    $('config').hidden = true;
    document.body.classList.remove('config-ouverte');
    $('ouvrir-config').setAttribute('aria-expanded', 'false');
    afficher();
}

function configModifiee() {
    return Boolean(brouillon) && JSON.stringify(brouillon) !== JSON.stringify(config);
}

function modeleEdite() {
    return brouillon?.modeles.find(m => m.id === idModeleEdite) ?? null;
}

function etatConfiguration(texteEtat = null, classe = '') {
    const etat = $('etat-config');
    const modifie = configModifiee();
    etat.textContent = texteEtat ?? (modifie ? 'Modifications non enregistrées' : 'Aucune modification');
    etat.className = 'etat-config ' + (classe || (modifie ? 'modifie' : ''));
    $('enregistrer-config').disabled = !modifie;
}

// Changement du brouillon : liste, état et aperçu mis à jour, formulaire conservé (saisie en cours)
function brouillonModifie() {
    rendreListeModeles();
    etatConfiguration();
    afficher();
}

function rendreConfiguration() {
    rendreListeModeles();
    remplirFormulaireModele();
    remplirParametres();
    etatConfiguration();
}

function rendreListeModeles() {
    const d = clinicien && colonnesAssociees ? donnees(clinicien, brouillon) : null;
    const auto = d ? modeleAutomatique(d, brouillon) : null;
    const nb = brouillon.modeles.length;

    $('liste-modeles').innerHTML = nb ? brouillon.modeles.map((m, i) => `
        <li class="modele-item${m.id === idModeleEdite ? ' edite' : ''}" data-id="${echapper(m.id)}">
            <span class="modele-rang">${i + 1}</span>
            <span class="modele-texte">
                <span class="modele-nom">${echapper(m.nom || 'Sans nom')}</span>
                <span class="modele-condition">${echapper(resumeCondition(m.condition))}</span>
                ${auto?.id === m.id ? `<span class="modele-badge" title="Modèle choisi automatiquement pour ${echapper(d.identite)}">Appliqué au clinicien sélectionné</span>` : ''}
            </span>
            <span class="modele-actions">
                <button type="button" class="btn-icone" data-action="monter" title="Monter (prioritaire)" ${i === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" class="btn-icone" data-action="descendre" title="Descendre" ${i === nb - 1 ? 'disabled' : ''}>↓</button>
                <button type="button" class="btn-icone" data-action="dupliquer" title="Dupliquer">⧉</button>
                <button type="button" class="btn-icone" data-action="supprimer" title="Supprimer">✕</button>
            </span>
        </li>`).join('') : '<li class="aide">Aucun modèle : ajoutez-en un.</li>';
}

function remplirFormulaireModele() {
    const modele = modeleEdite();
    $('edition-modele').hidden = !modele;
    if (!modele) {
        return;
    }
    $('m-nom').value = modele.nom;
    $('m-critere').value = modele.condition.critere;
    $('m-min').value = modele.condition.min ?? '';
    $('m-max').value = modele.condition.max ?? '';
    $('m-titre').value = modele.titre;
    $('m-corps').value = modele.corps;
    $('m-resume').textContent = resumeCondition(modele.condition);
}

function remplirParametres() {
    const p = brouillon.parametres;
    $('p-annee').value = p.annee_universitaire;
    $('p-annee').placeholder = `Automatique : ${anneeUniversitaire(new Date())}`;
    $('p-lieu').value = p.lieu;
    $('p-signataires').innerHTML = p.signataires.map((s, i) => `
        <div class="signataire-edition" data-index="${i}">
            <input type="text" data-champ="nom" value="${echapper(s.nom)}" placeholder="Prénom NOM" aria-label="Nom du signataire ${i + 1}">
            <select data-champ="signature" aria-label="Signature scannée du signataire ${i + 1}">${optionsSignature(s)}</select>
            <button type="button" class="btn-icone" data-action="retirer" title="Retirer ce signataire">✕</button>
            <input type="text" class="signataire-qualite" data-champ="qualite" value="${echapper(s.qualite)}" placeholder="Qualité" aria-label="Qualité du signataire ${i + 1}">
        </div>`).join('') || '<p class="aide">Aucun signataire : aucun bloc de signature sur l’attestation.</p>';
    majSignaturesConfiguration();
}

function selectionnerModele(id) {
    idModeleEdite = id;
    rendreListeModeles();
    remplirFormulaireModele();
    afficher();
}

function actionModele(action, id) {
    const modeles = brouillon.modeles;
    const i = modeles.findIndex(m => m.id === id);
    if (i < 0) {
        return;
    }
    if (action === 'monter' && i > 0) {
        [modeles[i - 1], modeles[i]] = [modeles[i], modeles[i - 1]];
    } else if (action === 'descendre' && i < modeles.length - 1) {
        [modeles[i + 1], modeles[i]] = [modeles[i], modeles[i + 1]];
    } else if (action === 'dupliquer') {
        const copie = { ...cloner(modeles[i]), id: nouvelId(), nom: `${modeles[i].nom} (copie)` };
        modeles.splice(i + 1, 0, copie);
        idModeleEdite = copie.id;
    } else if (action === 'supprimer') {
        if (!confirm(`Supprimer le modèle « ${modeles[i].nom || 'Sans nom'} » ?`)) {
            return;
        }
        modeles.splice(i, 1);
        if (idModeleEdite === id) {
            idModeleEdite = modeles[Math.min(i, modeles.length - 1)]?.id ?? null;
        }
    }
    remplirFormulaireModele();
    brouillonModifie();
}

async function enregistrerConfiguration() {
    const bouton = $('enregistrer-config');
    bouton.disabled = true;
    etatConfiguration('Enregistrement…', '');
    const aEnregistrer = normaliserConfig(cloner(brouillon));
    try {
        await source.enregistrerOptions({ modeles: aEnregistrer.modeles, parametres: aEnregistrer.parametres });
        config = cloner(aEnregistrer);
        brouillon = cloner(aEnregistrer);
        etatConfiguration('✓ Modèles enregistrés', '');
        afficher();
    } catch (e) {
        console.error('Enregistrement des modèles impossible :', e);
        etatConfiguration('Enregistrement impossible (droits d’édition du document requis)', 'erreur');
        bouton.disabled = false;
    }
}

// ---------- Événements ----------

function brancherInterface() {
    // Hauteur de la barre d'outils collante : position de l'aperçu collant pendant la configuration
    const barre = document.querySelector('.barre-outils');
    new ResizeObserver(() => document.body.style.setProperty('--hauteur-barre', barre.offsetHeight + 'px')).observe(barre);

    $('imprimer').addEventListener('click', imprimer);
    $('avec-signatures').addEventListener('change', e => {
        avecSignatures = e.target.checked;
        afficher();
    });
    $('actualiser-signatures').addEventListener('click', chargerSignatures);
    $('imprimer-tout').addEventListener('click', imprimerTout);

    $('choix-modele').addEventListener('change', e => {
        choixManuel = e.target.value;
        afficher();
    });

    $('texte-perso').addEventListener('input', surSaisieTexte);
    $('texte-perso').addEventListener('blur', enregistrerTexte);
    window.addEventListener('beforeunload', enregistrerTexte);

    $('ouvrir-config').addEventListener('click', () => (brouillon ? fermerConfiguration() : ouvrirConfiguration()));
    $('fermer-config').addEventListener('click', fermerConfiguration);
    $('enregistrer-config').addEventListener('click', enregistrerConfiguration);

    $('m-critere').innerHTML = Object.entries(CRITERES).map(([cle, c]) => `<option value="${cle}">${echapper(c.libelle)}</option>`).join('');

    $('liste-modeles').addEventListener('click', e => {
        const item = e.target.closest('.modele-item');
        if (!item) {
            return;
        }
        const bouton = e.target.closest('[data-action]');
        if (bouton) {
            actionModele(bouton.dataset.action, item.dataset.id);
        } else if (item.dataset.id !== idModeleEdite) {
            selectionnerModele(item.dataset.id);
        }
    });

    $('ajouter-modele').addEventListener('click', () => {
        const modele = {
            id: nouvelId(),
            nom: 'Nouveau modèle',
            condition: { critere: 'total', min: 1, max: null },
            titre: 'Attestation de participation à la Clinique juridique',
            corps: [INTRODUCTION, PRESENTATION, '{{activites}}', '{{texte_personnalise}}', CONCLUSION].join('\n\n'),
        };
        brouillon.modeles.push(modele);
        idModeleEdite = modele.id;
        remplirFormulaireModele();
        brouillonModifie();
        $('m-nom').select();
    });

    $('restaurer-modeles').addEventListener('click', () => {
        if (!confirm('Remplacer tous les modèles par les modèles par défaut ? (les paramètres communs sont conservés)')) {
            return;
        }
        brouillon.modeles = cloner(MODELES_DEFAUT);
        idModeleEdite = brouillon.modeles[0].id;
        remplirFormulaireModele();
        brouillonModifie();
    });

    // Champs du modèle sélectionné
    const champsModele = {
        'm-nom': (m, v) => { m.nom = v; },
        'm-titre': (m, v) => { m.titre = v; },
        'm-corps': (m, v) => { m.corps = v; },
        'm-critere': (m, v) => { m.condition.critere = v; },
        'm-min': (m, v) => { m.condition.min = entierOuNull(v); },
        'm-max': (m, v) => { m.condition.max = entierOuNull(v); },
    };
    for (const [id, appliquer] of Object.entries(champsModele)) {
        $(id).addEventListener('input', e => {
            const modele = modeleEdite();
            if (!modele) {
                return;
            }
            appliquer(modele, e.target.value);
            $('m-resume').textContent = resumeCondition(modele.condition);
            brouillonModifie();
        });
    }

    // Insertion des variables dans le dernier champ (titre ou texte) utilisé
    for (const id of ['m-titre', 'm-corps']) {
        $(id).addEventListener('focus', e => { dernierChampModele = e.target; });
    }
    $('variables').innerHTML = VARIABLES.map(v =>
        `<button type="button" class="variable" data-cle="${v.cle}" title="${echapper(v.libelle)}${v.bloc ? ' (seul dans son paragraphe)' : ''}">${echapper(v.libelle)}</button>`
    ).join('');
    $('variables').addEventListener('mousedown', e => e.preventDefault()); // garde le curseur dans le champ
    $('variables').addEventListener('click', e => {
        const bouton = e.target.closest('.variable');
        if (!bouton) {
            return;
        }
        const variable = VARIABLES_PAR_CLE[bouton.dataset.cle];
        const zone = dernierChampModele ?? $('m-corps');
        const jeton = `{{${variable.cle}}}`;
        zone.setRangeText(variable.bloc && zone.id === 'm-corps' ? `\n\n${jeton}\n\n` : jeton, zone.selectionStart, zone.selectionEnd, 'end');
        zone.focus();
        zone.dispatchEvent(new Event('input'));
    });

    // Paramètres communs
    $('p-annee').addEventListener('input', e => {
        brouillon.parametres.annee_universitaire = e.target.value;
        brouillonModifie();
    });
    $('p-lieu').addEventListener('input', e => {
        brouillon.parametres.lieu = e.target.value;
        brouillonModifie();
    });
    $('p-signataires').addEventListener('input', e => {
        const ligne = e.target.closest('.signataire-edition');
        if (ligne && e.target.dataset.champ) {
            const champ = e.target.dataset.champ;
            brouillon.parametres.signataires[Number(ligne.dataset.index)][champ] = champ === 'signature' ? entierOuNull(e.target.value) : e.target.value;
            majSignaturesConfiguration();
            brouillonModifie();
        }
    });
    $('p-signataires').addEventListener('click', e => {
        const ligne = e.target.closest('.signataire-edition');
        if (ligne && e.target.closest('[data-action="retirer"]')) {
            brouillon.parametres.signataires.splice(Number(ligne.dataset.index), 1);
            remplirParametres();
            brouillonModifie();
        }
    });
    $('ajouter-signataire').addEventListener('click', () => {
        brouillon.parametres.signataires.push({ nom: '', qualite: '', signature: null });
        remplirParametres();
        brouillonModifie();
        $('p-signataires').querySelector('.signataire-edition:last-child input')?.focus();
    });
}
