# Intern-Hunter
An AI-powered career coaching platform that generates personalized internship, career recommendation, resume feedback, and smart resume building alongside integrated live job listings. 

## Backend (initial scaffold)

The backend lives in `backend/` and is a minimal FastAPI scaffold (AI provider is intentionally pluggable and defaults to a mock provider until the team picks DeepSeek/OpenAI/Gemini).

- Quick start (local): see `backend/README.md`

## AI Resume Feedback (Ollama)

This repo supports running resume feedback locally via Ollama (default model: `llama3:8b`).

- Install + run Ollama, then pull the model:
  - `ollama serve`
  - `ollama pull llama3:8b`
- In `backend/.env`, set `AI_PROVIDER=ollama` (see `backend/.env.example` for the full set of variables).

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