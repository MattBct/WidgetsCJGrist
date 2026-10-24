const COLUMNS_MAPPING = [
    {
        name: "nb_demandes_rdv_non_traites",
        title: "Nombre de demandes de RDV non traités",
        optional: false,
        type: "Int", 
        allowMultiple: false
    },
    {
        name: "nb_demandes_rdv_non_traites_gp",
        title: "Nombre de demandes de RDV non traités (grand public)",
        description: "Uniquement les RDV grand public",
        optional: false,
        type: "Int", 
        allowMultiple: false
    },
    {
        name: "nb_demandes_rdv_non_traites_etu",
        title: "Nombre de demandes de RDV non traités (étudiants)",
        description: "Uniquement les RDV étudiants",
        optional: false,
        type: "Int", 
        allowMultiple: false
    },
    {
        name: "nb_rdv_prog_semaine",
        title: "Nombre de RDV programmés dans la semaine",
        optional: false,
        type: "Int", 
        allowMultiple: false
    },
    {
        name: "nb_rdv_non_confirme_patients",
        title: "Nombre de RDV en attente de confirmation par les patients",
        optional: false,
        type: "Int",
        allowMultiple: false
    },
    {
        name: "nb_rdv_non_confirme_patients_etu",
        title: "Nombre de RDV en attente de confirmation par les patients (ÉTU)",
        description: "RDV étudiants uniquement",
        optional: false,
        type: "Int",
        allowMultiple: false
    },
    {
        name: "nb_rdv_non_confirme_patients_gp",
        title: "Nombre de RDV en attente de confirmation par les patients (GP)",
        description: "RDV grand public uniquement",
        optional: false,
        type: "Int",
        allowMultiple: false
    },
    {
        name: "evolution_demandes_rdv",
        title: "Évolution mensuelle des demandes de RDV",
        description: "Colonne formule renvoyant la liste JSON [[\"AAAA-MM\", étudiants, grand public], ...]",
        optional: true,
        type: "Text",
        allowMultiple: false
    },
    {
        name: "evolution_demandes_rdv_semaine",
        title: "Évolution hebdomadaire des demandes de RDV",
        description: "Colonne formule renvoyant la liste JSON [[\"AAAA-MM-JJ (lundi)\", étudiants, grand public], ...]",
        optional: true,
        type: "Text",
        allowMultiple: false
    }
]

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

let chartEvolutionDemandes;

function initChartEvolutionDemandes() {
    const canvas = document.getElementById('chartEvolutionDemandes');
    if (!canvas) {
        return;
    }

    const serie = (label, couleur, extra = {}) => ({
        label,
        data: [],
        borderColor: couleur,
        backgroundColor: couleur,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: couleur,
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
        tension: 0.3,
        ...extra
    });

    chartEvolutionDemandes = new Chart(canvas, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                serie('Total', '#8E2626', { borderWidth: 3, fill: { target: 'origin', above: 'rgba(192, 55, 55, 0.08)' } }),
                serie('Étudiants', '#C03737'),
                serie('Grand public', '#DB8080')
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        boxWidth: 8,
                        boxHeight: 8,
                        padding: 14
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => ' ' + context.dataset.label + ' : ' + context.parsed.y + ' ' + plur(context.parsed.y, 'demande', 'demandes')
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false }
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

initChartEvolutionDemandes()

// La colonne formule renvoie du JSON : [["2025-09", 4, 12], ["2025-10", 6, 9], ...]
function parseEvolution(valeur) {
    try {
        const evolution = JSON.parse(valeur);
        return Array.isArray(evolution) ? evolution : [];
    } catch (e) {
        return [];
    }
}

// « 2025-09 » → « sept. 2025 »
function libelleMois(mois) {
    const [annee, numero] = String(mois).split('-').map(Number);
    return new Date(annee, numero - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}

// « 2025-10-06 » (lundi) → « sem. du 6 oct. »
function libelleSemaine(lundi) {
    const [annee, mois, jour] = String(lundi).split('-').map(Number);
    return 'sem. du ' + new Date(annee, mois - 1, jour).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// Affiche la série correspondant à la granularité choisie (mois / semaine)
function majGraphiqueEvolution() {
    if (!chartEvolutionDemandes) {
        return;
    }

    const store = Alpine.store('donnees');
    const parSemaine = store.granularite_evolution === 'semaine';
    const evolution = store.evolution_affichee;

    chartEvolutionDemandes.data.labels = evolution.map(([periode]) => parSemaine ? libelleSemaine(periode) : libelleMois(periode));
    chartEvolutionDemandes.data.datasets[0].data = evolution.map(([, etu, gp]) => (Number(etu) || 0) + (Number(gp) || 0));
    chartEvolutionDemandes.data.datasets[1].data = evolution.map(([, etu]) => Number(etu) || 0);
    chartEvolutionDemandes.data.datasets[2].data = evolution.map(([, , gp]) => Number(gp) || 0);
    chartEvolutionDemandes.update();
}

grist.onRecords((records) => {
    const mappedRecords = grist.mapColumnNames(records);

    if (!mappedRecords || mappedRecords.length === 0) {
        return;
    }

    const data = mappedRecords[0];
    const store = Alpine.store('donnees');

    for (const column of COLUMNS_MAPPING) {
        store[column.name] = data[column.name] ?? 0;
    }

    store.evolution_demandes_rdv = parseEvolution(data.evolution_demandes_rdv);
    store.evolution_demandes_rdv_semaine = parseEvolution(data.evolution_demandes_rdv_semaine);
    majGraphiqueEvolution();
})
