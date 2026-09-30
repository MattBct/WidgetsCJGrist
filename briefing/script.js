const FUSEAU = 'Europe/Paris';

const COLONNES = [
    { name: "id_rdv_clinique", title: "Identifiant du RDV", type: "Text", optional: false },
    { name: "Nom_patient", title: "Nom du patient", type: "Text", optional: false },
    { name: "Prenom_patient", title: "Prénom du patient", type: "Text", optional: false },
    { name: "Telephone_patient", title: "Téléphone du patient", type: "Text", optional: true },
    { name: "Mail_patient", title: "Mail du patient", type: "Text", optional: true },
    { name: "Motif_RDV", title: "Motif détaillé", type: "Text", optional: false, description: "Motif rédigé par le patient (affiché sur la feuille d'émargement)" },
    { name: "Motifs_standardises", title: "Motifs standardisés", type: "ChoiceList,Text", optional: true, description: "Motifs standardisés (colonne Choix multiples), affichés en pastilles" },
    { name: "Creneau_RDV_1", title: "Créneau RDV 1", type: "DateTime", optional: false, description: "Créneau horaire du premier rendez-vous" },
    { name: "Lieu_RDV_1", title: "Lieu RDV 1", type: "Ref,Text,Choice", optional: false, description: "Salle du premier rendez-vous (colonne Référence, ou colonne formule texte ex. $Lieu_RDV_1.Nom pour afficher le nom de la salle)" },
    { name: "Creneau_RDV_2", title: "Créneau RDV 2", type: "DateTime", optional: false, description: "Créneau horaire du deuxième rendez-vous" },
    { name: "Lieu_RDV_2", title: "Lieu RDV 2", type: "Ref,Text,Choice", optional: false, description: "Salle du deuxième rendez-vous (colonne Référence, ou colonne formule texte ex. $Lieu_RDV_2.Nom pour afficher le nom de la salle)" },
    { name: "Visioconference", title: "Visioconférence", type: "Bool", optional: true, description: "RDV en visioconférence (affiche une vignette Visio, le RDV reste dans sa salle)" },
    { name: "Cliniciens_briefing", title: "Cliniciens (briefing)", type: "Any,RefList,Text", optional: true, description: "Colonne formule donnant le nom et le téléphone de chaque clinicien : [[c.Prenom + \" \" + c.Nom.upper(), c.Telephone] for c in $Cliniciens_affectes]" },
    { name: "Commentaires", title: "Commentaires", type: "Text", optional: true, description: "Commentaires affichés sur la feuille d'émargement" },
];

// Nombre minimal de lignes clinicien par RDV : complété par des lignes vierges à remplir à la main
const NB_LIGNES_CLINICIENS_MIN = 5;

// Mêmes couleurs que le widget calendrier
const CRENEAUX_RDV = [
    { ordre: 1, date: "Creneau_RDV_1", lieu: "Lieu_RDV_1", badge: "RDV 1", label: "Premier RDV (initial)", classe: "rdv-1" },
    { ordre: 2, date: "Creneau_RDV_2", lieu: "Lieu_RDV_2", badge: "RDV 2", label: "Second RDV (restitution)", classe: "rdv-2" },
];

// Icône caméra (SVG inline : rendu identique à l'écran et à l'impression, contrairement aux emojis)
const ICONE_VISIO = '<svg class="icone-visio" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10.5 22 7v10l-6-3.5z"/></svg>';

const SANS_SALLE = { cle: "__sans_salle", libelle: "Sans salle", ordre: 1 };

let dossiers = [];
let jourSelectionne = cleJour(new Date());
let rowIdSelectionne = null;

// Accès complet : nécessaire pour lire la table Cliniciens (listes déroulantes du PDF d'émargement)
grist.ready({
    requiredAccess: 'full',
    columns: COLONNES,
    allowSelectBy: true,
});

grist.onRecords((records) => {
    dossiers = grist.mapColumnNames(records) || [];
    afficherBriefing();
});

