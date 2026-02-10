-- ================================================================
-- Dice Duel - Complete Database Migration Script
-- ================================================================
-- Run this entire script in your Supabase SQL Editor
-- This consolidates all database setup required for Dice Duel
-- Before running: Enable Email authentication in Supabase Auth
--
-- Sections:
-- 1. Create diceduel_users_profile table
-- 2. Update diceduel_lobbies table  
-- 3. Add Row Level Security policies
-- 4. Create helper functions
-- 5. Add indexes for performance
-- ================================================================

-- ================================================================
-- SECTION 1: Create diceduel_users_profile table
-- ================================================================

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

COMMENT ON TABLE diceduel_users_profile IS 'User profiles linked to Supabase auth.users. Stores username, display name, and game statistics.';
COMMENT ON COLUMN diceduel_users_profile.user_id IS 'UUID reference to auth.users(id) - automatically deleted when auth user is deleted';
COMMENT ON COLUMN diceduel_users_profile.username IS 'Unique username chosen by player (3-20 characters, alphanumeric + underscore)';
COMMENT ON COLUMN diceduel_users_profile.display_name IS 'Display name shown in games (can differ from username)';
COMMENT ON COLUMN diceduel_users_profile.email IS 'Copy of user email for lookups';
COMMENT ON COLUMN diceduel_users_profile.games_played IS 'Total number of games player has participated in';
COMMENT ON COLUMN diceduel_users_profile.games_won IS 'Total number of games player has won';

-- ================================================================
-- SECTION 2: Enable RLS on diceduel_users_profile
-- ================================================================

ALTER TABLE diceduel_users_profile ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all profiles
CREATE POLICY IF NOT EXISTS "Public profiles are viewable by everyone"
ON diceduel_users_profile FOR SELECT
TO public
USING (true);

-- Allow authenticated users to insert their own profile only
CREATE POLICY IF NOT EXISTS "Users can insert their own profile"
ON diceduel_users_profile FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own profile only
CREATE POLICY IF NOT EXISTS "Users can update their own profile"
ON diceduel_users_profile FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- SECTION 3: Update diceduel_lobbies table with auth columns
-- ================================================================

-- Add creator_user_id column (track lobby creator by UUID)
ALTER TABLE diceduel_lobbies 
ADD COLUMN IF NOT EXISTS creator_user_id UUID REFERENCES auth.users(id);

-- Add player_user_ids column (track all players by UUID)
ALTER TABLE diceduel_lobbies 
ADD COLUMN IF NOT EXISTS player_user_ids UUID[] DEFAULT '{}'::UUID[];

-- Add shareable_code column (unique code for lobby sharing)
ALTER TABLE diceduel_lobbies 
ADD COLUMN IF NOT EXISTS shareable_code TEXT UNIQUE;

-- Add current_turn_state for live dice roll display
ALTER TABLE diceduel_lobbies 
ADD COLUMN IF NOT EXISTS current_turn_state JSONB DEFAULT NULL;

-- Add comments explaining new columns
COMMENT ON COLUMN diceduel_lobbies.creator_user_id IS 'UUID of the authenticated user who created this lobby';
COMMENT ON COLUMN diceduel_lobbies.player_user_ids IS 'Array of UUIDs for all players in this lobby (used for RLS policies)';
COMMENT ON COLUMN diceduel_lobbies.shareable_code IS 'Unique 9-character alphanumeric code for shareable lobby links (format: ?join=ABC123XYZ)';
COMMENT ON COLUMN diceduel_lobbies.current_turn_state IS 'JSON state of active player''s current roll: {last_roll: number, rolls_remaining: number, all_rolls: array}';

-- ================================================================
-- SECTION 4: Update Row Level Security on diceduel_lobbies
-- ================================================================

-- First, drop any existing conflicting public policies
DROP POLICY IF EXISTS "Public read access" ON diceduel_lobbies;
DROP POLICY IF EXISTS "Public insert access" ON diceduel_lobbies;
DROP POLICY IF EXISTS "Public update access" ON diceduel_lobbies;
DROP POLICY IF EXISTS "Public delete access" ON diceduel_lobbies;
DROP POLICY IF EXISTS "Allow all operations" ON diceduel_lobbies;

-- Enable RLS on diceduel_lobbies
ALTER TABLE diceduel_lobbies ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all lobbies (for lobby browser)
CREATE POLICY IF NOT EXISTS "Authenticated users can view lobbies"
ON diceduel_lobbies FOR SELECT
TO authenticated
USING (true);

