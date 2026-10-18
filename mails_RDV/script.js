const FUSEAU = 'Europe/Paris';

// Table du document contenant les modèles de mail (une ligne par modèle), créée par le widget si besoin
const TABLE_MODELES = 'Modeles_mails';
// Champ du modèle -> colonne de la table
const COLONNES_TABLE = { nom: 'Nom', objet: 'Objet', corps: 'Corps', ordre: 'Ordre' };
const TYPES_COLONNES_TABLE = { nom: 'Text', objet: 'Text', corps: 'Text', ordre: 'Int' };

// Colonnes de la table des RDV (mêmes noms que les widgets briefing et gestion_demandes_RDV)
const COLONNES = [
    { name: "id_rdv_clinique", title: "Identifiant du RDV", type: "Text", optional: true },
    { name: "Nom_patient", title: "Nom du patient", type: "Text", optional: false },
    { name: "Prenom_patient", title: "Prénom du patient", type: "Text", optional: false },
    { name: "Mail_patient", title: "Mail du patient", type: "Text", optional: false, description: "Destinataire du mail" },
    { name: "Creneau_RDV_1", title: "Créneau RDV 1", type: "DateTime", optional: false },
    { name: "Lieu_RDV_1", title: "Lieu RDV 1", type: "Ref,Text,Choice", optional: true, description: "Salle du premier rendez-vous (le libellé affiché dans Grist est repris dans le mail)" },
    { name: "Adresse_RDV_1", title: "Adresse du lieu RDV 1", type: "Text,Any", optional: true, description: "Adresse de la salle du premier rendez-vous (par ex. colonne formule $Lieu_RDV_1.Adresse) ; variable {{rdv1_adresse}}" },
    { name: "Creneau_RDV_2", title: "Créneau RDV 2", type: "DateTime", optional: true },
    { name: "Lieu_RDV_2", title: "Lieu RDV 2", type: "Ref,Text,Choice", optional: true, description: "Salle du second rendez-vous" },
    { name: "Adresse_RDV_2", title: "Adresse du lieu RDV 2", type: "Text,Any", optional: true, description: "Adresse de la salle du second rendez-vous (par ex. colonne formule $Lieu_RDV_2.Adresse) ; variable {{rdv2_adresse}}" },
    { name: "Visioconference", title: "Visioconférence", type: "Bool", optional: true, description: "Utilisée par les paragraphes [si visio] / [si présentiel] des modèles" },
];

// Date limite de réponse proposée par défaut ({{date_limite}}) : dans DELAI_REPONSE_JOURS jours,
// au plus tard la veille du RDV 1, à HEURE_LIMITE
const DELAI_REPONSE_JOURS = 3;
const HEURE_LIMITE = '17:00';

// Variables utilisables dans l'objet et le texte des modèles : {{cle}}.
// « bloc » : variable prévue seule dans son paragraphe
const VARIABLES = [
    { cle: 'identite', libelle: 'Prénom NOM', valeur: d => d.identite },
    { cle: 'prenom', libelle: 'Prénom', valeur: d => d.prenom },
    { cle: 'nom', libelle: 'Nom', valeur: d => d.nom },
    { cle: 'identifiant', libelle: 'Identifiant du RDV', valeur: d => d.identifiant },
    { cle: 'rdv1_date', libelle: 'Date RDV 1', valeur: d => d.rdv1.date },
    { cle: 'rdv1_heure', libelle: 'Heure RDV 1', valeur: d => d.rdv1.heure },
    { cle: 'rdv1_lieu', libelle: 'Lieu RDV 1', valeur: d => d.rdv1.lieu },
    { cle: 'rdv1_adresse', libelle: 'Adresse RDV 1', valeur: d => d.rdv1.adresse },
    { cle: 'rdv2_date', libelle: 'Date RDV 2', valeur: d => d.rdv2.date },
    { cle: 'rdv2_heure', libelle: 'Heure RDV 2', valeur: d => d.rdv2.heure },
    { cle: 'rdv2_lieu', libelle: 'Lieu RDV 2', valeur: d => d.rdv2.lieu },
    { cle: 'rdv2_adresse', libelle: 'Adresse RDV 2', valeur: d => d.rdv2.adresse },
    { cle: 'date_limite', libelle: 'Date limite de réponse', valeur: d => d.date_limite },
    { cle: 'date_jour', libelle: 'Date du jour', valeur: d => d.date_jour },
    { cle: 'texte_personnalise', libelle: 'Texte personnalisé', bloc: true, valeur: d => d.texte_personnalise },
];
const VARIABLES_PAR_CLE = Object.fromEntries(VARIABLES.map(v => [v.cle, v]));

// Paragraphes conditionnels : « [si visio] Texte… » (ou « [si pas visio] Texte… »)
const CONDITIONS = [
    { cle: 'visio', libelle: 'RDV en visio', test: d => d.visio },
    { cle: 'présentiel', libelle: 'RDV en présentiel', test: d => !d.visio },
    { cle: 'rdv2', libelle: 'RDV 2 programmé', test: d => Boolean(d.rdv2.debut) },
    // Adresses renseignées et identiques (casse, accents et espaces ignorés) : par ex. une seule mention de l'adresse
    { cle: 'même adresse', libelle: 'Même adresse RDV 1 et 2', test: d => Boolean(d.rdv1.adresse) && normaliser(d.rdv1.adresse) === normaliser(d.rdv2.adresse) },
];

// Styles écrits dans le HTML du mail : conservés au collage dans la messagerie (les classes CSS ne le sont pas)
const STYLES = {
    p: 'margin: 0 0 12px;',
    ul: 'margin: 0 0 12px; padding-left: 24px;',
    surligne: 'background-color: #fff0a8; padding: 0 2px;',
};

const SIGNATURE = "Bien cordialement,\nLa Clinique juridique de la Faculté de droit de l'Université Jean Moulin Lyon 3";
const CONTACT = "Nous restons bien sûr à votre entière disposition pour toute question ou information complémentaire.";
const URL_RETOUR_EXPERIENCE = "https://grist.numerique.gouv.fr/o/docs/forms/3aj3LBssvkETWoLPaoJps7/57";