// ---------- Dates (toujours exprimées dans le fuseau de Paris) ----------

function versDate(valeur) {
    if (valeur instanceof Date) {
        return isNaN(valeur.getTime()) ? null : valeur;
    }
    if (typeof valeur === 'number') {
        return new Date(valeur * 1000);
    }
    return null;
}

// Clé "AAAA-MM-JJ" du jour de la date, à Paris
function cleJour(date) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function heure(date) {
    return date.toLocaleTimeString('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
}

function decalerJour(cle, nbJours) {
    const date = new Date(cle + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + nbJours);
    return date.toISOString().slice(0, 10);
}

// "Lundi 28 septembre 2026"
function libelleJour(cle) {
    const texte = new Date(cle + 'T12:00:00Z').toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return texte.charAt(0).toUpperCase() + texte.slice(1);
}

// ---------- Références (salles, cliniciens) ----------

// Une référence peut arriver sous forme d'identifiant, d'objet Reference ({tableId, rowId})
// ou d'enregistrement développé ; une colonne texte donne directement le libellé.
// Retourne { id, libelle } (libelle vide si Grist ne transmet que l'identifiant), ou null.
function lireReference(valeur) {
    if (valeur === null || valeur === undefined || valeur === '' || valeur === 0) {
        return null;
    }
    if (typeof valeur === 'number') {
        return { id: String(valeur), libelle: '' };
    }
    if (typeof valeur === 'object') {
        const id = valeur.rowId ?? valeur.id;
        if (!id) {
            return null;
        }
        const libelle = Object.entries(valeur).find(([cle, v]) => !['tableId', 'rowId', 'id'].includes(cle) && typeof v === 'string' && v.trim())?.[1];
        return { id: String(id), libelle: libelle || '' };
    }
    const texte = String(valeur).trim();
    return texte ? { id: texte, libelle: texte } : null;
}

function getSalle(valeur) {
    const reference = lireReference(valeur);
    if (!reference) {
        return SANS_SALLE;
    }
    return { cle: reference.id, libelle: reference.libelle || `Salle ${reference.id}`, ordre: 0 };
}

// Liste de cliniciens -> [{ nom, telephone }]. Formats acceptés pour chaque clinicien :
// - paire [nom, téléphone] (colonne formule conseillée : le téléphone reste lié à la bonne personne) ;
// - texte "Nom | Téléphone" (une ligne par clinicien) ou nom seul ;
// - référence brute (RefList) : seul l'identifiant est connu.
function getCliniciens(valeur) {
    if (valeur === null || valeur === undefined || valeur === '') {
        return [];
    }
    const elements = Array.isArray(valeur) ? valeur : String(valeur).split(/[\n;]/);
    return elements.map(element => {
        if (Array.isArray(element)) {
            const [nom, telephone] = element;
            return { nom: String(nom ?? '').trim(), telephone: String(telephone ?? '').trim() };
        }
        if (typeof element === 'string') {
            const [nom, telephone] = element.split('|');
            return { nom: nom.trim(), telephone: String(telephone ?? '').trim() };
        }
        const reference = lireReference(element);
        return reference ? { nom: reference.libelle || `Clinicien n°${reference.id}`, telephone: '' } : null;
    }).filter(clinicien => clinicien && clinicien.nom);
}

// Liste de choix (ChoiceList décodée, liste encodée ['L', ...] ou texte séparé par virgules)
function lireListe(valeur) {
    if (Array.isArray(valeur)) {
        return (valeur[0] === 'L' ? valeur.slice(1) : valeur).map(v => String(v).trim()).filter(Boolean);
    }
    if (typeof valeur === 'string') {
        return valeur.split(/[,;\n]/).map(v => v.trim()).filter(Boolean);
    }
    return [];
}

function comparerSalles(a, b) {
    return a.ordre - b.ordre || a.libelle.localeCompare(b.libelle, 'fr', { numeric: true });
}

// ---------- Données du jour ----------

function getRdvDuJour(cle) {
    const rdvs = [];
    dossiers.forEach(dossier => {
        CRENEAUX_RDV.forEach(creneau => {
            const debut = versDate(dossier[creneau.date]);
            if (!debut || cleJour(debut) !== cle) {
                return;
            }
            rdvs.push({
                rowId: dossier.id,
                creneau: creneau,
                debut: debut,
                horaire: heure(debut),
                salle: getSalle(dossier[creneau.lieu]),
                identifiant: dossier.id_rdv_clinique || '',
                nom: String(dossier.Nom_patient || '').toUpperCase(),
                prenom: dossier.Prenom_patient || '',
                telephone: dossier.Telephone_patient || '',
                mail: dossier.Mail_patient || '',
                motif: String(dossier.Motif_RDV || '').trim(),
                motifsStandardises: lireListe(dossier.Motifs_standardises),
                visio: dossier.Visioconference === true,
                cliniciens: getCliniciens(dossier.Cliniciens_briefing),
                commentaires: String(dossier.Commentaires || '').trim(),
            });
        });
    });
    return rdvs.sort((a, b) => a.debut - b.debut || a.creneau.ordre - b.creneau.ordre);
}

// Salles occupées par les RDV du jour, triées par nom
function getSallesDuJour(rdvs) {
    const salles = [];
    rdvs.forEach(rdv => {
        if (!salles.find(s => s.cle === rdv.salle.cle)) {
            salles.push(rdv.salle);
        }
    });
    return salles.sort(comparerSalles);
}

// Ordre de la feuille d'émargement (HTML et PDF) : par heure, puis par salle
function trierRdvEmargement(rdvs, salles) {
    const ordreSalle = salle => salles.findIndex(s => s.cle === salle.cle);
    return [...rdvs].sort((a, b) => a.debut - b.debut || ordreSalle(a.salle) - ordreSalle(b.salle));
}

// ---------- Rendu ----------

function echapper(texte) {
    return String(texte ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function plur(n, singulier, pluriel) {
    return Math.abs(n) <= 1 ? singulier : (pluriel ?? singulier + 's');
}

function afficherBriefing() {
    document.getElementById('jour').value = jourSelectionne;
    afficherBandeDates();
    document.getElementById('titre-date').textContent = libelleJour(jourSelectionne);
    document.title = `Briefing RDV du jour - ${libelleJour(jourSelectionne)}`;

    const rdvs = getRdvDuJour(jourSelectionne);
    const salles = getSallesDuJour(rdvs);
    document.getElementById('generer-pdf').disabled = rdvs.length === 0;
    const horaires = [...new Set(rdvs.map(rdv => rdv.horaire))];

    document.getElementById('synthese').innerHTML = renderSynthese(rdvs, salles, horaires);
    document.getElementById('occupation').innerHTML = rdvs.length > 0
        ? renderTableau(rdvs, salles, horaires)
        : `<div class="vide-journee">
                <img src="facade_rouge.png" alt="" class="vide-illustration">
                Aucun RDV prévu le ${echapper(libelleJour(jourSelectionne).toLowerCase())}.
            </div>`;
    document.getElementById('emargement').innerHTML = rdvs.length > 0
        ? renderEmargement(rdvs, salles)
        : '';
}

function renderSynthese(rdvs, salles, horaires) {
    const nbRdv1 = rdvs.filter(rdv => rdv.creneau.ordre === 1).length;
    const nbRdv2 = rdvs.filter(rdv => rdv.creneau.ordre === 2).length;
    const nbSalles = salles.filter(s => s !== SANS_SALLE).length;
    const nbVisio = rdvs.filter(rdv => rdv.visio).length;
    const plage = horaires.length > 0 ? `${horaires[0]} → ${horaires[horaires.length - 1]}` : '—';

    const legende = CRENEAUX_RDV.map(c => `<span class="legende-item"><span class="pastille ${c.classe}"></span>${echapper(c.label)}</span>`).join('');

    return `
        <div class="chiffres">
            <span class="chiffre"><strong>${rdvs.length}</strong> ${plur(rdvs.length, 'RDV', 'RDV')}</span>
            <span class="chiffre"><strong>${nbRdv1}</strong> ${plur(nbRdv1, 'premier', 'premiers')}</span>
            <span class="chiffre"><strong>${nbRdv2}</strong> ${plur(nbRdv2, 'second', 'seconds')}</span>
            <span class="chiffre"><strong>${nbSalles}</strong> ${plur(nbSalles, 'salle occupée', 'salles occupées')}</span>
            ${nbVisio > 0 ? `<span class="chiffre chiffre-visio">${ICONE_VISIO}<strong>${nbVisio}</strong> en visio</span>` : ''}
            <span class="chiffre"><strong>${plage}</strong></span>
        </div>
        <div class="legende">${legende}</div>
    `;
}

function renderTableau(rdvs, salles, horaires) {
    const entetes = salles.map(salle => {
        const nb = rdvs.filter(rdv => rdv.salle.cle === salle.cle).length;
        return `<th>${echapper(salle.libelle)}<span class="compte">${nb} ${plur(nb, 'RDV', 'RDV')}</span></th>`;
    }).join('');

    const lignes = horaires.map(horaire => {
        const cellules = salles.map(salle => {
            const rdvsCellule = rdvs.filter(rdv => rdv.horaire === horaire && rdv.salle.cle === salle.cle);
            if (rdvsCellule.length === 0) {
                return '<td class="libre"></td>';
            }
            const conflit = rdvsCellule.length > 1 && salle !== SANS_SALLE
                ? `<div class="conflit">⚠ ${rdvsCellule.length} RDV sur ce créneau</div>`
                : '';
            return `<td>${conflit}${rdvsCellule.map(renderCarte).join('')}</td>`;
        }).join('');
        return `<tr><th class="horaire" scope="row">${horaire}</th>${cellules}</tr>`;
    }).join('');

    return `
        <table class="occupation">
            <colgroup><col class="col-horaire">${salles.map(() => '<col>').join('')}</colgroup>
            <thead><tr><th>Heure</th>${entetes}</tr></thead>
            <tbody>${lignes}</tbody>
        </table>
    `;
}

function renderCarte(rdv) {
    const contact = [
        rdv.telephone ? `☎&nbsp;${echapper(rdv.telephone)}` : '',
        rdv.mail ? `✉&nbsp;${echapper(rdv.mail)}` : '',
    ].filter(Boolean).map(ligne => `<span class="carte-contact">${ligne}</span>`).join('');

    const selection = rdv.rowId === rowIdSelectionne ? ' selectionnee' : '';

    return `
        <div class="carte ${rdv.creneau.classe}${rdv.visio ? ' carte-visio' : ''}${selection}" data-row-id="${rdv.rowId}">
            ${rdv.visio ? `<div class="bandeau-visio">${ICONE_VISIO}Visioconférence</div>` : ''}
            <div class="carte-entete">
                <span class="carte-id">${echapper(rdv.identifiant) || '—'}</span>
                <span class="badge">${rdv.creneau.badge}</span>
            </div>
            <span class="carte-patient">${echapper(rdv.nom)} ${echapper(rdv.prenom)}</span>
            ${contact}
            <div class="carte-motifs">${renderMotifsStandardises(rdv)}</div>
        </div>
    `;
}

function renderMotifsStandardises(rdv) {
    return rdv.motifsStandardises.length > 0
        ? rdv.motifsStandardises.map(motif => `<span class="motif-std">${echapper(motif)}</span>`).join('')
        : '<span class="motif-vide">Motif non qualifié</span>';
}

// ---------- Feuille d'émargement (à remplir à la main) ----------

function renderEmargement(rdvs, salles) {
    const rdvsTries = trierRdvEmargement(rdvs, salles);

    return `
        <h2 class="titre-section">Émargement des RDV - ${echapper(libelleJour(jourSelectionne))}</h2>
        <table class="emargement">
            <colgroup>
                <col class="col-em-horaire"><col class="col-em-rdv"><col class="col-em-cliniciens"><col class="col-em-patient"><col>
            </colgroup>
            <thead>
                <tr>
                    <th>Heure / salle</th>
                    <th>RDV</th>
                    <th>Cliniciens présents</th>
                    <th>Patient</th>
                    <th>Motif, commentaires / notes</th>
                </tr>
            </thead>
            <tbody>${rdvsTries.map(renderLigneEmargement).join('')}</tbody>
        </table>
    `;
}

function renderLigneEmargement(rdv) {
    const nbLignesVierges = Math.max(0, NB_LIGNES_CLINICIENS_MIN - rdv.cliniciens.length);
    const cliniciens = (rdv.cliniciens.length > 0 ? '' : '<div class="non-renseigne">Non renseignés</div>')
        + rdv.cliniciens.map(clinicien => `
            <div class="a-cocher">
                <span class="case"></span>
                <span class="clinicien-nom">${echapper(clinicien.nom)}</span>
                ${clinicien.telephone ? `<span class="clinicien-tel">☎&nbsp;${echapper(clinicien.telephone)}</span>` : ''}
            </div>`).join('')
        + '<div class="a-cocher"><span class="case"></span><span class="ligne-ecriture"></span></div>'.repeat(nbLignesVierges);

    return `
        <tr>
            <td class="em-horaire">
                <strong>${rdv.horaire}</strong>
                <span>${echapper(rdv.salle.libelle)}</span>
            </td>
            <td class="em-rdv ${rdv.creneau.classe}">
                <span class="carte-id">${echapper(rdv.identifiant) || '—'}</span>
                <span class="em-badges">
                    <span class="badge">${rdv.creneau.badge}</span>
                    ${rdv.visio ? `<span class="badge badge-visio">${ICONE_VISIO}Visio</span>` : ''}
                </span>
                <span class="carte-patient">${echapper(rdv.nom)} ${echapper(rdv.prenom)}</span>
                <div class="em-motifs">${renderMotifsStandardises(rdv)}</div>
            </td>
            <td class="em-cliniciens">${cliniciens}</td>
            <td class="em-patient">
                <div class="a-cocher"><span class="case"></span>Arrivé</div>
                <div class="a-cocher"><span class="case"></span>Absent</div>
                <div class="em-heure-arrivee">à <span class="ligne-ecriture courte"></span></div>
            </td>
            <td class="em-notes">
                <div class="em-bloc">
                    <span class="em-bloc-titre">Motif détaillé</span>
                    <span class="carte-motif${rdv.motif ? '' : ' vide'}">${rdv.motif ? echapper(rdv.motif) : 'Non renseigné'}</span>
                </div>
                ${rdv.commentaires ? `<div class="em-bloc"><span class="em-bloc-titre">Commentaire</span><span class="em-commentaire">${echapper(rdv.commentaires)}</span></div>` : ''}
                <span class="ligne-ecriture"></span>
                <span class="ligne-ecriture"></span>
            </td>
        </tr>
    `;
}

// ---------- Bande des jours avec RDV ----------

// Map "AAAA-MM-JJ" -> nombre de RDV, triée par date
function getJoursAvecRdv() {
    const jours = new Map();
    dossiers.forEach(dossier => {
        CRENEAUX_RDV.forEach(creneau => {
            const debut = versDate(dossier[creneau.date]);
            if (debut) {
                const cle = cleJour(debut);
                jours.set(cle, (jours.get(cle) || 0) + 1);
            }
        });
    });
    return new Map([...jours.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function afficherBandeDates() {
    const aujourdhui = cleJour(new Date());
    const format = (cle, options) => new Date(cle + 'T12:00:00Z').toLocaleDateString('fr-FR', { timeZone: 'UTC', ...options });

    const conteneur = document.getElementById('dates-rdv');
    const jours = getJoursAvecRdv();
    conteneur.innerHTML = jours.size === 0
        ? '<span class="dates-vide">Aucun RDV programmé</span>'
        : [...jours.entries()].map(([cle, nb]) => {
            const classes = [
                'date-rdv',
                cle === jourSelectionne ? 'active' : '',
                cle === aujourdhui ? 'aujourdhui' : '',
                cle < aujourdhui ? 'passee' : '',
            ].filter(Boolean).join(' ');
            return `
                <button type="button" class="${classes}" data-cle="${cle}" title="${echapper(libelleJour(cle))}">
                    <span class="date-semaine">${echapper(format(cle, { weekday: 'short' }))}</span>
                    <span class="date-rond">${format(cle, { day: 'numeric' })}</span>
                    <span class="date-mois">${echapper(format(cle, { month: 'short' }))}</span>
                    <span class="date-nb">${nb} RDV</span>
                </button>`;
        }).join('');

    // Centre la bande sur le jour affiché, ou à défaut sur le prochain jour avec RDV
    const cible = conteneur.querySelector('.date-rdv.active')
        || [...conteneur.querySelectorAll('.date-rdv')].find(bouton => bouton.dataset.cle > jourSelectionne)
        || conteneur.querySelector('.date-rdv:last-child');
    if (cible) {
        conteneur.scrollTo({ left: cible.offsetLeft - (conteneur.clientWidth - cible.offsetWidth) / 2, behavior: 'instant' });
    }
}

// ---------- Interactions ----------

function changerJour(cle) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cle)) {
        return;
    }
    jourSelectionne = cle;
    afficherBriefing();
}

document.getElementById('jour').addEventListener('change', e => changerJour(e.target.value));
document.getElementById('jour-precedent').addEventListener('click', () => changerJour(decalerJour(jourSelectionne, -1)));
document.getElementById('jour-suivant').addEventListener('click', () => changerJour(decalerJour(jourSelectionne, 1)));
document.getElementById('aujourdhui').addEventListener('click', () => changerJour(cleJour(new Date())));

// Bande des dates : clic sur une date, flèches et molette pour défiler horizontalement
const bandeDates = document.getElementById('dates-rdv');
bandeDates.addEventListener('click', e => {
    const bouton = e.target.closest('.date-rdv');
    if (bouton) {
        changerJour(bouton.dataset.cle);
    }
});
bandeDates.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        bandeDates.scrollLeft += e.deltaY;
    }
}, { passive: false });
document.getElementById('dates-gauche').addEventListener('click', () => bandeDates.scrollBy({ left: -bandeDates.clientWidth * 0.8, behavior: 'smooth' }));
document.getElementById('dates-droite').addEventListener('click', () => bandeDates.scrollBy({ left: bandeDates.clientWidth * 0.8, behavior: 'smooth' }));
document.getElementById('generer-pdf').addEventListener('click', async e => {
    const bouton = e.currentTarget;
    const libelle = bouton.textContent;
    bouton.disabled = true;
    bouton.textContent = 'Génération…';
    try {
        await genererPdfBriefing();
    } catch (erreur) {
        console.error('Erreur de génération du PDF :', erreur);
        alert('Le PDF n\'a pas pu être généré.');
    } finally {
        bouton.textContent = libelle;
        bouton.disabled = false;
    }
});
document.getElementById('motif-complet').addEventListener('change', e => document.body.classList.toggle('motif-complet', e.target.checked));

// Clic sur une carte : sélection de la ligne correspondante dans Grist
document.getElementById('occupation').addEventListener('click', e => {
    const carte = e.target.closest('.carte');
    if (!carte) {
        return;
    }
    rowIdSelectionne = Number(carte.dataset.rowId);
    grist.setCursorPos({ rowId: rowIdSelectionne });
    afficherBriefing();
});
