document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/.netlify/functions/api';
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const containerEl = document.getElementById('history-container');
    const tbodyEl = document.getElementById('history-body');

    const filterSelect = document.getElementById('filter-action');
    const searchInput = document.getElementById('search-player');
    const exportBtn = document.getElementById('export-csv');
    const clearBtn = document.getElementById('clear-history');

    let historyData = [];
    const isAdmin = !!localStorage.getItem('admin_password');

    // Show admin controls if logged in
    if (isAdmin) {
        clearBtn.style.display = 'inline-block';
    }

    // Event listeners
    filterSelect.addEventListener('change', applyFilters);
    searchInput.addEventListener('input', applyFilters);
    exportBtn.addEventListener('click', exportToCSV);
    clearBtn.addEventListener('click', clearAllHistory);

    fetchHistory();

    async function fetchHistory() {
        try {
            const response = await fetch(`${API_URL}?type=history`);
            if (!response.ok) throw new Error('Failed to fetch history');

            historyData = await response.json();
            renderHistory(historyData);

            loadingEl.classList.add('hidden');
            containerEl.classList.remove('hidden');
        } catch (err) {
            console.error(err);
            loadingEl.classList.add('hidden');
            errorEl.textContent = 'Nie udało się pobrać historii zmian.';
            errorEl.classList.remove('hidden');
        }
    }

    function renderHistory(history) {
        tbodyEl.innerHTML = '';

        if (history.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="6" style="text-align:center">Brak historii zmian.</td>';
            tbodyEl.appendChild(tr);
            return;
        }

        history.forEach(entry => {
            const tr = document.createElement('tr');
            tr.dataset.action = entry.action_type;
            tr.dataset.player = entry.player_name.toLowerCase();
            tr.dataset.id = entry.id;

            const date = new Date(entry.created_at).toLocaleString('pl-PL');
            const actionClass = getActionClass(entry.action_type);
            const ipColor = getIpColor(entry.ip_address);

            // Location Logic
            let location = 'Nieznana lokalizacja';
            if (entry.city && entry.country) {
                location = `${entry.city}, ${entry.country}`;
            } else if (entry.city) {
                location = entry.city;
            }

            // IP/Alias Logic
            const maskedIp = maskIp(entry.ip_address);
            const displayName = entry.alias ? `${entry.alias} (${maskedIp})` : maskedIp;

            // Delete icon (only for admin)
            const deleteIcon = isAdmin ? `<span class="delete-icon" onclick="deleteEntry(${entry.id})" title="Usuń">🗑️</span>` : '';

            tr.innerHTML = `
                <td>${date}</td>
                <td class="${actionClass}">${entry.action_type}</td>
                <td>${entry.player_name}</td>
                <td>${entry.details || '-'}</td>
                <td>
                    <div class="user-info">
                        <span class="ip-badge" style="border-left: 3px solid ${ipColor}" 
                              title="Kliknij, aby nadać alias"
                              onclick="setAlias('${entry.ip_address}')">
                            ${displayName}
                        </span>
                        <span class="location-info">${location}</span>
                    </div>
                </td>
                <td class="admin-col">${deleteIcon}</td>
            `;

            tbodyEl.appendChild(tr);
        });
    }

    function applyFilters() {
        const actionFilter = filterSelect.value;
        const searchTerm = searchInput.value.toLowerCase().trim();

        const rows = tbodyEl.querySelectorAll('tr');
        rows.forEach(row => {
            const action = row.dataset.action;
            const player = row.dataset.player;

            const matchesAction = actionFilter === 'ALL' || action === actionFilter;
            const matchesSearch = !searchTerm || player.includes(searchTerm);

            if (matchesAction && matchesSearch) {
                row.classList.remove('hidden');
            } else {
                row.classList.add('hidden');
            }
        });
    }

    function exportToCSV() {
        if (historyData.length === 0) {
            alert('Brak danych do eksportu.');
            return;
        }

        const headers = ['Data', 'Akcja', 'Gracz', 'Szczegóły', 'IP/Alias', 'Miasto', 'Kraj'];
        const rows = historyData.map(entry => {
            const date = new Date(entry.created_at).toLocaleString('pl-PL');
            const maskedIp = maskIp(entry.ip_address);
            const displayName = entry.alias || maskedIp;

            return [
                date,
                entry.action_type,
                entry.player_name,
                entry.details || '',
                displayName,
                entry.city || '',
                entry.country || ''
            ].map(field => `"${field}"`).join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `historia_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async function clearAllHistory() {
        if (!isAdmin) {
            alert('Brak uprawnień.');
            return;
        }

        // Extra password protection
        const deletePassword = prompt('Podaj hasło do usuwania historii:');
        if (deletePassword !== 'Guwno123') {
            alert('Nieprawidłowe hasło!');
            return;
        }

        const confirm1 = confirm('Czy na pewno chcesz WYCZYŚCIĆ CAŁĄ HISTORIĘ? Tej operacji nie można cofnąć!');
        if (!confirm1) return;

        const confirm2 = confirm('OSTATNIA SZANSA: Czy jesteś absolutnie pewien? Wszystkie wpisy zostaną trwale usunięte.');
        if (!confirm2) return;

        try {
            const response = await fetch(`${API_URL}?type=history&clear=all`, {
                method: 'DELETE',
                headers: {
                    'x-admin-password': localStorage.getItem('admin_password')
                }
            });

            if (response.status === 401) {
                alert('Błąd autoryzacji.');
                return;
            }

            if (response.ok) {
                alert('Historia została wyczyszczona.');
                fetchHistory();
            } else {
                alert('Błąd podczas usuwania historii.');
            }
        } catch (e) {
            console.error(e);
            alert('Wystąpił błąd sieci.');
        }
    }

    window.deleteEntry = async function (id) {
        if (!isAdmin) {
            alert('Brak uprawnień.');
            return;
        }

        // Extra password protection
        const deletePassword = prompt('Podaj hasło do usuwania historii:');
        if (deletePassword !== 'Guwno123') {
            alert('Nieprawidłowe hasło!');
            return;
        }

        const confirm1 = confirm('Czy na pewno chcesz usunąć ten wpis?');
        if (!confirm1) return;

        try {
            const response = await fetch(`${API_URL}?type=history&id=${id}`, {
                method: 'DELETE',
                headers: {
                    'x-admin-password': localStorage.getItem('admin_password')
                }
            });

            if (response.status === 401) {
                alert('Błąd autoryzacji.');
                return;
            }

            if (response.ok) {
                fetchHistory();
            } else {
                alert('Błąd podczas usuwania wpisu.');
            }
        } catch (e) {
            console.error(e);
            alert('Wystąpił błąd sieci.');
        }
    };

    window.setAlias = async function (ip) {
        const adminPassword = localStorage.getItem('admin_password');
        if (!adminPassword) {
            alert('Musisz być zalogowany jako administrator, aby zmieniać aliasy. Wróć do strony głównej i się zaloguj.');
            return;
        }

        const alias = prompt('Podaj alias dla tego adresu IP (zastąpi widoczny adres):');
        if (alias) {
            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-password': adminPassword
                    },
                    body: JSON.stringify({ action: 'set_alias', target_ip: ip, alias: alias })
                });

                if (response.status === 401) {
                    alert('Błąd autoryzacji. Hasło administratora może być niepoprawne.');
                    return;
                }

                if (response.ok) {
                    fetchHistory(); // Reload to see changes
                } else {
                    alert('Błąd podczas zapisywania aliasu.');
                }
            } catch (e) {
                console.error(e);
                alert('Wystąpił błąd sieci.');
            }
        }
    };

    function maskIp(ip) {
        if (!ip) return 'Unknown';
        // Mask first two segments of IPv4: 1.2.3.4 -> *.*.3.4
        if (ip.includes('.')) {
            const parts = ip.split('.');
            if (parts.length === 4) {
                return `*.*.${parts[2]}.${parts[3]}`;
            }
        }
        // Simple masking for other formats (keep last 4 chars)
        if (ip.length > 4) {
            return '****' + ip.substring(ip.length - 4);
        }
        return ip;
    }

    function getActionClass(action) {
        switch (action) {
            case 'ADD': return 'action-add';
            case 'UPDATE': return 'action-update';
            case 'DELETE': return 'action-delete';
            default: return '';
        }
    }

    function getIpColor(ip) {
        if (!ip) return '#ccc';
        let hash = 0;
        for (let i = 0; i < ip.length; i++) {
            hash = ip.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    }
    // ===== REFRESH NICKNAMES LOGIC =====
    const refreshBtn = document.getElementById('refresh-nicknames-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => manualRefreshNicknames());
    }

    // Auto-refresh check on load
    checkAutoRefresh();

    function checkAutoRefresh() {
        const lastRefresh = localStorage.getItem('last_nickname_refresh');
        const now = Date.now();
        const twelveHours = 12 * 60 * 60 * 1000;

        if (!lastRefresh || (now - parseInt(lastRefresh) > twelveHours)) {
            console.log('[AUTO-REFRESH] Triggering automatic nickname refresh...');
            // Auto refresh doesn't need password, it's automatic
            refreshAllNicknames(true);
        }
    }

    async function manualRefreshNicknames() {
        const password = prompt('Podaj hasło do odświeżania nicków:');
        if (password !== 'Guwno123') {
            alert('Nieprawidłowe hasło!');
            return;
        }
        refreshAllNicknames(false);
    }

    async function refreshAllNicknames(isAuto) {
        const statusMsg = isAuto ? 'Automatyczne odświeżanie nicków...' : 'Odświeżanie nicków...';
        console.log(`[REFRESH] Starting ${isAuto ? 'auto' : 'manual'} refresh`);

        // Use a toast or alert if possible, or just console/loading indicator
        // Since we don't have showToast here easily (unless we copy it), we'll use alert for manual
        // and console for auto.
        if (!isAuto) alert('Rozpoczynanie odświeżania nicków. To może potrwać chwilę. Sprawdzaj konsolę (F12) dla szczegółów.');

        try {
            // 1. Fetch all players
            const response = await fetch(`${API_URL}?type=data`);
            if (!response.ok) throw new Error('Failed to fetch player data');
            const data = await response.json();

            // Flatten tier data
            const allPlayers = [];
            Object.values(data).forEach(tier => {
                if (Array.isArray(tier)) allPlayers.push(...tier);
            });

            console.log(`[REFRESH] Found ${allPlayers.length} players`);
            let updatedCount = 0;
            let errorCount = 0;

            for (const player of allPlayers) {
                const result = await refreshPlayerNickname(player);
                if (result.updated) {
                    updatedCount++;
                    console.log(`[REFRESH] Updated ${player.name} -> ${result.newNickname}`);
                } else if (result.error) {
                    errorCount++;
                }
                // Delay to avoid rate limits
                await new Promise(r => setTimeout(r, 200));
            }

            // Update timestamp
            localStorage.setItem('last_nickname_refresh', Date.now().toString());

            const msg = `Zakończono odświeżanie. Zaktualizowano: ${updatedCount}. Błędy: ${errorCount}`;
            console.log(`[REFRESH] ${msg}`);
            if (!isAuto) alert(msg);

            // Reload history to show changes (if any updates were logged as history events)
            fetchHistory();

        } catch (e) {
            console.error('[REFRESH] Error:', e);
            if (!isAuto) alert('Błąd podczas odświeżania: ' + e.message);
        }
    }

    async function refreshPlayerNickname(player) {
        try {
            let newNickname = 'Unknown';
            let stats = null;

            // 1. Try fetching by ID
            if (player.playfab_id) {
                const response = await fetch(`/api/playfab-stats?playfabId=${player.playfab_id}`);
                if (response.ok) {
                    const data = await response.json();
                    stats = data.data;

                    if (Array.isArray(stats.aliases) && stats.aliases.length > 0) {
                        newNickname = stats.aliases[0];
                    } else if (typeof stats.aliasHistory === 'string' && stats.aliasHistory.length > 0) {
                        const parts = stats.aliasHistory.split(',');
                        if (parts.length > 0) newNickname = parts[0].trim();
                    } else if (stats.LastKnownAlias) {
                        newNickname = stats.LastKnownAlias;
                    }
                }
            }

            // 2. Fallback: Search by name
            if (!newNickname || newNickname === 'Unknown') {
                const searchRes = await fetch(`/api/playfab-stats?playerName=${encodeURIComponent(player.name)}`);
                const searchData = await searchRes.json();

                if (searchData.success && searchData.data && searchData.data.players) {
                    let foundPlayer = null;
                    if (player.playfab_id) {
                        foundPlayer = searchData.data.players.find(p => p.playfabId === player.playfab_id || p.id === player.playfab_id);
                    }
                    if (!foundPlayer && searchData.data.players.length > 0) {
                        foundPlayer = searchData.data.players[0];
                    }

                    if (foundPlayer) {
                        if (foundPlayer.name) newNickname = foundPlayer.name;
                        else if (foundPlayer.aliases && foundPlayer.aliases.length > 0) {
                            newNickname = foundPlayer.aliases[foundPlayer.aliases.length - 1];
                        }
                    }
                }
            }

            // 3. Update if needed
            if (newNickname && newNickname !== 'Unknown' && newNickname !== player.name) {
                // We need admin password for update. 
                // For auto-refresh, we assume the browser has it stored.
                // If not stored, auto-refresh will fail (401).
                const adminPass = localStorage.getItem('admin_password');
                if (!adminPass) return { updated: false, error: 'No admin password' };

                const updateRes = await fetch(API_URL, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-password': adminPass
                    },
                    body: JSON.stringify({
                        id: player.id,
                        name: newNickname
                    })
                });

                if (updateRes.ok) {
                    return { updated: true, newNickname };
                }
            }

            return { updated: false, newNickname };

        } catch (e) {
            return { updated: false, error: e };
        }
    }
});
