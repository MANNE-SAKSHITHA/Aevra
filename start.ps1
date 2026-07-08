# Aevra - one-command dev launcher (Windows / PowerShell)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File start.ps1
#
# First run does setup (venv, pip install, npm install, .env files) which can
# take a few minutes. After that it's fast. Opens two windows: backend (Uvicorn
# on :8000) and frontend (Next.js on :3000), and deletes any stale aevra.db so
# schema changes (like this name+password auth change) apply cleanly.

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# ---------- backend ----------
Push-Location "$root\backend"

if (-not (Test-Path ".venv")) {
    Write-Host "Creating backend virtualenv..."
    python -m venv .venv
}

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}

# Old databases created before this name+password change use an incompatible
# schema (unique email column). Wipe it so it's recreated fresh when possible.
if (Test-Path "aevra.db") {
    try {
        Write-Host "Removing stale aevra.db (schema changed to name+password auth)..."
        Remove-Item "aevra.db" -Force
    }
    catch {
        Write-Warning "Could not remove aevra.db because it is currently in use; continuing with the existing database."
    }
}

& ".venv\Scripts\pip.exe" install -r requirements.txt -q
Pop-Location

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; .venv\Scripts\Activate.ps1; python main.py"

# ---------- frontend ----------
Push-Location "$root\frontend"

if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.local.example" ".env.local"
}

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..."
    npm install
}
Pop-Location

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"

Write-Host ""
Write-Host "Backend  -> http://localhost:8000  (docs at /docs)"
Write-Host "Frontend -> http://localhost:3000"
Write-Host "(each is running in its own new window; close those windows to stop them)"
