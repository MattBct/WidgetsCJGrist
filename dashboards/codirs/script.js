const COLUMNS_MAPPING = [
    {
        name: "nb_rdv_traites_annee",
        title: "Nombre de RDV traités depuis le début de l'année",
        optional: false,
        type: "Int",
        allowMultiple: false
    },
    {
        name: "nb_projets",
        title: "Nombre de projets",
        optional: false,
        type: "Int",
        allowMultiple: false
    },
    {
        name: "nb_permanences",
        title: "Nombre de permanences",
        optional: false,
        type: "Int",
        allowMultiple: false
    },
    {
        name: "nb_passages_total",
        title: "Nombre de passages au total (permanences)",
        optional: false,
        type: "Int",
        allowMultiple: false
    },
    {
        name: "nb_passages_moyen",
        title: "Nombre de passages en moyenne (permanences)",
        optional: false,
        type: "Int",
        allowMultiple: false
    },
    {
        name: "nb_cliniciens_inscrits",
        title: "Nombre de cliniciens inscrits",
        optional: false,
        type: "Int",
        allowMultiple: false
    },
    {
        name: "nb_cliniciens_option_inscrits",
        title: "Nombre de cliniciens en option inscrits",
        optional: false,
        type: "Int",
        allowMultiple: false
    },
    {
        name: "nb_cliniciens_option_heures_validees",
        title: "Nombre de cliniciens en option ayant validé leurs heures",
        optional: false,
        type: "Int",
        allowMultiple: false
    },
    {
        name: "nb_cliniciens_option_heures_non_validees",
        title: "Nombre de cliniciens en option n'ayant pas validé leurs heures",
        optional: false,
        type: "Int",
        allowMultiple: false
    },
    {
        name: "repartition_diplomes_option",
        title: "Répartition des cliniciens en option par diplôme",
        description: "Colonne formule renvoyant la liste JSON [[diplôme, effectif], ...]",
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

let chartOptionHeures;

function initChartOptionHeures() {
    const canvas = document.getElementById('chartOptionHeures');
    if (!canvas) {
        return;
    }

    chartOptionHeures = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Heures validées', 'Heures non validées'],
            datasets: [{
                data: [0, 0],
                backgroundColor: ['#C03737', '#DB8080'],
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            cutout: '62%',
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
                        label: (context) => ' ' + context.parsed + ' ' + plur(context.parsed, 'clinicien', 'cliniciens')
                    }
                }
            }
        }
    });
}

initChartOptionHeures()

let chartDiplomesOption;

function initChartDiplomesOption() {
    const canvas = document.getElementById('chartDiplomesOption');
    if (!canvas) {
        return;
    }

    chartDiplomesOption = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Cliniciens en option',
                data: [],
                backgroundColor: '#C03737',
                hoverBackgroundColor: '#A73030',
                borderRadius: 4,
                borderSkipped: 'start',
                maxBarThickness: 28
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context) => ' ' + context.parsed.x + ' ' + plur(context.parsed.x, 'clinicien', 'cliniciens')
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: { color: '#ececec' },
                    border: { display: false }
                },
                y: {
                    grid: { display: false }
                }
            }
        }
    });
}

initChartDiplomesOption()

// La colonne formule renvoie du JSON : [["Diplôme A", 12], ["Diplôme B", 7], ...]
function parseRepartition(valeur) {
    try {
        const repartition = JSON.parse(valeur);
        return Array.isArray(repartition) ? repartition : [];
    } catch (e) {
        return [];
    }
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

    if (chartOptionHeures) {
        chartOptionHeures.data.datasets[0].data = [
            store.nb_cliniciens_option_heures_validees,
            store.nb_cliniciens_option_heures_non_validees
        ];
        chartOptionHeures.update();
    }

    const repartition = parseRepartition(data.repartition_diplomes_option);
    store.repartition_diplomes_option = repartition;

    if (chartDiplomesOption) {
        chartDiplomesOption.data.labels = repartition.map(([diplome]) => diplome);
        chartDiplomesOption.data.datasets[0].data = repartition.map(([, effectif]) => effectif);
        chartDiplomesOption.canvas.parentNode.style.height = (Math.max(1, repartition.length) * 44 + 40) + 'px';
        chartDiplomesOption.update();
    }
})
