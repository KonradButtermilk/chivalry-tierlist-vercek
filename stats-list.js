// Player list and details display with saved PlayFab ID support
console.log('[STATS-LIST] Script loaded');

document.addEventListener('DOMContentLoaded', () => {
    console.log('[STATS-LIST] DOMContentLoaded fired');

    const ctxStatsAuto = document.getElementById('ctx-stats-auto');
    console.log('[STATS-LIST] ctx-stats-auto element:', ctxStatsAuto);

    let currentPlayerId = null; // Store for "Assign ID" button
    let currentPlayfabId = null;

    if (ctxStatsAuto) {
        console.log('[STATS-LIST] Adding click listener to ctx-stats-auto');
        ctxStatsAuto.addEventListener('click', async () => {
            console.log('[STATS-LIST] Click detected!');
            console.log('[STATS-LIST] window.selectedPlayerId:', window.selectedPlayerId);

            const selectedPlayerId = window.selectedPlayerId;
            if (!selectedPlayerId) {
                console.warn('[STATS-LIST] No selectedPlayerId');
                return;
            }

            const player = window.findPlayerById(selectedPlayerId);
            if (!player) return;

            currentPlayerId = player.id; // Store for later assignment
            document.getElementById('context-menu').classList.add('hidden');

            // Check if player has saved playfab_id
            if (player.playfab_id) {
                console.log('Using saved PlayFab ID:', player.playfab_id);
                showToast('📌 Używam zapisanego ID gracza', 'info');
                await showPlayerDetails(player.playfab_id, player.name, player.id);
                return;
            }

            try {
                showToast('🔍 Wyszukuję gracza...', 'info');

                // Search by name first
                const response = await fetch(`/api/playfab-stats?playerName=${encodeURIComponent(player.name)}`);
                const data = await response.json();

                if (data.success && data.data && data.data.players) {
                    const players = data.data.players;
                    console.log('[STATS-LIST] Search results:', players); // Debug log

                    // If only 1 result, fetch details immediately
                    if (players.length === 1) {
                        showToast(`✅ Znaleziono 1 gracza!`, 'success');
                        await showPlayerDetails(players[0].playfabId, player.name, player.id);
                        return;
                    }

                    // Show list to choose from
                    showToast(`✅ Znaleziono ${players.length} graczy`, 'success');
                    showPlayerList(players, player.name, player.id);
                } else {
                    throw new Error('No players found');
                }
            } catch (err) {
                console.error('Search error:', err);
                showToast('❌ Nie znaleziono - używam metody ręcznej', 'error');
                // Fallback to manual method
                navigator.clipboard.writeText(player.name);
                window.open('https://chivalry2stats.com/player', '_blank');
            }
        });
    }
});

