// PlayFab API with discovered Title ID from community
const TITLE_ID = 'EBF8D';
const PLAYFAB_BASE = `https://${TITLE_ID}.playfabapi.com`;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { playerName } = req.query;
    if (!playerName) return res.status(400).json({ error: 'Missing playerName' });

    try {
        // Try to get player stats from leaderboard (public endpoint)
        // This doesn't require authentication
        const leaderboardResponse = await fetch(`${PLAYFAB_BASE}/Client/GetLeaderboardAroundPlayer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-PlayFabSDK': 'NodeSDK-2.0.0'
            },
            body: JSON.stringify({
                TitleId: TITLE_ID,
                PlayFabId: playerName, // Try with name first
                StatisticName: 'Kills', // Try common stat
                MaxResultsCount: 1
            })
        });

        if (leaderboardResponse.ok) {
            const data = await leaderboardResponse.json();
            return res.status(200).json({
                success: true,
                source: 'PlayFab GetLeaderboardAroundPlayer',
                data: data
            });
        }

        // If that fails, return helpful error
        return res.status(404).json({
            error: 'PlayFab API requires authentication',
            message: 'Public endpoints are limited. Would need Steam/Epic login to access full data.',
            titleId: TITLE_ID,
            suggestion: 'Use fallback method (copy + open tab)'
        });

    } catch (error) {
        console.error('PlayFab API error:', error);
        return res.status(500).json({
            error: 'Failed to fetch stats',
            details: error.message,
            titleId: TITLE_ID
        });
    }
};
