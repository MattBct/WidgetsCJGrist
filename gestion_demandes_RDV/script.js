const FUSEAU = 'Europe/Paris';

// Valeurs écrites dans la colonne Statut_RDV par les boutons « Confirmer le RDV » et « Rejeter le RDV ».
// Elles doivent faire sortir la demande du filtre de la vue Grist : la carte disparaît alors de la liste.
const STATUT_CONFIRME = 'Confirmé';
const STATUT_REJETE = 'Rejeté';

// Boutons de changement de statut (attribut data-action dans le modèle de carte)
const ACTIONS_STATUT = {
    confirmer: { statut: STATUT_CONFIRME, libelle: 'Confirmer le RDV', enCours: 'Confirmation…', fait: 'RDV confirmé ✓', classe: 'confirmee' },
    rejeter: { statut: STATUT_REJETE, libelle: 'Rejeter le RDV', enCours: 'Rejet…', fait: 'RDV rejeté', classe: 'rejetee' },
};

const COLONNES = [
    { name: "id_rdv_clinique", title: "Identifiant du RDV", type: "Text", optional: false },
    { name: "Nom_patient", title: "Nom du patient", type: "Text", optional: false },
    { name: "Prenom_patient", title: "Prénom du patient", type: "Text", optional: false },
    { name: "Mail_patient", title: "Mail du patient", type: "Text", optional: false },
    { name: "Telephone_patient", title: "Téléphone du patient", type: "Text", optional: false },
    { name: "Creneau_RDV_1", title: "Créneau RDV 1", type: "DateTime", optional: false, description: "Créneau horaire du premier rendez-vous" },
    { name: "Lieu_RDV_1", title: "Lieu RDV 1", type: "Ref,Choice", optional: false, description: "Salle du premier rendez-vous (colonne Référence ou Choix)" },
    { name: "Creneau_RDV_2", title: "Créneau RDV 2", type: "DateTime", optional: false, description: "Créneau horaire du deuxième rendez-vous" },
    { name: "Lieu_RDV_2", title: "Lieu RDV 2", type: "Ref,Choice", optional: false, description: "Salle du deuxième rendez-vous (colonne Référence ou Choix)" },
    { name: "Visioconference", title: "Visioconférence", type: "Bool", optional: false },
    { name: "Commentaires", title: "Commentaires", type: "Text", optional: false },
    { name: "Motif_RDV", title: "Motif du RDV (patient)", type: "Text", optional: false, description: "Motif détaillé rédigé par le patient" },
    { name: "Motifs_standardises", title: "Motifs standardisés", type: "ChoiceList,Text", optional: false, description: "Motifs standardisés (colonne Choix multiples), affichés en pastilles aux couleurs définies dans Grist" },
    { name: "Etudiant", title: "RDV étudiant", type: "Bool", optional: false, description: "Modifiable ; si coché, affiche la mention « Financé par la CVEC » et l'établissement" },
    { name: "Etablissement_COMUE", title: "Établissement COMUE", type: "Choice", optional: false, description: "Établissement de l'étudiant, modifiable si RDV étudiant" },
    { name: "Statut_RDV", title: "Statut de la demande", type: "Choice,Text", optional: false, description: `Colonne filtrée dans la vue ; reçoit « ${STATUT_CONFIRME} » ou « ${STATUT_REJETE} » via les boutons du widget` },
];

// Nature de chaque champ modifiable : pilote la conversion saisie <-> valeur Grist
const TYPES_CHAMPS = {
    Mail_patient: 'texte',
    Telephone_patient: 'texte',
    Commentaires: 'texte',
    Motif_RDV: 'texte',
    Etablissement_COMUE: 'choix',
    Creneau_RDV_1: 'date',
    Creneau_RDV_2: 'date',
    Lieu_RDV_1: 'lieu',
    Lieu_RDV_2: 'lieu',
    Visioconference: 'bool',
    Etudiant: 'bool',
};

const EMAIL_VALIDE = /^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

// Domaines fréquents : une adresse sur un domaine très proche déclenche une suggestion de correction
const DOMAINES_COURANTS = [
    'gmail.com', 'hotmail.fr', 'hotmail.com', 'outlook.fr', 'outlook.com', 'live.fr', 'yahoo.fr', 'yahoo.com',
    'icloud.com', 'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'laposte.net', 'univ-lyon3.fr', 'univ-lyon2.fr',
];

// Hors de Grist (fichier ouvert directement, ou ?demo), le widget tourne sur des données fictives
const MODE_DEMO = typeof grist === 'undefined' || window.self === window.top || new URLSearchParams(location.search).has('demo');

const source = MODE_DEMO ? creerSourceDemo() : creerSourceGrist();

const cartes = new Map();       // rowId -> { element, dossier }
const enCours = new Map();      // "rowId:champ" -> valeur en cours d'enregistrement (non écrasée par une mise à jour Grist)
const saisiesRefusees = new Set(); // "rowId:champ" dont la saisie invalide n'a pas été enregistrée (conservée à l'écran)
let options = null;             // { lieux: { Lieu_RDV_1: { type, choix } }, statuts }
let chargementOptions = null;
let fileEcritures = Promise.resolve();
let ordreEnAttente = null;
let rowIdSelectionne = null;

const liste = document.getElementById('liste');

source.demarrer(async (dossiers, rechargerOptions) => {
    if (!chargementOptions || rechargerOptions) {
        chargementOptions = source.chargerOptions().catch(e => {
            console.warn('Impossible de charger la liste des lieux :', e);
            return null;
        });
    }
    options = await chargementOptions;
    afficher(dossiers);
});

// ---------- Sources de données ----------

