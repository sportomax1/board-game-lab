# Game Rank Logger - Quick Start

## ⚡ 5-Minute Setup

### 1. Add Firebase Service Account to Vercel

Go to **Vercel Dashboard** → **Settings** → **Environment Variables**

Paste these (from Firebase Console → Service Accounts):
```
FIREBASE_PROJECT_ID
FIREBASE_PRIVATE_KEY_ID  
FIREBASE_PRIVATE_KEY     (⚠️ Keep literal \n characters)
FIREBASE_CLIENT_EMAIL
FIREBASE_CLIENT_ID
```

### 2. Add BGG Token

```
BGG_API_TOKEN
```

### 3. Deploy

```bash
git add .
git commit -m "Add log-ranks endpoint and automation"
git push
```

Vercel automatically picks up cron config from `vercel.json`

### 4. Test

Open `/private/logranks.html` → Click "Add New Snapshot" → Select game → Save

Check Firestore collection `game_ranks` for new document ✅

---

## 📅 Automation Runs at 1 AM UTC Daily

**View runs:**
- Vercel Dashboard → Functions → Logs → Search "log-ranks"

**Manual trigger:**
```bash
curl "https://your-site.com/api/log-ranks?username=sportomax"
```

---

## 📊 Firestore Structure

Collection: `game_ranks`
- gameId, gameName, thumbnail, year
- rating: {value, usersrated, average, bayesaverage, stddev, median}
- ranks: [{type, name, friendlyname, value, bayesaverage}, ...]
- timestamp, dateCaptured, source

---

## 🔗 Full Docs

See `LOGRANKS_SETUP.md` for detailed setup, troubleshooting, and advanced options
