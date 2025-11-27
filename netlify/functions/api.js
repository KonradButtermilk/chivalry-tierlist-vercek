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

        // Ensure history table exists (Lazy Migration)
        await client.query(`
            CREATE TABLE IF NOT EXISTS history (
                id SERIAL PRIMARY KEY,
                action_type TEXT NOT NULL,
                player_name TEXT NOT NULL,
                details TEXT,
                ip_address TEXT,
                city TEXT,
                country TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Ensure columns exist if table was created before
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE history ADD COLUMN city TEXT;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
                BEGIN
                    ALTER TABLE history ADD COLUMN country TEXT;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
            END $$;

            CREATE TABLE IF NOT EXISTS ip_aliases (
                ip_address TEXT PRIMARY KEY,
                alias TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        const body = JSON.parse(event.body || '{}');
        const ip = event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown';

        // Debug Logging
        console.log('Request Headers:', JSON.stringify(event.headers));

        // Netlify Geo Headers (City is often URL encoded)
        let city = event.headers['x-nf-geo-city'] || null;
        if (city) {
            try {
                city = decodeURIComponent(city);
            } catch (e) {
                console.error('Failed to decode city:', e);
            }
        }

        const country = event.headers['x-nf-geo-country-name'] || event.headers['x-nf-geo-country-code'] || null;

        // --- GET: Fetch all players or history ---
        if (event.httpMethod === 'GET') {
            const queryParams = event.queryStringParameters || {};

            if (queryParams.type === 'history') {
                // Join history with aliases
                const query = `
                    SELECT h.*, a.alias 
                    FROM history h
                    LEFT JOIN ip_aliases a ON h.ip_address = a.ip_address
                    ORDER BY h.created_at DESC 
                    LIMIT 100
                `;
                const result = await client.query(query);
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

        // --- Helper: Log History ---
        async function logHistory(action, playerName, details) {
            try {
                await client.query(
                    'INSERT INTO history (action_type, player_name, details, ip_address, city, country) VALUES ($1, $2, $3, $4, $5, $6)',
                    [action, playerName, details, ip, city, country]
                );
            } catch (e) {
                console.error('Failed to log history:', e);
            }
        }

        // --- POST: Add Player OR Set Alias ---
        if (event.httpMethod === 'POST') {
            // Special case: Set Alias
            if (body.action === 'set_alias') {
                const { target_ip, alias } = body;
                if (!target_ip || !alias) throw new Error('Missing ip or alias');

                await client.query(
                    `INSERT INTO ip_aliases (ip_address, alias) VALUES ($1, $2)
                     ON CONFLICT (ip_address) DO UPDATE SET alias = $2`,
                    [target_ip, alias]
                );

                await client.end();
                return { statusCode: 200, headers, body: JSON.stringify({ message: 'Alias updated' }) };
            }

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
