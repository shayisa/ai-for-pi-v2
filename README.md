# AI Newsletter Generator v3.1

> **Phase 8+ Complete** - Full-featured newsletter platform with personas, templates, scheduling, and multi-source import

A full-stack AI-powered newsletter generation platform that creates, formats, and distributes newsletters with AI-generated content, custom images, and comprehensive workflow automation.

## What's New in v3.1 (Phase 8+)

| Feature | Description |
|---------|-------------|
| **Writer Personas** | Custom AI writing personas with favorites and A/B preview |
| **Custom Audiences** | User-defined audience configurations |
| **Newsletter Templates** | Reusable newsletter structures |
| **Content Calendar** | Plan upcoming newsletter topics |
| **Scheduled Sending** | Auto-send newsletters on schedule |
| **Multi-Source Import** | Import prompts from URLs, DOCX, PDF, PPTX |
| **System Logs** | Unified activity logging with search/export |
| **Draft Auto-Save** | Automatic saving of in-progress work |
| **Email Analytics** | Track opens/clicks for sent newsletters |

### Architecture Improvements

| Metric | v2 | v3.1 |
|--------|-----|------|
| **Database Tables** | 7 | 22 |
| **Backend Services** | 12 | 28 |
| **Frontend Services** | 8 | 21 |
| **API Endpoints** | 98 | 120+ |
| **Components** | 25 | 37 |
| **Pages** | 7 | 11 |

## Quick Start

```bash
git clone https://github.com/shayisa/ai-for-pi-v2.git
cd ai-for-pi-v2
npm install
cp .env.local.example .env.local
# Optionally add your API keys to .env.local (or configure via Settings UI)
npm run dev:all
```

Then open `http://localhost:5173` in your browser.

## Core Features

- **AI Newsletter Generation** - Claude API generates newsletters with web search grounding
- **Writer Personas** - Customizable AI writing personalities with favorites
- **Custom Audiences** - Define your own target audience configurations
- **Multi-Source Prompt Import** - Import from URLs, Word docs, PDFs, PowerPoints
- **Content Calendar** - Plan and schedule newsletter topics
- **Scheduled Sending** - Automate newsletter distribution
- **Custom Image Generation** - Stability AI creates unique images for each section
- **Local SQLite Storage** - 22 tables for full offline capability
- **Google Workspace Integration** - Save HTML backups to Drive, send via Gmail
- **System Logs** - Complete activity tracking with search and CSV export

## Documentation

| Document | Purpose |
|----------|---------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | **Comprehensive technical reference** - 22 tables, 120+ endpoints, full data flows |
| [FEATURE_IDEAS.md](./FEATURE_IDEAS.md) | Completed features and potential enhancements |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Complete setup guide for new users |
| [docs/API_CONTRACTS.md](./docs/API_CONTRACTS.md) | Request/response schemas for all endpoints |
| [docs/STATE_DEPENDENCIES.md](./docs/STATE_DEPENDENCIES.md) | State management documentation |

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, TypeScript, Vite 7, TailwindCSS, Framer Motion |
| **State** | 6 React Contexts + 17 custom hooks |
| **Backend** | Node.js, Express 5, TypeScript, Control Plane Architecture |
| **Database** | SQLite with 22 tables (local, self-contained) |
| **AI Services** | Claude Sonnet 4, Stability AI |
| **Cloud** | Google Drive, Gmail APIs |

## Development

```bash
npm run dev:all    # Start frontend (5173) + backend (3001)
npm run dev        # Frontend only
npm run dev:server # Backend only
npm run build      # Production build
npm run test:unit  # Run unit tests (no API calls)
npm run test:e2e   # Run integration tests (uses mocks)
```

## Project Structure (v3.1)

```
/
├── contexts/                 # React Contexts (6 files)
├── hooks/                    # Custom React hooks (17 files)
├── services/                 # Frontend API clients (21 files)
├── components/               # UI components (37 files)
├── pages/                    # Route pages (11 files)
│
├── server/
│   ├── routes/               # API routes (18 files, 120+ endpoints)
│   ├── services/             # Database services (28 files)
│   ├── domains/generation/   # Newsletter generation domain
│   ├── external/             # External API clients (Claude, Stability, Brave)
│   └── control-plane/        # Request handling infrastructure
│
└── data/
    └── archives.db           # SQLite database (22 tables)
```

## Database Tables (22)

| Category | Tables |
|----------|--------|
| **Core** | newsletters, archives, newsletter_logs |
| **Subscribers** | subscribers, subscriber_lists |
| **Auth** | api_keys, api_key_audit_log, oauth_tokens |
| **Personas** | writer_personas, custom_audiences |
| **Templates** | newsletter_templates, newsletter_drafts |
| **Planning** | calendar_entries, scheduled_sends |
| **Analytics** | email_tracking, email_stats, system_logs |
| **Prompts** | saved_prompts, prompt_import_templates, prompt_import_logs |
| **Settings** | user_settings, image_style_thumbnails |

## Environment Variables

Optional in `.env.local` (or configure via Settings UI):
```env
ADMIN_EMAIL=your-email@example.com
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_STABILITY_API_KEY=sk-...
VITE_BRAVE_SEARCH_API_KEY=BSA...
```

API keys can be set via environment variables or managed through the app's Settings UI. Keys saved via the UI are stored in the local SQLite database.

---

**For architecture details, API reference, and data flows, see [ARCHITECTURE.md](./ARCHITECTURE.md)**
