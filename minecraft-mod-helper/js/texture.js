// script.js

const canvas = document.getElementById('pixel-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');

const sizeSelect = document.getElementById('size-select');
// Éléments du nouveau Color Picker
const rgbPicker = document.getElementById('rgb-picker'); 
const colorPreview = document.getElementById('color-preview'); 
const hexOutput = document.getElementById('hex-output'); // Nouveau
// Fin nouveaux éléments
const btnDownload = document.getElementById('btn-download');
const btnClear = document.getElementById('btn-clear'); 
const btnEyedropper = document.getElementById('btn-eyedropper'); 
const btnUndo = document.getElementById('btn-undo'); 
const btnZoomIn = document.getElementById('btn-zoom-in'); 
const btnZoomOut = document.getElementById('btn-zoom-out'); 
const zoomLevelDisplay = document.getElementById('zoom-level'); 
const canvasViewport = document.querySelector('.canvas-viewport'); 

let history = []; 
let historyIndex = -1; 
const MAX_HISTORY = 15; 

// Outils
const tools = {
    brush: document.getElementById('btn-brush'),
    bucket: document.getElementById('btn-bucket'),
    eraser: document.getElementById('btn-eraser'),
    eyedropper: btnEyedropper 
};

// État
let currentSize = 16; 
let currentRGB = '#79e68a'; // Couleur sans transparence (HEX)
let currentColor = '#79e68a'; // Couleur finale pour le dessin (HEX)
let currentTool = 'brush';
let isDrawing = false;
let zoomLevel = 1.0; 
const BASE_DISPLAY_SIZE = 512; 

function init() {
    resizeCanvas(currentSize);
    updateZoomDisplay();
    setupEvents();
    updateFinalColor(); // Initialise currentColor
    updateColorPicker(currentRGB); // Initialise l'affichage du Color Picker
    saveState();
}

// --- NOUVELLES FONCTIONS DE COULEUR ---

/**
 * Met à jour l'aperçu (cercle) et le code HEX affiché.
 * @param {string} newColor Le code HEX de la nouvelle couleur.
 */
function updateColorPicker(newColor) {
    // 1. Mettre à jour l'aperçu (le cercle)
    colorPreview.style.backgroundColor = newColor;

    // 2. Mettre à jour le texte du code HEX
    hexOutput.textContent = newColor.toUpperCase();

    // 3. Mettre à jour la valeur de l'input natif au cas où la couleur vienne d'ailleurs (pipette)
    rgbPicker.value = newColor;
}

/**
 * Met à jour la couleur finale de dessin et l'état du Color Picker.
 * Ne gère plus l'alpha. currentColor est maintenant toujours en HEX.
 */
function updateFinalColor() {
    currentColor = currentRGB; // La couleur finale est simplement la couleur RGB (HEX)
    updateColorPicker(currentRGB); // Mise à jour de l'affichage du composant
}

// --- Gestion du Zoom (Fonctions existantes inchangées) ---
function setZoom(level) {
    if (level < 0.1) level = 0.1;
    if (level > 5.0) level = 5.0;

    zoomLevel = level;

    const newSizeCSS = Math.floor(BASE_DISPLAY_SIZE * zoomLevel) + 'px';

    canvas.style.width = newSizeCSS;
    canvas.style.height = newSizeCSS;
    bgCanvas.style.width = newSizeCSS;
    bgCanvas.style.height = newSizeCSS;

    updateZoomDisplay();
}

function updateZoomDisplay() {
    zoomLevelDisplay.textContent = Math.round(zoomLevel * 100) + '%';
}

// --- Fonctions Canvas existantes (Inchangées) ---

function resizeCanvas(size) {
    currentSize = parseInt(size);
    canvas.width = currentSize;
    canvas.height = currentSize;
    bgCanvas.width = currentSize;
    bgCanvas.height = currentSize;
    drawCheckerboard();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
    saveState();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveState();
}

// --- Events (Mise à jour) ---

