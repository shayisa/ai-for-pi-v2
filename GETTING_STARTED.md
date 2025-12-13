# Getting Started: AI Newsletter Generator

Complete setup guide for cloning and running this project from scratch.

---

## Project Overview

The **AI Newsletter Generator** is a full-stack application that:
- Generates AI-powered newsletters using Claude API with web search grounding
- Creates custom images for each section using Stability AI
- Saves newsletters to Google Drive as self-contained HTML files
- Sends newsletters via Gmail to subscriber lists
- Stores all data locally in SQLite (newsletters, subscribers, API keys)

**Tech Stack:**
- Backend: Node.js + Express + TypeScript
- Frontend: React 19 + Vite + TypeScript
- Database: SQLite (local file-based storage)
- External APIs: Claude, Stability AI, Brave Search, Google Workspace

---

## Quick Start (5 Minutes)

### Prerequisites
- Node.js 18+ (check with `node --version`)
- Git
- A GitHub account (to clone the repo)

### Step 1: Clone the Repository
```bash
git clone https://github.com/shayisa/ai-for-pi-v2.git
cd ai-for-pi-v2
npm install
```

### Step 2: Set Up Environment File
```bash
cp .env.local.example .env.local
```

### Step 3: Add API Keys (Optional)
You can either:
- Edit `.env.local` and add your API keys there, OR
- Start the app and add keys via Settings UI (recommended)

### Step 4: Run the Application
```bash
npm run dev:all
```

This starts:
- Backend on `http://localhost:3001`
- Frontend on `http://localhost:5173`

---

## API Keys Setup

### API Key Overview

| Service | Purpose | How to Add | Required |
|---------|---------|------------|----------|
| **Claude (Anthropic)** | Newsletter content generation | Settings UI or .env.local | Yes |
| **Stability AI** | Image generation | Settings UI or .env.local | Yes |
| **Brave Search** | Web search grounding | Settings UI or .env.local | Optional |
| **Google OAuth** | Google Workspace access | config.js | For Drive/Gmail |

---

## Step-by-Step Setup Guide

### Phase 1: Anthropic (Claude API)

#### 1.1 Get Claude API Key
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Go to **API Keys** (left sidebar)
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-`)

#### 1.2 Add to App
**Option A: Via Settings UI (Recommended)**
1. Start the app: `npm run dev:all`
2. Go to `http://localhost:5173`
3. Sign in with Google
4. Click **Settings** (gear icon)
5. Go to **API Key Management**
6. Paste your Claude API key
7. Click **Save**
8. You should see ✅ **Valid**

**Option B: Via Environment Variable**
Add to `.env.local`:
```env
ADMIN_EMAIL=your-google-email@gmail.com
VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here
```

---

### Phase 2: Stability AI (Image Generation)

#### 2.1 Get Stability AI API Key
1. Go to https://platform.stability.ai/
2. Sign up or log in
3. Go to your **Account** > **API Keys**
4. Copy your API key

#### 2.2 Add to App
Add via Settings UI or `.env.local`:
```env
VITE_STABILITY_API_KEY=sk-your-key-here
```

---

### Phase 3: Brave Search (Optional)

#### 3.1 Get Brave Search API Key
1. Go to https://api.search.brave.com/
2. Sign up and get an API key
3. Copy your API key

#### 3.2 Add to App
Add via Settings UI or `.env.local`:
```env
VITE_BRAVE_SEARCH_API_KEY=BSA-your-key-here
```

---

### Phase 4: Google Workspace Setup

#### 4.1 Create Google Cloud Project
1. Go to https://console.cloud.google.com/
2. Sign in with your Google account
3. Click **NEW PROJECT**
4. Name it: `AI Newsletter Generator`
5. Click **Create**

#### 4.2 Enable Required APIs
In the Google Cloud Console:
1. Go to **APIs & Services** > **Library**
2. Enable each:
   - **Google Drive API**
   - **Google Sheets API**
   - **Gmail API**

#### 4.3 Create OAuth Consent Screen
1. Go to **APIs & Services** > **OAuth consent screen**
2. Select **External** user type
3. Fill in:
   - **App name:** `AI Newsletter Generator`
   - **User support email:** Your email
   - **Developer contact:** Your email
4. Click **Save and Continue** through the steps

#### 4.4 Create OAuth Credentials
1. Go to **APIs & Services** > **Credentials**
2. Click **+ Create Credentials** > **OAuth client ID**
3. Application type: **Web application**
4. Name: `AI Newsletter Generator Web`
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:5173`
6. Under **Authorized redirect URIs**, add:
   - `http://localhost:5173`
7. Click **Create**
8. Copy the **Client ID**

#### 4.5 Create `config.js`
In the project root, create `config.js`:
```javascript
const GOOGLE_CONFIG = {
  API_KEY: 'your-google-api-key-here',
  CLIENT_ID: 'your-oauth-client-id.apps.googleusercontent.com',
  SCOPES: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/gmail.send'
  ]
};

export default GOOGLE_CONFIG;
```

---

## Verification Checklist

After setup, verify everything works:

- [ ] **Claude**: Settings shows ✅ **Valid** for Claude API key
- [ ] **Stability AI**: Settings shows ✅ **Valid** for Stability AI key
- [ ] **Google Sign-in**: Can sign in with Google
- [ ] **Generate Newsletter**: Can create a newsletter without errors
- [ ] **Images Generate**: Newsletter sections show images
- [ ] **Send Email**: Can send via Gmail (if Google Workspace configured)

---

## Data Storage

All data is stored locally in SQLite at `./data/archives.db`:

| Table | Content |
|-------|---------|
| `newsletters` | Generated newsletter content |
| `newsletter_logs` | Action audit trail |
| `subscribers` | Email subscriber list |
| `subscriber_lists` | Mailing list groups |
| `api_keys` | API keys (stored locally) |
| `api_key_audit_log` | Key management audit |
| `archives` | Trending data cache |

---

## Troubleshooting

### "API key validation failed"
- Double-check you copied the full key (no extra spaces)
- Verify key belongs to correct service
- Check API key is active in service dashboard

### "Google authentication not working"
- Ensure `config.js` has correct `CLIENT_ID`
- Check OAuth consent screen is configured
- Verify JavaScript origins include `http://localhost:5173`

### "Can't send email"
- Verify Gmail API is enabled in Google Cloud Console
- Check subscriber list is configured

### "Images not generating"
- Verify Stability AI API key is valid
- Check Stability AI account has credits

---

## Security Notes

- **Never commit `.env.local`** - it's in `.gitignore`
- **Never share API keys** - treat them like passwords
- **config.js** is in `.gitignore` to protect Google credentials
- API keys in SQLite are stored locally only

---

## Additional Resources

- **ARCHITECTURE.md** - Comprehensive technical reference
- **docs/API_CONTRACTS.md** - Request/response schemas
- **docs/STATE_DEPENDENCIES.md** - State management documentation

---

## You're All Set!

Once verified, you're ready to:
- Generate newsletters with AI
- Customize topics and audiences
- Send to subscribers
- Track all activity locally

Happy newsletter generating!
