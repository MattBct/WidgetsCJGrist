grist.ready(
    {
        requiredAccess: 'read table',
        columns: [
            {
                name: 'nom_patient',
                title: 'Nom du patient',
                type: 'Text',
                optional: false
            },
            {
                name: 'rdv_1',
                title: 'Créneau RDV 1',
                type: 'DateTime',
                optional: false
            },
            {
                name: 'rdv_2',
                title: 'Créneau RDV 2',
                type: 'DateTime',
                optional: false
            },
            {
                name: 'motif',
                title: 'Motif du RDV',
                type: 'Text',
                optional: false
            }
        ]

    }
);
grist.onRecords((records) => {
    console.log(records)
})