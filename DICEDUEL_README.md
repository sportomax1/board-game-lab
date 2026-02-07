# Dice Duel 🎲

A real-time multiplayer dice game built with Supabase. Players compete in turn-based dice duels to reach the target score first!

## 🎮 Game Features

### Core Gameplay
- **1-4 Players**: Create or join lobbies with up to 4 players
- **Turn-Based**: Players take turns rolling a 6-sided die
- **Reroll System**: Each turn includes 2 reroll opportunities
- **Strategic Decisions**: Stop rolling early to lock in your score or risk another roll
- **Scoring**: Points equal your final die value each turn
- **Win Conditions**: Choose to play to 10, 21, or 50 points

### Real-Time Features
- **Live Updates**: All players see game state changes instantly via Supabase Realtime
- **Real-Time Lobby Browser**: See available games update automatically
- **Synchronized Gameplay**: Turn progression and scores sync across all devices
- **Resume Games**: Turn-based nature allows players to take breaks and return

### Authentication & Sharing
- ✅ **User Accounts**: Sign up and login with email and password
- ✅ **Unique Usernames**: Choose your gaming identity
- ✅ **Cross-Device Access**: Play on any device with your account
- ✅ **Shareable Links**: Send game invites to friends via unique URLs
- ✅ **Session Persistence**: Stay logged in across browser sessions

### UI/UX Features
- ✅ **Mobile-Responsive Design**: Optimized for phones and tablets
- ✅ **Smooth Animations**: Dice rolling with rotation and bounce effects
- ✅ **Visual Feedback**: Clear turn indicators and player status
- ✅ **Game History**: Track all moves with scrollable history panel
- ✅ **Winner Celebration**: Trophy screen with final scores
- ✅ **Gradient Background**: Beautiful purple gradient design
- ✅ **Password Protection**: Secure access control
- ✅ **Player Persistence**: Your name is saved between sessions

## 🚀 Getting Started

### For Players

1. Navigate to `/diceduel.html` on your deployed site
2. Enter the app password (set by your administrator)
3. **Sign Up** (new users) or **Login** (returning users):
   - **Sign Up**: Choose a username, enter email and password
   - **Login**: Enter your email and password
4. Choose your action:
   - **Create a Lobby**: Set a name and target score (10, 21, or 50)
   - **Join a Lobby**: Click any available lobby in the list
   - **Join via Link**: Click a shared lobby link from a friend
5. **Share Your Game**: Click "Copy Link" to invite friends to your lobby
6. Wait for other players to join (2-4 players recommended)
7. Host clicks "Start Game" when ready
8. Take turns:
   - Click "🎲 Roll Dice" to roll
   - Use up to 2 rerolls to improve your score
   - Click "✓ Keep Score" when satisfied
9. First to reach the target score wins! 🏆
10. **Play Anywhere**: Login from any device to access your account

### For Administrators

1. **Basic Setup**: See [DICEDUEL_SUPABASE_SETUP.md](./DICEDUEL_SUPABASE_SETUP.md) for database configuration
2. **Authentication Setup**: See [DICEDUEL_AUTH_SETUP.md](./DICEDUEL_AUTH_SETUP.md) for user authentication configuration
3. **Quick Start**: Run [DICEDUEL_AUTH_MIGRATION.sql](./DICEDUEL_AUTH_MIGRATION.sql) in Supabase SQL Editor

## 🔧 Technical Details

### Built With
- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Hosting**: Vercel
- **Security**: Environment variable-based configuration

### Supabase Integration
- Uses custom `/api/supabase-config` endpoint for secure credential delivery
- Real-time listeners for lobby and game state updates
- PostgreSQL database with JSONB for flexible data storage
- Automatic cleanup when players leave
- Optimized queries with indexes

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Requires JavaScript enabled
- Requires internet connection for real-time sync

## 🎯 Game Rules

### Setup
1. Host creates a lobby and sets the target score
2. 2-4 players join the lobby
3. Host starts the game when ready

### Gameplay
1. Players take turns in order
2. On your turn:
   - Roll a 6-sided die
   - You can reroll up to 2 times
   - Your score for this turn equals your final die value
   - Click "Keep Score" to lock in your points
3. First player to reach or exceed the target score wins

### Strategy Tips
- **High Rolls**: If you roll a 5 or 6 early, consider keeping it
- **Low Rolls**: Use your rerolls if you get 1-3
- **Risk vs Reward**: Sometimes a guaranteed 4 is better than risking for a 6
- **Score Tracking**: Watch other players' scores to plan your strategy
- **Endgame**: When you're close to winning, any score might do!

## 🔒 Security

### Current Setup
- **App password protection** via `/api/get-password` for initial access
- **User authentication** with Supabase Auth (email/password)
- **Row Level Security (RLS)** policies for authenticated users
- **User profiles** with unique usernames
- **Session management** with secure JWT tokens

### Features
- Unique shareable lobby codes (9-character alphanumeric)
- Authenticated users can only modify their own lobbies
- Users tracked by secure user IDs, not display names
- Session persistence across devices
- Email verification (optional, configurable)

