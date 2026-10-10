const FUSEAU = 'Europe/Paris';

// Valeurs écrites dans la colonne Statut_RDV par les boutons « Confirmer », « Créneaux proposés » et « Rejeter ».
// Elles doivent faire sortir la demande du filtre de la vue Grist : la carte disparaît alors de la liste.
const STATUT_CONFIRME = 'Confirmé';
const STATUT_PROPOSE = 'Créneaux proposés';
const STATUT_REJETE = 'Rejeté';

// Disponibilité des salles : statuts dont les créneaux occupent une salle, et durée d'un RDV
// (même durée que le widget calendrier). Un RDV en visioconférence occupe quand même sa salle.
// « ferme » : salle prise (conflit bloquant) ; « provisoire » : créneau proposé au patient, en attente de réponse.
const STATUTS_OCCUPANT = { [STATUT_CONFIRME]: 'ferme', [STATUT_PROPOSE]: 'provisoire' };
const DUREE_RDV_MINUTES = 30;
const DUREE_RDV_MS = DUREE_RDV_MINUTES * 60 * 1000;

// Plages habituelles des RDV (heure de Paris) ; jour : 0 = dimanche, 1 = lundi, …, 6 = samedi.
// Un créneau dont le RDV (DUREE_RDV_MINUTES) ne tient pas entièrement dans une plage déclenche une alerte, que l'on peut ignorer.
const PLAGES_RDV = [
    { jour: 2, debut: '18:00', fin: '20:00' },   // mardi
    { jour: 3, debut: '17:30', fin: '19:30' },   // mercredi
];

// Boutons de changement de statut (attribut data-action dans le modèle de carte)
const ACTIONS_STATUT = {
    confirmer: { statut: STATUT_CONFIRME, libelle: 'Confirmer le RDV', enCours: 'Confirmation…', fait: 'RDV confirmé ✓', classe: 'confirmee' },
    proposer: { statut: STATUT_PROPOSE, libelle: 'Créneaux proposés au patient', enCours: 'Enregistrement…', fait: 'Créneaux proposés ✓', classe: 'proposee' },
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
    { name: "Cree_le", title: "Date de création de la demande", type: "DateTime", optional: true, description: "Affichée en petit à côté de l'identifiant" },
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
    // Une modification dans la vue peut libérer ou occuper une salle : on relit l'occupation
    if (dossiers) {
        planifierOccupation();
    }
});

// ---------- Sources de données ----------

