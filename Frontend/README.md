## Frontend (Vite + React)

## Prereqs

- Backend API running (default: `http://127.0.0.1:8000`)
- MongoDB running (auth/profile/resume features)
- Optional (for AI features): Ollama running (default: `http://127.0.0.1:11434`)

## Setup

```bash
cd Frontend
npm install
```

## Run

```bash
cd Frontend
npm run dev -- --port 5173
```

App:

- `http://localhost:5173`

Notes:

- Jobs → AI Recommendations uses `POST /api/recommendations/generate` and will show heuristic ordering if AI is disabled/unavailable.
- To enable local AI, run `ollama serve` and set `AI_PROVIDER=ollama` in `backend/.env`.
