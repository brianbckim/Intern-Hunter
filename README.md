# Intern-Hunter

Intern-Hunter is a full-stack internship search and career support application. It combines account management, resume upload and extraction, AI-assisted resume feedback, AI-assisted job recommendations, recruiter search, and application tracking in a single web app.

> Note: This repository was developed as a team-based senior project. Brian Kim's primary technical contributions are documented in [BRIAN_KIM_CONTRIBUTIONS.md](BRIAN_KIM_CONTRIBUTIONS.md).

## What is implemented

- Email/password authentication with JWT-based sessions
- User profile management for major, interests, skills, and graduation year
- Resume upload, storage, extraction, download, and preview flow
- AI-generated resume feedback with notes history
- AI-assisted internship recommendations from the project job listings dataset
- Resume tailoring for a selected job recommendation
- Application tracking for saved, applied, interview, rejected, and offer states
- Recruiter search backed by a large staffing/recruiting CSV dataset
- Settings for language selection, theme toggle, password change, and account deletion

## Stack

- Frontend: React 19, TypeScript, React Router, Zustand, Vite, Tailwind CSS
- Backend: FastAPI, Motor, Pydantic Settings, Passlib, python-jose
- AI: Ollama or mock provider through a pluggable provider layer
- Data assets: internship listings JSON and recruiter CSV
- Local infrastructure: MongoDB via Docker Compose

## Repository layout

```text
.
├── Frontend/               # React app
├── backend/                # FastAPI app
├── .github/workflows/      # GitHub workflow definitions
├── list_of_staffing_and_recruiter_businesses.csv
└── README.md
```

## Local quick start

1. Start MongoDB.

```bash
cd backend
docker compose up -d
```

2. Set up and run the backend.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

3. Optionally start Ollama for AI-backed feedback and recommendations.

```bash
ollama serve
ollama pull llama3.2:3b
```

4. Start the frontend.

```bash
cd Frontend
npm install
npm run dev -- --port 5173
```

Open http://localhost:5173.

## Main app areas

- `/login` and `/register`: authentication
- `/`: dashboard summary for resume status, feedback, recommendations, and application activity
- `/profile`: editable user profile
- `/resume`: upload, preview, and manage resumes
- `/resume-feedback`: generate and review AI feedback
- `/jobs`: browse listings, view recommendations, and tailor resumes
- `/applications`: track application status
- `/recruiters`: search recruiter and staffing firm records
- `/settings`: account, theme, and language settings

## Team

- Brian Kim — Core AI Systems & Full-Stack Developer
- Chenfeng Su — Scrum Master & Backend Developer
- Tarik Farhoud — Frontend & Backend Developer
- Triet Nguyen — Frontend Developer & Team Lead
- Cotten Lumb — Frontend Developer & Tester

## Project context

- Course: CIS4914
- Project type: Team-based senior project
- Timeline: Spring 2026
- School: University of Florida

## Additional docs

- Backend setup and API notes: [backend/README.md](backend/README.md)
- Frontend setup and UI notes: [Frontend/README.md](Frontend/README.md)