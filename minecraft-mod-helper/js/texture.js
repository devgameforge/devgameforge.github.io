// script.js

const canvas = document.getElementById('pixel-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');

const sizeSelect = document.getElementById('size-select');
const colorPickerInput = document.getElementById('color-picker'); // Cet élément est maintenant redondant
const rgbPicker = document.getElementById('rgb-picker'); 
// Suppression des éléments Alpha :
// const alphaSlider = document.getElementById('alpha-slider');
// const alphaValueDisplay = document.getElementById('alpha-value');
const colorPreview = document.getElementById('color-preview'); 
const btnDownload = document.getElementById('btn-download');
const btnClear = document.getElementById('btn-clear'); 
const btnEyedropper = document.getElementById('btn-eyedropper'); 
const btnUndo = document.getElementById('btn-undo'); 
const btnZoomIn = document.getElementById('btn-zoom-in'); 
const btnZoomOut = document.getElementById('btn-zoom-out'); 
const zoomLevelDisplay = document.getElementById('zoom-level'); 
const canvasViewport = document.querySelector('.canvas-viewport'); 


let history = []; // Tableau pour stocker les états du canvas
let historyIndex = -1; // Index de l'état actuel dans l'historique
const MAX_HISTORY = 15; // Limite pour éviter la consommation excessive de mémoire

// Outils
const tools = {
    brush: document.getElementById('btn-brush'),
    bucket: document.getElementById('btn-bucket'),
    eraser: document.getElementById('btn-eraser'),
    eyedropper: btnEyedropper 
};

// État
let currentSize = 16; // Taille initiale du canvas
let currentRGB = '#79e68a'; // Couleur sans transparence (HEX)
// Suppression de la variable de transparence :
// let currentAlpha = 1.0; 
let currentColor = '#79e68a'; // Couleur finale pour le dessin (HEX)
let currentTool = 'brush';
let isDrawing = false;
let zoomLevel = 1.0; // 1.0 = 100%
const BASE_DISPLAY_SIZE = 512; // La taille d'affichage de base (100%)

function init() {
    resizeCanvas(currentSize);
    updateZoomDisplay();
    setupEvents();
    updateFinalColor(); // Initialise currentColor avec currentRGB
    saveState(); // Sauvegarde l'état initial (canvas vide)
}

// --- Gestion du Zoom ---

function setZoom(level) {
    // Limites du zoom (entre 10% et 500%)
    if (level < 0.1) level = 0.1;
    if (level > 5.0) level = 5.0;

    zoomLevel = level;

    // Calcul de la nouvelle taille CSS
    const newSizeCSS = Math.floor(BASE_DISPLAY_SIZE * zoomLevel) + 'px';

    // On applique la taille CSS aux deux canvas
    canvas.style.width = newSizeCSS;
    canvas.style.height = newSizeCSS;
    bgCanvas.style.width = newSizeCSS;
    bgCanvas.style.height = newSizeCSS;

    updateZoomDisplay();
}

function updateZoomDisplay() {
    zoomLevelDisplay.textContent = Math.round(zoomLevel * 100) + '%';
}

// --- Fonctions Canvas existantes ---

function resizeCanvas(size) {
    currentSize = parseInt(size);
    canvas.width = currentSize;
    canvas.height = currentSize;
    bgCanvas.width = currentSize;
    bgCanvas.height = currentSize;
    drawCheckerboard();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Réappliquer le zoom actuel sur la nouvelle taille
    setZoom(zoomLevel);
}

function drawCheckerboard() {
    for (let x = 0; x < currentSize; x++) {
        for (let y = 0; y < currentSize; y++) {
            if ((x + y) % 2 === 0) bgCtx.fillStyle = '#2a2a2a';
            else bgCtx.fillStyle = '#333333';
            bgCtx.fillRect(x, y, 1, 1);
        }
    }
}

function clearCanvas() {
    saveState(); // Sauvegarde l'état NON vide
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Efface
    saveState(); // Sauvegarde l'état VIDE après clear
}

// --- Events ---

