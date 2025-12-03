import { showAlert } from "/components/alert/alert.js";

// --- 1. Constantes et Variables Globales ---
const STORAGE_KEY = 'devgameforge_project_boards';
const boardsContainer = document.getElementById('boards-container');
const addBoardBtn = document.getElementById('add-board-btn');
const createBoardPlaceholderBtn = document.getElementById('create-board-placeholder-btn');
const boardCreationModal = document.getElementById('board-creation-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const saveNewBoardBtn = document.getElementById('save-new-board');
const newBoardTitleInput = document.getElementById('new-board-title');
const boardBackgroundInput = document.getElementById('board-background');


// --- 2. Gestion du Stockage (localStorage) ---

/**
 * Charge la liste des tableaux depuis le localStorage.
 * @returns {Array<Object>} La liste des tableaux ou un tableau vide.
 */
function loadBoards() {
    const json = localStorage.getItem(STORAGE_KEY);
    // Retourne les données parsées, ou un tableau vide si rien n'est trouvé
    return json ? JSON.parse(json) : [];
}

/**
 * Sauvegarde la liste des tableaux dans le localStorage.
 * @param {Array<Object>} boards La liste des tableaux à sauvegarder.
 */
function saveBoards(boards) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
}

// --- 3. Gestion de l'Interface Utilisateur (Modale) ---

/** Ouvre la modale de création de tableau. */
function openModal() {
    boardCreationModal.classList.remove('hidden');
    newBoardTitleInput.focus(); // Met le focus sur le champ titre
}

/** Ferme la modale de création de tableau et réinitialise les champs. */
function closeModal() {
    boardCreationModal.classList.add('hidden');
    newBoardTitleInput.value = '';
    boardBackgroundInput.value = '#1a1a1a'; // Réinitialisation de la couleur par défaut
}


// --- 4. Rendu de la Page d'Accueil (Liste des Tableaux) ---

/**
 * Crée et retourne l'élément DOM d'une carte de tableau.
 * @param {Object} board Les données du tableau (id, title, background, lists).
 * @returns {HTMLElement} L'élément div représentant la carte.
 */
function createBoardCard(board) {
    // ------------------------------------------------
    // 1. Calcul des métadonnées (Listes et Tâches)
    // ------------------------------------------------
    const listCount = board.lists ? board.lists.length : 0;
    
    // Calculer le nombre total de tâches en parcourant toutes les listes
    let taskCount = 0;
    if (board.lists) {
        taskCount = board.lists.reduce((total, list) => {
            // S'assurer que 'list.tasks' existe avant d'accéder à sa longueur
            return total + (list.tasks ? list.tasks.length : 0);
        }, 0);
    }
    
    // ------------------------------------------------
    // 2. Création de l'élément DOM
    // ------------------------------------------------
    const card = document.createElement('div');
    card.className = 'board-card';
    card.dataset.id = board.id;
    // Applique la couleur de fond choisie
    card.style.backgroundColor = board.background; 

    // Structure interne de la carte (MISE À JOUR DE board-meta)
    card.innerHTML = `
        <h3 class="board-title">${board.title}</h3>
        <p class="board-meta">${listCount} listes | ${taskCount} tâches</p>
        <a href="board-view.html?id=${board.id}" class="open-board-link" title="Ouvrir ${board.title}">Ouvrir</a>
    `;
    
    // Ajout d'un écouteur pour rendre la carte entière cliquable
    card.addEventListener('click', () => {
        window.location.href = `board-view.html?id=${board.id}`;
    });

    return card;
}

/** Affiche tous les tableaux sauvegardés dans le conteneur. */
function renderBoards() {
    boardsContainer.innerHTML = ''; // Nettoyer le conteneur

    const boards = loadBoards();
    
    boards.forEach(board => {
        // Insérer chaque carte de tableau avant le bouton "Nouveau Tableau" (le placeholder)
        boardsContainer.insertBefore(createBoardCard(board), boardsContainer.lastElementChild);
    });
    
    // Si la liste est vide, on peut donner un indice ici
    if (boards.length === 0) {
        // Optionnel : Afficher un message si aucun tableau n'existe
    }
}


// --- 5. Création d'un Nouveau Tableau ---

/** Gère la création et la sauvegarde d'un nouveau tableau. */
function handleCreateNewBoard() {
    const title = newBoardTitleInput.value.trim();
    const background = boardBackgroundInput.value;

    if (title === '') {
        showAlert('Veuillez donner un titre à votre tableau.');
        return;
    }

    // Génération d'un ID unique (timestamp en millisecondes + un petit nombre aléatoire)
    const newId = Date.now().toString() + Math.floor(Math.random() * 1000);

    const newBoard = {
        id: newId,
        title: title,
        background: background,
        lists: [] // Un nouveau tableau commence sans liste
    };

    const boards = loadBoards();
    boards.push(newBoard);
    saveBoards(boards); // Sauvegarde la nouvelle liste

    closeModal();
    renderBoards(); // Rafraîchit l'affichage
}

// --- 6. Initialisation et Écouteurs d'Événements ---

/** Initialise la page d'accueil du gestionnaire de projets. */
function initProjectsManager() {
    // VÉRIFICATION CLÉ : S'assurer que les éléments de la page 'projects.html' existent.
    // Si le conteneur principal des tableaux n'existe pas, nous arrêtons l'exécution.
    if (!boardsContainer) {
        return; 
    }

    // 1. Écouteurs pour la modale
    addBoardBtn.addEventListener('click', openModal);
    createBoardPlaceholderBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    saveNewBoardBtn.addEventListener('click', handleCreateNewBoard);

    // Fermeture de la modale si l'utilisateur clique en dehors du contenu
    boardCreationModal.addEventListener('click', (event) => {
        if (event.target === boardCreationModal) {
            closeModal();
        }
    });

    // 2. Rendu initial des tableaux
    renderBoards();
}

// Lancer l'initialisation quand le script est chargé
document.addEventListener('DOMContentLoaded', initProjectsManager);