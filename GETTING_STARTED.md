# Getting Started: AI Newsletter Generator

Complete setup guide for cloning and running this project from scratch.

---

## 📋 Project Overview

The **AI Newsletter Generator** is a full-stack application that:
- Generates AI-powered newsletters using Claude API with web search grounding
- Creates custom images for each section using Stability AI
- Saves newsletters to Google Drive as self-contained HTML files
- Sends newsletters via Gmail to subscriber lists
- Tracks all activity in Google Sheets with unique ID logging
- Manages all API keys securely in Supabase

**Tech Stack:**
- Backend: Node.js + Express + TypeScript
- Frontend: React 18 + Vite + TypeScript
- Database: Supabase (PostgreSQL with encryption)
- External APIs: Claude, Stability AI, Google Workspace, Supabase

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- Node.js 16+ (check with `node --version`)
- Git
- A GitHub account (to clone the repo)

### Step 1: Clone the Repository
```bash
git clone https://github.com/shayisa/ai-for-pi-newsletter-generator.git
cd ai-for-pi-newsletter-generator
npm install
```

### Step 2: Set Up Environment File
```bash
cp .env.local.example .env.local
```

### Step 3: Configure Supabase (see full setup below)
Edit `.env.local` and add your Supabase credentials:
```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Step 4: Run the Application
```bash
npm run dev:all
```

This starts:
- Backend on `http://localhost:3001`
- Frontend on `http://localhost:5173`

---

## 🔑 Complete API Keys Setup

### API Key Overview

| Service | Purpose | Where to Store | Why Needed |
|---------|---------|---|----------|
| **Supabase** | Database & API key vault | `.env.local` | Manages all other API keys securely |
| **Claude (Anthropic)** | Newsletter content generation | Supabase UI | Generates AI-written newsletters with web search |
| **Stability AI** | Image generation | Supabase UI | Creates custom images for newsletter sections |
| **Google OAuth** | Google Workspace access | OAuth consent screen | Authenticate with Google |
| **Google API Key** | Google Sheets/Drive/Gmail | Supabase UI | Save, log, and email newsletters |

---

## 📚 Step-by-Step Setup Guide

### Phase 1: Supabase (Database & Key Vault)

#### 1.1 Create Supabase Project
1. Go to https://supabase.com
2. Sign up or log in
3. Click **New Project**
4. Fill in:
   - **Project name:** `ai-newsletter` (or your choice)
   - **Database password:** Create a strong password
   - **Region:** Choose closest to you
5. Click **Create new project** (takes ~5-10 minutes)
6. Once ready, go to **Project Settings** > **API**
7. Copy and save these:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Anon Key (public)** → `VITE_SUPABASE_ANON_KEY`

#### 1.2 Set Up Database Schema
1. In Supabase dashboard, go to **SQL Editor** > **New Query**
2. Copy the entire SQL script from `SUPABASE_SETUP.md` (lines 25-104)
3. Paste it into the editor
4. Click **Run**
5. You should see ✅ success messages

#### 1.3 Update Your `.env.local`
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc... (your key here)
```

#### 1.4 Enable Google OAuth (Optional but Recommended)
1. Go to **Settings** > **Authentication** > **Providers**
2. Find **Google** and click **Enable**
3. You'll need Google OAuth credentials (see Phase 3 below)

---

### Phase 2: Anthropic (Claude API)

#### 2.1 Get Claude API Key
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Go to **API Keys** (left sidebar)
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-`)
6. **Save it somewhere safe** - you'll add it through the app UI

#### 2.2 Add to App
1. Start the app: `npm run dev:all`
2. Go to `http://localhost:5173`
3. Click **Settings** (gear icon)
4. Go to **API Key Management**
5. Select **Claude** from dropdown
6. Paste your API key
7. Click **Save**
8. You should see ✅ **Valid**

---

### Phase 3: Google Workspace Setup

#### 3.1 Create Google Cloud Project
1. Go to https://console.cloud.google.com/
2. Sign in with your Google account
3. At the top, click the **project selector** (dropdown)
4. Click **NEW PROJECT**
5. Name it: `AI Newsletter Generator`
6. Click **Create**
7. Wait for it to initialize

#### 3.2 Enable Required APIs
In the Google Cloud Console:
1. Go to **APIs & Services** > **Library**
2. Search for and enable each:
   - **Google Drive API** → Click → **Enable**
   - **Google Sheets API** → Click → **Enable**
   - **Gmail API** → Click → **Enable**

#### 3.3 Create OAuth Consent Screen
1. Go to **APIs & Services** > **OAuth consent screen**
2. Select **External** user type
3. Click **Create**
4. Fill in:
   - **App name:** `AI Newsletter Generator`
   - **User support email:** Your email
   - **Developer contact:** Your email
5. Click **Save and Continue**
6. Skip scopes (click **Save and Continue**)
7. Skip test users (click **Save and Continue**)
8. Review and **Back to Dashboard**