const rappel = n => ({
    nom: `Rappel RDV ${n}`,
    objet: `Rappel de votre rendez-vous du {{rdv${n}_date}} à {{rdv${n}_heure}} – Clinique juridique`,
    corps: [
        'Bonjour {{identite}},',
        `Nous nous permettons de vous écrire afin de vous rappeler que vous avez un rendez-vous le **{{rdv${n}_date}} à {{rdv${n}_heure}}** dans le cadre de votre suivi par la Clinique juridique de la Faculté de droit de l'Université Jean Moulin Lyon 3.`,
        `[si présentiel] Lieu du rendez-vous : **{{rdv${n}_lieu}}**.`,
        '[si visio] Ce rendez-vous se déroulera en visioconférence.',
        '{{texte_personnalise}}',
        '==Si vous ne pouvez pas vous présenter à ce rendez-vous, merci de nous en informer au plus vite par retour de mail.==',
        CONTACT,
        SIGNATURE,
    ].join('\n\n'),
});

// Modèles enregistrés à la création de la table (repris du widget emailgen)
const MODELES_DEFAUT = [
    {
        nom: 'Proposition de créneaux',
        objet: 'Proposition de créneaux de rendez-vous – Clinique juridique',
        corps: [
            'Bonjour {{identite}},',
            "Merci d'avoir pris rendez-vous avec la Clinique juridique de la Faculté de droit de l'Université Jean Moulin Lyon 3.",
            'Nous vous rappelons que la Clinique juridique **ne peut pas intervenir si vous êtes déjà suivi(e) par un professionnel du droit** (avocat, notaire, etc.).',
            'Nous pouvons vous proposer un rendez-vous le **=={{rdv1_date}} à {{rdv1_heure}}==**. Ce premier rendez-vous vous permettra d’exposer votre situation et vos questions.',
            '[si présentiel] Le lieu de ce premier rendez-vous est : {{rdv1_lieu}}.',
            '[si visio] Ce rendez-vous se déroulera en visioconférence.',
            '[si rdv2] Les cliniciens vous restitueront leur travail au cours d’un second rendez-vous le **=={{rdv2_date}} à {{rdv2_heure}}==**.',
            '[si présentiel] Le lieu de ce second rendez-vous est : {{rdv2_lieu}}.',
            '{{texte_personnalise}}',
            '**==Merci de nous confirmer que ces créneaux vous conviennent par retour de mail. Ces propositions de rendez-vous sont valables jusqu’au {{date_limite}}. Au-delà, ces créneaux seront attribués à d’autres personnes.==**',
            'Si ces rendez-vous ne vous conviennent pas ou si vous ne pouvez pas vous y présenter, contactez-nous au plus vite par retour de mail pour convenir d’autres créneaux.',
            'Pour transmettre des documents relatifs à votre situation en amont de votre rendez-vous, n’hésitez pas à nous les envoyer par retour de mail.',
            CONTACT,
            SIGNATURE,
            "Adresse et accès de la Manufacture des Tabacs (site de l'Université Jean Moulin Lyon 3) : 1, av. des Frères Lumière, 69008 Lyon\n[Accès et détails complémentaires](https://www.univ-lyon3.fr/campus-de-la-manufacture-des-tabacs)",
        ].join('\n\n'),
    },
    rappel(1),
    rappel(2),
    {
        nom: "Retour d'expérience",
        objet: "Retour d'expérience sur votre rendez-vous – Clinique juridique",
        corps: [
            'Bonjour {{identite}},',
            'Nous espérons que vos rendez-vous avec la Clinique juridique vous ont été bénéfiques et qu’ils se sont bien déroulés.',
            'Dans une perspective d’amélioration continue, vous trouverez ci-après un formulaire anonyme pour nous faire part de vos remarques et suggestions sur votre expérience auprès de la Clinique juridique.',
            `**Formulaire de retour d'expérience (moins d'une minute) : ${URL_RETOUR_EXPERIENCE}**`,
            '{{texte_personnalise}}',
            SIGNATURE,
        ].join('\n\n'),
    },
];

const MODELE_NOUVEAU = {
    nom: 'Nouveau modèle',
    objet: ' – Clinique juridique',
    corps: ['Bonjour {{identite}},', '{{texte_personnalise}}', CONTACT, SIGNATURE].join('\n\n'),
};

// Hors de Grist (fichier ouvert directement, ou ?demo), le widget tourne sur des données fictives
const MODE_DEMO = typeof grist === 'undefined' || window.self === window.top || new URLSearchParams(location.search).has('demo');

const CLE_MODELE_CHOISI = 'mails-rdv-modele';

let modeles = [];                    // modèles lus dans la table, triés par ordre
let tableAbsente = false;
let rdvs = [];                       // RDV de la vue (liste « RDV » de la barre d'outils)
let rdv = null;                      // RDV sélectionné (colonnes du widget)
let colonnesAssociees = true;
let idModeleChoisi = Number(lireReglage(CLE_MODELE_CHOISI)) || null;
let gestionOuverte = false;
let edition = null;                  // copie modifiée du modèle en cours d'édition { id, nom, objet, corps, ordre }
let dernierChampModele = null;       // champ (objet ou texte) recevant les variables insérées
const textesPerso = new Map();       // rowId -> texte personnalisé (le temps de la session, non enregistré)
const limites = new Map();           // rowId -> { date: 'AAAA-MM-JJ', heure: 'HH:MM' } choisie pour {{date_limite}}
let minuterieToast = null;

const $ = id => document.getElementById(id);

const source = MODE_DEMO ? creerSourceDemo() : creerSourceGrist();

brancherInterface();

source.demarrer({
    surRdvs(records) {
        rdvs = records;
        majChoixRdv();
    },
    surRdv(record, colonnesOk) {
        rdv = record;
        colonnesAssociees = colonnesOk;
        majChoixRdv();
        afficher();
    },
});
rechargerModeles();

// ---------- Sources de données ----------

