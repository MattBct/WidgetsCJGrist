const COLUMNS_MAPPING = [
    {
        name: "heures_totales",
        title: "Heures totales",
        optional: false,
        type: "Number", 
        description: "Colonne contenant le décompte total des heures du clinicien",
        allowMultiple: false
    },
    {
        name: "heures_rdv",
        title: "Heures de rendez-vous",
        optional: false,
        type: "Number", 
        description: "Colonne contenant le décompte des heures de rendez-vous du clinicien",
        allowMultiple: false
    },
    {
        name: "heures_projet",
        title: "Heures de projets",
        optional: false,
        type: "Number", 
        description: "Colonne contenant le décompte des heures de projets du clinicien",
        allowMultiple: false
    },
    {
        name: "heures_regul_credit",
        title: "Crédit d'heures (régulations)",
        optional: false,
        type: "Number",
        description: "Colonne contenant le décompte des heures de crédit (régulations) du clinicien",
        allowMultiple: false
    },
    {
        name: "heures_regul_debit",
        title: "Débit d'heures (régulations)",
        optional: false,
        type: "Number",
        description: "Colonne contenant le décompte des heures de débit (régulations) du clinicien",
        allowMultiple: false
    },

]


function gristReady() {
    grist.ready({
    requiredAccess: 'full',
    columns: COLUMNS_MAPPING,
    allowSelectBy: true,
  });

  grist.onRecord((record) => {
    const mappedRecord = grist.mapColumnNames(record);
    console.log('Mapped record:', mappedRecord);
    return mappedRecord
  })
}

gristReady()