const FUSEAU = 'Europe/Paris';

// Valeurs écrites dans la colonne Statut par les boutons « Confirmer le RDV » et « Rejeter le RDV ».
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
    { name: "Statut", title: "Statut de la demande", type: "Choice,Text", optional: false, description: `Colonne filtrée dans la vue ; reçoit « ${STATUT_CONFIRME} » ou « ${STATUT_REJETE} » via les boutons du widget` },
];

// Nature de chaque champ modifiable : pilote la conversion saisie <-> valeur Grist
const TYPES_CHAMPS = {
    Mail_patient: 'texte',
    Telephone_patient: 'texte',
    Commentaires: 'texte',
    Creneau_RDV_1: 'date',
    Creneau_RDV_2: 'date',
    Lieu_RDV_1: 'lieu',
    Lieu_RDV_2: 'lieu',
    Visioconference: 'bool',
};

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Hors de Grist (fichier ouvert directement, ou ?demo), le widget tourne sur des données fictives
const MODE_DEMO = typeof grist === 'undefined' || window.self === window.top || new URLSearchParams(location.search).has('demo');

const source = MODE_DEMO ? creerSourceDemo() : creerSourceGrist();

const cartes = new Map();       // rowId -> { element, dossier }
const enCours = new Map();      // "rowId:champ" -> valeur en cours d'enregistrement (non écrasée par une mise à jour Grist)
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

            const iStatut = trouverColonne(mappings.Statut);
            const statuts = iStatut >= 0 && colonnes.type[iStatut] === 'Choice' ? (lireWidgetOptions(iStatut).choices || []) : null;
            return { lieux, statuts };
        },

        selectionner(rowId) {
            grist.setCursorPos({ rowId }).catch(() => {});
        },
    };
}

