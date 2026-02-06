# Backend (FastAPI)

This is initial backend scaffold. It was designed to run even before the team finalizes an AI provider.


## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env

docker compose up -d # optional mongodb

cd backend
uvicorn app.main:app --reload --port 8000
```

- Health: `GET http://localhost:8000/api/health`
- DB health (requires Mongo): `GET http://localhost:8000/api/health/db`

## AI Provider

Set `AI_PROVIDER` to one of:

- `mock` (default)
- `openai` (stub)
- `gemini` (stub)
- `deepseek` (stub)
