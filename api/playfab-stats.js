// Experimental: Try to fetch stats from ChivalryStats backend or PlayFab
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { playerName } = req.query;
    if (!playerName) return res.status(400).json({ error: 'Missing playerName' });

    try {
        // Try ChivalryStats backend (they might have a public API)
        // First, let's try to guess their API endpoint
        const possibleEndpoints = [
            `https://api.chivalry2stats.com/player/${encodeURIComponent(playerName)}`,
            `https://chivalry2stats.com/api/player?name=${encodeURIComponent(playerName)}`,
            `https://chivalry2stats.com/api/search?name=${encodeURIComponent(playerName)}`
        ];

        for (const endpoint of possibleEndpoints) {
            try {
                console.log(`Trying endpoint: ${endpoint}`);
                const response = await fetch(endpoint, {
                    headers: {
                        'User-Agent': 'ChivalryTierlist/1.0',
                        'Accept': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log(`Success with endpoint: ${endpoint}`);
                    return res.status(200).json({
                        success: true,
                        source: endpoint,
                        data: data
                    });
                }
            } catch (err) {
                console.log(`Failed endpoint ${endpoint}:`, err.message);
                continue;
            }
        }

        // If all endpoints fail, return error
        return res.status(404).json({
            error: 'Could not find API endpoint',
            message: 'ChivalryStats API endpoints are not publicly accessible or have changed'
        });

    } catch (error) {
        console.error('Stats fetch error:', error);
        return res.status(500).json({
            error: 'Failed to fetch stats',
            details: error.message
        });
    }
};
