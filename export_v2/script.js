// Variable globale pour stocker toutes les données mappées de la table
let tableRecords = [];

// 1. Initialisation de Grist
grist.ready({
    requiredAccess: 'full', 
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
});

// Utilitaires de formatage
function getIsoDate(gristDate) {
    if (!gristDate) return null;
    let dateObj = typeof gristDate === 'number' ? new Date(gristDate * 1000) : new Date(gristDate);
    if (isNaN(dateObj.getTime())) return null;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTime(gristDate) {
    if (!gristDate) return "";
    let dateObj = typeof gristDate === 'number' ? new Date(gristDate * 1000) : new Date(gristDate);
    if (isNaN(dateObj.getTime())) return "";
    return dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

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

// 3. Logique de filtrage et d'exportation
document.getElementById('exportBtn').addEventListener('click', async () => {
    const selectedDate = document.getElementById('dateInput').value;
    
    if (!selectedDate) {
        alert("Veuillez d'abord sélectionner une date.");
        return;
    }

    if (tableRecords.length === 0) {
        alert("Aucune donnée disponible. Assurez-vous d'avoir lié (mappé) les colonnes dans Grist.");
        return;
    }

    // --- A. Récupération des données pour l'Excel ---
    const exportData = [];

    tableRecords.forEach(record => {
        const statutVal = record.statut;
        const isConfirmed = Array.isArray(statutVal) ? statutVal.includes("Confirmé") : statutVal === "Confirmé";
        if (!isConfirmed) return;

        const d1 = getIsoDate(record.date1);
        const d2 = getIsoDate(record.date2);
        
        let heureRetenue = "";
        let lieuRetenu = "";
        let matchFound = false;

        if (d1 === selectedDate) {
            heureRetenue = formatTime(record.date1);
            lieuRetenu = extractLabel(record.lieu1);
            matchFound = true;
        } else if (d2 === selectedDate) {
            heureRetenue = formatTime(record.date2);
            lieuRetenu = extractLabel(record.lieu2);
            matchFound = true;
        }

        if (!matchFound) return;

        exportData.push({
            idRdv: record.idRdv || "",
            heure: heureRetenue,
            lieu: lieuRetenu,
            motif: record.motif || "",
            clin1: "", clin2: "", clin3: "", clin4: "", clin5: ""
        });
    });

    if (exportData.length === 0) {
        alert("Aucun rendez-vous 'Confirmé' trouvé pour la date sélectionnée.");
        return;
    }

    // --- B. Récupération des cliniciens depuis Grist ---
    let cliniciensList = ["Aucun clinicien disponible"];
    try {
        const cliniciensTable = await grist.docApi.fetchTable('Cliniciens');
        if (cliniciensTable && cliniciensTable.Label) {
            const validLabels = cliniciensTable.Label.filter(label => label && String(label).trim() !== "");
            if (validLabels.length > 0) {
                cliniciensList = validLabels;
            }
        }
    } catch (error) {
        console.error("Erreur Cliniciens :", error);
    }

    // --- C. CRÉATION DU CLASSEUR ET MISE EN PAGE ---
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rendez-vous');

    // Feuille masquée pour les dropdowns
    const dropdownSheet = workbook.addWorksheet('DropdownData', { state: 'hidden' });
    cliniciensList.forEach((clin, index) => {
        dropdownSheet.getCell(`A${index + 1}`).value = clin;
    });

    // 1. Définition des colonnes (Cela crée l'en-tête par défaut sur la ligne 1)
    worksheet.columns = [
        { header: 'Identifiant RDV', key: 'idRdv', width: 20 },
        { header: 'Heure', key: 'heure', width: 15 },
        { header: 'Lieu', key: 'lieu', width: 25 },
        { header: 'Motif', key: 'motif', width: 30 },
        { header: 'Clinicien 1', key: 'clin1', width: 20 },
        { header: 'Clinicien 2', key: 'clin2', width: 20 },
        { header: 'Clinicien 3', key: 'clin3', width: 20 },
        { header: 'Clinicien 4', key: 'clin4', width: 20 },
        { header: 'Clinicien 5', key: 'clin5', width: 20 },
        { header: 'Clinicien 6', key: 'clin6', width: 20 }
    ];

    // 2. Insérer 5 lignes vides au début (l'en-tête des colonnes passe donc à la ligne 6)
    worksheet.spliceRows(1, 0, [], [], [], [], []);

    // 3. Ajout du Titre personnalisé
    const dateDuJour = new Date().toLocaleDateString('fr-FR');
    worksheet.mergeCells('D2:G3'); // Fusionne les cellules de la colonne D à G (Lignes 2 et 3) pour le titre
    const titleCell = worksheet.getCell('D2');
    titleCell.value = `Export des RDV : ${selectedDate}`;
    titleCell.font = {
        name: 'Montserrat',
        size: 24,
        color: { argb: 'FFC03737' }, // Le format ARGB d'Excel. FF (Opacité) + C03737
        bold: true
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // 4. Ajout de l'image
    const imagePath = 'LOGO_CJ.png'; 
    
    try {
        const response = await fetch(imagePath);
        const imageBuffer = await response.arrayBuffer();
        
        const imageId = workbook.addImage({
            buffer: imageBuffer,
            extension: 'png', // Changer en 'jpeg' si besoin
        });
        
        // tl = top-left (colonne 0, ligne 0 = A1). 
        // ext = taille de l'image générée en pixels (largeur, hauteur)
        worksheet.addImage(imageId, {
            tl: { col: 0, row: 0 }, 
            ext: { width: 125, height: 81 } 
        });
    } catch (error) {
        console.warn("Impossible de charger l'image. Vérifiez le chemin ou les règles CORS.", error);
    }

    // 5. Mettre l'en-tête du tableau (Ligne 6) en gras
    worksheet.getRow(6).font = { bold: true };

    // --- D. INSERTION DES DONNÉES ---
    exportData.forEach(data => {
        worksheet.addRow(data); // Ajoute automatiquement à la suite (donc à partir de la ligne 7)
    });

    // --- E. AJOUT DES LISTES DÉROULANTES ---
    const columnsWithDropdowns = ['E', 'F', 'G', 'H', 'I', 'J'];
    const dropdownFormula = `'DropdownData'!$A$1:$A$${cliniciensList.length}`;

    // Le tableau de données commence à la ligne 7.
    for (let i = 7; i <= exportData.length + 6; i++) {
        columnsWithDropdowns.forEach(col => {
            worksheet.getCell(`${col}${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [dropdownFormula]
            };
        });
    }

    // --- F. TÉLÉCHARGEMENT ---
    try {
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Export_RDV_CJ_${selectedDate}.xlsx`);
    } catch (error) {
        console.error("Erreur lors de la création de l'Excel : ", error);
        alert("Une erreur est survenue lors de la génération du fichier.");
    }
});
