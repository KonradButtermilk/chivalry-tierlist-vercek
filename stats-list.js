// Simple player list display - separate from main script to avoid conflicts
document.addEventListener('DOMContentLoaded', () => {
    const ctxStats = document.getElementById('ctx-stats');

    if (ctxStats) {
        // Override the ctxStats click handler
        const newCtxStats = ctxStats.cloneNode(true);
        ctxStats.parentNode.replaceChild(newCtxStats, ctxStats);

        newCtxStats.addEventListener('click', async () => {
            const selectedPlayerId = window.selectedPlayerId;
            if (!selectedPlayerId) return;

            const player = window.findPlayerById(selectedPlayerId);
            if (!player) return;

            document.getElementById('context-menu').classList.add('hidden');

            try {
                const response = await fetch(`/api/playfab-stats?playerName=${encodeURIComponent(player.name)}`);
                const data = await response.json();

                if (data.success && data.data && data.data.players) {
                    const players = data.data.players;

                    // Auto-open if only 1 result
                    if (players.length === 1) {
                        window.open(`https://chivalry2stats.com/player?id=${players[0].playfabId}`, '_blank');
                        return;
                    }

                    // Show list modal
                    const listHTML = players.map(p => `
                        <div style="background: rgba(255,255,255,0.05); padding: 14px; border-radius: 6px; margin-bottom: 10px; cursor:pointer; border: 1px solid rgba(255,255,255,0.1); transition: all 0.2s"
                             onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                             onmouseout="this.style.background='rgba(255,255,255,0.05)'"
                             onclick="window.open('https://chivalry2stats.com/player?id=${p.playfabId}', '_blank')">
                            <div style="font-size: 16px; font-weight: bold; color: #4caf50">${p.aliasHistory?.split(',')[0] || 'Unknown'}</div>
                            <div style="font-size: 11px; color: #999; margin-top: 4px">ID: ${p.playfabId} · ${p.lookupCount || 0} lookups</div>
                        </div>
                    `).join('');

                    alert(`Znaleziono ${players.length} graczy. Kliknij OK, a potem wybierz gracza z listy.`);

                    const modal = document.getElementById('player-profile-modal');
                    modal.classList.remove('hidden');
                    document.getElementById('profile-loading').classList.add('hidden');
                    document.getElementById('profile-content').innerHTML = `<h2>Wybierz gracza:</h2>${listHTML}`;
                    document.getElementById('profile-content').classList.remove('hidden');
                    document.getElementById('profile-player-name').textContent = `Wyniki: ${player.name}`;
                }
            } catch (err) {
                console.error(err);
                // Fallback
                navigator.clipboard.writeText(player.name);
                window.open('https://chivalry2stats.com/player', '_blank');
            }
        });
    }
});