function creerSourceGrist() {
    let mappings = null;
    const idTable = () => grist.selectedTable.getTableId?.() ?? grist.getSelectedTableId?.();
    const versColonnes = champs => Object.fromEntries(Object.entries(champs).map(([nom, valeur]) => [mappings[nom], valeur]));

    return {
        demarrer(surDonnees) {
            // Accès complet : écriture dans la table et lecture des métadonnées (liste des salles, choix du statut)
            grist.ready({ requiredAccess: 'full', columns: COLONNES, allowSelectBy: true });
            // expandRefs: false : Grist envoie alors l'identifiant de la ligne référencée (salle) et non son
            // libellé affiché, indispensable pour retrouver la salle dans la liste et comparer les occupations
            grist.onRecords((records, nouvellesMappings) => {
                const modifiees = JSON.stringify(nouvellesMappings) !== JSON.stringify(mappings);
                mappings = nouvellesMappings;
                surDonnees(grist.mapColumnNames(records), modifiees);
            }, { expandRefs: false });
        },

        async enregistrer(rowId, champs) {
            await grist.selectedTable.update({ id: rowId, fields: versColonnes(champs) });
        },

        // Tous les RDV de la table (y compris ceux que le filtre de la vue masque), pour l'occupation des salles
        async chargerOccupation() {
            const table = await grist.docApi.fetchTable(await idTable());
            const colonne = nom => table[mappings[nom]] ?? [];
            return table.id.map((id, i) => ({
                id,
                identifiant: colonne('id_rdv_clinique')[i],
                nom: colonne('Nom_patient')[i],
                prenom: colonne('Prenom_patient')[i],
                statut: colonne('Statut_RDV')[i],
                creneaux: [1, 2].map(n => ({ n, date: colonne(`Creneau_RDV_${n}`)[i], lieu: colonne(`Lieu_RDV_${n}`)[i] })),
            }));
        },

        // Crée le RDV puis relit l'identifiant attribué par Grist (formule d'initialisation de id_rdv_clinique).
        // Le RDV étant confirmé, il sort du filtre de la vue : on le relit directement dans la table.
        async creer(champs) {
            const resultat = await grist.selectedTable.create({ fields: versColonnes(champs) });
            const rowId = Array.isArray(resultat) ? resultat[0].id : resultat.id;
            const colId = mappings.id_rdv_clinique;
            try {
                const record = await grist.fetchSelectedRecord(rowId, { includeColumns: 'all' });
                if (record?.[colId]) {
                    return { rowId, identifiant: String(record[colId]) };
                }
            } catch (e) {
                console.warn('Lecture du RDV créé via la vue impossible, lecture de la table :', e);
            }
            const table = await grist.docApi.fetchTable(await idTable());
            const i = table.id.indexOf(rowId);
            return { rowId, identifiant: i >= 0 ? String(table[colId]?.[i] ?? '') : '' };
        },

        // Lit les métadonnées du document pour proposer toutes les salles (colonne Référence)
        // ou tous les choix (colonne Choix), et vérifier que le statut de confirmation existe.
        async chargerOptions() {
            if (!mappings) {
                return null;
            }
            const tableId = await idTable();
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
        { id: 41, Cree_le: new Date(Date.UTC(2026, 8, 25, 8, 12)), Motif_RDV: "Mon propriétaire refuse de me rendre mon dépôt de garantie (850 €) alors que l'état des lieux de sortie ne mentionne aucune dégradation. J'ai quitté le logement il y a trois mois et il ne répond plus à mes relances par mail ni par courrier.\nJe voudrais savoir quels sont mes recours et s'il faut passer par une mise en demeure avant de saisir le tribunal.", Motifs_standardises: ['Logement', 'Consommation'], id_rdv_clinique: 'K7QXM', Nom_patient: 'MARTIN', Prenom_patient: 'Camille', Mail_patient: 'camille.martin@exemple.fr', Telephone_patient: '06 12 34 56 78', Creneau_RDV_1: date(6, 14), Lieu_RDV_1: 1, Creneau_RDV_2: null, Lieu_RDV_2: 0, Visioconference: false, Commentaires: 'Souhaite un RDV en fin de journée.', Statut_RDV: STATUT_DEMANDE },
        { id: 42, Cree_le: new Date(Date.UTC(2026, 8, 26, 14, 40)), Motif_RDV: "Contestation d'une rupture de période d'essai.", Motifs_standardises: ['Travail'], id_rdv_clinique: '3HPAT', Nom_patient: 'NGUYEN', Prenom_patient: 'Thomas', Mail_patient: '', Telephone_patient: '07 45 21 98 03', Creneau_RDV_1: date(7, 10, 30), Lieu_RDV_1: 3, Creneau_RDV_2: date(21, 10, 30), Lieu_RDV_2: 3, Visioconference: true, Commentaires: '', Etudiant: true, Etablissement_COMUE: 'Université Lumière Lyon 2', Statut_RDV: STATUT_DEMANDE },
        { id: 43, Cree_le: new Date(Date.UTC(2026, 8, 28, 7, 5)), Motif_RDV: "Litige avec mon bailleur social concernant des charges locatives régularisées sur trois ans d'un coup. Le montant réclamé représente plus de deux mois de loyer et je n'ai reçu aucun justificatif malgré ma demande écrite.", Motifs_standardises: ['Logement'], id_rdv_clinique: 'WD9RC', Nom_patient: 'BERNARD', Prenom_patient: 'Léa', Mail_patient: 'lea.bernard@exemple.org', Telephone_patient: '', Creneau_RDV_1: date(8, 9, 15), Lieu_RDV_1: 5, Creneau_RDV_2: null, Lieu_RDV_2: 0, Visioconference: false, Commentaires: 'Litige bailleur — pièces transmises par mail.', Statut_RDV: STATUT_DEMANDE },
        { id: 44, Cree_le: new Date(Date.UTC(2026, 9, 1, 9, 30)), Motif_RDV: "", Motifs_standardises: [], id_rdv_clinique: 'B4NZE', Nom_patient: 'HADDAD', Prenom_patient: 'Yanis', Mail_patient: '', Telephone_patient: '', Creneau_RDV_1: date(8, 9), Lieu_RDV_1: 5, Creneau_RDV_2: null, Lieu_RDV_2: 0, Visioconference: false, Commentaires: 'Demande déposée à l’accueil, coordonnées non laissées.', Etudiant: true, Etablissement_COMUE: '', Statut_RDV: STATUT_DEMANDE },
        { id: 45, Cree_le: new Date(Date.UTC(2026, 9, 2, 6, 47)), Motif_RDV: "Renouvellement de titre de séjour étudiant : la préfecture m'a délivré un récépissé qui expire avant la date du rendez-vous qu'elle m'a fixé. Je crains de perdre mon droit de travailler en parallèle de mes études.", Motifs_standardises: ['Droit des étrangers', 'Administratif'], id_rdv_clinique: 'Q2UFL', Nom_patient: 'LEROY', Prenom_patient: 'Inès', Mail_patient: 'ines.leroy@exemple', Telephone_patient: '06 98 76 54 32', Creneau_RDV_1: date(9, 11), Lieu_RDV_1: 2, Creneau_RDV_2: date(23, 11), Lieu_RDV_2: 4, Visioconference: false, Commentaires: '', Etudiant: true, Etablissement_COMUE: 'Université Jean Moulin Lyon 3', Statut_RDV: STATUT_DEMANDE },
        // RDV hors de la vue (déjà traités) : ils occupent des salles
        { id: 30, id_rdv_clinique: 'M4XKP', Nom_patient: 'DURAND', Prenom_patient: 'Paul', Creneau_RDV_1: date(6, 14, 15), Lieu_RDV_1: 1, Creneau_RDV_2: null, Lieu_RDV_2: 0, Statut_RDV: STATUT_CONFIRME },
        { id: 31, id_rdv_clinique: 'T8BWS', Nom_patient: 'ROUSSEAU', Prenom_patient: 'Emma', Creneau_RDV_1: date(23, 11), Lieu_RDV_1: 4, Creneau_RDV_2: null, Lieu_RDV_2: 0, Statut_RDV: STATUT_PROPOSE },
        { id: 32, id_rdv_clinique: 'H6CNV', Nom_patient: 'PETIT', Prenom_patient: 'Lucas', Creneau_RDV_1: date(6, 14), Lieu_RDV_1: 2, Creneau_RDV_2: null, Lieu_RDV_2: 0, Statut_RDV: STATUT_CONFIRME },
    ];

    let surDonnees = null;
    // Simule le filtre de la vue Grist sur le statut
    // Mêmes formats que Grist : références décodées en objets { tableId, rowId }
    const reference = rowId => (rowId ? { tableId: 'Lieux_RDV', rowId } : 0);
    const publier = () => surDonnees(structuredClone(dossiers.filter(d => d.Statut_RDV === STATUT_DEMANDE))
        .map(d => ({ ...d, Lieu_RDV_1: reference(d.Lieu_RDV_1), Lieu_RDV_2: reference(d.Lieu_RDV_2) })), false);

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
                statuts: [STATUT_DEMANDE, STATUT_PROPOSE, STATUT_CONFIRME, STATUT_REJETE],
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

        async chargerOccupation() {
            await new Promise(resolve => setTimeout(resolve, 150));
            return dossiers.map(d => ({
                id: d.id, identifiant: d.id_rdv_clinique, nom: d.Nom_patient, prenom: d.Prenom_patient, statut: d.Statut_RDV,
                creneaux: [1, 2].map(n => ({ n, date: d[`Creneau_RDV_${n}`], lieu: d[`Lieu_RDV_${n}`] })),
            }));
        },

        async creer(champs) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const rowId = Math.max(...dossiers.map(d => d.id)) + 1;
            // Même calcul que la formule d'initialisation de id_rdv_clinique dans Grist
            const CARACTERES = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let n = (rowId * 2654435761) % (32 ** 5);
            let identifiant = '';
            for (let i = 0; i < 5; i++) {
                identifiant = CARACTERES[n % 32] + identifiant;
                n = Math.floor(n / 32);
            }
            dossiers.push({ ...champs, id: rowId, id_rdv_clinique: identifiant, Nom_patient: String(champs.Nom_patient).toUpperCase() });
            afficherBandeau('info', `Mode démonstration : données fictives. Dernière écriture simulée : AddRecord ligne ${rowId} (${identifiant}) → Statut_RDV = "${champs.Statut_RDV}"`);
            publier();
            return { rowId, identifiant };
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
            return valeurDeListe(champ, valeur);
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
    // Création possible dès que les colonnes sont associées
    document.getElementById('nouveau-rdv').hidden = !dossiers;

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
    majDisponibilites();

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
    conflits: { garder: (d, element) => aConflitDeSalle(element), vide: 'Aucun conflit de salle parmi les demandes.' },
};
let filtreActif = 'tous';

function appliquerFiltre() {
    const liste = [...cartes.values()];
    let visibles = 0;
    for (const carte of liste) {
        // La carte en cours d'édition reste affichée, même si elle ne correspond plus au filtre
        const garder = FILTRES[filtreActif].garder(carte.dossier, carte.element) || carte.element.contains(document.activeElement);
        carte.element.hidden = !garder;
        visibles += garder ? 1 : 0;
    }
    for (const bouton of document.querySelectorAll('.filtre')) {
        const nom = bouton.dataset.filtre;
        const nombre = liste.filter(carte => FILTRES[nom].garder(carte.dossier, carte.element)).length;
        bouton.setAttribute('aria-pressed', String(nom === filtreActif));
        bouton.querySelector('.filtre-nombre').textContent = nombre;
        if (nom === 'conflits') {
            bouton.classList.toggle('actif', nombre > 0);
        }
    }
    document.getElementById('filtres').hidden = liste.length === 0;
    document.getElementById('message-texte').textContent = FILTRES[filtreActif].vide;
    document.getElementById('message').hidden = visibles > 0;
    recalculerHauteurs();
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
    majCreation(element.querySelector('.cree-le'), dossier.Cree_le);
    const identifiant = String(dossier.id_rdv_clinique || '').trim();
    element.querySelector('.id-rdv-valeur').textContent = identifiant || `ligne ${dossier.id}`;
    element.querySelector('.id-rdv .copier').hidden = !identifiant;
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
    // Élément masqué (carte filtrée, formulaire fermé) : pas de hauteur mesurable, recalculée à l'affichage
    if (!textarea.offsetParent) {
        return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight + 2}px`;
}

// Listes déroulantes : choix proposés et libellé de l'option vide
const LISTES = {
    Lieu_RDV_1: { vide: '— Lieu à définir —', choix: () => options?.lieux?.Lieu_RDV_1?.choix },
    Lieu_RDV_2: { vide: '— Lieu à définir —', choix: () => options?.lieux?.Lieu_RDV_2?.choix },
    Etablissement_COMUE: { vide: '— Établissement à renseigner —', choix: () => options?.etablissements?.map(c => ({ valeur: c, libelle: c })) },
};

// Valeur Grist -> valeur de l'option correspondante dans la liste. Si Grist transmet le libellé affiché
// au lieu de l'identifiant (référence « développée »), on retrouve la salle par son libellé.
function valeurDeListe(champ, valeur) {
    const reference = lireReference(valeur);
    if (!reference) {
        return '';
    }
    const choix = LISTES[champ]?.choix() ?? [];
    if (choix.some(c => String(c.valeur) === reference.id)) {
        return reference.id;
    }
    const parLibelle = choix.find(c => c.libelle === reference.libelle);
    return parLibelle ? String(parLibelle.valeur) : reference.id;
}

// « Demande reçue le 28/09/2026 à 14h32 · il y a 4 jours » (jours comptés au calendrier, à Paris)
function majCreation(zone, valeur) {
    const date = versDate(valeur);
    zone.hidden = !date;
    if (!date) {
        return;
    }
    const jour = d => {
        const p = partiesParis(d);
        return Date.UTC(p.annee, p.mois - 1, p.jour);
    };
    const ecart = Math.round((jour(new Date()) - jour(date)) / 86400000);
    const anciennete = ecart <= 0 ? "aujourd'hui" : ecart === 1 ? 'hier' : `il y a ${ecart} jours`;
    const quand = formaterSaisieDate(versSaisieDate(date));
    zone.textContent = `Demande reçue le ${quand} · ${anciennete}`;
    zone.title = `Demande de RDV créée le ${quand}`;
}

function remplirSelect(select, champ, valeur) {
    const liste = LISTES[champ];
    const choix = [...(liste.choix() ?? [])];
    // Valeur absente des choix (salle supprimée, liste illisible) : ajoutée pour ne pas la perdre à l'affichage
    const id = valeurDeListe(champ, valeur);
    if (id && !choix.some(c => String(c.valeur) === id)) {
        choix.push({ valeur: id, libelle: lireReference(valeur)?.libelle || `Salle ${id}` });
    }
    const signature = choix.map(c => `${c.valeur}=${c.libelle}`).join('|');
    if (select.dataset.signature === signature) {
        return;
    }
    const valeurActuelle = select.value;
    select.replaceChildren(new Option(liste.vide, ''), ...choix.map(c => {
        const option = new Option(c.libelle, String(c.valeur));
        option.dataset.libelle = c.libelle;
        return option;
    }));
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

// ---------- Plages de permanence ----------

const NOMS_JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const enMinutes = hhmm => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};
const enHeure = hhmm => hhmm.replace(':', 'h');

// Saisie "AAAA-MM-JJTHH:MM" (heure de Paris) en dehors de toutes les plages ?
function horsPlages(saisie) {
    if (!saisie) {
        return false;
    }
    const jour = new Date(`${saisie.slice(0, 10)}T12:00:00Z`).getUTCDay();
    const debut = enMinutes(saisie.slice(11, 16));
    const fin = debut + DUREE_RDV_MINUTES;
    return !PLAGES_RDV.some(p => p.jour === jour && debut >= enMinutes(p.debut) && fin <= enMinutes(p.fin));
}

function decrirePlages() {
    return PLAGES_RDV.map(p => `${NOMS_JOURS[p.jour]} ${enHeure(p.debut)}–${enHeure(p.fin)}`).join(' · ');
}

let fileAlertesPlages = Promise.resolve();

// Affiche l'alerte (les alertes successives s'enchaînent). Résout true si l'utilisateur conserve le créneau
// (ou ignore l'alerte), false s'il choisit de le modifier.
function alerterHorsPlages(creneaux) {
    const reponse = fileAlertesPlages.then(() => afficherAlertePlages(creneaux));
    fileAlertesPlages = reponse.catch(() => {});
    return reponse;
}

function afficherAlertePlages(creneaux) {
    if (!creneaux.length) {
        return Promise.resolve(true);
    }
    const fond = document.getElementById('alerte-plages');
    const liste = document.createElement('ul');
    liste.append(...creneaux.map(({ n, saisie }) => {
        const jour = NOMS_JOURS[new Date(`${saisie.slice(0, 10)}T12:00:00Z`).getUTCDay()];
        return Object.assign(document.createElement('li'), { textContent: `RDV ${n} : ${jour} ${formaterSaisieDate(saisie)}` });
    }));
    document.getElementById('alerte-plages-texte').replaceChildren(
        Object.assign(document.createElement('p'), { textContent: creneaux.length > 1 ? 'Ces créneaux sont en dehors des plages habituelles de RDV :' : 'Ce créneau est en dehors des plages habituelles de RDV :' }),
        liste,
        Object.assign(document.createElement('p'), { className: 'alerte-plages', textContent: `Plages prévues : ${decrirePlages()} (RDV de ${DUREE_RDV_MINUTES} min).` }),
    );
    const focusPrecedent = document.activeElement;
    fond.hidden = false;
    fond.querySelector('[data-reponse="conserver"]').focus();

    return new Promise(resolve => {
        const repondre = conserver => {
            fond.hidden = true;
            fond.onclick = null;
            fond.onkeydown = null;
            focusPrecedent?.focus?.();
            resolve(conserver);
        };
        fond.onclick = (e) => {
            const bouton = e.target.closest('[data-reponse]');
            if (bouton) {
                repondre(bouton.dataset.reponse === 'conserver');
            } else if (e.target === fond) {
                repondre(true);
            }
        };
        // Échap ignore l'alerte (sans fermer le formulaire en dessous)
        fond.onkeydown = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                repondre(true);
            }
        };
    });
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
        if (horsPlages(texte)) {
            remarques.push('hors des plages de permanence');
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
    for (const n of [1, 2]) {
        const analyse = element._disponibilites?.[n];
        if (analyse?.etat === 'occupee') {
            alertes.push({ niveau: 'critique', texte: `Salle occupée (RDV ${n})` });
        } else if (analyse?.etat === 'concurrence') {
            alertes.push({ niveau: 'avertissement', texte: `Salle en concurrence (RDV ${n})` });
        }
    }
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
        if (TYPES_CHAMPS[champ] === 'date' && horsPlages(input.value)) {
            alerterHorsPlages([{ n: Number(champ.slice(-1)), saisie: input.value }]).then(conserver => {
                if (!conserver) {
                    input.focus();
                }
            });
        }
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
    const planifie = ['confirmer', 'proposer'].includes(bouton.dataset.action);
    if (planifie && (!valeurChamp(element, 'Creneau_RDV_1') || !valeurChamp(element, 'Lieu_RDV_1'))) {
        afficherToast(`Renseignez la date et le lieu du RDV 1 avant de ${bouton.dataset.action === 'proposer' ? 'proposer les créneaux' : 'confirmer le RDV'}.`);
        element.querySelector(`[data-champ="${valeurChamp(element, 'Creneau_RDV_1') ? 'Lieu_RDV_1' : 'Creneau_RDV_1'}"]`).focus();
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
        // Salle déjà occupée par un RDV confirmé : second clic explicite demandé (occupation relue juste avant)
        if (planifie && !bouton.dataset.forcer) {
            await rafraichirOccupation();
            const occupees = [1, 2].filter(n => element._disponibilites?.[n]?.etat === 'occupee');
            if (occupees.length) {
                demanderForcage(bouton, boutons, `Salle occupée (RDV ${occupees.join(' et ')}) — ${bouton.dataset.action === 'proposer' ? 'proposer' : 'confirmer'} quand même`);
                afficherToast(`Conflit de salle : ${occupees.map(n => resumeConflit(element._disponibilites[n])).join(' · ')}`);
                return;
            }
        }
        delete bouton.dataset.forcer;
        bouton.classList.remove('forcer');
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
    if (/^(Creneau|Lieu)_RDV_/.test(e.target.dataset?.champ ?? '')) {
        planifierDisponibilites();
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
    const copie = e.target.closest('.copier');
    if (copie) {
        copierIdentifiant(copie);
        return;
    }
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
function recalculerHauteurs() {
    document.querySelectorAll('textarea').forEach(ajusterHauteur);
}
let minuterieRedimensionnement = null;
window.addEventListener('resize', () => {
    clearTimeout(minuterieRedimensionnement);
    minuterieRedimensionnement = setTimeout(recalculerHauteurs, 150);
});
document.fonts?.ready.then(recalculerHauteurs);

// ---------- Identifiant : copie dans le presse-papiers ----------

async function copierIdentifiant(bouton) {
    const texte = bouton.closest('.id-rdv').querySelector('.id-rdv-valeur').textContent.trim();
    try {
        await navigator.clipboard.writeText(texte);
    } catch {
        // Presse-papiers non autorisé dans l'iframe : copie via une zone de texte temporaire
        const zone = document.createElement('textarea');
        zone.value = texte;
        zone.style.position = 'fixed';
        zone.style.opacity = '0';
        document.body.append(zone);
        zone.select();
        document.execCommand('copy');
        zone.remove();
    }
    bouton.classList.add('copie');
    bouton.title = 'Copié !';
    setTimeout(() => {
        bouton.classList.remove('copie');
        bouton.title = "Copier l'identifiant";
    }, 1500);
}

// ---------- Formulaire : ajout d'un RDV confirmé ----------

const fondFormulaire = document.getElementById('formulaire-fond');
const formulaire = document.getElementById('formulaire-rdv');
const succes = document.getElementById('formulaire-succes');
const champFormulaire = champ => formulaire.querySelector(`[data-champ="${champ}"]`);

// Deux façons d'ajouter un RDV : créneaux proposés au patient (en attente de sa réponse) ou RDV confirmé
const ACTIONS_AJOUT = {
    proposer: {
        statut: STATUT_PROPOSE,
        libelle: 'Ajouter — créneaux proposés au patient',
        forcer: 'Proposer malgré le conflit de salle',
        titre: 'RDV ajouté — créneaux proposés au patient',
        aide: 'Identifiant à communiquer au patient avec les créneaux proposés.',
    },
    confirmer: {
        statut: STATUT_CONFIRME,
        libelle: 'Ajouter et confirmer le RDV',
        forcer: 'Confirmer malgré le conflit de salle',
        titre: 'RDV ajouté et confirmé',
        aide: 'Identifiant à communiquer au patient.',
    },
};
const boutonsAjout = () => formulaire.querySelectorAll('[data-ajout]');

function annulerForcageFormulaire() {
    for (const bouton of boutonsAjout()) {
        delete bouton.dataset.forcer;
        bouton.classList.remove('forcer');
        bouton.textContent = ACTIONS_AJOUT[bouton.dataset.ajout].libelle;
    }
}
// Dans le formulaire, l'ordre des créneaux n'est signalé que sur le RDV 2 (pas d'erreur en double)
const validerDansFormulaire = (champ, valeur) => VALIDATEURS[champ](valeur, champ === 'Creneau_RDV_1' ? null : formulaire);

function ouvrirFormulaire() {
    reinitialiserFormulaire();
    fondFormulaire.hidden = false;
    document.body.classList.add('formulaire-ouvert');
    formulaire.querySelectorAll('textarea').forEach(ajusterHauteur);
    champFormulaire('Nom_patient').focus();
    rafraichirOccupation();
}

function fermerFormulaire() {
    fondFormulaire.hidden = true;
    document.body.classList.remove('formulaire-ouvert');
    document.getElementById('nouveau-rdv').focus();
}

function reinitialiserFormulaire() {
    formulaire.reset();
    formulaire.hidden = false;
    succes.hidden = true;
    document.getElementById('formulaire-erreurs').hidden = true;
    for (const input of formulaire.querySelectorAll('[data-champ]')) {
        if (input.tagName === 'SELECT') {
            remplirSelect(input, input.dataset.champ, null);
            input.value = '';
        }
        if (input.closest('.champ').querySelector('.champ-message')) {
            afficherValidation(input, { valide: true });
        }
    }
    formulaire.querySelector('.etudiant-details').hidden = true;
    formulaire.querySelector('.etudiant').classList.remove('actif');
    formulaire.querySelectorAll('textarea').forEach(ajusterHauteur);

    // Motifs standardisés : une case à cocher par choix de la colonne
    const motifs = (options?.motifs?.choix ?? []).map(motif => {
        const style = options?.motifs?.styles?.[motif];
        const etiquette = document.createElement('label');
        etiquette.className = 'motif-choix';
        etiquette.style.setProperty('--motif-fond', style?.fillColor || 'var(--rdv-1)');
        etiquette.style.setProperty('--motif-texte', style?.textColor || 'var(--clinique-fonce)');
        const caseMotif = document.createElement('input');
        caseMotif.type = 'checkbox';
        caseMotif.value = motif;
        etiquette.append(caseMotif, motif);
        return etiquette;
    });
    const zoneMotifs = document.getElementById('formulaire-motifs');
    zoneMotifs.replaceChildren(...motifs);
    zoneMotifs.classList.toggle('vide', motifs.length === 0);

    boutonsAjout().forEach(b => { b.disabled = false; });
    annulerForcageFormulaire();
    delete formulaire.dataset.plagesAcceptees;
    majDisponibilitesFormulaire(creneauxProvisoires());
}

// Contrôles avant création : champs obligatoires, contact, formats, cohérence des créneaux
function verifierFormulaire() {
    const erreurs = [];
    const signaler = (input, message) => {
        afficherValidation(input, { valide: false, message });
        erreurs.push({ input, message });
    };

    for (const input of formulaire.querySelectorAll('[data-requis]')) {
        if (!input.value.trim() && !input.validity.badInput) {
            signaler(input, `${input.dataset.requis} : obligatoire`);
        }
    }
    for (const [champ, validateur] of Object.entries(VALIDATEURS)) {
        const input = champFormulaire(champ);
        if (input.validity.badInput) {
            signaler(input, 'Date incomplète');
            continue;
        }
        const resultat = validerDansFormulaire(champ, input.value);
        if (!resultat.valide) {
            signaler(input, resultat.message);
        } else if (input.value.trim() || !input.dataset.requis) {
            input.value = resultat.valeur;
            afficherValidation(input, resultat);
        }
    }
    if (!valeurChamp(formulaire, 'Mail_patient') && !valeurChamp(formulaire, 'Telephone_patient')) {
        erreurs.push({ input: champFormulaire('Mail_patient'), message: 'Au moins un moyen de contact : email ou téléphone' });
    }
    if (valeurChamp(formulaire, 'Etudiant') && !valeurChamp(formulaire, 'Etablissement_COMUE')) {
        signaler(champFormulaire('Etablissement_COMUE'), 'Établissement obligatoire pour un RDV étudiant');
    }
    return erreurs;
}

function lireFormulaire(statut) {
    const champs = { Statut_RDV: statut };
    for (const input of formulaire.querySelectorAll('[data-champ]')) {
        const champ = input.dataset.champ;
        const saisie = input.type === 'checkbox' ? input.checked : input.value;
        champs[champ] = TYPES_CHAMPS[champ] ? depuisSaisie(champ, saisie, null) : String(saisie).trim();
    }
    const motifs = [...document.querySelectorAll('#formulaire-motifs input:checked')].map(c => c.value);
    champs.Motifs_standardises = options?.motifs?.type === 'texte' ? motifs.join(', ') : ['L', ...motifs];
    if (!champs.Etudiant) {
        champs.Etablissement_COMUE = '';
    }
    return champs;
}

async function soumettreFormulaire(e) {
    e.preventDefault();
    const zoneErreurs = document.getElementById('formulaire-erreurs');
    const erreurs = verifierFormulaire();
    zoneErreurs.classList.remove('avertissement');
    if (erreurs.length) {
        const liste = document.createElement('ul');
        liste.append(...erreurs.map(erreur => Object.assign(document.createElement('li'), { textContent: erreur.message })));
        zoneErreurs.replaceChildren(`${erreurs.length} ${plur(erreurs.length, 'point')} à corriger avant d'ajouter le RDV :`, liste);
        zoneErreurs.hidden = false;
        zoneErreurs.scrollIntoView({ block: 'nearest' });
        erreurs[0].input.focus();
        return;
    }
    zoneErreurs.hidden = true;

    // Créneaux hors des plages de permanence : alerte, que l'on peut ignorer (une fois par saisie)
    const horsPlage = [1, 2]
        .map(n => ({ n, saisie: valeurChamp(formulaire, `Creneau_RDV_${n}`) }))
        .filter(creneau => horsPlages(creneau.saisie));
    if (horsPlage.length && !formulaire.dataset.plagesAcceptees) {
        if (!(await alerterHorsPlages(horsPlage))) {
            champFormulaire(`Creneau_RDV_${horsPlage[0].n}`).focus();
            return;
        }
        formulaire.dataset.plagesAcceptees = '1';
    }

    // Bouton utilisé (Entrée dans un champ : le premier, « créneaux proposés »)
    const bouton = e.submitter?.dataset.ajout ? e.submitter : boutonsAjout()[0];
    const action = ACTIONS_AJOUT[bouton.dataset.ajout];
    boutonsAjout().forEach(b => { b.disabled = true; });
    bouton.textContent = 'Vérification des salles…';
    await rafraichirOccupation();
    const occupees = [1, 2].filter(n => formulaire._disponibilites?.[n]?.etat === 'occupee');
    if (occupees.length && !bouton.dataset.forcer) {
        const liste = document.createElement('ul');
        liste.append(...occupees.map(n => Object.assign(document.createElement('li'), { textContent: `RDV ${n} : ${resumeConflit(formulaire._disponibilites[n])}` })));
        zoneErreurs.replaceChildren('Conflit de salle : la salle choisie est déjà occupée.', liste,
            'Choisissez une salle libre, ou cliquez à nouveau pour ajouter le RDV malgré le conflit.');
        zoneErreurs.classList.add('avertissement');
        zoneErreurs.hidden = false;
        zoneErreurs.scrollIntoView({ block: 'nearest' });
        annulerForcageFormulaire();
        boutonsAjout().forEach(b => { b.disabled = false; });
        bouton.dataset.forcer = '1';
        bouton.textContent = action.forcer;
        bouton.classList.add('forcer');
        return;
    }
    bouton.textContent = 'Ajout en cours…';
    const champs = lireFormulaire(action.statut);
    try {
        await fileEcritures;
        const { rowId, identifiant } = await source.creer(champs);
        afficherSucces(rowId, identifiant, action);
    } catch (erreur) {
        console.error('Échec de la création du RDV :', erreur);
        zoneErreurs.replaceChildren(`Le RDV n'a pas pu être ajouté : ${erreur.message}`);
        zoneErreurs.hidden = false;
        boutonsAjout().forEach(b => { b.disabled = false; });
        annulerForcageFormulaire();
    }
}