function creerSourceGrist() {
    let mappings = null;

    return {
        demarrer(surDonnees) {
            // Accès complet : écriture dans la table et lecture des métadonnées (liste des salles, choix du statut)
            grist.ready({ requiredAccess: 'full', columns: COLONNES, allowSelectBy: true });
            grist.onRecords((records, nouvellesMappings) => {
                const modifiees = JSON.stringify(nouvellesMappings) !== JSON.stringify(mappings);
                mappings = nouvellesMappings;
                surDonnees(grist.mapColumnNames(records), modifiees);
            });
        },

        async enregistrer(rowId, champs) {
            const fields = {};
            for (const [nom, valeur] of Object.entries(champs)) {
                fields[mappings[nom]] = valeur;
            }
            await grist.selectedTable.update({ id: rowId, fields });
        },

        // Lit les métadonnées du document pour proposer toutes les salles (colonne Référence)
        // ou tous les choix (colonne Choix), et vérifier que le statut de confirmation existe.
        async chargerOptions() {
            if (!mappings) {
                return null;
            }
            const tableId = await (grist.selectedTable.getTableId?.() ?? grist.getSelectedTableId?.());
            const [tables, colonnes] = await Promise.all([
                grist.docApi.fetchTable('_grist_Tables'),
                grist.docApi.fetchTable('_grist_Tables_column'),
            ]);
            const tableRef = tables.id[tables.tableId.indexOf(tableId)];
            const trouverColonne = colId => colonnes.id.findIndex((_, i) => colonnes.parentId[i] === tableRef && colonnes.colId[i] === colId);
            const lireWidgetOptions = i => {
                try {
                    return JSON.parse(colonnes.widgetOptions[i] || '{}');
                } catch {
                    return {};
                }
            };

            const tablesCibles = new Map();
            const lieux = {};
            for (const champ of Object.keys(TYPES_CHAMPS).filter(c => TYPES_CHAMPS[c] === 'lieu')) {
                const i = trouverColonne(mappings[champ]);
                if (i < 0) {
                    continue;
                }
                const type = colonnes.type[i];
                if (!type.startsWith('Ref:')) {
                    lieux[champ] = { type: 'choice', choix: (lireWidgetOptions(i).choices || []).map(c => ({ valeur: c, libelle: c })) };
                    continue;
                }
                const tableCible = type.slice(4);
                const iVisible = colonnes.id.indexOf(colonnes.visibleCol[i]);
                const colVisible = iVisible >= 0 ? colonnes.colId[iVisible] : null;
                const cle = `${tableCible}.${colVisible}`;
                if (!tablesCibles.has(cle)) {
                    tablesCibles.set(cle, grist.docApi.fetchTable(tableCible).then(table => table.id
                        .map((id, k) => ({ valeur: id, libelle: String(colVisible ? table[colVisible][k] ?? '' : `${tableCible} ${id}`).trim() }))
                        .filter(c => c.libelle)
                        .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr', { numeric: true }))));
                }
                lieux[champ] = { type: 'ref', choix: await tablesCibles.get(cle) };
            }

            const iEtablissement = trouverColonne(mappings.Etablissement_COMUE);
            const etablissements = iEtablissement >= 0 ? (lireWidgetOptions(iEtablissement).choices || []) : [];

            const iStatut = trouverColonne(mappings.Statut_RDV);
            const statuts = iStatut >= 0 && colonnes.type[iStatut] === 'Choice' ? (lireWidgetOptions(iStatut).choices || []) : null;
            // Motifs standardisés : choix proposés et couleurs des pastilles, tels que définis dans Grist
            const iMotifs = trouverColonne(mappings.Motifs_standardises);
            const optionsMotifs = iMotifs >= 0 ? lireWidgetOptions(iMotifs) : {};
            const motifs = {
                type: iMotifs >= 0 && colonnes.type[iMotifs] !== 'ChoiceList' ? 'texte' : 'liste',
                choix: optionsMotifs.choices || [],
                styles: optionsMotifs.choiceOptions || {},
            };
            return { lieux, statuts, motifs, etablissements };
        },

        selectionner(rowId) {
            grist.setCursorPos({ rowId }).catch(() => {});
        },
    };
}

function creerSourceDemo() {
    const STATUT_DEMANDE = 'Demande non traitée';
    const salles = [
        { valeur: 1, libelle: 'Salle Portalis' },
        { valeur: 2, libelle: 'Salle Cambacérès' },
        { valeur: 3, libelle: 'Salle Montesquieu' },
        { valeur: 4, libelle: 'Salle du conseil' },
        { valeur: 5, libelle: 'Bureau 2.14' },
    ];
    const date = (jour, heures, minutes = 0) => new Date(Date.UTC(2026, 9, jour, heures - 2, minutes));
    const dossiers = [
        { id: 41, Motif_RDV: "Mon propriétaire refuse de me rendre mon dépôt de garantie (850 €) alors que l'état des lieux de sortie ne mentionne aucune dégradation. J'ai quitté le logement il y a trois mois et il ne répond plus à mes relances par mail ni par courrier.\nJe voudrais savoir quels sont mes recours et s'il faut passer par une mise en demeure avant de saisir le tribunal.", Motifs_standardises: ['Logement', 'Consommation'], id_rdv_clinique: 'K7QXM', Nom_patient: 'MARTIN', Prenom_patient: 'Camille', Mail_patient: 'camille.martin@exemple.fr', Telephone_patient: '06 12 34 56 78', Creneau_RDV_1: date(6, 14), Lieu_RDV_1: 1, Creneau_RDV_2: null, Lieu_RDV_2: 0, Visioconference: false, Commentaires: 'Souhaite un RDV en fin de journée.', Statut_RDV: STATUT_DEMANDE },
        { id: 42, Motif_RDV: "Contestation d'une rupture de période d'essai.", Motifs_standardises: ['Travail'], id_rdv_clinique: '3HPAT', Nom_patient: 'NGUYEN', Prenom_patient: 'Thomas', Mail_patient: '', Telephone_patient: '07 45 21 98 03', Creneau_RDV_1: date(7, 10, 30), Lieu_RDV_1: 3, Creneau_RDV_2: date(21, 10, 30), Lieu_RDV_2: 3, Visioconference: true, Commentaires: '', Etudiant: true, Etablissement_COMUE: 'Université Lumière Lyon 2', Statut_RDV: STATUT_DEMANDE },
        { id: 43, Motif_RDV: "Litige avec mon bailleur social concernant des charges locatives régularisées sur trois ans d'un coup. Le montant réclamé représente plus de deux mois de loyer et je n'ai reçu aucun justificatif malgré ma demande écrite.", Motifs_standardises: ['Logement'], id_rdv_clinique: 'WD9RC', Nom_patient: 'BERNARD', Prenom_patient: 'Léa', Mail_patient: 'lea.bernard@exemple.org', Telephone_patient: '', Creneau_RDV_1: null, Lieu_RDV_1: 0, Creneau_RDV_2: null, Lieu_RDV_2: 0, Visioconference: false, Commentaires: 'Litige bailleur — pièces transmises par mail.', Statut_RDV: STATUT_DEMANDE },
        { id: 44, Motif_RDV: "", Motifs_standardises: [], id_rdv_clinique: 'B4NZE', Nom_patient: 'HADDAD', Prenom_patient: 'Yanis', Mail_patient: '', Telephone_patient: '', Creneau_RDV_1: date(8, 9), Lieu_RDV_1: 0, Creneau_RDV_2: null, Lieu_RDV_2: 0, Visioconference: false, Commentaires: 'Demande déposée à l’accueil, coordonnées non laissées.', Etudiant: true, Etablissement_COMUE: '', Statut_RDV: STATUT_DEMANDE },
        { id: 45, Motif_RDV: "Renouvellement de titre de séjour étudiant : la préfecture m'a délivré un récépissé qui expire avant la date du rendez-vous qu'elle m'a fixé. Je crains de perdre mon droit de travailler en parallèle de mes études.", Motifs_standardises: ['Droit des étrangers', 'Administratif'], id_rdv_clinique: 'Q2UFL', Nom_patient: 'LEROY', Prenom_patient: 'Inès', Mail_patient: 'ines.leroy@exemple', Telephone_patient: '06 98 76 54 32', Creneau_RDV_1: date(9, 11), Lieu_RDV_1: 2, Creneau_RDV_2: date(23, 11), Lieu_RDV_2: 4, Visioconference: false, Commentaires: '', Etudiant: true, Etablissement_COMUE: 'Université Jean Moulin Lyon 3', Statut_RDV: STATUT_DEMANDE },
    ];

    let surDonnees = null;
    // Simule le filtre de la vue Grist sur le statut
    const publier = () => surDonnees(structuredClone(dossiers.filter(d => d.Statut_RDV === STATUT_DEMANDE)), false);

    return {
        demarrer(callback) {
            surDonnees = callback;
            afficherBandeau('info', 'Mode démonstration : données fictives, les enregistrements sont simulés.');
            publier();
        },

        async enregistrer(rowId, champs) {
            await new Promise(resolve => setTimeout(resolve, 350));
            Object.assign(dossiers.find(d => d.id === rowId), champs);
            const detail = Object.entries(champs).map(([nom, valeur]) => `${nom} = ${JSON.stringify(valeur)}`).join(', ');
            afficherBandeau('info', `Mode démonstration : données fictives. Dernière écriture simulée : UpdateRecord ligne ${rowId} → ${detail}`);
            publier();
        },

        async chargerOptions() {
            return {
                lieux: { Lieu_RDV_1: { type: 'ref', choix: salles }, Lieu_RDV_2: { type: 'ref', choix: salles } },
                statuts: [STATUT_DEMANDE, STATUT_CONFIRME, STATUT_REJETE],
                etablissements: [
                    'Université Claude Bernard Lyon 1', 'Université Lumière Lyon 2', 'Université Jean Moulin Lyon 3',
                    'Université Jean Monnet Saint-Étienne', 'ENS de Lyon', 'INSA Lyon', 'École Centrale de Lyon', 'Sciences Po Lyon',
                ],
                motifs: {
                    type: 'liste',
                    choix: ['Logement', 'Travail', 'Famille', 'Consommation', 'Droit des étrangers', 'Administratif', 'Pénal'],
                    styles: {
                    'Logement': { fillColor: '#DCEBFF', textColor: '#1F4E8C' },
                    'Consommation': { fillColor: '#FFE8CC', textColor: '#8A4B00' },
                    'Travail': { fillColor: '#DFF3E4', textColor: '#1E6B35' },
                    'Droit des étrangers': { fillColor: '#EDE3FF', textColor: '#5B2E9E' },
                    'Administratif': { fillColor: '#E6E6E6', textColor: '#3A3A3A' },
                    },
                },
            };
        },

        selectionner() {},
    };
}

// ---------- Dates (toujours exprimées dans le fuseau de Paris) ----------

function versDate(valeur) {
    if (valeur instanceof Date) {
        return isNaN(valeur.getTime()) ? null : valeur;
    }
    if (typeof valeur === 'number' && valeur !== 0) {
        return new Date(valeur * 1000);
    }
    return null;
}

const FORMAT_PARIS = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSEAU, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

function partiesParis(date) {
    const parties = Object.fromEntries(FORMAT_PARIS.formatToParts(date).map(p => [p.type, p.value]));
    return { annee: parties.year, mois: parties.month, jour: parties.day, heure: parties.hour, minute: parties.minute };
}

// Date -> "AAAA-MM-JJTHH:MM" (heure de Paris) pour un <input type="datetime-local">
function versSaisieDate(date) {
    const p = partiesParis(date);
    return `${p.annee}-${p.mois}-${p.jour}T${p.heure}:${p.minute}`;
}

// "AAAA-MM-JJTHH:MM" (heure de Paris) -> horodatage Grist (secondes UTC)
function depuisSaisieDate(texte) {
    const [a, mo, j, h, mi] = texte.split(/[-T:]/).map(Number);
    const murale = Date.UTC(a, mo - 1, j, h, mi);
    const decalage = instant => {
        const p = partiesParis(new Date(instant));
        return Date.UTC(p.annee, p.mois - 1, p.jour, p.heure, p.minute) - instant;
    };
    // Deux passes pour tomber juste autour des changements d'heure
    let instant = murale - decalage(murale);
    instant = murale - decalage(instant);
    return Math.round(instant / 1000);
}

// ---------- Conversion saisie <-> valeur Grist ----------

// Une référence peut arriver sous forme d'identifiant, d'objet Reference ({tableId, rowId})
// ou de texte (colonne Choix). Retourne { id, libelle }, ou null si vide.
function lireReference(valeur) {
    if (valeur === null || valeur === undefined || valeur === '' || valeur === 0) {
        return null;
    }
    if (typeof valeur === 'number') {
        return { id: String(valeur), libelle: '' };
    }
    if (typeof valeur === 'object') {
        const id = valeur.rowId ?? valeur.id;
        return id ? { id: String(id), libelle: '' } : null;
    }
    const texte = String(valeur).trim();
    return texte ? { id: texte, libelle: texte } : null;
}

function typeLieu(champ, valeur) {
    return options?.lieux?.[champ]?.type ?? (typeof valeur === 'string' ? 'choice' : 'ref');
}

// Valeur Grist -> valeur affichée dans le champ de saisie
function versSaisie(champ, valeur) {
    switch (TYPES_CHAMPS[champ]) {
        case 'date': {
            const date = versDate(valeur);
            return date ? versSaisieDate(date) : '';
        }
        case 'lieu':
            return lireReference(valeur)?.id ?? '';
        case 'bool':
            return valeur === true;
        default:
            return valeur === null || valeur === undefined ? '' : String(valeur);
    }
}

// Valeur saisie -> valeur à écrire dans Grist
function depuisSaisie(champ, saisie, valeurActuelle) {
    switch (TYPES_CHAMPS[champ]) {
        case 'date':
            return saisie ? depuisSaisieDate(saisie) : null;
        case 'lieu':
            if (typeLieu(champ, valeurActuelle) === 'choice') {
                return saisie;
            }
            return saisie ? Number(saisie) : 0;
        case 'bool':
            return saisie === true;
        default:
            return String(saisie).trim();
    }
}

// ---------- Rendu ----------

function plur(n, singulier, pluriel) {
    return Math.abs(n) <= 1 ? singulier : (pluriel ?? singulier + 's');
}

function afficher(dossiers) {
    const message = document.getElementById('message');
    const texteMessage = document.getElementById('message-texte');
    const compteur = document.getElementById('compteur');
    verifierOptions();

    if (!dossiers) {
        cartes.forEach(carte => carte.element.remove());
        cartes.clear();
        compteur.hidden = true;
        document.getElementById('filtres').hidden = true;
        texteMessage.textContent = 'Associez les colonnes du widget dans le panneau de configuration Grist.';
        message.hidden = false;
        return;
    }

    const ids = new Set(dossiers.map(d => d.id));
    for (const [id, carte] of cartes) {
        if (!ids.has(id)) {
            carte.element.remove();
            cartes.delete(id);
        }
    }
    for (const dossier of dossiers) {
        let carte = cartes.get(dossier.id);
        if (!carte) {
            carte = { element: creerCarte(dossier.id) };
            cartes.set(dossier.id, carte);
            liste.appendChild(carte.element);
        }
        carte.dossier = dossier;
        majCarte(carte);
    }
    ordonner(dossiers.map(d => d.id));

    const n = dossiers.length;
    compteur.textContent = `${n} ${plur(n, 'demande')} à traiter`;
    compteur.hidden = n === 0;
    appliquerFiltre();
}

// ---------- Filtre étudiant / non étudiant (dans le widget, en plus du filtre de statut de la vue Grist) ----------

const FILTRES = {
    tous: { garder: () => true, vide: 'Aucune demande de RDV à traiter.' },
    etudiants: { garder: d => d.Etudiant === true, vide: 'Aucune demande étudiante à traiter.' },
    'non-etudiants': { garder: d => d.Etudiant !== true, vide: 'Aucune demande non étudiante à traiter.' },
};
let filtreActif = 'tous';

function appliquerFiltre() {
    const dossiers = [...cartes.values()].map(carte => carte.dossier);
    let visibles = 0;
    for (const carte of cartes.values()) {
        const garder = FILTRES[filtreActif].garder(carte.dossier);
        carte.element.hidden = !garder;
        visibles += garder ? 1 : 0;
    }
    for (const bouton of document.querySelectorAll('.filtre')) {
        const nom = bouton.dataset.filtre;
        bouton.setAttribute('aria-pressed', String(nom === filtreActif));
        bouton.querySelector('.filtre-nombre').textContent = dossiers.filter(FILTRES[nom].garder).length;
    }
    document.getElementById('filtres').hidden = dossiers.length === 0;
    document.getElementById('message-texte').textContent = FILTRES[filtreActif].vide;
    document.getElementById('message').hidden = visibles > 0;
}

document.getElementById('filtres').addEventListener('click', (e) => {
    const bouton = e.target.closest('.filtre');
    if (bouton) {
        filtreActif = bouton.dataset.filtre;
        appliquerFiltre();
    }
});

// Suit l'ordre de tri de la vue Grist. Déplacer la carte en cours d'édition lui ferait perdre le focus :
// le réordonnancement attend alors que l'utilisateur quitte la liste.
function ordonner(ids) {
    const actuel = [...liste.children].map(el => Number(el.dataset.id));
    if (actuel.join() === ids.join()) {
        ordreEnAttente = null;
        return;
    }
    if (liste.contains(document.activeElement)) {
        ordreEnAttente = ids;
        return;
    }
    ids.forEach(id => liste.appendChild(cartes.get(id).element));
    ordreEnAttente = null;
}

function creerCarte(rowId) {
    const element = document.getElementById('modele-carte').content.firstElementChild.cloneNode(true);
    element.dataset.id = rowId;
    return element;
}

function majCarte(carte) {
    const { element, dossier } = carte;
    element.querySelector('.id-rdv').textContent = dossier.id_rdv_clinique || `Demande n°${dossier.id}`;
    element.querySelector('.nom').textContent = String(dossier.Nom_patient || '').toUpperCase();
    element.querySelector('.prenom').textContent = dossier.Prenom_patient || '';

    majMotifsStandardises(element, dossier);


    for (const input of element.querySelectorAll('[data-champ]')) {
        const champ = input.dataset.champ;
        if (input.tagName === 'SELECT') {
            remplirSelect(input, champ, dossier[champ]);
        }
        // Ne jamais écraser une saisie en cours ou pas encore enregistrée
        const cle = `${dossier.id}:${champ}`;
        if (input === document.activeElement || enCours.has(cle) || saisiesRefusees.has(cle)) {
            continue;
        }
        const valeur = versSaisie(champ, dossier[champ]);
        if (input.type === 'checkbox') {
            input.checked = valeur;
        } else {
            input.value = valeur;
        }
        if (input.tagName === 'TEXTAREA') {
            ajusterHauteur(input);
        }
    }
    // Validation une fois tous les champs à jour : les créneaux se valident l'un par rapport à l'autre
    revalider(element);

    // Vue non filtrée sur le statut : la demande traitée reste affichée, boutons désactivés
    const traitee = Object.values(ACTIONS_STATUT).some(action => action.statut === dossier.Statut_RDV);
    for (const [nom, action] of Object.entries(ACTIONS_STATUT)) {
        const actif = dossier.Statut_RDV === action.statut;
        const bouton = element.querySelector(`[data-action="${nom}"]`);
        element.classList.toggle(action.classe, actif);
        bouton.hidden = traitee && !actif;
        if (traitee) {
            bouton.disabled = true;
            bouton.textContent = actif ? action.fait : action.libelle;
        }
    }
    majAlertes(element);
}

// ChoiceList Grist (liste, éventuellement encodée ['L', ...]) ou texte séparé par des virgules
function lireListe(valeur) {
    if (Array.isArray(valeur)) {
        return (valeur[0] === 'L' ? valeur.slice(1) : valeur).map(v => String(v).trim()).filter(Boolean);
    }
    if (typeof valeur === 'string') {
        return valeur.split(/[,;\n]/).map(v => v.trim()).filter(Boolean);
    }
    return [];
}

// Motifs standardisés : pastilles retirables (×) + liste « Ajouter un motif » avec les choix restants
function typeMotifs(valeur) {
    return options?.motifs?.type ?? (typeof valeur === 'string' ? 'texte' : 'liste');
}

function afficherMotifs(zone, motifs) {
    const choix = options?.motifs?.choix ?? [];
    const signature = JSON.stringify([motifs, choix]);
    if (zone.dataset.signature === signature) {
        return;
    }
    zone.dataset.signature = signature;
    zone.dataset.motifs = JSON.stringify(motifs);

    const pastilles = motifs.map(motif => {
        const pastille = document.createElement('span');
        const style = options?.motifs?.styles?.[motif];
        pastille.className = 'motif-pastille';
        pastille.textContent = motif;
        if (style?.fillColor) {
            pastille.style.background = style.fillColor;
        }
        if (style?.textColor) {
            pastille.style.color = style.textColor;
        }
        const retirer = document.createElement('button');
        retirer.type = 'button';
        retirer.className = 'motif-retirer';
        retirer.dataset.motif = motif;
        retirer.title = `Retirer « ${motif} »`;
        retirer.setAttribute('aria-label', retirer.title);
        retirer.textContent = '×';
        pastille.append(retirer);
        return pastille;
    });
    const liste = zone.querySelector('.motifs-liste');
    liste.replaceChildren(...pastilles);
    liste.classList.toggle('vide', motifs.length === 0);

    const restants = choix.filter(c => !motifs.includes(c));
    const ajout = zone.querySelector('.motif-ajout');
    ajout.replaceChildren(new Option('+ Ajouter un motif', ''), ...restants.map(c => new Option(c, c)));
    ajout.hidden = restants.length === 0;
}

function majMotifsStandardises(element, dossier) {
    // Ne pas écraser un ajout / retrait en cours d'enregistrement
    if (!enCours.has(`${dossier.id}:Motifs_standardises`)) {
        afficherMotifs(element.querySelector('.motifs-standardises'), lireListe(dossier.Motifs_standardises));
    }
}

async function sauvegarderMotifs(element, motifs) {
    const carte = cartes.get(Number(element.dataset.id));
    if (!carte) {
        return;
    }
    const champ = 'Motifs_standardises';
    const zone = element.querySelector('.motifs-standardises');
    const valeur = typeMotifs(carte.dossier[champ]) === 'texte' ? motifs.join(', ') : ['L', ...motifs];
    const cle = `${carte.dossier.id}:${champ}`;
    enCours.set(cle, valeur);
    afficherMotifs(zone, motifs);
    marquer(zone, 'enregistrement');
    try {
        await ecrire(carte.dossier.id, { [champ]: valeur });
        carte.dossier = { ...carte.dossier, [champ]: valeur };
        marquer(zone, 'enregistre');
    } catch (e) {
        console.error(`Échec de l'enregistrement de ${champ} :`, e);
        marquer(zone, 'erreur', e.message);
        afficherToast(`Échec de l'enregistrement : ${e.message}`);
        afficherMotifs(zone, lireListe(carte.dossier[champ]));
    } finally {
        enCours.delete(cle);
    }
}

function motifsAffiches(element) {
    return JSON.parse(element.querySelector('.motifs-standardises').dataset.motifs || '[]');
}

// Zones de texte ajustées à leur contenu (plafonnées par max-height en CSS)
function ajusterHauteur(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight + 2}px`;
}

// Listes déroulantes : choix proposés et libellé de l'option vide
const LISTES = {
    Lieu_RDV_1: { vide: '— Lieu à définir —', choix: () => options?.lieux?.Lieu_RDV_1?.choix },
    Lieu_RDV_2: { vide: '— Lieu à définir —', choix: () => options?.lieux?.Lieu_RDV_2?.choix },
    Etablissement_COMUE: { vide: '— Établissement à renseigner —', choix: () => options?.etablissements?.map(c => ({ valeur: c, libelle: c })) },
};

function remplirSelect(select, champ, valeur) {
    const liste = LISTES[champ];
    const choix = [...(liste.choix() ?? [])];
    const reference = lireReference(valeur);
    if (reference && !choix.some(c => String(c.valeur) === reference.id)) {
        choix.push({ valeur: reference.id, libelle: reference.libelle || `Salle ${reference.id}` });
    }
    const signature = choix.map(c => `${c.valeur}=${c.libelle}`).join('|');
    if (select.dataset.signature === signature) {
        return;
    }
    const valeurActuelle = select.value;
    select.replaceChildren(new Option(liste.vide, ''), ...choix.map(c => new Option(c.libelle, String(c.valeur))));
    select.value = valeurActuelle;
    select.dataset.signature = signature;
}

function valeurChamp(element, champ) {
    const input = element.querySelector(`[data-champ="${champ}"]`);
    return input.type === 'checkbox' ? input.checked : input.value.trim();
}

// ---------- Validation des coordonnées ----------
// Chaque valideur retourne { valide, valeur (normalisée), message, suggestion }. Un champ vide est valide :
// l'absence de coordonnée est signalée par les pastilles, pas bloquée.

function distance(a, b) {
    const ligne = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        let diagonale = ligne[0];
        ligne[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const haut = ligne[j];
            ligne[j] = Math.min(ligne[j] + 1, ligne[j - 1] + 1, diagonale + (a[i - 1] === b[j - 1] ? 0 : 1));
            diagonale = haut;
        }
    }
    return ligne[b.length];
}

function validerEmail(texte) {
    const email = String(texte).trim().toLowerCase();
    if (!email) {
        return { valide: true, valeur: '' };
    }
    if (!EMAIL_VALIDE.test(email)) {
        return { valide: false, valeur: email, message: 'Adresse invalide (ex. prenom.nom@exemple.fr)' };
    }
    const domaine = email.split('@')[1];
    const proche = DOMAINES_COURANTS.includes(domaine) ? null
        : DOMAINES_COURANTS.find(d => distance(d, domaine) <= (d.length > 8 ? 2 : 1));
    return { valide: true, valeur: email, suggestion: proche ? email.replace(/@.*$/, `@${proche}`) : null };
}

// Numéros français normalisés en « 06 12 34 56 78 » (ou « +33 6 12 34 56 78 »), autres pays en « +… »
function validerTelephone(texte) {
    const brut = String(texte).trim();
    if (!brut) {
        return { valide: true, valeur: '' };
    }
    const chiffres = brut.replace(/\(0\)/g, '').replace(/[\s.\-()\/]/g, '');
    const francais = chiffres.match(/^(\+33|0033|0)([1-9]\d{8})$/);
    if (francais) {
        const [, prefixe, numero] = francais;
        const groupes = numero.slice(1).match(/\d{2}/g).join(' ');
        return { valide: true, valeur: prefixe === '0' ? `0${numero[0]} ${groupes}` : `+33 ${numero[0]} ${groupes}` };
    }
    if (/^(\+|00)[1-9]\d{7,14}$/.test(chiffres)) {
        return { valide: true, valeur: chiffres.replace(/^00/, '+') };
    }
    return { valide: false, valeur: brut, message: '10 chiffres (06 12 34 56 78) ou format international (+44 …)' };
}

// "AAAA-MM-JJTHH:MM" -> "06/10/2026 à 14h00"
function formaterSaisieDate(texte) {
    const [a, mo, j, h, mi] = texte.split(/[-T:]/);
    return `${j}/${mo}/${a} à ${h}h${mi}`;
}

// Créneaux : le RDV 2 (restitution) doit être strictement postérieur au RDV 1 (bloquant) ;
// date passée, week-end ou RDV 2 sans RDV 1 sont signalés sans bloquer
function validerCreneau(n) {
    const autreChamp = `Creneau_RDV_${n === 1 ? 2 : 1}`;
    return (texte, element) => {
        if (!texte) {
            return { valide: true, valeur: '' };
        }
        // Si la saisie de l'autre créneau a été refusée, on compare à sa valeur enregistrée dans Grist
        const carte = element && cartes.get(Number(element.dataset.id));
        const autreRefuse = carte && saisiesRefusees.has(`${carte.dossier.id}:${autreChamp}`);
        const autre = !element ? '' : autreRefuse ? versSaisie(autreChamp, carte.dossier[autreChamp]) : valeurChamp(element, autreChamp);
        // Les saisies "AAAA-MM-JJTHH:MM" se comparent directement comme des chaînes
        if (autre && (n === 2 ? texte <= autre : texte >= autre)) {
            return {
                valide: false,
                valeur: texte,
                message: n === 2
                    ? `Doit être postérieur au RDV 1 (${formaterSaisieDate(autre)})`
                    : `Doit précéder le RDV 2 (${formaterSaisieDate(autre)})`,
            };
        }
        const remarques = [];
        if (depuisSaisieDate(texte) * 1000 < Date.now()) {
            remarques.push('date passée');
        }
        const jour = new Date(`${texte.slice(0, 10)}T12:00:00Z`).getUTCDay();
        if (jour === 0 || jour === 6) {
            remarques.push(jour === 6 ? 'un samedi' : 'un dimanche');
        }
        if (n === 2 && element && !autre) {
            remarques.push('RDV 1 non renseigné');
        }
        return { valide: true, valeur: texte, avertissement: remarques.length ? `Attention : ${remarques.join(', ')}` : null };
    };
}

const VALIDATEURS = {
    Mail_patient: validerEmail,
    Telephone_patient: validerTelephone,
    Creneau_RDV_1: validerCreneau(1),
    Creneau_RDV_2: validerCreneau(2),
};

// Réaffiche la validation des champs de la carte (hors champ en cours de saisie). Une saisie refusée
// qui devient valide (ex. RDV 2 refusé, puis RDV 1 avancé) est enregistrée automatiquement.
function revalider(element, sauf = null) {
    const rowId = element.dataset.id;
    for (const [champ, validateur] of Object.entries(VALIDATEURS)) {
        const input = element.querySelector(`[data-champ="${champ}"]`);
        if (champ === sauf || input === document.activeElement) {
            continue;
        }
        const resultat = validateur(input.value, element);
        if (saisiesRefusees.has(`${rowId}:${champ}`)) {
            if (resultat.valide) {
                // Après l'écriture du champ qui l'a débloquée (Grist ne passe jamais par un RDV 2 ≤ RDV 1)
                setTimeout(() => sauvegarder(input));
            }
            continue;
        }
        afficherValidation(input, resultat);
    }
}

// Message sous le champ (erreur de format ou suggestion de correction)
function afficherValidation(input, resultat) {
    const zone = input.closest('.champ').querySelector('.champ-message');
    input.setAttribute('aria-invalid', String(!resultat.valide));
    input.setCustomValidity(resultat.valide ? '' : resultat.message);
    zone.classList.toggle('invalide', !resultat.valide);
    zone.classList.toggle('avertissement', resultat.valide && Boolean(resultat.avertissement));
    if (!resultat.valide) {
        zone.textContent = resultat.message;
    } else if (resultat.avertissement) {
        zone.textContent = resultat.avertissement;
    } else if (resultat.suggestion) {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'suggestion';
        bouton.dataset.valeur = resultat.suggestion;
        bouton.textContent = resultat.suggestion;
        zone.replaceChildren('Vouliez-vous dire ', bouton, ' ?');
    } else {
        zone.textContent = '';
    }
}

// Pastilles d'alerte de la carte, recalculées à chaque frappe
function majAlertes(element) {
    const email = valeurChamp(element, 'Mail_patient');
    const telephone = valeurChamp(element, 'Telephone_patient');
    const alertes = [];

    if (!email && !telephone) {
        alertes.push({ niveau: 'critique', texte: 'Aucun moyen de contact' });
    } else {
        if (!email) {
            alertes.push({ niveau: 'avertissement', texte: 'Email manquant' });
        } else if (!validerEmail(email).valide) {
            alertes.push({ niveau: 'avertissement', texte: 'Email invalide' });
        }
        if (!telephone) {
            alertes.push({ niveau: 'avertissement', texte: 'Téléphone manquant' });
        } else if (!validerTelephone(telephone).valide) {
            alertes.push({ niveau: 'avertissement', texte: 'Téléphone invalide' });
        }
    }
    // RDV étudiant : la mention CVEC et l'établissement suivent la case, y compris pendant l'enregistrement
    const etudiant = valeurChamp(element, 'Etudiant');
    element.querySelector('.etudiant').classList.toggle('actif', etudiant);
    element.querySelector('.etudiant-details').hidden = !etudiant;
    const etablissement = valeurChamp(element, 'Etablissement_COMUE');
    if (etudiant && !etablissement) {
        alertes.push({ niveau: 'avertissement', texte: 'Établissement manquant' });
    }
    element.querySelector('.champ-etablissement').classList.toggle('manquant', !etablissement);
    const rdv1 = valeurChamp(element, 'Creneau_RDV_1');
    const rdv2 = valeurChamp(element, 'Creneau_RDV_2');
    if (rdv1 && rdv2 && rdv2 <= rdv1) {
        alertes.push({ niveau: 'critique', texte: 'RDV 2 avant le RDV 1' });
    }
    [1, 2].forEach(n => {
        if (!valeurChamp(element, `Creneau_RDV_${n}`) || !valeurChamp(element, `Lieu_RDV_${n}`)) {
            alertes.push({ niveau: 'info', texte: `RDV ${n} incomplet` });
        }
    });

    element.querySelector('[data-champ="Mail_patient"]').closest('.champ').classList.toggle('manquant', !email);
    element.querySelector('[data-champ="Telephone_patient"]').closest('.champ').classList.toggle('manquant', !telephone);
    element.querySelector('.alertes').replaceChildren(...alertes.map(alerte => {
        const pastille = document.createElement('span');
        pastille.className = `alerte ${alerte.niveau}`;
        pastille.textContent = alerte.texte;
        return pastille;
    }));
}

function afficherBandeau(niveau, texte) {
    const bandeau = document.getElementById('bandeau');
    bandeau.className = `bandeau ${niveau}`;
    bandeau.textContent = texte;
    bandeau.hidden = !texte;
}

function verifierOptions() {
    if (MODE_DEMO) {
        return;
    }
    if (!options) {
        afficherBandeau('alerte', 'Liste des lieux indisponible : seules les salles déjà renseignées sont proposées.');
    } else if (options.statuts && Object.values(ACTIONS_STATUT).some(action => !options.statuts.includes(action.statut))) {
        const manquants = Object.values(ACTIONS_STATUT).filter(action => !options.statuts.includes(action.statut)).map(action => `« ${action.statut} »`);
        afficherBandeau('alerte', `Statut ${manquants.join(' et ')} absent des choix de la colonne Statut_RDV : le changement de statut risque d’échouer.`);
    } else {
        afficherBandeau('', '');
    }
}

let minuterieToast = null;
function afficherToast(texte) {
    const toast = document.getElementById('toast');
    toast.textContent = texte;
    toast.hidden = false;
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { toast.hidden = true; }, 5000);
}

function marquer(input, etat, detail = '') {
    const champ = input.closest('.champ');
    champ.classList.remove('enregistrement', 'enregistre', 'erreur');
    champ.title = detail;
    if (etat) {
        champ.classList.add(etat);
    }
    if (etat === 'enregistre') {
        setTimeout(() => champ.classList.remove('enregistre'), 1500);
    }
}

// ---------- Enregistrement ----------

// Les écritures sont envoyées l'une après l'autre, dans l'ordre des sorties de champ
function ecrire(rowId, champs) {
    const ecriture = fileEcritures.then(() => source.enregistrer(rowId, champs));
    fileEcritures = ecriture.catch(() => {});
    return ecriture;
}

async function sauvegarder(input) {
    const carte = cartes.get(Number(input.closest('.carte').dataset.id));
    if (!carte) {
        return;
    }
    const champ = input.dataset.champ;
    if (input.validity.badInput) {
        marquer(input, 'erreur', 'Date incomplète : non enregistrée');
        return;
    }
    // Email, téléphone et créneaux : une valeur invalide n'est pas enregistrée, une valeur valide est normalisée
    const validateur = VALIDATEURS[champ];
    if (validateur) {
        const element = input.closest('.carte');
        const resultat = validateur(input.value, element);
        const cleSaisie = `${carte.dossier.id}:${champ}`;
        afficherValidation(input, resultat);
        if (!resultat.valide) {
            saisiesRefusees.add(cleSaisie);
            marquer(input, 'erreur', resultat.message);
            return;
        }
        saisiesRefusees.delete(cleSaisie);
        input.value = resultat.valeur;
        majAlertes(element);
        revalider(element, champ);
    }
    const valeurActuelle = carte.dossier[champ];
    const nouvelle = depuisSaisie(champ, input.type === 'checkbox' ? input.checked : input.value, valeurActuelle);
    const ancienne = depuisSaisie(champ, versSaisie(champ, valeurActuelle), valeurActuelle);
    const cle = `${carte.dossier.id}:${champ}`;
    if (enCours.has(cle) && enCours.get(cle) === nouvelle) {
        return;
    }
    if (nouvelle === ancienne) {
        marquer(input, '');
        return;
    }

    enCours.set(cle, nouvelle);
    marquer(input, 'enregistrement');
    try {
        await ecrire(carte.dossier.id, { [champ]: nouvelle });
        carte.dossier = { ...carte.dossier, [champ]: nouvelle };
        marquer(input, 'enregistre');
    } catch (e) {
        console.error(`Échec de l'enregistrement de ${champ} :`, e);
        marquer(input, 'erreur', e.message);
        afficherToast(`Échec de l'enregistrement : ${e.message}`);
    } finally {
        enCours.delete(cle);
    }
}