function creerSourceGrist() {
    const versColonnesTable = champs => Object.fromEntries(Object.entries(champs).map(([champ, valeur]) => [COLONNES_TABLE[champ], valeur]));

    return {
        demarrer(rappels) {
            // Accès complet : lecture et écriture de la table des modèles
            grist.ready({ requiredAccess: 'full', columns: COLONNES, allowSelectBy: true });
            grist.onRecords(records => rappels.surRdvs((grist.mapColumnNames(records) || []).map((r, i) => ({ ...r, id: records[i].id }))));
            grist.onRecord(record => {
                const colonnes = record ? grist.mapColumnNames(record) : null;
                rappels.surRdv(colonnes ? { ...colonnes, id: record.id } : null, !record || Boolean(colonnes));
            });
        },

        // null si la table n'existe pas
        async chargerModeles() {
            const tables = await grist.docApi.listTables();
            if (!tables.includes(TABLE_MODELES)) {
                return null;
            }
            const table = await grist.docApi.fetchTable(TABLE_MODELES);
            return table.id.map((id, i) => ({
                id,
                ...Object.fromEntries(Object.entries(COLONNES_TABLE).map(([champ, colonne]) => [champ, table[colonne]?.[i]])),
            }));
        },

        async creerTable(liste) {
            await grist.docApi.applyUserActions([
                ['AddTable', TABLE_MODELES, Object.entries(COLONNES_TABLE).map(([champ, colonne]) => ({ id: colonne, type: TYPES_COLONNES_TABLE[champ] }))],
                ['BulkAddRecord', TABLE_MODELES, liste.map(() => null),
                    Object.fromEntries(Object.entries(COLONNES_TABLE).map(([champ, colonne]) => [colonne, liste.map(m => m[champ])]))],
            ]);
        },

        // Retourne l'identifiant de la ligne créée
        async ajouterModele(champs) {
            const resultat = await grist.docApi.applyUserActions([['AddRecord', TABLE_MODELES, null, versColonnesTable(champs)]]);
            return resultat.retValues[0];
        },

        // [{ id, champs }] : une seule action (un seul « Annuler » dans Grist)
        async modifierModeles(modifications) {
            await grist.docApi.applyUserActions(modifications.map(({ id, champs }) => ['UpdateRecord', TABLE_MODELES, id, versColonnesTable(champs)]));
        },

        async supprimerModele(id) {
            await grist.docApi.applyUserActions([['RemoveRecord', TABLE_MODELES, id]]);
        },

        selectionnerRdv(rowId) {
            grist.setCursorPos({ rowId }).catch(() => {});
        },
    };
}

function creerSourceDemo() {
    const CLE = 'mails-rdv-demo-modeles';
    const attendre = ms => new Promise(resolve => setTimeout(resolve, ms));
    // Créneau à J+jours, à h:m heure de Paris
    const date = (jours, h, m = 0) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + jours);
        d.setUTCHours(h, m, 0, 0);
        const decalage = new Date(d.toLocaleString('en-US', { timeZone: FUSEAU })) - new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
        return new Date(d.getTime() - decalage);
    };
    // Lieux au format reçu de Grist (libellé de la colonne Référence)
    const records = [
        { id: 41, id_rdv_clinique: 'K7QXM', Nom_patient: 'MARTIN', Prenom_patient: 'Camille', Mail_patient: 'camille.martin@exemple.fr', Creneau_RDV_1: date(6, 18), Lieu_RDV_1: 'Salle Portalis', Adresse_RDV_1: 'Manufacture des Tabacs\n1, av. des Frères Lumière, 69008 Lyon', Creneau_RDV_2: date(20, 18), Lieu_RDV_2: 'Salle Portalis', Adresse_RDV_2: 'Manufacture des Tabacs\n1, av. des Frères Lumière, 69008 Lyon', Visioconference: false },
        { id: 42, id_rdv_clinique: '3HPAT', Nom_patient: 'NGUYEN', Prenom_patient: 'Thomas', Mail_patient: 'thomas.nguyen@exemple.org', Creneau_RDV_1: date(7, 17, 30), Lieu_RDV_1: 'Salle Cambacérès', Creneau_RDV_2: date(21, 17, 30), Lieu_RDV_2: 'Salle Cambacérès', Visioconference: true },
        { id: 43, id_rdv_clinique: 'WD9RC', Nom_patient: 'BERNARD', Prenom_patient: 'Léa', Mail_patient: '', Creneau_RDV_1: date(1, 19), Lieu_RDV_1: 'Salle Portalis', Creneau_RDV_2: null, Lieu_RDV_2: '', Visioconference: false },
    ];
    let table = null;
    try {
        table = JSON.parse(localStorage.getItem(CLE));
    } catch (e) {
        table = null;
    }
    const enregistrer = () => {
        try {
            localStorage.setItem(CLE, JSON.stringify(table));
        } catch (e) {
            // Stockage indisponible : les modèles restent en mémoire
        }
    };
    let rappels = null;

    return {
        demarrer(r) {
            rappels = r;
            rappels.surRdvs(records);
            rappels.surRdv(records[0], true);
        },

        async chargerModeles() {
            await attendre(100);
            return table ? cloner(table) : null;
        },

        async creerTable(liste) {
            await attendre(200);
            table = liste.map((m, i) => ({ ...m, id: i + 1 }));
            enregistrer();
        },

        async ajouterModele(champs) {
            await attendre(150);
            const id = Math.max(0, ...table.map(m => m.id)) + 1;
            table.push({ ...champs, id });
            enregistrer();
            return id;
        },

        async modifierModeles(modifications) {
            await attendre(150);
            modifications.forEach(({ id, champs }) => Object.assign(table.find(m => m.id === id), champs));
            enregistrer();
        },

        async supprimerModele(id) {
            await attendre(150);
            table = table.filter(m => m.id !== id);
            enregistrer();
        },

        selectionnerRdv(rowId) {
            rappels.surRdv(records.find(r => r.id === rowId) ?? null, true);
        },
    };
}

// ---------- Utilitaires ----------

function cloner(objet) {
    return JSON.parse(JSON.stringify(objet));
}

