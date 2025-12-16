# Firestore Security Rules Setup for logranks.html

## Problem
The `logranks.html` file is failing with "Missing or insufficient permissions" when trying to save batch submissions to Firestore.

## Root Cause
Firestore security rules are too restrictive and don't allow writes to the `batch_submissions` and `game_ranks` collections.

## Solution
Update your Firestore security rules in the Firebase Console:

### Step 1: Go to Firebase Console
1. Visit https://console.firebase.google.com/
2. Select your project
3. Go to **Firestore Database** > **Rules** tab

### Step 2: Apply These Rules

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow batch submissions - anyone can read/write
    match /batch_submissions/{document=**} {
      allow read: if true;
      allow write: if true;
      allow delete: if true;
    }
    
    // Allow game ranks - anyone can read/write
    match /game_ranks/{document=**} {
      allow read: if true;
      allow write: if true;
      allow delete: if true;
    }
    
    // Default: deny all other access
    match /{document=**} {
      allow read: if false;
      allow write: if false;
    }
  }
}
```

### Step 3: Publish the Rules
Click **Publish** to apply the new rules.

### Step 4: Test
1. Refresh `logranks.html` in your browser
2. Enter a BGG username and click "Load & Preview Collection"
3. Click "Save All Games Snapshot"
4. The batch should now save successfully

## Expected Collections

The app will create/use these Firestore collections:
- **batch_submissions**: Contains metadata about each batch (username, count, timestamp, etc.)
- **game_ranks**: Contains individual game records for each batch

## Security Note
⚠️ The rules above allow **public read/write access**. For production:
- Implement authentication (Google, email, etc.)
- Use authenticated user rules like:
  ```firestore
  allow write: if request.auth != null;
  ```
- Consider adding rate limiting
- Review Firestore usage regularly

## Alternative: Authenticated-Only Rules

If you want to restrict to authenticated users:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /batch_submissions/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
      allow delete: if request.auth != null;
    }
    
    match /game_ranks/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
      allow delete: if request.auth != null;
    }
    
    match /{document=**} {
      allow read: if false;
      allow write: if false;
    }
  }
}
```

Then you'll need to add authentication to `logranks.html` (Google Sign-in, etc.).

## Troubleshooting

### Error: "permission-denied"
- Security rules don't allow the operation
- Check the rules match your collections exactly
- Make sure rules are **Published** (not just saved as draft)

### Error: "failed-precondition"
- Collections don't exist (Firestore will auto-create them on first write)
- If error persists, manually create collections in Firebase Console

### Error: "unauthenticated"
- You're using authenticated rules but user isn't signed in
- Either sign user in or use public rules (Step 2 above)

## Firefox Console Debugging

Check browser console (F12 > Console) for detailed error codes:
- `permission-denied`: Rules issue
- `failed-precondition`: Firestore not ready
- `unauthenticated`: Auth required but not logged in
