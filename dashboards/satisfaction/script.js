const COLUMNS_MAPPING = [
    {
        name: "cree_le",
        title: "Date du retour",
        optional: false,
        type: "DateTime,Date",
        allowMultiple: false
    },
    {
        name: "connaissance_cj",
        title: "Connaissance de la Clinique Juridique",
        description: "Comment la personne a connu la Clinique",
        optional: true,
        type: "Choice,Text",
        allowMultiple: false
    },
    {
        name: "satisfaction_teneur",
        title: "Satisfaction — teneur de l'entretien",
        description: "Note de 0 à 10",
        optional: false,
        type: "Int,Numeric",
        allowMultiple: false
    },
    {
        name: "satisfaction_information",
        title: "Satisfaction — information juridique",
        description: "Note de 0 à 10",
        optional: false,
        type: "Int,Numeric",
        allowMultiple: false
    },
    {
        name: "satisfaction_duree",
        title: "Satisfaction — durée de l'entretien",
        description: "Note de 0 à 10",
        optional: false,
        type: "Int,Numeric",
        allowMultiple: false
    },
    {
        name: "remarques",
        title: "Remarques et commentaires libres",
        optional: true,
        type: "Text",
        allowMultiple: false
    }
]

// Sujets notés, dans l'ordre d'affichage
const SUJETS = [
    { cle: 'teneur', colonne: 'satisfaction_teneur', libelle: "Teneur de l'entretien", court: 'Teneur', couleur: '#8E2626' },
    { cle: 'information', colonne: 'satisfaction_information', libelle: 'Information juridique', court: 'Information', couleur: '#C03737' },
    { cle: 'duree', colonne: 'satisfaction_duree', libelle: "Durée de l'entretien", court: 'Durée', couleur: '#DB8080' }
]

// Moyenne d'un retour à partir de laquelle il est compté comme « satisfait »
const SEUIL_SATISFAIT = 7;

const NON_RENSEIGNE = 'Non renseigné';

function gristReady() {
    grist.ready({
        requiredAccess: 'read table',
        columns: COLUMNS_MAPPING,
    });
}

gristReady()

// Typographie et couleurs des graphiques alignées sur l'identité des widgets
Chart.defaults.font.family = "'Montserrat', sans-serif";
Chart.defaults.color = '#5f5f5f';

const LEGENDE = {
    position: 'bottom',
    labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        boxWidth: 8,
        boxHeight: 8,
        padding: 14
    }
};

// ---------- Préparation des données ----------

// Grist renvoie normalement un objet Date ; on tolère aussi un horodatage en secondes ou une chaîne
function versDate(valeur) {
    let date = null;
    if (valeur instanceof Date) {
        date = valeur;
    } else if (typeof valeur === 'number') {
        date = new Date(valeur * 1000);
    } else if (typeof valeur === 'string' && valeur !== '') {
        date = new Date(valeur);
    }
    return date && !isNaN(date.getTime()) ? date : null;
}

// Note entière bornée à [0, 10], ou null si la case est vide
function versNote(valeur) {
    if (valeur === null || valeur === undefined || valeur === '') {
        return null;
    }
    const n = Number(valeur);
    return Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n))) : null;
}

function moyenne(valeurs) {
    const notes = valeurs.filter((v) => v !== null);
    return notes.length > 0 ? notes.reduce((somme, v) => somme + v, 0) / notes.length : null;
}

function normaliserRetour(record) {
    const notes = SUJETS.map((sujet) => ({
        cle: sujet.cle,
        libelle: sujet.court,
        titre: sujet.libelle,
        valeur: versNote(record[sujet.colonne])
    }));

    return {
        id: record.id,
        date: versDate(record.cree_le),
        connaissance: String(record.connaissance_cj ?? '').trim() || NON_RENSEIGNE,
        notes,
        moyenne: moyenne(notes.map((n) => n.valeur)),
        remarques: String(record.remarques ?? '').trim()
    };
}

// Clé « AAAA-MM » dans le fuseau de la Clinique
function cleMois(date) {
    return date.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).slice(0, 7);
}

function libelleMois(cle) {
    const [annee, mois] = cle.split('-').map(Number);
    const texte = new Date(Date.UTC(annee, mois - 1, 15)).toLocaleDateString('fr-FR', { timeZone: 'UTC', month: 'short', year: 'numeric' });
    return texte.charAt(0).toUpperCase() + texte.slice(1);
}

