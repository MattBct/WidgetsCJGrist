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
        { name: "statut", type: "Choice", title: "Statut du RDV" }
    ]
});

// 2. Écoute des données envoyées par Grist
grist.onRecords(function(records) {
    const mappedRecords = grist.mapColumnNames(records);
    tableRecords = mappedRecords || records;
    console.log("Données chargées et mappées :", tableRecords);
});

/**
 * Fonction pour extraire la date au format YYYY-MM-DD
 */
function getIsoDate(gristDate) {
    if (!gristDate) return null;
    let dateObj = typeof gristDate === 'number' ? new Date(gristDate * 1000) : new Date(gristDate);
    if (isNaN(dateObj.getTime())) return null;
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

/**
 * Fonction pour extraire UNIQUEMENT l'heure (ex: "14:30")
 */
function formatTime(gristDate) {
    if (!gristDate) return "";
    let dateObj = typeof gristDate === 'number' ? new Date(gristDate * 1000) : new Date(gristDate);
    if (isNaN(dateObj.getTime())) return "";
    
    // Retourne l'heure au format local français avec juste les heures et minutes
    return dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Fonction pour extraire le Label d'une référence Grist
 */
function extractLabel(refValue) {
    if (refValue === null || refValue === undefined) return "";
    if (typeof refValue === 'object' && !Array.isArray(refValue)) {
        return refValue.Label !== undefined ? refValue.Label : JSON.stringify(refValue);
    }
    if (Array.isArray(refValue) && refValue.length > 1) {
        return refValue[1];
    }
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

    // Tableau qui contiendra les données finales pour l'Excel
    const exportData = [];

    // Filtrage et consolidation des données
    tableRecords.forEach(record => {
        // A. Vérification du statut
        const statutVal = record.statut;
        const isConfirmed = Array.isArray(statutVal) ? statutVal.includes("Confirmé") : statutVal === "Confirmé";
        if (!isConfirmed) return;

        // B. Extraction des dates
        const d1 = getIsoDate(record.date1);
        const d2 = getIsoDate(record.date2);
        
        let heureRetenue = "";
        let lieuRetenu = "";
        let matchFound = false;

        // C. Sélection de l'heure et du lieu en fonction du RDV correspondant à la date
        if (d1 === selectedDate) {
            heureRetenue = formatTime(record.date1);
            lieuRetenu = extractLabel(record.lieu1);
            matchFound = true;
        } else if (d2 === selectedDate) {
            heureRetenue = formatTime(record.date2);
            lieuRetenu = extractLabel(record.lieu2);
            matchFound = true;
        }

        // Si aucun des deux RDV ne tombe à cette date, on ignore la ligne
        if (!matchFound) return;

        // D. Ajout de la ligne consolidée
        exportData.push({
            idRdv: record.idRdv || "",
            heure: heureRetenue,
            lieu: lieuRetenu,
            motif: record.motif || ""
        });
    });

    if (exportData.length === 0) {
        alert("Aucun rendez-vous 'Confirmé' trouvé pour la date sélectionnée.");
        return;
    }

    // 4. Création du classeur et de la feuille avec ExcelJS
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rendez-vous');

    // Définition des nouvelles colonnes (plus de RDV 1 et RDV 2 séparés)
    worksheet.columns = [
        { header: 'Identifiant RDV', key: 'idRdv', width: 20 },
        { header: 'Heure', key: 'heure', width: 15 },
        { header: 'Lieu', key: 'lieu', width: 25 },
        { header: 'Motif', key: 'motif', width: 30 }
    ];

    // Style : Mettre la première ligne en gras
    worksheet.getRow(1).font = { bold: true };

    // Ajout des lignes consolidées
    exportData.forEach(data => {
        worksheet.addRow(data);
    });

    // 5. Génération du buffer et téléchargement
    try {
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        saveAs(blob, `Export_RDV_${selectedDate}.xlsx`);
    } catch (error) {
        console.error("Erreur lors de la création de l'Excel : ", error);
        alert("Une erreur est survenue lors de la génération du fichier.");
    }
});