function texte(valeur) {
    return valeur == null || typeof valeur === 'object' ? '' : String(valeur).trim();
}

// Sans accents, majuscules ni espaces multiples : « Même  Adresse » -> « meme adresse »
function normaliser(valeur) {
    return String(valeur).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function echapper(valeur) {
    return String(valeur ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Réglage propre à l'utilisateur (dernier modèle choisi) : facultatif, le widget fonctionne sans
function lireReglage(cle) {
    try {
        return localStorage.getItem(cle);
    } catch (e) {
        return null;
    }
}

function ecrireReglage(cle, valeur) {
    try {
        localStorage.setItem(cle, valeur);
    } catch (e) {
        // Stockage indisponible : réglage non conservé
    }
}

// ---------- Dates (toujours exprimées dans le fuseau de Paris) ----------

function versDate(valeur) {
    if (valeur instanceof Date) {
        return isNaN(valeur.getTime()) ? null : valeur;
    }
    if (typeof valeur === 'number' && valeur > 0) {
        return new Date(valeur * 1000);
    }
    return null;
}

// Clé "AAAA-MM-JJ" du jour de la date, à Paris
function cleJour(date) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function decalerJour(cle, nbJours) {
    const date = new Date(cle + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + nbJours);
    return date.toISOString().slice(0, 10);
}

// « mardi 13 octobre 2026 », « jeudi 1er octobre 2026 »
function jourLong(date) {
    return date.toLocaleDateString('fr-FR', { timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        .replace(/(^|\s)1 /, (tout, espace) => `${espace}1er `);
}

// « 18h00 »
function heure(date) {
    return date.toLocaleTimeString('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
}

// « mar. 13/10 18h00 »
function creneauCourt(date) {
    return `${date.toLocaleDateString('fr-FR', { timeZone: FUSEAU, weekday: 'short', day: '2-digit', month: '2-digit' })} ${heure(date)}`;
}

// ---------- Données d'un RDV ----------

function creneau(valeurDate, valeurLieu, valeurAdresse) {
    const debut = versDate(valeurDate);
    return {
        debut,
        date: debut ? jourLong(debut) : '',
        heure: debut ? heure(debut) : '',
        lieu: texte(valeurLieu),
        // Adresse sur plusieurs lignes dans Grist : une seule ligne dans le mail
        adresse: texte(valeurAdresse).replace(/\s*\n\s*/g, ', '),
    };
}

function limiteParDefaut(debutRdv1) {
    const aujourdhui = cleJour(new Date());
    let jour = decalerJour(aujourdhui, DELAI_REPONSE_JOURS);
    if (debutRdv1) {
        const veille = decalerJour(cleJour(debutRdv1), -1);
        if (veille < jour) {
            jour = veille < aujourdhui ? aujourdhui : veille;
        }
    }
    return { date: jour, heure: HEURE_LIMITE };
}

// « vendredi 23 octobre 2026 à 17h00 »
function libelleLimite(limite) {
    if (!limite.date) {
        return '';
    }
    const jour = jourLong(new Date(limite.date + 'T12:00:00Z'));
    return limite.heure ? `${jour} à ${limite.heure.replace(':', 'h')}` : jour;
}

function donnees(record) {
    const prenom = texte(record.Prenom_patient);
    const nom = texte(record.Nom_patient);
    const rdv1 = creneau(record.Creneau_RDV_1, record.Lieu_RDV_1, record.Adresse_RDV_1);
    if (!limites.has(record.id)) {
        limites.set(record.id, limiteParDefaut(rdv1.debut));
    }

    return {
        id: record.id,
        prenom,
        nom,
        identite: [prenom, nom.toLocaleUpperCase('fr')].filter(Boolean).join(' '),
        identifiant: texte(record.id_rdv_clinique),
        mail: texte(record.Mail_patient),
        rdv1,
        rdv2: creneau(record.Creneau_RDV_2, record.Lieu_RDV_2, record.Adresse_RDV_2),
        visio: record.Visioconference === true,
        limite: limites.get(record.id),
        date_limite: libelleLimite(limites.get(record.id)),
        date_jour: jourLong(new Date()),
        texte_personnalise: (textesPerso.get(record.id) ?? '').trim(),
    };
}

// ---------- Rendu des modèles (Markdown simplifié) ----------
// mode 'apercu' : valeurs manquantes signalées en couleur ; mode 'envoi' : remplacées par [libellé]

function nouveauRendu(d, mode) {
    return { d, mode, manquants: new Set() };
}

function signaler(libelle, raison, rendu) {
    rendu.manquants.add(libelle);
    return rendu.mode === 'apercu'
        ? `<span class="manquant" title="${echapper(raison)}">${echapper(libelle)}</span>`
        : `[${echapper(libelle)}]`;
}

function valeurVariable(cle, rendu) {
    const variable = VARIABLES_PAR_CLE[cle];
    if (!variable) {
        return signaler(`{{${cle}}}`, 'Variable inconnue', rendu);
    }
    const valeur = variable.valeur(rendu.d);
    return valeur ? echapper(valeur) : signaler(variable.libelle, 'Sans valeur pour ce RDV', rendu);
}

// **gras**, ==surligné== et *italique*, sur du texte déjà échappé
function enrichir(html) {
    return html
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/==(.+?)==/g, `<mark style="${STYLES.surligne}">$1</mark>`)
        .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

// Une ligne : variables et liens mis de côté (jetons), pour que leurs valeurs ne soient jamais
// interprétées comme de la mise en forme, puis gras / surligné / italique
function rendreLigne(ligne, rendu) {
    const jetons = [];
    const jeton = html => `\uE000${jetons.push(html) - 1}\uE001`;

    let html = echapper(ligne.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (tout, cle) => jeton(valeurVariable(cle, rendu))));
    html = html
        .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g, (tout, libelle, url) => jeton(`<a href="${url}">${enrichir(libelle)}</a>`))
        // Adresse seule : la ponctuation finale et les marques de mise en forme (** ==) restent hors du lien
        .replace(/https?:\/\/[^\s<\uE000]*[^\s<\uE000.,;:!?)»*=]/g, url => jeton(`<a href="${url}">${url}</a>`));
    html = enrichir(html);

    // Un lien peut contenir une variable : jetons remplacés jusqu'à épuisement
    while (/\uE000\d+\uE001/.test(html)) {
        html = html.replace(/\uE000(\d+)\uE001/g, (tout, i) => jetons[i]);
    }
    return html;
}

// Paragraphe : lignes consécutives commençant par « - » en liste à puces, autres lignes séparées par un retour à la ligne
function rendreParagraphe(bloc, rendu) {
    const groupes = [];
    bloc.split('\n').map(l => l.trim()).filter(Boolean).forEach(ligne => {
        const puce = /^[-•]\s+/.test(ligne);
        const dernier = groupes[groupes.length - 1];
        if (dernier && dernier.puce === puce) {
            dernier.lignes.push(ligne);
        } else {
            groupes.push({ puce, lignes: [ligne] });
        }
    });
    return groupes.map(({ puce, lignes }) => puce
        ? `<ul style="${STYLES.ul}">${lignes.map(l => `<li>${rendreLigne(l.replace(/^[-•]\s+/, ''), rendu)}</li>`).join('')}</ul>`
        : `<p style="${STYLES.p}">${lignes.map(l => rendreLigne(l, rendu)).join('<br>')}</p>`
    ).join('');
}

function decouperParagraphes(texteBrut) {
    return String(texteBrut ?? '').replace(/\r/g, '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
}

// « [si visio] Texte » -> { afficher, contenu } ; condition inconnue : paragraphe affiché et signalé
function lireCondition(bloc, rendu) {
    const m = bloc.match(/^\[si\s+(pas\s+)?([^\]]+)\]\s*/i);
    if (!m) {
        return { afficher: true, contenu: bloc };
    }
    const contenu = bloc.slice(m[0].length);
    const condition = CONDITIONS.find(c => normaliser(c.cle) === normaliser(m[2]));
    if (!condition) {
        return { afficher: true, contenu: `{{condition inconnue : ${m[2]}}} ${contenu}` };
    }
    return { afficher: condition.test(rendu.d) !== Boolean(m[1]), contenu };
}

function rendreCorps(corps, rendu) {
    const texteParagraphes = decouperParagraphes(rendu.d.texte_personnalise).map(b => rendreParagraphe(b, rendu)).join('');
    let textePlace = false;
    const paragraphes = [];
    decouperParagraphes(corps).forEach(bloc => {
        const { afficher, contenu } = lireCondition(bloc, rendu);
        if (!afficher) {
            return;
        }
        if (/^\{\{\s*texte_personnalise\s*\}\}$/.test(contenu)) {
            textePlace = true;
            paragraphes.push(texteParagraphes);
        } else {
            paragraphes.push(rendreParagraphe(contenu, rendu));
        }
    });
    // Modèle sans emplacement prévu : texte personnalisé placé après la formule d'appel
    if (!textePlace) {
        paragraphes.splice(1, 0, texteParagraphes);
    }
    return paragraphes.join('');
}

function rendreMail(modele, d, mode) {
    const rendu = nouveauRendu(d, mode);
    const objet = rendreLigne(modele.objet, rendu);
    const corps = rendreCorps(modele.corps, rendu);
    return { objet, corps, manquants: rendu.manquants };
}

function utiliseVariable(modele, cle) {
    return new RegExp(`\\{\\{\\s*${cle}\\s*\\}\\}`).test(modele.objet + '\n' + modele.corps);
}

// Version texte du mail (copie de l'objet, collage sans mise en forme)
function versTexte(html) {
    const conteneur = document.createElement('div');
    conteneur.innerHTML = html;
    const lire = noeud => [...noeud.childNodes].map(n => {
        if (n.nodeType === Node.TEXT_NODE) {
            return n.textContent;
        }
        if (n.nodeName === 'BR') {
            return '\n';
        }
        if (n.nodeName === 'A') {
            const libelle = lire(n);
            const url = n.getAttribute('href');
            return libelle === url || `mailto:${libelle}` === url ? libelle : `${libelle} (${url})`;
        }
        return lire(n);
    }).join('');
    return [...conteneur.children]
        .map(bloc => bloc.nodeName === 'UL' ? [...bloc.children].map(li => `- ${lire(li)}`).join('\n') : lire(bloc))
        .join('\n\n');
}

// ---------- Modèles ----------

function normaliserModele(m) {
    return {
        id: m.id,
        nom: texte(m.nom),
        objet: String(m.objet ?? ''),
        corps: String(m.corps ?? ''),
        ordre: Number(m.ordre) || 0,
    };
}

async function rechargerModeles() {
    try {
        const lus = await source.chargerModeles();
        tableAbsente = lus === null;
        modeles = (lus ?? []).map(normaliserModele).sort((a, b) => a.ordre - b.ordre || a.id - b.id);
    } catch (e) {
        console.error('Lecture des modèles impossible :', e);
        message(`Lecture de la table ${TABLE_MODELES} impossible : vérifiez que le widget a l’accès complet au document.`, 'critique');
        return;
    }
    // Modèle supprimé entre-temps (par exemple directement dans Grist)
    if (edition && !modeleEnregistre(edition.id)) {
        edition = null;
        remplirFormulaireModele();
    }
    if (gestionOuverte) {
        rendreListeModeles();
        etatGestion();
    }
    afficher();
}

function modeleEnregistre(id) {
    return modeles.find(m => m.id === id) ?? null;
}

// Modèle du mail affiché : celui en cours de modification, sinon celui choisi dans la liste
function modeleAffiche() {
    return edition ?? modeleEnregistre(idModeleChoisi) ?? modeles[0] ?? null;
}

function choisirModele(id) {
    idModeleChoisi = id;
    ecrireReglage(CLE_MODELE_CHOISI, String(id));
}

// ---------- Affichage ----------

function message(texteMessage, type = 'alerte') {
    const bandeau = $('message');
    bandeau.hidden = !texteMessage;
    bandeau.className = `bandeau ${type}`;
    bandeau.textContent = texteMessage || '';
}

function afficherToast(texteToast) {
    const toast = $('toast');
    toast.textContent = texteToast;
    toast.hidden = false;
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { toast.hidden = true; }, 5000);
}

// Options reconstruites seulement si elles changent (une liste ouverte reste ouverte)
function remplacerOptions(select, html) {
    if (select.dataset.options !== html) {
        select.innerHTML = html;
        select.dataset.options = html;
    }
}

function majChoixRdv() {
    const select = $('choix-rdv');
    const liste = rdv && !rdvs.some(r => r.id === rdv.id) ? [rdv, ...rdvs] : rdvs;
    remplacerOptions(select, (rdv ? '' : '<option value="">— Choisir un RDV —</option>') + liste.map(r => {
        const debut = versDate(r.Creneau_RDV_1);
        const libelle = [texte(r.id_rdv_clinique), `${texte(r.Nom_patient).toLocaleUpperCase('fr')} ${texte(r.Prenom_patient)}`.trim(), debut ? creneauCourt(debut) : '']
            .filter(Boolean).join(' · ');
        return `<option value="${r.id}">${echapper(libelle || `Ligne ${r.id}`)}</option>`;
    }).join(''));
    select.value = rdv ? String(rdv.id) : '';
}

function majChoixModele() {
    const select = $('choix-modele');
    remplacerOptions(select, modeles.length
        ? modeles.map(m => `<option value="${m.id}">${echapper(m.nom || 'Sans nom')}</option>`).join('')
        : '<option value="">Aucun modèle</option>');
    select.value = String(modeleAffiche()?.id ?? '');
    select.disabled = Boolean(edition) || !modeles.length;
    select.title = edition ? 'Le mail affiche le modèle en cours de modification' : '';
}

function afficher() {
    majChoixModele();
    $('creation-table').hidden = !tableAbsente;
    const redaction = $('redaction');
    const enTete = $('rdv-courant');

    const modele = modeleAffiche();
    let attente = '';
    if (tableAbsente) {
        attente = ' ';
    } else if (!colonnesAssociees) {
        attente = 'Associez les colonnes du widget (panneau de droite, rubrique « Colonnes ») pour rédiger les mails.';
    } else if (!rdv) {
        attente = 'Sélectionnez un RDV (dans la table ou dans la liste « RDV » ci-dessus) pour rédiger son mail.';
    } else if (!modele) {
        attente = 'Aucun modèle de mail : ajoutez-en un avec « Gérer les modèles ».';
    }
    if (attente) {
        message(attente.trim(), 'info');
        redaction.hidden = true;
        enTete.hidden = true;
        return;
    }

    const d = donnees(rdv);
    enTete.hidden = false;
    enTete.textContent = [d.identite, d.identifiant].filter(Boolean).join(' · ');
    message(edition ? `Aperçu du modèle « ${edition.nom || 'Sans nom'} » en cours de modification.` : '', 'info');
    redaction.hidden = false;

    // Date limite : affichée seulement si le modèle l'utilise
    $('champ-limite').hidden = !utiliseVariable(modele, 'date_limite');
    $('limite-date').value = d.limite.date;
    $('limite-heure').value = d.limite.heure;

    afficherTextePerso(d, modele);

    const apercu = rendreMail(modele, d, 'apercu');
    $('mail-a').innerHTML = d.mail ? `${echapper(d.identite)} &lt;${echapper(d.mail)}&gt;` : signaler('Mail du patient', 'Aucune adresse mail pour ce RDV', nouveauRendu(d, 'apercu'));
    $('mail-objet').innerHTML = apercu.objet || signaler('Objet', 'Objet vide', nouveauRendu(d, 'apercu'));
    $('mail-corps').innerHTML = apercu.corps;

    const aCompleter = [...(d.mail ? [] : ['Mail du patient']), ...apercu.manquants];
    const etat = $('etat-mail');
    etat.textContent = aCompleter.length ? `⚠ À compléter : ${aCompleter.join(', ')}` : '';
    etat.className = 'etat-mail' + (aCompleter.length ? ' alerte' : '');
}

function afficherTextePerso(d, modele) {
    const zone = $('texte-perso');
    // Ne pas écraser la saisie en cours
    if (document.activeElement !== zone || zone.dataset.rowId !== String(d.id)) {
        zone.value = textesPerso.get(d.id) ?? '';
        zone.dataset.rowId = String(d.id);
    }
    $('aide-texte').innerHTML = utiliseVariable(modele, 'texte_personnalise')
        ? 'Placé à l’emplacement <code>{{texte_personnalise}}</code> du modèle. Même mise en forme que les modèles. Non enregistré dans Grist.'
        : 'Placé après la formule d’appel (le modèle ne prévoit pas d’emplacement <code>{{texte_personnalise}}</code>). Non enregistré dans Grist.';
}

// ---------- Copie ----------

async function copierTexte(valeur) {
    try {
        await navigator.clipboard.writeText(valeur);
    } catch {
        // Presse-papiers non autorisé dans l'iframe : copie via une zone de texte temporaire
        const zone = document.createElement('textarea');
        zone.value = valeur;
        zone.style.position = 'fixed';
        zone.style.opacity = '0';
        document.body.append(zone);
        zone.select();
        document.execCommand('copy');
        zone.remove();
    }
}

// Texte mis en forme (HTML) + version texte pour les messageries qui n'acceptent pas la mise en forme
async function copierRiche(html, valeurTexte) {
    try {
        await navigator.clipboard.write([new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([valeurTexte], { type: 'text/plain' }),
        })]);
    } catch {
        // Presse-papiers non autorisé dans l'iframe : copie de la sélection d'un élément temporaire
        const zone = document.createElement('div');
        zone.innerHTML = html;
        zone.style.position = 'fixed';
        zone.style.left = '-10000px';
        document.body.append(zone);
        const plage = document.createRange();
        plage.selectNodeContents(zone);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(plage);
        document.execCommand('copy');
        selection.removeAllRanges();
        zone.remove();
    }
}