// Tous les mois du premier au dernier retour, y compris ceux sans retour
function moisContinus(cles) {
    if (cles.length === 0) {
        return [];
    }
    const triees = [...cles].sort();
    let [annee, mois] = triees[0].split('-').map(Number);
    const [anneeFin, moisFin] = triees[triees.length - 1].split('-').map(Number);
    const resultat = [];
    while (annee < anneeFin || (annee === anneeFin && mois <= moisFin)) {
        resultat.push(annee + '-' + String(mois).padStart(2, '0'));
        mois += 1;
        if (mois > 12) {
            mois = 1;
            annee += 1;
        }
    }
    return resultat;
}

// ---------- Graphique : connaissance de la Clinique ----------

let chartConnaissance;
let statsConnaissance = [];

function initChartConnaissance() {
    const canvas = document.getElementById('chartConnaissance');
    if (!canvas) {
        return;
    }

    chartConnaissance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [],
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            cutout: '62%',
            plugins: {
                legend: LEGENDE,
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const ligne = statsConnaissance[context.dataIndex];
                            const texte = ' ' + context.parsed + ' ' + plur(context.parsed, 'retour', 'retours');
                            return ligne && ligne.moyenne !== null ? texte + ' · ' + note(ligne.moyenne) + '/10' : texte;
                        }
                    }
                }
            }
        }
    });
}

initChartConnaissance()

// Dégradé de la teinte de la Clinique, du plus foncé au plus clair
const PALETTE_ANNEAU = ['#8E2626', '#C03737', '#DB8080', '#EDB3B3', '#F6DFDF', '#5f5f5f', '#a3a3a3', '#d9d9d9'];

function majChartConnaissance(retours) {
    if (!chartConnaissance) {
        return;
    }

    const parOrigine = new Map();
    for (const retour of retours) {
        const ligne = parOrigine.get(retour.connaissance) ?? { origine: retour.connaissance, nb: 0, moyennes: [] };
        ligne.nb += 1;
        ligne.moyennes.push(retour.moyenne);
        parOrigine.set(retour.connaissance, ligne);
    }

    // Effectif décroissant, « Non renseigné » toujours en dernier
    statsConnaissance = [...parOrigine.values()]
        .map((ligne) => ({ origine: ligne.origine, nb: ligne.nb, moyenne: moyenne(ligne.moyennes) }))
        .sort((a, b) => (a.origine === NON_RENSEIGNE) - (b.origine === NON_RENSEIGNE) || b.nb - a.nb);

    chartConnaissance.data.labels = statsConnaissance.map((ligne) => ligne.origine);
    chartConnaissance.data.datasets[0].data = statsConnaissance.map((ligne) => ligne.nb);
    chartConnaissance.data.datasets[0].backgroundColor = statsConnaissance.map((ligne, i) =>
        ligne.origine === NON_RENSEIGNE ? '#d9d9d9' : PALETTE_ANNEAU[i % PALETTE_ANNEAU.length]
    );
    chartConnaissance.update();
}

// ---------- Graphique : évolution mensuelle ----------

let chartEvolution;

