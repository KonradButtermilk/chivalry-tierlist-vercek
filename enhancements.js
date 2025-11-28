// ===== MAIN PAGE ENHANCEMENTS (REFINED) =====
// Features: Stats, Collapse, Bulk Actions (Selection Mode), ChivalryStats Integration

document.addEventListener('DOMContentLoaded', () => {
    initializeEnhancements();
});

function initializeEnhancements() {
    setupStatistics();
    setupCollapse();
    setupBulkActions();
    // ChivalryStats links are handled in script.js createPlayerCard
}

// === 1. STATISTICS ===
function setupStatistics() {
    updateStatistics();
}

function updateStatistics() {
    const tierStatsContainer = document.getElementById('tier-stats');
    const totalCountEl = document.getElementById('total-count');

    if (!tierStatsContainer) return;

    let total = 0;
    const stats = [];

    for (let tier = 0; tier <= 6; tier++) {
        const tierList = document.getElementById(`tier-${tier}-list`);
        const count = tierList?.children.length || 0;
        total += count;

        // Update tier count badge
        const countBadge = document.getElementById(`count-${tier}`);
        if (countBadge) {
            countBadge.textContent = `(${count})`;
        }

        // Prepare tier stat
        const tierName = tier === 0 ? 'GOAT' : `Tier ${tier}`;
        stats.push(`<span class="tier-stat">${tierName}: ${count}</span>`);
    }

    if (totalCountEl) {
        totalCountEl.textContent = total;
    }

    tierStatsContainer.innerHTML = stats.join('');
}

// Hook into loadPlayers to update stats
if (typeof window.loadPlayers === 'function') {
    const originalLoadPlayers = window.loadPlayers;
    window.loadPlayers = function (...args) {
        originalLoadPlayers.apply(this, args);
        setTimeout(updateStatistics, 100);
    };
}

// === 2. COLLAPSE/EXPAND TIERS ===
function setupCollapse() {
    const collapseButtons = document.querySelectorAll('.collapse-btn');
    const savedState = JSON.parse(localStorage.getItem('tierCollapseState') || '{}');

    collapseButtons.forEach(btn => {
        const tier = btn.dataset.tier;
        const tierColumn = document.querySelector(`.tier-column[data-tier="${tier}"]`);

        if (savedState[tier]) {
            tierColumn?.classList.add('collapsed');
            btn.textContent = '+';
        }

        btn.addEventListener('click', () => {
            tierColumn?.classList.toggle('collapsed');
            const isCollapsed = tierColumn?.classList.contains('collapsed');
            btn.textContent = isCollapsed ? '+' : '−';
            savedState[tier] = isCollapsed;
            localStorage.setItem('tierCollapseState', JSON.stringify(savedState));
        });
    });
}

// === 3. BULK ACTIONS (SELECTION MODE) ===
let isSelectionMode = false;
let selectedPlayerIds = new Set();

function setupBulkActions() {
    const toggleBtn = document.getElementById('toggle-selection-mode');
    const actionsBar = document.getElementById('bulk-actions-bar');
    const cancelBtn = document.getElementById('cancel-selection-mode');
    const selectedCountEl = document.getElementById('selected-count');
    const bulkMoveSelect = document.getElementById('bulk-move-select');
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    const tierBoard = document.querySelector('.tier-board');

    if (!toggleBtn) return;

    // Toggle Selection Mode
    toggleBtn.addEventListener('click', () => {
        isSelectionMode = !isSelectionMode;
        updateSelectionModeUI();
    });

    cancelBtn?.addEventListener('click', () => {
        isSelectionMode = false;
        selectedPlayerIds.clear();
        updateSelectionModeUI();
    });

    function updateSelectionModeUI() {
        if (isSelectionMode) {
            toggleBtn.classList.add('active');
            toggleBtn.textContent = 'Zakończ Wybór';
            actionsBar.classList.remove('hidden');
            tierBoard.classList.add('selection-mode');
        } else {
            toggleBtn.classList.remove('active');
            toggleBtn.textContent = 'Tryb Wyboru (Bulk)';
            actionsBar.classList.add('hidden');
            tierBoard.classList.remove('selection-mode');

            // Clear selections visually
            document.querySelectorAll('.player-card.selected').forEach(card => {
                card.classList.remove('selected');
            });
            selectedPlayerIds.clear();
            updateSelectedCount();
        }
    }

    // Handle Card Clicks (Delegation)
    tierBoard.addEventListener('click', (e) => {
        if (!isSelectionMode) return;

        const card = e.target.closest('.player-card');
        if (!card) return;

        // Prevent other actions
        e.preventDefault();
        e.stopPropagation();

        const playerId = card.dataset.id;
        if (selectedPlayerIds.has(playerId)) {
            selectedPlayerIds.delete(playerId);
            card.classList.remove('selected');
        } else {
            selectedPlayerIds.add(playerId);
            card.classList.add('selected');
        }
        updateSelectedCount();
    });

    function updateSelectedCount() {
        if (selectedCountEl) {
            selectedCountEl.textContent = selectedPlayerIds.size;
        }
    }

    // Bulk Move
    bulkMoveSelect?.addEventListener('change', async (e) => {
        const targetTier = e.target.value;
        if (!targetTier) return;

        if (selectedPlayerIds.size === 0) {
            alert('Wybierz najpierw graczy.');
            e.target.value = '';
            return;
        }

        if (!confirm(`Przenieść ${selectedPlayerIds.size} graczy do Tier ${targetTier}?`)) {
            e.target.value = '';
            return;
        }

        for (const id of selectedPlayerIds) {
            if (window.updatePlayerTier) {
                await window.updatePlayerTier(id, parseInt(targetTier));
            }
        }

        e.target.value = '';
        isSelectionMode = false;
        updateSelectionModeUI();
        if (window.loadPlayers) window.loadPlayers();
    });

    // Bulk Delete
    bulkDeleteBtn?.addEventListener('click', async () => {
        if (selectedPlayerIds.size === 0) {
            alert('Wybierz najpierw graczy.');
            return;
        }

        if (!confirm(`Usunąć ${selectedPlayerIds.size} graczy? Tej operacji nie można cofnąć!`)) {
            return;
        }

        for (const id of selectedPlayerIds) {
            if (window.deletePlayer) {
                await window.deletePlayer(id); // Note: deletePlayer has its own confirm, might want to bypass it for bulk
            }
        }

        isSelectionMode = false;
        updateSelectionModeUI();
        if (window.loadPlayers) window.loadPlayers();
    });
}

// === 4. CHIVALRYSTATS INTEGRATION ===
window.openChivalryStats = function (playerName) {
    // Open the search page with the player name pre-filled if possible, 
    // or just the main page so user can search.
    // Chivalry2Stats doesn't seem to have a direct "search query" URL param that works reliably for direct lookup,
    // so we'll try to use the leaderboards search if possible, or just open the site.

    // Attempt to use the leaderboards search URL pattern
    const url = `https://chivalry2stats.com/leaderboards/pc?name=${encodeURIComponent(playerName)}`;
    window.open(url, '_blank');
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { updateStatistics };
}