function afficherSucces(rowId, identifiant, action) {
    const libelle = champ => {
        const select = champFormulaire(champ);
        return select.value ? (select.selectedOptions[0].dataset.libelle ?? select.selectedOptions[0].text) : '';
    };
    const creneau = n => {
        const date = champFormulaire(`Creneau_RDV_${n}`).value;
        return date ? `${formaterSaisieDate(date)}${libelle(`Lieu_RDV_${n}`) ? ` — ${libelle(`Lieu_RDV_${n}`)}` : ''}` : '';
    };
    const lignes = [
        ['Patient', `${valeurChamp(formulaire, 'Nom_patient').toUpperCase()} ${valeurChamp(formulaire, 'Prenom_patient')}`],
        ['RDV 1', creneau(1)],
        ['RDV 2', creneau(2)],
        ['Visioconférence', valeurChamp(formulaire, 'Visioconference') ? 'Oui' : ''],
        ['Étudiant', valeurChamp(formulaire, 'Etudiant') ? libelle('Etablissement_COMUE') : ''],
    ].filter(([, valeur]) => valeur);

    document.getElementById('succes-titre').textContent = action.titre;
    document.getElementById('succes-aide').textContent = action.aide;
    document.getElementById('succes-identifiant').textContent = identifiant || `ligne ${rowId}`;
    succes.querySelector('.copier').hidden = !identifiant;
    document.getElementById('succes-recap').replaceChildren(...lignes.flatMap(([terme, valeur]) => [
        Object.assign(document.createElement('dt'), { textContent: terme }),
        Object.assign(document.createElement('dd'), { textContent: valeur }),
    ]));
    formulaire.hidden = true;
    succes.hidden = false;
    document.getElementById('succes-titre').focus();
}

