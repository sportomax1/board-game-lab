# Dice Duel - User Authentication Setup Guide

## Overview

This guide explains how to add user authentication to Dice Duel using Supabase Auth. This allows users to:
- Create accounts with username and password
- Log in from any device
- Share game links with friends
- Access their gaming sessions across devices

## Supabase Configuration Changes

### 1. Enable Supabase Authentication

In your Supabase project:

1. Go to **Authentication** in the left sidebar
2. Under **Providers**, enable **Email** authentication
3. Configure Email settings:
   - **Enable Email Confirmations**: Optional (set to OFF for testing, ON for production)
   - **Minimum Password Length**: 6 (default)
   - **Password Strength**: Set as desired

### 2. Update Authentication Settings

Go to **Authentication > Settings**:

1. **Site URL**: Set to your production URL (e.g., `https://yourdomain.vercel.app`)
2. **Redirect URLs**: Add:
   - `https://yourdomain.vercel.app/diceduel.html`
   - `http://localhost:8080/diceduel.html` (for local testing)

### 3. Create Users Profile Table

Run this SQL in **SQL Editor**:

```sql
-- Create users_profile table to store additional user data
CREATE TABLE IF NOT EXISTS users_profile (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  games_played INT DEFAULT 0,
  games_won INT DEFAULT 0
);

-- Enable RLS on users_profile
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;

-- Allow users to read all profiles
CREATE POLICY "Public profiles are viewable by everyone"
ON users_profile FOR SELECT
TO public
USING (true);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert their own profile"
ON users_profile FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
ON users_profile FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Create index for faster username lookups
CREATE INDEX idx_users_profile_username ON users_profile(username);
```

### 4. Update diceduel_lobbies Table

Run this SQL to add user ID tracking:

```sql
-- Add user_id column to track lobby creator by user ID
ALTER TABLE diceduel_lobbies 
ADD COLUMN IF NOT EXISTS creator_user_id UUID REFERENCES auth.users(id);

-- Add user_ids array to track all players by user ID
ALTER TABLE diceduel_lobbies 
ADD COLUMN IF NOT EXISTS player_user_ids UUID[] DEFAULT '{}'::UUID[];

-- Add shareable_link column for unique lobby URLs
ALTER TABLE diceduel_lobbies 
ADD COLUMN IF NOT EXISTS shareable_code TEXT UNIQUE;

-- Create index for shareable codes
CREATE INDEX idx_diceduel_lobbies_shareable_code ON diceduel_lobbies(shareable_code);

-- Add comments
COMMENT ON COLUMN diceduel_lobbies.creator_user_id IS 'User ID of the lobby creator';
COMMENT ON COLUMN diceduel_lobbies.player_user_ids IS 'Array of user IDs for all players in the lobby';
COMMENT ON COLUMN diceduel_lobbies.shareable_code IS 'Unique code for shareable lobby links';
```

### 5. Update Row Level Security Policies

Update RLS policies for authenticated users:

```sql
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
```

### 6. Optional: Create Database Functions

Helper functions for game statistics:

```sql
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
  UPDATE users_profile
  SET 
    games_played = games_played + 1,
    games_won = CASE WHEN p_won THEN games_won + 1 ELSE games_won END,
    last_seen = NOW()
  WHERE id = p_user_id;
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
  FROM users_profile
  WHERE id = p_user_id;
$$;
```

## Environment Variables

No additional environment variables are needed. The existing `SUPABASE_URL` and `SUPABASE_ANON_KEY` will work with authentication.

## Authentication Flow

### Sign Up Process

1. User enters username, email, and password
2. Frontend calls `supabase.auth.signUp({ email, password })`
3. If successful, create profile in `users_profile` table with username
4. User is automatically logged in

### Login Process

1. User enters email and password
2. Frontend calls `supabase.auth.signInWithPassword({ email, password })`
3. If successful, Supabase returns user session
4. Frontend stores session in localStorage
5. Load user profile from `users_profile` table

### Session Management

