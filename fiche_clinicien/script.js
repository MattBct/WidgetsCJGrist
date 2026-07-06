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
        type: "Int", 
        description: "Colonne contenant le décompte total des heures du clinicien",
        allowMultiple: false
    },
    {
        name: "heures_rdv",
        title: "Heures de rendez-vous",
        optional: false,
        type: "Int", 
        description: "Colonne contenant le décompte des heures de rendez-vous du clinicien",
        allowMultiple: false
    },
    {
        name: "heures_projet",
        title: "Heures de projets",
        optional: false,
        type: "Int", 
        description: "Colonne contenant le décompte des heures de projets du clinicien",
        allowMultiple: false
    },
    {
        name: "heures_regul_credit",
        title: "Crédit d'heures (régulations)",
        optional: false,
        type: "Int",
        description: "Colonne contenant le décompte des heures de crédit (régulations) du clinicien",
        allowMultiple: false
    },
    {
        name: "heures_regul_debit",
        title: "Débit d'heures (régulations)",
        optional: false,
        type: "Int",
        description: "Colonne contenant le décompte des heures de débit (régulations) du clinicien",
        allowMultiple: false
    },
    {
        name: "heures_regul_net",
        title: "Net d'heures régulées",
        optional: false,
        type: "Int",
        description: "Colonne contenant le décompte du net d'heures régulées du clinicien",
        allowMultiple: false
    },
    {
        name: "nb_rdv",
        title: "Nombre de rendez-vous",
        optional: false,
        type: "Int",
        description: "Colonne contenant le décompte du nombre de rendez-vous du clinicien",
        allowMultiple: false
    }, 
    {
        name: "nb_projets",
        title: "Nombre de projets",
        optional: false,
        type: "Int",
        description: "Colonne contenant le décompte du nombre de projets du clinicien",
        allowMultiple: false
    }, 
    {
        name: "liste_rdv",
        title: "Liste des rendez-vous",
        optional: false,
        type: "RefList",
        description: "Colonne contenant la liste des rendez-vous du clinicien",
    },
    {
        name: "liste_projets",
        title: "Liste des projets",
        optional: false,
        type: "RefList",
        description: "Colonne contenant la liste des projets du clinicien",
    }, 
    {
        name: "liste_regulations",
        title: "Liste des régulations",
        optional: false,
        type: "RefList",
        description: "Colonne contenant la liste des régulations horaires concernant le clinicien",
    }, 
    {
        name: "nb_rdv_termines",
        title: "Nombre de RDV terminés",
        optional: false,
        type: "Int",
        description: "Colonne contenant le décompte du nombre de rendez-vous terminés du clinicien",
        allowMultiple: false
    }

]

const TABLE_ID_RDV = "RDV"
const TABLE_ID_PROJETS = "Projets"
const TABLE_ID_REGULATIONS = "Regulations_heures"

const COLUMN_MOTIF_RDV = "Motif_du_RDV"


function gristReady() {
    grist.ready({
    requiredAccess: 'full',
    columns: COLUMNS_MAPPING,
    allowSelectBy: true,
  });
}

gristReady()

async function fetchTableRDV(tableID, key_records_id, ids_to_fetch) {
    const table_rdv = await grist.docApi.fetchTable(tableID);

    const list_rdv = []
    for (const record of ids_to_fetch) {
        const index_record = table_rdv[key_records_id].indexOf(record);
        const row = {
            "id_rdv_clinique": table_rdv["id_rdv_clinique"][index_record],
            "creneau_rdv_1": table_rdv["Creneau_RDV_1"][index_record],
            "creneau_rdv_2": table_rdv["Creneau_RDV_2"][index_record],
            "statut_rdv": table_rdv["Statut_RDV"][index_record],
            "motif": table_rdv["Motif_du_RDV"][index_record],
            "heures_defaut": table_rdv["heures"][index_record],
        }
        list_rdv.push(row);
    }

    console.log('Liste RDV ', list_rdv)

    return list_rdv
}


async function fetchTableProjets(tableID, key_records_id, ids_to_fetch) {
    const table_projets = await grist.docApi.fetchTable(tableID);

    const list_projets = []
    for (const record of ids_to_fetch) {
        const index_record = table_projets[key_records_id].indexOf(record);
        const row = {
            "nom_projet": table_projets["Nom_du_projet"][index_record],
            "heures": table_projets["heures"][index_record],
        }
        list_projets.push(row);
    }

    console.log('Liste projets ', list_projets)
    return list_projets
}

async function fetchTableRegul(tableID, key_records_id, ids_to_fetch) {
    const table = await grist.docApi.fetchTable(tableID);

    const list_regul = []
    for (const record of ids_to_fetch) {
        const index_record = table[key_records_id].indexOf(record);
        const row = {
            "motif": table["Motif"][index_record],
            "heures": table["heures"][index_record],
        }
        list_regul.push(row);
    }

    console.log('Liste réguls ', list_regul)
    return list_regul
}


const mappedRecord = grist.onRecord(async (record) => {
    const records = grist.mapColumnNames(record);
    console.log('Mapped record:', records);

    
    Alpine.store('clinicien').rdv = await fetchTableRDV(TABLE_ID_RDV, "id", records["liste_rdv"]);
    Alpine.store('clinicien').projets = await fetchTableProjets(TABLE_ID_PROJETS, "id", records["liste_projets"]);
    Alpine.store('clinicien').regulations = await fetchTableRegul(TABLE_ID_REGULATIONS, "id", records["liste_regulations"]);

    Alpine.store('clinicien').label_prenom_nom = records.prenom + ' ' + records.nom
    Alpine.store('clinicien').label_formation = records.niveau + ' ' + records.diplome
    Alpine.store('clinicien').heures_totales = records.heures_totales
    Alpine.store('clinicien').heures_rdv = records.heures_rdv
    Alpine.store('clinicien').heures_projets = records.heures_projet
    Alpine.store('clinicien').heures_regul_credit = records.heures_regul_credit
    Alpine.store('clinicien').heures_regul_debit = records.heures_regul_debit
    Alpine.store('clinicien').heures_regul_net = records.heures_regul_net
    Alpine.store('clinicien').option = records.option
    Alpine.store('clinicien').nb_rdv = records.nb_rdv
    Alpine.store('clinicien').nb_projets = records.nb_projets
    Alpine.store('clinicien').nb_rdv_termines = records.nb_rdv_termines
    return records
})