function creerSourceDemo() {
    const STATUT_DEMANDE = 'Demande reçue';
    const salles = [
        { valeur: 1, libelle: 'Salle Portalis' },
        { valeur: 2, libelle: 'Salle Cambacérès' },
        { valeur: 3, libelle: 'Salle Montesquieu' },
        { valeur: 4, libelle: 'Salle du conseil' },
        { valeur: 5, libelle: 'Bureau 2.14' },
    ];
    const date = (jour, heures, minutes = 0) => new Date(Date.UTC(2026, 9, jour, heures - 2, minutes));
    const dossiers = [
        { id: 41, id_rdv_clinique: 'RDV-2026-041', Nom_patient: 'Martin', Prenom_patient: 'Camille', Mail_patient: 'camille.martin@exemple.fr', Telephone_patient: '06 12 34 56 78', Creneau_RDV_1: date(6, 14), Lieu_RDV_1: 1, Creneau_RDV_2: null, Lieu_RDV_2: 0, Visioconference: false, Commentaires: 'Souhaite un RDV en fin de journée.', Statut: STATUT_DEMANDE },
        { id: 42, id_rdv_clinique: 'RDV-2026-042', Nom_patient: 'Nguyen', Prenom_patient: 'Thomas', Mail_patient: '', Telephone_patient: '07 45 21 98 03', Creneau_RDV_1: date(7, 10, 30), Lieu_RDV_1: 3, Creneau_RDV_2: date(21, 10, 30), Lieu_RDV_2: 3, Visioconference: true, Commentaires: '', Statut: STATUT_DEMANDE },
        { id: 43, id_rdv_clinique: 'RDV-2026-043', Nom_patient: 'Bernard', Prenom_patient: 'Léa', Mail_patient: 'lea.bernard@exemple.org', Telephone_patient: '', Creneau_RDV_1: null, Lieu_RDV_1: 0, Creneau_RDV_2: null, Lieu_RDV_2: 0, Visioconference: false, Commentaires: 'Litige bailleur — pièces transmises par mail.', Statut: STATUT_DEMANDE },
        { id: 44, id_rdv_clinique: 'RDV-2026-044', Nom_patient: 'Haddad', Prenom_patient: 'Yanis', Mail_patient: '', Telephone_patient: '', Creneau_RDV_1: date(8, 9), Lieu_RDV_1: 0, Creneau_RDV_2: null, Lieu_RDV_2: 0, Visioconference: false, Commentaires: 'Demande déposée à l’accueil, coordonnées non laissées.', Statut: STATUT_DEMANDE },
        { id: 45, id_rdv_clinique: 'RDV-2026-045', Nom_patient: 'Leroy', Prenom_patient: 'Inès', Mail_patient: 'ines.leroy@exemple', Telephone_patient: '06 98 76 54 32', Creneau_RDV_1: date(9, 11), Lieu_RDV_1: 2, Creneau_RDV_2: date(23, 11), Lieu_RDV_2: 4, Visioconference: false, Commentaires: '', Statut: STATUT_DEMANDE },
    ];

    let surDonnees = null;
    // Simule le filtre de la vue Grist sur le statut
    const publier = () => surDonnees(structuredClone(dossiers.filter(d => d.Statut === STATUT_DEMANDE)), false);

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
    texteMessage.textContent = 'Aucune demande de RDV à traiter.';
    message.hidden = n > 0;
}

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

    for (const input of element.querySelectorAll('[data-champ]')) {
        const champ = input.dataset.champ;
        if (input.tagName === 'SELECT') {
            remplirSelect(input, champ, dossier[champ]);
        }
        // Ne jamais écraser une saisie en cours ou pas encore enregistrée
        if (input === document.activeElement || enCours.has(`${dossier.id}:${champ}`)) {
            continue;
        }
        const valeur = versSaisie(champ, dossier[champ]);
        if (input.type === 'checkbox') {
            input.checked = valeur;
        } else {
            input.value = valeur;
        }
    }

    // Vue non filtrée sur le statut : la demande traitée reste affichée, boutons désactivés
    const traitee = Object.values(ACTIONS_STATUT).some(action => action.statut === dossier.Statut);
    for (const [nom, action] of Object.entries(ACTIONS_STATUT)) {
        const actif = dossier.Statut === action.statut;
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

function remplirSelect(select, champ, valeur) {
    const choix = [...(options?.lieux?.[champ]?.choix ?? [])];
    const reference = lireReference(valeur);
    if (reference && !choix.some(c => String(c.valeur) === reference.id)) {
        choix.push({ valeur: reference.id, libelle: reference.libelle || `Salle ${reference.id}` });
    }
    const signature = choix.map(c => `${c.valeur}=${c.libelle}`).join('|');
    if (select.dataset.signature === signature) {
        return;
    }
    const valeurActuelle = select.value;
    select.replaceChildren(new Option('— Lieu à définir —', ''), ...choix.map(c => new Option(c.libelle, String(c.valeur))));
    select.value = valeurActuelle;
    select.dataset.signature = signature;
}

function valeurChamp(element, champ) {
    const input = element.querySelector(`[data-champ="${champ}"]`);
    return input.type === 'checkbox' ? input.checked : input.value.trim();
}

function telephoneValide(telephone) {
    const chiffres = telephone.replace(/[\s.\-()]/g, '');
    return /^(\+33|0033|0)[1-9]\d{8}$/.test(chiffres) || /^\+\d{8,15}$/.test(chiffres);
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
        } else if (!EMAIL_VALIDE.test(email)) {
            alertes.push({ niveau: 'avertissement', texte: 'Email à vérifier' });
        }
        if (!telephone) {
            alertes.push({ niveau: 'avertissement', texte: 'Téléphone manquant' });
        } else if (!telephoneValide(telephone)) {
            alertes.push({ niveau: 'avertissement', texte: 'Téléphone à vérifier' });
        }
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
        afficherBandeau('alerte', `Statut ${manquants.join(' et ')} absent des choix de la colonne Statut : le changement de statut risque d’échouer.`);
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
        await ecrire(carte.dossier.id, { Statut: action.statut });
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
    if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') {
        sauvegarder(e.target);
    }
});

liste.addEventListener('input', (e) => {
    const element = e.target.closest('.carte');
    if (element) {
        majAlertes(element);
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
    const bouton = e.target.closest('[data-action]');
    if (bouton) {
        changerStatut(bouton);
    } else {
        selectionner(e.target.closest('.carte'));
    }
});
