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
// Show detailed view for a specific player
async function showPlayerDetails(playfabId, playerName, playerId) {
    console.log(`[STATS-LIST] showPlayerDetails(${playfabId}, ${playerName}, ${playerId})`);

    if (window.openPlayerProfile) {
        // Use the global profile function (from profile_v2.js or script_fixed.js)
        window.openPlayerProfile(playerId, playerName);
    } else {
        console.error('[STATS-LIST] window.openPlayerProfile not found!');
        alert('Błąd: Funkcja profilu nie została załadowana.');
    }
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
                        <div style="font-size: 16px; font-weight: bold; color: #4caf50">${p.aliasHistory?.split(',').pop().trim() || 'Unknown'}</div>
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

