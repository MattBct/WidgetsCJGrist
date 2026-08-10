// Variable globale pour stocker toutes les données mappées de la table
let tableRecords = [];

// 1. Initialisation de Grist et configuration du mappage
grist.ready({
    requiredAccess: 'read table',
    columns: [
        { name: "idRdv", type: "Any", title: "Identifiant du RDV" },
        { name: "date1", type: "Any", title: "Date et heure du RDV 1" },
        { name: "lieu1", type: "Any", title: "Lieu du RDV 1 (Référence)" },
        { name: "date2", type: "Any", title: "Date et heure du RDV 2" },
        { name: "lieu2", type: "Any", title: "Lieu du RDV 2 (Référence)" },
        { name: "motif", type: "Any", title: "Motif du RDV" },
        { name: "statut", type: "Choice", title: "Statut du RDV" } // Nouvelle colonne Choice
    ]
});

// 2. Écoute des données envoyées par Grist
grist.onRecords(function(records) {
    // CRUCIAL : Mappe les ID de colonnes Grist vers nos noms (date1, lieu1, statut, etc.)
    const mappedRecords = grist.mapColumnNames(records);
    
    // Si le mapping réussit, on l'utilise. Sinon, on garde les données brutes
    tableRecords = mappedRecords || records;
    
    console.log("Données chargées et mappées :", tableRecords);
});

/**
 * Fonction pour extraire la date au format YYYY-MM-DD
 * Gère les timestamps de Grist ou les formats textes
 */
function getIsoDate(gristDate) {
    if (!gristDate) return null;
    
    let dateObj;
    if (typeof gristDate === 'number') {
        dateObj = new Date(gristDate * 1000); // Grist utilise des secondes
    } else {
        dateObj = new Date(gristDate);
    }
    
    if (isNaN(dateObj.getTime())) return null;
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

/**
 * Fonction pour formater proprement l'heure pour l'export Excel
 */
function formatDateTime(gristDate) {
    if (!gristDate) return "";
    let dateObj = typeof gristDate === 'number' ? new Date(gristDate * 1000) : new Date(gristDate);
    if (isNaN(dateObj.getTime())) return "";
    return dateObj.toLocaleString('fr-FR');
}

/**
 * Fonction pour extraire le Label d'une référence Grist
 */
function extractLabel(refValue) {
    if (refValue === null || refValue === undefined) return "";
    
    // Si Grist renvoie un objet brut contenant la propriété Label
    if (typeof refValue === 'object' && !Array.isArray(refValue)) {
        return refValue.Label !== undefined ? refValue.Label : JSON.stringify(refValue);
    }
    
    // Si Grist renvoie un tuple de référence [rowId, "Label"]
    if (Array.isArray(refValue) && refValue.length > 1) {
        return refValue[1];
    }
    
    // Format chaîne classique
    return String(refValue);
}

// 3. Logique de filtrage et d'exportation avec ExcelJS
document.getElementById('exportBtn').addEventListener('click', async () => {
    const selectedDate = document.getElementById('dateInput').value;
    
    if (!selectedDate) {
        alert("Veuillez d'abord sélectionner une date.");
        return;
    }

    if (tableRecords.length === 0) {
        alert("Aucune donnée disponible. Assurez-vous d'avoir lié (mappé) les colonnes dans le panneau Grist.");
        return;
    }

    // Filtrage des données
    const filteredData = tableRecords.filter(record => {
        // A. Vérification du statut (Doit être exactement "Confirmé")
        // Gère le cas où le ChoiceList Grist enverrait un tableau
        const statutVal = record.statut;
        const isConfirmed = Array.isArray(statutVal) ? statutVal.includes("Confirmé") : statutVal === "Confirmé";
        
        if (!isConfirmed) return false;

        // B. Vérification des dates
        const d1 = getIsoDate(record.date1);
        const d2 = getIsoDate(record.date2);
        
        return d1 === selectedDate || d2 === selectedDate;
    });

    if (filteredData.length === 0) {
        alert("Aucun rendez-vous 'Confirmé' trouvé pour la date sélectionnée.");
        return;
    }

    // 4. Création du classeur et de la feuille avec ExcelJS
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rendez-vous');

    // Définition des colonnes
    worksheet.columns = [
        { header: 'Identifiant RDV', key: 'idRdv', width: 20 },
        { header: 'Date/Heure RDV 1', key: 'date1', width: 22 },
        { header: 'Lieu RDV 1', key: 'lieu1', width: 25 },
        { header: 'Date/Heure RDV 2', key: 'date2', width: 22 },
        { header: 'Lieu RDV 2', key: 'lieu2', width: 25 },
        { header: 'Motif', key: 'motif', width: 30 }
    ];

    // Style : Mettre la première ligne en gras
    worksheet.getRow(1).font = { bold: true };

    // Ajout des lignes formatées
    filteredData.forEach(record => {
        worksheet.addRow({
            idRdv: record.idRdv || "",
            date1: formatDateTime(record.date1),
            lieu1: extractLabel(record.lieu1),
            date2: formatDateTime(record.date2),
            lieu2: extractLabel(record.lieu2),
            motif: record.motif || ""
        });
    });

    // 5. Génération du buffer et téléchargement
    try {
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        saveAs(blob, `Export_RDV_Confirmes_${selectedDate}.xlsx`);
    } catch (error) {
        console.error("Erreur lors de la création de l'Excel : ", error);
        alert("Une erreur est survenue lors de la génération du fichier.");
    }
});
