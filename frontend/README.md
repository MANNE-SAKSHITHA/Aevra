# Aevra Frontend

Real, tested Next.js 15 / React 19 app.

- **Landing page** with a fully responsive intro video hero
- **Auth**: `/register`, `/login`, protected `/dashboard` with entry
  creation (text, voice recording, photo upload) and AI enrichment status
- **`/timeline`** — infinite-scrolling, month-grouped view of every entry,
  built on the paginated `GET /api/entries` from Phase 1 (no new backend
  work needed)
- **`/graph`** — interactive Memory Graph (via `@xyflow/react`) showing how
  entries connect through shared tags (people/places/topics), backed by the
  new `GET /api/graph` endpoint. Uses a lightweight radial layout (tags
  placed evenly around a circle, entries positioned at the centroid of
  their tags) rather than pulling in a full force-directed layout library
  for what's a small, mostly-static graph.
- **`/insights`** — mood-over-time and top-tags charts (via `recharts`),
  writing-streak stat cards, AI-generated reflections with a "Generate new"
  button, and lightweight recommendation cards — all backed by the new
  `/api/insights`, `/api/reflections`, and `/api/recommendations` endpoints.
- Shared `AppNav` component across all authenticated pages

## Requirements

- Node.js 18.18+

## Setup & run

```bash
cd frontend
npm install
cp .env.local.example .env.local   # point at your backend
npm run dev
```

Open **http://localhost:3000**. Make sure the backend (see `../backend`) is
running at the URL in `.env.local`.

For a production build (what was actually tested while building this):

```bash
npm run build
npm run start
```

## Verified

- `npm run build` completes with no errors across all 10 routes
  (`/`, `/login`, `/register`, `/dashboard`, `/timeline`, `/graph`,
  `/insights`, etc.)
- Full flow tested against a live backend seeded with a real 5-day
  consecutive streak: confirmed the streak stat cards, mood chart, and
  top-tags chart all match the underlying data
- No network calls required at build time (self-hosted system fonts)

## Project layout

```
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx           # landing page
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── dashboard/page.tsx
│   ├── timeline/page.tsx
│   ├── graph/page.tsx
│   └── insights/page.tsx
├── components/
│   ├── AppNav.tsx         # shared nav for authenticated pages
│   ├── AuthShell.tsx
│   ├── VideoHero.tsx
│   └── VoiceRecorder.tsx
├── lib/
│   ├── api.ts             # typed client for the FastAPI backend
│   └── auth-context.tsx
├── tailwind.config.js
└── package.json
```

## Security note

Pinned to `next@15.5.9` and `react@19.2.7`/`react-dom@19.2.7` — versions
patched against the December 2025 React Server Components vulnerabilities.
Don't downgrade without checking Next.js's security advisories.

## What's next

Beyond the 5 phases built so far: audiobook/podcast player UI, chapters,
time capsules, memory map, story generator, chat-with-memories, and
export/privacy settings.

Say the word and I'll keep going.

