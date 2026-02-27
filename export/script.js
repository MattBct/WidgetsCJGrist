const GRIST_COLUMNS = [
            {
                name: 'NomPatient',
                title: 'Nom du patient',
                type: 'Text',
                optional: false
            },
            {
                name: 'RDV1',
                title: 'Créneau RDV 1',
                type: 'DateTime',
                optional: false
            },
            {
                name: 'RDV2',
                title: 'Créneau RDV 2',
                type: 'DateTime',
                optional: false
            },
            {
                name: 'Motif',
                title: 'Motif du RDV',
                type: 'Text',
                optional: false
            },
            {
                name: 'Email',
                title: 'Email du patient',
                type: 'Text',
                optional: false
            },
            {
                name: 'Tel',
                title: 'Téléphone du patient',
                type: 'Text',
                optional: false
            }
        ]

grist.ready(
    {
        requiredAccess: 'read table',
        columns: GRIST_COLUMNS
    }
);

const TABLE_COLUMNS = [
    {
        "key": "NomPatient",
        "title": "Nom du patient",
    },
    {
        key: "Motif",
        title: "Motif du RDV",
    },
    {
        key: "creneau",
        title: "Créneau RDV",
    },
    {
        key: "typeCreneau",
        title: "Type de créneau",
    },
    {
        key: "Email",
        title: "Email",
    },
    {
        key: "Tel",
        title: "Téléphone",
    }
]

const generateTableRecordsFromGristRecords = (gristRecords, dateSelected) => {
    return gristRecords.flatMap((record) => {
        const rdv1 = new Date(record.RDV1);
        const rdv2 = new Date(record.RDV2);
        const targetDay = dateSelected.getUTCDay();

        const formatOptions = { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };

        if (rdv1.getUTCDay() === targetDay) {
            return [{
                ...record, 
                creneau: rdv1.toLocaleString("fr", formatOptions), 
                typeCreneau: 'RDV initial'
            }];
        } 
        
        if (rdv2.getUTCDay() === targetDay) {
            return [{
                ...record, 
                creneau: rdv2.toLocaleString("fr", formatOptions), 
                typeCreneau: 'RDV relance'
            }];
        }
        return [];
});
}

const generateTableHeadColumns = (columns) => {
    let tableHeadColumns = ''
    columns.forEach(col => {
        tableHeadColumns += `<th>${col.title}</th>`
    })
    return tableHeadColumns
}

const generateTableBodyRows = (records, columns) => {
    console.log("Records", records);
    console.log("Columns", columns);
    let tableBodyRows = ''
    records.forEach(record => {
        let row = ''
        columns.forEach(col => {
            row += `<td>${record[col.key]}</td>`
        })
        tableBodyRows += `<tr>${row}</tr>`
    })
    return tableBodyRows
}



grist.onRecords((records) => {
    const mappedData = grist.mapColumnNames(records);
    document.getElementById('table_head').innerHTML = generateTableHeadColumns(TABLE_COLUMNS);
    console.log("ALL RECORDS ", mappedData);
    const tableRecords = generateTableRecordsFromGristRecords(mappedData, new Date('2026-01-27'));
    document.getElementById('table_body').innerHTML = generateTableBodyRows(tableRecords, TABLE_COLUMNS);
})

