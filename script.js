document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/.netlify/functions/api';

    // UI Elements
    const addBtn = document.getElementById('add-player-btn');
    const nameInput = document.getElementById('new-player-name');
    const trashZone = document.getElementById('trash-zone');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const adminControls = document.getElementById('admin-controls');
    const loginModal = document.getElementById('login-modal');
    const adminPasswordInput = document.getElementById('admin-password');
    const submitLoginBtn = document.getElementById('submit-login');
    const cancelLoginBtn = document.getElementById('cancel-login');

    // Context Menu & Edit Modal
    const contextMenu = document.getElementById('context-menu');
    const ctxEdit = document.getElementById('ctx-edit');
    const ctxDelete = document.getElementById('ctx-delete');
    const editModal = document.getElementById('edit-modal');
    const editNameInput = document.getElementById('edit-name');
    const editDescInput = document.getElementById('edit-desc');
    const saveEditBtn = document.getElementById('save-edit');
    const cancelEditBtn = document.getElementById('cancel-edit');

    // State
    let tierData = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    let isAdmin = false;
    let adminPassword = '';
    let selectedPlayerId = null; // For context menu actions

    // --- Initialization ---
    checkAuth();
    fetchData();

    // --- Global Event Listeners ---
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.classList.add('hidden');
        }
    });

    document.addEventListener('contextmenu', (e) => {
        if (!isAdmin) return;
        // Prevent default if clicking on a player card
        if (e.target.closest('.player-card')) {
            e.preventDefault();
        }
    });

    // --- Auth Logic ---
    function checkAuth() {
        const savedPassword = localStorage.getItem('admin_password');
        if (savedPassword) {
            adminPassword = savedPassword;
            isAdmin = true;
            updateUIForAuth();
        }
    }

    function updateUIForAuth() {
        if (isAdmin) {
            loginBtn.classList.add('hidden');
            logoutBtn.classList.remove('hidden');
            adminControls.classList.remove('hidden');
            trashZone.classList.remove('hidden'); // Show trash zone for admins
        } else {
            loginBtn.classList.remove('hidden');
            logoutBtn.classList.add('hidden');
            adminControls.classList.add('hidden');
            trashZone.classList.add('hidden');
        }
        renderAllTiers(); // Re-render to update drag handles
    }

    loginBtn.addEventListener('click', () => {
        loginModal.classList.remove('hidden');
        adminPasswordInput.focus();
    });

    logoutBtn.addEventListener('click', () => {
        isAdmin = false;
        adminPassword = '';
        localStorage.removeItem('admin_password');
        updateUIForAuth();
        fetchData();
    });

    cancelLoginBtn.addEventListener('click', () => {
        loginModal.classList.add('hidden');
        adminPasswordInput.value = '';
    });

    submitLoginBtn.addEventListener('click', attemptLogin);
    adminPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') attemptLogin();
    });

    function attemptLogin() {
        const password = adminPasswordInput.value;
        if (password) {
            adminPassword = password;
            isAdmin = true;
            localStorage.setItem('admin_password', password);
            updateUIForAuth();
            loginModal.classList.add('hidden');
            adminPasswordInput.value = '';
        }
    }

    // --- API Logic ---
    async function fetchData() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Server Error');
            const players = await response.json();

            // Reset data
            tierData = { 1: [], 2: [], 3: [], 4: [], 5: [] };

            // Group by tier
            players.forEach(p => {
                if (tierData[p.tier]) {
                    tierData[p.tier].push(p);
                }
            });

            renderAllTiers();
        } catch (error) {
            console.error('Error loading data:', error);

            // Fallback to local data if API fails (e.g., running locally without Netlify Functions)
            try {
                console.log('Attempting to load local data...');
                const localResponse = await fetch('local_data.json');
                if (localResponse.ok) {
                    const localData = await localResponse.json();
                    console.log('Loaded local data:', localData);

                    // Reset data
                    tierData = { 1: [], 2: [], 3: [], 4: [], 5: [] };

                    localData.forEach(p => {
                        if (tierData[p.tier]) {
                            tierData[p.tier].push(p);
                        }
                    });

                    renderAllTiers();
                    return; // Exit if local data loaded successfully
                }
            } catch (localError) {
                console.error('Could not load local data:', localError);
            }

            alert('Błąd pobierania danych. Sprawdź konsolę.');
        }
    }

    async function apiCall(method, body = {}) {
        if (!isAdmin) return null;

        try {
            const response = await fetch(API_URL, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-password': adminPassword
                },
                body: JSON.stringify(body)
            });

            if (response.status === 401) {
                alert('Incorrect Password! Logging out.');
                logoutBtn.click();
                return null;
            }

            if (response.status === 409) {
                alert('Błąd: Gracz o tej nazwie już istnieje!');
                return null;
            }

            if (!response.ok) throw new Error('API Error');
            return await response.json();
        } catch (error) {
            console.error('API Action Failed:', error);
            alert('Wystąpił błąd. Sprawdź konsolę.');
            return null;
        }
    }

    // --- Core Logic ---

    addBtn.addEventListener('click', addPlayer);
    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addPlayer();
    });

    async function addPlayer() {
        const name = nameInput.value.trim();
        if (name && isAdmin) {
            const newPlayer = await apiCall('POST', { name, tier: 1 });
            if (newPlayer) {
                tierData[1].push(newPlayer);
                renderTier(1);
                nameInput.value = '';
            }
        }
    }

    function renderAllTiers() {
        for (let i = 1; i <= 5; i++) {
            renderTier(i);
        }
    }

    function renderTier(tierNum) {
        const listEl = document.getElementById(`tier-${tierNum}-list`);
        listEl.innerHTML = '';

        const players = tierData[tierNum] || [];
        players.forEach((player, index) => {
            const card = createPlayerCard(player, index);
            listEl.appendChild(card);
        });
    }

    function createPlayerCard(player, index) {
        const div = document.createElement('div');
        div.className = 'player-card';
        div.textContent = player.name;
        div.dataset.id = player.id;
        div.dataset.tier = player.tier;

        // Tooltip
        if (player.description) {
            div.title = player.description;
        }

        if (isAdmin) {
            div.draggable = true;
            div.style.cursor = 'grab';
            div.addEventListener('dragstart', handleDragStart);
            div.addEventListener('dragend', handleDragEnd);

            // Context Menu Trigger
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showContextMenu(e, player);
            });
        } else {
            div.draggable = false;
            div.style.cursor = 'default';
        }

        return div;
    }

    // --- Context Menu Logic ---
    function showContextMenu(e, player) {
        selectedPlayerId = player.id;
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.classList.remove('hidden');
    }

    ctxDelete.addEventListener('click', () => {
        if (selectedPlayerId) {
            deletePlayer(selectedPlayerId);
            contextMenu.classList.add('hidden');
        }
    });

    ctxEdit.addEventListener('click', () => {
        if (selectedPlayerId) {
            openEditModal(selectedPlayerId);
            contextMenu.classList.add('hidden');
        }
    });

    // --- Edit Modal Logic ---
    function openEditModal(id) {
        const player = findPlayerById(id);
        if (!player) return;

        editNameInput.value = player.name;
        editDescInput.value = player.description || '';
        editModal.classList.remove('hidden');
        editNameInput.focus();
    }

    cancelEditBtn.addEventListener('click', () => {
        editModal.classList.add('hidden');
        selectedPlayerId = null;
    });

    saveEditBtn.addEventListener('click', async () => {
        if (!selectedPlayerId) return;

        const newName = editNameInput.value.trim();
        const newDesc = editDescInput.value.trim();

        if (!newName) {
            alert('Nazwa nie może być pusta!');
            return;
        }

        const player = findPlayerById(selectedPlayerId);
        const result = await apiCall('PUT', {
            id: selectedPlayerId,
            name: newName,
            description: newDesc,
            tier: player.tier // Keep existing tier
        });

        if (result) {
            // Update local data
            player.name = newName;
            player.description = newDesc;
            renderAllTiers();
            editModal.classList.add('hidden');
            selectedPlayerId = null;
        }
    });

    function findPlayerById(id) {
        for (let t = 1; t <= 5; t++) {
            const p = tierData[t].find(p => p.id == id);
            if (p) return p;
        }
        return null;
    }

    // --- Drag and Drop ---
    let draggedItem = null;
    let sourceTier = null;

    function handleDragStart(e) {
        if (!isAdmin) return;
        draggedItem = this;
        sourceTier = parseInt(this.dataset.tier);

        this.classList.add('dragging');
        trashZone.classList.add('visible');
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        trashZone.classList.remove('visible');
        trashZone.classList.remove('drag-over');
        draggedItem = null;
    }

    const columns = document.querySelectorAll('.tier-column');
    columns.forEach(col => {
        col.addEventListener('dragover', (e) => {
            if (isAdmin) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }
        });

        col.addEventListener('drop', (e) => {
            e.preventDefault();
            const targetTier = parseInt(col.dataset.tier);
            if (draggedItem && isAdmin && targetTier !== sourceTier) {
                movePlayer(draggedItem.dataset.id, targetTier);
            }
        });
    });

    trashZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        trashZone.classList.add('drag-over');
    });

    trashZone.addEventListener('dragleave', () => {
        trashZone.classList.remove('drag-over');
    });

    trashZone.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedItem && isAdmin) {
            deletePlayer(draggedItem.dataset.id);
        }
    });

    async function movePlayer(id, newTier) {
        const player = findAndRemoveLocal(id);
        if (player) {
            player.tier = newTier;
            if (!tierData[newTier]) tierData[newTier] = [];
            tierData[newTier].push(player);
            renderAllTiers();

            const result = await apiCall('PUT', { id, tier: newTier });
            if (!result) {
                fetchData(); // Revert on error
            }
        }
    }

    async function deletePlayer(id) {
        if (confirm('Czy na pewno chcesz usunąć tego gracza?')) {
            findAndRemoveLocal(id);
            renderAllTiers();
            await apiCall('DELETE', { id });
        }
    }

    function findAndRemoveLocal(id) {
        for (let t = 1; t <= 5; t++) {
            const idx = tierData[t].findIndex(p => p.id == id);
            if (idx !== -1) {
                return tierData[t].splice(idx, 1)[0];
            }
        }
        return null;
    }
});
