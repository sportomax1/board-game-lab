# Dice Duel - Firebase Configuration Guide

## Overview

Dice Duel is a real-time multiplayer dice game built with Firebase Firestore. Players can create or join lobbies, play turn-based dice games with 1-4 players, and compete to reach a target score (10, 21, or 50 points).

## Firebase Setup Instructions

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard to create your project
4. Enable Google Analytics (optional but recommended)

### 2. Enable Firestore Database

1. In your Firebase project, navigate to **Build > Firestore Database**
2. Click **Create database**
3. Choose **Production mode** for security (we'll set up rules next)
4. Select a Firestore location (choose closest to your users)
5. Click **Enable**

### 3. Configure Firestore Security Rules

Navigate to the **Rules** tab in Firestore and replace with the following rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Dice Duel lobbies
    match /diceduel_lobbies/{lobbyId} {
      // Anyone can read lobbies
      allow read: if true;
      
      // Anyone can create a lobby
      allow create: if true;
      
      // Only players in the lobby can update it
      allow update: if request.auth != null || 
                       resource.data.players.hasAny([request.resource.data.players]);
      
      // Anyone can delete (cleanup)
      allow delete: if true;
    }
  }
}
```

**Note:** For a production environment, you should implement Firebase Authentication and more restrictive rules. The above rules allow public access for ease of use but should be tightened based on your security requirements.

### 4. Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **Your apps** section
3. Click the **Web** icon (`</>`) to add a web app
4. Register your app with a nickname (e.g., "Dice Duel")
5. Copy the Firebase configuration object that looks like:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### 5. Configure Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings > Environment Variables**
3. Add the following environment variables from your Firebase config:

| Variable Name | Value | Example |
|--------------|-------|---------|
| `FIREBASE_API_KEY` | Your Firebase API Key | `AIzaSyAbc123...` |
| `FIREBASE_AUTH_DOMAIN` | Your Auth Domain | `myproject.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | Your Project ID | `myproject-12345` |
| `FIREBASE_STORAGE_BUCKET` | Your Storage Bucket | `myproject.appspot.com` |
| `FIREBASE_MESSAGING_SENDER_ID` | Your Messaging Sender ID | `123456789012` |
| `FIREBASE_APP_ID` | Your App ID | `1:123456789012:web:abc123` |

4. Make sure to set these for **Production**, **Preview**, and **Development** environments
5. Click **Save**

### 6. Deploy to Vercel

After setting up the environment variables:

1. Push your code to your Git repository
2. Vercel will automatically deploy
3. The `/api/firebase-config` endpoint will securely provide Firebase config to your app

## Firestore Database Structure

The app uses a single collection:

### Collection: `diceduel_lobbies`

Each document represents a game lobby/session:

```javascript
{
  name: string,              // Lobby display name
  creator: string,           // Player who created the lobby
  winScore: number,          // Target score (10, 21, or 50)
  players: [string],         // Array of player names
  status: string,            // 'waiting' | 'playing' | 'finished'
  currentTurn: number,       // Index of current player (0-3)
  gameStarted: boolean,      // Whether game has begun
  createdAt: Timestamp,      // Creation timestamp
  playerScores: {            // Map of player scores
    [playerName]: number
  },
  history: [{                // Array of game moves
    player: string,
    roll: number,
    rerolls: number,
    score: number,
    timestamp: Timestamp
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
- **Real-time Updates:** All players see game state changes instantly

### Features Included

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

✅ **Real-Time Updates**
- Instant synchronization across all players
- Live score updates
- Real-time game history

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
- Gradient background design
- Smooth animations

✅ **Additional Features**
- Password protection
- Player name persistence
- Lobby cleanup (auto-delete when empty)
- Visual indicators for turn status
- Score tracking per player

## Usage

### For Players

1. Navigate to `/diceduel.html`
2. Enter the app password
3. Enter your player name
4. Choose to:
   - **Create a lobby:** Set lobby name and target score
   - **Join a lobby:** Click on any available lobby
5. Wait for other players (2-4 players recommended)
6. Host clicks "Start Game" when ready
7. Take turns rolling dice:
   - Click "Roll Dice" to roll
   - Use up to 2 rerolls
   - Click "Keep Score" to lock in your points
8. First player to reach target score wins!

### For Administrators

- Use the password system to control access
- Monitor Firebase Console for database usage
- Adjust Firestore security rules as needed
- Set up Firebase Authentication for production use

## Security Considerations

### Current Implementation

The current implementation uses:
- **Password protection** via the existing `/api/get-password` endpoint
- **Open Firestore rules** for ease of use
- **No user authentication** system

### Recommended for Production

For a production deployment, consider:

1. **Enable Firebase Authentication**
   - Add email/password or social login
   - Update security rules to require authentication
   
2. **Improve Firestore Rules**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /diceduel_lobbies/{lobbyId} {
         allow read: if request.auth != null;
         allow create: if request.auth != null;
         allow update: if request.auth != null && 
                         request.auth.token.name in resource.data.players;
         allow delete: if request.auth != null && 
                         request.auth.token.name == resource.data.creator;
       }
     }
   }
   ```

3. **Add Rate Limiting**
   - Implement Cloud Functions for move validation
   - Add rate limiting to prevent spam

4. **Data Validation**
   - Validate dice rolls server-side
   - Ensure turn order is enforced
   - Prevent cheating

## Maintenance

### Database Cleanup

Lobbies are automatically deleted when:
- All players leave
- The lobby creator leaves

For additional cleanup, you can:
1. Set up Cloud Functions to delete old finished games
2. Manually delete old documents from Firebase Console

### Monitoring

Monitor your Firebase usage:
- **Firestore reads/writes:** Check Firebase Console > Usage
- **Storage:** Monitor document count
- **Bandwidth:** Track data transfer

## Troubleshooting

### "Failed to initialize database"
- Check that all environment variables are set in Vercel
- Verify Firebase project is active
- Ensure Firestore is enabled

### "Lobby not found"
- Lobby may have been deleted
- Refresh the lobby list
- Check Firestore rules allow read access

### Players can't see updates
- Verify internet connection
- Check browser console for errors
- Ensure Firestore rules allow read/write
- Check Firebase project quota isn't exceeded

### Game not starting
- Ensure at least 2 players in lobby
- Only the lobby creator can start the game
- Check for JavaScript errors in console

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)

## Support

For issues or questions:
1. Check Firebase Console for errors
2. Review browser console logs
3. Verify environment variables are set correctly
4. Test with a fresh Firebase project if needed
