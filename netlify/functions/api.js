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

        // --- GET: Fetch all players ---
        if (event.httpMethod === 'GET') {
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

        // --- POST: Add Player ---
        if (event.httpMethod === 'POST') {
            const { name, tier, description } = body;
            if (!name || !tier) throw new Error('Missing name or tier');

            try {
                const result = await client.query(
                    'INSERT INTO players (name, tier, description) VALUES ($1, $2, $3) RETURNING *',
                    [name, tier, description || '']
                );
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

            // Dynamic update query
            const updates = [];
            const values = [];
            let idx = 1;

            if (tier) { updates.push(`tier = $${idx++}`); values.push(tier); }
            if (name) { updates.push(`name = $${idx++}`); values.push(name); }
            if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }

            if (updates.length === 0) {
                await client.end();
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'No fields to update' }) };
            }

            values.push(id);
            const query = `UPDATE players SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;

            try {
                const result = await client.query(query, values);
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

            await client.query('DELETE FROM players WHERE id = $1', [id]);
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
