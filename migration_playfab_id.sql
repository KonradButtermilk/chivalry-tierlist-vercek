-- Add playfab_id column to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS playfab_id VARCHAR(255);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_players_playfab_id ON players(playfab_id);