function setupEvents() {
    sizeSelect.addEventListener('change', (e) => {
        resizeCanvas(e.target.value);
    });

    // Suppression de l'écouteur du colorPickerInput s'il était utilisé pour une chaîne RGBA
    // On se base uniquement sur rgbPicker (HEX)
    // colorPickerInput.addEventListener('input', (e) => currentColor = e.target.value);

    rgbPicker.addEventListener('input', (e) => {
        currentRGB = e.target.value;
        updateFinalColor();
    });

    // Suppression de l'écouteur pour alphaSlider :
    // alphaSlider.addEventListener('input', (e) => {
    //     currentAlpha = parseFloat(e.target.value);
    //     updateFinalColor();
    // });

    Object.keys(tools).forEach(key => {
        tools[key].addEventListener('click', () => {
            document.querySelector('.tool-btn.active').classList.remove('active');
            tools[key].classList.add('active');
            currentTool = key;
        });
    });

    // Bouton Clear
    btnClear.addEventListener('click', clearCanvas);

    btnUndo.addEventListener('click', undo);

    // Boutons Zoom
    btnZoomIn.addEventListener('click', () => setZoom(zoomLevel + 0.25));
    btnZoomOut.addEventListener('click', () => setZoom(zoomLevel - 0.25));

    // Zoom avec la molette de la souris sur la zone de dessin
    canvasViewport.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) { // Standard UX: Ctrl + Molette pour zoomer
            e.preventDefault();
            if (e.deltaY < 0) {
                setZoom(zoomLevel + 0.1);
            } else {
                setZoom(zoomLevel - 0.1);
            }
        }
    });

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    btnDownload.addEventListener('click', exportCanvas);
}

// --- Logique Dessin & Export (Reste identique) ---
function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: Math.floor((evt.clientX - rect.left) * scaleX),
        y: Math.floor((evt.clientY - rect.top) * scaleY)
    };
}

function stopDrawing() {
    if (isDrawing && (currentTool === 'brush' || currentTool === 'eraser')) {
        // On sauvegarde seulement si un tracé a été fait par glissement
        saveState();
    }
    isDrawing = false;
}

// 3. Modifiez `startDrawing` :
function startDrawing(e) {
    isDrawing = true;
    useTool(e);
    // Si c'est une action simple (click, bucket), on sauvegarde immédiatement
    if (currentTool === 'bucket') {
        saveState();
    }
}
function draw(e) { if (!isDrawing || currentTool === 'bucket') return; useTool(e); }

/**
 * Logique principale pour l'utilisation de l'outil sélectionné (pinceau, gomme, seau, pipette).
 *
 * Dépendances (non fournies ici) :
 * - getMousePos(e)
 * - ctx (contexte du canvas)
 * - currentTool, currentColor
 * - saveState()
 * - fillArea()
 * - rgbToHex()
 * - rgbPicker, updateFinalColor()
 */
function useTool(e) {
    const pos = getMousePos(e);
    const x = pos.x; const y = pos.y;
    let actionTaken = false; // Indicateur pour savoir si l'état doit être sauvegardé

    if (currentTool === 'brush') {
        // Le pinceau est souvent utilisé en mode 'drag', la sauvegarde doit être gérée
        // soit à la fin du drag (mouseup), soit pour chaque pixel si le drag est lent.
        // Ici, on dessine juste le pixel.
        ctx.fillStyle = currentColor; // currentColor est maintenant HEX
        ctx.fillRect(x, y, 1, 1);
        actionTaken = true;
    } else if (currentTool === 'eraser') {
        ctx.clearRect(x, y, 1, 1);
        actionTaken = true;
    } else if (currentTool === 'bucket' && e.type === 'mousedown') {
        // Appel de la fonction corrigée
        fillArea(x, y, currentColor); // currentColor est maintenant HEX
        actionTaken = true;
    } else if (currentTool === 'eyedropper') {
        if (e.type === 'mousedown') {
            // Récupérer les données RGBA du pixel
            const pixelData = ctx.getImageData(x, y, 1, 1).data;
            const r = pixelData[0];
            const g = pixelData[1];
            const b = pixelData[2];
            const a = pixelData[3]; // L'alpha est toujours lu mais n'est pas utilisé pour la couleur

            // Si le pixel est complètement transparent (a=0), on ignore l'action
            if (a === 0) {
                console.log("Pixel transparent détecté. Couleur non changée.");
                return;
            }

            // Suppression de la gestion Alpha :
            // const alpha = a / 255;
            currentRGB = rgbToHex(r, g, b);
            // currentAlpha = alpha; // Supprimé

            rgbPicker.value = currentRGB; // Sélecteur natif
            // alphaSlider.value = currentAlpha; // Supprimé

            updateFinalColor(); // Met à jour currentColor à partir de currentRGB (HEX)
            
            // Revenir automatiquement au pinceau après avoir sélectionné la couleur
            currentTool = 'brush';
            document.querySelector('.tool-btn.active').classList.remove('active');
            // Assurez-vous que 'tools' est défini et que 'tools.brush' est accessible
            if (typeof tools !== 'undefined' && tools.brush) {
                tools.brush.classList.add('active');
            } else {
                console.error("L'objet 'tools' ou 'tools.brush' n'est pas défini pour activer le pinceau.");
            }
        }
    }

    // Gestion de la sauvegarde de l'état (Undo/Redo)
    // On sauvegarde l'état à la fin de l'action mousedown pour le seau.
    if (actionTaken && e.type === 'mousedown') {
        saveState();
    }
}


