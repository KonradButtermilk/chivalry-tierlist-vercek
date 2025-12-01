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
        console.log('[PROFILE-V2] Initializing');

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
        console.log('[PROFILE-V2] Opening profile:', playerId, playerName);

        currentPlayerId = playerId;
        currentPlayerName = playerName;

        // Show modal
        modal.classList.remove('hidden');

        // Reset states
        loading.classList.remove('hidden');
        error.classList.add('hidden');
        content.classList.add('hidden');

        // Set player name immediately
        document.getElementById('profile-player-name').textContent = playerName;

        // Get player from local data to show tier
        const player = window.findPlayerById ? window.findPlayerById(playerId) : null;
        if (player) {
            const tierNames = ['GOAT', 'S', 'A', 'B', 'C', 'D', 'F'];
            document.getElementById('profile-tier-badge').textContent = tierNames[player.tier] || `Tier ${player.tier}`;
        }

        try {
            let stats = null;
            let playfabId = null;

            // Try to get PlayFab ID from local player data
            if (player && player.playfab_id) {
                playfabId = player.playfab_id;
                console.log('[PROFILE-V2] Has stored PlayFab ID:', playfabId);

                // Fetch stats by ID
                const response = await fetch(`/api/playfab-stats?playfabId=${playfabId}`);
                const data = await response.json();

                if (data.success && data.data) {
                    stats = data.data;
                    stats.playfabId = playfabId;
                }
            }

            // If no stats yet, search by name
            if (!stats) {
                console.log('[PROFILE-V2] Searching by name:', playerName);
                const response = await fetch(`/api/playfab-stats?playerName=${encodeURIComponent(playerName)}`);
                const data = await response.json();

                if (!data.success || !data.data || !data.data.players || data.data.players.length === 0) {
                    throw new Error('Player not found in API');
                }

                // Use first result
                const searchResult = data.data.players[0];
                playfabId = searchResult.playfabId || searchResult.id;

                // Fetch full stats
                const detailResponse = await fetch(`/api/playfab-stats?playfabId=${playfabId}`);
                const detailData = await detailResponse.json();

                if (detailData.success && detailData.data) {
                    stats = detailData.data;
                    stats.playfabId = playfabId;
                } else {
                    throw new Error('Failed to get player details');
                }
            }

            console.log('[PROFILE-V2] Got stats:', stats);

            // Render profile
            renderProfile(stats, player);

            // Show content
            loading.classList.add('hidden');
            content.classList.remove('hidden');

        } catch (err) {
            console.error('[PROFILE-V2] Error:', err);
            loading.classList.add('hidden');
            error.classList.remove('hidden');
            document.getElementById('profile-error-msg').textContent = err.message || 'Failed to load profile';
        }
    }

    // ===== RENDER PROFILE =====
    function renderProfile(stats, localPlayer) {
        console.log('[PROFILE-V2] Rendering profile');

        // Calculate derived stats
        const playtime = stats.totalPlaytime || stats.playtimeex || stats.playtime || 0;
        const playtimeHours = playtime > 0 ? Math.round(playtime / 3600) : 0;
        const globalRank = stats.globalXpPosition || stats.global_rank || '-';
        const globalXp = stats.globalXp || 0;
        const level = globalXp > 0 ? Math.floor(globalXp / 1000) : '-';

        // Quick stats
        document.getElementById('profile-rank').textContent = globalRank !== '-' ? `#${globalRank.toLocaleString()}` : '-';
        document.getElementById('profile-level').textContent = level || '-';
        document.getElementById('profile-hours').textContent = playtimeHours > 0 ? `${playtimeHours.toLocaleString()}h` : '-';

        // Favorite class
        const classExp = {
            'Knight': stats.experienceKnight || 0,
            'Vanguard': stats.experienceVanguard || 0,
            'Footman': stats.experienceFootman || 0,
            'Archer': stats.experienceArcher || 0
        };
        const maxClass = Object.entries(classExp).reduce((a, b) => a[1] > b[1] ? a : b);
        document.getElementById('profile-class').textContent = maxClass[1] > 0 ? maxClass[0] : '-';

        // Top Weapons (show level, not XP)
        const weaponsContainer = document.getElementById('profile-top-weapons');
        weaponsContainer.innerHTML = '';

        const weapons = [];
        Object.keys(stats).forEach(key => {
            if (key.startsWith('experienceWeapon') && stats[key] > 0) {
                const weaponName = key.replace('experienceWeapon', '').replace(/([A-Z])/g, ' $1').trim();
                weapons.push({ name: weaponName, xp: stats[key] });
            }
        });

        weapons.sort((a, b) => b.xp - a.xp);
        const topWeapons = weapons.slice(0, 6);

        topWeapons.forEach(weapon => {
            const level = Math.floor(weapon.xp / 1000);
            const card = document.createElement('div');
            card.className = 'weapon-card-compact';
            card.innerHTML = `
                <span class="weapon-name-compact">${weapon.name}</span>
                <span class="weapon-level-compact">Lvl ${level}</span>
            `;
            weaponsContainer.appendChild(card);
        });

        if (topWeapons.length === 0) {
            weaponsContainer.innerHTML = '<p style="color: rgba(255,255,255,0.5); font-size: 13px;">No weapon data</p>';
        }

        // PlayFab ID
        const playfabIdEl = document.getElementById('profile-playfab-id');
        if (stats.playfabId) {
            playfabIdEl.textContent = stats.playfabId;
            document.getElementById('copy-id-btn').classList.remove('hidden');
        } else {
            playfabIdEl.textContent = 'Not assigned';
            document.getElementById('copy-id-btn').classList.add('hidden');
        }

        // ID Assignment UI
        const isAdmin = window.isAdmin || !!localStorage.getItem('admin_password');

        // If not admin, show a login button (lock icon)
        if (!isAdmin) {
            const actionsContainer = document.querySelector('.profile-actions-compact');
            if (actionsContainer && !document.getElementById('admin-login-btn')) {
                const loginBtn = document.createElement('button');
                loginBtn.id = 'admin-login-btn';
                loginBtn.className = 'btn-secondary-compact';
                loginBtn.style.padding = '5px 10px';
                loginBtn.innerHTML = '🔒';
                loginBtn.title = 'Admin Login';
                loginBtn.onclick = () => {
                    const pass = prompt('Enter Admin Password:');
                    if (pass) {
                        localStorage.setItem('admin_password', pass);
                        window.isAdmin = true;
                        // Refresh profile to show buttons
                        openProfile(localPlayer.id, localPlayer.name);
                        alert('Logged in! Buttons should appear.');
                    }
                };
                actionsContainer.appendChild(loginBtn);
            }
        }

        setupAssignmentUI(localPlayer, isAdmin);

        // Nickname History
        const aliasesList = document.getElementById('profile-aliases-list');
        const nicknameCount = document.getElementById('nickname-count');
        aliasesList.innerHTML = '';

        const aliases = stats.aliases || (stats.aliasHistory ? stats.aliasHistory.split(',').map(a => a.trim()).filter(Boolean) : []);

        if (aliases && aliases.length > 0) {
            nicknameCount.textContent = `(${aliases.length})`;

            aliases.forEach(alias => {
                const chip = document.createElement('span');
                chip.className = 'alias-chip-compact';
                chip.textContent = alias;
                aliasesList.appendChild(chip);
            });
        } else {
            nicknameCount.textContent = '(0)';
            aliasesList.innerHTML = '<p style="color: rgba(255,255,255,0.5); font-size: 13px;">No nickname history</p>';
        }

        // ChivalryStats link
        const chivStatsLink = document.getElementById('view-chivstats');
        if (chivStatsLink && stats.playfabId) {
            chivStatsLink.href = `https://chivalry2stats.com/player?id=${stats.playfabId}`;
        }
    }

    // ===== ID ASSIGNMENT UI LOGIC =====
    function setupAssignmentUI(localPlayer, isAdmin) {
        const idAssignSection = document.getElementById('id-assign-section');
        const unassignBtn = document.getElementById('unassign-id-btn');

        if (!idAssignSection) return;

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
            unassignBtn.classList.remove('hidden');

            const changeBtn = document.createElement('button');
            changeBtn.className = 'btn-secondary-compact';
            changeBtn.innerHTML = '✏️ Zmień ID';
            changeBtn.style.flex = '1';
            changeBtn.onclick = () => openAssignmentModal();
            btnContainer.appendChild(changeBtn);

            // Move unassign button to container
            unassignBtn.style.marginTop = '0';
            unassignBtn.style.flex = '1';
            btnContainer.appendChild(unassignBtn);

        } else {
            // NO ID
            unassignBtn.classList.add('hidden');

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

        if (idText && idText !== 'Not assigned') {
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

        try {
            const response = await fetch(`/api/playfab-stats?playerName=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.success && data.data && data.data.players && data.data.players.length > 0) {
                showIdSearchResults(data.data.players);
            } else {
                hideIdSearchResults();
            }
        } catch (err) {
            console.error('[PROFILE-V2] Search error:', err);
            hideIdSearchResults();
        }
    }

    function showIdSearchResults(players) {
        const resultsContainer = document.getElementById('id-search-results');
        resultsContainer.innerHTML = '';
        resultsContainer.classList.remove('hidden');

        players.slice(0, 5).forEach(player => {
            let displayName = 'Unknown';
            if (player.aliases && player.aliases.length > 0) {
                displayName = player.aliases[0];
            } else if (player.aliasHistory) {
                displayName = player.aliasHistory.split(',')[0].trim();
            }

            const level = player.globalXp ? Math.floor(player.globalXp / 1000) : '?';
            const playfabId = player.playfabId || player.id;

            const item = document.createElement('div');
            item.className = 'id-search-result-item';
            item.innerHTML = `
                <div>${displayName}</div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.5);">Level ${level} • ${playfabId.substring(0, 8)}...</div>
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
    async function assignPlayFabId(playfabId, playerName) {
        console.log('[PROFILE-V2] Assigning ID:', playfabId, 'to player:', currentPlayerId);

        if (!currentPlayerId) {
            alert('No player selected');
            return;
        }

        if (!confirm(`Assign ID to this player?\nPlayer: ${playerName}\nID: ${playfabId}`)) {
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
                    playfab_id: playfabId
                })
            });

            const data = await response.json();
            console.log('[PROFILE-V2] Assign response:', data);

            if (response.ok) {
                console.log('[PROFILE-V2] ID assigned successfully');

                // Update local player data
                const player = window.findPlayerById ? window.findPlayerById(currentPlayerId) : null;
                if (player) {
                    player.playfab_id = playfabId;
                }

                // Show toast
                if (window.showToast) {
                    window.showToast('✅ ID assigned successfully!', 'success');
                }

                // Refresh profile
                openProfile(currentPlayerId, currentPlayerName);

                // Clear search
                document.getElementById('id-search-input').value = '';
                hideIdSearchResults();

            } else {
                throw new Error(data.error || 'Failed to assign ID');
            }
        } catch (err) {
            console.error('[PROFILE-V2] Assign error:', err);
            alert('Failed to assign ID: ' + err.message);
        }
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
            console.log('[PROFILE-V2] Overwrote openPlayerProfile globally');
        }, 50);
    });

})();
