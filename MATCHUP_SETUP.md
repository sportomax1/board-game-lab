# Game Matchup Tracker - Firebase Setup Guide

## Overview
This guide will help you set up Firebase Firestore for the Game Matchup Tracker app. The app stores matchup results in a Firestore database and uses GitHub secrets to configure Firebase (no Vercel secrets needed).

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add Project**
3. Enter project name (e.g., "game-matchup-tracker")
4. Disable Google Analytics (optional)
5. Click **Create Project**

## Step 2: Create Firestore Database

1. In your Firebase project, click **Firestore Database** in the left sidebar
2. Click **Create database**
3. Select **Start in production mode** (we'll configure rules later)
4. Choose a Cloud Firestore location (e.g., `us-central1`)
5. Click **Enable**

## Step 3: Configure Firestore Security Rules

1. In Firestore Database, click the **Rules** tab
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anyone to read and write matchups (for now)
    // TODO: Add authentication for production use
    match /matchups/{matchupId} {
      allow read, write: if true;
    }
    
    match /games/{gameId} {
      allow read, write: if true;
    }
  }
}
```

3. Click **Publish**

⚠️ **Security Note**: These rules allow anyone to read/write your data. For production, you should:
- Enable Firebase Authentication
- Restrict writes to authenticated users
- Add user-specific data isolation

## Step 4: Get Firebase Configuration

1. In Firebase Console, click the gear icon ⚙️ next to **Project Overview**
2. Select **Project settings**
3. Scroll down to **Your apps** section
4. Click the **Web** icon (`</>`) to add a web app
5. Enter app nickname (e.g., "Matchup Web App")
6. **Do NOT** enable Firebase Hosting
7. Click **Register app**
8. Copy the `firebaseConfig` object values:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",              // FIREBASE_API_KEY
  authDomain: "xxx.firebaseapp.com",
  projectId: "xxx",
  storageBucket: "xxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc"
};
```

## Step 5: Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following 6 secrets:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `FIREBASE_API_KEY` | Your API key | `AIzaSyC...` |
| `FIREBASE_AUTH_DOMAIN` | Auth domain | `myproject.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | Project ID | `myproject-12345` |
| `FIREBASE_STORAGE_BUCKET` | Storage bucket | `myproject.appspot.com` |
| `FIREBASE_MESSAGING_SENDER_ID` | Sender ID | `123456789012` |
| `FIREBASE_APP_ID` | App ID | `1:123:web:abc123` |

## Step 6: Configure Vercel Environment Variables

Since we're using a Vercel serverless function (`/api/firebase-config.js`) to serve the Firebase config, we need to add the same 6 environment variables to Vercel:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click **Settings** → **Environment Variables**
4. Add the following 6 variables (same as GitHub secrets):

| Variable Name | Value |
|---------------|-------|
| `FIREBASE_API_KEY` | Your API key |
| `FIREBASE_AUTH_DOMAIN` | Auth domain |
| `FIREBASE_PROJECT_ID` | Project ID |
| `FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `FIREBASE_MESSAGING_SENDER_ID` | Sender ID |
| `FIREBASE_APP_ID` | App ID |

5. Make sure to select **Production**, **Preview**, and **Development** for each variable
6. Click **Save**

## Step 7: Redeploy to Vercel

After adding environment variables, trigger a new deployment:

```bash
git add .
git commit -m "Add Firebase matchup tracker"
git push origin main
```

Vercel will automatically redeploy with the new environment variables.

## Step 8: Test the App

1. Visit your deployed app: `https://your-vercel-app.vercel.app/matchup.html`
2. Click **Load Games**
3. Enter your BGG username
4. Start comparing games by swiping or tapping
5. Check the Dashboard to see saved matchups

## Firestore Data Structure

### Collection: `matchups`
Each matchup document contains:

```javascript
{
  winnerId: "174430",           // BGG game ID
  winnerName: "Gloomhaven",
  winnerImage: "https://...",
  loserId: "167791",
  loserName: "Terraforming Mars",
  loserImage: "https://...",
  notes: "Optional notes",      // User's notes
  timestamp: Timestamp          // When matchup was recorded
}
```

### Collection: `games` (Future)
Optional collection to store game metadata for faster lookups.

## Troubleshooting

### Firebase Not Loading
- Check browser console for errors
- Verify all 6 Vercel environment variables are set
- Ensure `/api/firebase-config.js` endpoint is accessible
- Test: Visit `https://your-app.vercel.app/api/firebase-config` to see config JSON

### Permission Denied Errors
- Check Firestore security rules in Firebase Console
- Ensure rules allow read/write access
- Verify Firestore database is created and enabled

### Games Not Loading
- Ensure BGG username is correct and public
- Check BGG API status: https://boardgamegeek.com/xmlapi2/collection?username=YOUR_USERNAME
- BGG API requires collections to be public

### Dashboard Not Showing Matchups
- Open browser DevTools → Console
- Look for Firebase errors
- Verify Firestore database has `matchups` collection
- Check if data is being written (Firebase Console → Firestore Database)

## Advanced: Add Firebase Authentication

For production use, you should add authentication:

1. Enable **Email/Password** or **Google** authentication in Firebase Console
2. Update Firestore rules to require authentication:

```javascript
match /matchups/{matchupId} {
  allow read, write: if request.auth != null;
}
```

3. Add Firebase Auth to `matchup.html`:

```javascript
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Sign in
await signInWithPopup(auth, provider);
```

## Local Development

For local testing without deploying to Vercel:

1. Create a `.env` file with your Firebase config:

```
FIREBASE_API_KEY=AIza...
FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
FIREBASE_PROJECT_ID=xxx
FIREBASE_STORAGE_BUCKET=xxx.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123:web:abc
```

2. Update `matchup.html` to use the config directly (for dev only):

Replace the `initFirebase()` function with:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

3. Run `vercel dev` to test locally

## Support

- Firebase Documentation: https://firebase.google.com/docs/firestore
- BGG API Documentation: https://boardgamegeek.com/wiki/page/BGG_XML_API2
- Vercel Documentation: https://vercel.com/docs

## Security Recommendations

1. **Enable Firebase Authentication** before making app public
2. **Add rate limiting** to prevent API abuse
3. **Implement user-specific data** (only see your own matchups)
4. **Add data validation** in Firestore security rules
5. **Monitor Firebase usage** to avoid unexpected costs
6. **Set up Firebase budget alerts** in Google Cloud Console

## Next Steps

- Add Firebase Authentication
- Implement user profiles
- Add game search functionality
- Export matchup history to CSV
- Add game statistics and rankings
- Implement shared matchup challenges with friends
