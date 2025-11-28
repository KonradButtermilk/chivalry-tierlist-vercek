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
    const toggleSelectionBtn = document.getElementById('toggle-selection-mode');

    // Context Menu & Edit Modal
    const contextMenu = document.getElementById('context-menu');
    const ctxStats = document.getElementById('ctx-stats');
    const ctxEdit = document.getElementById('ctx-edit');
    const ctxDelete = document.getElementById('ctx-delete');
    const editModal = document.getElementById('edit-modal');
    const editNameInput = document.getElementById('edit-name');
    const editDescInput = document.getElementById('edit-desc');
    const saveEditBtn = document.getElementById('save-edit');
    const cancelEditBtn = document.getElementById('cancel-edit');

    // State
    let tierData = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    let isAdmin = false;
    let adminPassword = '';
    let selectedPlayerId = null; // For context menu actions

    // Bulk Selection State
    let isSelectionMode = false;
    let selectedPlayerIds = new Set();

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

    // Toggle Selection Mode
    toggleSelectionBtn?.addEventListener('click', () => {
        isSelectionMode = !isSelectionMode;
        updateSelectionModeUI();
    });

    function updateSelectionModeUI() {
        const tierBoard = document.querySelector('.tier-board');
        if (isSelectionMode) {
            toggleSelectionBtn.classList.add('active');
            tierBoard.classList.add('selection-mode');
        } else {
            toggleSelectionBtn.classList.remove('active');
            tierBoard.classList.remove('selection-mode');

            // Clear selections
            selectedPlayerIds.clear();
            document.querySelectorAll('.player-card.selected').forEach(card => {
                card.classList.remove('selected');
            });
        }
    }

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
            tierData = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

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
                    tierData = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

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
        for (let i = 0; i <= 6; i++) {
            renderTier(i);
        }
        // Update stats if available
        if (window.updateStatistics) window.updateStatistics();
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
        div.className = `player-card tier-${player.tier}`;

        // Restore selection state if re-rendering
        if (selectedPlayerIds.has(String(player.id))) {
            div.classList.add('selected');
        }

        // Player Name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'player-name';
        nameSpan.textContent = player.name;
        div.appendChild(nameSpan);

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

            // Click handling for Selection Mode
            div.addEventListener('click', (e) => {
                if (isSelectionMode) {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = String(player.id);
                    if (selectedPlayerIds.has(id)) {
                        selectedPlayerIds.delete(id);
                        div.classList.remove('selected');
                    } else {
                        selectedPlayerIds.add(id);
                        div.classList.add('selected');
                    }
                }
            });

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

    ctxStats.addEventListener('click', () => {
        if (selectedPlayerId) {
            const player = findPlayerById(selectedPlayerId);
            if (player) {
                // Copy to clipboard
                navigator.clipboard.writeText(player.name).then(() => {
                    alert(`Skopiowano nick: "${player.name}"\n\n1. Strona ChivalryStats otworzy się w nowej karcie.\n2. Wybierz zakładkę "Username Search".\n3. Wklej nick i kliknij Submit.`);
                    // Open ChivalryStats player lookup
                    window.open('https://chivalry2stats.com/player', '_blank');
                });
            }
            contextMenu.classList.add('hidden');
        }
    });

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
        for (let t = 0; t <= 6; t++) {
            const p = tierData[t].find(p => p.id == id);
            if (p) return p;
        }
        return null;
    }

    // --- Drag and Drop (Multi-Drag Support) ---
    let draggedItem = null;
    let sourceTier = null;

    function handleDragStart(e) {
        if (!isAdmin) return;
        draggedItem = this;
        sourceTier = parseInt(this.dataset.tier);
        const id = this.dataset.id;

        // Logic for Multi-Drag:
        // If we are dragging an item that is ALREADY selected, we want to keep the selection (to move group).
        // If we are dragging an item that is NOT selected, we should select it (and clear others unless Ctrl is held).

        if (!selectedPlayerIds.has(id)) {
            // Item not selected.
            if (!e.ctrlKey && !e.metaKey) {
                // Clear others if no modifier key
                selectedPlayerIds.clear();
                document.querySelectorAll('.player-card.selected').forEach(c => c.classList.remove('selected'));
            }
            // Select this one
            selectedPlayerIds.add(id);
            this.classList.add('selected');
        }
        // If it WAS selected, we do nothing (keep the group selection).

        this.classList.add('dragging');
        trashZone.classList.add('visible');

        // Visual feedback for multi-drag
        if (selectedPlayerIds.size > 1) {
            const ghost = document.createElement('div');
            ghost.textContent = `${selectedPlayerIds.size} graczy`;
            ghost.style.background = '#d4af37';
            ghost.style.color = '#000';
            ghost.style.padding = '5px 10px';
            ghost.style.borderRadius = '4px';
            ghost.style.fontWeight = 'bold';
            ghost.style.position = 'absolute';
            ghost.style.top = '-1000px';
            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, 0, 0);
            setTimeout(() => document.body.removeChild(ghost), 0);
        }

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

        col.addEventListener('drop', async (e) => {
            e.preventDefault();
            const targetTier = parseInt(col.dataset.tier);

            if (isAdmin && selectedPlayerIds.size > 0) {
                // Move all selected players
                const idsToMove = Array.from(selectedPlayerIds);

                // Optimistic update
                for (const id of idsToMove) {
                    const player = findAndRemoveLocal(id);
                    if (player) {
                        player.tier = targetTier;
                        if (!tierData[targetTier]) tierData[targetTier] = [];
                        tierData[targetTier].push(player);
                    }
                }
                renderAllTiers();

                // API Calls
                for (const id of idsToMove) {
                    await apiCall('PUT', { id, tier: targetTier });
                }

                // Clear selection after move
                selectedPlayerIds.clear();
                if (isSelectionMode) updateSelectionModeUI(); // Refresh UI
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

    trashZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (isAdmin && selectedPlayerIds.size > 0) {
            const idsToDelete = Array.from(selectedPlayerIds);

            if (confirm(`Czy na pewno chcesz usunąć ${idsToDelete.length} graczy?`)) {
                // Optimistic update
                for (const id of idsToDelete) {
                    findAndRemoveLocal(id);
                }
                renderAllTiers();

                // API Calls
                for (const id of idsToDelete) {
                    await apiCall('DELETE', { id });
                }

                selectedPlayerIds.clear();
                if (isSelectionMode) updateSelectionModeUI();
            }
        }
    });

    async function movePlayer(id, newTier) {
        // Legacy single move function, kept just in case
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
        for (let t = 0; t <= 6; t++) {
            const idx = tierData[t].findIndex(p => p.id == id);
            if (idx !== -1) {
                return tierData[t].splice(idx, 1)[0];
            }
        }
        return null;
    }

    // --- Expose functions for enhancements.js ---
    window.loadPlayers = fetchData;
    window.updatePlayerTier = movePlayer;
    window.deletePlayer = deletePlayer;
});
