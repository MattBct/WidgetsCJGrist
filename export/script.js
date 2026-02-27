const COLUMNS = [
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
            }
        ]

grist.ready(
    {
        requiredAccess: 'read table',
        columns: COLUMNS

    }
);
grist.onRecords((records) => {
    console.log(records)
})



const generateTableHeadColumns = (columns) => {
    let tableHeadColumns = ''
    columns.forEach(col => {
        tableHeadColumns += `<th>${col.title}</th>`
    })
    return tableHeadColumns
}

const generateTableBodyRows = (records) => {
    let tableBodyRows = ''
    records.forEach(record => {
        let row = ''
        COLUMNS.forEach(col => {
            row += `<td>${record[col.name]}</td>`
        })
        tableBodyRows += `<tr>${row}</tr>`
    })
    return tableBodyRows
}

document.getElementById('table_head').innerHTML = generateTableHeadColumns(COLUMNS);
document.getElementById('table_body').innerHTML = generateTableBodyRows(fakeData);