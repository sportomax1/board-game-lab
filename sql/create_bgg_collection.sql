-- SQL migration: create_bgg_collection.sql
-- Creates a single table `bgg_collection` suitable for upserting from collectionstore.html

CREATE TABLE IF NOT EXISTS public.bgg_collection (
  bgg_id bigint PRIMARY KEY,
  name text,
  year integer,
  minplayers integer,
  maxplayers integer,
  minplaytime integer,
  maxplaytime integer,
  minage integer,

  bgg_rating numeric,
  bayesaverage numeric,
  user_rated integer,
  stddev numeric,
  median numeric,

  owned integer,
  trading integer,
  wanting integer,
  wishing integer,
  numcomments integer,
  numweights integer,
  avgweight numeric,

  primary_rank integer,
  family_rank integer,
  all_ranks jsonb,

  categories text[],
  mechanics text[],
  bestwith text,
  recommendedwith text,

  -- collection flags as smallint (0/1) to match the client upserts
  own smallint,
  prevowned smallint,
  fortrade smallint,
  want smallint,
  wanttoplay smallint,
  wanttobuy smallint,
  wishlist smallint,
  preordered smallint,
  lastmodified text,

  thumb text,
  image text,
  description text,
  xml text,

  inserted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Optional: update `updated_at` on row update
CREATE OR REPLACE FUNCTION public.bgg_collection_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bgg_collection_updated_at ON public.bgg_collection;
CREATE TRIGGER trg_bgg_collection_updated_at
BEFORE UPDATE ON public.bgg_collection
FOR EACH ROW
EXECUTE PROCEDURE public.bgg_collection_updated_at();
