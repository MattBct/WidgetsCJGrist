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

// Timestamp destiné au tri chronologique des lignes exportées.
function getTimestamp(gristDate) {
    if (!gristDate) return Number.MAX_SAFE_INTEGER;
    const dateObj = typeof gristDate === 'number' ? new Date(gristDate * 1000) : new Date(gristDate);
    return isNaN(dateObj.getTime()) ? Number.MAX_SAFE_INTEGER : dateObj.getTime();
}

// "2024-10-25" -> "25/10/2024"
function toFrenchDate(isoDate) {
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
}

// Le statut arrive en Choice (chaîne) ou en ChoiceList (tableau, éventuellement préfixé 'L').
function formatStatut(value) {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) {
        const items = value[0] === 'L' ? value.slice(1) : value;
        return items.map(item => String(item)).join(', ');
    }
    return String(value);
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

// Filtre de type de RDV : libellé pour les messages, suffixe pour le nom de fichier,
// mention ajoutée au titre de la feuille Excel.
const RDV_FILTERS = {
    both: { label: "", suffix: "", title: "" },
    rdv1: { label: " de type « RDV 1 (Initial) »", suffix: "_RDV1", title: " — RDV 1 (Initial)" },
    rdv2: { label: " de type « RDV 2 (Restitution) »", suffix: "_RDV2", title: " — RDV 2 (Restitution)" }
};

// 3. Période : la date de fin suit la date de début tant que l'utilisateur ne l'a pas
// fixée plus loin, ce qui rend l'export d'une journée unique immédiat.
const startDateInput = document.getElementById('startDateInput');
const endDateInput = document.getElementById('endDateInput');

startDateInput.addEventListener('change', () => {
    endDateInput.min = startDateInput.value;
    if (startDateInput.value && (!endDateInput.value || endDateInput.value < startDateInput.value)) {
        endDateInput.value = startDateInput.value;
    }
});

endDateInput.addEventListener('change', () => {
    if (endDateInput.value && !startDateInput.value) {
        startDateInput.value = endDateInput.value;
        endDateInput.min = endDateInput.value;
    }
});

// 4. Le libellé du bouton reflète le contenu réel de l'export
const rdvTypeSelect = document.getElementById('rdvTypeFilter');
const attachmentsCheckbox = document.getElementById('includeAttachments');
attachmentsCheckbox.addEventListener('change', () => {
    document.getElementById('exportBtn').textContent = attachmentsCheckbox.checked
        ? "Exporter (Excel + éventuelles pièces jointes)"
        : "Exporter (Excel seul)";
});