// Show detailed view for a specific player
async function showPlayerDetails(playfabId, playerName, playerId) {
    console.log(`[STATS-LIST] showPlayerDetails(${playfabId}, ${playerName}, ${playerId})`);

    const modal = document.getElementById('player-profile-modal');
    const loading = document.getElementById('profile-loading');
    const content = document.getElementById('profile-content');
    const error = document.getElementById('profile-error');

    if (modal) modal.classList.remove('hidden');
    if (loading) loading.classList.remove('hidden');
    if (content) content.classList.add('hidden');
    if (error) error.classList.add('hidden');

    showToast('📥 Pobieranie szczegółów...', 'info');

    try {
        // Search again by name to get fresh data (PlayFab ID endpoint is broken)
        const response = await fetch(`/api/playfab-stats?playerName=${encodeURIComponent(playerName)}`);
        const data = await response.json();

        if (!data.success || !data.data || !data.data.players || data.data.players.length === 0) {
            throw new Error(data.error || 'No player data');
        }

        // Now fetch full detailed stats using PlayFab ID
        console.log('[STATS-LIST] Fetching detailed stats for:', playfabId);
        const detailResponse = await fetch(`/api/playfab-stats?playfabId=${playfabId}`);
        const detailData = await detailResponse.json();

        let stats;
        if (detailData.success && detailData.data) {
            stats = detailData.data;
            console.log('[STATS-LIST] Got detailed stats from leaderboard');
        } else {
            // Fallback to search data if leaderboard fails
            console.warn('[STATS-LIST] Leaderboard failed, using search data');
            const searchMatch = data.data.players.find(p => p.playfabId === playfabId) || data.data.players[0];
            stats = searchMatch;
        }

        if (stats) {
            if (loading) loading.classList.add('hidden');
            if (content) content.classList.remove('hidden');

            showToast('✅ Załadowano profil!', 'success');

            // Calculate derived stats
            const playtime = stats.totalPlaytime || stats.playtimeex || stats.playtime || 0;
            const playtimeHours = playtime > 0 ? Math.round(playtime / 3600) : 0;
            const globalRank = stats.globalXpPosition || stats.global_rank || '-';
            const globalXp = stats.globalXp || 0;
            const level = globalXp > 0 ? Math.floor(globalXp / 1000) : '-';

            // Populate modal
            const nameEl = document.getElementById('profile-player-name');
            const tierBadgeEl = document.getElementById('profile-tier-badge');
            const cacheBadgeEl = document.getElementById('profile-cache-badge');

            if (nameEl) nameEl.textContent = playerName;
            if (tierBadgeEl) tierBadgeEl.textContent = '🤖 Auto';
            if (cacheBadgeEl) {
                cacheBadgeEl.textContent = '✨ Świeże dane';
                cacheBadgeEl.style.borderColor = '#4caf50';
                cacheBadgeEl.style.color = '#4caf50';
            }

            // Fill stats with real data
            const rankEl = document.getElementById('profile-rank');
            const levelEl = document.getElementById('profile-level');
            const kdEl = document.getElementById('profile-kd');
            const winrateEl = document.getElementById('profile-winrate');
            const hoursEl = document.getElementById('profile-hours');
            const matchesEl = document.getElementById('profile-matches');
            const killsEl = document.getElementById('profile-kills');
            const deathsEl = document.getElementById('profile-deaths');
            const winsEl = document.getElementById('profile-wins');
            const lossesEl = document.getElementById('profile-losses');
            const classEl = document.getElementById('profile-class');
            const chivstatsEl = document.getElementById('view-chivstats');

            if (rankEl) rankEl.textContent = globalRank || '-';
            if (levelEl) levelEl.textContent = level || '-';
            if (kdEl) kdEl.textContent = '-'; // K/D not in leaderboard data
            if (winrateEl) winrateEl.textContent = '-'; // Win rate not available
            if (hoursEl) hoursEl.textContent = playtimeHours > 0 ? `${playtimeHours}h` : '-';
            if (matchesEl) matchesEl.textContent = '-';
            if (killsEl) killsEl.textContent = '-';
            if (deathsEl) deathsEl.textContent = '-';
            if (winsEl) winsEl.textContent = '-';
            if (lossesEl) lossesEl.textContent = '-';

            // Determine favorite class
            let favoriteClass = 'Brak danych';
            const classExp = {
                'Knight': stats.experienceKnight || 0,
                'Vanguard': stats.experienceVanguard || 0,
                'Footman': stats.experienceFootman || 0,
                'Archer': stats.experienceArcher || 0
            };
            const maxClass = Object.entries(classExp).reduce((a, b) => a[1] > b[1] ? a : b, ['', 0]);
            if (maxClass[1] > 0) favoriteClass = maxClass[0];

            if (classEl) classEl.textContent = favoriteClass;
            if (chivstatsEl) chivstatsEl.href = `https://chivalry2stats.com/player/${playfabId}`;

            // Display aliases (from search data or stats)
            const aliasesContainer = document.getElementById('profile-aliases-container');
            const aliasesList = document.getElementById('profile-aliases-list');
            const aliases = stats.aliases || (stats.aliasHistory ? stats.aliasHistory.split(',').map(a => a.trim()).filter(Boolean) : []);

            if (aliasesList && aliasesContainer && aliases && aliases.length > 0) {
                aliasesList.innerHTML = '';
                aliases.forEach(alias => {
                    const li = document.createElement('li');
                    li.textContent = alias;
                    aliasesList.appendChild(li);
                });
                aliasesContainer.classList.remove('hidden');
            } else if (aliasesContainer) {
                aliasesContainer.classList.add('hidden');
            }

            // Add \"Assign ID\" button if admin and not already saved
            if (window.isAdmin && playerId && playfabId) {
                const player = window.findPlayerById(playerId);
                if (player && !player.playfab_id) {
                    addAssignIdButton(playerId, playfabId, playerName);
                }
            }
        } else {
            throw new Error('No player data');
        }
    } catch (err) {
        console.error('Failed to load player details:', err);
        showToast('❌ Błąd ładowania - otwieram ChivalryStats', 'error');
        if (loading) loading.classList.add('hidden');
        // Fallback: open ChivalryStats
        window.open(`https://chivalry2stats.com/player/${playfabId}`, '_blank');
        if (modal) modal.classList.add('hidden');
    }
}

