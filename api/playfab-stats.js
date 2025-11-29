// ChivalryStats backend API (discovered endpoint)
const SEARCH_API = 'https://chivalry2stats.com:8443/api/player/usernameSearch';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { playerName, playfabId } = req.query;

    // Note: PlayFab ID direct lookup endpoint is deprecated/broken (returns 404)
    // We now rely on the username search API which returns all necessary data

    if (playfabId) {
        // If we have a PlayFab ID, we can't fetch details directly anymore
        // Return an error suggesting to search by name instead
        return res.status(404).json({
            success: false,
            error: 'PlayFab ID lookup is no longer supported by ChivalryStats API',
            suggestion: 'Please search by username instead'
        });
    }

    // Search by name  
    if (!playerName) return res.status(400).json({ error: 'Missing playerName' });

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
            console.log(`Success! Got ${data.players?.length || 0} results`);

            // Enrich each player with parsed aliases
            if (data.players && Array.isArray(data.players)) {
                data.players = data.players.map(player => {
                    const aliases = player.aliasHistory
                        ? player.aliasHistory.split(',').map(a => a.trim()).filter(Boolean)
                        : [];

                    return {
                        ...player,
                        aliases,
                        // Add compatibility fields for frontend
                        id: player.playfabId,
                        level: player.lookupCount || 0, // Use lookup count as a proxy for activity
                        lastSeen: player.lastLookup
                    };
                });
            }

            return res.status(200).json({
                success: true,
                source: 'ChivalryStats Search API',
                data: data
            });
        } else {
            const errorText = await response.text();
            console.log(`Failed with status ${response.status}: ${errorText}`);
            return res.status(response.status).json({
                success: false,
                error: 'ChivalryStats API failed',
                message: `Status: ${response.status}`,
                details: errorText
            });
        }

    } catch (error) {
        console.error('ChivalryStats API error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch stats',
            details: error.message
        });
    }
};
