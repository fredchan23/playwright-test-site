# Playwright Test Site — Learning Management System

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-2.57-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Google Cloud](https://img.shields.io/badge/Cloud_Run-asia--southeast1-4285F4?style=flat&logo=googlecloud&logoColor=white)

A Learning Management System built as a **Playwright automation training target**. Every interactive element and major section exposes a `data-testid` attribute, making it purpose-built for practising end-to-end test automation.

---

## What It Does

- **Auth** — email/password sign-up and login via Supabase Auth
- **Library** — browse, search, and filter lessons by genre, tag, and file size
- **Lessons** — create, edit, and delete lessons with title, description, genre, and tags
- **File Uploads** — attach PDF and image files to lessons; stored in Supabase private storage
- **Sharing** — share lessons with other registered users; recipients get read-only access
- **Lesson Q&A** — conversational AI panel on each lesson; answers grounded in the lesson's uploaded files via RAG (Vertex AI + pgvector)
- **Admin Settings** — global toggle to enable/disable the Q&A feature; accessible only to admin users

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, React Router v7 |
| Styling | Tailwind CSS, Lucide React |
| Backend / Auth | Supabase (PostgreSQL + Auth + Storage) |
| AI / RAG | Vertex AI (Gemma 4 generation, text-embedding-004) |
| Build | Vite |
| Container | Docker (Node 20 build → Nginx Alpine serve) |
| Hosting | Google Cloud Run (`asia-southeast1`) |
| CI/CD | Google Cloud Build |

---

## Local Development

### Prerequisites

- Node.js 20+
- A Supabase project (URL and anon key)

### Setup

```bash
npm install

# Create local env file and fill in your Supabase credentials
cp .env.example .env.local

npm run dev        # http://localhost:5173
```

### Commands

```bash
npm run build       # Production build
npm run typecheck   # TypeScript check
npm run lint        # ESLint
npm run preview     # Preview production build locally
```

---

## Routes

| Path | Page | Auth Required |
|---|---|---|
| `/` | Redirect to `/library` | — |
| `/login` | Login | No |
| `/register` | Register | No |
| `/library` | Lesson library | Yes |
| `/lessons/create` | Create lesson | Yes |
| `/lessons/:id` | Lesson detail + Q&A panel | Yes |
| `/lessons/:id/edit` | Edit lesson | Yes |
| `/settings` | Admin settings (Q&A toggle) | Yes — admin only |

---

## data-testid Convention

Every interactive element follows the pattern `{page}-{element}`:

```
library-search-input
library-lesson-card-{id}
library-filter-genre-programming
library-settings-button
lesson-detail-title
lesson-detail-upload-button
lesson-qa-panel
lesson-qa-input
lesson-qa-submit-button
lesson-qa-message-{index}
lesson-qa-clear-button
settings-page-title
settings-qa-toggle
create-lesson-title-input
```

Preserve these attributes when modifying the UI — they are the Playwright test hooks.

---

## Deployment

Hosted on Google Cloud Run. Pushes to `main` trigger Cloud Build, which pulls secrets from Secret Manager, builds the Docker image, and deploys to Cloud Run.

Internal deployment runbook, spec, and architecture decisions are in `docs/` (gitignored, local only).

---

## Environment Variables

Required at build time (Vite inlines them into the JS bundle):

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key |
