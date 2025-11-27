-- Migration: Add support for GOAT (tier 0) and Tier 6 (tier 6)
-- This updates the CHECK constraint to allow tier values from 0 to 6

-- Step 1: Drop the old constraint
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_tier_check;

-- Step 2: Add new constraint allowing tiers 0-6 (0=GOAT, 1-5=existing, 6=new worst tier)
ALTER TABLE players ADD CONSTRAINT players_tier_check CHECK (tier >= 0 AND tier <= 6);
