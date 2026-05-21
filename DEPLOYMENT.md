# SkinScan AI — Deployment Guide

## PWA Setup

The logo and icons are already generated from `public/skinscan-logo.png`.

If you replace the logo, regenerate icons by running:
```bash
npm run gen:icons
```

This regenerates:
- `public/favicon-32.png` — browser tab icon
- `public/favicon.svg` — SVG favicon with embedded logo
- `public/icon-192.png` — PWA home screen icon
- `public/icon-512.png` — PWA splash screen icon
- `public/apple-touch-icon.png` — iOS home screen icon

---

## Vercel Deployment

### 1. Push to GitHub
```bash
git add .
git commit -m "feat: PWA + Vercel deployment config"
git push origin main
```

### 2. Import to Vercel
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Vercel auto-detects the config from `vercel.json`

### 3. Set Environment Variables
In **Vercel → Project → Settings → Environment Variables**, add:

| Variable | Value | Environment |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | All |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJ...` (anon key) | All |
| `SUPABASE_URL` | `https://xxx.supabase.co` | All |
| `SUPABASE_PUBLISHABLE_KEY` | `eyJ...` (anon key) | All |
| `GEMINI_API_KEY` | `AIza...` | All |

### 4. Build Settings (auto-detected from vercel.json)
- **Build Command**: `npm run build`
- **Install Command**: `npm install --legacy-peer-deps`
- **Output Directory**: `.output/public`

### 5. Deploy
Click **Deploy**. Vercel will build and deploy automatically.

---

## Supabase Configuration

After deploying, update your Supabase project:

1. **Auth → URL Configuration**:
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: `https://your-app.vercel.app/**`

2. **Auth → Providers → Google** (if using Google OAuth):
   - Authorized redirect URI: `https://your-app.vercel.app/auth/callback`

---

## PWA Features

- **Installable** on Android, iOS, and desktop Chrome/Edge
- **Offline support** — cached pages work without internet
- **App shortcuts** — "New Scan" and "Appointments" from home screen
- **Auto-update** — service worker updates silently in background
- **Theme color** — clinical blue (`#2563eb`) in browser chrome

### Testing PWA locally
```bash
npm run build
npm run preview
```
Open Chrome DevTools → Application → Service Workers to verify registration.

---

## Notes

- The app uses **TanStack Start** (SSR) with **Cloudflare Workers** as the runtime
- The `vercel.json` configures proper cache headers for SW and static assets
- The service worker skips Supabase API calls (always network-only)
- Credentials in `.env` are **never committed** — use Vercel env vars for production
