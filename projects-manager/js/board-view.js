import { showAlert } from "/components/alert/alert.js";
import { loadBoards, saveBoards } from './projects.js';

// --- 1. Constantes et État Global ---
let currentBoardId = null;
let currentBoardData = null;

// Éléments du DOM
const boardBody = document.getElementById('board-body');
const boardTitleDisplay = document.getElementById('board-title-display');
const listsContainer = document.getElementById('lists-container');
const addListBtn = document.getElementById('add-list-btn');
const newListForm = document.querySelector('.new-list-form');
const newListTitleInput = document.getElementById('new-list-title-input');
const saveListBtn = document.querySelector('.save-list-btn');
const cancelListBtn = document.querySelector('.cancel-list-btn');

// Éléments de la Modale de Tâche
const taskModal = document.getElementById('task-modal');
const taskModalTitle = document.getElementById('task-modal-title');
const taskModalCheckbox = document.getElementById('task-modal-checkbox');
const taskModalDescription = document.getElementById('task-modal-description');
const saveTaskBtn = document.getElementById('save-task-btn');
const deleteTaskBtn = document.getElementById('delete-task-btn');
let currentEditingTask = null; // Stocke l'objet tâche en cours d'édition

// Éléments de la Modale de Paramètres du Tableau
const settingsModal = document.getElementById('settings-modal');
const editBoardSettingsBtn = document.getElementById('edit-board-settings-btn');
const closeSettingsModalBtn = document.getElementById('close-settings-modal-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const settingsBoardTitleInput = document.getElementById('settings-board-title');
const settingsBoardBackgroundInput = document.getElementById('settings-board-background');
const deleteBoardBtn = document.getElementById('delete-board-btn');


// --- 2. Fonctions de Données (Intégration avec projects.js) ---

/**
 * Récupère les données d'un tableau spécifique à partir de l'ID.
 * (Dépend de la structure de loadBoards/saveBoards dans projects.js)
 * @param {string} id L'ID du tableau à charger.
 * @returns {Object|null} Les données du tableau ou null.
 */
function getBoardData(id) {
    const allBoards = loadBoards(); // loadBoards vient de projects.js
    return allBoards.find(board => board.id === id) || null;
}

/**
 * Met à jour un tableau spécifique dans le localStorage.
 */
function updateBoardInStorage() {
    if (!currentBoardData) return;
    let allBoards = loadBoards();
    const index = allBoards.findIndex(b => b.id === currentBoardData.id);

    if (index !== -1) {
        allBoards[index] = currentBoardData;
        saveBoards(allBoards); // saveBoards vient de projects.js
    }
}


// --- 3. Gestion de l'Interface (Rendu du Tableau) ---

/**
 * Met à jour le titre du tableau, la couleur de fond et le titre de la page.
 */
function updateBoardHeader(board) {
    document.getElementById('board-page-title').textContent = `${board.title} - Projects Manager`;
    boardTitleDisplay.textContent = board.title;
    boardBody.style.backgroundColor = board.background;
}

/**
 * Crée et retourne l'élément DOM d'une tâche (carte).
 * @param {Object} task Les données de la tâche.
 * @returns {HTMLElement} La carte de tâche.
 */
function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = `task-card ${task.completed ? 'task-completed' : ''}`;
    card.dataset.taskId = task.id;
    card.dataset.listId = task.listId;

    card.innerHTML = `
        <div class="task-title-wrapper">
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-task-id="${task.id}">
            <span class="task-title-text">${task.title}</span>
        </div>
    `;

    // Écouteur pour la case à cocher (complétion rapide)
    card.querySelector('.task-checkbox').addEventListener('change', (e) => {
        handleTaskCompletion(task.id, task.listId, e.target.checked);
    });

    // Rendre la carte cliquable pour ouvrir la modale aussi
    card.addEventListener('click', (e) => {
        // S'assurer que le clic n'est pas sur la checkbox ou le bouton '✏️'
        if (!e.target.closest('.task-checkbox')) {
            openTaskModal(task);
        }
    });

    return card;
}


/**
 * Crée et retourne l'élément DOM d'une liste (colonne).
 * @param {Object} list Les données de la liste.
 * @returns {HTMLElement} La colonne de liste.
 */
