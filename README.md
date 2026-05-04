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
- **Lesson Q&A** — conversational AI panel per lesson; questions answered by Gemini 2.5 Flash grounded in the lesson's uploaded PDF files (Long-Context RAG via Vertex AI); conversation history persisted per user; export chat as Markdown
- **AI Metadata Autofill** — dropping the first file on lesson create triggers Gemini to suggest title, description, tags, and genre; fields remain fully editable
- **PDF Thumbnails** — first page of each PDF rendered client-side as a tile preview (pdfjs-dist)
- **Mobile Layout** — fully responsive at 375px; sidebar drawer, tab-based lesson detail, icon-only action buttons
- **Admin Settings** — global toggle to enable/disable the Q&A feature; accessible only to admin users

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, React Router v7 |
| Styling | Tailwind CSS, Lucide React |
| Backend / Auth | Supabase (PostgreSQL + Auth + Storage) |
| AI | Vertex AI — Gemini 2.5 Flash (Long-Context RAG, context caching) |
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
library-view-card-button
library-view-list-button
lesson-detail-title
lesson-detail-upload-button
lesson-detail-tab-bar
lesson-detail-tab-lesson
lesson-detail-tab-qa
lesson-qa-panel
lesson-qa-input
lesson-qa-submit-button
lesson-qa-message-{index}
lesson-qa-clear-button
lesson-qa-save-md-button
lesson-file-pdf-thumbnail-{id}
settings-page-title
settings-qa-toggle
create-lesson-title-input
create-lesson-autofill-loading
mobile-top-bar
mobile-menu-button
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

---

## Development Methodology

This project was developed using the [Agent Skills](https://github.com/addyosmani/agent-skills) framework by Addy Osmani — an open-source collection of engineering workflow skills covering ideation, spec-driven development, planning, implementation, testing, code review, security hardening, documentation, and launch. Every feature was spec'd before it was built; every architectural decision has a written ADR.
