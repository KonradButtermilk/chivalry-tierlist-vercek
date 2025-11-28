// ===== MAIN PAGE ENHANCEMENTS (REFINED) =====
// Features: Stats, Collapse (Bulk Actions moved to script.js)

document.addEventListener('DOMContentLoaded', () => {
    initializeEnhancements();
});

function initializeEnhancements() {
    setupStatistics();
    setupCollapse();
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

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { updateStatistics };
}