document.getElementById('nouveau-rdv').addEventListener('click', ouvrirFormulaire);
document.getElementById('succes-nouveau').addEventListener('click', () => {
    reinitialiserFormulaire();
    champFormulaire('Nom_patient').focus();
});
formulaire.addEventListener('submit', soumettreFormulaire);

fondFormulaire.addEventListener('click', (e) => {
    if (e.target === fondFormulaire || e.target.closest('[data-fermer]')) {
        fermerFormulaire();
    } else if (e.target.closest('.copier')) {
        copierIdentifiant(e.target.closest('.copier'));
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !fondFormulaire.hidden) {
        fermerFormulaire();
    }
});

// Saisie dans le formulaire (listes et cases déclenchent aussi « input ») : l'erreur d'un champ s'efface dès qu'il est corrigé
formulaire.addEventListener('input', (e) => {
    const input = e.target.closest('[data-champ]');
    if (input?.tagName === 'TEXTAREA') {
        ajusterHauteur(input);
    }
    if (/^(Creneau|Lieu)_RDV_/.test(input?.dataset.champ ?? '')) {
        annulerForcageFormulaire();
        planifierDisponibilites();
    }
    if (/^Creneau_RDV_/.test(input?.dataset.champ ?? '')) {
        delete formulaire.dataset.plagesAcceptees;
    }
    if (input?.dataset.champ === 'Etudiant') {
        formulaire.querySelector('.etudiant-details').hidden = !input.checked;
        formulaire.querySelector('.etudiant').classList.toggle('actif', input.checked);
    }
    if (!input || input.getAttribute('aria-invalid') !== 'true') {
        return;
    }
    const validateur = VALIDATEURS[input.dataset.champ];
    const requisOk = !input.dataset.requis || input.value.trim();
    if (requisOk && (!validateur || validerDansFormulaire(input.dataset.champ, input.value).valide)) {
        afficherValidation(input, { valide: true });
    }
});