function initChartEvolution() {
    const canvas = document.getElementById('chartEvolution');
    if (!canvas) {
        return;
    }

    chartEvolution = new Chart(canvas, {
        data: {
            labels: [],
            datasets: [
                {
                    type: 'line',
                    label: 'Satisfaction moyenne',
                    data: [],
                    yAxisID: 'note',
                    borderColor: '#8E2626',
                    backgroundColor: '#8E2626',
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    spanGaps: true,
                    order: 0
                },
                {
                    type: 'bar',
                    label: 'Retours',
                    data: [],
                    yAxisID: 'nombre',
                    backgroundColor: '#F6DFDF',
                    hoverBackgroundColor: '#EDB3B3',
                    borderRadius: 4,
                    maxBarThickness: 36,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: LEGENDE,
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            if (context.dataset.yAxisID === 'note') {
                                return context.parsed.y === null ? ' Pas de note' : ' Satisfaction moyenne : ' + note(context.parsed.y) + '/10';
                            }
                            return ' ' + context.parsed.y + ' ' + plur(context.parsed.y, 'retour', 'retours');
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                nombre: {
                    position: 'left',
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: { color: '#ececec' },
                    border: { display: false },
                    title: { display: true, text: 'Retours' }
                },
                note: {
                    position: 'right',
                    min: 0,
                    max: 10,
                    ticks: { stepSize: 2 },
                    grid: { display: false },
                    border: { display: false },
                    title: { display: true, text: 'Note /10' }
                }
            }
        }
    });
}

initChartEvolution()

function majChartEvolution(retours) {
    if (!chartEvolution) {
        return;
    }

    const parMois = new Map();
    for (const retour of retours) {
        if (!retour.date) {
            continue;
        }
        const cle = cleMois(retour.date);
        const ligne = parMois.get(cle) ?? { nb: 0, moyennes: [] };
        ligne.nb += 1;
        ligne.moyennes.push(retour.moyenne);
        parMois.set(cle, ligne);
    }

    const mois = moisContinus([...parMois.keys()]);
    chartEvolution.data.labels = mois.map(libelleMois);
    chartEvolution.data.datasets[0].data = mois.map((cle) => parMois.has(cle) ? moyenne(parMois.get(cle).moyennes) : null);
    chartEvolution.data.datasets[1].data = mois.map((cle) => parMois.get(cle)?.nb ?? 0);
    chartEvolution.update();
}

// ---------- Graphique : répartition des notes ----------

let chartNotes;

function initChartNotes() {
    const canvas = document.getElementById('chartNotes');
    if (!canvas) {
        return;
    }

    chartNotes = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: Array.from({ length: 11 }, (_, i) => String(i)),
            datasets: [{
                label: 'Notes',
                data: [],
                backgroundColor: '#C03737',
                hoverBackgroundColor: '#A73030',
                borderRadius: 4,
                maxBarThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (items) => 'Note ' + items[0].label + '/10',
                        label: (context) => ' ' + context.parsed.y + ' ' + plur(context.parsed.y, 'note', 'notes')
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    title: { display: true, text: 'Note /10' }
                },
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: { color: '#ececec' },
                    border: { display: false }
                }
            }
        }
    });
}

initChartNotes()

function compterNotes(valeurs) {
    const compte = Array(11).fill(0);
    for (const v of valeurs) {
        if (v !== null) {
            compte[v] += 1;
        }
    }
    return compte;
}

function majGraphiqueNotes() {
    if (!chartNotes) {
        return;
    }

    const store = Alpine.store('donnees');
    const sujet = SUJETS.find((s) => s.cle === store.mode_notes);
    chartNotes.data.datasets[0].data = store.nb_notes_par_note[store.mode_notes] ?? [];
    chartNotes.data.datasets[0].backgroundColor = sujet ? sujet.couleur : '#C03737';
    chartNotes.update();
}

// ---------- Réception des données ----------

grist.onRecords((records) => {
    const mappedRecords = grist.mapColumnNames(records);
    const store = Alpine.store('donnees');

    // Plus récents d'abord, retours sans date à la fin
    const retours = (mappedRecords || [])
        .map(normaliserRetour)
        .sort((a, b) => (!a.date - !b.date) || ((b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0)));

    const notesParSujet = Object.fromEntries(SUJETS.map((sujet) => [
        sujet.cle,
        retours.map((retour) => retour.notes.find((n) => n.cle === sujet.cle).valeur)
    ]));
    const toutesLesNotes = Object.values(notesParSujet).flat();
    const retoursNotes = retours.filter((retour) => retour.moyenne !== null);

    store.retours = retours;
    store.nb_rex = retours.length;
    store.nb_rex_commentes = retours.filter((retour) => retour.remarques !== '').length;
    store.dernier_retour = retours.find((retour) => retour.date)?.date ?? null;
    store.moyenne_globale = moyenne(toutesLesNotes);
    store.pct_satisfaits = retoursNotes.length > 0
        ? Math.round(retoursNotes.filter((retour) => retour.moyenne >= SEUIL_SATISFAIT).length / retoursNotes.length * 100)
        : 0;
    store.moyenne_teneur = moyenne(notesParSujet.teneur);
    store.moyenne_information = moyenne(notesParSujet.information);
    store.moyenne_duree = moyenne(notesParSujet.duree);
    store.nb_notes_par_note = {
        global: compterNotes(toutesLesNotes),
        ...Object.fromEntries(SUJETS.map((sujet) => [sujet.cle, compterNotes(notesParSujet[sujet.cle])]))
    };

    majChartConnaissance(retours);
    majChartEvolution(retours);
    majGraphiqueNotes();
})
