-- ==============================================================================
-- GAME RATINGS - Custom Multi-Value Ratings Schema
-- Project: Vercel (same Supabase instance as rankstore / game_tags)
-- Store: owner, bgg_id, rating_name, rating_value (1-10)
-- Allows unlimited custom rating dimensions per game (e.g. "Desire to Sell", "Desire to Play")
-- ==============================================================================

CREATE TABLE IF NOT EXISTS game_ratings (
    id BIGSERIAL PRIMARY KEY,
    owner TEXT NOT NULL,
    bgg_id INTEGER NOT NULL,
    rating_name TEXT NOT NULL,
    rating_value NUMERIC(4,1) NOT NULL CHECK (rating_value >= 1 AND rating_value <= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_game_ratings_owner ON game_ratings(owner);
CREATE INDEX IF NOT EXISTS idx_game_ratings_owner_bgg ON game_ratings(owner, bgg_id);
CREATE INDEX IF NOT EXISTS idx_game_ratings_owner_name ON game_ratings(owner, rating_name);

-- Unique constraint: one rating value per rating dimension per game per owner
ALTER TABLE game_ratings
ADD CONSTRAINT unique_owner_game_rating UNIQUE (owner, bgg_id, rating_name);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_game_ratings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS game_ratings_updated_at_trigger ON game_ratings;
CREATE TRIGGER game_ratings_updated_at_trigger
BEFORE UPDATE ON game_ratings
FOR EACH ROW
EXECUTE FUNCTION update_game_ratings_updated_at();

-- Enable RLS
ALTER TABLE game_ratings ENABLE ROW LEVEL SECURITY;

-- Permissive policies (app enforces owner filtering)
DROP POLICY IF EXISTS game_ratings_select_policy ON game_ratings;
CREATE POLICY game_ratings_select_policy ON game_ratings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS game_ratings_insert_policy ON game_ratings;
CREATE POLICY game_ratings_insert_policy ON game_ratings
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS game_ratings_update_policy ON game_ratings;
CREATE POLICY game_ratings_update_policy ON game_ratings
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS game_ratings_delete_policy ON game_ratings;
CREATE POLICY game_ratings_delete_policy ON game_ratings
    FOR DELETE USING (true);