async function copierMail() {
    const envoi = rendreMail(modeleAffiche(), donnees(rdv), 'envoi');
    await copierRiche(`<div>${envoi.corps}</div>`, versTexte(envoi.corps));
    afficherToast(envoi.manquants.size
        ? `Mail copié, mais à compléter : ${[...envoi.manquants].join(', ')} (entre crochets dans le texte).`
        : 'Mail copié : collez-le dans le corps du mail (Ctrl+V ou ⌘V).');
}

async function copierEntete(bouton) {
    const d = donnees(rdv);
    const valeur = bouton.dataset.copier === 'a'
        ? d.mail
        : versTexte(`<p>${rendreMail(modeleAffiche(), d, 'envoi').objet}</p>`);
    if (!valeur) {
        return;
    }
    await copierTexte(valeur);
    bouton.classList.add('copie');
    bouton.textContent = '✓';
    setTimeout(() => {
        bouton.classList.remove('copie');
        bouton.textContent = '⧉';
    }, 1500);
}

// ---------- Gestion des modèles ----------

function ouvrirGestion() {
    gestionOuverte = true;
    $('gestion').hidden = false;
    document.body.classList.add('gestion-ouverte');
    $('ouvrir-gestion').setAttribute('aria-expanded', 'true');
    commencerEdition(modeleAffiche()?.id ?? null);
    rechargerModeles();
}

