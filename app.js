const STORAGE_KEY = 'todo_app_data_v1';

// Utilities
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

// Data model
let state = {
	categories: [], // {id,name}
	tasks: [],      // {id,categoryId,title,description,completed,createdAt}
	activeCategoryId: null
};

// Load / Save
function loadState(){
	try{
		const raw = localStorage.getItem(STORAGE_KEY);
		if(raw) state = JSON.parse(raw);
		else {
			// seed default category
			const hid = uid();
			state.categories = [{id:hid,name:'Mes tâches'}];
			state.activeCategoryId = hid;
		}
	}catch(e){ console.error('load failed', e) }
}
function saveState(){
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Rendering
function renderCategories(){
	const el = $('#categories');
	el.innerHTML = '';
	state.categories.forEach(cat=>{
		const btn = document.createElement('button');
		btn.className = 'cat' + (cat.id===state.activeCategoryId ? ' active' : '');
		btn.textContent = cat.name;
		btn.onclick = ()=> { state.activeCategoryId = cat.id; saveState(); renderAll(); };
		// small edit/delete menu
		const menu = document.createElement('span');
		menu.innerHTML = ' \u22EE';
		menu.style.marginLeft='8px';
		menu.style.opacity='0.6';
		menu.onclick = (ev)=>{
			ev.stopPropagation();
			showCategoryModal(cat);
		};
		btn.appendChild(menu);
		el.appendChild(btn);
	});
}
function renderTasks(){
	const list = $('#task-list');
	list.innerHTML = '';
	const tasks = state.tasks.filter(t => t.categoryId === state.activeCategoryId);
	// Changed: sort so incomplete tasks come first, completed tasks are at the bottom.
	tasks.sort((a,b)=>{
		if (a.completed === b.completed) return a.createdAt - b.createdAt;
		return a.completed ? 1 : -1; // a after b if a.completed === true
	});
	for(const t of tasks){
		const li = document.createElement('li');
		li.className = 'task';
		li.innerHTML = `
			<div class="left">
				<input type="checkbox" ${t.completed ? 'checked' : ''} data-id="${t.id}">
			</div>
			<div class="body">
				<div class="title">${escapeHtml(t.title)}</div>
				<div class="desc">${renderMarkdown(t.description || '', t.id)}</div>
				<div class="meta">${formatDate(t.createdAt)}</div>
			</div>
			<div class="actions">
				<button class="small-btn edit" data-id="${t.id}">Edit</button>
				<button class="small-btn del" data-id="${t.id}" style="color:var(--danger)">Suppr</button>
			</div>
		`;
		list.appendChild(li);
	}
	// Attach events ONLY to the task checkboxes (those with data-id) to avoid binding to markdown checkboxes
	$$('#task-list input[type="checkbox"][data-id]').forEach(cb=>{
		cb.addEventListener('change', e=>{
			const id = e.target.getAttribute('data-id');
			toggleTask(id, e.target.checked);
		});
	});
	$$('#task-list .edit').forEach(b=> b.addEventListener('click', e=>{
		const id = e.target.getAttribute('data-id');
		const t = state.tasks.find(x=>x.id===id);
		showTaskModal(t);
	}));
	$$('#task-list .del').forEach(b=> b.addEventListener('click', e=>{
		const id = e.target.getAttribute('data-id');
		if(confirm('Supprimer cette tâche ?')) { deleteTask(id); }
	}));
}

// New: format date/time in French
function formatDate(value){
	const d = (value instanceof Date) ? value : new Date(value);
	try {
		return d.toLocaleString('fr-FR', {
			weekday: 'short',
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	} catch (e) {
		return d.toLocaleString('fr-FR');
	}
}

// New: render markdown and convert [ ] / [x] into interactive checkboxes with data attributes
function renderMarkdown(md, taskId){
	// protect null/undefined
	md = String(md || '');
	let idx = 0;
	// replace [x] or [X] with a checked checkbox that includes taskId + index
	md = md.replace(/\[\s*[xX]\s*\]/g, () => {
		const html = `<input type="checkbox" data-task-id="${escapeHtml(taskId)}" data-md-index="${idx}" checked>`;
		idx++;
		return html;
	});
	// replace [ ] with an unchecked checkbox
	md = md.replace(/\[\s*\]/g, () => {
		const html = `<input type="checkbox" data-task-id="${escapeHtml(taskId)}" data-md-index="${idx}">`;
		idx++;
		return html;
	});
	// let marked parse the resulting markdown (it will keep the inserted input HTML)
	return marked.parse(md || '');
}

// Helper: update the nth checkbox occurrence in a task's markdown description
function updateDescriptionCheckbox(taskId, index, checked){
	const task = state.tasks.find(t=> t.id === taskId);
	if(!task) return;
	const md = String(task.description || '');
	// find all matches and replace the specific one
	const regex = /\[\s*[xX]?\s*\]/g;
	let i = 0;
	let replaced = false;
	const newMd = md.replace(regex, (match)=>{
		if(i === index){
			replaced = true;
			i++;
			return checked ? '[x]' : '[ ]';
		}
		i++;
		return match;
	});
	if(replaced){
		task.description = newMd;
		saveState();
		// re-render tasks to reflect any visual changes (tick etc.)
		renderAll();
	}
}

// Delegated handler for markdown checkboxes inside descriptions
$('#task-list').addEventListener('change', (ev)=>{
	const target = ev.target;
	if(!target || target.tagName !== 'INPUT' || target.type !== 'checkbox') return;
	// ignore main task checkboxes (they have data-id)
	if(target.hasAttribute('data-id')) return;
	// process markdown checkbox (must have data-task-id and data-md-index)
	const taskId = target.getAttribute('data-task-id');
	const idx = parseInt(target.getAttribute('data-md-index'), 10);
	if(!taskId || Number.isNaN(idx)) return;
	updateDescriptionCheckbox(taskId, idx, !!target.checked);
});

// Helpers
function escapeHtml(s){ return String(s || '').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

// CRUD operations
function addCategory(name){
	const id = uid();
	state.categories.push({id,name});
	state.activeCategoryId = id;
	saveState(); renderAll();
}
function updateCategory(id,name){
	const c = state.categories.find(x=>x.id===id); if(!c) return;
	c.name = name; saveState(); renderAll();
}
function deleteCategory(id){
	// move tasks to first category or remove if last
	state.categories = state.categories.filter(c=>c.id!==id);
	state.tasks = state.tasks.filter(t=>t.categoryId!==id);
	if(state.activeCategoryId === id){
		state.activeCategoryId = state.categories.length ? state.categories[0].id : null;
	}
	saveState(); renderAll();
}
function addTask(title, description){
	if(!state.activeCategoryId) return;
	const t = { id: uid(), categoryId: state.activeCategoryId, title, description, completed:false, createdAt: Date.now() };
	state.tasks.push(t);
	saveState(); renderAll();
}
function updateTask(id, title, description){
	const t = state.tasks.find(x=>x.id===id); if(!t) return;
	t.title = title; t.description = description; saveState(); renderAll();
}
function deleteTask(id){
	state.tasks = state.tasks.filter(t=>t.id!==id); saveState(); renderAll();
}
function toggleTask(id, checked){
	const t = state.tasks.find(x=>x.id===id); if(!t) return;
	t.completed = !!checked; saveState(); renderAll();
}

// Modals
const modalCategory = $('#modal-category');
const formCategory = $('#form-category');
const categoryNameInput = $('#category-name');
const categoryIdInput = $('#category-id'); // <-- new reference
const categoryDeleteBtn = document.getElementById('category-delete'); // <-- new reference
let editingCategoryId = null;

function showCategoryModal(cat = null){
	editingCategoryId = cat ? cat.id : null;
	$('#category-modal-title').textContent = cat ? 'Modifier catégorie' : 'Nouvelle catégorie';
	categoryNameInput.value = cat ? cat.name : '';
	// set hidden id field for convenience (optional)
	if (categoryIdInput) categoryIdInput.value = cat ? cat.id : '';
	// show delete button only when editing
	if (categoryDeleteBtn) {
		if (editingCategoryId) categoryDeleteBtn.classList.add('show');
		else categoryDeleteBtn.classList.remove('show');
	}
	modalCategory.classList.remove('hidden');
	categoryNameInput.focus();
}
$('#category-cancel').addEventListener('click', ()=> {
	modalCategory.classList.add('hidden');
	// reset editing state and hide delete button
	editingCategoryId = null;
	if (categoryIdInput) categoryIdInput.value = '';
	if (categoryDeleteBtn) categoryDeleteBtn.classList.remove('show');
});

formCategory.addEventListener('submit', (e)=>{
	e.preventDefault();
	const name = categoryNameInput.value.trim();
	if(!name) return;
	if(editingCategoryId) updateCategory(editingCategoryId, name);
	else addCategory(name);
	modalCategory.classList.add('hidden');
	// reset editing state and hide delete button after save
	editingCategoryId = null;
	if (categoryIdInput) categoryIdInput.value = '';
	if (categoryDeleteBtn) categoryDeleteBtn.classList.remove('show');
});

// Task modal
const modalTask = $('#modal-task');
const formTask = $('#form-task');
const taskTitle = $('#task-title');
const taskDesc = $('#task-desc');
let editingTaskId = null;

function showTaskModal(task = null){
	editingTaskId = task ? task.id : null;
	$('#task-modal-title').textContent = task ? 'Modifier tâche' : 'Nouvelle tâche';
	taskTitle.value = task ? task.title : '';
	taskDesc.value = task ? task.description : '';
	modalTask.classList.remove('hidden');
	taskTitle.focus();
}
$('#task-cancel').addEventListener('click', ()=> { modalTask.classList.add('hidden'); });

formTask.addEventListener('submit', (e)=>{
	e.preventDefault();
	const title = taskTitle.value.trim();
	const desc = taskDesc.value.trim();
	if(!title) return;
	if(editingTaskId) updateTask(editingTaskId, title, desc);
	else addTask(title, desc);
	modalTask.classList.add('hidden');
});

// UI wiring
$('#btn-add-category').addEventListener('click', ()=> showCategoryModal());
$('#btn-add-task').addEventListener('click', ()=> showTaskModal());

// Nouveau : boutons pour modifier / supprimer la catégorie courante
const btnEditCurrent = $('#btn-edit-current-category');
const btnDeleteCurrent = $('#btn-delete-current-category');

if (btnEditCurrent) {
	btnEditCurrent.addEventListener('click', () => {
		const active = state.categories.find(c => c.id === state.activeCategoryId);
		if (!active) return alert('Aucune catégorie sélectionnée.');
		showCategoryModal(active);
	});
}

if (btnDeleteCurrent) {
	btnDeleteCurrent.addEventListener('click', () => {
		const activeId = state.activeCategoryId;
		const active = state.categories.find(c => c.id === activeId);
		if (!active) return alert('Aucune catégorie sélectionnée.');
		if (!confirm(`Supprimer la catégorie "${active.name}" et toutes ses tâches ?`)) return;
		deleteCategory(activeId);
	});
}

// long-press or menu for deleting category: add button when editing
// When opening category modal for existing category, allow delete
// We'll add delete via context in modal when editing
(function enhanceCategoryModal(){
	const titleEl = $('#category-modal-title');
	// Inject delete button when editing
	formCategory.addEventListener('focusin', ()=>{
		// no-op placeholder
	});
})();

// wire delete button in modal to app logic
if (categoryDeleteBtn) {
	categoryDeleteBtn.addEventListener('click', () => {
		if (!editingCategoryId) return alert('Aucune catégorie sélectionnée pour suppression.');
		// confirm then delete via existing function
		if (!confirm('Supprimer cette catégorie et toutes ses tâches ?')) return;
		deleteCategory(editingCategoryId);
		// close modal and reset
		modalCategory.classList.add('hidden');
		editingCategoryId = null;
		if (categoryIdInput) categoryIdInput.value = '';
		categoryDeleteBtn.classList.remove('show');
	});
}

// Export/Import functions
function exportState() {
    // Export only current category and its tasks
    const currentCat = state.categories.find(c => c.id === state.activeCategoryId);
    if (!currentCat) {
        alert('Veuillez sélectionner une liste à exporter');
        return;
    }

    const export_data = {
        category: currentCat,
        tasks: state.tasks.filter(t => t.categoryId === currentCat.id)
    };

    const dataStr = JSON.stringify(export_data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentCat.name}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importState(file) {
    // Import into current category
    if (!state.activeCategoryId) {
        alert('Veuillez sélectionner une liste où importer');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported && (imported.tasks || imported.category)) {
                const message = 'Ajouter ces tâches à la liste courante ?';
                if (confirm(message)) {
                    // Add tasks to current category while preserving their properties
                    const tasks = imported.tasks || [];
                    tasks.forEach(task => {
                        // Create new task but keep original properties (except IDs and categoryId)
                        const newTask = {
                            id: uid(),
                            categoryId: state.activeCategoryId,
                            title: task.title,
                            description: task.description,
                            completed: !!task.completed,
                            createdAt: task.createdAt || Date.now()
                        };
                        state.tasks.push(newTask);
                    });
                    saveState();
                    renderAll();
                }
            } else {
                alert('Format de fichier invalide');
            }
        } catch(err) {
            alert('Erreur lors de l\'import: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// Add export/import handlers
$('#btn-export').addEventListener('click', exportState);
$('#btn-import').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', (e) => {
    if (e.target.files.length) importState(e.target.files[0]);
    e.target.value = ''; // reset for allowing same file
});

// Render all
function renderAll(){
	// header category name
	const active = state.categories.find(c=>c.id===state.activeCategoryId);
	$('#current-category-name').textContent = active ? active.name : 'Toutes les tâches';
	renderCategories();
	renderTasks();
}

// Init
function init(){
	// configure marked for GFM (task lists)
	if(window.marked){ marked.setOptions({gfm:true, breaks:true}); }
	loadState();
	// ensure active category exists
	if(!state.activeCategoryId && state.categories.length) state.activeCategoryId = state.categories[0].id;
	renderAll();

	// autosave on unload
	window.addEventListener('beforeunload', ()=> saveState());
}
init();