async function changerStatut(bouton) {
    const element = bouton.closest('.carte');
    const carte = cartes.get(Number(element.dataset.id));
    const action = ACTIONS_STATUT[bouton.dataset.action];
    const boutons = element.querySelectorAll('[data-action]');
    if (!carte || bouton.disabled) {
        return;
    }
    boutons.forEach(b => { b.disabled = true; });
    bouton.textContent = action.enCours;
    // Le clic ne fait pas toujours sortir du champ en cours (Safari ne donne pas le focus aux boutons) :
    // on enregistre la saisie avant le statut, sinon la carte disparaîtrait avec elle
    const saisieEnCours = document.activeElement?.closest?.('[data-champ]');
    if (saisieEnCours && element.contains(saisieEnCours)) {
        sauvegarder(saisieEnCours);
    }
    try {
        // Attend les enregistrements déclenchés par la sortie du dernier champ modifié
        await fileEcritures;
        await ecrire(carte.dossier.id, { Statut_RDV: action.statut });
        // Si la vue est bien filtrée sur le statut, Grist retire la demande et la carte disparaît
    } catch (e) {
        console.error(`Échec du passage au statut ${action.statut} :`, e);
        afficherToast(`Échec du passage au statut « ${action.statut} » : ${e.message}`);
        boutons.forEach(b => { b.disabled = false; });
        bouton.textContent = action.libelle;
    }
}

