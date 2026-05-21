# SkinScan AI Suite

A full-stack dermatology platform that lets patients upload skin images for AI-powered analysis, consult with doctors, and manage appointments — all in one place.

Built with **TanStack Start**, **React 19**, **Supabase**, and **Google Gemini AI**. Deployable as a PWA on Vercel.

---

## Features

- **AI Skin Analysis** — Upload a photo and get an instant AI-generated assessment powered by Google Gemini
- **Patient Dashboard** — View scan history, upcoming appointments, and unread messages at a glance
- **Doctor Portal** — Review patient scans, add clinical notes, and manage consultations
- **Admin Panel** — User and role management across the platform
- **Appointments** — Book, view, and manage dermatology appointments
- **Messaging** — Real-time in-app messaging between patients and doctors with image support
- **Notifications** — Real-time bell notifications for new messages and appointment updates
- **PWA Support** — Installable on Android, iOS, and desktop with offline caching

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start (SSR) + React 19 |
| Routing | TanStack Router |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix UI) |
| Database & Auth | Supabase (PostgreSQL + Row Level Security) |
| AI | Google Gemini API |
| Forms | React Hook Form + Zod |
| Data Fetching | TanStack Query |
| Charts | Recharts |
| Runtime | Cloudflare Workers |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+ or [Bun](https://bun.sh)
- A [Supabase](https://supabase.com) project
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)

### 1. Clone and install

```bash
git clone <your-repo-url>
cd skinscan-ai-suite
npm install --legacy-peer-deps
# or
bun install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in your values in `.env`:

```env
# Supabase (client-side)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Supabase (server-side)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key
```

### 3. Set up the database

Run the SQL migration files against your Supabase project in this order:

1. `supabase-migrations.sql` — core schema
2. `notifications-table.sql` — notifications
3. `fix-appointments.sql` — appointment fixes
4. `fix-doctor-role.sql` — doctor role setup
5. `fix-roles-step2.sql` — role finalization
6. `fix-scans-rls.sql` — scan RLS policies
7. `fix-messages-rls.sql` — message RLS policies
8. `fix-messages-images.sql` — image support in messages
9. `fix-messages-realtime.sql` — realtime for messages
10. `fix-notifications-rls.sql` — notification RLS policies
11. `enable-realtime-notifications.sql` — enable realtime on notifications

### 4. Run the dev server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## Test Accounts

| Role | Email | Password |
|---|---|---|
| Patient | patient@skinscan.test | Tr1age-Patient-9f3K |
| Doctor | doctor@skinscan.test | Derm-R3view-Doc-7xQ |
| Admin | admin@skinscan.test | Sk1nScan-Admin-4vM! |

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build (generates favicons + Vite build) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run gen:icons` | Regenerate PWA icons from `public/skinscan-logo.png` |

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full Vercel deployment instructions, including:

- Environment variable setup
- Supabase auth URL configuration
- PWA testing steps

---

## Project Structure

```
src/
├── components/        # Shared UI components
│   └── ui/            # shadcn/ui primitives
├── hooks/             # Custom React hooks
├── lib/               # Supabase client, utilities
└── routes/
    ├── auth.tsx        # Login / signup
    ├── index.tsx       # Landing page
    └── _app/
        ├── dashboard.tsx
        ├── scans/      # Scan upload + results
        ├── appointments.tsx
        ├── messages.tsx
        ├── doctor.tsx
        ├── admin.tsx
        ├── profile.tsx
        └── settings.tsx
```

---

## License

Private — all rights reserved.
