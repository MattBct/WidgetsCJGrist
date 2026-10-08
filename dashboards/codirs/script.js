const COLUMNS_MAPPING = [
    {
        name: "nb_rdv_prevus_semaine",
        title: "Nombre de RDV prévus cette semaine",
        optional: false,
        type: "Int",
        allowMultiple: false
    },
    {
        name: "nb_demandes_rdv_en_attente",
        title: "Nombre de demandes de RDV en attente",
        optional: false,
        type: "Int",
        allowMultiple: false
    },
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
        name: "heures_option_moyenne",
        title: "Moyenne d'heures des cliniciens en option",
        optional: false,
        type: "Numeric,Int",
        allowMultiple: false
    },
    {
        name: "heures_option_mediane",
        title: "Médiane d'heures des cliniciens en option",
        optional: false,
        type: "Numeric,Int",
        allowMultiple: false
    },
    {
        name: "heures_option_min",
        title: "Heures du clinicien en option qui en a fait le moins",
        optional: false,
        type: "Numeric,Int",
        allowMultiple: false
    },
    {
        name: "heures_option_max",
        title: "Heures du clinicien en option qui en a fait le plus",
        optional: false,
        type: "Numeric,Int",
        allowMultiple: false
    },
    {
        name: "repartition_diplomes_option",
        title: "Répartition des cliniciens en option par diplôme",
        description: "Colonne formule renvoyant la liste JSON [[diplôme, effectif], ...]",
        optional: true,
        type: "Text",
        allowMultiple: false
    },
    {
        name: "repartition_diplomes_hors_option",
        title: "Répartition des cliniciens hors option par diplôme",
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

// Écrit le total des séries visibles au bout de chaque barre
const totalBoutDeBarre = {
    id: 'totalBoutDeBarre',
    afterDatasetsDraw(chart) {
        const visibles = chart.data.datasets
            .map((dataset, i) => ({ dataset, meta: chart.getDatasetMeta(i) }))
            .filter(({ meta }) => meta.visible);
        if (visibles.length === 0) {
            return;
        }

        const { ctx } = chart;
        ctx.save();
        ctx.font = "700 12px 'Montserrat', sans-serif";
        ctx.fillStyle = '#8E2626';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        chart.data.labels.forEach((_, index) => {
            const total = visibles.reduce((somme, { dataset }) => somme + (Number(dataset.data[index]) || 0), 0);
            const barres = visibles.map(({ meta }) => meta.data[index]).filter(Boolean);
            if (total === 0 || barres.length === 0) {
                return;
            }
            const fin = Math.max(...barres.map((barre) => barre.x));
            ctx.fillText(total, fin + 6, barres[0].y);
        });

        ctx.restore();
    }
};

function initChartDiplomesOption() {
    const canvas = document.getElementById('chartDiplomesOption');
    if (!canvas) {
        return;
    }

    chartDiplomesOption = new Chart(canvas, {
        type: 'bar',
        plugins: [totalBoutDeBarre],
        data: {
            labels: [],
            datasets: [
                {
                    label: 'En option',
                    data: [],
                    backgroundColor: '#C03737',
                    hoverBackgroundColor: '#A73030',
                    borderColor: '#ffffff',
                    borderWidth: { right: 2 },
                    maxBarThickness: 28
                },
                {
                    label: 'Hors option',
                    data: [],
                    backgroundColor: '#DB8080',
                    hoverBackgroundColor: '#CF6A6A',
                    borderColor: '#ffffff',
                    borderWidth: { right: 2 },
                    maxBarThickness: 28
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { right: 28 }
            },
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
                        label: (context) => ' ' + context.dataset.label + ' : ' + context.parsed.x + ' ' + plur(context.parsed.x, 'clinicien', 'cliniciens'),
                        footer: (items) => {
                            if (items.length < 2) {
                                return '';
                            }
                            const total = items.reduce((somme, item) => somme + item.parsed.x, 0);
                            return 'Total : ' + total + ' ' + plur(total, 'clinicien', 'cliniciens');
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: { color: '#ececec' },
                    border: { display: false }
                },
                y: {
                    stacked: true,
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

// Fusionne les répartitions option / hors option par diplôme : [[diplôme, en option, hors option], ...]
// triées par effectif total décroissant
function fusionnerRepartitions(option, horsOption) {
    const parDiplome = new Map();
    for (const [diplome, effectif] of option) {
        parDiplome.set(diplome, [diplome, Number(effectif) || 0, 0]);
    }
    for (const [diplome, effectif] of horsOption) {
        const ligne = parDiplome.get(diplome) ?? [diplome, 0, 0];
        ligne[2] += Number(effectif) || 0;
        parDiplome.set(diplome, ligne);
    }
    return [...parDiplome.values()].sort((a, b) => (b[1] + b[2]) - (a[1] + a[2]));
}

// Mode « tous » : barres empilées option / hors option ; mode « option » : cliniciens en option uniquement
function majGraphiqueDiplomes() {
    if (!chartDiplomesOption) {
        return;
    }

    const store = Alpine.store('donnees');
    const optionSeule = store.mode_diplomes === 'option';
    const lignes = store.repartition_diplomes_affichee;

    chartDiplomesOption.data.labels = lignes.map(([diplome]) => diplome);
    chartDiplomesOption.data.datasets[0].data = lignes.map(([, option]) => option);
    chartDiplomesOption.data.datasets[1].data = lignes.map(([, , horsOption]) => horsOption);
    chartDiplomesOption.data.datasets[1].hidden = optionSeule;
    chartDiplomesOption.options.plugins.legend.display = !optionSeule;
    chartDiplomesOption.canvas.parentNode.style.height = (Math.max(1, lignes.length) * 44 + (optionSeule ? 40 : 70)) + 'px';
    chartDiplomesOption.update();
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

    const repartition = fusionnerRepartitions(
        parseRepartition(data.repartition_diplomes_option),
        parseRepartition(data.repartition_diplomes_hors_option)
    );
    store.repartition_diplomes = repartition;

    majGraphiqueDiplomes();
})
