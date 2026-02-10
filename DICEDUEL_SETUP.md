# Dice Duel - Complete Setup & Documentation

**Latest Update**: February 10, 2026 | **Status**: ✅ Complete & Ready

---

## 📖 Table of Contents

1. [Quick Start (5 minutes)](#quick-start-5-minutes)
2. [Game Overview](#game-overview)
3. [For Players](#for-players)
4. [For Administrators](#for-administrators)
5. [Supabase Database Setup](#supabase-database-setup)
6. [Authentication Setup](#authentication-setup)
7. [Database Schema](#database-schema)
8. [Security & RLS](#security--rls)
9. [Development & Testing](#development--testing)
10. [Troubleshooting](#troubleshooting)

---

## Quick Start (5 minutes)

### For Administrators

```bash
# Step 1: Configure Supabase
1. Go to Supabase Dashboard → Authentication → Providers
2. Enable Email provider (toggle "Confirm email" OFF for testing)
3. Go to SQL Editor and run DICEDUEL_MIGRATIONS.sql (see below)
4. Configure URL: Authentication → URL Configuration
   - Site URL: https://yourdomain.vercel.app
   - Redirect: https://yourdomain.vercel.app/diceduel.html

# Step 2: Verify Environment Variables in Vercel
- SUPABASE_URL (should already be set)
- SUPABASE_ANON_KEY (should already be set)

# Step 3: Deploy & Test
- Vercel auto-deploys when you push
- Visit /diceduel.html and test signup/login
```

### For Players

```bash
# Step 1: Sign Up (New Players)
- Visit /diceduel.html
- Enter app password
- Click "Sign Up" tab
- Enter: username, email, password
- Click "Sign Up"

# Step 2: Login (Returning Players)
- Enter app password
- Click "Login" tab
- Enter email and password
- Click "Login"

# Step 3: Play!
- Create a lobby or join existing one
- Share lobby link with friends
- Play up to 4 players, reach target score (10, 21, or 50)
```

---

## Game Overview

### 🎮 Core Features

**Game Mechanics**
- 1-4 players per game
- Turn-based dice rolling (6-sided die)
- 2 reroll opportunities per turn
- Reach target score first to win (10, 21, or 50 points)
- Animated dice with smooth UI

**Real-Time Features**
- ✅ Live lobby browser (auto-updating)
- ✅ Live turn progression and scores
- ✅ Instant move synchronization
- ✅ Resume games after disconnect

**User Features**
- ✅ Email/password authentication
- ✅ Unique usernames (3-20 chars)
- ✅ Multi-device account access
- ✅ Shareable lobby links
- ✅ Cross-device session persistence
- ✅ Game history tracking
- ✅ Player statistics (games played, wins)

**UI/UX**
- ✅ Mobile-responsive design
- ✅ Smooth animations and transitions
- ✅ Visual turn indicators
- ✅ Game history panel
- ✅ Winner celebration screen
- ✅ Beautiful purple gradient background

### 🔒 Security

- Passwords hashed by Supabase (bcrypt)
- Authentication via JWT tokens
- Row Level Security (RLS) for data protection
- User tracking by UUID (not display name)
- Shareable codes use crypto-secure randomness
- Session management with auto-logout

---

## For Players

### First Time Setup

1. **Visit the Site**
   - Navigate to `/diceduel.html`

2. **Enter App Password**
   - Password set by admin (via `/api/get-password`)

3. **Create Account**
   - Click "Sign Up" tab
   - **Username**: 3-20 characters (letters, numbers, underscores)
   - **Email**: Your email address
   - **Password**: 6+ characters (consider using 8+ for security)
   - Click "Sign Up"

4. **You're In!**
   - Lobby browser loads
   - Your username appears at the top
   - Ready to play!

### How to Play

1. **Create a Lobby**
   - Click "Create Lobby" button
   - Enter lobby name (e.g., "John's Game")
   - Choose target score: 10, 21, or 50 points
   - Click "Create"
   - You're the host!

2. **Invite Friends**
   - Click "📋 Copy Link" button in game header
   - Send link to friends (SMS, email, Discord, etc.)
   - Link format: `https://site.com/diceduel.html?join=ABC123XYZ`
   - Friends click link, login, and auto-join!

3. **Or Join Existing Game**
   - See list of available lobbies
   - Click any lobby to join
   - Wait for host to start

4. **Play the Game**
   - When all players are ready, host clicks "Start Game"
   - Take turns rolling dice:
     - Click "🎲 Roll Dice" to roll
     - See your roll result
     - Decide: keep this score, or reroll?
     - You have 2 reroll chances per turn
     - Click "✓ Keep Score" to lock in points
   - Score = your final die value
   - First to reach target score wins! 🏆

5. **Game History**
   - Scroll down to see all moves in real-time
   - See each player's rolls and scores
   - Track who's winning

### Multi-Device Access

- **Same Account, Any Device**
  - Login on desktop, then on phone
  - Both show your username and account
  - Seamless switching between devices

- **Resume Games**
  - Close browser mid-game
  - Come back later and rejoin
  - Turn-based play = no rush!

### Strategy Tips

- **When to Roll Again**: 1-3 is low, 5-6 is high
- **Risk Assessment**: Sure 4 vs. risk for 5-6 late game
- **Watches Others**: See who's close to winning
- **End Game**: Any points help when you're close!

---

## For Administrators

### Initial Setup Checklist

- [ ] Supabase project created
- [ ] Database tables created (run DICEDUEL_MIGRATIONS.sql)
- [ ] Email authentication enabled in Supabase
- [ ] Site URL configured in Supabase
- [ ] Vercel environment variables set
- [ ] diceduel.html deployed to Vercel
- [ ] /api/supabase-config endpoint working
- [ ] /api/get-password endpoint working

### Configuration Steps

#### 1. Create Supabase Project

1. Go to [Supabase](https://supabase.com)
2. Click "New Project"
3. Fill in details:
   - **Name**: Dice Duel (or custom)
   - **Password**: Strong DB password (save this!)
   - **Region**: Closest to your users
4. Wait 1-2 minutes for setup

#### 2. Enable Authentication

1. Go to **Authentication** → **Providers**
2. Find **Email** provider
3. Click the toggle to enable it
4. **Configure Email**:
   - Toggle "Confirm Email": OFF (for testing) or ON (for production)
   - Minimum Password Length: 6 (default)
5. Click "Save"

#### 3. Set Site URL & Redirects

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL**:
   - Production: `https://yourdomain.vercel.app`
   - Local testing: `http://localhost:8080`
3. Add **Redirect URLs**:
   - `https://yourdomain.vercel.app/diceduel.html`
   - `http://localhost:8080/diceduel.html`
4. Click "Save"

#### 4. Run Database Migration

1. Go to **SQL Editor**
2. Click "New Query"
3. Paste the entire contents of `DICEDUEL_MIGRATIONS.sql` (see SQL section below)
4. Click "Run"
5. Wait for success message

This creates:
- `diceduel_users_profile` table
- Auth-related columns in `diceduel_lobbies`
- Row Level Security policies
- Database indexes
- Helper functions

#### 5. Get Credentials

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon/Public Key**: `eyJhbGc...` (long JWT)
3. Keep these safe!

#### 6. Set Vercel Environment Variables

1. Go to Vercel project dashboard
2. Settings → Environment Variables
3. Add/verify:
   - `SUPABASE_URL` = Your Project URL
   - `SUPABASE_ANON_KEY` = Your Anon Key
4. Set for: Production, Preview, Development
5. Click "Save"

#### 7. Deploy

1. Push code to Git (if not auto-deploying)
2. Vercel auto-deploys
3. Or click "Redeploy" in Vercel dashboard

#### 8. Test Everything

```javascript
// Test in browser console
// 1. Check Supabase is reachable
await fetch('/api/supabase-config')
  .then(r => r.json())
  .then(d => console.log('✅ Supabase connected:', d.url))

// 2. Test signup
// Visit diceduel.html, enter password, sign up with new account

// 3. Test login
// Logout, then login with same account

// 4. Create lobby and test real-time
// Watch other players' updates appear instantly
```

### Ongoing Administration

**Monitor**
- Supabase Dashboard → Database → Logs
- Vercel Dashboard → Deployments
- Vercel Dashboard → Analytics

**Maintenance**
- Database size (free tier: 500 MB)
- API usage/bandwidth (free tier: 2 GB/month)
- Concurrent realtime connections (free tier: 200)

**Optional Enhancements**
- Enable email verification for production
- Add rate limiting (via Edge Functions)
- Set up automated lobby cleanup (cron jobs)
- Add CAPTCHA for signup
- Enable additional auth providers (Google, GitHub)

---

## Supabase Database Setup

### Prerequisites

You need:
- Supabase account (free tier works)
- A Supabase project created
- Access to SQL Editor

### Database Tables

#### 1. `diceduel_users_profile`

Stores user account information:

```javascript
{
  user_id: UUID,           // References auth.users(id)
  username: TEXT,          // Unique, 3-20 chars
  display_name: TEXT,      // Display name for games
  email: TEXT,             // User's email
  created_at: TIMESTAMP,   // Account creation
  last_seen: TIMESTAMP,    // Last activity
  games_played: INT,       // Total games
  games_won: INT           // Games won
}
```

#### 2. `diceduel_lobbies`

Stores game lobbies/sessions:

```javascript
{
  id: BIGINT,              // Auto-increment
  created_at: TIMESTAMP,   // Creation time
  name: TEXT,              // Lobby display name
  creator: TEXT,           // Creator's display name
  creator_user_id: UUID,   // Creator's user ID
  win_score: INT,          // Target score (10/21/50)
  players: TEXT[],         // Array of player names
  player_user_ids: UUID[], // Array of player user IDs
  player_scores: JSONB,    // {playerName: score}
  status: TEXT,            // 'waiting'|'playing'|'finished'
  current_turn: INT,       // Current player index
  game_started: BOOL,      // Game in progress?
  history: JSONB,          // Array of moves
  shareable_code: TEXT,    // Unique join code
  current_turn_state: JSONB // Active roll state
}
```

### Creating Tables via UI

**If you prefer visual setup** (vs. SQL):

1. Go to **Table Editor** in Supabase
2. Click "Create New Table"
3. Add columns as specified above
4. **BUT**: It's faster to just run the SQL migration (see next section)

### Running SQL Migration

**Quick Setup** (recommended):

1. Go to **SQL Editor** in Supabase
2. Click "New Query"
3. Paste the contents of `DICEDUEL_MIGRATIONS.sql`
4. Click **Run**
5. Done! ✅

The migration handles:
- Table creation
- Indexes for performance
- Row Level Security policies
- Helper functions
- Validation of setup

---

## Authentication Setup

### Enable Supabase Auth

1. **Go to Authentication**
   - Left sidebar → Authentication

2. **Enable Email Provider**
   - Providers → Email → Toggle ON

3. **Configure Settings**
   - Email → Edit → Configure as needed
   - Enable/Disable email confirmation
   - Set password requirements

### Create auth.users & Profiles

Supabase Auth automatically manages `auth.users` table. When users sign up:

1. Record created in `auth.users` (Supabase managed)
2. Your code creates record in `diceduel_users_profile`
3. Fields linked via `user_id` (UUID)

### Signup Flow

```javascript
// User enters: username, email, password
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123'
});

// If signup succeeds, create profile
if (!error) {
  await supabase.from('diceduel_users_profile').insert({
    user_id: data.user.id,
    username: 'player123',
    display_name: 'Player 123',
    email: 'user@example.com'
  });
}
```

### Login Flow

```javascript
// User enters: email, password
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});

// Session is automatically managed by Supabase
// Get current user any time with:
const { data: { user } } = await supabase.auth.getUser();
```

### Session Management

Sessions persist via localStorage:

```javascript
// On page load, check for existing session
const { data: { session } } = await supabase.auth.getSession();

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('User logged in:', session.user.id);
  } else if (event === 'SIGNED_OUT') {
    console.log('User logged out');
  }
});

// Logout
await supabase.auth.signOut();
```

### Shareable Links

Each lobby gets a unique 9-character code:

```javascript
// Generate secure random code
function generateShareableCode() {
  const array = new Uint8Array(9);
  crypto.getRandomValues(array);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(array, byte => alphabet[byte % 32]).join('');
}

// Link format
const link = `https://yourdomain.vercel.app/diceduel.html?join=${code}`;

// When user visits link with ?join=CODE
// JavaScript checks URL params and auto-joins
```

---

## Database Schema

### Complete Schema (SQL)

See `DICEDUEL_MIGRATIONS.sql` for complete schema with:

- Table definitions
- Indexes
- RLS policies
- Helper functions
- Comments/documentation

### Key Relationships

```
auth.users (Supabase manages)
    ↓
diceduel_users_profile (user_id FK)
    ↓
diceduel_lobbies (creator_user_id, player_user_ids[])
```

### Indexes for Performance

```sql
CREATE INDEX idx_diceduel_users_profile_username
  ON diceduel_users_profile(username);

CREATE INDEX idx_diceduel_lobbies_shareable_code
  ON diceduel_lobbies(shareable_code);

CREATE INDEX idx_diceduel_lobbies_status
  ON diceduel_lobbies(status);

CREATE INDEX idx_diceduel_lobbies_created_at
  ON diceduel_lobbies(created_at DESC);
```

---

## Security & RLS

### Row Level Security Policies

All policies are set up automatically by the migration SQL.

#### `diceduel_users_profile` Policies

- **SELECT** (Public): Anyone can read profiles
- **INSERT** (Auth): Users create their own profile
- **UPDATE** (Auth): Users update their own profile

#### `diceduel_lobbies` Policies

- **SELECT** (Auth): Authenticated users see all lobbies
- **INSERT** (Auth): Only with `creator_user_id = current_user_id`
- **UPDATE** (Auth): Creator or players in game can update
- **DELETE** (Auth): Only creator can delete

### Authentication Best Practices

✅ **Enabled**
- Passwords hashed by Supabase (bcrypt)
- JWT tokens for sessions
- User IDs are UUIDs (secure, random)
- RLS policies restrict data access

⚠️ **Consider for Production**
- Enable email verification (requires confirmation link)
- Email domain whitelist (if team-only)
- Rate limiting on auth endpoints
- CAPTCHA for signup
- Backend move validation (prevent cheating)
- Automated lobby cleanup (old games)

### Environment Variables

Keep in Vercel, never in code:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
```

Never commit these to git!

---

## Development & Testing

### Local Testing

```bash
# Start local server
python3 -m http.server 8080

# Visit http://localhost:8080/diceduel.html
# Will use Supabase (not local database)
```

### Testing Checklist

- [ ] **Signup**
  - [ ] Creates account with email/password
  - [ ] Username uniqueness enforced
  - [ ] Profile created in database

- [ ] **Login**
  - [ ] Existing accounts can login
  - [ ] Wrong password shows error
  - [ ] Session persists after refresh

- [ ] **Lobbies**
  - [ ] Create lobby as authenticated user
  - [ ] Browse available lobbies
  - [ ] Join lobby (adds to players)
  - [ ] Only creator can start game

- [ ] **Shareable Links**
  - [ ] Copy Link button works
  - [ ] Link has format: `?join=CODE`
  - [ ] Following link auto-joins game
  - [ ] Works in different browser/private mode

- [ ] **Gameplay**
  - [ ] Dice rolls work
  - [ ] Rerolls limited to 2
  - [ ] Score accumulates correctly
  - [ ] Multiple players see updates in real-time

- [ ] **Multi-Device**
  - [ ] Login on 2 devices with same account
  - [ ] Usernames match across devices
  - [ ] Can play same game from 2 devices

- [ ] **Realtime**
  - [ ] Lobby list updates instantly
  - [ ] Turn changes sync immediately
  - [ ] Scores update in real-time for all players

### Browser Console Tests

```javascript
// Test Supabase connectivity
await fetch('/api/supabase-config')
  .then(r => r.json())
  .then(config => {
    console.log('✅ Config loaded:', config.url);
    console.log('✅ Anon key available:', !!config.anonKey);
  });

// Test current user
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user?.email);

// Test profile table access
const { data, error } = await supabase
  .from('diceduel_users_profile')
  .select('*')
  .limit(5);
console.log('Profiles:', data?.length);

// Test lobby table access
const { data: lobbies } = await supabase
  .from('diceduel_lobbies')
  .select('*')
  .limit(5);
console.log('Lobbies:', lobbies?.length);
```

---

## Troubleshooting

### Common Issues

#### "Failed to initialize database"

**Causes**:
- SUPABASE_URL or SUPABASE_ANON_KEY not set in Vercel
- Keys are incorrect or expired
- Supabase project is paused (free tier)

**Solutions**:
1. Check Vercel environment variables
2. Verify keys in Supabase Settings → API
3. Reactivate Supabase project if paused
4. Check project isn't out of quota (free tier: 500MB DB)

#### "Email not confirmed" (signup succeeds but can't login)

**Cause**: Email verification enabled but user hasn't confirmed

**Solutions**:
1. Check email inbox for confirmation link
2. Or disable email verification:
   - Supabase → Authentication → Providers → Email
   - Toggle "Confirm email" OFF

#### "Username already taken"

**Cause**: Username must be unique across all players

**Solution**: User chooses a different username

#### Shareable link doesn't work

**Causes**:
- Lobby was deleted or finished
- Shareable code column missing
- JavaScript not parsing `?join=` parameter correctly

**Solutions**:
1. Verify lobby still exists in database
2. Run migration SQL again to ensure `shareable_code` column exists
3. Check browser console for JavaScript errors
4. Test with different lobby

#### Session not persisting (logout after refresh)

**Causes**:
- Browser localStorage disabled
- Supabase keys incorrect
- Browser is in private/incognito mode

**Solutions**:
1. Check browser allows localStorage
2. Verify SUPABASE_URL and SUPABASE_ANON_KEY correct in Vercel
3. Try normal (not private) browser window
4. Check browser console for errors

#### Players can't see real-time updates

**Causes**:
- Realtime not enabled in Supabase
- WebSocket connection blocked
- RLS policies preventing access

**Solutions**:
1. Supabase → Settings → Realtime → Ensure enabled
2. Check browser console for WebSocket errors
3. Verify RLS policies created correctly
4. Test in different network/VPN

#### RLS policy errors (403, 401)

**Cause**: User doesn't have permission per RLS policy

**Solutions**:
1. Ensure user is authenticated (`auth.uid()` returns UUID)
2. Check SQL in policy is correct
3. Test in Supabase SQL Editor using authenticated role
4. Review Supabase logs: Database → Logs

#### Game not starting

**Causes**:
- Only 1 player (minimum 2 required)
- Only creator can start game
- JavaScript errors on client

**Solutions**:
1. Wait for at least 2 players to join
2. Check that lobby creator clicks "Start Game"
3. Check browser console for JavaScript errors

#### Database connection timeouts

**Causes**:
- Supabase project is asleep (free tier pauses after 1 week)
- Network/firewall blocking connection
- Database out of connections

**Solutions**:
1. Visit Supabase dashboard to wake up project
2. Increase max connections in Supabase settings
3. Use connection pooling if available

### Getting Help

1. **Check Supabase Dashboard**
   - Database → Logs (server errors)
   - Authentication → Users (new signups)
   - Authentication → Logs (auth errors)

2. **Check Browser Console**
   - F12 → Console tab
   - Look for JavaScript errors
   - Check network tab for API failures

3. **Test SQL Directly**
   - Supabase → SQL Editor
   - Try test queries
   - Check if tables/policies exist

4. **Verify Setup**
   - All environment variables set?
   - Migration SQL completed?
   - Email auth enabled?
   - Site URL configured?

5. **Check Status Pages**
   - [Supabase Status](https://status.supabase.com/)
   - [Vercel Status](https://www.vercel-status.com/)

---

## Future Enhancements

### Potential Features

- [ ] Player statistics dashboard
- [ ] Global leaderboards
- [ ] Friend system (add/remove)
- [ ] Private lobbies with passwords
- [ ] In-game chat
- [ ] Achievements/badges
- [ ] Custom avatars
- [ ] Game replays
- [ ] Tournament mode
- [ ] Custom dice variants
- [ ] Sound effects & music
- [ ] Mobile app (React Native)

### Performance Optimizations

- [ ] Enable Supabase connection pooling
- [ ] Add caching layer (Redis)
- [ ] Compress API responses
- [ ] Batch database writes
- [ ] Lazy load profile pictures

### Security Enhancements

- [ ] Rate limiting on auth/API
- [ ] CAPTCHA for signup
- [ ] Email domain whitelist
- [ ] Automated abuse detection
- [ ] Backend move validation
- [ ] Anti-cheat measures

---

## File Structure

```
/diceduel.html                        # Main game
/api/supabase-config.js               # Supabase config endpoint
/api/get-password.js                  # Password endpoint
/DICEDUEL_SETUP.md                    # This file (consolidated docs)
/DICEDUEL_MIGRATIONS.sql              # All database migrations (consolidated)
```

---

## Quick Reference

### Supabase Endpoints

| Endpoint | Purpose | Returns |
|----------|---------|---------|
| `/api/supabase-config` | Get Supabase URL & key | JSON: `{url, anonKey}` |
| `/api/get-password` | Get app password | JSON: `{password}` |

### Database Tables

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `auth.users` | User accounts (Supabase) | id, email, created_at |
| `diceduel_users_profile` | User profiles | user_id, username |
| `diceduel_lobbies` | Game lobbies | id, creator_user_id, status |

### Key Functions (JavaScript)

```javascript
// Auth
supabase.auth.signUp()              // Create account
supabase.auth.signInWithPassword()  // Login
supabase.auth.signOut()             // Logout
supabase.auth.getSession()          // Get session
supabase.auth.getUser()             // Get current user

// Database
supabase.from('table').select()     // Query
supabase.from('table').insert()     // Create
supabase.from('table').update()     // Update
supabase.from('table').delete()     // Delete

// Realtime
supabase.from('table').on('*', cb)  // Listen to changes
```

### Common Errors & Fixes

```javascript
// Error: "No auth.users row"
// Fix: Run migration SQL to create auth tables

// Error: "Unique constraint violation"
// Fix: Username or shareable_code already exists

// Error: "Permission denied (RLS)"
// Fix: User not authenticated or RLS policy doesn't allow action

// Error: "Relation does not exist"
// Fix: Run migration SQL to create tables

// Error: "CORS error"
// Fix: Check SUPABASE_URL is correct, not local file

// Error: "Socket timeout" (realtime)
// Fix: Enable realtime in Supabase, restart browser
```

---

## Support & Resources

### Documentation
- [Supabase Docs](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

### This Project
- Game: `/diceduel.html`
- Setup: This file (DICEDUEL_SETUP.md)
- Migrations: `DICEDUEL_MIGRATIONS.sql`

### Community
- Supabase Discord: https://discord.supabase.io/
- GitHub Issues: File issues with setup problems

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-10 | 2.0 | Authentication, shareable links, consolidated docs |
| Earlier | 1.0 | Basic dice game without auth |

---

**Happy Gaming! 🎲🏆**

---

*Last Updated: February 10, 2026 | Documentation Version: 2.0*
