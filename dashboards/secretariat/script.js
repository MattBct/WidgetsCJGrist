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
    }
]

function gristReady() {
    grist.ready({
        requiredAccess: 'read table',
        columns: COLUMNS_MAPPING,
    });
}

gristReady()

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
})
