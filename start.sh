#!/usr/bin/env bash
# Aevra - one-command dev launcher (macOS / Linux)
#
# Usage:
#   ./start.sh
#
# First run does setup (venv, pip install, npm install, .env files) which can
# take a few minutes. After that it's fast. Runs backend (Uvicorn on :8000)
# and frontend (Next.js on :3000) together; Ctrl+C stops both. Deletes any
# stale aevra.db so schema changes (like this name+password auth change)
# apply cleanly.

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------- backend ----------
cd "$ROOT/backend"

if [ ! -d "venv" ]; then
    echo "Creating backend virtualenv..."
    python3 -m venv venv
fi

if [ ! -f ".env" ]; then
    cp .env.example .env
fi

# Old databases created before this name+password change use an incompatible
# schema (unique email column). Wipe it so it's recreated fresh.
if [ -f "aevra.db" ]; then
    echo "Removing stale aevra.db (schema changed to name+password auth)..."
    rm aevra.db
fi

source venv/bin/activate
pip install -r requirements.txt -q
python main.py &
BACKEND_PID=$!
deactivate
cd "$ROOT"

# ---------- frontend ----------
cd "$ROOT/frontend"

if [ ! -f ".env.local" ]; then
    cp .env.local.example .env.local
fi

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

npm run dev &
FRONTEND_PID=$!
cd "$ROOT"

echo ""
echo "Backend  -> http://localhost:8000  (docs at /docs)"
echo "Frontend -> http://localhost:3000"
echo "Press Ctrl+C to stop both."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