function addAssignIdButton(playerId, playfabId, displayName) {
    const actions = document.querySelector('.profile-actions');
    if (!actions) return;

    // Remove existing assign button if any
    const existing = document.getElementById('assign-playfab-id');
    if (existing) existing.remove();

    const assignBtn = document.createElement('button');
    assignBtn.id = 'assign-playfab-id';
    assignBtn.className = 'btn-secondary';
    assignBtn.innerHTML = '📌 Przypisz ID do gracza';
    assignBtn.style.background = '#ff9800';
    assignBtn.style.borderColor = '#ff9800';

    assignBtn.addEventListener('click', async () => {
        if (confirm(`Przypisać PlayFab ID do gracza na stałe?\nNastępnym razem statystyki załadują się automatycznie.`)) {
            try {
                assignBtn.disabled = true;
                assignBtn.textContent = '⏳ Przypisuję...';

                const response = await fetch('/api', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-password': localStorage.getItem('admin_password')
                    },
                    body: JSON.stringify({
                        id: playerId,
                        playfab_id: playfabId
                    })
                });

                if (response.ok) {
                    showToast('✅ ID przypisane!', 'success');
                    assignBtn.textContent = '✅ ID Przypisane';
                    assignBtn.style.background = '#4caf50';

                    // Update local data
                    const player = window.findPlayerById(playerId);
                    if (player) player.playfab_id = playfabId;

                    setTimeout(() => assignBtn.remove(), 2000);
                } else {
                    throw new Error('Failed to assign ID');
                }
            } catch (err) {
                console.error('Failed to assign PlayFab ID:', err);
                showToast('❌ Błąd przypisywania ID', 'error');
                assignBtn.disabled = false;
                assignBtn.textContent = '📌 Przypisz ID do gracza';
            }
        }
    });

    actions.insertBefore(assignBtn, actions.firstChild);
}

function showPlayerList(players, searchName, playerId) {
    const modal = document.getElementById('player-profile-modal');
    const loading = document.getElementById('profile-loading');
    const content = document.getElementById('profile-content');

    modal.classList.remove('hidden');
    loading.classList.add('hidden');
    content.classList.remove('hidden');

    document.getElementById('profile-player-name').textContent = `Wyniki: ${searchName}`;
    document.getElementById('profile-tier-badge').textContent = `${players.length} graczy`;
    document.getElementById('profile-cache-badge').textContent = 'Wybierz';

    content.innerHTML = `
        <section class="profile-section">
            <h2 class="section-title">📋 Wybierz gracza (kliknij aby załadować szczegóły)</h2>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${players.map(p => `
                    <div class="player-list-item" data-playfab-id="${p.playfabId}" style="background: rgba(255,255,255,0.05); padding: 14px; border-radius: 6px; cursor:pointer; border: 1px solid rgba(255,255,255,0.1); transition: all 0.2s">
                        <div style="font-size: 16px; font-weight: bold; color: #4caf50">${p.aliasHistory?.split(',')[0] || 'Unknown'}</div>
                        <div style="font-size: 11px; color: #999; margin-top: 4px">ID: ${p.playfabId} · ${p.lookupCount || 0} wyszukań</div>
                        ${p.aliasHistory && p.aliasHistory.includes(',') ? `
                            <details style="margin-top: 6px">
                                <summary style="font-size: 11px; color: #666; cursor: pointer">Historia (${p.aliasHistory.split(',').length} nicków)</summary>
                                <div style="font-size: 10px; color: #555; margin-top: 4px; max-height: 80px; overflow-y: auto">${p.aliasHistory}</div>
                            </details>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </section>
    `;

    // Add click handlers to list items
    document.querySelectorAll('.player-list-item').forEach(item => {
        item.addEventListener('click', () => {
            const playfabId = item.dataset.playfabId;
            const displayName = item.querySelector('div').textContent;

            if (!playfabId || playfabId === 'undefined') {
                console.error('[STATS-LIST] Missing PlayFab ID for:', displayName);
                showToast('❌ Błąd: Brak ID gracza', 'error');
                return;
            }

            showPlayerDetails(playfabId, displayName, playerId);
        });

        item.addEventListener('mouseover', () => {
            item.style.background = 'rgba(255,255,255,0.1)';
            item.style.borderColor = '#4caf50';
        });
        item.addEventListener('mouseout', () => {
            item.style.background = 'rgba(255,255,255,0.05)';
            item.style.borderColor = 'rgba(255,255,255,0.1)';
        });
    });
}

// Toast notification system
function showToast(message, type = 'info') {
    console.log(`[TOAST ${type}]`, message); // Debug

    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:10px;';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-size: 14px;
        min-width: 250px;
        opacity: 0;
        transform: translateX(100px);
        transition: all 0.3s ease;
    `;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