-- Fallback for public read if not authenticated (requires client to handle auth separately)
CREATE POLICY IF NOT EXISTS "Public users can view lobbies"
ON diceduel_lobbies FOR SELECT
TO anon
USING (status != 'private');

-- Allow authenticated users to create lobbies (insert only if they are the creator)
CREATE POLICY IF NOT EXISTS "Authenticated users can create lobbies"
ON diceduel_lobbies FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_user_id);

-- Allow players in a lobby to update it (creator or any player)
CREATE POLICY IF NOT EXISTS "Players can update their lobbies"
ON diceduel_lobbies FOR UPDATE
TO authenticated
USING (
  auth.uid() = creator_user_id 
  OR auth.uid() = ANY(player_user_ids)
);

-- Allow lobby creator to delete their lobbies
CREATE POLICY IF NOT EXISTS "Creators can delete their lobbies"
ON diceduel_lobbies FOR DELETE
TO authenticated
USING (auth.uid() = creator_user_id);

-- ================================================================
-- SECTION 5: Create Database Indexes for Performance
-- ================================================================

-- Index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_diceduel_users_profile_username 
ON diceduel_users_profile(username);

-- Index for shareable code lookups (used when joining via link)
CREATE INDEX IF NOT EXISTS idx_diceduel_lobbies_shareable_code 
ON diceduel_lobbies(shareable_code);

-- Index for filtering lobbies by status
CREATE INDEX IF NOT EXISTS idx_diceduel_lobbies_status 
ON diceduel_lobbies(status);

-- Index for recent lobbies first
CREATE INDEX IF NOT EXISTS idx_diceduel_lobbies_created_at 
ON diceduel_lobbies(created_at DESC);

-- Composite index for common lobby queries
CREATE INDEX IF NOT EXISTS idx_diceduel_lobbies_status_created 
ON diceduel_lobbies(status, created_at DESC);

-- ================================================================
-- SECTION 6: Create Helper Functions for Game Statistics
-- ================================================================

-- Function: Update user stats when a game ends
-- Usage: SELECT update_user_game_stats(user_uuid, true);
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

COMMENT ON FUNCTION update_user_game_stats IS 'Updates user game statistics (games_played, games_won, last_seen) when a game concludes. Pass true for won games, false for losses.';

-- Function: Get formatted user statistics
-- Usage: SELECT * FROM get_user_stats(user_uuid);
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

COMMENT ON FUNCTION get_user_stats IS 'Retrieves formatted user statistics including calculated win rate (percentage). Returns empty result if user not found.';

-- ================================================================
-- SECTION 7: Optional - Clean Up Old Lobbies
-- ================================================================

-- Uncomment to mark all old lobbies (without authentication) as finished:
-- This prevents them from showing in the lobby browser after migration
-- UPDATE diceduel_lobbies 
-- SET status = 'finished' 
-- WHERE creator_user_id IS NULL;

-- ================================================================
-- SECTION 8: Verification Queries
-- ================================================================

-- Verify migration completed
SELECT 'Migration completed successfully! ✅' as status;

-- Show tables created/updated
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('diceduel_users_profile', 'diceduel_lobbies')
ORDER BY table_name;

-- List all policies on diceduel_lobbies
SELECT policyname, qual, with_check 
FROM pg_policies 
WHERE tablename = 'diceduel_lobbies'
ORDER BY policyname;

-- List all indexes
SELECT 
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE table schema = 'public'
  AND (tablename = 'diceduel_users_profile' OR tablename = 'diceduel_lobbies')
ORDER BY tablename, indexname;

-- ================================================================
-- SECTION 9: Post-Migration Checklist
-- ================================================================

-- After running this script, verify:
-- 1. ✅ Supabase Email authentication is ENABLED in Auth → Providers
-- 2. ✅ Site URL is set in Auth → URL Configuration
-- 3. ✅ Redirect URLs include diceduel.html
-- 4. ✅ No SQL errors above (check "Results" tab)
-- 5. ✅ Verification queries return expected tables and policies
-- 6. ✅ Try signup/login in diceduel.html
-- 7. ✅ Create a test lobby  
-- 8. ✅ Database is ready for use!

-- ================================================================
-- END OF MIGRATION SCRIPT
-- If you see "Migration completed successfully! ✅" above, 
-- the database is ready for use.
-- ================================================================
