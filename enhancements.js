// ===== MAIN PAGE ENHANCEMENTS =====
// This file contains new features: search, stats, collapse, bulk actions, ChivalryStats integration

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initializeEnhancements();
});

function initializeEnhancements() {
    setupSearch();
    setupStatistics();
    setupCollapse();
    setupBulkActions();
    setupChivalryStatsLinks();
}

// === 1. QUICK SEARCH ===
function setupSearch() {
    const searchInput = document.getElementById('player-search');
    const resetBtn = document.getElementById('search-reset');

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        filterPlayers(searchTerm);
    });

    resetBtn?.addEventListener('click', () => {
        searchInput.value = '';
        filterPlayers('');
    });
}

function filterPlayers(searchTerm) {
    const playerCards = document.querySelectorAll('.player-card');

    playerCards.forEach(card => {
        const playerName = card.querySelector('.player-name')?.textContent.toLowerCase() || '';

        if (searchTerm === '' || playerName.includes(searchTerm)) {
            card.classList.remove('search-hidden');
        } else {
            card.classList.add('search-hidden');
        }
    });
}

// === 2. STATISTICS ===
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
        const count = tierList?.querySelectorAll('.player-card:not(.search-hidden)').length || 0;
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

// Call updateStatistics whenever players change
if (typeof window.loadPlayers === 'function') {
    const originalLoadPlayers = window.loadPlayers;
    window.loadPlayers = function (...args) {
        originalLoadPlayers.apply(this, args);
        setTimeout(updateStatistics, 100);
    };
}

// === 3. COLLAPSE/EXPAND TIERS ===
function setupCollapse() {
    const collapseButtons = document.querySelectorAll('.collapse-btn');

    // Load saved collapse state from localStorage
    const savedState = JSON.parse(localStorage.getItem('tierCollapseState') || '{}');

    collapseButtons.forEach(btn => {
        const tier = btn.dataset.tier;
        const tierColumn = document.querySelector(`.tier-column[data-tier="${tier}"]`);

        // Apply saved state
        if (savedState[tier]) {
            tierColumn?.classList.add('collapsed');
            btn.textContent = '+';
        }

        btn.addEventListener('click', () => {
            tierColumn?.classList.toggle('collapsed');
            const isCollapsed = tierColumn?.classList.contains('collapsed');
            btn.textContent = isCollapsed ? '+' : '−';

            // Save state
            savedState[tier] = isCollapsed;
            localStorage.setItem('tierCollapseState', JSON.stringify(savedState));
        });
    });
}

// === 4. BULK ACTIONS ===
function setupBulkActions() {
    const bulkControls = document.getElementById('bulk-controls');
    const selectAllBtn = document.getElementById('select-all-btn');
    const deselectAllBtn = document.getElementById('deselect-all-btn');
    const bulkMoveSelect = document.getElementById('bulk-move-select');
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');

    if (!bulkControls) return;

    // Show bulk controls only when admin is logged in
    const isAdmin = !!localStorage.getItem('admin_password');
    if (isAdmin) {
        bulkControls.classList.remove('hidden');
    }

    selectAllBtn?.addEventListener('click', () => {
        document.querySelectorAll('.player-checkbox').forEach(cb => cb.checked = true);
    });

    deselectAllBtn?.addEventListener('click', () => {
        document.querySelectorAll('.player-checkbox').forEach(cb => cb.checked = false);
    });

    bulkMoveSelect?.addEventListener('change', async (e) => {
        const targetTier = e.target.value;
        if (!targetTier) return;

        const selectedCheckboxes = document.querySelectorAll('.player-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            alert('Nie wybrano żadnych graczy.');
            return;
        }

        if (!confirm(`Przenieść ${selectedCheckboxes.length} graczy do tier ${targetTier}?`)) {
            e.target.value = '';
            return;
        }

        for (const checkbox of selectedCheckboxes) {
            const playerId = checkbox.dataset.playerId;
            if (playerId && typeof window.updatePlayerTier === 'function') {
                await window.updatePlayerTier(playerId, parseInt(targetTier));
            }
        }

        e.target.value = '';
        if (typeof window.loadPlayers === 'function') {
            window.loadPlayers();
        }
    });

    bulkDeleteBtn?.addEventListener('click', async () => {
        const selectedCheckboxes = document.querySelectorAll('.player-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            alert('Nie wybrano żadnych graczy.');
            return;
        }

        if (!confirm(`Usunąć ${selectedCheckboxes.length} graczy? Tej operacji nie można cofnąć!`)) {
            return;
        }

        for (const checkbox of selectedCheckboxes) {
            const playerId = checkbox.dataset.playerId;
            if (playerId && typeof window.deletePlayer === 'function') {
                await window.deletePlayer(playerId);
            }
        }

        if (typeof window.loadPlayers === 'function') {
            window.loadPlayers();
        }
    });
}

// === 5. CHIVALRYSTATS INTEGRATION ===
function setupChivalryStatsLinks() {
    // This will be called when creating player cards
    // Add to the existing createPlayerCard function
}

window.openChivalryStats = function (playerName) {
    const url = `https://chivalry2stats.com/leaderboards/pc?name=${encodeURIComponent(playerName)}`;
    window.open(url, '_blank');
};

// Export for use in main script.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { updateStatistics, filterPlayers };
}