function setupEvents() {
    sizeSelect.addEventListener('change', (e) => {
        resizeCanvas(e.target.value);
    });

    // --- Gestion de l'Input Couleur ---
    rgbPicker.addEventListener('input', (e) => {
        currentRGB = e.target.value;
        updateFinalColor(); // Met à jour currentColor et l'affichage du picker
    });

    // --- Gestion des Outils (Inchangée) ---
    Object.keys(tools).forEach(key => {
        tools[key].addEventListener('click', () => {
            document.querySelector('.tool-btn.active').classList.remove('active');
            tools[key].classList.add('active');
            currentTool = key;
        });
    });

    // ... (Reste des écouteurs d'événements : clear, undo, zoom, canvas)
    btnClear.addEventListener('click', clearCanvas);
    btnUndo.addEventListener('click', undo);
    btnZoomIn.addEventListener('click', () => setZoom(zoomLevel + 0.25));
    btnZoomOut.addEventListener('click', () => setZoom(zoomLevel - 0.25));
    canvasViewport.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) { 
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

// --- Logique Dessin & Pipette (Légères mises à jour) ---

// Les fonctions startDrawing, draw, stopDrawing, getMousePos sont inchangées.
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
        saveState();
    }
    isDrawing = false;
}
function startDrawing(e) {
    isDrawing = true;
    useTool(e);
    if (currentTool === 'bucket' || currentTool === 'eyedropper') {
        saveState();
    }
}
function draw(e) { if (!isDrawing || currentTool === 'bucket' || currentTool === 'eyedropper') return; useTool(e); }

function useTool(e) {
    const pos = getMousePos(e);
    const x = pos.x; const y = pos.y;
    let actionTaken = false; 

    if (currentTool === 'brush') {
        ctx.fillStyle = currentColor;
        ctx.fillRect(x, y, 1, 1);
        actionTaken = true;
    } else if (currentTool === 'eraser') {
        ctx.clearRect(x, y, 1, 1);
        actionTaken = true;
    } else if (currentTool === 'bucket' && e.type === 'mousedown') {
        fillArea(x, y, currentColor);
        actionTaken = true;
    } else if (currentTool === 'eyedropper') {
        if (e.type === 'mousedown') {
            const pixelData = ctx.getImageData(x, y, 1, 1).data;
            const r = pixelData[0];
            const g = pixelData[1];
            const b = pixelData[2];
            const a = pixelData[3]; 

            if (a === 0) {
                console.log("Pixel transparent détecté. Couleur non changée.");
                // Si on a cliqué sur du transparent, on ne change pas la couleur, mais on bascule quand même sur le pinceau.
            } else {
                // Mise à jour de la couleur globale de l'app et du picker
                currentRGB = rgbToHex(r, g, b);
                updateFinalColor(); // Met à jour currentColor et l'affichage du picker
            }
            
            // Revenir automatiquement au pinceau après avoir sélectionné la couleur
            currentTool = 'brush';
            document.querySelector('.tool-btn.active').classList.remove('active');
            if (typeof tools !== 'undefined' && tools.brush) {
                tools.brush.classList.add('active');
            } else {
                console.error("L'objet 'tools' ou 'tools.brush' n'est pas défini pour activer le pinceau.");
            }
        }
    }

    // Gestion de la sauvegarde de l'état (Undo/Redo)
    if (actionTaken && e.type === 'mousedown') {
        saveState();
    }
}


// Les fonctions fillArea, saveState, undo, updateUndoButtonState, exportCanvas sont inchangées.
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
        return { r: imgData.data[index], g: imgData.data[index + 1], b: imgData.data[index + 2], a: imgData.data[index + 3] };
    };

    const targetColor = getPixelColor(startX, startY);

    const r = parseInt(fillColor.slice(1, 3), 16);
    const g = parseInt(fillColor.slice(3, 5), 16);
    const b = parseInt(fillColor.slice(5, 7), 16);
    const a = 255; 

    if (targetColor.r === r && targetColor.g === g && targetColor.b === b && targetColor.a === a) {
        console.log("Couleur cible déjà identique à la couleur de remplissage. Arrêt pour éviter la boucle infinie.");
        return;
    }

    const stack = [[startX, startY]];

    while (stack.length) {
        const [x, y] = stack.pop();
        const currentColor = getPixelColor(x, y);

        if (!currentColor) continue;

        if (currentColor.r === targetColor.r && currentColor.g === targetColor.g && currentColor.b === targetColor.b && currentColor.a === targetColor.a) {
            const index = (y * canvas.width + x) * 4;
            
            imgData.data[index] = r;
            imgData.data[index + 1] = g;
            imgData.data[index + 2] = b;
            imgData.data[index + 3] = a; 

            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
    }

    ctx.putImageData(imgData, 0, 0);
}

/**
 * Sauvegarde l'état actuel du canvas dans l'historique.
 */
function saveState() {
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }

    const dataUrl = canvas.toDataURL();

    history.push(dataUrl);

    if (history.length > MAX_HISTORY) {
        history.shift(); 
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

        const img = new Image();
        img.onload = function () {
            ctx.clearRect(0, 0, canvas.width, canvas.height); 
            ctx.drawImage(img, 0, 0); 
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
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));

    const componentToHex = (c) => {
        const hex = c.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };

    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

init();