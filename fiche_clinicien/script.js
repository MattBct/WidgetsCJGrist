const COLUMNS_MAPPING = [
    {
        name: "nom",
        title: "Nom de famille",
        optional: false,
        type: "Text", 
        allowMultiple: false
    },
    {
        name: "prenom",
        title: "Prénom",
        optional: false,
        type: "Text", 
        allowMultiple: false
    },
    {
        name: "option",
        title: "Option",
        description: "Colonne décrivant si le clinicien est en option Clinique",
        type: "Bool",
        optional: false,
    },
    {
        name: "niveau",
        title: "Niveau",
        description: "Niveau (L3, M1, M2, Doctorat, etc.)",
        optional: false,
        type: "Choice", 
        allowMultiple: false
    },
    {
        name: "diplome",
        title: "Diplôme",
        description: "Parcours (Master uniquement)",
        optional: false,
        type: "Choice", 
        allowMultiple: false
    },
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
    {
        name: "liste_rdv",
        title: "Liste des rendez-vous",
        optional: false,
        type: "RefList",
        description: "Colonne contenant la liste des rendez-vous du clinicien",
    }

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