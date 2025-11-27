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

            tr.innerHTML = `
                <td>${date}</td>
                <td class="${actionClass}">${entry.action_type}</td>
                <td>${entry.player_name}</td>
                <td>${entry.details || '-'}</td>
                <td><span class="ip-badge" style="border-left: 3px solid ${ipColor}">${entry.ip_address}</span></td>
            `;

            tbodyEl.appendChild(tr);
        });
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