#### 3.4 Create OAuth Credentials
1. Go to **APIs & Services** > **Credentials**
2. Click **+ Create Credentials** > **OAuth client ID**
3. Application type: **Web application**
4. Name: `AI Newsletter Generator Web`
5. Under **Authorized redirect URIs**, add:
   - `http://localhost:5173`
   - `http://localhost:3001`
   - Your deployed domain (when you deploy)
6. Click **Create**
7. Copy the **Client ID** (you'll need this in config.js)

#### 3.5 Create Service Account (for backend)
1. Go to **APIs & Services** > **Credentials**
2. Click **+ Create Credentials** > **Service Account**
3. Fill in:
   - **Service account name:** `ai-newsletter-service`
4. Click **Create and Continue**
5. Skip optional steps, click **Done**
6. Click the service account you just created
7. Go to **Keys** tab > **Add Key** > **Create new key**
8. Choose **JSON** format
9. Click **Create**
10. A JSON file downloads - **save this file safely**
11. Rename it to `config.json` and place in project root
12. Add to `.gitignore` if not already there

#### 3.6 Add Google API Key to App
1. Go to **APIs & Services** > **Credentials**
2. Click **+ Create Credentials** > **API Key**
3. Copy the API key
4. In app Settings > **API Key Management** > Select **Google APIs**
5. Paste the key and click **Save**

---

### Phase 4: Stability AI (Image Generation)

#### 4.1 Get Stability AI API Key
1. Go to https://platform.stability.ai/
2. Sign up or log in
3. Go to your **Account** > **API Keys**
4. Copy your API key
5. Save it safely

#### 4.2 Add to App
1. In app Settings > **API Key Management**
2. Select **Stability AI**
3. Paste your API key
4. Click **Save**
5. You should see ✅ **Valid**

---

### Phase 5: Configure Google OAuth in App

#### 5.1 Create `config.js`
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

Get these values from Phase 3 above.

#### 5.2 Add to `.gitignore`
Make sure `config.js` is in your `.gitignore` (it should be already).

---

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] **Supabase**: Can log in with Google in the app
- [ ] **Claude**: Settings shows ✅ **Valid** for Claude API key
- [ ] **Stability AI**: Settings shows ✅ **Valid** for Stability AI key
- [ ] **Google Drive**: Can see drive icon in Settings
- [ ] **Generate Newsletter**: Can create a newsletter without errors
- [ ] **Images Generate**: Newsletter sections show images
- [ ] **Send Email**: Can send via Gmail to test email

---

## 🧪 Test Workflow

1. **Generate a Newsletter**
   - Go to "Discover Topics" page
   - Select a topic (e.g., "AI")
   - Define tone and audience
   - Choose image style
   - Click "Generate Newsletter"

2. **Verify Images Generated**
   - Check preview - should show images in each section

3. **Save to Google Drive**
   - Should auto-save after images generate
   - Check your Google Drive for "AI for PI Newsletters" folder

4. **Send Email**
   - Set up a test email in Google Sheets subscriber list
   - Click "Send Email"
   - Check your inbox

5. **Check Google Sheets Log**
   - Open "AI for PI Newsletter Log" sheet
   - Should see entry with today's date and "Sent Email: Yes"

---

## 🔒 Security Notes

- **Never commit `.env.local`** - it's in `.gitignore` for a reason
- **Never share API keys** - treat them like passwords
- **Store service account JSON** securely - consider using a secrets manager
- **Use strong Supabase password** - this protects all your API keys
- **Rotate API keys** periodically for security

---

## 🆘 Troubleshooting

### "Supabase is not configured"
- Check `.env.local` has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart dev server: `npm run dev:all`

### "API key validation failed"
- Double-check you copied the full key (no extra spaces)
- Verify key belongs to correct service
- Check API key is active in service dashboard

### "Google authentication not working"
- Ensure `config.js` has correct `CLIENT_ID`
- Check OAuth consent screen is configured
- Verify redirect URIs include `http://localhost:5173`

### "Can't send email"
- Verify Gmail API is enabled in Google Cloud Console
- Check subscriber email list in Google Sheets
- Ensure authenticated user's email is correct

### "Images not generating"
- Verify Stability AI API key is valid
- Check Stability AI account has credits
- Look at browser console for error messages

### "Newsletter not saving to Drive"
- Verify Google Drive API is enabled
- Check authenticated user has access to Drive
- Look at server logs for error messages

---

## 📖 Additional Resources

- **CHECKPOINT.md** - Current project status and features
- **SUPABASE_SETUP.md** - Detailed Supabase database setup
- **CLAUDE.md** - Original migration guide from Gemini to Claude
- **server.ts** - Backend API endpoints
- **App.tsx** - Main frontend component and workflow

---

## 🤝 Need Help?

If you encounter issues:
1. Check the Troubleshooting section above
2. Review the relevant documentation file
3. Check backend logs: `npm run dev:server` terminal
4. Check frontend console: Browser DevTools (F12)

---

## ✨ You're All Set!

Once verified, you're ready to:
- Generate newsletters with AI
- Customize topics and audiences
- Send to subscribers
- Track all activity in Google Sheets

Happy newsletter generating! 🎉
