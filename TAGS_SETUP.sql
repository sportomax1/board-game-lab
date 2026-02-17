-- ==============================================================================
-- GAME TAGS - Minimal Schema
-- Project: Vercel (same Supabase instance as rankstore)
-- Store only: owner (BGG username), bgg_id, tag_name
-- Everything else pulled from BGG API on each load
-- NO EMAIL TRACKING
-- ==============================================================================

CREATE TABLE IF NOT EXISTS game_tags (
    id BIGSERIAL PRIMARY KEY,
    owner TEXT NOT NULL,
    bgg_id INTEGER NOT NULL,
    tag_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_game_tags_owner ON game_tags(owner);
CREATE INDEX IF NOT EXISTS idx_game_tags_owner_bgg ON game_tags(owner, bgg_id);

-- Unique constraint: one owner can't add same tag twice for same game
ALTER TABLE game_tags
ADD CONSTRAINT unique_owner_game_tag UNIQUE (owner, bgg_id, tag_name);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_game_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS game_tags_updated_at_trigger ON game_tags;
CREATE TRIGGER game_tags_updated_at_trigger
BEFORE UPDATE ON game_tags
FOR EACH ROW
EXECUTE FUNCTION update_game_tags_updated_at();

-- Enable RLS
ALTER TABLE game_tags ENABLE ROW LEVEL SECURITY;

-- Permissive policies (app enforces owner filtering)
DROP POLICY IF EXISTS game_tags_select_policy ON game_tags;
CREATE POLICY game_tags_select_policy ON game_tags
    FOR SELECT USING (true);

DROP POLICY IF EXISTS game_tags_insert_policy ON game_tags;
CREATE POLICY game_tags_insert_policy ON game_tags
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS game_tags_update_policy ON game_tags;
CREATE POLICY game_tags_update_policy ON game_tags
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS game_tags_delete_policy ON game_tags;
CREATE POLICY game_tags_delete_policy ON game_tags
    FOR DELETE USING (true);
-- This table is created above. If you prefer to import game data from elsewhere,
-- you can populate it with games from rankstore or collection API v2.
