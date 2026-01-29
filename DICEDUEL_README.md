# Dice Duel 🎲

A real-time multiplayer dice game built with Firebase Firestore. Players compete in turn-based dice duels to reach the target score first!

## 🎮 Game Features

### Core Gameplay
- **1-4 Players**: Create or join lobbies with up to 4 players
- **Turn-Based**: Players take turns rolling a 6-sided die
- **Reroll System**: Each turn includes 2 reroll opportunities
- **Strategic Decisions**: Stop rolling early to lock in your score or risk another roll
- **Scoring**: Points equal your final die value each turn
- **Win Conditions**: Choose to play to 10, 21, or 50 points

### Real-Time Features
- **Live Updates**: All players see game state changes instantly
- **Real-Time Lobby Browser**: See available games update automatically
- **Synchronized Gameplay**: Turn progression and scores sync across all devices
- **Resume Games**: Turn-based nature allows players to take breaks and return

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
3. Enter your player name
4. Choose your action:
   - **Create a Lobby**: Set a name and target score (10, 21, or 50)
   - **Join a Lobby**: Click any available lobby in the list
5. Wait for other players to join (2-4 players recommended)
6. Host clicks "Start Game" when ready
7. Take turns:
   - Click "🎲 Roll Dice" to roll
   - Use up to 2 rerolls to improve your score
   - Click "✓ Keep Score" when satisfied
8. First to reach the target score wins! 🏆

### For Administrators

See [DICEDUEL_SETUP.md](./DICEDUEL_SETUP.md) for complete Firebase configuration instructions.

## 📱 Screenshots

### Login Screen
![Login Screen](https://github.com/user-attachments/assets/208d48d1-fb81-4597-af33-6d83cdf9856f)

### Lobby Browser & Create Lobby
![Create Lobby](https://github.com/user-attachments/assets/32eccf4d-833d-40ce-81e8-a09aa6bb4599)

## 🔧 Technical Details

### Built With
- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript
- **Backend**: Firebase Firestore (Real-time NoSQL database)
- **Hosting**: Vercel
- **Security**: Environment variable-based configuration

### Firebase Integration
- Uses existing `/api/firebase-config` endpoint
- Real-time listeners for lobby and game state updates
- Automatic cleanup when players leave
- Optimized queries for performance

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
- Password protection via `/api/get-password`
- Open Firestore rules for ease of use
- No user authentication system

### Production Recommendations
For production deployment, consider:
1. Enable Firebase Authentication (email/password or social login)
2. Implement stricter Firestore security rules
3. Add server-side move validation
4. Implement rate limiting
5. Add anti-cheat measures

See [DICEDUEL_SETUP.md](./DICEDUEL_SETUP.md) for detailed security guidelines.

## 📊 Database Structure

### Collection: `diceduel_lobbies`

```javascript
{
  name: "My Game",           // Lobby display name
  creator: "Alice",          // Player who created lobby
  winScore: 21,              // Target score (10, 21, or 50)
  players: ["Alice", "Bob"], // Array of player names
  status: "playing",         // waiting | playing | finished
  currentTurn: 0,            // Current player index (0-3)
  gameStarted: true,         // Whether game has begun
  createdAt: Timestamp,      // Creation timestamp
  playerScores: {            // Player scores map
    "Alice": 15,
    "Bob": 12
  },
  history: [{                // Game move history
    player: "Alice",
    roll: 5,
    rerolls: 1,
    score: 15,
    timestamp: Timestamp
  }]
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

Note: Firebase functionality requires proper environment variables in production.

### File Structure
```
/diceduel.html          # Main game application
/DICEDUEL_SETUP.md      # Firebase setup guide
/api/firebase-config.js # Firebase config endpoint (existing)
/api/get-password.js    # Password endpoint (existing)
```

## 🐛 Troubleshooting

### "Failed to initialize database"
- Verify Firebase environment variables are set in Vercel
- Check Firebase project is active
- Ensure Firestore is enabled

### Players can't see each other's moves
- Check internet connection
- Verify Firestore security rules allow read/write
- Check browser console for errors

### Game not starting
- Minimum 2 players required
- Only lobby creator can start the game
- Check for JavaScript errors in console

### Lobby disappeared
- Lobbies auto-delete when all players leave
- Creator leaving deletes the lobby
- Check if game status changed

## 📝 Future Enhancements

Possible additions:
- [ ] Player profiles and statistics
- [ ] Leaderboards
- [ ] Tournament mode
- [ ] Custom dice faces
- [ ] Sound effects
- [ ] Chat system
- [ ] Spectator mode
- [ ] Game replays
- [ ] Multiple game variants (highest roll, lowest roll, etc.)
- [ ] Achievements system

## 📄 License

Part of the sportomax1/vercel repository.

## 🤝 Contributing

This is a personal project but suggestions and bug reports are welcome!

## 📞 Support

For issues:
1. Check [DICEDUEL_SETUP.md](./DICEDUEL_SETUP.md)
2. Review Firebase Console for errors
3. Check browser console logs
4. Verify environment variables

## 🎲 Have Fun!

Enjoy playing Dice Duel with your friends! May the best roller win! 🏆
