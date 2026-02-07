# Dice Duel Authentication - Quick Start Guide

## 🚀 What You Need to Do

### 1. Configure Supabase (5 minutes)

#### Enable Authentication
1. Go to Supabase Dashboard → **Authentication** → **Providers**
2. Enable **Email** provider
3. Toggle off "Confirm email" (for testing) or leave on (for production)

#### Run Database Migration
1. Go to **SQL Editor**
2. Copy all content from `DICEDUEL_AUTH_MIGRATION.sql`
3. Paste and click **Run**

#### Set Site URL
1. Go to **Authentication** → **URL Configuration**
2. Set Site URL: `https://your-site.vercel.app`
3. Add Redirect URL: `https://your-site.vercel.app/diceduel.html`

### 2. Test the Implementation

#### Test Signup
```
1. Visit /diceduel.html
2. Enter app password
3. Click "Sign Up" tab
4. Enter username (e.g., "player123")
5. Enter email (e.g., "test@example.com")
6. Enter password (6+ chars)
7. Click "Sign Up"
✅ You should be logged in and see the lobby list
```

#### Test Login
```
1. Logout
2. Enter app password
3. Click "Login" tab
4. Enter your email and password
5. Click "Login"
✅ You should be logged in with your username
```

#### Test Shareable Links
```
1. Create a lobby
2. Look for "📋 Copy Link" button
3. Click it to copy the link
4. Open link in incognito/private window
5. Login with a different account
✅ You should auto-join the lobby
```

### 3. Check Database

After signup, verify in Supabase:

**Table: auth.users**
- Should have new user with email

**Table: diceduel_users_profile**
- Should have matching user_id with username and display_name

**Table: diceduel_lobbies (when lobby created)**
- Should have creator_user_id (UUID)
- Should have shareable_code (9 chars)

## 📋 Checklist

Configuration:
- [ ] Supabase Email authentication enabled
- [ ] Migration SQL executed successfully
- [ ] Site URL configured
- [ ] Redirect URLs added

Testing:
- [ ] Signup works and creates profile
- [ ] Login works and restores session
- [ ] Logout clears session
- [ ] Lobby creation generates shareable code
- [ ] Copy link button works
- [ ] Shareable link auto-joins lobby
- [ ] Multiple users can join same lobby
- [ ] Game works after authentication

## 🎯 Expected Behavior

### Authentication Flow
```
User visits site
    ↓
App password screen
    ↓
[Existing session?] → Yes → Skip to lobby list
    ↓ No
Login/Signup tabs
    ↓
User signs up or logs in
    ↓
Profile created/loaded
    ↓
Lobby list displayed
```

### Shareable Link Flow
```
User creates lobby
    ↓
Unique code generated (e.g., "ABC123XYZ")
    ↓
User clicks "Copy Link"
    ↓
Link: https://site.com/diceduel.html?join=ABC123XYZ
    ↓
Friend opens link
    ↓
Auto-login prompt
    ↓
After login, automatically joins lobby ABC123XYZ
```

## 🔧 Troubleshooting

**"Email not confirmed" error**
→ Disable email confirmation in Supabase or check email inbox

**"Username already taken"**
→ Choose different username (must be unique)

**"Failed to initialize database"**
→ Verify migration SQL was run and tables exist

**Shareable link doesn't work**
→ Check lobby still exists and code is correct

**Session not persisting**
→ Enable localStorage in browser settings

## 📱 Multi-Device Testing

1. Login on desktop with account A
2. Create a lobby
3. Copy the shareable link
4. On mobile, open the link
5. Login with account B
6. Should auto-join the lobby
7. Start game and verify real-time sync

## 🔐 Security Notes

- Passwords are hashed by Supabase (bcrypt)
- User IDs are UUIDs (secure, random)
- JWT tokens for session management
- RLS policies restrict data access
- Shareable codes use crypto-secure randomness

## 📊 Database Tables

**diceduel_users_profile** - User accounts
```
id          | UUID (references auth.users)
username    | TEXT (unique, 3-20 chars)
display_name| TEXT (display name)
email       | TEXT (from auth)
created_at  | TIMESTAMP
last_seen   | TIMESTAMP
games_played| INT
games_won   | INT
```

**diceduel_lobbies** - Game lobbies
```
[existing fields...]
creator_user_id  | UUID (NEW)
player_user_ids  | UUID[] (NEW)
shareable_code   | TEXT (NEW, unique)
```

## 🎉 Success Indicators

You'll know it's working when:
✅ Users can sign up with username, email, password
✅ Login works and persists across refreshes
✅ Lobby shows "📋 Copy Link" button
✅ Copied links have format: ?join=CODE
✅ Friends can join via shared links
✅ Users can login from any device
✅ Logout properly clears the session

## 📚 Full Documentation

For detailed information:
- **Setup**: [DICEDUEL_AUTH_SETUP.md](./DICEDUEL_AUTH_SETUP.md)
- **Migration**: [DICEDUEL_AUTH_MIGRATION.sql](./DICEDUEL_AUTH_MIGRATION.sql)
- **User Guide**: [DICEDUEL_IMPLEMENTATION_SUMMARY.md](./DICEDUEL_IMPLEMENTATION_SUMMARY.md)
- **Game Info**: [DICEDUEL_README.md](./DICEDUEL_README.md)

## 🆘 Need Help?

Check the troubleshooting sections in:
1. [DICEDUEL_AUTH_SETUP.md](./DICEDUEL_AUTH_SETUP.md#troubleshooting)
2. [DICEDUEL_IMPLEMENTATION_SUMMARY.md](./DICEDUEL_IMPLEMENTATION_SUMMARY.md#-common-issues--solutions)

---

**Implementation Status**: ✅ Complete and Ready for Testing
**Code Changes**: All committed and pushed
**Next Action**: Configure Supabase and test!
