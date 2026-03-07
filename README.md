# Intern-Hunter
An AI-powered career coaching platform that generates personalized internship, career recommendation, resume feedback, and smart resume building alongside integrated live job listings. 

## Backend (initial scaffold)

The backend lives in `backend/` and is a FastAPI app.

The AI layer is intentionally pluggable (set `AI_PROVIDER=mock` to disable AI calls, or `AI_PROVIDER=ollama` to use a local Ollama server).

- Quick start (local): see `backend/README.md`

## Local development (4 terminals)

This is the typical workflow to run the full stack locally.

### Terminal 0 — Docker (MongoDB)

```bash
colima start
cd backend
docker compose up -d
```

### Terminal 1 — Ollama

```bash
export OLLAMA_KEEP_ALIVE=-1
ollama serve
```

### Terminal 2 — Backend (FastAPI)

```bash
cd backend
source ../.venv/bin/activate

# optional warm-up (keeps the model loaded)
curl --silent http://localhost:11434/api/generate -d '{
  "model": "llama3.2:3b",
  "keep_alive": -1
}' > /dev/null

uvicorn app.main:app --reload --port 8000
```

### Terminal 3 — Frontend (Vite)

```bash
cd Frontend
npm run dev -- --port 5173
```

Open the app at http://localhost:5173

## AI Resume Feedback (Ollama)

This repo supports running resume feedback locally via Ollama (default model: `llama3.2:3b`).

- Install Ollama:
  - macOS (Homebrew): `brew install ollama`
  - Linux: `curl -fsSL https://ollama.com/install.sh | sh`
  - Windows: use the installer from https://ollama.com/
- Install + run Ollama, then pull the model:
  - `ollama serve`
  - `ollama pull llama3.2:3b`
- In `backend/.env`, set `AI_PROVIDER=ollama` (see `backend/.env.example` for the full set of variables).

There is no standalone Python script you run for AI feedback — start the backend API with `uvicorn` (see `backend/README.md`).

## AI Internship Recommendations (Jobs)

This repo also supports generating AI-assisted internship recommendations from the live listings JSON.

- Backend API: `POST /api/recommendations/generate` (requires auth)
- Listings source (auto-updated): `backend/app/jobs/Intern-Hunter-Listing.json`
- If AI is disabled/unavailable, the API falls back to heuristic ordering and returns `ai_used=false`.

## Resume upload + parsing (WIP)

This branch adds a basic end-to-end resume flow so we can actually exercise the UI against real APIs.

**Backend**

- Authenticated resume endpoints (upload, list, detail, download)
- On upload, we extract and store plain text for quick inspection
  - PDF: `pdfminer.six`
  - DOCX: `python-docx`
  - DOC: `antiword`
- Notes:
  - Some clients upload as `application/octet-stream` (we handle that as long as the extension is valid)

**Frontend**

- Login / Register page that stores an access token locally
- Dashboard “Resume Status” card wired to the backend (real status + upload)
- Dedicated Resume page for upload + downloading the latest resume
- A small `/parse-test` page for sanity-checking what the backend extracted (kept separate from the main UI)

**Local testing notes**

- This repo is still in a “dev-first” stage: right now we mostly use a single example account to test the resume flow.
  - Email: `example@example.com`
  - Password: `12345678`
  - Name: `John Smith`
  - (If your local DB is fresh, you may need to register this user once via the UI.)
- You’ll need MongoDB running for the backend (there’s a Docker Compose setup under `backend/`).
- Handy routes while testing:
  - `/` (Dashboard)
  - `/resume` (upload/download)
  - `/parse-test` (view extracted text)
- Resume parsing test page: go to `/parse-test`
  - It always loads your latest uploaded resume and shows `extracted_text` in a textarea
  - Useful when you’re iterating on extraction/parsing and want a quick “does this look sane?” check
- If uploads work but parsing looks empty, double-check backend dependencies (`pdfminer.six`, `python-docx`) are installed in your backend environment.