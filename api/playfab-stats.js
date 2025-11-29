// ChivalryStats backend API (discovered endpoint)
const SEARCH_API = 'https://chivalry2stats.com:8443/api/player/usernameSearch';
const DETAILS_API = 'https://chivalry2stats.com:8443/api/player/playfabIdSearch';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { playerName, playfabId } = req.query;

    // If playfabId provided, get player details
    if (playfabId) {
        try {
            const endpoint = `${DETAILS_API}/${encodeURIComponent(playfabId)}`;
            console.log(`Getting player details: ${endpoint}`);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            if (response.ok) {
                const data = await response.json();
                return res.status(200).json({
                    success: true,
                    source: 'ChivalryStats Details API',
                    data: data
                });
            }
        } catch (error) {
            console.error('PlayFab ID lookup error:', error);
        }
    }

    // Otherwise search by name  
    if (!playerName) return res.status(400).json({ error: 'Missing playerName or playfabId' });

    try {
        const endpoint = `${SEARCH_API}/${encodeURIComponent(playerName)}`;

        console.log(`Calling ChivalryStats search: ${endpoint}`);
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ page: 0, pageSize: 10 })
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`Success! Got ${data.totalRecords || 0} results`);
            return res.status(200).json({
                success: true,
                source: 'ChivalryStats Search API',
                data: data
            });
        } else {
            const errorText = await response.text();
            console.log(`Failed with status ${response.status}: ${errorText}`);
            return res.status(response.status).json({
                error: 'ChivalryStats API failed',
                message: `Status: ${response.status}`,
                details: errorText
            });
        }

    } catch (error) {
        console.error('ChivalryStats API error:', error);
        return res.status(500).json({
            error: 'Failed to fetch stats',
            details: error.message
        });
    }
};
