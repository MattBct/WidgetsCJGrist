const COLUMNS_MAPPING = [
    {
        name: "num_dossier",
        title: "Numéro de dossier",
        description: "Identifiant du dossier à 5 caractères",
        optional: false,
        type: "Text",
        allowMultiple: false
    },
    {
        name: "identite_patient",
        title: "Identité du patient",
        description: "Prénom + nom",
        optional: false,
        type: "Text",
        allowMultiple: false
    },
    {
        name: "rdv_1",
        title: "Créneau RDV 1",
        description: "Créneau horaire du premier rendez-vous",
        optional: false,
        type: "DateTime",
        allowMultiple: false
    },
    {
        name: "rdv_2",
        title: "Créneau RDV 2",
        description: "Créneau horaire du second rendez-vous",
        optional: false,
        type: "DateTime",
        allowMultiple: false
    },
    {
        name: "lieu_rdv_1",
        title: "Lieu RDV 1",
        description: "Lieu du premier rendez-vous",
        optional: false,
        type: "Ref",
        allowMultiple: false
    },
    {
        name: "lieu_rdv_2",
        title: "Lieu RDV 2",
        description: "Lieu du deuxième rendez-vous",
        optional: false,
        type: "Ref",
        allowMultiple: false
    },
    {
        name: "telephone",
        title: "Téléphone",
        description: "Téléphone du patient",
        optional: false,
        type: "Text",
        allowMultiple: false
    },
    {
        name: "email",
        title: "Email",
        description: "Email du patient",
        optional: false,
        type: "Text",
        allowMultiple: false
    },
    {
        name: "motif",
        title: "Motif",
        description: "Motif du rendez-vous",
        optional: false,
        type: "Text",
        allowMultiple: false
    },
]

let globalMappedRecords = null

function gristTsToDate(ts) {
    if (ts === null || ts === undefined) return null
    return new Date(ts * 1000)
}

function dateToStr(d) {
    const annee = d.getFullYear()
    const mois = String(d.getMonth() + 1).padStart(2, '0')
    const jour = String(d.getDate()).padStart(2, '0')
    return `${annee}-${mois}-${jour}`
}

function timeToStr(d) {
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
}

function getRDVforDay(day, records) {
    if (!records) return []
    return records.filter(record => {
        const d1 = gristTsToDate(record.rdv_1)
        const d2 = gristTsToDate(record.rdv_2)
        return (d1 && dateToStr(d1) === day) || (d2 && dateToStr(d2) === day)
    })
}

function buildRows(records, day) {
    const rows = []
    records.forEach(record => {
        const d1 = gristTsToDate(record.rdv_1)
        if (d1 && dateToStr(d1) === day) {
            rows.push([
                record.num_dossier,
                timeToStr(d1),
                "1",
                record.lieu_rdv_1,
                record.identite_patient,
                record.telephone,
                record.email,
                record.motif
            ])
        }
        const d2 = gristTsToDate(record.rdv_2)
        if (d2 && dateToStr(d2) === day) {
            rows.push([
                record.num_dossier,
                timeToStr(d2),
                "2",
                record.lieu_rdv_2,
                record.identite_patient,
                record.telephone,
                record.email,
                record.motif
            ])
        }
    })
    rows.sort((a, b) => a[1].localeCompare(b[1]))
    return rows
}

const grid = new gridjs.Grid({
    columns: ["N°", "Heure", "I/R", "Lieu", "Patient", "Téléphone", "Email", "Motif"],
    data: []
})
grid.render(document.getElementById("wrapper"))

function refresh() {
    const day = document.getElementById('datePicker').value
    const matched = getRDVforDay(day, globalMappedRecords)
    const rows = buildRows(matched, day)
    grid.updateConfig({ data: rows }).forceRender()
}

document.getElementById('datePicker').value = dateToStr(new Date())
document.getElementById('datePicker').addEventListener('change', refresh)

grist.ready({
    requiredAccess: 'read table',
    columns: COLUMNS_MAPPING,
    allowSelectBy: true,
})

grist.onRecords((records) => {
    globalMappedRecords = grist.mapColumnNames(records)
    refresh()
})