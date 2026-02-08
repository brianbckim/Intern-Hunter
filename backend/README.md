# Backend (FastAPI)

## Prereqs

- Python 3.10+
- MongoDB (required for auth). Easiest: Docker + `docker compose`.

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate # alternatively, .\.venv\Scripts\Activate.bat
pip install -r requirements.txt
cp .env.example .env
```

## Run MongoDB (Docker)

```bash
cd backend
docker compose up -d
```

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

## Endpoints

- `GET /api/health`
- `GET /api/health/db`
- `POST /api/auth/register` (email, password, optional full_name)
- `POST /api/auth/login` (email, password)

Quick test:

```bash
curl -s http://127.0.0.1:8000/api/health # alternatively, curl.exe https://127.0.0.1:8000/api/health
curl -s http://127.0.0.1:8000/api/health/db # alternatively, curl.exe https://127.0.0.1:8000/api/health/db
```