// 5. Logique de filtrage et d'exportation
document.getElementById('exportBtn').addEventListener('click', async () => {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    const includeAttachments = attachmentsCheckbox.checked;
    const rdvFilter = RDV_FILTERS[rdvTypeSelect.value] ? rdvTypeSelect.value : 'both';

    if (!startDate || !endDate) {
        alert("Veuillez d'abord sélectionner une date de début et une date de fin.");
        return;
    }

    if (endDate < startDate) {
        alert("La date de fin doit être postérieure ou égale à la date de début.");
        return;
    }

    // Les dates ISO (AAAA-MM-JJ) se comparent directement en tant que chaînes.
    const isInRange = isoDate => isoDate !== null && isoDate >= startDate && isoDate <= endDate;
    const isSingleDay = startDate === endDate;

    // Période : libellé pour les messages et le titre Excel, suffixe pour le nom de fichier.
    const periodLabel = isSingleDay
        ? `le ${toFrenchDate(startDate)}`
        : `la période du ${toFrenchDate(startDate)} au ${toFrenchDate(endDate)}`;
    const periodTitle = isSingleDay
        ? toFrenchDate(startDate)
        : `du ${toFrenchDate(startDate)} au ${toFrenchDate(endDate)}`;
    const periodFileName = isSingleDay ? startDate : `${startDate}_au_${endDate}`;
    const fileSuffix = RDV_FILTERS[rdvFilter].suffix;

    if (tableRecords.length === 0) {
        alert("Aucune donnée disponible. Assurez-vous d'avoir lié (mappé) les colonnes dans Grist.");
        return;
    }

    // --- A. Récupération des données pour l'Excel ---
    const exportData = [];
    const attachmentsByRdv = [];

    tableRecords.forEach(record => {
        // Tous les statuts sont exportés : le tri se fait dans Excel via le filtre de l'en-tête.
        const statut = formatStatut(record.statut);

        const d1 = getIsoDate(record.date1);
        const d2 = getIsoDate(record.date2);

        // Sur une période, le RDV 1 et le RDV 2 d'un même dossier peuvent tomber tous les
        // deux dans l'intervalle : chacun donne alors sa propre ligne.
        const matches = [];

        if (rdvFilter !== 'rdv2' && isInRange(d1)) {
            matches.push({ isoDate: d1, value: record.date1, lieu: record.lieu1, typeRdv: "RDV 1 (Initial)" });
        }
        if (rdvFilter !== 'rdv1' && isInRange(d2)) {
            matches.push({ isoDate: d2, value: record.date2, lieu: record.lieu2, typeRdv: "RDV 2 (Restitution)" });
        }

        if (matches.length === 0) return;

        const idRdv = record.idRdv || "";

        matches.forEach(match => {
            exportData.push({
                idRdv: idRdv,
                nomPatient: extractLabel(record.nomPatient),
                telephone: extractLabel(record.telephone),
                date: toFrenchDate(match.isoDate),
                heure: formatTime(match.value),
                lieu: extractLabel(match.lieu),
                motif: record.motif || "",
                clin1: "", clin2: "", clin3: "", clin4: "", clin5: "",
                typeRdv: match.typeRdv,
                statut: statut,
                // Clé de tri uniquement : sans colonne correspondante, ExcelJS l'ignore.
                sortKey: getTimestamp(match.value)
            });
        });

        if (!includeAttachments) return;

        // Une seule copie des pièces jointes par dossier, même si les deux RDV sont exportés.
        const attachmentIds = extractAttachmentIds(record.pieceJointe);
        if (attachmentIds.length > 0) {
            attachmentsByRdv.push({ idRdv: idRdv, ids: attachmentIds });
        }
    });

    if (exportData.length === 0) {
        alert(`Aucun rendez-vous${RDV_FILTERS[rdvFilter].label} trouvé pour ${periodLabel}.`);
        return;
    }

    // Ordre chronologique : indispensable dès que la période couvre plusieurs journées.
    exportData.sort((a, b) => a.sortKey - b.sortKey);

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
    // Sur une journée unique, la date figure déjà dans le titre : la colonne serait redondante.
    worksheet.columns = [
        { header: 'Identifiant RDV', key: 'idRdv', width: 20 },
        { header: 'Type de RDV', key: 'typeRdv', width: 22 },
        { header: 'Statut du RDV', key: 'statut', width: 18 },
        { header: 'Nom du patient', key: 'nomPatient', width: 25 },
        { header: 'Téléphone patient', key: 'telephone', width: 18 },
        isSingleDay ? null : { header: 'Date', key: 'date', width: 14 },
        { header: 'Heure', key: 'heure', width: 15 },
        { header: 'Lieu', key: 'lieu', width: 25 },
        { header: 'Motif', key: 'motif', width: 30 },
        { header: 'Clinicien 1', key: 'clin1', width: 20 },
        { header: 'Clinicien 2', key: 'clin2', width: 20 },
        { header: 'Clinicien 3', key: 'clin3', width: 20 },
        { header: 'Clinicien 4', key: 'clin4', width: 20 },
        { header: 'Clinicien 5', key: 'clin5', width: 20 },
        { header: 'Clinicien 6', key: 'clin6', width: 20 },
        { header: 'Commentaires', key: 'commentaires', width: 60, height: 40, style: { alignment: { wrapText: true } } }
    ].filter(Boolean);
    worksheet.getColumn('idRdv').color = {argb: 'FFC03737'};
    worksheet.getColumn('idRdv').bold = true;
    worksheet.getColumn('motif').alignment = { wrapText: true, vertical: 'top' };
    worksheet.getColumn('lieu').alignment = { wrapText: true, vertical: 'top' };

    // 2. Insérer 5 lignes vides au début (l'en-tête des colonnes passe donc à la ligne 6)
    worksheet.spliceRows(1, 0, [], [], [], [], []);

    // 3. Ajout du Titre personnalisé (date unique ou période, au format français)
    // Une cellule fusionnée tronque le texte au lieu de le laisser déborder : la plage doit
    // donc être assez large pour le titre, dont la longueur varie avec la période exportée.
    const titleText = `Export des RDV : ${periodTitle}${RDV_FILTERS[rdvFilter].title}`;
    const TITLE_FONT_SIZE = 24;
    const TITLE_START_COL = 4; // Colonne D : laisse la place au logo posé en A1.

    // Une unité de largeur Excel vaut environ un caractère de la police par défaut (11 pt) ;
    // un caractère de titre en occupe donc à peu près taille / 11.
    // Le facteur 1.1 est une marge : les caractères larges et le retrait interne d'une
    // cellule fusionnée suffiraient sinon à faire déborder un titre calculé au plus juste.
    const titleCharWidth = size => size * 0.085;
    const requiredWidth = titleText.length * titleCharWidth(TITLE_FONT_SIZE) * 1.1;

    let titleEndCol = TITLE_START_COL;
    let availableWidth = worksheet.getColumn(TITLE_START_COL).width || 10;
    while (availableWidth < requiredWidth && titleEndCol < worksheet.columns.length) {
        titleEndCol++;
        availableWidth += worksheet.getColumn(titleEndCol).width || 10;
    }

    // Titre exceptionnellement long : on réduit la police plutôt que de le tronquer.
    const titleFontSize = availableWidth >= requiredWidth
        ? TITLE_FONT_SIZE
        : Math.max(12, Math.floor(availableWidth / (titleText.length * 0.085)));

    worksheet.mergeCells(2, TITLE_START_COL, 3, titleEndCol);
    const titleCell = worksheet.getCell(2, TITLE_START_COL);
    titleCell.value = titleText; // Période + type de RDV exporté
    titleCell.font = {
        name: 'Montserrat',
        size: titleFontSize,
        color: { argb: 'FFC03737' },
        bold: true
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Hauteur suffisante pour la police du titre, réparties sur les deux lignes fusionnées.
    worksheet.getRow(2).height = titleFontSize;
    worksheet.getRow(3).height = titleFontSize * 0.6;
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

    // Filtre Excel sur la ligne d'en-tête : chaque colonne, dont « Statut du RDV »,
    // dispose de son menu déroulant de filtrage sur toute la plage de données.
    worksheet.autoFilter = {
        from: { row: 6, column: 1 },
        to: { row: 6 + exportData.length, column: worksheet.columns.length }
    };

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

    // --- F. GÉNÉRATION DU FICHIER (Excel seul ou archive ZIP) ---
    const exportBtn = document.getElementById('exportBtn');
    const originalBtnLabel = exportBtn.textContent;
    exportBtn.disabled = true;
    exportBtn.textContent = "Génération en cours...";

    try {
        const buffer = await workbook.xlsx.writeBuffer();

        // Sans pièces jointes, une archive ne contiendrait qu'un fichier : on livre l'Excel directement.
        if (!includeAttachments) {
            const xlsxBlob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            saveAs(xlsxBlob, `Export_RDV_CJ_${periodFileName}${fileSuffix}.xlsx`);
            return;
        }

        const zip = new JSZip();

        // 1. Le fichier Excel, à la racine de l'archive
        zip.file(`Export_RDV_CJ_${periodFileName}${fileSuffix}.xlsx`, buffer);

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
        saveAs(zipBlob, `RDV_CJ_${periodFileName}${fileSuffix}.zip`);

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
        console.error("Erreur lors de la génération de l'export : ", error);
        alert(includeAttachments
            ? "Une erreur est survenue lors de la génération de l'archive."
            : "Une erreur est survenue lors de la génération du fichier Excel.");
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = originalBtnLabel;
    }
});