// ---------- Disponibilité des salles ----------
// Occupation relue dans toute la table (RDV confirmés et créneaux proposés, que le filtre de la vue masque),
// complétée par les créneaux saisis sur les demandes affichées (concurrence entre demandes).

let occupations = null;            // null tant que l'occupation n'a pas pu être lue
let chargementOccupation = null;

function heureParis(ms) {
    const p = partiesParis(new Date(ms));
    return `${p.heure}h${p.minute}`;
}

function nomCourt(nom, prenom) {
    const initiale = String(prenom || '').trim().charAt(0);
    return `${String(nom || '').toUpperCase()}${initiale ? ` ${initiale}.` : ''}`;
}

function construireOccupations(lignes) {
    return lignes
        .filter(ligne => STATUTS_OCCUPANT[ligne.statut])
        .flatMap(ligne => ligne.creneaux.map(creneau => {
            const date = versDate(creneau.date);
            const salle = lireReference(creneau.lieu)?.id;
            if (!date || !salle) {
                return null;
            }
            return {
                rowId: ligne.id, n: creneau.n, salle, origine: STATUTS_OCCUPANT[ligne.statut],
                identifiant: String(ligne.identifiant || ''), patient: nomCourt(ligne.nom, ligne.prenom),
                debut: date.getTime(), fin: date.getTime() + DUREE_RDV_MS,
            };
        }))
        .filter(Boolean);
}

