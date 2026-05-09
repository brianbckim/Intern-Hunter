# Backend

The backend is a FastAPI application that handles authentication, profile data, resume processing, AI-backed features, job recommendation snapshots, application tracking, and recruiter search.

## What the backend provides

- JWT-based authentication and user account management
- Profile storage for interests, skills, major, and graduation year
- Resume upload, text extraction, file download, and metadata storage
- AI-generated resume feedback and saved notes
- AI-assisted recommendation generation and resume tailoring
- Application tracking with per-job status updates
- Read-only job listings loaded from the internship listings JSON file
- Recruiter search over a large CSV dataset

## Requirements

- Python 3.10+
- MongoDB
- Optional: Ollama for local AI-backed features

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Start MongoDB

```bash
cd backend
docker compose up -d
```

## Run the API

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

The API will be available at http://127.0.0.1:8000.

## Core environment variables

These values are defined in [backend/.env.example](.env.example).

```dotenv
APP_NAME=InternHunter
API_PREFIX=/api
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=internhunter
JWT_SECRET_KEY=dev-secret-change-later
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:3b
OLLAMA_REQUEST_TIMEOUT_SECONDS=300
```

## AI provider behavior

- `AI_PROVIDER=ollama`: use a local Ollama server for resume feedback, recommendations, and resume tailoring
- `AI_PROVIDER=mock`: return deterministic mock responses without live AI calls

### Run Ollama locally

```bash
ollama serve
ollama pull llama3.2:3b
```

## Main API groups

- `/api/health`: app and DB health checks
- `/api/auth`: register, login, password change, account deletion
- `/api/profile`: read and update the current user profile
- `/api/resumes`: upload, list, fetch, delete, and download resumes
- `/api/resume-feedback`: generate and review feedback, save notes
- `/api/recommendations`: generate recommendation snapshots and tailored resumes
- `/api/applications`: create, update, list, and delete application records
- `/api/jobs`: read internship listings from the internship listings JSON file
- `/api/recruiters`: search staffing and recruiter records from the CSV dataset

## Data sources used by the backend

- Internship listings data: [backend/app/jobs/Intern-Hunter-Listing.json](app/jobs/Intern-Hunter-Listing.json)
- Recruiter dataset: [list_of_staffing_and_recruiter_businesses.csv](../list_of_staffing_and_recruiter_businesses.csv)
- Uploaded files: [backend/uploads](uploads)

## High-level storage model

MongoDB collections used by the application include:

- `users`
- `profiles`
- `resumes`
- `resume_feedback`
- `applications`
- `recommendations_snapshots`
- `tailored_resume_snapshots`

## Useful local checks

```bash
curl -s http://127.0.0.1:8000/api/health
curl -s http://127.0.0.1:8000/api/health/db
```

## Related docs

- Project overview: [README.md](../README.md)
- Frontend setup: [Frontend/README.md](../Frontend/README.md)
