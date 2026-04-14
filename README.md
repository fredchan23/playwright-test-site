# Playwright Test Site — Learning Management System

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-2.57-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Google Cloud](https://img.shields.io/badge/Cloud_Run-asia--southeast1-4285F4?style=flat&logo=googlecloud&logoColor=white)

A Learning Management System built as a **Playwright automation training target**. Designed to be automation-tested — every interactive element and major section exposes a `data-testid` attribute.

---

## What It Does

- **Auth** — email/password sign-up and login via Supabase Auth
- **Library** — browse, search, and filter lessons by genre or tag
- **Lessons** — create, edit, and delete lessons with title, description, genre, and tags
- **File Uploads** — attach files to lessons; stored in Supabase private storage
- **Sharing** — share lessons with other registered users by username

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, React Router v7 |
| Styling | Tailwind CSS, Lucide React |
| Backend / Auth | Supabase (PostgreSQL + Auth + Storage) |
| Build | Vite |
| Container | Docker (Node 20 build → Nginx Alpine serve) |
| Hosting | Google Cloud Run (`asia-southeast1`) |
| CI/CD | Google Cloud Build (triggered on push to `main`) |
| Secrets | Google Cloud Secret Manager |

---

## Local Development

### Prerequisites

- Node.js 20+
- A Supabase project (URL and anon key)

### Setup

```bash
# Install dependencies
npm install

# Create local env file
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Start dev server (http://localhost:5173)
npm run dev
```

### Other Commands

```bash
npm run build       # Production build
npm run typecheck   # TypeScript check
npm run lint        # ESLint
npm run preview     # Preview production build locally
```

---

## Project Structure

```
src/
  components/       # Reusable UI components
  contexts/         # AuthContext (Supabase session management)
  lib/              # Supabase client, helpers
  pages/            # Route-level page components
    LibraryPage.tsx
    LessonDetailPage.tsx
    CreateLessonPage.tsx
    EditLessonPage.tsx
    LoginPage.tsx
    RegisterPage.tsx
supabase/
  migrations/       # SQL schema migrations
Dockerfile          # Multi-stage build (Node → Nginx)
nginx.conf          # SPA routing + caching + security headers
cloudbuild.yaml     # GCP Cloud Build pipeline
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
| `/lessons/:id` | Lesson detail | Yes |
| `/lessons/:id/edit` | Edit lesson | Yes |

---

## Database Schema

Five tables, all with Row Level Security enforced:

- **`profiles`** — extends `auth.users`; auto-created on signup
- **`genres`** — predefined: Programming, Design, Business, Language, Science, Mathematics, Arts
- **`lessons`** — title, description, genre, tags (text[]), owned by a profile
- **`lesson_files`** — file metadata; actual files in Supabase Storage (`lesson-files` bucket)
- **`lesson_shares`** — share a lesson with another user (read-only access for recipient)

Migrations are in `supabase/migrations/`. Apply via Supabase Dashboard or CLI.

---

## data-testid Convention

Every interactive element follows the pattern `{page}-{element}`:

```
library-search-input
library-lesson-card-{id}
library-filter-genre-programming
lesson-detail-title
lesson-detail-upload-button
create-lesson-title-input
```

Preserve these attributes when modifying the UI — they are the Playwright test hooks.

---

## Deployment

Hosted on Google Cloud Run. On every push to `main`, Cloud Build:

1. Pulls `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Secret Manager
2. Builds the Docker image (Vite bakes the env vars into the static bundle at build time)
3. Pushes to Artifact Registry (`asia-southeast1-docker.pkg.dev/...`)
4. Deploys to Cloud Run (`asia-southeast1`)

For full GCP setup instructions (IAM, Artifact Registry, trigger configuration, Supabase URL allowlisting), see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Environment Variables

Required at build time (Vite inlines them into the JS bundle):

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key |

In production these are sourced from Google Cloud Secret Manager — never set as plaintext in `cloudbuild.yaml` or trigger substitutions.