function selectionner(element) {
    const rowId = element ? Number(element.dataset.id) : null;
    if (!rowId || rowId === rowIdSelectionne) {
        return;
    }
    rowIdSelectionne = rowId;
    liste.querySelectorAll('.carte.selectionnee').forEach(el => el.classList.remove('selectionnee'));
    element.classList.add('selectionnee');
    source.selectionner(rowId);
}

// ---------- Événements ----------

// Champs texte, dates et commentaires : enregistrés à la sortie du champ
liste.addEventListener('focusout', (e) => {
    const input = e.target.closest('[data-champ]');
    if (input && input.tagName !== 'SELECT' && input.type !== 'checkbox') {
        sauvegarder(input);
    }
    if (ordreEnAttente && !liste.contains(e.relatedTarget)) {
        ordonner(ordreEnAttente);
    }
});

// Listes et cases à cocher : enregistrées dès le choix
liste.addEventListener('change', (e) => {
    if (e.target.matches('[data-champ]') && (e.target.tagName === 'SELECT' || e.target.type === 'checkbox')) {
        sauvegarder(e.target);
    }
    // Ajout d'un motif standardisé
    if (e.target.matches('.motif-ajout') && e.target.value) {
        const element = e.target.closest('.carte');
        sauvegarderMotifs(element, [...motifsAffiches(element), e.target.value]);
    }
});