### Production Recommendations
For production deployment, consider:
1. Enable email verification for new signups (Supabase Auth settings)
2. Add rate limiting for signup/login attempts
3. Implement server-side move validation via Edge Functions
4. Add CAPTCHA for account creation
5. Monitor user activity and implement abuse prevention
6. Set up automated database cleanup for old lobbies
7. Configure proper CORS and security headers

See [DICEDUEL_AUTH_SETUP.md](./DICEDUEL_AUTH_SETUP.md) for detailed security guidelines.

## 📊 Database Structure

### Table: `diceduel_users_profile`

User profile information linked to Supabase Auth:

```javascript
{
  id: UUID,                  // References auth.users(id)
  username: string,          // Unique username (3-20 chars)
  display_name: string,      // Display name for game
  created_at: timestamp,     // Account creation time
  last_seen: timestamp,      // Last activity timestamp
  games_played: number,      // Total games played
  games_won: number          // Total games won
}
```

### Table: `diceduel_lobbies`

```javascript
{
  id: number,                // Auto-generated primary key
  created_at: timestamp,     // Auto-generated timestamp
  name: string,              // Lobby display name
  creator: string,           // Creator's display name
  creator_user_id: UUID,     // Creator's user ID (NEW)
  win_score: number,         // Target score (10, 21, or 50)
  players: [string],         // Array of player display names
  player_user_ids: [UUID],   // Array of player user IDs (NEW)
  status: string,            // 'waiting' | 'playing' | 'finished'
  current_turn: number,      // Current player index (0-3)
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
  }],
  shareable_code: string     // Unique 9-char code for sharing (NEW)
}
```

## 🛠️ Development

### Local Testing

```bash
# Start a local server
python3 -m http.server 8080

# Navigate to
http://localhost:8080/diceduel.html
```

Note: Supabase functionality requires proper environment variables in production.

### File Structure
```
/diceduel.html                    # Main game application
/DICEDUEL_README.md               # This file
/DICEDUEL_SUPABASE_SETUP.md       # Supabase setup guide
/api/supabase-config.js           # Supabase config endpoint
/api/get-password.js              # Password endpoint (existing)
```

## 🐛 Troubleshooting

### "Failed to initialize database"
- Verify Supabase environment variables are set in Vercel
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
- Check Supabase project is active (not paused)
- Ensure tables `diceduel_lobbies` and `users_profile` exist
- Run [DICEDUEL_AUTH_MIGRATION.sql](./DICEDUEL_AUTH_MIGRATION.sql) if authentication is not working

### Authentication issues
- **"Email not confirmed"**: Check email for confirmation link, or disable email confirmation in Supabase Auth settings
- **"Username already taken"**: Choose a different username or check `users_profile` table
- **"Invalid login credentials"**: Verify email and password are correct
- **Session not persisting**: Check that browser localStorage is enabled
- See [DICEDUEL_AUTH_SETUP.md](./DICEDUEL_AUTH_SETUP.md) for detailed troubleshooting

### Shareable links not working
- Verify lobby exists and is in 'waiting' or 'playing' status
- Check that `shareable_code` column exists in database
- Ensure URL format is correct: `?join=CODE`
- Check browser console for errors

### Players can't see each other's moves
- Check internet connection
- Verify Supabase Realtime is enabled
- Check browser console for WebSocket errors
- Ensure RLS policies allow read access for authenticated users

### Game not starting
- Minimum 2 players required
- Only lobby creator can start the game
- Check for JavaScript errors in console

### Lobby disappeared
- Lobbies auto-delete when all players leave
- Creator leaving deletes the lobby
- Check if game status changed to 'finished'

### Database connection errors
- Verify environment variables in Vercel
- Check Supabase project isn't paused (free tier)
- Ensure you're not exceeding free tier limits
- Check Supabase Dashboard for errors

## 📝 Future Enhancements

Possible additions:
- [x] User authentication via Supabase Auth ✅
- [x] Shareable lobby links ✅
- [ ] Player profiles and statistics dashboard
- [ ] Leaderboards (global and friends)
- [ ] Tournament mode
- [ ] Custom dice faces
- [ ] Sound effects and music
- [ ] In-game chat system
- [ ] Spectator mode enhancements
- [ ] Game replays
- [ ] Multiple game variants (highest roll, lowest roll, etc.)
- [ ] Achievements system
- [ ] Player ratings (ELO system)
- [ ] Friend system
- [ ] Private lobbies with passwords

## 📄 License

Part of the sportomax1/vercel repository.

## 🤝 Contributing

This is a personal project but suggestions and bug reports are welcome!

## 📞 Support

For issues:
1. Check [DICEDUEL_SUPABASE_SETUP.md](./DICEDUEL_SUPABASE_SETUP.md)
2. Review Supabase Dashboard for errors
3. Check browser console logs
4. Verify environment variables in Vercel
5. Check Supabase Status page

## 🎲 Have Fun!

Enjoy playing Dice Duel with your friends! May the best roller win! 🏆

---

**Tech Stack**: Supabase • PostgreSQL • Realtime • Vercel • Tailwind CSS