function createListElement(list) {
    const listWrapper = document.createElement('div');
    listWrapper.className = 'list-wrapper';
    listWrapper.dataset.listId = list.id;

    listWrapper.innerHTML = `
        <div class="list-header">
            <h3 class="list-title" contenteditable="true" data-list-id="${list.id}">${list.title}</h3>
            <button class="list-menu-btn delete-list-btn" data-list-id="${list.id}">...</button>
        </div>
        <div class="tasks-list" data-list-id="${list.id}">
            </div>
        <div class="add-task-container">
            <button class="add-task-btn" data-list-id="${list.id}">+ Ajouter une tâche</button>
            <div class="new-task-form hidden">
                <input type="text" placeholder="Nom de la tâche" class="new-task-title-input">
                <button class="btn save-task-title-btn">Ajouter</button>
                <button class="btn cancel-task-title-btn">❌</button>
            </div>
        </div>
    `;

    // Récupérer le conteneur de tâches (pour le Drag & Drop)
    const tasksListContainer = listWrapper.querySelector('.tasks-list');

    // Rendre le titre de la liste modifiable
    const listTitleEl = listWrapper.querySelector('.list-title');
    listTitleEl.addEventListener('blur', () => handleListTitleEdit(list.id, listTitleEl.textContent));

    // Ajouter les tâches existantes
    list.tasks.forEach(task => {
        tasksListContainer.appendChild(createTaskCard(task));
    });

    // Initialiser SortableJS pour le Drag & Drop des tâches dans cette liste
    initializeSortableTasks(tasksListContainer);

    // Initialiser les écouteurs pour l'ajout de tâche
    initializeAddTaskListeners(listWrapper);

    // Initialiser les écouteurs pour la suppression de liste
    initializeListDeletion(listWrapper);

    return listWrapper;
}


/** Affiche toutes les listes et tâches du tableau actuel. */
function renderLists() {
    // 1. Trouver le placeholder d'ajout de liste (chercher dans tout le document)
    const addListPlaceholder = document.querySelector('.add-list-placeholder');

    // Vérification : si le placeholder est introuvable, il y a un problème dans le HTML, on arrête.
    if (!addListPlaceholder) {
        console.error("L'élément '.add-list-placeholder' est introuvable dans le DOM. Vérifiez board-view.html.");
        return;
    }

    // 2. Nettoyer le conteneur avant de rendre
    listsContainer.innerHTML = '';

    // 3. Ajouter les listes existantes
    currentBoardData.lists.forEach(list => {
        const listEl = createListElement(list);
        listsContainer.appendChild(listEl); // Utiliser appendChild ici
    });

    // 4. Ajouter le placeholder (qui est déplacé) à la fin du listsContainer
    listsContainer.appendChild(addListPlaceholder);

    // 5. Ré-initialiser les écouteurs (essentiel après le déplacement)
    initializeAddListListeners(addListPlaceholder);

    // 6. Après avoir rendu toutes les listes, initialiser le Drag & Drop des listes elles-mêmes
    initializeSortableLists(listsContainer);
}

// --- 4. Fonctionnalités (Création, Modification, Suppression, Drag & Drop) ---

// ------------------------------------------------
// 4.1. Gestion de la Modale de Création de Liste
// ------------------------------------------------

/** Gère l'affichage/masquage du formulaire d'ajout de liste */
function initializeAddListListeners(addListPlaceholder) {
    const btn = addListPlaceholder.querySelector('.add-list-btn');
    const form = addListPlaceholder.querySelector('.new-list-form');
    const input = addListPlaceholder.querySelector('#new-list-title-input');
    const save = addListPlaceholder.querySelector('.save-list-btn');
    const cancel = addListPlaceholder.querySelector('.cancel-list-btn');

    btn.onclick = () => {
        btn.classList.add('hidden');
        form.classList.remove('hidden');
        input.focus();
    };

    cancel.onclick = () => {
        form.classList.add('hidden');
        btn.classList.remove('hidden');
        input.value = '';
    };

    save.onclick = () => handleCreateNewList(input.value);
}

