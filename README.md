# AI Newsletter Generator

A full-stack AI-powered newsletter generation platform that creates, formats, and distributes newsletters with AI-generated content and custom images.

## Quick Start

```bash
git clone https://github.com/shayisa/ai-for-pi-newsletter-generator.git
cd ai-for-pi-newsletter-generator
npm install
cp .env.local.example .env.local
# Add your Supabase URL and Anon Key to .env.local
npm run dev:all
```

Then open `http://localhost:5173` in your browser.

## Features

- **AI Newsletter Generation** - Claude API generates newsletters with web search grounding
- **Custom Image Generation** - Stability AI creates unique images for each section
- **Google Workspace Integration** - Auto-save to Drive, send via Gmail, log to Sheets
- **Secure API Key Management** - All keys stored encrypted in Supabase
- **Load & Resend** - Retrieve and resend previous newsletters

## Documentation

| Document | Purpose |
|----------|---------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | **Comprehensive technical reference** - file dependencies, API endpoints, data flows, database schema |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Complete setup guide for new users |
| [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) | Supabase database configuration |

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, TypeScript, Vite, TailwindCSS |
| Backend | Node.js, Express, TypeScript |
| Database | Supabase (PostgreSQL + pgcrypto) |
| AI Services | Claude 3.5 Sonnet, Stability AI |
| Cloud | Google Drive, Sheets, Gmail APIs |

## Development

```bash
npm run dev:all    # Start frontend (5173) + backend (3001)
npm run dev        # Frontend only
npm run dev:server # Backend only
npm run build      # Production build
```

## Environment Variables

Required in `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

All other API keys (Claude, Stability AI, Google) are managed through the app's Settings UI.

---

**For architecture details, API reference, and data flows, see [ARCHITECTURE.md](./ARCHITECTURE.md)**
