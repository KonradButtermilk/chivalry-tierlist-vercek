document.addEventListener('DOMContentLoaded', () => {
    console.log('[INIT] Script Fixed v3.0 loaded - with Fallback Search');
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
    let selectedPlayerIds = new Set();

    // --- Initialization ---
    checkAuth();
    fetchData();

    // --- Global Event Listeners ---
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.classList.add('hidden');
        }
        // Clear selection if clicking on background (not on a card or control)
        if (isAdmin && !e.target.closest('.player-card') && !e.target.closest('.controls') && !e.target.closest('.modal')) {
            selectedPlayerIds.clear();
            document.querySelectorAll('.player-card.selected').forEach(c => c.classList.remove('selected'));
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
        window.isAdmin = isAdmin; // Keep global in sync
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

    // Player selection modal
    const cancelSelectionBtn = document.getElementById('cancel-selection');
    if (cancelSelectionBtn) {
        cancelSelectionBtn.addEventListener('click', () => {
            const selectionModal = document.getElementById('player-selection-modal');
            if (selectionModal) selectionModal.classList.add('hidden');
        });
    }

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
        if (!name || !isAdmin) return;

        showToast('🔍 Wyszukuję gracza...', 'info');

        try {
            // Search ChivalryStats API
            const response = await fetch(`/api/playfab-stats?playerName=${encodeURIComponent(name)}`);
            const data = await response.json();

            if (!data.success || !data.data || !data.data.players || data.data.players.length === 0) {
                showToast('❌ Nie znaleziono gracza', 'error');
                return;
            }

            const players = data.data.players;

            if (players.length === 1) {
                // Single result - add immediately
                await addPlayerFromAPI(players[0]);
            } else {
                // Multiple results - show selection modal
                showPlayerSelectionModal(players);
            }

        } catch (error) {
            console.error('[Add Player] Error:', error);
            showToast('❌ Błąd wyszukiwania - dodaję ręcznie', 'warning');
            // Fallback to manual add
            const newPlayer = await apiCall('POST', { name, tier: 1, source: 'manual' });
            if (newPlayer) {
                tierData[1].push(newPlayer);
                renderTier(1);
                nameInput.value = '';
            }
        }
    }

    async function addPlayerFromAPI(apiPlayer) {
        console.log('[ADD-API] Received player:', apiPlayer);

        // Fix: Use aliases array from API response
        let displayName = 'Unknown';
        if (apiPlayer.aliases && apiPlayer.aliases.length > 0) {
            displayName = apiPlayer.aliases[0];
        } else if (apiPlayer.aliasHistory) {
            displayName = apiPlayer.aliasHistory.split(',')[0].trim();
        } else {
            displayName = apiPlayer.username || apiPlayer.displayName || apiPlayer.name || 'Unknown';
        }

        console.log('[ADD-API] Extracted displayName:', displayName);
        const playfabId = apiPlayer.playfabId || apiPlayer.id;

        // Fetch detailed stats to get current nickname
        try {
            const detailResponse = await fetch(`/api/playfab-stats?playfabId=${playfabId}`);
            const detailData = await detailResponse.json();

            const currentNickname = detailData.success && detailData.data
                ? (detailData.data.displayName || displayName)
                : displayName;

            console.log('[ADD-API] Final nickname:', currentNickname);

            // Add player with API data
            const newPlayer = await apiCall('POST', {
                name: currentNickname,
                tier: 1,
                playfab_id: playfabId,
                source: 'api'  // Mark as from API
            });

            if (newPlayer) {
                tierData[1].push(newPlayer);
                renderTier(1);
                nameInput.value = '';
                showToast(`✅ Dodano: ${currentNickname}`, 'success');
            }
        } catch (error) {
            console.error('[Add From API] Error:', error);
            showToast('❌ Błąd dodawania gracza', 'error');
        }
    }

    function showPlayerSelectionModal(players) {
        console.log('[SELECTION] Showing modal with players:', players);
        const modal = document.getElementById('player-selection-modal');
        const list = document.getElementById('player-selection-list');

        if (!modal || !list) return;

        list.innerHTML = '';

        players.forEach((player, idx) => {
            const item = document.createElement('div');
            item.className = 'selection-item';

            // Fix: Use aliases array from API response
            let displayName = 'Unknown';
            if (player.aliases && player.aliases.length > 0) {
                displayName = player.aliases[0];
            } else if (player.aliasHistory) {
                displayName = player.aliasHistory.split(',')[0].trim();
            } else {
                displayName = player.username || player.displayName || player.name || 'Unknown';
            }

            console.log(`[SELECTION] Player ${idx}: ${displayName}`);
            const level = player.globalXp ? Math.floor(player.globalXp / 1000) : '?';
            const lookupCount = player.lookupCount || 0;

            item.innerHTML = `
                <div class="selection-item-info">
                    <div class="selection-item-name">${displayName}</div>
                    <div class="selection-item-details">
                        Level ${level} • ID: ${(player.playfabId || player.id).substring(0, 8)}...
                        <span style="margin-left: 8px; color: #aaa;">(Wyszukań: ${lookupCount})</span>
                    </div>
                </div>
                <button class="selection-item-btn">Wybierz</button>
            `;

            const btn = item.querySelector('.selection-item-btn');
            btn.addEventListener('click', async () => {
                modal.classList.add('hidden');
                await addPlayerFromAPI(player);
            });

            list.appendChild(item);
        });

        modal.classList.remove('hidden');
    }

    function renderAllTiers() {
        for (let i = 0; i <= 6; i++) {
            renderTier(i);
        }
        // Update stats if available
        if (typeof updateStatistics === 'function') {
            updateStatistics();
        }
    }

    // Placeholder for stats update (overridden by enhancements.js if present)
    function updateStatistics() {
        // This function is intended to be overridden or extended
        const event = new CustomEvent('statsUpdated');
        document.dispatchEvent(event);
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

        // Visual distinction ONLY for players added directly from API search
        // Not for manually added players that later got playfab_id assigned
        if (player.source === 'api') {
            div.classList.add('from-api');
        }

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

            // Click handling for Selection (Standard Logic)
            div.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent background click from clearing
                const id = String(player.id);

                if (e.ctrlKey || e.metaKey) {
                    // Toggle selection
                    if (selectedPlayerIds.has(id)) {
                        selectedPlayerIds.delete(id);
                        div.classList.remove('selected');
                    } else {
                        selectedPlayerIds.add(id);
                        div.classList.add('selected');
                    }
                } else {
                    // Single select (clear others)
                    selectedPlayerIds.clear();
                    document.querySelectorAll('.player-card.selected').forEach(c => c.classList.remove('selected'));
                    selectedPlayerIds.add(id);
                    div.classList.add('selected');
                }
            });

            // Context Menu Trigger
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                // If right-clicking an unselected item, select it (exclusive)
                const id = String(player.id);
                if (!selectedPlayerIds.has(id)) {
                    selectedPlayerIds.clear();
                    document.querySelectorAll('.player-card.selected').forEach(c => c.classList.remove('selected'));
                    selectedPlayerIds.add(id);
                    div.classList.add('selected');
                }
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
        window.selectedPlayerId = player.id; // Expose to global scope for stats-list.js
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.classList.remove('hidden');
    }

    ctxStats.addEventListener('click', async () => {
        if (selectedPlayerId) {
            const player = findPlayerById(selectedPlayerId);
            if (player) {
                openPlayerProfile(selectedPlayerId, player.name);
                contextMenu.classList.add('hidden');
            }
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

    // --- Toast Notification ---
    function showToast(message, type = 'info') {
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        // Trigger reflow
        toast.offsetHeight;

        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }
    // ===== ENHANCED PLAYER PROFILE =====

    async function openPlayerProfile(playerId, playerName, isSearch = false) {
        const modal = document.getElementById('player-profile-modal');
        const loading = document.getElementById('profile-loading');
        const content = document.getElementById('profile-content');
        const error = document.getElementById('profile-error');

        // Clear previous data to prevent persistence
        const clearElements = [
            'profile-rank', 'profile-level', 'profile-hours', 'profile-class',
            'profile-top-weapons', 'profile-class-exp', 'profile-aliases-list',
            'profile-search-count', 'profile-last-seen', 'profile-supporter', 'profile-playfab-id'
        ];
        clearElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.tagName === 'DIV') el.innerHTML = '';
                else el.textContent = '-';
            }
        });

        // Show modal and loading state
        if (modal) modal.classList.remove('hidden');
        if (loading) loading.classList.remove('hidden');
        if (content) content.classList.add('hidden');
        if (error) error.classList.add('hidden');

        // Set player name
        const nameEl = document.getElementById('profile-player-name');
        if (nameEl) nameEl.textContent = playerName;

        // Find player tier
        const player = findPlayerById(playerId);
        if (player) {
            const tierNames = ['GOAT', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5', 'Tier 6'];
            const tierBadge = document.getElementById('profile-tier-badge');
            if (tierBadge) tierBadge.textContent = tierNames[player.tier] || `Tier ${player.tier}`;
        }

        try {
            let stats;
            let playfabId;

            // 1. Check if we have stored PlayFab ID
            if (!isSearch && player && player.playfab_id) {
                console.log('[Profile] Has stored PlayFab ID:', player.playfab_id);
                playfabId = player.playfab_id;

                // Try to fetch full stats directly
                try {
                    const response = await fetch(`/api/playfab-stats?playfabId=${player.playfab_id}`);
                    const data = await response.json();

                    if (data.success && data.data) {
                        stats = data.data;
                        stats.playfabId = player.playfab_id;
                        console.log('[Profile] Got detailed stats from stored ID');
                    }
                } catch (err) {
                    console.warn('[Profile] Failed to fetch by stored ID, will search by name:', err);
                }
            }

            // 2. If no stats yet, search by name
            if (!stats) {
                console.log('[Profile] Searching by name:', playerName);
                const response = await fetch(`/api/playfab-stats?` + new URLSearchParams({
                    playerName: playerName
                }));
                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || data.details || 'Brak danych');
                }

                // The API returns { players: [...] } with search results
                if (data.data && data.data.players && data.data.players.length > 0) {
                    // Find the best match (prefer exact match or first result)
                    let bestMatch = data.data.players[0];

                    // If we have a stored PlayFab ID, try to find exact match
                    if (playfabId) {
                        const exactMatch = data.data.players.find(p => p.playfabId === playfabId);
                        if (exactMatch) bestMatch = exactMatch;
                    }

                    playfabId = bestMatch.playfabId || bestMatch.id;

                    // Now fetch full details using the PlayFab ID
                    console.log('[Profile] Fetching detailed stats for:', playfabId);
                    const detailResponse = await fetch(`/api/playfab-stats?playfabId=${playfabId}`);
                    const detailData = await detailResponse.json();

                    if (detailData.success && detailData.data) {
                        stats = detailData.data;
                        stats.playfabId = playfabId;
                        console.log('[Profile] Got detailed stats from search');
                    } else {
                        throw new Error(detailData.error || detailData.details || 'Nie udało się pobrać szczegółów gracza');
                    }
                } else {
                    throw new Error('Nie znaleziono gracza');
                }
            }


            // Calculate derived stats from raw data
            const playtime = stats.totalPlaytime || stats.playtimeex || stats.playtime || 0;
            const playtimeHours = playtime > 0 ? Math.round(playtime / 3600) : 0;
            const globalRank = stats.globalXpPosition || stats.global_rank || '-';
            const globalXp = stats.globalXp || 0;
            const level = globalXp > 0 ? Math.floor(globalXp / 1000) : '-';

            // Set Avatar (first letter of name)
            const avatarEl = document.getElementById('profile-avatar');
            if (avatarEl) {
                avatarEl.textContent = playerName.charAt(0).toUpperCase();
            }

            // Render Quick Stats
            const rankEl = document.getElementById('profile-rank');
            const levelEl = document.getElementById('profile-level');
            const hoursEl = document.getElementById('profile-hours');
            const classEl = document.getElementById('profile-class');

            if (rankEl) rankEl.textContent = globalRank !== '-' ? `#${globalRank.toLocaleString()}` : '-';
            if (levelEl) levelEl.textContent = level || '-';
            if (hoursEl) hoursEl.textContent = playtimeHours > 0 ? `${playtimeHours.toLocaleString()}h` : '-';

            // Determine favorite class from experience values
            let favoriteClass = 'Brak danych';
            const classExp = {
                'Knight': stats.experienceKnight || 0,
                'Vanguard': stats.experienceVanguard || 0,
                'Footman': stats.experienceFootman || 0,
                'Archer': stats.experienceArcher || 0
            };
            const maxClass = Object.entries(classExp).reduce((a, b) => a[1] > b[1] ? a : b);
            if (maxClass[1] > 0) favoriteClass = maxClass[0];
            if (classEl) classEl.textContent = favoriteClass;

            // Render Top 4 Weapons
            const topWeaponsContainer = document.getElementById('profile-top-weapons');
            if (topWeaponsContainer) {
                topWeaponsContainer.innerHTML = '';

                // Collect all weapon experience
                const weapons = [];
                Object.keys(stats).forEach(key => {
                    if (key.startsWith('experienceWeapon') && stats[key] > 0) {
                        const weaponName = key.replace('experienceWeapon', '').replace(/([A-Z])/g, ' $1').trim();
                        weapons.push({ name: weaponName, xp: stats[key] });
                    }
                });

                // Sort and get top 4
                weapons.sort((a, b) => b.xp - a.xp);
                const top4 = weapons.slice(0, 4);

                top4.forEach((weapon, index) => {
                    const item = document.createElement('div');
                    item.className = 'weapon-item';
                    item.innerHTML = `
                        <div class="weapon-info">
                            <div class="weapon-rank">${index + 1}</div>
                            <div class="weapon-name">${weapon.name}</div>
                        </div>
                        <div class="weapon-xp">${(weapon.xp / 1000).toFixed(1)}k XP</div>
                    `;
                    topWeaponsContainer.appendChild(item);
                });

                if (top4.length === 0) {
                    topWeaponsContainer.innerHTML = '<p style="color: rgba(255,255,255,0.5);">Brak danych o broniach</p>';
                }
            }

            // Render Class Experience Bars
            const classExpContainer = document.getElementById('profile-class-exp');
            if (classExpContainer) {
                classExpContainer.innerHTML = '';
                const maxXp = Math.max(...Object.values(classExp));

                Object.entries(classExp).forEach(([className, xp]) => {
                    const percentage = maxXp > 0 ? (xp / maxXp) * 100 : 0;
                    const item = document.createElement('div');
                    item.className = 'class-exp-item';
                    item.innerHTML = `
                        <div class="class-exp-header">
                            <span class="class-name">${className}</span>
                            <span class="class-xp-value">${(xp / 1000).toFixed(1)}k XP</span>
                        </div>
                        <div class="class-exp-bar">
                            <div class="class-exp-fill" style="width: ${percentage}%"></div>
                        </div>
                    `;
                    classExpContainer.appendChild(item);
                });
            }

            // Render Activity Chart (simplified - based on lookup count)
            const activityChart = document.getElementById('profile-activity-chart');
            if (activityChart) {
                activityChart.innerHTML = '';
                const lookupCount = stats.lookupCount || 0;

                // Create 52 weeks of activity boxes
                for (let i = 0; i < 52; i++) {
                    const day = document.createElement('div');
                    day.className = 'activity-day';

                    // Simulate activity level based on lookup count
                    const level = lookupCount > 100 ? 3 : lookupCount > 50 ? 2 : lookupCount > 10 ? 1 : 0;
                    const randomFactor = Math.random();
                    const activityLevel = randomFactor > 0.7 ? level : Math.max(0, level - 1);

                    day.style.background = [
                        'rgba(255, 255, 255, 0.1)',
                        'rgba(212, 175, 55, 0.3)',
                        'rgba(212, 175, 55, 0.6)',
                        '#d4af37'
                    ][activityLevel];

                    day.title = `Aktywność: ${['Brak', 'Niska', 'Średnia', 'Wysoka'][activityLevel]}`;
                    activityChart.appendChild(day);
                }
            }

            // Render Nickname History with Collapsible
            const aliasesList = document.getElementById('profile-aliases-list');
            const aliasesContainer = document.getElementById('profile-aliases-container');
            const nicknameCount = document.getElementById('nickname-count');
            const nicknameToggle = document.getElementById('nickname-history-toggle');

            if (aliasesList && aliasesContainer) {
                aliasesList.innerHTML = '';
                const aliases = stats.aliases || (stats.aliasHistory ? stats.aliasHistory.split(',').map(a => a.trim()).filter(Boolean) : []);

                if (aliases && aliases.length > 0) {
                    if (nicknameCount) nicknameCount.textContent = `(${aliases.length})`;

                    aliases.forEach(alias => {
                        const chip = document.createElement('div');
                        chip.className = 'nickname-chip';
                        chip.textContent = alias;
                        aliasesList.appendChild(chip);
                    });

                    // Add toggle functionality
                    if (nicknameToggle) {
                        nicknameToggle.onclick = () => {
                            aliasesContainer.classList.toggle('collapsed');
                            nicknameToggle.classList.toggle('expanded');
                        };
                    }
                } else {
                    if (nicknameCount) nicknameCount.textContent = '(0)';
                    aliasesList.innerHTML = '<p style="color: rgba(255,255,255,0.5);">Brak historii nicków</p>';
                }
            }

            // Render Additional Info
            const searchCountEl = document.getElementById('profile-search-count');
            const lastSeenEl = document.getElementById('profile-last-seen');
            const supporterEl = document.getElementById('profile-supporter');
            const playfabIdEl = document.getElementById('profile-playfab-id');

            if (searchCountEl) searchCountEl.textContent = stats.lookupCount || '-';
            if (lastSeenEl) {
                const lastLookup = stats.lastLookup;
                if (lastLookup) {
                    const date = new Date(lastLookup);
                    lastSeenEl.textContent = date.toLocaleDateString('pl-PL');
                } else {
                    lastSeenEl.textContent = '-';
                }
            }
            if (supporterEl) supporterEl.textContent = stats.supporter ? '✅ Tak' : '❌ Nie';
            if (playfabIdEl) playfabIdEl.textContent = stats.playfabId || '-';

            // Set cache badge
            const cacheBadge = document.getElementById('profile-cache-badge');
            if (cacheBadge) {
                cacheBadge.textContent = '✨ Świeże dane';
                cacheBadge.style.borderColor = '#4caf50';
                cacheBadge.style.color = '#4caf50';
            }

            // Set ChivalryStats link
            const chivStatsLink = document.getElementById('view-chivstats');
            if (chivStatsLink) {
                chivStatsLink.href = `https://chivalry2stats.com/player?id=${stats.playfabId || ''}`;
            }

            // Handle Assign/Unassign ID Buttons
            const assignBtn = document.getElementById('assign-id-btn');
            const unassignBtn = document.getElementById('unassign-id-btn');

            if (assignBtn && unassignBtn) {
                if (isAdmin && stats.playfabId) {
                    if (player && player.playfab_id) {
                        // Already assigned - show unassign
                        assignBtn.classList.add('hidden');
                        unassignBtn.classList.remove('hidden');
                    } else {
                        // Not assigned - show assign
                        assignBtn.classList.remove('hidden');
                        assignBtn.dataset.playfabId = stats.playfabId;
                        unassignBtn.classList.add('hidden');
                    }
                } else {
                    assignBtn.classList.add('hidden');
                    unassignBtn.classList.add('hidden');
                }
            }

            // Show content
            content.classList.remove('hidden');

        } catch (err) {
            console.error('Profile load error:', err);
            error.classList.remove('hidden');
            document.getElementById('profile-error-msg').textContent = err.message || 'Nieznany błąd';
        } finally {
            loading.classList.add('hidden');
        }
    }

    // Profile modal event listeners
    const closeProfileBtn = document.getElementById('close-profile-btn');
    const refreshProfileBtn = document.getElementById('refresh-profile');
    const retryProfileBtn = document.getElementById('retry-profile');
    const profileModal = document.getElementById('player-profile-modal');

    if (closeProfileBtn) {
        closeProfileBtn.addEventListener('click', () => {
            profileModal.classList.add('hidden');
        });
    }

    if (refreshProfileBtn) {
        refreshProfileBtn.addEventListener('click', async () => {
            const playerName = document.getElementById('profile-player-name').textContent;
            const playerId = selectedPlayerId;
            if (playerId && playerName) {
                showToast('Odświeżanie danych...', 'info');
                profileModal.classList.add('hidden');
                setTimeout(() => {
                    openPlayerProfile(playerId, playerName);
                }, 100);
            }
        });
    }

    if (retryProfileBtn) {
        retryProfileBtn.addEventListener('click', () => {
            const playerName = document.getElementById('profile-player-name').textContent;
            const playerId = selectedPlayerId;
            if (playerId && playerName) {
                openPlayerProfile(playerId, playerName);
            }
        });
    }

    // Close on overlay click
    if (profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal || e.target.classList.contains('profile-overlay')) {
                profileModal.classList.add('hidden');
            }
        });
    }

    // --- New Features: Search & Assign ID ---
    const profileSearchBtn = document.getElementById('profile-search-btn');
    const profileSearchInput = document.getElementById('profile-search-input');
    const assignIdBtn = document.getElementById('assign-id-btn');

    if (profileSearchBtn && profileSearchInput) {
        profileSearchBtn.addEventListener('click', () => {
            const query = profileSearchInput.value.trim();
            if (query) {
                // Search for new player, keeping the original selected ID for assignment
                openPlayerProfile(selectedPlayerId, query, true);
            }
        });

        profileSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') profileSearchBtn.click();
        });
    }

    if (assignIdBtn) {
        assignIdBtn.addEventListener('click', async () => {
            const currentPlayFabId = assignIdBtn.dataset.playfabId;
            const targetPlayerId = selectedPlayerId;

            console.log('[ASSIGN] Assigning PlayFab ID:', currentPlayFabId, 'to player:', targetPlayerId);
            console.log('[ASSIGN] selectedPlayerId:', selectedPlayerId);
            console.log('[ASSIGN] dataset.playfabId:', assignIdBtn.dataset.playfabId);

            if (currentPlayFabId && targetPlayerId) {
                if (confirm('Czy na pewno chcesz przypisać to ID do gracza?')) {
                    try {
                        console.log('[ASSIGN] Sending PUT request...');
                        // Use the main API endpoint
                        const response = await fetch('/api', {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-admin-password': adminPassword
                            },
                            body: JSON.stringify({
                                id: targetPlayerId,
                                playfab_id: currentPlayFabId
                            })
                        });

                        console.log('[ASSIGN] Response status:', response.status);
                        const responseData = await response.json();
                        console.log('[ASSIGN] Response data:', responseData);

                        if (response.ok) {
                            console.log('[ASSIGN] Successfully assigned ID');
                            showToast('✅ ID przypisane pomyślnie!', 'success');
                            const player = findPlayerById(targetPlayerId);
                            if (player) {
                                player.playfab_id = currentPlayFabId;
                                console.log('[ASSIGN] Updated player:', player);
                            }
                            renderAllTiers();
                        } else {
                            console.error('[ASSIGN] API returned error:', responseData);
                            throw new Error('Failed to update');
                        }
                    } catch (err) {
                        console.error('[ASSIGN] Error:', err);
                        showToast('❌ Błąd przypisywania ID', 'error');
                    }
                }
            } else {
                console.error('[ASSIGN] Missing data - currentPlayFabId:', currentPlayFabId, 'targetPlayerId:', targetPlayerId);
            }
        });
    }

    // Unassign button listener
    const unassignIdBtn = document.getElementById('unassign-id-btn');
    if (unassignIdBtn) {
        unassignIdBtn.addEventListener('click', async () => {
            const targetPlayerId = selectedPlayerId;

            console.log('[UNASSIGN] Removing PlayFab ID from player:', targetPlayerId);

            if (targetPlayerId) {
                if (confirm('Czy na pewno chcesz usunąć przypisanie ID?')) {
                    try {
                        const response = await fetch('/api', {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-admin-password': adminPassword
                            },
                            body: JSON.stringify({
                                id: targetPlayerId,
                                playfab_id: null
                            })
                        });

                        if (response.ok) {
                            console.log('[UNASSIGN] Successfully removed ID');
                            showToast('✅ Przypisanie usunięte!', 'success');
                            const player = findPlayerById(targetPlayerId);
                            if (player) player.playfab_id = null;
                            renderAllTiers();
                            // Close profile modal
                            const profileModal = document.getElementById('player-profile-modal');
                            if (profileModal) profileModal.classList.add('hidden');
                        } else {
                            console.error('[UNASSIGN] API returned error status:', response.status);
                            throw new Error('Failed to update');
                        }
                    } catch (err) {
                        console.error('[UNASSIGN] Error:', err);
                        showToast('❌ Błąd usuwania przypisania', 'error');
                    }
                }
            }
        });
    }

    // --- Refresh Nicknames Function ---
    async function refreshAllNicknames() {
        console.log('[REFRESH] Starting nickname refresh');
        if (!isAdmin) {
            showToast('❌ Wymagane uprawnienia administratora', 'error');
            return;
        }

        // Get all players with PlayFab IDs - tierData is an object {0: [], 1: [], ...}
        const allPlayers = Object.values(tierData).flat();
        const playersWithId = allPlayers.filter(p => p.playfab_id);

        console.log(`[REFRESH] Found ${playersWithId.length} players with PlayFab IDs`);

        if (playersWithId.length === 0) {
            showToast('ℹ️ Brak graczy z przypisanym ID', 'info');
            return;
        }

        if (!confirm(`Czy na pewno chcesz odświeżyć nicki ${playersWithId.length} graczy? To może potrwać chwilę.`)) {
            return;
        }

        showToast('🔄 Rozpoczynanie aktualizacji nicków...', 'info');
        let updatedCount = 0;
        let errorCount = 0;

        for (const player of playersWithId) {
            try {
                console.log(`[REFRESH] Checking player: ${player.name} (ID: ${player.playfab_id})`);

                // Fetch latest data from API
                const response = await fetch(`/api/playfab-stats?playfabId=${player.playfab_id}`);
                if (response.ok) {
                    const data = await response.json();
                    const stats = data.data;
                    console.log(`[REFRESH] Got stats for ${player.name}:`, stats);

                    // Get latest nickname from aliases
                    let newNickname = 'Unknown';

                    // Log raw data for debugging special characters
                    console.log(`[REFRESH] Raw aliases for ${player.name}:`, stats.aliases);
                    console.log(`[REFRESH] Raw aliasHistory for ${player.name}:`, stats.aliasHistory);

                    if (Array.isArray(stats.aliases) && stats.aliases.length > 0) {
                        newNickname = stats.aliases[0];
                    } else if (typeof stats.aliasHistory === 'string' && stats.aliasHistory.length > 0) {
                        // Handle comma-separated list, taking the first item
                        // Note: PlayFab display names shouldn't contain commas, but we trim just in case
                        const parts = stats.aliasHistory.split(',');
                        if (parts.length > 0) {
                            newNickname = parts[0].trim();
                        }
                    } else if (stats.LastKnownAlias) {
                        // Update in DB
                        const updateRes = await fetch('/api', {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-admin-password': adminPassword
                            },
                            body: JSON.stringify({
                                id: player.id,
                                name: newNickname
                            })
                        });

                        if (updateRes.ok) {
                            console.log(`[REFRESH] ✓ Updated ${player.name} successfully`);
                            player.name = newNickname; // Update local state
                            updatedCount++;
                        } else {
                            console.error(`[REFRESH] ✗ Failed to update ${player.name}, status:`, updateRes.status);
                            errorCount++;
                        }
                    } else {
                        console.log(`[REFRESH] No update needed for ${player.name}`);
                    }
                } else {
                    console.error(`[REFRESH] Failed to fetch stats for ${player.name}, status:`, response.status);
                    errorCount++;
                }
            } catch (e) {
                console.error(`[REFRESH] Failed to update ${player.name}:`, e);
                errorCount++;
            }

            // Small delay to be nice to the API
            await new Promise(r => setTimeout(r, 300));
        }

        console.log(`[REFRESH] Complete! Updated: ${updatedCount}, Errors: ${errorCount}`);

        if (updatedCount > 0) {
            showToast(`✅ Zaktualizowano ${updatedCount} nicków!`, 'success');
            renderAllTiers(); // Re-render all tiers
        } else {
            showToast('ℹ️ Wszystkie nicki są aktualne', 'info');
        }

        if (errorCount > 0) {
            showToast(`⚠️ ${errorCount} błędów podczas aktualizacji`, 'warning');
        }
    }

    // Add listener for refresh button
    const refreshNicknamesBtn = document.getElementById('refresh-nicknames-btn');
    if (refreshNicknamesBtn) {
        refreshNicknamesBtn.addEventListener('click', refreshAllNicknames);
        console.log('[INIT] Refresh nicknames button listener added');
    }

    // --- Expose functions for enhancements.js and stats-list.js ---
    window.loadPlayers = fetchData;
    window.updatePlayerTier = movePlayer;
    window.deletePlayer = deletePlayer;
    window.updateStatistics = updateStatistics;
    window.findPlayerById = findPlayerById;
    window.isAdmin = isAdmin;
});
