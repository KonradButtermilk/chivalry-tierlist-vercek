-- Migration: Add location to history and create aliases table

-- Add location columns to history
ALTER TABLE history ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE history ADD COLUMN IF NOT EXISTS country TEXT;

-- Create aliases table
CREATE TABLE IF NOT EXISTS ip_aliases (
    ip_address TEXT PRIMARY KEY,
    alias TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
