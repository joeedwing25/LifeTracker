# lifetrQ

A local-first personal productivity PWA — tasks, calendar, roadmaps, and an AI assistant
that can create things for you from natural language.

## Features

- **Tasks & calendar** — recurring tasks, priorities, keyword/category tagging
- **Roadmaps** — multi-phase goal plans with sub-tasks, can be auto-generated from a course
  URL or a goal description via AI
- **AI assistant** — chat-based interface that can create tasks, reminders, and roadmaps
  directly from natural language (e.g. "remind me to call mom every Sunday at 6pm")
- **Local-first storage** — all data lives in IndexedDB (via Dexie) on-device; no backend
  required for normal use
- **PWA** — installable, works offline, service worker caches app shell assets
- **WebAuthn** support for biometric/passkey unlock

## Tech stack

- React (Create React App + CRACO)
- Dexie.js (IndexedDB wrapper)
- Gemini + Groq APIs (dual-provider, with automatic fallback if one is down)
- Tailwind CSS, shadcn/ui components
- Service worker for offline support

## Architecture notes

- `src/lib/db.js` — Dexie schema and queries, the actual data layer
- `src/lib/ai.js` — AI service layer. Tries the configured provider first (Gemini or Groq),
  falls back to the other on failure. The assistant is prompted to act as an "action
  execution agent" — it returns structured JSON describing what to create (task/reminder/
  roadmap), which the app then writes to IndexedDB
- `src/lib/crypto.js` / `webauthn.js` — local encryption + passkey support
- No backend service is required — this app is intentionally local-first

## Running locally

```bash
yarn install
yarn start
```

Create a `.env` file in `frontend/` with:

```
REACT_APP_GEMINI_API_KEY=your_key_here
REACT_APP_GROQ_API_KEY=your_key_here
```

## Future improvements

- Add an explicit sync/export option (currently fully local, no cross-device sync)
- TODO: surface AI provider errors in the UI instead of failing silently to the fallback
- TODO: add undo for AI-created actions (currently no way to undo a bad auto-created task)
- Could move the system prompt out of `ai.js` into a separate config file as it grows
