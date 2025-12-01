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
        let player = window.findPlayerById ? window.findPlayerById(playerId) : null;

        // Fallback if not in local data (e.g. from search)
        if (!player) {
            player = {
                id: playerId,
                name: playerName,
                tier: null, // Unknown tier
                playfab_id: null,
                description: null,
                original_name: null
            };
        }

        if (player && player.tier !== null && player.tier !== undefined) {
            const tierNames = ['GOAT', 'S', 'A', 'B', 'C', 'D', 'F'];
            document.getElementById('profile-tier-badge').textContent = tierNames[player.tier] || `Tier ${player.tier}`;
        } else {
            document.getElementById('profile-tier-badge').textContent = 'Unranked';
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

                // Use search result as stats
                stats = searchResult;
                stats.playfabId = playfabId;
            }

            // --- HISTORY FETCH FIX ---
            try {
                const searchName = stats.displayName || stats.name || playerName;
                console.log('[PROFILE-V2] Fetching history for:', searchName);
                const historyRes = await fetch(`/api/playfab-stats?playerName=${encodeURIComponent(searchName)}`);
                const historyData = await historyRes.json();

                if (historyData.success && historyData.data && historyData.data.players) {
                    const match = historyData.data.players.find(p =>
                        (stats.playfabId && (p.playfabId === stats.playfabId || p.id === stats.playfabId)) ||
                        p.name === searchName
                    );

                    if (match) {
                        console.log('[PROFILE-V2] Found history match:', match);
                        if (match.aliases) stats.aliases = match.aliases;
                        if (match.aliasHistory) stats.aliasHistory = match.aliasHistory;
                    }
                }
            } catch (e) {
                console.warn('[PROFILE-V2] History fetch failed:', e);
            }

            // Fallback: If no aliases found, try searching by ID string (sometimes works)
            if ((!stats.aliases || stats.aliases.length === 0) && stats.playfabId) {
                try {
                    console.log('[PROFILE-V2] Trying fallback history fetch by ID:', stats.playfabId);
                    const idRes = await fetch(`/api/playfab-stats?playerName=${stats.playfabId}`);
                    const idData = await idRes.json();
                    if (idData.success && idData.data && idData.data.players) {
                        const match = idData.data.players.find(p => p.playfabId === stats.playfabId || p.id === stats.playfabId);
                        if (match) {
                            console.log('[PROFILE-V2] Found history match by ID:', match);
                            if (match.aliases) stats.aliases = match.aliases;
                            if (match.aliasHistory) stats.aliasHistory = match.aliasHistory;
                        }
                    }
                } catch (e) {
                    console.warn('[PROFILE-V2] Fallback history fetch failed:', e);
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
        console.log('[PROFILE-V2] Rendering profile', stats);

        // Safety check for localPlayer
        if (!localPlayer) {
            console.warn('[PROFILE-V2] localPlayer is null in renderProfile, creating fallback');
            localPlayer = {
                id: stats.id || 'unknown',
                name: stats.displayName || stats.name || 'Unknown',
                tier: null,
                playfab_id: stats.playfabId || null
            };
        }

        try {
            // Calculate derived stats
            const playtime = stats.playtimeex || stats.totalPlaytime || stats.playtime || 0;
            const playtimeHours = playtime > 0 ? Math.round(playtime / 3600) : 0;
            const globalRank = stats.globalXpPosition || stats.global_rank || '-';
            const globalXp = stats.globalXp || 0;

            // Level Calculation Fix:
            // Chivalry 2 XP curve is complex, but ~20,000 XP per level is a better approximation than 1000.
            // Max level is 1000.
            let level = '-';
            if (globalXp > 0) {
                // Try to use provided level if available and reasonable, otherwise calculate
                // If API returns level > 1000, it's likely XP/1000, so we recalculate
                if (stats.level && stats.level <= 1000) {
                    level = stats.level;
                } else {
                    // Approx formula: XP / 20000 (Very rough, but better than 6000+)
                    level = Math.floor(globalXp / 20000);
                    if (level > 1000) level = 1000; // Cap at 1000
                    if (level === 0) level = 1;
                }
            }

            // Header: Name + AKA
            const nameEl = document.getElementById('profile-player-name');
            nameEl.innerHTML = '';
            const nameText = document.createElement('span');
            nameText.textContent = localPlayer.name;
            nameEl.appendChild(nameText);

            if (localPlayer.original_name && localPlayer.original_name !== localPlayer.name) {
                const akaSpan = document.createElement('span');
                akaSpan.style.fontSize = '14px';
                akaSpan.style.color = 'rgba(255,255,255,0.5)';
                akaSpan.style.marginLeft = '10px';
                akaSpan.style.fontWeight = 'normal';
                akaSpan.textContent = `(aka ${localPlayer.original_name})`;
                nameEl.appendChild(akaSpan);
            }

            // Compact Stats Row (Rank | Level | Playtime)
            const badgesContainer = document.querySelector('.profile-badges');
            if (badgesContainer) {
                badgesContainer.innerHTML = '';

                const createStatBadge = (label, value, icon) => {
                    const badge = document.createElement('div');
                    badge.className = 'profile-tier-badge'; // Reuse existing class but modify style
                    badge.style.background = 'rgba(255,255,255,0.05)';
                    badge.style.border = '1px solid rgba(255,255,255,0.1)';
                    badge.style.color = '#ddd';
                    badge.style.display = 'flex';
                    badge.style.alignItems = 'center';
                    badge.style.gap = '6px';
                    badge.innerHTML = `<span style="opacity:0.7">${icon}</span> <span>${value}</span>`;
                    return badge;
                };

                // Rank
                if (globalRank !== '-') {
                    badgesContainer.appendChild(createStatBadge('Rank', `#${globalRank.toLocaleString()}`, '🏆'));
                }
                // Level
                badgesContainer.appendChild(createStatBadge('Level', `Lvl ${level}`, '⭐'));
                // Playtime
                if (playtimeHours > 0) {
                    badgesContainer.appendChild(createStatBadge('Time', `${playtimeHours.toLocaleString()}h`, '⏱️'));
                }
            }

            // Hide old stats grid elements that are now redundant or requested to be removed
            const statsGrid = document.querySelector('.stats-grid-main');
            if (statsGrid) statsGrid.style.display = 'none'; // Hide the big cards

            // Top Weapons (Compact Bar Chart)
            const weaponsContainer = document.getElementById('profile-top-weapons');
            weaponsContainer.innerHTML = '';

            // Remove "Top Weapons" header if it exists as a separate element
            // (It's usually in HTML, we might need to hide the section title via CSS or JS)
            const weaponsSectionTitle = weaponsContainer.previousElementSibling;
            if (weaponsSectionTitle && weaponsSectionTitle.classList.contains('section-title')) {
                weaponsSectionTitle.style.display = 'none';
            }

            const weapons = [];
            Object.keys(stats).forEach(key => {
                if (key.startsWith('experienceWeapon') && stats[key] > 0) {
                    const weaponName = key.replace('experienceWeapon', '').replace(/([A-Z])/g, ' $1').trim();
                    // Filter out ranged
                    if (!['Bow', 'Crossbow', 'Javelin', 'Throwing Axe'].includes(weaponName)) {
                        weapons.push({ name: weaponName, xp: stats[key] });
                    }
                }
            });

            weapons.sort((a, b) => b.xp - a.xp);
            const topWeapons = weapons.slice(0, 5); // Top 5

            if (topWeapons.length > 0) {
                const maxXP = topWeapons[0].xp;

                topWeapons.forEach(weapon => {
                    const level = Math.floor(weapon.xp / 1000); // Weapon level is roughly XP/1000
                    const percentage = (weapon.xp / maxXP) * 100;

                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.alignItems = 'center';
                    row.style.marginBottom = '8px';
                    row.style.fontSize = '13px';

                    // Name
                    const nameDiv = document.createElement('div');
                    nameDiv.style.width = '100px';
                    nameDiv.style.textAlign = 'right';
                    nameDiv.style.paddingRight = '10px';
                    nameDiv.style.color = '#ccc';
                    nameDiv.textContent = weapon.name;

                    // Bar Container
                    const barContainer = document.createElement('div');
                    barContainer.style.flex = '1';
                    barContainer.style.background = 'rgba(255,255,255,0.05)';
                    barContainer.style.height = '24px';
                    barContainer.style.borderRadius = '4px';
                    barContainer.style.overflow = 'hidden';
                    barContainer.style.position = 'relative';

                    // Bar
                    const bar = document.createElement('div');
                    bar.style.width = `${percentage}%`;
                    bar.style.height = '100%';
                    bar.style.background = '#d32f2f'; // Reddish color like screenshot
                    bar.style.borderRadius = '4px';

                    // Level Text (inside or outside?) Screenshot shows number outside
                    // Let's put it outside

                    barContainer.appendChild(bar);

                    // Level Number
                    const levelDiv = document.createElement('div');
                    levelDiv.style.width = '40px';
                    levelDiv.style.paddingLeft = '10px';
                    levelDiv.style.color = '#fff';
                    levelDiv.style.fontWeight = 'bold';
                    levelDiv.textContent = level;

                    row.appendChild(nameDiv);
                    row.appendChild(barContainer);
                    row.appendChild(levelDiv);

                    weaponsContainer.appendChild(row);
                });
            } else {
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

            // Description
            let descContainer = document.getElementById('profile-description-container');
            if (!descContainer) {
                descContainer = document.createElement('div');
                descContainer.id = 'profile-description-container';
                descContainer.style.marginTop = '15px';
                descContainer.style.padding = '10px';
                descContainer.style.background = 'rgba(255,255,255,0.05)';
                descContainer.style.borderRadius = '4px';
                descContainer.style.border = '1px solid rgba(255,255,255,0.1)';
                const historySection = document.querySelector('.profile-section-compact:last-child');
                if (historySection) {
                    historySection.parentNode.insertBefore(descContainer, historySection.nextSibling);
                } else {
                    document.getElementById('profile-content').appendChild(descContainer);
                }
            }

            descContainer.innerHTML = '';
            const descTitle = document.createElement('div');
            descTitle.style.fontSize = '12px';
            descTitle.style.color = '#888';
            descTitle.style.marginBottom = '5px';
            descTitle.style.fontWeight = 'bold';
            descTitle.innerHTML = '📝 OPIS GRACZA';
            descContainer.appendChild(descTitle);

            const descText = document.createElement('div');
            descText.style.fontSize = '14px';
            descText.style.color = '#ddd';
            descText.style.whiteSpace = 'pre-wrap';
            descText.textContent = localPlayer.description || 'Brak opisu.';
            descContainer.appendChild(descText);

            if (isAdmin) {
                const editDescBtn = document.createElement('button');
                editDescBtn.className = 'btn-secondary-compact';
                editDescBtn.style.marginTop = '10px';
                editDescBtn.style.fontSize = '11px';
                editDescBtn.style.width = '100%';
                editDescBtn.innerHTML = '✏️ Edytuj Opis';
                editDescBtn.onclick = () => editDescription(localPlayer);
                descContainer.appendChild(editDescBtn);
            }

            // Admin Edit AKA Button (in Header)
            if (isAdmin) {
                const editAkaBtn = document.createElement('button');
                editAkaBtn.innerHTML = '✏️';
                editAkaBtn.style.background = 'none';
                editAkaBtn.style.border = 'none';
                editAkaBtn.style.cursor = 'pointer';
                editAkaBtn.style.fontSize = '14px';
                editAkaBtn.style.marginLeft = '8px';
                editAkaBtn.style.opacity = '0.5';
                editAkaBtn.title = 'Edytuj oryginalny nick';
                editAkaBtn.onmouseover = () => editAkaBtn.style.opacity = '1';
                editAkaBtn.onmouseout = () => editAkaBtn.style.opacity = '0.5';
                editAkaBtn.onclick = (e) => {
                    e.stopPropagation();
                    editOriginalName(localPlayer);
                };
                nameEl.appendChild(editAkaBtn);
            }

            // ChivalryStats link
            const chivStatsLink = document.getElementById('view-chivstats');
            if (chivStatsLink) {
                if (stats.playfabId) {
                    chivStatsLink.href = `https://chivalry2stats.com/player?id=${stats.playfabId}`;
                    chivStatsLink.target = '_blank';
                    chivStatsLink.onclick = null;
                } else {
                    chivStatsLink.href = '#';
                    chivStatsLink.onclick = (e) => { e.preventDefault(); alert('Brak PlayFab ID'); };
                }
            }
        } catch (e) {
            console.error('[PROFILE-V2] Error in renderProfile:', e);
        }
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
