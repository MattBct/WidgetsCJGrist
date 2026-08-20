// Widget d'export des pièces jointes d'une colonne "Attachments".
// Récupère les fichiers via l'API Grist et les livre dans une archive ZIP.

// Lignes visibles de la table, normalisées : { rowId, label, attachmentIds }
let tableRows = [];
// Ligne sous le curseur, pour le mode « Ligne sélectionnée uniquement »
let selectedRowId = null;
// Mappings colonnes widget -> colonnes Grist, pour détecter une colonne non liée
let columnMappings = null;

// 1. Initialisation de Grist
// L'accès complet est nécessaire pour obtenir le jeton de téléchargement des pièces jointes.
grist.ready({
    requiredAccess: 'full',
    columns: [
        { name: "pieceJointe", type: "Attachments", title: "Colonne des pièces jointes" },
        { name: "libelle", type: "Any", title: "Étiquette de la ligne (nom du répertoire)", optional: true }
    ]
});

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

// L'étiquette peut venir d'une colonne Référence : on récupère alors son libellé visible.
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

// 2. Écoute des données envoyées par Grist
// mapColumnNames renvoie null tant que les colonnes obligatoires ne sont pas liées :
// on conserve alors les enregistrements bruts, dont l'identifiant reste exploitable.
grist.onRecords(function(records, mappings) {
    if (mappings) columnMappings = mappings;
    const mappedRecords = grist.mapColumnNames(records) || [];

    tableRows = records.map((record, index) => {
        const mapped = mappedRecords[index] || {};
        const label = extractLabel(mapped.libelle).trim();
        return {
            rowId: record.id,
            // Sans étiquette liée (ou vide), l'identifiant de ligne garantit un répertoire distinct.
            label: label !== "" ? label : `ligne_${record.id}`,
            attachmentIds: extractAttachmentIds(mapped.pieceJointe)
        };
    });

    refreshSummary();
});

// Le curseur alimente le mode « Ligne sélectionnée uniquement ».
grist.onRecord(function(record) {
    selectedRowId = record ? record.id : null;
    if (scopeSelect.value === 'selected') refreshSummary();
});

// 3. Interface
const scopeSelect = document.getElementById('scopeSelect');
const exportBtn = document.getElementById('exportBtn');
const summary = document.getElementById('summary');
const progressArea = document.getElementById('progressArea');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

// Lignes concernées par l'export, selon la portée choisie.
function getTargetRows() {
    if (scopeSelect.value === 'selected') {
        return tableRows.filter(row => row.rowId === selectedRowId);
    }
    return tableRows;
}

// Récapitulatif affiché en permanence : il évite de lancer un export vide.
function refreshSummary() {
    const isMapped = columnMappings && columnMappings.pieceJointe;
    if (!isMapped) {
        summary.textContent = "La colonne des pièces jointes n'est pas liée. Ouvrez le panneau de création du widget pour la mapper.";
        summary.classList.add('warning');
        return;
    }

    const rows = getTargetRows();
    const rowsWithFiles = rows.filter(row => row.attachmentIds.length > 0);
    const fileCount = rowsWithFiles.reduce((total, row) => total + row.attachmentIds.length, 0);

    if (scopeSelect.value === 'selected' && rows.length === 0) {
        summary.textContent = "Aucune ligne sélectionnée : cliquez sur une ligne de la table.";
        summary.classList.add('warning');
        return;
    }

    summary.classList.toggle('warning', fileCount === 0);
    if (fileCount === 0) {
        summary.textContent = `Aucune pièce jointe sur ${rows.length === 1 ? "la ligne sélectionnée" : `les ${rows.length} lignes concernées`}.`;
        return;
    }

    const fileLabel = fileCount === 1 ? "1 pièce jointe" : `${fileCount} pièces jointes`;
    const rowLabel = rowsWithFiles.length === 1 ? "1 ligne" : `${rowsWithFiles.length} lignes`;
    summary.textContent = `${fileLabel} à exporter, réparties sur ${rowLabel}.`;
}

scopeSelect.addEventListener('change', refreshSummary);

// 4. Export
exportBtn.addEventListener('click', async () => {
    if (!columnMappings || !columnMappings.pieceJointe) {
        alert("La colonne des pièces jointes n'est pas liée. Ouvrez le panneau de création du widget pour la mapper.");
        return;
    }

    const rows = getTargetRows().filter(row => row.attachmentIds.length > 0);
    const totalFiles = rows.reduce((total, row) => total + row.attachmentIds.length, 0);

    if (totalFiles === 0) {
        alert(scopeSelect.value === 'selected'
            ? "La ligne sélectionnée ne contient aucune pièce jointe."
            : "Aucune des lignes visibles ne contient de pièce jointe.");
        return;
    }

    const originalBtnLabel = exportBtn.textContent;
    exportBtn.disabled = true;
    exportBtn.textContent = "Export en cours...";
    progressArea.style.display = 'flex';
    progressBar.max = totalFiles;
    progressBar.value = 0;
    progressText.textContent = `0 / ${totalFiles} pièce(s) jointe(s) récupérée(s)`;

    // Un fichier par entrée : { folder, fileName, blob }, assemblés une fois tous les
    // téléchargements terminés (l'archive n'est utile que s'il reste plusieurs fichiers).
    const downloaded = [];
    const errors = [];

    try {
        const tokenInfo = await grist.docApi.getAccessToken({ readOnly: true });
        // Chaque répertoire dispose de son propre espace de noms.
        const usedNamesByFolder = new Map();

        for (const row of rows) {
            const folderName = sanitizeName(row.label);
            if (!usedNamesByFolder.has(folderName)) {
                usedNamesByFolder.set(folderName, new Set());
            }
            const usedNames = usedNamesByFolder.get(folderName);

            for (const attId of row.attachmentIds) {
                try {
                    const { blob, fileName } = await fetchAttachment(tokenInfo.baseUrl, tokenInfo.token, attId);
                    downloaded.push({
                        folder: folderName,
                        fileName: uniqueName(sanitizeName(fileName), usedNames),
                        blob: blob
                    });
                } catch (error) {
                    console.error(`Pièce jointe ${attId} (ligne « ${row.label} ») :`, error);
                    errors.push(`${row.label} (pièce jointe ${attId})`);
                }

                progressBar.value += 1;
                progressText.textContent = `${progressBar.value} / ${totalFiles} pièce(s) jointe(s) récupérée(s)`;
            }
        }

        if (downloaded.length === 0) {
            alert(`Aucune pièce jointe n'a pu être récupérée :\n- ${errors.join('\n- ')}`);
            return;
        }

        const today = new Date().toISOString().slice(0, 10);

        // Une archive d'un seul fichier n'apporte rien : on livre le fichier tel quel.
        if (downloaded.length === 1) {
            progressText.textContent = "Téléchargement du fichier...";
            saveAs(downloaded[0].blob, downloaded[0].fileName);
        } else {
            progressText.textContent = "Compression de l'archive...";
            const zip = new JSZip();
            downloaded.forEach(file => {
                zip.folder(file.folder).file(file.fileName, file.blob);
            });
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, `Pieces_jointes_${today}.zip`);
        }

        if (errors.length > 0) {
            alert(`L'export est terminé, mais ces pièces jointes n'ont pas pu être récupérées :\n- ${errors.join('\n- ')}`);
        }
    } catch (error) {
        console.error("Erreur lors de l'export des pièces jointes : ", error);
        alert("Une erreur est survenue lors de l'export des pièces jointes.");
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = originalBtnLabel;
        progressArea.style.display = 'none';
    }
});
