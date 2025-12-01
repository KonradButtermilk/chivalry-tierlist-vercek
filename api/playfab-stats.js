// ChivalryStats backend API (discovered endpoints)
const SEARCH_API = 'https://chivalry2stats.com:8443/api/player/usernameSearch';
const LEADERBOARD_API = 'https://chivalry2stats.com:8443/api/player/getLeaderboardAroundPlayer';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { playerName, playfabId } = req.query;

    // If PlayFab ID provided, get full detailed stats from leaderboard endpoint
    if (playfabId) {
        try {
            // Using leaderboard endpoint which returns full player stats
            const endpoint = `${LEADERBOARD_API}/${encodeURIComponent(playfabId)}`;
            console.log(`[PLAYFAB-STATS] Fetching detailed stats: ${endpoint}`);

            const response = await fetch(`${endpoint}?distinctId=tierlist-app`, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`[PLAYFAB-STATS] Success! Got detailed stats for ${playfabId}`);

                return res.status(200).json({
                    success: true,
                    source: 'ChivalryStats Leaderboard API',
                    data: data.leaderboardStats || data
                });
            } else {
                const errorText = await response.text();
                console.error(`[PLAYFAB-STATS] Leaderboard lookup failed: ${response.status} ${errorText}`);
                return res.status(response.status).json({
                    success: false,
                    error: 'ChivalryStats Leaderboard Lookup Failed',
                    details: errorText
                });
            }
        } catch (error) {
            console.error('[PLAYFAB-STATS] Leaderboard lookup error:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal Server Error',
                details: error.message
            });
        }
    }

    // Search by name  
    if (!playerName) return res.status(400).json({
        success: false,
        error: 'Missing playerName or playfabId'
    });

    try {
        const endpoint = `${SEARCH_API}/${encodeURIComponent(playerName)}`;

        console.log(`[PLAYFAB-STATS] Searching by name: ${endpoint}`);
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
            console.log(`[PLAYFAB-STATS] Success! Got ${data.players?.length || 0} search results`);

            // Enrich each player with detailed stats (Level/XP) and sort
            if (data.players && Array.isArray(data.players)) {
                // Limit to top 8 to avoid spamming API and slow response
                const topPlayers = data.players.slice(0, 8);

                console.log(`[PLAYFAB-STATS] Fetching details for ${topPlayers.length} players...`);

                const enrichedPlayers = await Promise.all(topPlayers.map(async (player) => {
                    try {
                        // Fetch detailed stats to get XP/Level
                        const detailRes = await fetch(`${LEADERBOARD_API}/${player.playfabId}?distinctId=tierlist-app`, {
                            method: 'GET',
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'Accept': 'application/json'
                            }
                        });

                        if (detailRes.ok) {
                            const detailData = await detailRes.json();
                            const stats = detailData.leaderboardStats || detailData;
                            const globalXp = stats.globalXp || 0;
                            const level = globalXp > 0 ? Math.floor(globalXp / 1000) : 0;

                            // Parse aliases
                            const aliases = player.aliasHistory
                                ? player.aliasHistory.split(',').map(a => a.trim()).filter(Boolean)
                                : [];

                            return {
                                ...player,
                                ...stats, // Merge detailed stats
                                aliases,
                                id: player.playfabId, // Compatibility
                                level: level,
                                globalXp: globalXp,
                                lastSeen: player.lastLookup
                            };
                        }
                    } catch (e) {
                        console.error(`[PLAYFAB-STATS] Failed to fetch details for ${player.playfabId}:`, e);
                    }

                    // Fallback if detail fetch fails
                    return {
                        ...player,
                        aliases: player.aliasHistory ? player.aliasHistory.split(',').map(a => a.trim()).filter(Boolean) : [],
                        id: player.playfabId,
                        level: 0,
                        globalXp: 0
                    };
                }));

                // Sort by XP descending (Level)
                enrichedPlayers.sort((a, b) => (b.globalXp || 0) - (a.globalXp || 0));

                data.players = enrichedPlayers;
            }

            return res.status(200).json({
                success: true,
                source: 'ChivalryStats Search API',
                data: data
            });
        } else {
            const errorText = await response.text();
            console.log(`[PLAYFAB-STATS] Search failed: ${response.status} ${errorText}`);
            return res.status(response.status).json({
                success: false,
                error: 'ChivalryStats API failed',
                message: `Status: ${response.status}`,
                details: errorText
            });
        }

    } catch (error) {
        console.error('[PLAYFAB-STATS] Search API error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch stats',
            details: error.message
        });
    }
};
