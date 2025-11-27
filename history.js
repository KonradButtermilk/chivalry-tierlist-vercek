document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/.netlify/functions/api';
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const containerEl = document.getElementById('history-container');
    const tbodyEl = document.getElementById('history-body');

    fetchHistory();

    async function fetchHistory() {
        try {
            const response = await fetch(`${API_URL}?type=history`);
            if (!response.ok) throw new Error('Failed to fetch history');

            const history = await response.json();
            renderHistory(history);

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
            tr.innerHTML = '<td colspan="5" style="text-align:center">Brak historii zmian.</td>';
            tbodyEl.appendChild(tr);
            return;
        }

        history.forEach(entry => {
            const tr = document.createElement('tr');

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
            `;

            tbodyEl.appendChild(tr);
        });
    }

    window.setAlias = async function (ip) {
        const alias = prompt('Podaj alias dla tego adresu IP (zastąpi widoczny adres):');
        if (alias) {
            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'set_alias', target_ip: ip, alias: alias })
                });

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
        // Mask last two segments of IPv4: 1.2.3.4 -> 1.2.*.*
        // Or last segments of IPv6
        if (ip.includes('.')) {
            const parts = ip.split('.');
            if (parts.length === 4) {
                return `${parts[0]}.${parts[1]}.*.*`;
            }
        }
        // Simple masking for other formats
        return ip.substring(0, Math.max(4, ip.length - 6)) + '****';
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
});
