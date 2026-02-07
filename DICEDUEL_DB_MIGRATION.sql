-- Add current_turn_state column to sync live dice rolls for spectators
-- Run this in your Supabase SQL Editor

ALTER TABLE diceduel_lobbies 
ADD COLUMN IF NOT EXISTS current_turn_state JSONB DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN diceduel_lobbies.current_turn_state IS 'Stores active player''s current roll state: {last_roll: number, rolls_remaining: number, all_rolls: array}';
