# AI Newsletter Generator v2

> **Refactored version** - See [original repository](https://github.com/shayisa/ai-for-pi-newsletter-generator) for v1

A full-stack AI-powered newsletter generation platform that creates, formats, and distributes newsletters with AI-generated content and custom images.

## What's New in v2

| Improvement | Before | After |
|-------------|--------|-------|
| **Token Cost** | ~12,000 tokens/newsletter | <5,000 tokens (65% reduction) |
| **Architecture** | 872-line App.tsx, 1,762-line server.ts | Modular hooks, services, routes |
| **Newsletter Quality** | Generic content, some mock data | Actionable content with verified sources |
| **External API Calls** | 67+ calls per page load | 1 call (cached) |
| **Generation Time** | 20-30 seconds | 8-12 seconds |

## Key v2 Features

- **Optimized Token Usage** - Capped agentic loops, compressed prompts, smart caching
- **Real Data Only** - Removed all mock/fake trending data sources
- **Actionable Content** - Implementation time, skill level, steps, and cost for every recommendation
- **Source Verification** - All links verified before newsletter generation
- **Modular Architecture** - Custom hooks, separated services, error boundaries
- **Comprehensive Tests** - Unit and integration tests without burning API tokens

## Quick Start

```bash
git clone https://github.com/shayisa/ai-for-pi-v2.git
cd ai-for-pi-v2
npm install
cp .env.local.example .env.local
# Add your Supabase URL and Anon Key to .env.local
npm run dev:all
```

Then open `http://localhost:5173` in your browser.

## Core Features

- **AI Newsletter Generation** - Claude API generates newsletters with web search grounding
- **Custom Image Generation** - Stability AI creates unique images for each section
- **Google Workspace Integration** - Auto-save to Drive, send via Gmail, log to Sheets
- **Secure API Key Management** - All keys stored encrypted in Supabase
- **Load & Resend** - Retrieve and resend previous newsletters

## Documentation

| Document | Purpose |
|----------|---------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | **Comprehensive technical reference** - file dependencies, API endpoints, data flows |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Complete setup guide for new users |
| [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) | Supabase database configuration |
| [docs/API_CONTRACTS.md](./docs/API_CONTRACTS.md) | Request/response schemas for all endpoints |
| [docs/STATE_DEPENDENCIES.md](./docs/STATE_DEPENDENCIES.md) | State management documentation |

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, TypeScript, Vite, TailwindCSS, React Router |
| Backend | Node.js, Express, TypeScript, Zod validation |
| Database | Supabase (PostgreSQL + pgcrypto) |
| AI Services | Claude 3.5 Sonnet, Claude Haiku, Stability AI |
| Cloud | Google Drive, Sheets, Gmail APIs |

## Development

```bash
npm run dev:all    # Start frontend (5173) + backend (3001)
npm run dev        # Frontend only
npm run dev:server # Backend only
npm run build      # Production build
npm run test:unit  # Run unit tests (no API calls)
npm run test:e2e   # Run integration tests (uses mocks)
```

## Project Structure (v2)

```
src/
├── hooks/              # Custom React hooks (state management)
├── services/
│   └── google/         # Drive, Sheets, Gmail (split from monolith)
├── components/         # UI components with error boundaries
├── pages/              # Route pages
├── cache/              # Trending data and search caching
├── types/              # TypeScript interfaces and Zod schemas
└── __mocks__/          # Test mocks for API services

server/
├── routes/             # Express route handlers
├── services/           # Claude, Stability, Brave Search
├── middleware/         # Validation, rate limiting, error handling
└── cache/              # Server-side caching
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