// Créneaux (date + lieu) actuellement saisis sur les demandes affichées
function creneauxProvisoires() {
    const liste = [];
    for (const carte of cartes.values()) {
        if (STATUTS_OCCUPANT[carte.dossier.Statut_RDV]) {
            continue;
        }
        for (const n of [1, 2]) {
            const saisie = valeurChamp(carte.element, `Creneau_RDV_${n}`);
            const salle = valeurChamp(carte.element, `Lieu_RDV_${n}`);
            if (!saisie || !salle || carte.element.querySelector(`[data-champ="Creneau_RDV_${n}"]`).validity.badInput) {
                continue;
            }
            const debut = depuisSaisieDate(saisie) * 1000;
            liste.push({
                rowId: carte.dossier.id, n, salle, origine: 'demande',
                identifiant: String(carte.dossier.id_rdv_clinique || ''), patient: nomCourt(carte.dossier.Nom_patient, carte.dossier.Prenom_patient),
                debut, fin: debut + DUREE_RDV_MS,
            });
        }
    }
    return liste;
}

const chevauche = (creneau, rowId, salle, debut, fin) =>
    creneau.rowId !== rowId && creneau.salle === String(salle) && creneau.debut < fin && debut < creneau.fin;

// État d'un créneau : incomplet, inconnu (occupation illisible), libre,
// concurrence (créneau proposé à un autre patient ou saisi sur une autre demande), occupee (RDV confirmé)
function analyserCreneau(rowId, saisie, salle, provisoires) {
    if (!saisie || !salle) {
        return { etat: 'incomplet' };
    }
    if (occupations === null) {
        return { etat: 'inconnu' };
    }
    const debut = depuisSaisieDate(saisie) * 1000;
    const fin = debut + DUREE_RDV_MS;
    const fermes = occupations.filter(c => c.origine === 'ferme' && chevauche(c, rowId, salle, debut, fin));
    const autres = [...occupations, ...provisoires].filter(c => c.origine !== 'ferme' && chevauche(c, rowId, salle, debut, fin));
    return { etat: fermes.length ? 'occupee' : autres.length ? 'concurrence' : 'libre', fermes, autres };
}

