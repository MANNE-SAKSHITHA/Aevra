powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\MANNE SAKSHITHA\Downloads\111111111\aevra\start.ps1"# Aevra

A calm, private journal app with auth, entries, media, graph views, and insights. The backend is a FastAPI app that runs locally and the frontend is a Next.js app.

## Run everything

From the project root in PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start.ps1
```

- Backend: http://localhost:8000
- Frontend: http://localhost:3000
 

## API overview

The backend exposes these main API areas:

- Auth: /api/auth/register, /login, /refresh, /me
- Entries: /api/entries
- Media: /api/media
- Search and graph: /api/graph, /api/search/semantic, /api/ai/status
- Insights: /api/insights, /api/reflections, /api/recommendations

## Requirements

- Python 3.11+
- Node.js 18+
- Optional: Ollama for reflection generation


