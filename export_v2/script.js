// Variable globale pour stocker toutes les données mappées de la table
let tableRecords = [];

// 1. Initialisation de Grist
grist.ready({
    requiredAccess: 'full', 
    columns: [
        { name: "idRdv", type: "Any", title: "Identifiant du RDV" },
        { name: "nomPatient", type: "Any", title: "Nom du patient" },
        { name: "telephone", type: "Any", title: "Numéro de téléphone du patient" },
        { name: "date1", type: "Any", title: "Date et heure du RDV 1" },
        { name: "lieu1", type: "Any", title: "Lieu du RDV 1 (Référence)" },
        { name: "date2", type: "Any", title: "Date et heure du RDV 2" },
        { name: "lieu2", type: "Any", title: "Lieu du RDV 2 (Référence)" },
        { name: "motif", type: "Any", title: "Motif du RDV" },
        { name: "statut", type: "Choice", title: "Statut du RDV" },
        { name: "pieceJointe", type: "Attachments", title: "Pièce jointe patient", optional: true }
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

// Utilitaires pièces jointes
// Une colonne "Attachments" arrive sous la forme ['L', 12, 13] (liste d'identifiants).
function extractAttachmentIds(value) {
    if (!Array.isArray(value)) return [];
    const ids = value[0] === 'L' ? value.slice(1) : value;
    return ids.filter(id => Number.isInteger(id));
}

// Nettoie une chaîne pour l'utiliser comme nom de fichier ou de répertoire dans le ZIP.
function sanitizeName(name) {
    const cleaned = String(name).replace(/[\/\\:*?"<>|]/g, '_').trim();
    return cleaned === "" ? "sans_nom" : cleaned;
}

// Évite d'écraser deux pièces jointes portant le même nom dans un même répertoire.
function uniqueName(fileName, usedNames) {
    if (!usedNames.has(fileName)) {
        usedNames.add(fileName);
        return fileName;
    }
    const dotIndex = fileName.lastIndexOf('.');
    const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
    const ext = dotIndex > 0 ? fileName.slice(dotIndex) : "";
    let counter = 2;
    while (usedNames.has(`${base} (${counter})${ext}`)) counter++;
    const finalName = `${base} (${counter})${ext}`;
    usedNames.add(finalName);
    return finalName;
}

// Récupère le nom d'origine de la pièce jointe (l'API renvoie fileName, fileSize, timeUploaded).
async function fetchAttachmentFileName(baseUrl, token, attId) {
    try {
        const response = await fetch(`${baseUrl}/attachments/${attId}?auth=${token}`);
        if (!response.ok) return null;
        const meta = await response.json();
        return meta && meta.fileName ? meta.fileName : null;
    } catch (error) {
        return null;
    }
}

async function fetchAttachmentBlob(baseUrl, token, attId) {
    const response = await fetch(`${baseUrl}/attachments/${attId}/download?auth=${token}`);
    if (!response.ok) throw new Error(`Téléchargement impossible (HTTP ${response.status})`);
    return response.blob();
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
    const attachmentsByRdv = [];

    tableRecords.forEach(record => {
        const statutVal = record.statut;
        const isConfirmed = Array.isArray(statutVal) ? statutVal.includes("Confirmé") : statutVal === "Confirmé";
        if (!isConfirmed) return;

        const d1 = getIsoDate(record.date1);
        const d2 = getIsoDate(record.date2);
        
        let heureRetenue = "";
        let lieuRetenu = "";
        let typeRdv = "";
        let matchFound = false;

        if (d1 === selectedDate) {
            heureRetenue = formatTime(record.date1);
            lieuRetenu = extractLabel(record.lieu1);
            typeRdv = "RDV 1 (Initial)";
            matchFound = true;
        } else if (d2 === selectedDate) {
            heureRetenue = formatTime(record.date2);
            lieuRetenu = extractLabel(record.lieu2);
            typeRdv = "RDV 2 (Restitution)";
            matchFound = true;
        }

        if (!matchFound) return;

        const idRdv = record.idRdv || "";

        exportData.push({
            idRdv: idRdv,
            nomPatient: extractLabel(record.nomPatient),
            telephone: extractLabel(record.telephone),
            heure: heureRetenue,
            lieu: lieuRetenu,
            motif: record.motif || "",
            clin1: "", clin2: "", clin3: "", clin4: "", clin5: "",
            typeRdv: typeRdv
        });

        const attachmentIds = extractAttachmentIds(record.pieceJointe);
        if (attachmentIds.length > 0) {
            attachmentsByRdv.push({ idRdv: idRdv, ids: attachmentIds });
        }
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
        { header: 'Nom du patient', key: 'nomPatient', width: 25 },
        { header: 'Téléphone patient', key: 'telephone', width: 18 },
        { header: 'Heure', key: 'heure', width: 15 },
        { header: 'Lieu', key: 'lieu', width: 25 },
        { header: 'Motif', key: 'motif', width: 30 },
        { header: 'Clinicien 1', key: 'clin1', width: 20 },
        { header: 'Clinicien 2', key: 'clin2', width: 20 },
        { header: 'Clinicien 3', key: 'clin3', width: 20 },
        { header: 'Clinicien 4', key: 'clin4', width: 20 },
        { header: 'Clinicien 5', key: 'clin5', width: 20 },
        { header: 'Clinicien 6', key: 'clin6', width: 20 },
        { header: 'Type de RDV', key: 'typeRdv', width: 22 },
        { header: 'Commentaires', key: 'commentaires', width: 60, height: 40, style: { alignment: { wrapText: true } } }
    ];
    worksheet.getColumn('idRdv').color = {argb: 'FFC03737'};
    worksheet.getColumn('idRdv').bold = true;
    worksheet.getColumn('motif').alignment = { wrapText: true, vertical: 'top' };
    worksheet.getColumn('lieu').alignment = { wrapText: true, vertical: 'top' };

    // 2. Insérer 5 lignes vides au début (l'en-tête des colonnes passe donc à la ligne 6)
    worksheet.spliceRows(1, 0, [], [], [], [], []);

    // 3. Ajout du Titre personnalisé (avec la date au format français)
    const [year, month, day] = selectedDate.split('-'); // Découpe "2024-10-25" en ["2024", "10", "25"]
    const dateFrancaise = `${day}/${month}/${year}`;    // Recompose en "25/10/2024"

    worksheet.mergeCells('D2:G3'); 
    const titleCell = worksheet.getCell('D2');
    titleCell.value = `Export des RDV : ${dateFrancaise}`; // Utilisation de la date formatée
    titleCell.font = {
        name: 'Montserrat',
        size: 24,
        color: { argb: 'FFC03737' },
        bold: true
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getColumn('idRdv').font = { 
        color: { argb: 'FFC03737' }, 
        bold: true 
    };


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
    // Les lettres sont déduites des clés : elles se décalent si l'on ajoute des colonnes en amont.
    const columnsWithDropdowns = ['clin1', 'clin2', 'clin3', 'clin4', 'clin5', 'clin6']
        .map(key => worksheet.getColumn(key).letter);
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

    // --- F. CONSTRUCTION DE L'ARCHIVE ZIP ---
    const exportBtn = document.getElementById('exportBtn');
    const originalBtnLabel = exportBtn.textContent;
    exportBtn.disabled = true;
    exportBtn.textContent = "Génération en cours...";

    try {
        const zip = new JSZip();

        // 1. Le fichier Excel, à la racine de l'archive
        const buffer = await workbook.xlsx.writeBuffer();
        zip.file(`Export_RDV_CJ_${selectedDate}.xlsx`, buffer);

        // 2. Un répertoire par RDV disposant de pièces jointes
        const attachmentErrors = [];
        if (attachmentsByRdv.length > 0) {
            const tokenInfo = await grist.docApi.getAccessToken({ readOnly: true });
            const usedNamesByFolder = new Map();

            for (const entry of attachmentsByRdv) {
                const folderName = sanitizeName(entry.idRdv);
                const folder = zip.folder(folderName);
                if (!usedNamesByFolder.has(folderName)) {
                    usedNamesByFolder.set(folderName, new Set());
                }
                const usedNames = usedNamesByFolder.get(folderName);

                for (const attId of entry.ids) {
                    try {
                        const [fileName, blob] = await Promise.all([
                            fetchAttachmentFileName(tokenInfo.baseUrl, tokenInfo.token, attId),
                            fetchAttachmentBlob(tokenInfo.baseUrl, tokenInfo.token, attId)
                        ]);
                        const safeName = uniqueName(sanitizeName(fileName || `piece_jointe_${attId}`), usedNames);
                        folder.file(safeName, blob);
                    } catch (error) {
                        console.error(`Pièce jointe ${attId} (RDV ${entry.idRdv}) :`, error);
                        attachmentErrors.push(`${entry.idRdv} (pièce jointe ${attId})`);
                    }
                }
            }
        }

        // 3. Téléchargement de l'archive
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, `RDV_CJ_${selectedDate}.zip`);

        if (attachmentErrors.length > 0) {
            alert(`L'archive a été générée, mais ces pièces jointes n'ont pas pu être récupérées :\n- ${attachmentErrors.join('\n- ')}`);
        }
    } catch (error) {
        console.error("Erreur lors de la création de l'archive : ", error);
        alert("Une erreur est survenue lors de la génération de l'archive.");
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = originalBtnLabel;
    }
});
