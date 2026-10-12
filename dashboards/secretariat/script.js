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

    chartEvolutionDemandes = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Étudiants',
                    data: [],
                    backgroundColor: '#C03737',
                    hoverBackgroundColor: '#A73030',
                    borderColor: '#ffffff',
                    borderWidth: { top: 2 },
                    maxBarThickness: 36
                },
                {
                    label: 'Grand public',
                    data: [],
                    backgroundColor: '#DB8080',
                    hoverBackgroundColor: '#CF6A6A',
                    borderColor: '#ffffff',
                    borderWidth: { top: 2 },
                    maxBarThickness: 36
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
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
                    mode: 'index',
                    callbacks: {
                        label: (context) => ' ' + context.dataset.label + ' : ' + context.parsed.y,
                        footer: (items) => {
                            const total = items.reduce((somme, item) => somme + item.parsed.y, 0);
                            return 'Total : ' + total + ' ' + plur(total, 'demande', 'demandes');
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false }
                },
                y: {
                    stacked: true,
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

function majGraphiqueEvolution(valeur) {
    const store = Alpine.store('donnees');
    const evolution = parseEvolution(valeur);
    store.evolution_demandes_rdv = evolution;

    if (!chartEvolutionDemandes) {
        return;
    }

    chartEvolutionDemandes.data.labels = evolution.map(([mois]) => libelleMois(mois));
    chartEvolutionDemandes.data.datasets[0].data = evolution.map(([, etu]) => Number(etu) || 0);
    chartEvolutionDemandes.data.datasets[1].data = evolution.map(([, , gp]) => Number(gp) || 0);
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

    majGraphiqueEvolution(data.evolution_demandes_rdv);
})