liste.addEventListener('input', (e) => {
    const element = e.target.closest('.carte');
    if (element) {
        majAlertes(element);
    }
    if (e.target.tagName === 'TEXTAREA') {
        ajusterHauteur(e.target);
    }
    // Pendant la frappe, l'erreur s'efface dès que la saisie devient valide (elle ne s'affiche qu'en sortie de champ)
    const validateur = VALIDATEURS[e.target.dataset?.champ];
    if (validateur && e.target.getAttribute('aria-invalid') === 'true' && validateur(e.target.value, element).valide) {
        afficherValidation(e.target, { valide: true });
        marquer(e.target, '');
    }
});

// Entrée dans un champ d'une ligne : valide la saisie (sortie du champ)
liste.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input[data-champ]')) {
        e.target.blur();
    }
});

liste.addEventListener('focusin', (e) => selectionner(e.target.closest('.carte')));

liste.addEventListener('click', (e) => {
    const retirer = e.target.closest('.motif-retirer');
    if (retirer) {
        const element = retirer.closest('.carte');
        sauvegarderMotifs(element, motifsAffiches(element).filter(m => m !== retirer.dataset.motif));
        return;
    }
    const suggestion = e.target.closest('.suggestion');
    if (suggestion) {
        e.preventDefault();
        const input = suggestion.closest('.champ').querySelector('[data-champ]');
        input.value = suggestion.dataset.valeur;
        sauvegarder(input);
        return;
    }
    const bouton = e.target.closest('[data-action]');
    if (bouton) {
        changerStatut(bouton);
    } else {
        selectionner(e.target.closest('.carte'));
    }
});

// La largeur et la police (chargée après coup) changent la hauteur utile des zones de texte
const recalculerHauteurs = () => liste.querySelectorAll('textarea').forEach(ajusterHauteur);
let minuterieRedimensionnement = null;
window.addEventListener('resize', () => {
    clearTimeout(minuterieRedimensionnement);
    minuterieRedimensionnement = setTimeout(recalculerHauteurs, 150);
});
document.fonts?.ready.then(recalculerHauteurs);