/** Crée et ajoute une nouvelle liste. */
function handleCreateNewList(title) {
    const titleTrimmed = title.trim();
    if (!titleTrimmed) return;

    const newId = Date.now().toString() + Math.floor(Math.random() * 100);

    const newList = {
        id: newId,
        title: titleTrimmed,
        tasks: []
    };

    currentBoardData.lists.push(newList);
    updateBoardInStorage();

    // Réinitialisation de la vue
    newListTitleInput.value = '';
    newListForm.classList.add('hidden');
    document.getElementById('add-list-btn').classList.remove('hidden');
    renderLists();
}

// ------------------------------------------------
// 4.2. Drag and Drop (SortableJS)
// ------------------------------------------------

/** Initialise le Drag and Drop pour les tâches à l'intérieur d'une liste et entre les listes. */
function initializeSortableTasks(el) {
    new Sortable(el, {
        group: 'shared-tasks', // Permet de déplacer entre les listes
        animation: 150,
        filter: '.task-checkbox', // Empêche le drag si on clique sur la checkbox
        onEnd: function (evt) {
            handleTaskMove(evt);
            updateBoardInStorage(); // Sauvegarder après le mouvement
        },
        draggable: '.task-card' // Définir ce qui est draggable
    });
}

/**
 * Met à jour les données après le déplacement d'une tâche.
 * @param {Object} evt L'événement SortableJS.
 */
function handleTaskMove(evt) {
    const item = evt.item; // L'élément DOM de la tâche déplacée
    const taskId = item.dataset.taskId;
    const oldListId = evt.from.dataset.listId;
    const newListId = evt.to.dataset.listId;

    let movedTask = null;

    // 1. Trouver et retirer la tâche de l'ancienne liste
    const oldList = currentBoardData.lists.find(l => l.id === oldListId);
    if (oldList) {
        const taskIndex = oldList.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            movedTask = oldList.tasks.splice(taskIndex, 1)[0];
        }
    }

    // 2. Ajouter la tâche à la nouvelle liste (et à la bonne position)
    if (movedTask) {
        movedTask.listId = newListId; // Mise à jour de l'ID de liste dans les données
        const newList = currentBoardData.lists.find(l => l.id === newListId);
        if (newList) {
            // Reconstruire l'ordre des tâches dans la nouvelle liste
            const newOrderTasks = [];
            Array.from(evt.to.children).forEach(taskElement => {
                const taskID = taskElement.dataset.taskId;

                if (taskID === movedTask.id) {
                    newOrderTasks.push(movedTask);
                } else {
                    const existingTask = newList.tasks.find(t => t.id === taskID);
                    if (existingTask) {
                        newOrderTasks.push(existingTask);
                    }
                }
            });

            // Remplacer l'ancienne liste de tâches par la nouvelle liste ordonnée
            newList.tasks = newOrderTasks;
        }
    }
}

/** Initialise le Drag and Drop pour le déplacement des listes. */
function initializeSortableLists(el) {
    new Sortable(el, {
        group: 'shared-lists',
        animation: 150,
        handle: '.list-header', // Zone à saisir pour le drag
        filter: '.add-list-placeholder', // Ne pas autoriser le drag sur le bouton d'ajout
        onEnd: function (evt) {
            handleListMove(evt);
            updateBoardInStorage(); // Sauvegarder après le mouvement
        },
        draggable: '.list-wrapper' // Définir ce qui est draggable
    });
}

/** Met à jour l'ordre des listes après le déplacement. */
function handleListMove(evt) {
    const listId = evt.item.dataset.listId;
    const oldIndex = evt.oldIndex;
    const newIndex = evt.newIndex;

    // La liste de listes dans les données
    const lists = currentBoardData.lists;

    // Correction de l'index car nous avons un placeholder à la fin
    const actualOldIndex = oldIndex;
    const actualNewIndex = newIndex;

    // Déplacer l'élément dans le tableau de données
    const [movedList] = lists.splice(actualOldIndex, 1);
    lists.splice(actualNewIndex, 0, movedList);
}

// ------------------------------------------------
// 4.3. Gestion des Tâches (Ajout, Modification, Suppression, Complétion)
// ------------------------------------------------