function fermerGestion() {
    if (editionModifiee() && !confirm('Abandonner les modifications non enregistrées du modèle ?')) {
        return;
    }
    gestionOuverte = false;
    edition = null;
    $('gestion').hidden = true;
    document.body.classList.remove('gestion-ouverte');
    $('ouvrir-gestion').setAttribute('aria-expanded', 'false');
    afficher();
}

function editionModifiee() {
    const original = edition && modeleEnregistre(edition.id);
    return Boolean(original) && ['nom', 'objet', 'corps'].some(champ => edition[champ] !== original[champ]);
}

// Retourne false si l'utilisateur garde ses modifications en cours
function commencerEdition(id, { forcer = false } = {}) {
    if (!forcer && edition?.id !== id && editionModifiee() && !confirm('Abandonner les modifications non enregistrées du modèle ?')) {
        return false;
    }
    const modele = modeleEnregistre(id);
    edition = modele ? { ...modele } : null;
    if (modele) {
        choisirModele(id);
    }
    remplirFormulaireModele();
    rendreListeModeles();
    etatGestion();
    afficher();
    return true;
}

function etatGestion(texteEtat = null, classe = '') {
    const etat = $('etat-config');
    const modifie = editionModifiee();
    etat.textContent = texteEtat ?? (tableAbsente ? 'Table des modèles absente'
        : !edition ? 'Cliquez sur un modèle pour le modifier'
        : modifie ? 'Modifications non enregistrées' : 'Aucune modification');
    etat.className = 'etat-config ' + (classe || (modifie ? 'modifie' : ''));
    $('enregistrer-modele').disabled = !modifie;
    $('annuler-modele').disabled = !modifie;
    $('ajouter-modele').disabled = tableAbsente;
}

