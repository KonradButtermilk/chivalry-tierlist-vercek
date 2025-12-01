/* ========================================
   PLAYER PROFILE V2 - LOGIC
   Simple, reliable, from scratch
   ======================================== */

(function () {
    'use strict';

    console.log('[PROFILE-V2] Version 2.1 loaded - with Admin Lock');

    // Elements
    let modal, loading, error, content, closeBtn;
    let currentPlayerId = null;
    let currentPlayerName = null;

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[PROFILE-V2] Initializing v15');

        modal = document.getElementById('player-profile-modal');
        loading = document.getElementById('profile-loading');
        error = document.getElementById('profile-error');
        content = document.getElementById('profile-content');
        closeBtn = document.getElementById('close-profile-btn');

        if (!modal) {
            console.error('[PROFILE-V2] Modal not found!');
            return;
        }

        // Close button
        if (closeBtn) {
            closeBtn.addEventListener('click', closeProfile);
        }

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('profile-overlay')) {
                closeProfile();
            }
        });

        // Refresh button
        const refreshBtn = document.getElementById('refresh-profile');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (currentPlayerId && currentPlayerName) {
                    openProfile(currentPlayerId, currentPlayerName);
                }
            });
        }

        // Retry button
        const retryBtn = document.getElementById('retry-profile');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                if (currentPlayerId && currentPlayerName) {
                    openProfile(currentPlayerId, currentPlayerName);
                }
            });
        }

        // Copy ID button
        const copyBtn = document.getElementById('copy-id-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', copyPlayFabId);
        }

        // ID search input
        const idSearchInput = document.getElementById('id-search-input');
        if (idSearchInput) {
            let searchTimeout;
            idSearchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const query = e.target.value.trim();
                if (query.length >= 2) {
                    searchTimeout = setTimeout(() => searchForIdAssignment(query), 300);
                } else {
                    hideIdSearchResults();
                }
            });
        }

        // Unassign ID button
        const unassignBtn = document.getElementById('unassign-id-btn');
        if (unassignBtn) {
            unassignBtn.addEventListener('click', unassignPlayFabId);
        }

        console.log('[PROFILE-V2] Initialized');
    });

    // ===== MAIN FUNCTION: Open Profile =====
    async function openProfile(playerId, playerName) {
        console.log('[PROFILE-V3] Opening profile:', playerId, playerName);

        currentPlayerId = playerId;
        currentPlayerName = playerName;

        // Show modal
        modal.classList.remove('hidden');

        // Reset states
        loading.classList.remove('hidden');
        // We don't hide content anymore, we just overlay loading

        // Set player name immediately
        document.getElementById('profile-player-name').textContent = playerName;
        document.getElementById('profile-aka').textContent = '';
        document.getElementById('profile-tier-badge').textContent = 'LOADING';
        document.getElementById('profile-tier-icon').textContent = '⏳';

        // Get player from local data
        let player = window.findPlayerById ? window.findPlayerById(playerId) : null;

        if (!player) {
            player = {
                id: playerId,
                name: playerName,
                tier: null,
                playfab_id: null,
                description: null,
                original_name: null
            };
        }

        try {
            let stats = null;
            let playfabId = null;

            // Try to get PlayFab ID from local player data
            if (player && player.playfab_id) {
                playfabId = player.playfab_id;
                // Fetch stats by ID
                const response = await fetch(`/api/playfab-stats?playfabId=${playfabId}&type=id`);
                const data = await response.json();
                if (data.success || data.playfabId) { // New API returns direct object or wrapped
                    stats = data.data || data;
                    stats.playfabId = playfabId;
                }
            }

            // If no stats yet, search by name
            if (!stats) {
                const response = await fetch(`/api/playfab-stats?playerName=${encodeURIComponent(playerName)}`);
                const data = await response.json();

                if (!data.success || !data.data || !data.data.players || data.data.players.length === 0) {
                    throw new Error('Player not found in API');
                }
                const searchResult = data.data.players[0];
                playfabId = searchResult.playfabId || searchResult.id;
                stats = searchResult;
                stats.playfabId = playfabId;
            }

            // Fetch detailed stats (Leaderboard) for XP/Level if we only have basic info
            if (stats.playfabId && (!stats.globalXp || !stats.experienceWeaponMesser)) {
                try {
                    const detailRes = await fetch(`/api/playfab-stats?playfabId=${stats.playfabId}`);
                    const detailData = await detailRes.json();
                    if (detailData.success && detailData.data) {
                        stats = { ...stats, ...detailData.data };
                    }
                } catch (e) { console.warn('Detail fetch failed', e); }
            }

            // Render profile
            renderProfile(stats, player);

            // Hide loading
            setTimeout(() => loading.classList.add('hidden'), 300); // Small delay for smoothness

        } catch (err) {
            console.error('[PROFILE-V3] Error:', err);

            // Fallback for not found
            if (err.message.includes('not found')) {
                const dummyStats = {
                    id: playerId,
                    name: playerName,
                    displayName: playerName,
                    playfabId: null,
                    level: '-',
                    globalXp: 0
                };
                renderProfile(dummyStats, player);
                loading.classList.add('hidden');
                if (window.showToast) window.showToast('⚠️ Gracz nie znaleziony w API.', 'warning');
            } else {
                loading.classList.add('hidden');
                alert('Failed to load profile: ' + err.message);
            }
        }
    }

    // ===== RENDER PROFILE =====
    function renderProfile(stats, localPlayer) {
        console.log('[PROFILE-V3] Rendering profile', stats);

        if (!localPlayer) localPlayer = { name: stats.displayName || 'Unknown', tier: null };

        // 1. Sidebar Info
        const nameEl = document.getElementById('profile-player-name');
        nameEl.textContent = localPlayer.name;

        const akaEl = document.getElementById('profile-aka');
        akaEl.innerHTML = '';
        if (localPlayer.original_name && localPlayer.original_name !== localPlayer.name) {
            akaEl.textContent = `aka "${localPlayer.original_name}"`;
            if (window.isAdmin) {
                const editBtn = document.createElement('span');
                editBtn.innerHTML = ' ✏️';
                editBtn.style.cursor = 'pointer';
                editBtn.onclick = () => editOriginalName(localPlayer);
                akaEl.appendChild(editBtn);
            }
        } else if (window.isAdmin) {
            const addBtn = document.createElement('span');
            addBtn.innerHTML = '+ Add AKA';
            addBtn.style.cursor = 'pointer';
            addBtn.style.fontSize = '10px';
            addBtn.style.opacity = '0.5';
            addBtn.onclick = () => editOriginalName(localPlayer);
            akaEl.appendChild(addBtn);
        }

        // Tier Badge & Icon
        const tierBadge = document.getElementById('profile-tier-badge');
        const tierIcon = document.getElementById('profile-tier-icon');

        const tierNames = ['GOAT', 'S', 'A', 'B', 'C', 'D', 'F'];
        const tierIcons = ['🐐', '👑', '⚔️', '🛡️', '🗡️', '🪵', '💀'];
        const tierColors = ['#ffd700', '#ff4081', '#4caf50', '#2196f3', '#ff9800', '#795548', '#9e9e9e'];

        if (localPlayer.tier !== null && localPlayer.tier !== undefined) {
            const t = localPlayer.tier;
            tierBadge.textContent = `TIER ${tierNames[t] || t}`;
            tierBadge.style.background = tierColors[t] || '#ddd';
            tierIcon.textContent = tierIcons[t] || '👤';
        } else {
            tierBadge.textContent = 'UNRANKED';
            tierBadge.style.background = '#666';
            tierIcon.textContent = '❔';
        }

        // Stats
        const globalXp = stats.globalXp || 0;
        let level = stats.level || '-';
        if (level === '-' && globalXp > 0) level = Math.floor(globalXp / 20000) || 1;
        if (level > 1000) level = 1000;

        document.getElementById('profile-rank').textContent = stats.globalXpPosition ? `#${stats.globalXpPosition.toLocaleString()}` : '-';
        document.getElementById('profile-level').textContent = level;

        const playtime = stats.playtimeex || stats.totalPlaytime || stats.playtime || 0;
        document.getElementById('profile-hours').textContent = playtime > 0 ? `${Math.round(playtime / 3600)}h` : '-';

        // Determine Class (Simple heuristic based on XP if available)
        let mainClass = '-';
        if (stats.experienceKnight > stats.experienceVanguard && stats.experienceKnight > stats.experienceFootman) mainClass = 'Knight';
        else if (stats.experienceVanguard > stats.experienceKnight && stats.experienceVanguard > stats.experienceFootman) mainClass = 'Vanguard';
        else if (stats.experienceFootman > stats.experienceKnight && stats.experienceFootman > stats.experienceVanguard) mainClass = 'Footman';
        else if (stats.experienceArcher > 1000) mainClass = 'Archer';
        document.getElementById('profile-class').textContent = mainClass;

        // ID & Links
        const idEl = document.getElementById('profile-playfab-id');
        idEl.textContent = stats.playfabId || 'Not assigned';

        const chivLink = document.getElementById('view-chivstats');
        if (stats.playfabId) {
            chivLink.href = `https://chivalry2stats.com/player?id=${stats.playfabId}`;
            chivLink.onclick = null;
        } else {
            chivLink.href = '#';
            chivLink.onclick = (e) => { e.preventDefault(); alert('No ID assigned'); };
        }

        // 2. Main Content - Weapons
        const weaponsContainer = document.getElementById('profile-top-weapons');
        weaponsContainer.innerHTML = '';

        const weapons = [];
        Object.keys(stats).forEach(key => {
            if (key.startsWith('experienceWeapon') && stats[key] > 0 && !key.includes('Position') && !key.includes('Rank')) {
                const name = key.replace('experienceWeapon', '').replace(/([A-Z])/g, ' $1').trim();
                if (!['Bow', 'Crossbow', 'Javelin', 'Throwing Axe', 'Knife', 'Dagger', 'Cudgel', 'Mallet'].includes(name)) {
                    weapons.push({ name, xp: stats[key] });
                }
            }
        });
        weapons.sort((a, b) => b.xp - a.xp);

        if (weapons.length > 0) {
            const maxXP = weapons[0].xp;
            weapons.slice(0, 5).forEach(w => {
                const pct = (w.xp / maxXP) * 100;
                const lvl = Math.floor(w.xp / 1000);

                const row = document.createElement('div');
                row.className = 'weapon-row';
                row.innerHTML = `
                    <div class="weapon-name">${w.name}</div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: 0%"></div>
                    </div>
                    <div class="weapon-lvl">${lvl}</div>
                `;
                weaponsContainer.appendChild(row);

                // Animate width
                setTimeout(() => {
                    row.querySelector('.progress-bar-fill').style.width = `${pct}%`;
                }, 100);
            });
        } else {
            weaponsContainer.innerHTML = '<div style="color:#666; font-size:13px; text-align:center;">No weapon data available</div>';
        }

        // Nicknames
        const aliasesList = document.getElementById('profile-aliases-list');
        const countBadge = document.getElementById('nickname-count');
        aliasesList.innerHTML = '';

        const aliases = stats.aliases || (stats.aliasHistory ? stats.aliasHistory.split(',').map(a => a.trim()).filter(Boolean) : []);
        countBadge.textContent = `(${aliases.length})`;

        if (aliases.length > 0) {
            // Reverse to show newest first? Or oldest first? Usually newest is more interesting.
            // Let's show newest first (reverse)
            [...aliases].reverse().forEach(alias => {
                const tag = document.createElement('span');
                tag.className = 'alias-tag';
                tag.textContent = alias;
                aliasesList.appendChild(tag);
            });
        } else {
            aliasesList.innerHTML = '<div style="color:#666; font-size:13px;">No history</div>';
        }

        // Description
        const descContainer = document.getElementById('profile-description-container');
        descContainer.innerHTML = '';
        const descText = document.createElement('div');
        descText.textContent = localPlayer.description || 'No notes.';
        descContainer.appendChild(descText);

        if (window.isAdmin) {
            const editBtn = document.createElement('button');
            editBtn.className = 'btn-secondary';
            editBtn.style.marginTop = '10px';
            editBtn.style.padding = '5px 10px';
            editBtn.style.fontSize = '11px';
            editBtn.innerHTML = '✏️ Edit Notes';
            editBtn.onclick = () => editDescription(localPlayer);
            descContainer.appendChild(editBtn);
        }

        // Admin Assignment UI
        setupAssignmentUI(localPlayer, window.isAdmin);
    }

    // ===== EDIT HELPERS =====
    async function editOriginalName(player) {
        const newAka = prompt('Podaj oryginalny nick (AKA):', player.original_name || player.name);
        if (newAka !== null) {
            await updatePlayerField(player.id, 'original_name', newAka);
            player.original_name = newAka;
            openProfile(player.id, player.name);
        }
    }

    async function editDescription(player) {
        const newDesc = prompt('Podaj opis gracza:', player.description || '');
        if (newDesc !== null) {
            await updatePlayerField(player.id, 'description', newDesc);
            player.description = newDesc;
            openProfile(player.id, player.name);
        }
    }

    async function updatePlayerField(id, field, value) {
        try {
            const response = await fetch('/api', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-password': localStorage.getItem('admin_password')
                },
                body: JSON.stringify({
                    id: id,
                    [field]: value
                })
            });
            if (!response.ok) throw new Error('Update failed');

            // Update global data
            if (window.tierData) {
                Object.values(window.tierData).flat().forEach(p => {
                    if (String(p.id) === String(id)) {
                        p[field] = value;
                    }
                });
            }
        } catch (e) {
            alert('Błąd aktualizacji: ' + e.message);
        }

    }

    // ===== OPEN ASSIGNMENT MODAL (INLINE) =====
    function openAssignmentModal() {
        const container = document.getElementById('id-assign-section');
        if (!container) return;

        container.innerHTML = `
            <div class="id-search-container" style="display: flex; gap: 5px; margin-top: 10px;">
                <input type="text" id="id-search-input" placeholder="Szukaj gracza (PlayFab)..." class="search-input" style="flex: 1;">
                <button id="id-search-btn" class="btn-primary-compact">🔍</button>
                <button id="id-search-cancel" class="btn-secondary-compact">❌</button>
            </div>
            <div id="id-search-results" class="id-search-results hidden" style="margin-top: 10px; max-height: 150px; overflow-y: auto;"></div>
        `;

        // Bind events
        document.getElementById('id-search-btn').onclick = () => {
            const query = document.getElementById('id-search-input').value;
            if (query) searchForIdAssignment(query);
        };

        document.getElementById('id-search-input').onkeypress = (e) => {
            if (e.key === 'Enter') document.getElementById('id-search-btn').click();
        };

        document.getElementById('id-search-cancel').onclick = () => {
            // Re-render assignment UI (buttons)
            const currentIdText = document.getElementById('profile-playfab-id').textContent;
            const localPlayer = {
                id: currentPlayerId,
                name: currentPlayerName,
                playfab_id: (currentIdText && currentIdText !== '-' && currentIdText !== 'Not assigned') ? currentIdText : null
            };

            setupAssignmentUI(localPlayer, true); // isAdmin is true if we are here
        };

        document.getElementById('id-search-input').focus();
    }

    // ===== ID ASSIGNMENT UI LOGIC =====
    function setupAssignmentUI(localPlayer, isAdmin) {
        console.log('[PROFILE-V2] setupAssignmentUI called', { localPlayer, isAdmin });
        const idAssignSection = document.getElementById('id-assign-section');
        const unassignBtn = document.getElementById('unassign-id-btn');

        if (!idAssignSection) {
            console.warn('[PROFILE-V2] id-assign-section not found!');
            return;
        }

        // Show section only if admin
        if (!isAdmin) {
            idAssignSection.classList.add('hidden');
            return;
        }

        // Reset UI
        idAssignSection.innerHTML = ''; // Clear old inline search
        idAssignSection.classList.remove('hidden');

        const btnContainer = document.createElement('div');
        btnContainer.style.marginTop = '10px';
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';

        if (localPlayer && localPlayer.playfab_id) {
            // HAS ID
            if (unassignBtn) unassignBtn.classList.remove('hidden');

            const changeBtn = document.createElement('button');
            changeBtn.className = 'btn-secondary-compact';
            changeBtn.innerHTML = '✏️ Zmień ID';
            changeBtn.style.flex = '1';
            changeBtn.onclick = () => openAssignmentModal();
            btnContainer.appendChild(changeBtn);

            // Move unassign button to container if it exists
            if (unassignBtn) {
                unassignBtn.style.marginTop = '0';
                unassignBtn.style.flex = '1';
                // We need to clone it to move it, or just append it (it will move)
                // But unassignBtn is outside the container in HTML structure usually
                // Let's just create a new one to be safe and consistent
                const newUnassignBtn = document.createElement('button');
                newUnassignBtn.className = 'btn-danger-compact';
                newUnassignBtn.innerHTML = '🗑️ Usuń ID';
                newUnassignBtn.style.flex = '1';
                newUnassignBtn.onclick = unassignPlayFabId;
                btnContainer.appendChild(newUnassignBtn);

                // Hide the original one to avoid duplicates
                unassignBtn.classList.add('hidden');
            }

        } else {
            // NO ID
            if (unassignBtn) unassignBtn.classList.add('hidden');

            const assignBtn = document.createElement('button');
            assignBtn.className = 'btn-primary-compact';
            assignBtn.innerHTML = '🔗 Przypisz ID';
            assignBtn.onclick = () => openAssignmentModal();
            btnContainer.appendChild(assignBtn);
        }

        idAssignSection.appendChild(btnContainer);
    }

    // ===== COPY PLAYFAB ID =====
    function copyPlayFabId() {
        const idText = document.getElementById('profile-playfab-id').textContent;
        const copyBtn = document.getElementById('copy-id-btn');

        if (idText && idText !== 'Not assigned' && idText !== '-') {
            navigator.clipboard.writeText(idText).then(() => {
                console.log('[PROFILE-V2] ID copied:', idText);
                copyBtn.textContent = '✓';
                copyBtn.classList.add('copied');

                setTimeout(() => {
                    copyBtn.textContent = '📋';
                    copyBtn.classList.remove('copied');
                }, 2000);
            }).catch(err => {
                console.error('[PROFILE-V2] Copy failed:', err);
                alert('Failed to copy ID');
            });
        }
    }

    // ===== SEARCH FOR ID ASSIGNMENT =====
    async function searchForIdAssignment(query) {
        console.log('[PROFILE-V2] Searching for ID assignment:', query);
        const resultsContainer = document.getElementById('id-search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '<div style="padding:10px; text-align:center; color:#888;">Szukanie...</div>';
            resultsContainer.classList.remove('hidden');
        }

        try {
            const response = await fetch(`/api/playfab-stats?playerName=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.success && data.data && data.data.players && data.data.players.length > 0) {
                showIdSearchResults(data.data.players);
            } else {
                if (resultsContainer) resultsContainer.innerHTML = '<div style="padding:10px; text-align:center; color:#888;">Brak wyników</div>';
            }
        } catch (err) {
            console.error('[PROFILE-V2] Search error:', err);
            if (resultsContainer) resultsContainer.innerHTML = '<div style="padding:10px; text-align:center; color:#f44336;">Błąd wyszukiwania</div>';
        }
    }

    function showIdSearchResults(players) {
        const resultsContainer = document.getElementById('id-search-results');
        resultsContainer.innerHTML = '';
        resultsContainer.classList.remove('hidden');

        players.slice(0, 10).forEach(player => {
            let displayName = 'Unknown';
            if (player.aliases && player.aliases.length > 0) {
                displayName = player.aliases[player.aliases.length - 1];
            } else if (player.aliasHistory) {
                const history = player.aliasHistory.split(',');
                displayName = history[history.length - 1].trim();
            }

            // Backend now returns explicit 'level' field
            const level = player.level || (player.globalXp ? Math.floor(player.globalXp / 1000) : '?');
            const playfabId = player.playfabId || player.id;

            const item = document.createElement('div');
            item.className = 'id-search-result-item';
            item.style.padding = '8px';
            item.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
            item.style.cursor = 'pointer';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';

            // Hover effect
            item.onmouseover = () => item.style.background = 'rgba(255,255,255,0.05)';
            item.onmouseout = () => item.style.background = 'transparent';

            item.innerHTML = `
                <div>
                    <div style="font-weight:bold; color:#fff;">${displayName}</div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.5);">${playfabId}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size: 12px; color: #ffd700;">Lvl ${level}</div>
                </div>
            `;

            item.addEventListener('click', () => {
                assignPlayFabId(playfabId, displayName);
            });

            resultsContainer.appendChild(item);
        });
    }

    function hideIdSearchResults() {
        const resultsContainer = document.getElementById('id-search-results');
        if (resultsContainer) {
            resultsContainer.classList.add('hidden');
            resultsContainer.innerHTML = '';
        }
    }

    // ===== ASSIGN PLAYFAB ID =====
    function assignPlayFabId(playfabId, playerName) {
        console.log('[PROFILE-V2] Assigning ID:', playfabId, 'to player:', currentPlayerId);

        if (!currentPlayerId) {
            alert('No player selected');
            return;
        }

        const container = document.getElementById('id-assign-section');
        if (!container) return;

        // Inline confirmation UI
        container.innerHTML = `
            <div style="text-align: center; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="margin-bottom: 15px; font-size: 14px; color: #ddd;">
                    Przypisać ID do gracza <b>${currentPlayerName}</b>?<br>
                    <div style="margin-top:5px; font-size: 12px; color: #aaa;">
                        Znaleziono: <span style="color:#fff">${playerName}</span><br>
                        ID: <span style="font-family:monospace">${playfabId}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="confirm-assign-btn" class="btn-primary-compact" style="background: #4caf50; border-color: #4caf50;">✅ Tak, przypisz</button>
                    <button id="cancel-assign-btn" class="btn-secondary-compact">❌ Anuluj</button>
                </div>
            </div>
        `;

        document.getElementById('cancel-assign-btn').onclick = () => {
            // Revert to search UI
            const currentIdText = document.getElementById('profile-playfab-id').textContent;
            const localPlayer = {
                id: currentPlayerId,
                name: currentPlayerName,
                playfab_id: (currentIdText && currentIdText !== '-' && currentIdText !== 'Not assigned') ? currentIdText : null
            };
            setupAssignmentUI(localPlayer, true);
        };

        document.getElementById('confirm-assign-btn').onclick = async () => {
            const btn = document.getElementById('confirm-assign-btn');
            btn.disabled = true;
            btn.textContent = '⏳ Zapisywanie...';

            try {
                const response = await fetch('/api', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-password': localStorage.getItem('admin_password')
                    },
                    body: JSON.stringify({
                        id: currentPlayerId,
                        id: currentPlayerId,
                        playfab_id: playfabId,
                        name: playerName // Update name in DB as well
                    })
                });

                if (response.ok) {
                    console.log('[PROFILE-V2] Assignment successful');

                    // Update global data immediately so other scripts see it
                    if (window.tierData) {
                        Object.values(window.tierData).flat().forEach(p => {
                            if (String(p.id) === String(currentPlayerId)) {
                                p.playfab_id = playfabId;
                                p.name = playerName; // Update name to match assigned ID
                            }
                        });
                    }

                    // Force UI refresh
                    if (window.loadPlayers) {
                        console.log('[PROFILE-V2] Refreshing UI via loadPlayers');
                        window.loadPlayers();
                    } else if (window.renderAllTiers) {
                        window.renderAllTiers();
                    }

                    // Show success message
                    container.innerHTML = `
                        <div style="text-align: center; padding: 10px; color: #4caf50;">
                            <b>✅ ID Przypisane!</b>
                        </div>
                    `;

                    // Refresh profile after short delay
                    setTimeout(() => {
                        openProfile(currentPlayerId, currentPlayerName);
                    }, 1000);

                } else {
                    throw new Error('Failed to assign ID');
                }
            } catch (err) {
                console.error('[PROFILE-V2] Failed to assign PlayFab ID:', err);
                alert('Błąd: Nie udało się przypisać ID.');
                // Revert UI
                if (document.getElementById('cancel-assign-btn')) {
                    document.getElementById('cancel-assign-btn').click();
                }
            }
        };
    }

    // ===== UNASSIGN PLAYFAB ID =====
    async function unassignPlayFabId() {
        console.log('[PROFILE-V2] Unassigning ID from player:', currentPlayerId);

        if (!confirm('Remove PlayFab ID from this player?')) {
            return;
        }

        try {
            const adminPassword = localStorage.getItem('admin_password');
            const response = await fetch('/api', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-password': adminPassword
                },
                body: JSON.stringify({
                    id: currentPlayerId,
                    playfab_id: null
                })
            });

            const data = await response.json();

            if (response.ok) {
                console.log('[PROFILE-V2] ID unassigned successfully');

                // Update local player data
                const player = window.findPlayerById ? window.findPlayerById(currentPlayerId) : null;
                if (player) {
                    player.playfab_id = null;
                }

                // Show toast
                if (window.showToast) {
                    window.showToast('✅ ID removed successfully!', 'success');
                }

                // Refresh profile
                openProfile(currentPlayerId, currentPlayerName);

            } else {
                throw new Error(data.error || 'Failed to unassign ID');
            }
        } catch (err) {
            console.error('[PROFILE-V2] Unassign error:', err);
            alert('Failed to remove ID: ' + err.message);
        }
    }

    // ===== CLOSE PROFILE =====
    function closeProfile() {
        console.log('[PROFILE-V2] Closing profile');
        modal.classList.add('hidden');
    }

    // ===== EXPOSE TO GLOBAL =====
    // We use a timeout inside DOMContentLoaded to ensure we override script_fixed.js
    // which sets window.openPlayerProfile inside its own DOMContentLoaded listener.
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            window.openPlayerProfile = openProfile;
            console.log('[PROFILE-V2] Overwrote openPlayerProfile globally (timeout 500ms)');
        }, 500);
    });

})();