/** Gère l'affichage/masquage du formulaire d'ajout de tâche */
function initializeAddTaskListeners(listWrapper) {
    const listId = listWrapper.dataset.listId;
    const btn = listWrapper.querySelector('.add-task-btn');
    const form = listWrapper.querySelector('.new-task-form');
    const input = listWrapper.querySelector('.new-task-title-input');
    const save = listWrapper.querySelector('.save-task-title-btn');
    const cancel = listWrapper.querySelector('.cancel-task-title-btn');

    btn.onclick = () => {
        btn.classList.add('hidden');
        form.classList.remove('hidden');
        input.focus();
    };

    cancel.onclick = () => {
        form.classList.add('hidden');
        btn.classList.remove('hidden');
        input.value = '';
    };

    save.onclick = () => {
        handleCreateNewTask(listId, input.value);
        input.value = '';
        form.classList.add('hidden');
        btn.classList.remove('hidden');
    };
}

/** Crée et ajoute une nouvelle tâche. */
function handleCreateNewTask(listId, title) {
    const titleTrimmed = title.trim();
    if (!titleTrimmed) return;

    const newListId = listId;
    const newId = Date.now().toString() + Math.floor(Math.random() * 1000);

    const newTask = {
        id: newId,
        listId: newListId,
        title: titleTrimmed,
        description: '',
        completed: false
    };

    const list = currentBoardData.lists.find(l => l.id === newListId);
    if (list) {
        list.tasks.push(newTask);
        updateBoardInStorage();
        renderLists(); // Rafraîchit tout le tableau pour l'ordre
    }
}

/** Ouvre la modale d'édition d'une tâche. */
function openTaskModal(task) {
    currentEditingTask = task; // Stocker la tâche en cours d'édition

    taskModalTitle.textContent = task.title;
    taskModalTitle.dataset.taskId = task.id;
    taskModalDescription.value = task.description || '';

    taskModal.classList.remove('hidden');
}

/** Gère l'enregistrement des modifications de la tâche dans la modale. */
function handleSaveTask() {
    if (!currentEditingTask) return;

    // Récupérer les nouvelles valeurs
    const newTitle = taskModalTitle.textContent.trim();
    const newDescription = taskModalDescription.value.trim();

    if (!newTitle) {
        showAlert("Le titre de la tâche ne peut pas être vide.");
        return;
    }

    // Mettre à jour l'objet tâche
    currentEditingTask.title = newTitle;
    currentEditingTask.description = newDescription;

    // La tâche est déjà une référence, donc on met à jour le stockage
    updateBoardInStorage();
    renderLists(); // Rafraîchit l'affichage
    taskModal.classList.add('hidden');
    currentEditingTask = null;
}

/** Gère la suppression d'une tâche. */
function handleDeleteTask() {
    if (!currentEditingTask || !confirm(`Voulez-vous vraiment supprimer la tâche "${currentEditingTask.title}" ?`)) return;

    const list = currentBoardData.lists.find(l => l.id === currentEditingTask.listId);
    if (list) {
        const index = list.tasks.findIndex(t => t.id === currentEditingTask.id);
        if (index !== -1) {
            list.tasks.splice(index, 1);
            updateBoardInStorage();
            renderLists();
            taskModal.classList.add('hidden');
            currentEditingTask = null;
        }
    }
}

/** Gère la complétion rapide d'une tâche. */
function handleTaskCompletion(taskId, listId, isCompleted) {
    const list = currentBoardData.lists.find(l => l.id === listId);
    if (list) {
        const task = list.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = isCompleted;
            updateBoardInStorage();
            renderLists(); // Rafraîchit pour appliquer le style "line-through"
        }
    }
}

// ------------------------------------------------
// 4.4. Modification et Suppression de Liste
// ------------------------------------------------

/** Gère la modification du titre de la liste. */
function handleListTitleEdit(listId, newTitle) {
    const titleTrimmed = newTitle.trim();
    if (!titleTrimmed) return;

    const list = currentBoardData.lists.find(l => l.id === listId);
    if (list) {
        list.title = titleTrimmed;
        updateBoardInStorage();
    }
}

/** Initialise l'écouteur de suppression de liste. */
function initializeListDeletion(listWrapper) {
    const listId = listWrapper.dataset.listId;
    const deleteBtn = listWrapper.querySelector('.delete-list-btn');

    // On utilise le même bouton "..." pour la suppression ici
    deleteBtn.addEventListener('click', () => {
        if (confirm("Voulez-vous vraiment supprimer cette liste et toutes ses tâches ?")) {
            handleDeleteList(listId);
        }
    });
}

