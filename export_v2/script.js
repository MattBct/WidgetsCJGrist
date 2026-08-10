// Variable globale pour stocker toutes les données de la table
let tableRecords = [];

// 1. Initialisation de Grist et configuration du mappage des colonnes
grist.ready({
    requiredAccess: 'read table',
    columns: [
        { name: "idRdv", type: "Text", title: "Identifiant du RDV" },
        { name: "date1", type: "DateTime", title: "Date et heure du RDV 1" },
        { name: "lieu1", type: "Text", title: "Lieu du RDV 1" },
        { name: "date2", type: "DateTime", title: "Date et heure du RDV 2" },
        { name: "lieu2", type: "Text", title: "Lieu du RDV 2" },
        { name: "motif", type: "Text", title: "Motif du RDV" }
    ]
});

// 2. Écoute des données envoyées par Grist (toutes les lignes mappées)
grist.onRecords(function(records) {
    tableRecords = records;
});

/**
 * Fonction utilitaire pour extraire uniquement la date (format YYYY-MM-DD)
 * à partir du format DateTime de Grist (qui est généralement un timestamp en secondes)
 */
function getIsoDateFromGristTimestamp(timestamp) {
    if (!timestamp) return null;
    
    // Grist stocke les DateTime en timestamp (secondes), on convertit en millisecondes
    const dateObj = typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(timestamp);
    
    if (isNaN(dateObj.getTime())) return null;
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// 3. Logique de filtrage et d'exportation au clic sur le bouton
document.getElementById('exportBtn').addEventListener('click', () => {
    const selectedDate = document.getElementById('dateInput').value;
    
    if (!selectedDate) {
        alert("Veuillez d'abord sélectionner une date.");
        return;
    }

    if (tableRecords.length === 0) {
        alert("Aucune donnée disponible. Veuillez vérifier le mappage des colonnes dans Grist.");
        return;
    }

    // Filtrage des enregistrements (Si Date 1 OU Date 2 correspond à la date sélectionnée)
    const filteredData = tableRecords.filter(record => {
        const d1 = getIsoDateFromGristTimestamp(record.date1);
        const d2 = getIsoDateFromGristTimestamp(record.date2);
        
        return d1 === selectedDate || d2 === selectedDate;
    });

    if (filteredData.length === 0) {
        alert("Aucun rendez-vous trouvé pour la date sélectionnée.");
        return;
    }

    // Formatage des données pour que les en-têtes Excel soient propres
    const exportData = filteredData.map(record => ({
        "Identifiant RDV": record.idRdv,
        "Date/Heure RDV 1": record.date1 ? new Date(record.date1 * 1000).toLocaleString('fr-FR') : "",
        "Lieu RDV 1": record.lieu1 || "",
        "Date/Heure RDV 2": record.date2 ? new Date(record.date2 * 1000).toLocaleString('fr-FR') : "",
        "Lieu RDV 2": record.lieu2 || "",
        "Motif": record.motif || ""
    }));

    // 4. Génération de l'Excel avec SheetJS
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    
    // Ajustement rapide de la largeur des colonnes
    worksheet['!cols'] = [
        { wch: 20 }, // ID
        { wch: 22 }, // Date 1
        { wch: 25 }, // Lieu 1
        { wch: 22 }, // Date 2
        { wch: 25 }, // Lieu 2
        { wch: 30 }  // Motif
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Rendez-vous");
    
    // Téléchargement
    XLSX.writeFile(workbook, `Export_RDV_${selectedDate}.xlsx`);
});
