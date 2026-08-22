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
    }
]

function gristReady() {
    grist.ready({
        requiredAccess: 'read table',
        columns: COLUMNS_MAPPING,
    });
}

gristReady()

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
                backgroundColor: ['#A73030', '#772222'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

initChartOptionHeures()

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
})
