// ===== MAIN PAGE ENHANCEMENTS (REFINED) =====
// Features: Stats, Collapse (Bulk Actions moved to script.js)

document.addEventListener('DOMContentLoaded', () => {
    initializeEnhancements();
});

function initializeEnhancements() {
    setupStatistics();
}

// === 1. STATISTICS ===
function setupStatistics() {
    // --- Tier Statistics ---
    function updateStatistics() {
        // Calculate stats
        const stats = {
            total: 0,
            tiers: {}
        };

        document.querySelectorAll('.tier-column').forEach(col => {
            const tier = col.dataset.tier;
            const count = col.querySelectorAll('.player-card').length;
            stats.tiers[tier] = count;
            stats.total += count;

            // Update header count
            const countEl = col.querySelector('.tier-count');
            if (countEl) countEl.textContent = `(${count})`;
        });

        // Update total count if element exists (it might be hidden/removed)
        const totalEl = document.getElementById('total-count');
        if (totalEl) totalEl.textContent = stats.total;

        // Render tier stats badges
        const statsContainer = document.getElementById('tier-stats');
        if (statsContainer) {
            statsContainer.innerHTML = '';

            // Define tier names
            const tierNames = {
                0: 'GOAT',
                1: 'Tier 1',
                2: 'Tier 2',
                3: 'Tier 3',
                4: 'Tier 4',
                5: 'Tier 5',
                6: 'Tier 6'
            };

            Object.entries(stats.tiers).forEach(([tier, count]) => {
                if (count > 0) {
                    const badge = document.createElement('div');
                    badge.className = 'tier-stat';
                    badge.innerHTML = `<span style="color: var(--tier-${tier}-color, #ddd)">${tierNames[tier]}:</span> <b>${count}</b>`;
                    statsContainer.appendChild(badge);
                }
            });
        }
    }

    // Expose updateStatistics to global scope so script.js can call it
    window.updateStatistics = updateStatistics;

    // Initial update
    setTimeout(updateStatistics, 500);

    // Observer to update stats when DOM changes
    const observer = new MutationObserver(() => {
        updateStatistics();
    });

    document.querySelectorAll('.tier-content').forEach(el => {
        observer.observe(el, { childList: true });
    });
}


// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { updateStatistics };
}