/** Gère la suppression d'une liste. */
function handleDeleteList(listId) {
    const index = currentBoardData.lists.findIndex(l => l.id === listId);

    if (index !== -1) {
        currentBoardData.lists.splice(index, 1);
        updateBoardInStorage();
        renderLists();
    }
}

// ------------------------------------------------
// 4.5. Modification et Suppression de Tableau
// ------------------------------------------------

/** Ouvre la modale des paramètres du tableau. */
function openSettingsModal() {
    settingsBoardTitleInput.value = currentBoardData.title;
    settingsBoardBackgroundInput.value = currentBoardData.background;
    settingsModal.classList.remove('hidden');
}

/** Gère l'enregistrement des paramètres du tableau. */
function handleSaveSettings() {
    const newTitle = settingsBoardTitleInput.value.trim();
    const newBackground = settingsBoardBackgroundInput.value;

    if (!newTitle) {
        showAlert("Le titre du tableau ne peut pas être vide.");
        return;
    }

    currentBoardData.title = newTitle;
    currentBoardData.background = newBackground;

    updateBoardInStorage();
    updateBoardHeader(currentBoardData); // Mise à jour de l'affichage
    settingsModal.classList.add('hidden');
}

/** Gère la suppression complète du tableau. */
function handleDeleteBoard() {
    if (!confirm(`ATTENTION : Voulez-vous vraiment supprimer le tableau "${currentBoardData.title}" et TOUTES ses données ?`)) {
        return;
    }

    let allBoards = loadBoards();
    const index = allBoards.findIndex(b => b.id === currentBoardId);

    if (index !== -1) {
        allBoards.splice(index, 1);
        saveBoards(allBoards);
        // Rediriger vers la page des tableaux
        window.location.href = './projects.html';
    }
}


// --- 5. Initialisation ---

/**
 * Charge l'ID du tableau depuis l'URL et initialise la vue.
 */
function initBoardView() {
    // 1. Récupérer l'ID du tableau depuis l'URL (ex: ?id=12345)
    const urlParams = new URLSearchParams(window.location.search);
    currentBoardId = urlParams.get('id');

    if (!currentBoardId) {
        // Rediriger si aucun ID n'est trouvé
        showAlert("ID de tableau non spécifié ! Retour à la liste.");
        window.location.href = './projects.html';
        return;
    }

    // 2. Charger les données
    currentBoardData = getBoardData(currentBoardId);

    if (!currentBoardData) {
        // Rediriger si le tableau n'existe pas
        showAlert("Tableau non trouvé ! Retour à la liste.");
        window.location.href = './projects.html';
        return;
    }

    // 3. Initialiser l'affichage
    updateBoardHeader(currentBoardData);
    renderLists();

    // 4. Écouteurs d'événements globaux (Modales et Header)
    saveTaskBtn.addEventListener('click', handleSaveTask);
    deleteTaskBtn.addEventListener('click', handleDeleteTask);
    taskModal.addEventListener('click', (e) => { // Fermer la modale de tâche au clic à l'extérieur
        if (e.target === taskModal) taskModal.classList.add('hidden');
    });

    editBoardSettingsBtn.addEventListener('click', openSettingsModal);
    closeSettingsModalBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    saveSettingsBtn.addEventListener('click', handleSaveSettings);
    deleteBoardBtn.addEventListener('click', handleDeleteBoard);
    settingsModal.addEventListener('click', (e) => { // Fermer la modale de settings
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });

    // Rendre le titre du tableau modifiable directement au clic (sans modale)
    boardTitleDisplay.addEventListener('dblclick', () => { boardTitleDisplay.contentEditable = true; boardTitleDisplay.focus(); });
    boardTitleDisplay.addEventListener('blur', () => {
        boardTitleDisplay.contentEditable = false;
        const newTitle = boardTitleDisplay.textContent.trim();
        if (newTitle && newTitle !== currentBoardData.title) {
            currentBoardData.title = newTitle;
            updateBoardInStorage();
            updateBoardHeader(currentBoardData);
        } else {
            boardTitleDisplay.textContent = currentBoardData.title; // Réinitialiser si vide
        }
    });
}

// Lancer l'initialisation
document.addEventListener('DOMContentLoaded', initBoardView);