function decrireCreneau(c) {
    const qui = `${c.identifiant ? `RDV ${c.identifiant}` : `ligne ${c.rowId}`} (${c.patient}) ${heureParis(c.debut)}–${heureParis(c.fin)}`;
    return c.origine === 'provisoire' ? `${qui}, créneau proposé au patient` : c.origine === 'demande' ? `${qui}, demande en cours` : qui;
}

function resumeConflit(analyse) {
    return analyse.fermes.map(decrireCreneau).join(', ');
}

function afficherDisponibilite(conteneur, n, analyse) {
    const zone = conteneur.querySelector(`.creneau.rdv-${n} .disponibilite`);
    const messages = {
        inconnu: () => 'Disponibilité de la salle non vérifiée',
        libre: () => '✓ Salle libre sur ce créneau',
        occupee: () => `Salle occupée : ${resumeConflit(analyse)}`,
        concurrence: () => `Salle déjà envisagée : ${analyse.autres.map(decrireCreneau).join(' ; ')}`,
    };
    zone.className = `disponibilite ${analyse.etat}`;
    zone.textContent = messages[analyse.etat]?.() ?? '';
}

// Marque dans la liste les salles déjà prises (« occupée ») ou proposées (« proposée ») au créneau saisi
function annoterSalles(select, rowId, saisie) {
    const debut = saisie && occupations ? depuisSaisieDate(saisie) * 1000 : null;
    for (const option of select.options) {
        if (!option.value) {
            continue;
        }
        const libelle = option.dataset.libelle ?? option.textContent;
        option.dataset.libelle = libelle;
        const pris = debut === null ? [] : occupations.filter(c => chevauche(c, rowId, option.value, debut, debut + DUREE_RDV_MS));
        const suffixe = pris.some(c => c.origine === 'ferme') ? ' — occupée' : pris.length ? ' — proposée' : '';
        option.textContent = libelle + suffixe;
    }
}