function rendreListeModeles() {
    const nb = modeles.length;
    $('liste-modeles').innerHTML = nb ? modeles.map((m, i) => `
        <li class="modele-item${m.id === edition?.id ? ' edite' : ''}" data-id="${m.id}">
            <span class="modele-rang">${i + 1}</span>
            <span class="modele-texte">
                <span class="modele-nom">${echapper(m.nom || 'Sans nom')}</span>
                <span class="modele-detail">${echapper(m.objet)}</span>
            </span>
            <span class="modele-actions">
                <button type="button" class="btn-icone" data-action="monter" title="Monter dans la liste" ${i === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" class="btn-icone" data-action="descendre" title="Descendre dans la liste" ${i === nb - 1 ? 'disabled' : ''}>↓</button>
                <button type="button" class="btn-icone" data-action="dupliquer" title="Dupliquer">⧉</button>
                <button type="button" class="btn-icone" data-action="supprimer" title="Supprimer">✕</button>
            </span>
        </li>`).join('') : `<li class="aide">${tableAbsente ? 'Créez d’abord la table des modèles.' : 'Aucun modèle : ajoutez-en un.'}</li>`;
}

function remplirFormulaireModele() {
    $('edition-modele').hidden = !edition;
    if (edition) {
        $('m-nom').value = edition.nom;
        $('m-objet').value = edition.objet;
        $('m-corps').value = edition.corps;
    }
}

// Écriture dans la table puis relecture ; erreur signalée dans le pied du panneau
async function ecrireModeles(action, texteSucces) {
    etatGestion('Enregistrement…');
    try {
        const resultat = await action();
        await rechargerModeles();
        if (texteSucces) {
            etatGestion(texteSucces);
        }
        return resultat;
    } catch (e) {
        console.error('Écriture dans la table des modèles impossible :', e);
        etatGestion('Enregistrement impossible (droits d’édition du document requis)', 'erreur');
        return null;
    }
}

async function enregistrerModele() {
    if (!editionModifiee()) {
        return;
    }
    const { id, nom, objet, corps } = edition;
    await ecrireModeles(() => source.modifierModeles([{ id, champs: { nom, objet, corps } }]), '✓ Modèle enregistré');
}

async function ajouterModele(champs) {
    if (editionModifiee() && !confirm('Abandonner les modifications non enregistrées du modèle ?')) {
        return;
    }
    const ordre = Math.max(0, ...modeles.map(m => m.ordre)) + 1;
    const id = await ecrireModeles(() => source.ajouterModele({ ...champs, ordre }));
    if (id != null) {
        commencerEdition(id, { forcer: true });
        $('m-nom').select();
    }
}

