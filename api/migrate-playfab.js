// One-time migration endpoint to add playfab_id column
const { Client } = require('pg');

module.exports = async (req, res) => {
    // Only allow POST with admin password
    const adminPassword = process.env.ADMIN_PASSWORD;
    const providedPassword = req.headers['x-admin-password'] || req.query.password;

    if (providedPassword !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const client = new Client({ connectionString: process.env.DATABASE_URL });

    try {
        await client.connect();

        // Add playfab_id column if it doesn't exist
        await client.query(`
            ALTER TABLE players 
            ADD COLUMN IF NOT EXISTS playfab_id VARCHAR(255)
        `);

        // Create index for faster lookups
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_players_playfab_id 
            ON players(playfab_id)
        `);

        await client.end();

        return res.status(200).json({
            success: true,
            message: 'Migration completed successfully'
        });
    } catch (error) {
        console.error('Migration error:', error);
        try {
            await client.end();
        } catch (e) { }

        return res.status(500).json({
            error: 'Migration failed',
            details: error.message
        });
    }
};