- Sessions persist across browser refreshes via localStorage
- Sessions work across devices when user logs in
- Call `supabase.auth.getSession()` on page load to restore session
- Listen to `supabase.auth.onAuthStateChange()` for login/logout events

## Shareable Links

### Link Format

Shareable links will use this format:
```
https://yourdomain.vercel.app/diceduel.html?join=ABC123XYZ
```

Where `ABC123XYZ` is a unique code stored in `diceduel_lobbies.shareable_code`

### Implementation

1. When creating a lobby, generate a unique 9-character code
2. Store the code in `shareable_code` column
3. Display shareable link with copy button
4. When user visits link with `?join=CODE`, auto-join that lobby

## Migration Path

### For New Installations

1. Run all SQL migrations above
2. Deploy updated `diceduel.html` with authentication
3. Configure Supabase Auth settings
4. Test signup/login flow

### For Existing Installations

If you already have dice duel running without auth:

1. **Backup Data**: Export `diceduel_lobbies` table
2. **Run Migrations**: Add new columns (creator_user_id, player_user_ids, shareable_code)
3. **Optional**: Convert existing lobbies to authenticated mode
   ```sql
   -- Mark old lobbies as finished so they don't show up
   UPDATE diceduel_lobbies 
   SET status = 'finished' 
   WHERE creator_user_id IS NULL;
   ```
4. **Deploy**: Push updated code to Vercel
5. **Test**: Create new lobby with authenticated user

## Security Best Practices

### Password Requirements

- Minimum 6 characters (enforced by Supabase)
- Consider adding client-side validation for:
  - At least one number
  - At least one special character
  - Maximum length (e.g., 100 characters)

### Username Validation

- 3-20 characters
- Alphanumeric and underscores only
- Unique across all users
- Case-insensitive comparison

### Rate Limiting

Consider adding rate limiting for:
- Signup attempts (prevent spam accounts)
- Login attempts (prevent brute force)
- Lobby creation (prevent spam lobbies)

Use Supabase Edge Functions or Vercel middleware for rate limiting.

### Data Privacy

- Email addresses are stored in `auth.users` (Supabase managed)
- Only username and display name are public
- User IDs are used instead of emails in game data
- RLS policies ensure users can only modify their own data

## Testing Checklist

- [ ] Sign up with new account
- [ ] Login with existing account
- [ ] Create lobby while authenticated
- [ ] Join lobby while authenticated
- [ ] Share lobby link and join via link
- [ ] Test session persistence (refresh page)
- [ ] Test multi-device access (login on phone and desktop)
- [ ] Logout and verify session cleared
- [ ] Test with multiple users in same lobby
- [ ] Verify RLS policies work correctly

## Troubleshooting

### "Email not confirmed" error

If email confirmation is enabled:
- Check user's email for confirmation link
- Or disable email confirmation in Auth settings for testing

### "Username already taken"

- Check `users_profile` table for existing username
- Ensure username uniqueness constraint is working
- Consider case-insensitive username checks

### Session not persisting

- Check browser localStorage is enabled
- Verify `supabase.auth.getSession()` is called on page load
- Check for JavaScript errors in console
- Ensure Supabase URL and keys are correct

### RLS policy errors

- Verify policies are created correctly
- Check that user is authenticated (`auth.uid()` returns a value)
- Test with Supabase SQL Editor using user role
- Review Supabase logs for policy errors

### Shareable links not working

- Verify `shareable_code` is unique and stored correctly
- Check URL parameter parsing in JavaScript
- Ensure lobby exists and is joinable (status='waiting')
- Test with different lobby codes

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/auth-signup)
- [Password Hashing](https://supabase.com/docs/guides/auth/passwords)

## Support

For authentication issues:
1. Check Supabase Auth logs (Authentication > Users > Logs)
2. Review browser console for client errors
3. Test with SQL Editor to verify database setup
4. Check RLS policies with explain analyze
5. Verify environment variables in Vercel

---

**Next Steps**: See [DICEDUEL_SUPABASE_SETUP.md](./DICEDUEL_SUPABASE_SETUP.md) for general setup, and proceed to update `diceduel.html` with authentication UI.