async function actionModele(action, id) {
    const i = modeles.findIndex(m => m.id === id);
    const modele = modeles[i];
    if (!modele) {
        return;
    }
    if (action === 'dupliquer') {
        await ajouterModele({ nom: `${modele.nom} (copie)`, objet: modele.objet, corps: modele.corps });
    } else if (action === 'supprimer') {
        if (!confirm(`Supprimer le modèle « ${modele.nom || 'Sans nom'} » ? (annulable avec « Annuler » dans Grist)`)) {
            return;
        }
        await ecrireModeles(() => source.supprimerModele(id));
        if (!edition) {
            commencerEdition(modeles[Math.min(i, modeles.length - 1)]?.id ?? null, { forcer: true });
        }
    } else if (action === 'monter' || action === 'descendre') {
        // Nouvel ordre de toute la liste : 1, 2, 3…
        const ordre = [...modeles];
        const j = action === 'monter' ? i - 1 : i + 1;
        [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
        await ecrireModeles(() => source.modifierModeles(ordre.map((m, k) => ({ id: m.id, champs: { ordre: k + 1 } }))));
    }
}

async function creerTable() {
    const bouton = $('creer-table');
    bouton.disabled = true;
    try {
        await source.creerTable(MODELES_DEFAUT.map((m, i) => ({ ...m, ordre: i + 1 })));
        await rechargerModeles();
        if (gestionOuverte && !edition) {
            commencerEdition(modeles[0]?.id ?? null, { forcer: true });
        }
    } catch (e) {
        console.error('Création de la table des modèles impossible :', e);
        message(`Création de la table ${TABLE_MODELES} impossible (droits d’édition du document requis).`, 'critique');
    }
    bouton.disabled = false;
}

// Insère « [si …] » au début du paragraphe où se trouve le curseur (remplace une condition existante)
function insererCondition(condition) {
    const zone = $('m-corps');
    const position = zone.selectionStart;
    const separateur = zone.value.lastIndexOf('\n\n', Math.max(0, position - 1));
    const debut = separateur < 0 ? 0 : separateur + 2;
    const existante = zone.value.slice(debut).match(/^\[si\s+[^\]]*\]\s*/i);
    zone.setRangeText(`[si ${condition.cle}] `, debut, debut + (existante ? existante[0].length : 0), 'end');
    zone.focus();
    zone.dispatchEvent(new Event('input'));
}

// ---------- Événements ----------

function brancherInterface() {
    // Hauteur de la barre d'outils collante : position du mail collant pendant la gestion des modèles
    const barre = document.querySelector('.barre-outils');
    new ResizeObserver(() => document.body.style.setProperty('--hauteur-barre', barre.offsetHeight + 'px')).observe(barre);

    $('nom-table').textContent = TABLE_MODELES;
    document.querySelectorAll('.nom-table').forEach(el => { el.textContent = TABLE_MODELES; });

    // Modèles modifiés ailleurs (directement dans Grist, autre utilisateur) : relus au retour dans le widget
    window.addEventListener('focus', () => {
        if (!editionModifiee()) {
            rechargerModeles();
        }
    });

    $('choix-rdv').addEventListener('change', e => {
        if (e.target.value) {
            source.selectionnerRdv(Number(e.target.value));
        }
    });
    $('choix-modele').addEventListener('change', e => {
        choisirModele(Number(e.target.value));
        afficher();
    });

    $('texte-perso').addEventListener('input', e => {
        textesPerso.set(Number(e.target.dataset.rowId), e.target.value);
        afficher();
    });
    for (const [id, champ] of [['limite-date', 'date'], ['limite-heure', 'heure']]) {
        $(id).addEventListener('input', e => {
            limites.get(rdv.id)[champ] = e.target.value;
            afficher();
        });
    }

    $('copier-mail').addEventListener('click', copierMail);
    document.querySelectorAll('[data-copier]').forEach(bouton => bouton.addEventListener('click', () => copierEntete(bouton)));

    $('creer-table').addEventListener('click', creerTable);

    $('ouvrir-gestion').addEventListener('click', () => (gestionOuverte ? fermerGestion() : ouvrirGestion()));
    $('fermer-gestion').addEventListener('click', fermerGestion);
    $('enregistrer-modele').addEventListener('click', enregistrerModele);
    $('annuler-modele').addEventListener('click', () => commencerEdition(edition.id, { forcer: true }));
    $('ajouter-modele').addEventListener('click', () => ajouterModele(MODELE_NOUVEAU));

    $('liste-modeles').addEventListener('click', e => {
        const item = e.target.closest('.modele-item');
        if (!item) {
            return;
        }
        const id = Number(item.dataset.id);
        const bouton = e.target.closest('[data-action]');
        if (bouton) {
            actionModele(bouton.dataset.action, id);
        } else if (id !== edition?.id) {
            commencerEdition(id);
        }
    });

    // Champs du modèle en cours de modification : aperçu mis à jour à chaque frappe
    for (const [id, champ] of [['m-nom', 'nom'], ['m-objet', 'objet'], ['m-corps', 'corps']]) {
        $(id).addEventListener('input', e => {
            if (!edition) {
                return;
            }
            edition[champ] = e.target.value;
            etatGestion();
            afficher();
        });
    }
    window.addEventListener('beforeunload', e => {
        if (editionModifiee()) {
            e.preventDefault();
        }
    });

    // Insertion des variables dans le dernier champ (objet ou texte) utilisé
    for (const id of ['m-objet', 'm-corps']) {
        $(id).addEventListener('focus', e => { dernierChampModele = e.target; });
    }
    $('variables').innerHTML = VARIABLES.map(v =>
        `<button type="button" class="variable" data-cle="${v.cle}" title="{{${v.cle}}}${v.bloc ? ' (seul dans son paragraphe)' : ''}">${echapper(v.libelle)}</button>`
    ).join('');
    $('conditions').innerHTML = CONDITIONS.map(c =>
        `<button type="button" class="variable condition" data-cle="${echapper(c.cle)}" title="[si ${echapper(c.cle)}]">${echapper(c.libelle)}</button>`
    ).join('');
    for (const id of ['variables', 'conditions']) {
        $(id).addEventListener('mousedown', e => e.preventDefault()); // garde le curseur dans le champ
    }
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
    $('conditions').addEventListener('click', e => {
        const bouton = e.target.closest('.condition');
        if (bouton) {
            insererCondition(CONDITIONS.find(c => c.cle === bouton.dataset.cle));
        }
    });
}
