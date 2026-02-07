# Dice Duel - Supabase Setup Guide

## Overview

Dice Duel is a real-time multiplayer dice game built with Supabase. Players can create or join lobbies, play turn-based dice games with 1-4 players, and compete to reach a target score (10, 21, or 50 points).

## Supabase Setup Instructions

### 1. Create a Supabase Project

1. Go to [Supabase](https://supabase.com/)
2. Sign up or log in to your account
3. Click **"New Project"**
4. Fill in the project details:
   - **Name**: Dice Duel (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Select closest to your users
5. Click **"Create new project"**
6. Wait for the project to finish setting up (1-2 minutes)

### 2. Create the Database Table

1. In your Supabase project dashboard, navigate to **Table Editor** (left sidebar)
2. Click **"Create a new table"**
3. Set up the table with these settings:

**Table Name**: `diceduel_lobbies`

**Enable Row Level Security (RLS)**: Disabled for now (or see Security section below)

**Columns**:

| Column Name | Type | Default Value | Additional Settings |
|------------|------|---------------|---------------------|
| `id` | `int8` | Auto-increment | Primary Key, Auto-increment |
| `created_at` | `timestamptz` | `now()` | - |
| `name` | `text` | - | Required |
| `creator` | `text` | - | Required |
| `win_score` | `int4` | - | Required |
| `players` | `text[]` | `'{}'::text[]` | Array of text |
| `status` | `text` | `'waiting'` | Required |
| `current_turn` | `int4` | `0` | Required |
| `game_started` | `bool` | `false` | Required |
| `player_scores` | `jsonb` | `'{}'::jsonb` | JSONB object |
| `history` | `jsonb` | `'[]'::jsonb` | JSONB array |

4. Click **"Save"** to create the table

**SQL Alternative**: If you prefer SQL, you can run this in the SQL Editor:

```sql
CREATE TABLE diceduel_lobbies (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  creator TEXT NOT NULL,
  win_score INT NOT NULL,
  players TEXT[] DEFAULT '{}'::text[],
  status TEXT NOT NULL DEFAULT 'waiting',
  current_turn INT NOT NULL DEFAULT 0,
  game_started BOOLEAN NOT NULL DEFAULT false,
  player_scores JSONB DEFAULT '{}'::jsonb,
  history JSONB DEFAULT '[]'::jsonb
);

-- Create index for faster queries
CREATE INDEX idx_diceduel_lobbies_status ON diceduel_lobbies(status);
CREATE INDEX idx_diceduel_lobbies_created_at ON diceduel_lobbies(created_at DESC);
```

### 3. Configure Row Level Security (Optional but Recommended)

For public access (easier for testing):

1. Go to **Authentication > Policies** (left sidebar)
2. Select the `diceduel_lobbies` table
3. Click **"New Policy"**
4. Choose **"Custom policy"**
5. Enable these operations:

**Policy 1: Public Read Access**
```sql
-- Name: Public read access
-- Operation: SELECT
CREATE POLICY "Public read access"
ON diceduel_lobbies
FOR SELECT
TO public
USING (true);
```

**Policy 2: Public Insert Access**
```sql
-- Name: Public insert access
-- Operation: INSERT
CREATE POLICY "Public insert access"
ON diceduel_lobbies
FOR INSERT
TO public
WITH CHECK (true);
```

**Policy 3: Public Update Access**
```sql
-- Name: Public update access
-- Operation: UPDATE
CREATE POLICY "Public update access"
ON diceduel_lobbies
FOR UPDATE
TO public
USING (true);
```

**Policy 4: Public Delete Access**
```sql
-- Name: Public delete access
-- Operation: DELETE
CREATE POLICY "Public delete access"
ON diceduel_lobbies
FOR DELETE
TO public
USING (true);
```

**Quick Enable RLS with Public Access** (SQL Editor):
```sql
-- Enable RLS
ALTER TABLE diceduel_lobbies ENABLE ROW LEVEL SECURITY;

-- Allow all operations for public access
CREATE POLICY "Allow all operations" ON diceduel_lobbies
  FOR ALL TO public USING (true) WITH CHECK (true);
```

### 4. Get Supabase Project Credentials

1. In your Supabase project dashboard, click **Settings** (gear icon in left sidebar)
2. Navigate to **API** section
3. You'll see two important values:

   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon/public key**: `eyJhbGc...` (long JWT token)

4. Copy both of these values

### 5. Configure Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings > Environment Variables**
3. Add the following environment variables:

| Variable Name | Value | Example |
|--------------|-------|---------|
| `SUPABASE_URL` | Your Project URL | `https://xxxxxxxxxxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Your anon/public key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

4. Make sure to set these for **Production**, **Preview**, and **Development** environments
5. Click **Save**

### 6. Deploy to Vercel

After setting up the environment variables:

1. Push your code to your Git repository (if not already done)
2. Vercel will automatically redeploy
3. The `/api/supabase-config` endpoint will securely provide Supabase credentials to your app

If Vercel doesn't auto-deploy:
- Go to your Vercel dashboard
- Click **"Redeploy"** on your latest deployment

## Database Structure

### Table: `diceduel_lobbies`

Each row represents a game lobby/session:

```javascript
{
  id: number,                // Auto-generated unique ID
  created_at: timestamp,     // Auto-generated creation time
  name: string,              // Lobby display name
  creator: string,           // Player who created the lobby
  win_score: number,         // Target score (10, 21, or 50)
  players: [string],         // Array of player names
  status: string,            // 'waiting' | 'playing' | 'finished'
  current_turn: number,      // Index of current player (0-3)
  game_started: boolean,     // Whether game has begun
  player_scores: {           // JSONB object of player scores
    [playerName]: number
  },
  history: [{               // JSONB array of game moves
    player: string,
    roll: number,
    rerolls: number,
    score: number,
    timestamp: string
  }]
}
```

## Features

### Game Mechanics

- **Players:** 1-4 players per game
- **Dice:** Standard 6-sided dice (D6)
- **Turns:** Players take turns rolling the dice
- **Rerolls:** Each player gets 2 reroll opportunities per turn
- **Scoring:** Points equal the final dice value
- **Win Conditions:** First player to reach 10, 21, or 50 points (configurable)
- **Real-time Updates:** All players see game state changes instantly via Supabase Realtime

### Real-Time Features

✅ **Instant Synchronization**
- Supabase Realtime subscriptions for live updates
- All players see game state changes immediately
- Automatic lobby list refreshing
- Turn progression syncs across all devices

✅ **Lobby System**
- Create lobbies with custom names
- Browse available lobbies
- Join existing lobbies (up to 4 players)
- Real-time lobby list updates

✅ **Turn-Based Gameplay**
- Clear turn indicators
- Visual feedback for current player
- Automatic turn progression

✅ **Dice Rolling**
- Animated dice rolls
- Visual roll animation with rotation and bounce
- 2 reroll opportunities per turn
- Option to stop before using all rerolls

✅ **Game History**
- Track all moves in the game
- See each player's rolls and scores
- Scrollable history panel

✅ **Winner Display**
- Celebration screen when someone wins
- Final scores display
- Option to return to lobby browser

✅ **Mobile-Friendly Design**
- Responsive layout for all screen sizes
- Touch-optimized controls
- Beautiful gradient background
- Smooth animations

## Usage

### For Players

1. Navigate to `/diceduel.html` on your website
2. Enter the app password (set in your environment variables)
3. Enter your player name
4. Choose to:
   - **Create a lobby:** Set lobby name and target score (10, 21, or 50)
   - **Join a lobby:** Click on any available lobby in the list
5. Wait for other players to join (2-4 players recommended)
6. Host clicks "Start Game" when ready
7. Take turns rolling dice:
   - Click "🎲 Roll Dice" to roll
   - Use up to 2 rerolls to improve your score
   - Click "✓ Keep Score" to lock in your points
8. First player to reach target score wins! 🏆

### For Administrators

- Use the password system to control access (via `/api/get-password`)
- Monitor Supabase Dashboard for database usage
- Adjust Row Level Security policies as needed
- Review and clean up old lobbies via Table Editor

## Security Considerations

### Current Implementation (Development-Friendly)

The current setup uses:
- **Password protection** via `/api/get-password` endpoint
- **Public RLS policies** for ease of use
- **No user authentication** system
- **Anonymous access** with anon key

### Recommended for Production

For a production deployment, consider:

1. **Enable Supabase Authentication**
   ```sql
   -- Example: Restrict to authenticated users only
   ALTER TABLE diceduel_lobbies ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Authenticated users can read"
   ON diceduel_lobbies FOR SELECT
   TO authenticated
   USING (true);
   
   CREATE POLICY "Authenticated users can insert"
   ON diceduel_lobbies FOR INSERT
   TO authenticated
   WITH CHECK (true);
   
   CREATE POLICY "Players can update their games"
   ON diceduel_lobbies FOR UPDATE
   TO authenticated
   USING (auth.uid()::text = ANY(players));
   
   CREATE POLICY "Creators can delete"
   ON diceduel_lobbies FOR DELETE
   TO authenticated
   USING (auth.uid()::text = creator);
   ```

2. **Add Rate Limiting**
   - Use Supabase Edge Functions for move validation
   - Implement rate limiting to prevent spam
   - Add CAPTCHA for lobby creation

3. **Data Validation**
   - Validate dice rolls server-side via Edge Functions
   - Ensure turn order is enforced
   - Prevent cheating with server-side validation

4. **Add User Roles**
   - Track players by user ID instead of names
   - Implement user profiles
   - Add admin roles for moderation

## Maintenance

### Database Cleanup

Lobbies are automatically deleted when:
- All players leave
- The lobby creator leaves

For additional cleanup, you can set up a Supabase Edge Function:

```javascript
// Supabase Edge Function to clean up old finished games
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  );

  // Delete lobbies older than 24 hours with status 'finished'
  const { data, error } = await supabase
    .from('diceduel_lobbies')
    .delete()
    .eq('status', 'finished')
    .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return new Response(JSON.stringify({ deleted: data?.length || 0 }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

You can schedule this to run daily using a cron job via Supabase Cron or an external service.

### Monitoring

Monitor your Supabase usage:
- **Database Size**: Check project dashboard
- **API Requests**: Monitor usage stats
- **Realtime Connections**: Track concurrent connections
- **Free Tier Limits**: 
  - 500 MB database storage
  - 2 GB bandwidth
  - 200 concurrent realtime connections

## Troubleshooting

### "Failed to initialize database"
- Check that all environment variables are set in Vercel
- Verify Supabase project is active and not paused
- Ensure API keys are correct (no extra spaces)
- Check browser console for detailed error messages

### "Lobby not found" or "Error loading lobbies"
- Verify the `diceduel_lobbies` table exists
- Check RLS policies allow public read access
- Ensure table structure matches requirements
- Check Supabase project isn't out of quota

### Players can't see updates in real-time
- Verify internet connection
- Check browser console for WebSocket errors
- Ensure Realtime is enabled in Supabase (Settings > API > Realtime)
- Check that table has Realtime enabled (Table Editor > Realtime toggle)

### Game not starting
- Ensure at least 2 players in lobby
- Only the lobby creator can start the game
- Check browser console for JavaScript errors
- Verify player names are stored correctly

### Database connection errors
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set correctly
- Check that Supabase project is not paused (free tier pauses after 1 week of inactivity)
- Ensure you're not exceeding free tier limits

## Migration from Firebase

If you're migrating an existing Dice Duel installation from Firebase:

1. **Export Firebase data** (if you want to keep existing games)
2. **Create the Supabase table** as described above
3. **Update environment variables** in Vercel to use Supabase
4. **Deploy the updated code**
5. **Test thoroughly** with multiple players

Note: Field names have changed from camelCase to snake_case:
- `winScore` → `win_score`
- `currentTurn` → `current_turn`
- `gameStarted` → `game_started`
- `playerScores` → `player_scores`
- `createdAt` → `created_at`

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)

## Support

For issues or questions:
1. Check Supabase Dashboard for errors (Database > Logs)
2. Review browser console logs for client-side errors
3. Verify environment variables are set correctly in Vercel
4. Test with a fresh Supabase project if needed
5. Check Supabase Status page for service issues

## Performance Tips

1. **Add Indexes** for better query performance:
   ```sql
   CREATE INDEX idx_status_created ON diceduel_lobbies(status, created_at DESC);
   ```

2. **Enable Connection Pooling** in Supabase Settings for better scalability

3. **Use Supabase Edge Functions** for server-side validation and complex operations

4. **Monitor Database Performance** in Supabase Dashboard → Database → Performance

Enjoy your Dice Duel game with Supabase! 🎲🏆
