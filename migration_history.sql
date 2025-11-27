-- Migration: Add history table
CREATE TABLE IF NOT EXISTS history (
    id SERIAL PRIMARY KEY,
    action_type TEXT NOT NULL,
    player_name TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
