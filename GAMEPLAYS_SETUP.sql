-- ==============================================================================
-- BGA DATASETS - Schema Setup
-- Project: Vercel (same Supabase instance as rankstore / tags)
-- Purpose: Store Board Game Arena play datasets, keyed by password-derived owner
-- Run this once in Supabase SQL Editor
-- ==============================================================================

CREATE TABLE IF NOT EXISTS bga_datasets (
    id          BIGSERIAL PRIMARY KEY,
    owner       TEXT        NOT NULL,           -- password used at login (acts as namespace key)
    name        TEXT        NOT NULL,           -- dataset label e.g. "My Collection 2026"
    data        JSONB       NOT NULL DEFAULT '[]', -- array of {name, count} objects
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_owner_dataset UNIQUE (owner, name)
);

-- Index for fast owner lookups
CREATE INDEX IF NOT EXISTS idx_bga_datasets_owner ON bga_datasets (owner);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_bga_datasets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bga_datasets_updated_at_trigger ON bga_datasets;
CREATE TRIGGER bga_datasets_updated_at_trigger
    BEFORE UPDATE ON bga_datasets
    FOR EACH ROW EXECUTE FUNCTION update_bga_datasets_updated_at();

-- Enable Row Level Security
ALTER TABLE bga_datasets ENABLE ROW LEVEL SECURITY;

-- Permissive policies — the app enforces owner filtering in queries
DROP POLICY IF EXISTS bga_datasets_select ON bga_datasets;
CREATE POLICY bga_datasets_select ON bga_datasets
    FOR SELECT USING (true);

DROP POLICY IF EXISTS bga_datasets_insert ON bga_datasets;
CREATE POLICY bga_datasets_insert ON bga_datasets
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS bga_datasets_update ON bga_datasets;
CREATE POLICY bga_datasets_update ON bga_datasets
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS bga_datasets_delete ON bga_datasets;
CREATE POLICY bga_datasets_delete ON bga_datasets
    FOR DELETE USING (true);

-- ==============================================================================
-- Done. Table: bga_datasets
-- Columns: id, owner, name, data (JSONB), created_at, updated_at
-- ==============================================================================