/**
 * Implémentation de l'algorithme "Flood Fill" (Remplissage par Débordement).
 * Utilise uniquement les couleurs RGB opaques.
 *
 * @param {number} startX - Coordonnée X de départ.
 * @param {number} startY - Coordonnée Y de départ.
 * @param {string} fillColor - La couleur de remplissage en format HEX (#rrggbb).
 */
function fillArea(startX, startY, fillColor) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const getPixelColor = (x, y) => {
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
        const index = (y * canvas.width + x) * 4;
        // Retourne les composantes RGB et A
        return { r: imgData.data[index], g: imgData.data[index + 1], b: imgData.data[index + 2], a: imgData.data[index + 3] };
    };

    // 1. Détermination de la couleur cible (celle à remplacer)
    const targetColor = getPixelColor(startX, startY);

    // 2. Préparation de la couleur de remplissage (en RGBA 0-255)
    // Utilise la couleur HEX fournie et force l'opacité (a) à 255 (opaque).
    const r = parseInt(fillColor.slice(1, 3), 16);
    const g = parseInt(fillColor.slice(3, 5), 16);
    const b = parseInt(fillColor.slice(5, 7), 16);
    const a = 255; 

    // ********* CORRECTION DE LA BOUCLE INFINIE ICI *********
    // Vérification basée sur RGB et opacité (qui est toujours 255 pour le seau sans transparence)
    if (targetColor.r === r && targetColor.g === g && targetColor.b === b && targetColor.a === a) {
        console.log("Couleur cible déjà identique à la couleur de remplissage. Arrêt pour éviter la boucle infinie.");
        return;
    }
    // *******************************************************

    const stack = [[startX, startY]];

    while (stack.length) {
        const [x, y] = stack.pop();
        const currentColor = getPixelColor(x, y);

        if (!currentColor) continue;

        // On vérifie si la couleur courante correspond à la couleur cible originale (RGB+A)
        if (currentColor.r === targetColor.r && currentColor.g === targetColor.g && currentColor.b === targetColor.b && currentColor.a === targetColor.a) {
            const index = (y * canvas.width + x) * 4;
            
            // 3. Application de la nouvelle couleur dans le tableau de données
            imgData.data[index] = r;
            imgData.data[index + 1] = g;
            imgData.data[index + 2] = b;
            imgData.data[index + 3] = a; // Forcé à 255 (opaque)

            // 4. Ajout des voisins à la pile
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
    }

    // 5. Mise à jour du canvas
    ctx.putImageData(imgData, 0, 0);
}

/**
 * Sauvegarde l'état actuel du canvas dans l'historique.
 */
function saveState() {
    // 1. Si nous sommes revenus en arrière, purger les états "futurs"
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }

    // 2. Récupérer l'image du canvas au format DataURL
    const dataUrl = canvas.toDataURL();

    // 3. Ajouter à l'historique
    history.push(dataUrl);

    // 4. Limiter la taille de l'historique
    if (history.length > MAX_HISTORY) {
        history.shift(); // Supprime le plus ancien état
    } else {
        historyIndex++;
    }

    updateUndoButtonState();
}

/**
 * Charge un état précédent et le dessine sur le canvas.
 */
function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        const dataUrl = history[historyIndex];

        // Charger l'image DataURL et la dessiner sur le canvas
        const img = new Image();
        img.onload = function () {
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Efface l'état actuel
            ctx.drawImage(img, 0, 0); // Dessine l'état précédent
        };
        img.src = dataUrl;

        updateUndoButtonState();
    }
}

/**
 * Met à jour l'état (actif/inactif) du bouton Annuler.
 */
function updateUndoButtonState() {
    btnUndo.disabled = historyIndex <= 0;
}

function exportCanvas() {
    const link = document.createElement('a');
    link.download = `texture_${currentSize}x${currentSize}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

/**
 * Convertit une couleur RGBA en format hexadécimal (#RRGGBB).
 * @param {number} r - Rouge (0-255)
 * @param {number} g - Vert (0-255)
 * @param {number} b - Bleu (0-255)
 * @returns {string} Couleur HEX
 */
function rgbToHex(r, g, b) {
    // S'assurer que les valeurs sont entre 0 et 255
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));

    const componentToHex = (c) => {
        const hex = c.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };

    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

/**
 * Met à jour la couleur finale.
 * Ne gère plus l'alpha. currentColor est maintenant toujours en HEX.
 */
function updateFinalColor() {
    // La couleur finale est simplement la couleur RGB (HEX)
    currentColor = currentRGB;

    // Mise à jour de l'aperçu
    colorPreview.style.backgroundColor = currentColor;
    
    // Mettre à jour l'input text/color natif (si rgbPicker est le seul élément)
    colorPickerInput.value = currentRGB; 
}

init();