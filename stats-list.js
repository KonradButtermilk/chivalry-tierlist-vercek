// Player list and details display
document.addEventListener('DOMContentLoaded', () => {
    const ctxStatsAuto = document.getElementById('ctx-stats-auto');

    if (ctxStatsAuto) {
        ctxStatsAuto.addEventListener('click', async () => {
            const selectedPlayerId = window.selectedPlayerId;
            if (!selectedPlayerId) return;

            const player = window.findPlayerById(selectedPlayerId);
            if (!player) return;

            document.getElementById('context-menu').classList.add('hidden');

            try {
                // Search by name first
                const response = await fetch(`/api/playfab-stats?playerName=${encodeURIComponent(player.name)}`);
                const data = await response.json();

                if (data.success && data.data && data.data.players) {
                    const players = data.data.players;

                    // If only 1 result, fetch details immediately
                    if (players.length === 1) {
                        await showPlayerDetails(players[0].playfabId, player.name);
                        return;
                    }

                    // Show list to choose from
                    showPlayerList(players, player.name);
                } else {
                    throw new Error('No players found');
                }
            } catch (err) {
                console.error(err);
                // Fallback to manual method
                navigator.clipboard.writeText(player.name);
                window.open('https://chivalry2stats.com/player', '_blank');
            }
        });
    }
});

async function showPlayerDetails(playfabId, playerName) {
    const modal = document.getElementById('player-profile-modal');
    const loading = document.getElementById('profile-loading');
    const content = document.getElementById('profile-content');

    // Show loading
    modal.classList.remove('hidden');
    loading.classList.remove('hidden');
    content.classList.add('hidden');
    document.getElementById('profile-player-name').textContent = playerName;

    try {
        const response = await fetch(`/api/playfab-stats?playfabId=${encodeURIComponent(playfabId)}`);
        const data = await response.json();

        if (data.success && data.data) {
            const playerData = data.data;

            loading.classList.add('hidden');
            content.classList.remove('hidden');

            // Populate modal with real data
            document.getElementById('profile-player-name').textContent = playerData.displayName || playerName;
            document.getElementById('profile-tier-badge').textContent = '🤖 Auto';
            document.getElementById('profile-cache-badge').textContent = 'Live Data';

            // Fill stats
            const st = playerData.stats || {};
            document.getElementById('profile-rank').textContent = st.globalRank || '-';
            document.getElementById('profile-level').textContent = st.level || '-';
            document.getElementById('profile-kd').textContent = st.kdRatio ? parseFloat(st.kdRatio).toFixed(2) : '-';
            document.getElementById('profile-winrate').textContent = st.winRate ? `${parseFloat(st.winRate).toFixed(1)}%` : '-';
            document.getElementById('profile-hours').textContent = st.timePlayed || '-';
            document.getElementById('profile-matches').textContent = st.matchesPlayed || '-';
            document.getElementById('profile-kills').textContent = st.kills || '-';
            document.getElementById('profile-deaths').textContent = st.deaths || '-';
            document.getElementById('profile-wins').textContent = st.wins || '-';
            document.getElementById('profile-losses').textContent = st.losses || '-';
            document.getElementById('profile-class').textContent = st.favoriteClass || 'Brak';
            document.getElementById('view-chivstats').href = `https://chivalry2stats.com/player?id=${playfabId}`;
        } else {
            throw new Error('No player data');
        }
    } catch (err) {
        console.error('Failed to load player details:', err);
        loading.classList.add('hidden');
        // Fallback: open ChivalryStats
        window.open(`https://chivalry2stats.com/player?id=${playfabId}`, '_blank');
        modal.classList.add('hidden');
    }
}

function showPlayerList(players, searchName) {
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
                        <div style="font-size: 11px; color: #999; margin-top: 4px">ID: ${p.playfabId} · ${p.lookupCount || 0} lookups</div>
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
            showPlayerDetails(playfabId, displayName);
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