function analyserConteneur(conteneur, rowId, provisoires) {
    conteneur._disponibilites = {};
    for (const n of [1, 2]) {
        const input = conteneur.querySelector(`[data-champ="Creneau_RDV_${n}"]`);
        const saisie = input.validity.badInput ? '' : valeurChamp(conteneur, `Creneau_RDV_${n}`);
        const analyse = analyserCreneau(rowId, saisie, valeurChamp(conteneur, `Lieu_RDV_${n}`), provisoires);
        conteneur._disponibilites[n] = analyse;
        afficherDisponibilite(conteneur, n, analyse);
        annoterSalles(conteneur.querySelector(`[data-champ="Lieu_RDV_${n}"]`), rowId, saisie);
    }
}

function majDisponibilitesFormulaire(provisoires) {
    analyserConteneur(document.getElementById('formulaire-rdv'), null, provisoires);
}

function majDisponibilites() {
    const provisoires = creneauxProvisoires();
    for (const carte of cartes.values()) {
        analyserConteneur(carte.element, carte.dossier.id, provisoires);
        majAlertes(carte.element);
    }
    if (!document.getElementById('formulaire-fond').hidden) {
        majDisponibilitesFormulaire(provisoires);
    }
}

function aConflitDeSalle(element) {
    return [1, 2].some(n => ['occupee', 'concurrence'].includes(element?._disponibilites?.[n]?.etat));
}

let minuterieDisponibilites = null;
function planifierDisponibilites() {
    clearTimeout(minuterieDisponibilites);
    minuterieDisponibilites = setTimeout(() => {
        majDisponibilites();
        appliquerFiltre();
    }, 150);
}

async function rafraichirOccupation() {
    if (!chargementOccupation) {
        chargementOccupation = source.chargerOccupation()
            .then(lignes => { occupations = construireOccupations(lignes); })
            .catch(e => console.warn("Impossible de lire l'occupation des salles :", e))
            .finally(() => { chargementOccupation = null; });
    }
    await chargementOccupation;
    majDisponibilites();
    appliquerFiltre();
}

let minuterieOccupation = null;
function planifierOccupation() {
    clearTimeout(minuterieOccupation);
    minuterieOccupation = setTimeout(rafraichirOccupation, 400);
}

// Les RDV confirmés ailleurs (autre vue, autre utilisateur) ne déclenchent pas de mise à jour du widget
setInterval(() => {
    if (cartes.size || !document.getElementById('formulaire-fond').hidden) {
        rafraichirOccupation();
    }
}, 2 * 60 * 1000);

// Bouton armé pour un second clic « malgré le conflit »
function demanderForcage(bouton, boutons, texte) {
    boutons.forEach(b => { b.disabled = false; });
    bouton.dataset.forcer = '1';
    bouton.classList.add('forcer');
    bouton.textContent = texte;
    setTimeout(() => {
        if (bouton.dataset.forcer && !bouton.disabled) {
            delete bouton.dataset.forcer;
            bouton.classList.remove('forcer');
            bouton.textContent = ACTIONS_STATUT[bouton.dataset.action].libelle;
        }
    }, 8000);
}
