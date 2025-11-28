-- Player Statistics Cache Table
-- Stores scraped ChivalryStats data with timestamp for auto-refresh

CREATE TABLE IF NOT EXISTS player_stats (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    
    -- Core Stats
    global_rank INT,
    level INT,
    kd_ratio DECIMAL(4,2),
    win_rate DECIMAL(5,2),
    hours_played INT,
    matches_played INT,
    
    -- Additional Stats
    kills INT,
    deaths INT,
    wins INT,
    losses INT,
    favorite_class VARCHAR(100),
    
    -- Metadata
    last_updated TIMESTAMP DEFAULT NOW(),
    scrape_success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    -- Raw scraped data (for future expansion)
    raw_data JSONB,
    
    -- Ensure one stats record per player
    UNIQUE(player_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_player_stats_player_id ON player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_last_updated ON player_stats(last_updated);

-- Function to check if stats are stale (>24 hours old)
CREATE OR REPLACE FUNCTION is_stats_stale(player_stats_id INT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT last_updated < NOW() - INTERVAL '24 hours'
        FROM player_stats
        WHERE id = player_stats_id
    );
END;
$$ LANGUAGE plpgsql;
