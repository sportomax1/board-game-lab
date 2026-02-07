-- Dice Duel - User Authentication Migration
-- Run this SQL in your Supabase SQL Editor after enabling Email authentication

-- ============================================
-- STEP 1: Create diceduel_users_profile table
-- ============================================

-- Create diceduel_users_profile table to store additional user data
CREATE TABLE IF NOT EXISTS diceduel_users_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  games_played INT DEFAULT 0,
  games_won INT DEFAULT 0
);

-- Enable RLS on diceduel_users_profile
ALTER TABLE diceduel_users_profile ENABLE ROW LEVEL SECURITY;

-- Allow users to read all profiles
CREATE POLICY "Public profiles are viewable by everyone"
ON diceduel_users_profile FOR SELECT
TO public
USING (true);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert their own profile"
ON diceduel_users_profile FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
ON diceduel_users_profile FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Create index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_diceduel_users_profile_username ON diceduel_users_profile(username);

-- ============================================
-- STEP 2: Update diceduel_lobbies table
-- ============================================

-- Add user_id column to track lobby creator by user ID
ALTER TABLE diceduel_lobbies 
ADD COLUMN IF NOT EXISTS creator_user_id UUID REFERENCES auth.users(id);

-- Add user_ids array to track all players by user ID
ALTER TABLE diceduel_lobbies 
ADD COLUMN IF NOT EXISTS player_user_ids UUID[] DEFAULT '{}'::UUID[];

-- Add shareable_code column for unique lobby URLs
ALTER TABLE diceduel_lobbies 
ADD COLUMN IF NOT EXISTS shareable_code TEXT UNIQUE;

-- Create index for shareable codes
CREATE INDEX IF NOT EXISTS idx_diceduel_lobbies_shareable_code ON diceduel_lobbies(shareable_code);

-- Add comments
COMMENT ON COLUMN diceduel_lobbies.creator_user_id IS 'User ID of the lobby creator';
COMMENT ON COLUMN diceduel_lobbies.player_user_ids IS 'Array of user IDs for all players in the lobby';
COMMENT ON COLUMN diceduel_lobbies.shareable_code IS 'Unique code for shareable lobby links';

-- ============================================
-- STEP 3: Update Row Level Security Policies
-- ============================================

-- Drop existing public policies (if any)
DROP POLICY IF EXISTS "Public read access" ON diceduel_lobbies;
DROP POLICY IF EXISTS "Public insert access" ON diceduel_lobbies;
DROP POLICY IF EXISTS "Public update access" ON diceduel_lobbies;
DROP POLICY IF EXISTS "Public delete access" ON diceduel_lobbies;
DROP POLICY IF EXISTS "Allow all operations" ON diceduel_lobbies;

-- Enable RLS
ALTER TABLE diceduel_lobbies ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all lobbies
CREATE POLICY "Authenticated users can view lobbies"
ON diceduel_lobbies FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to create lobbies
CREATE POLICY "Authenticated users can create lobbies"
ON diceduel_lobbies FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_user_id);

-- Allow players in a lobby to update it
CREATE POLICY "Players can update their lobbies"
ON diceduel_lobbies FOR UPDATE
TO authenticated
USING (
  auth.uid() = creator_user_id 
  OR auth.uid() = ANY(player_user_ids)
);

-- Allow lobby creator to delete their lobbies
CREATE POLICY "Creators can delete their lobbies"
ON diceduel_lobbies FOR DELETE
TO authenticated
USING (auth.uid() = creator_user_id);

-- ============================================
-- STEP 4: Create Helper Functions
-- ============================================

-- Function to update user stats when game ends
CREATE OR REPLACE FUNCTION update_user_game_stats(
  p_user_id UUID,
  p_won BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE diceduel_users_profile
  SET 
    games_played = games_played + 1,
    games_won = CASE WHEN p_won THEN games_won + 1 ELSE games_won END,
    last_seen = NOW()
  WHERE user_id = p_user_id;
END;
$$;

-- Function to get user stats
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE (
  username TEXT,
  display_name TEXT,
  games_played INT,
  games_won INT,
  win_rate NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    username,
    display_name,
    games_played,
    games_won,
    CASE 
      WHEN games_played > 0 THEN ROUND((games_won::NUMERIC / games_played::NUMERIC) * 100, 2)
      ELSE 0
    END as win_rate
  FROM diceduel_users_profile
  WHERE user_id = p_user_id;
$$;

-- ============================================
-- STEP 5: Optional - Mark old lobbies as finished
-- ============================================

-- Uncomment this if you have existing lobbies without authentication
-- UPDATE diceduel_lobbies 
-- SET status = 'finished' 
-- WHERE creator_user_id IS NULL;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify the migration
SELECT 'Migration completed successfully!' as status;

-- Check tables exist
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('diceduel_users_profile', 'diceduel_lobbies')
ORDER BY table_name;
