-- Migration: create profiles table for DiceDuel
-- Run this in Supabase SQL editor (or via your migration workflow)

create table if not exists public.diceduel_users_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  email text,
  created_at timestamptz default now()
);

comment on table public.diceduel_users_profile is 'Profiles table mapping auth.users.id to a username and optional email/display name for Dice Duel.';
comment on column public.diceduel_users_profile.username is 'Unique username used for display and optional username-login mapping.';
comment on column public.diceduel_users_profile.email is 'Optional copy of auth email to allow client-side username->email lookup for login and password reset.';
