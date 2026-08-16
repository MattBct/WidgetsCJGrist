// Variable globale pour stocker toutes les données mappées de la table
let tableRecords = [];
// Mappings colonnes widget -> colonnes Grist, pour détecter une colonne non liée
let columnMappings = null;

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
grist.onRecords(function(records, mappings) {
    if (mappings) columnMappings = mappings;
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
// onRecords décode les valeurs : une colonne "Attachments" arrive donc sous la forme [12, 13].
// On accepte aussi la forme encodée ['L', 12, 13] et un identifiant seul, par sécurité.
function extractAttachmentIds(value) {
    if (value === null || value === undefined || value === "") return [];

    let raw;
    if (Array.isArray(value)) {
        raw = value[0] === 'L' ? value.slice(1) : value;
    } else {
        raw = [value];
    }

    return raw
        .map(id => {
            if (typeof id === 'object' && id !== null) return Number(id.id);
            return Number(id);
        })
        .filter(id => Number.isInteger(id) && id > 0);
}

// Extensions de secours quand le nom d'origine est indisponible : un fichier sans
// extension ne s'ouvre pas correctement une fois extrait de l'archive.
const MIME_EXTENSIONS = {
    'application/pdf': '.pdf',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/heic': '.heic',
    'image/tiff': '.tiff',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'application/zip': '.zip',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx'
};

// Le nom d'origine peut venir de l'en-tête Content-Disposition (filename* ou filename).
function fileNameFromDisposition(header) {
    if (!header) return null;
    const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match) {
        try {
            return decodeURIComponent(utf8Match[1]);
        } catch (error) {
            // en-tête mal formé : on tente la forme simple ci-dessous
        }
    }
    const simpleMatch = header.match(/filename="?([^";]+)"?/i);
    return simpleMatch ? simpleMatch[1] : null;
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

// Télécharge une pièce jointe et détermine son nom.
// Le nom d'origine est cherché dans l'en-tête de la réponse, puis via l'endpoint de
// métadonnées ; en dernier recours on fabrique un nom à partir du type MIME.
async function fetchAttachment(baseUrl, token, attId) {
    const response = await fetch(`${baseUrl}/attachments/${attId}/download?auth=${token}`);
    if (!response.ok) {
        throw new Error(`Téléchargement impossible (HTTP ${response.status})`);
    }

    let fileName = fileNameFromDisposition(response.headers.get('content-disposition'));
    const blob = await response.blob();

    if (!fileName) {
        try {
            const metaResponse = await fetch(`${baseUrl}/attachments/${attId}?auth=${token}`);
            if (metaResponse.ok) {
                const meta = await metaResponse.json();
                if (meta && meta.fileName) fileName = meta.fileName;
            }
        } catch (error) {
            console.warn(`Métadonnées indisponibles pour la pièce jointe ${attId}`, error);
        }
    }

    if (!fileName) {
        const extension = MIME_EXTENSIONS[(blob.type || "").split(';')[0].trim()] || '.bin';
        fileName = `piece_jointe_${attId}${extension}`;
    }

    return { blob, fileName };
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
        let attachmentCount = 0;
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
                        const { blob, fileName } = await fetchAttachment(tokenInfo.baseUrl, tokenInfo.token, attId);
                        const safeName = uniqueName(sanitizeName(fileName), usedNames);
                        folder.file(safeName, blob);
                        attachmentCount++;
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

        // 4. Compte rendu : une archive sans pièce jointe doit s'expliquer.
        if (attachmentErrors.length > 0) {
            alert(`L'archive a été générée, mais ces pièces jointes n'ont pas pu être récupérées :\n- ${attachmentErrors.join('\n- ')}`);
        } else if (attachmentCount === 0) {
            const isMapped = columnMappings && columnMappings.pieceJointe;
            if (!isMapped) {
                alert("L'archive ne contient que le fichier Excel : la colonne « Pièce jointe patient » n'est pas liée. Ouvrez le panneau de création du widget pour la mapper.");
            } else {
                alert("L'archive ne contient que le fichier Excel : aucun des RDV exportés ne possède de pièce jointe.");
            }
        }
    } catch (error) {
        console.error("Erreur lors de la création de l'archive : ", error);
        alert("Une erreur est survenue lors de la génération de l'archive.");
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = originalBtnLabel;
    }
});
