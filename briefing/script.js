const FUSEAU = 'Europe/Paris';

const COLONNES = [
    { name: "id_rdv_clinique", title: "Identifiant du RDV", type: "Text", optional: false },
    { name: "Nom_patient", title: "Nom du patient", type: "Text", optional: false },
    { name: "Prenom_patient", title: "Prénom du patient", type: "Text", optional: false },
    { name: "Telephone_patient", title: "Téléphone du patient", type: "Text", optional: true },
    { name: "Mail_patient", title: "Mail du patient", type: "Text", optional: true },
    { name: "Motif_RDV", title: "Motif du RDV", type: "Text", optional: false },
    { name: "Creneau_RDV_1", title: "Créneau RDV 1", type: "DateTime", optional: false, description: "Créneau horaire du premier rendez-vous" },
    { name: "Lieu_RDV_1", title: "Lieu RDV 1", type: "Ref,Text,Choice", optional: false, description: "Salle du premier rendez-vous (colonne Référence, ou colonne formule texte ex. $Lieu_RDV_1.Nom pour afficher le nom de la salle)" },
    { name: "Creneau_RDV_2", title: "Créneau RDV 2", type: "DateTime", optional: false, description: "Créneau horaire du deuxième rendez-vous" },
    { name: "Lieu_RDV_2", title: "Lieu RDV 2", type: "Ref,Text,Choice", optional: false, description: "Salle du deuxième rendez-vous (colonne Référence, ou colonne formule texte ex. $Lieu_RDV_2.Nom pour afficher le nom de la salle)" },
    { name: "Visioconference", title: "Visioconférence", type: "Bool", optional: true, description: "RDV en visioconférence (affiche une vignette Visio, le RDV reste dans sa salle)" },
];

// Mêmes couleurs que le widget calendrier
const CRENEAUX_RDV = [
    { ordre: 1, date: "Creneau_RDV_1", lieu: "Lieu_RDV_1", badge: "RDV 1", label: "Premier RDV (initial)", classe: "rdv-1" },
    { ordre: 2, date: "Creneau_RDV_2", lieu: "Lieu_RDV_2", badge: "RDV 2", label: "Second RDV (restitution)", classe: "rdv-2" },
];

const SANS_SALLE = { cle: "__sans_salle", libelle: "Sans salle", ordre: 1 };

let dossiers = [];
let jourSelectionne = cleJour(new Date());
let rowIdSelectionne = null;

grist.ready({
    requiredAccess: 'read table',
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

// ---------- Salles ----------

// Une colonne Ref peut arriver sous forme d'identifiant, d'objet Reference ({tableId, rowId})
// ou d'enregistrement développé ; une colonne texte donne directement le nom de la salle.
function getSalle(valeur) {
    if (valeur === null || valeur === undefined || valeur === '' || valeur === 0) {
        return SANS_SALLE;
    }
    if (typeof valeur === 'number') {
        return { cle: String(valeur), libelle: `Salle ${valeur}`, ordre: 0 };
    }
    if (typeof valeur === 'object') {
        const id = valeur.rowId ?? valeur.id;
        if (!id) {
            return SANS_SALLE;
        }
        const libelle = Object.entries(valeur).find(([cle, v]) => !['tableId', 'rowId', 'id'].includes(cle) && typeof v === 'string' && v.trim())?.[1];
        return { cle: String(id), libelle: libelle || `Salle ${id}`, ordre: 0 };
    }
    return { cle: String(valeur), libelle: String(valeur), ordre: 0 };
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
                visio: dossier.Visioconference === true,
            });
        });
    });
    return rdvs.sort((a, b) => a.debut - b.debut || a.creneau.ordre - b.creneau.ordre);
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
    document.getElementById('titre-date').textContent = libelleJour(jourSelectionne);
    document.title = `Briefing RDV du jour - ${libelleJour(jourSelectionne)}`;

    const rdvs = getRdvDuJour(jourSelectionne);
    const salles = [];
    rdvs.forEach(rdv => {
        if (!salles.find(s => s.cle === rdv.salle.cle)) {
            salles.push(rdv.salle);
        }
    });
    salles.sort(comparerSalles);
    const horaires = [...new Set(rdvs.map(rdv => rdv.horaire))];

    document.getElementById('synthese').innerHTML = renderSynthese(rdvs, salles, horaires);
    document.getElementById('occupation').innerHTML = rdvs.length > 0
        ? renderTableau(rdvs, salles, horaires)
        : `<div class="vide-journee">Aucun RDV prévu le ${echapper(libelleJour(jourSelectionne).toLowerCase())}.</div>`;
}

function renderSynthese(rdvs, salles, horaires) {
    const nbRdv1 = rdvs.filter(rdv => rdv.creneau.ordre === 1).length;
    const nbRdv2 = rdvs.filter(rdv => rdv.creneau.ordre === 2).length;
    const nbSalles = salles.filter(s => s !== SANS_SALLE).length;
    const plage = horaires.length > 0 ? `${horaires[0]} → ${horaires[horaires.length - 1]}` : '—';

    const legende = CRENEAUX_RDV.map(c => `<span class="legende-item"><span class="pastille ${c.classe}"></span>${echapper(c.label)}</span>`).join('');

    return `
        <div class="chiffres">
            <span class="chiffre"><strong>${rdvs.length}</strong> ${plur(rdvs.length, 'RDV', 'RDV')}</span>
            <span class="chiffre"><strong>${nbRdv1}</strong> ${plur(nbRdv1, 'premier', 'premiers')}</span>
            <span class="chiffre"><strong>${nbRdv2}</strong> ${plur(nbRdv2, 'second', 'seconds')}</span>
            <span class="chiffre"><strong>${nbSalles}</strong> ${plur(nbSalles, 'salle occupée', 'salles occupées')}</span>
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
        <div class="carte ${rdv.creneau.classe}${selection}" data-row-id="${rdv.rowId}">
            <div class="carte-entete">
                <span class="carte-id">${echapper(rdv.identifiant) || '—'}</span>
                <span>
                    ${rdv.visio ? '<span class="badge visio">Visio</span>' : ''}
                    <span class="badge">${rdv.creneau.badge}</span>
                </span>
            </div>
            <span class="carte-patient">${echapper(rdv.nom)} ${echapper(rdv.prenom)}</span>
            ${contact}
            <span class="carte-motif${rdv.motif ? '' : ' vide'}">${rdv.motif ? echapper(rdv.motif) : 'Motif non renseigné'}</span>
        </div>
    `;
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
document.getElementById('imprimer').addEventListener('click', () => window.print());
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
