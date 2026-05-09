# Frontend

The frontend is a React + TypeScript application that provides the user-facing experience for authentication, profile editing, resume workflows, AI-assisted job exploration, recruiter search, and account settings.

## What the frontend includes

- Login and registration flows
- Protected app shell with sidebar navigation
- Dashboard summary for resume status, feedback, recommendations, and application activity
- Profile editor with skills and career-interest fields
- Resume upload, preview, download, and management UI
- Resume feedback review and notes UI
- Jobs page for listings, recommendations, application marking, and resume tailoring
- Applications page for status tracking and filtering
- Recruiters search page
- Settings page for language, theme, password, and account controls

## Requirements

- Node.js 18+
- Backend API running locally or remotely

## Setup

```bash
cd Frontend
npm install
```

## Run the development server

```bash
cd Frontend
npm run dev -- --port 5173
```

Open http://localhost:5173.

## Environment variable

The frontend uses a single environment variable defined in [Frontend/.env.example](.env.example):

```dotenv
VITE_API_BASE_URL=
```

- Leave it empty for local development and use the Vite proxy
- Set it to your deployed backend base URL for hosted environments

## Main routes

- `/home`: simple landing/health-check page
- `/login`: login form
- `/register`: registration form
- `/`: authenticated dashboard
- `/profile`: user profile editor
- `/resume`: resume upload, preview, and file management
- `/resume-feedback`: feedback generation and review
- `/jobs`: listing browser, recommendation view, and tailoring flow
- `/applications`: application status tracking
- `/recruiters`: recruiter and staffing firm search
- `/settings`: theme, language, password, and account settings

## Frontend structure

```text
Frontend/src/
├── components/   # layout, modal, route guard, error boundary
├── lib/          # API client, auth helpers, language helpers
├── pages/        # route-level UI
├── stores/       # Zustand stores
└── router.tsx    # route definitions
```

## Build

```bash
cd Frontend
npm run build
```

## Related docs

- Project overview: [README.md](../README.md)
- Backend setup: [backend/README.md](../backend/README.md)
