const { Client } = require('pg');

exports.handler = async (event, context) => {
    // CORS headers to allow requests from anywhere (or restrict to your domain)
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Check for missing env var
    const connectionString = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
    if (!connectionString) {
        console.error('Error: DATABASE_URL is missing');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Configuration Error: DATABASE_URL is missing in Netlify settings.' })
        };
    }

    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false } // Required for Neon
    });

    try {
        await client.connect();

        // --- GET: Fetch all players or history ---
        if (event.httpMethod === 'GET') {
            const queryParams = event.queryStringParameters || {};

            if (queryParams.type === 'history') {
                const result = await client.query('SELECT * FROM history ORDER BY created_at DESC LIMIT 100');
                await client.end();
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(result.rows)
                };
            }

            const result = await client.query('SELECT * FROM players ORDER BY tier ASC, name ASC');
            await client.end();
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result.rows)
            };
        }

        // --- AUTH CHECK for Write Operations ---
        const adminPassword = process.env.ADMIN_PASSWORD;
        const userPassword = event.headers['x-admin-password'];

        if (!adminPassword || userPassword !== adminPassword) {
            await client.end();
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Unauthorized: Incorrect or missing password' })
            };
        }

        const body = JSON.parse(event.body || '{}');
        const ip = event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown';

        // --- Helper: Log History ---
        async function logHistory(action, playerName, details) {
            try {
                await client.query(
                    'INSERT INTO history (action_type, player_name, details, ip_address) VALUES ($1, $2, $3, $4)',
                    [action, playerName, details, ip]
                );
            } catch (e) {
                console.error('Failed to log history:', e);
            }
        }

        // --- POST: Add Player ---
        if (event.httpMethod === 'POST') {
            const { name, tier, description } = body;
            if (!name || tier === undefined || tier === null) throw new Error('Missing name or tier');

            try {
                const result = await client.query(
                    'INSERT INTO players (name, tier, description) VALUES ($1, $2, $3) RETURNING *',
                    [name, tier, description || '']
                );

                await logHistory('ADD', name, `Added to Tier ${tier}`);

                await client.end();
                return { statusCode: 201, headers, body: JSON.stringify(result.rows[0]) };
            } catch (err) {
                if (err.code === '23505') { // Unique violation
                    await client.end();
                    return {
                        statusCode: 409,
                        headers,
                        body: JSON.stringify({ error: 'Player with this name already exists.' })
                    };
                }
                throw err;
            }
        }

        // --- PUT: Update Player Tier/Info ---
        if (event.httpMethod === 'PUT') {
            const { id, tier, name, description } = body;
            if (!id) throw new Error('Missing id');

            // Get current player state for history
            const currentRes = await client.query('SELECT * FROM players WHERE id = $1', [id]);
            const currentPlayer = currentRes.rows[0];

            if (!currentPlayer) {
                await client.end();
                return { statusCode: 404, headers, body: JSON.stringify({ error: 'Player not found' }) };
            }

            // Dynamic update query
            const updates = [];
            const values = [];
            let idx = 1;
            let historyDetails = [];

            if (tier !== undefined && tier !== currentPlayer.tier) {
                updates.push(`tier = $${idx++}`);
                values.push(tier);
                historyDetails.push(`Tier: ${currentPlayer.tier} -> ${tier}`);
            }
            if (name && name !== currentPlayer.name) {
                updates.push(`name = $${idx++}`);
                values.push(name);
                historyDetails.push(`Name: ${currentPlayer.name} -> ${name}`);
            }
            if (description !== undefined && description !== currentPlayer.description) {
                updates.push(`description = $${idx++}`);
                values.push(description);
                historyDetails.push(`Description updated`);
            }

            if (updates.length === 0) {
                await client.end();
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'No fields to update' }) };
            }

            values.push(id);
            const query = `UPDATE players SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;

            try {
                const result = await client.query(query, values);

                if (historyDetails.length > 0) {
                    await logHistory('UPDATE', result.rows[0].name, historyDetails.join(', '));
                }

                await client.end();
                return { statusCode: 200, headers, body: JSON.stringify(result.rows[0]) };
            } catch (err) {
                if (err.code === '23505') {
                    await client.end();
                    return {
                        statusCode: 409,
                        headers,
                        body: JSON.stringify({ error: 'Player with this name already exists.' })
                    };
                }
                throw err;
            }
        }

        // --- DELETE: Remove Player ---
        if (event.httpMethod === 'DELETE') {
            const { id } = body;
            if (!id) throw new Error('Missing id');

            // Get player name before deleting
            const currentRes = await client.query('SELECT name FROM players WHERE id = $1', [id]);
            const playerName = currentRes.rows[0] ? currentRes.rows[0].name : 'Unknown';

            await client.query('DELETE FROM players WHERE id = $1', [id]);

            await logHistory('DELETE', playerName, 'Player deleted');

            await client.end();
            return { statusCode: 200, headers, body: JSON.stringify({ message: 'Deleted' }) };
        }

        await client.end();
        return { statusCode: 405, headers, body: 'Method Not Allowed' };

    } catch (error) {
        console.error('Database Error:', error);
        try { await client.end(); } catch (e) { } // Ignore close errors
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Database Error',
                details: error.message
            })
        };
    }
};
