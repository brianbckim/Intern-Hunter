# Backend (FastAPI)

## Prereqs

- Python 3.10+
- MongoDB (required for auth). Easiest: Docker + `docker compose`.

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate

# Windows (PowerShell)
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\.venv\Scripts\Activate.ps1
# Windows (cmd.exe)
#   .\.venv\Scripts\activate.bat

pip install -r requirements.txt
cp .env.example .env
```

## Run MongoDB (Docker)

```bash
cd backend
docker compose up -d
```

Windows note: install Docker Desktop (WSL2 enabled). Then run the same `docker compose` command from PowerShell in the `backend/` folder.

If you use Colima, make sure Docker points to Colima’s socket (example):

```bash
export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock
```

## Run API

```bash
cd backend
# set JWT_SECRET_KEY in .env (recommended) or export it
uvicorn app.main:app --reload --port 8000
```

Windows note: if `uvicorn` isn’t found, run it via Python:

```bash
python -m uvicorn app.main:app --reload --port 8000
```

If you’re using PowerShell and you did NOT activate the venv, you can also run:

```bash
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

## AI provider (Ollama: `llama3:8b`)

By default the backend can run with a mock AI provider. To generate real resume feedback locally, use Ollama.

1) Install Ollama:

- macOS (Homebrew):

```bash
brew install ollama
```

- Linux:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

- Windows: use the installer from https://ollama.com/

2) Run Ollama and pull the model:

```bash
ollama serve
ollama pull llama3:8b
```

3) Set these in `backend/.env`:

```bash
cd backend 
code .env
```

```dotenv
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3:8b
```

4) Start the API as usual (`uvicorn ...`) and use the UI to generate feedback.

Note: there is no single Python file you run directly for this feature; the entrypoint is the FastAPI app via `uvicorn app.main:app`.

## Database schema

Mongo collections (high-level):

- `users`: auth users (unique `email`)
- `profiles`: user profile info (unique `user_email`)
- `resumes`: uploaded resume metadata + extracted text (indexed by `user_email`, `uploaded_at`)
- `resume_feedback`: AI feedback snapshots + saved notes (indexed by `user_email`, `created_at`, and `resume_id`)
- `jobs`: normalized job listings (unique `(source, external_id)`)
- `applications`: application tracking (unique `(user_email, job_source, job_external_id)`, indexed by `(user_email, status)`)

## Local fallback (no Mongo)

If MongoDB is not running, auth/profile endpoints now fall back to a local JSON store for development:

- File path: `backend/data/dev_store.json`
- Supported in fallback mode: register/login and profile read/update
- Not supported in fallback mode: resume upload/list and other DB-dependent features

## Endpoints

- `GET /api/health`
- `GET /api/health/db`
- `POST /api/auth/register` (email, password, optional full_name)
- `POST /api/auth/login` (email, password)

Quick test:

```bash
curl -s http://127.0.0.1:8000/api/health
curl -s http://127.0.0.1:8000/api/health/db

# Windows notes:
# - Use `curl.exe` (PowerShell may alias `curl` to `Invoke-WebRequest`).
# - Alternative: `Invoke-RestMethod http://127.0.0.1:8000/api/health`
```
