const { Pool } = require('pg');

// Database connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Check if stats are stale (>24 hours old)
function isStale(lastUpdated) {
    const now = new Date();
    const updated = new Date(lastUpdated);
    const hoursDiff = (now - updated) / (1000 * 60 * 60);
    return hoursDiff > 24;
}

// Get player stats with caching
async function getPlayerStats(playerId, playerName, forceRefresh = false) {
    try {
        // Check cache first
        const cacheResult = await pool.query(
            'SELECT * FROM player_stats WHERE player_id = $1',
            [playerId]
        );

        const cachedStats = cacheResult.rows[0];

        // Returncached if fresh and not forcing refresh
        if (cachedStats && !forceRefresh && !isStale(cachedStats.last_updated)) {
            console.log(`Using cached stats for player ${playerId}`);
            return {
                ...cachedStats,
                fromCache: true,
                cacheAge: Math.floor((new Date() - new Date(cachedStats.last_updated)) / (1000 * 60)) // minutes
            };
        }

        // Fetch fresh stats from scraper
        console.log(`Fetching fresh stats for player: ${playerName}`);

        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
        const scraperResponse = await fetch(
            `${baseUrl}/api/search-player?name=${encodeURIComponent(playerName)}`
        );

        if (!scraperResponse.ok) {
            // If scraper fails, return stale cache if available
            if (cachedStats) {
                console.log(`Scraper failed, returning stale cache for player ${playerId}`);
                return { ...cachedStats, fromCache: true, stale: true };
            }
            throw new Error(`Scraper returned ${scraperResponse.status}`);
        }

        const scrapedData = await scraperResponse.json();

        // Parse stats from scraped data
        const statsToSave = {
            player_id: playerId,
            global_rank: parseInt(scrapedData.globalRank) || null,
            level: parseInt(scrapedData.level) || null,
            kd_ratio: parseFloat(scrapedData.kdRatio) || null,
            win_rate: parseFloat(scrapedData.winRate) || null,
            hours_played: parseInt(scrapedData.timePlayed) || null,
            matches_played: parseInt(scrapedData.matches) || null,
            kills: parseInt(scrapedData.kills) || null,
            deaths: parseInt(scrapedData.deaths) || null,
            wins: parseInt(scrapedData.wins) || null,
            losses: parseInt(scrapedData.losses) || null,
            favorite_class: scrapedData.favoriteClass || null,
            scrape_success: true,
            error_message: null,
            raw_data: scrapedData
        };

        // Upsert to database
        const upsertQuery = `
            INSERT INTO player_stats (
                player_id, global_rank, level, kd_ratio, win_rate, hours_played,
                matches_played, kills, deaths, wins, losses, favorite_class,
                scrape_success, error_message, raw_data, last_updated
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
            ON CONFLICT (player_id) DO UPDATE SET
                global_rank = EXCLUDED.global_rank,
                level = EXCLUDED.level,
                kd_ratio = EXCLUDED.kd_ratio,
                win_rate = EXCLUDED.win_rate,
                hours_played = EXCLUDED.hours_played,
                matches_played = EXCLUDED.matches_played,
                kills = EXCLUDED.kills,
                deaths = EXCLUDED.deaths,
                wins = EXCLUDED.wins,
                losses = EXCLUDED.losses,
                favorite_class = EXCLUDED.favorite_class,
                scrape_success = EXCLUDED.scrape_success,
                error_message = EXCLUDED.error_message,
                raw_data = EXCLUDED.raw_data,
                last_updated = NOW()
            RETURNING *
        `;

        const result = await pool.query(upsertQuery, [
            statsToSave.player_id,
            statsToSave.global_rank,
            statsToSave.level,
            statsToSave.kd_ratio,
            statsToSave.win_rate,
            statsToSave.hours_played,
            statsToSave.matches_played,
            statsToSave.kills,
            statsToSave.deaths,
            statsToSave.wins,
            statsToSave.losses,
            statsToSave.favorite_class,
            statsToSave.scrape_success,
            statsToSave.error_message,
            JSON.stringify(statsToSave.raw_data)
        ]);

        return { ...result.rows[0], fromCache: false };

    } catch (error) {
        console.error('Error getting player stats:', error);

        // Try to return stale cache on error
        try {
            const fallbackResult = await pool.query(
                'SELECT * FROM player_stats WHERE player_id = $1',
                [playerId]
            );
            if (fallbackResult.rows[0]) {
                return { ...fallbackResult.rows[0], fromCache: true, stale: true, error: error.message };
            }
        } catch (fallbackError) {
            console.error('Fallback cache query failed:', fallbackError);
        }

        throw error;
    }
}

// Vercel serverless function
module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { playerId, playerName, forceRefresh } = req.query;

    if (!playerId || !playerName) {
        return res.status(400).json({ error: 'Missing playerId or playerName parameter' });
    }

    try {
        const stats = await getPlayerStats(
            parseInt(playerId),
            playerName,
            forceRefresh === 'true'
        );

        return res.status(200).json(stats);
    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({
            error: 'Failed to get player stats',
            details: error.message
        });
    }
};
