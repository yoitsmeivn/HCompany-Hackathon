# Kylian

A secure remote computer assistant — call or message Kylian to find files, operate applications, and access the computer you left behind.

Frontend built with **Vite + React + TypeScript + React Router** (SPA, no server code). A separate Node/Express backend will be added later; the frontend talks to typed mock services in `src/services/` until then.

## Getting started

```bash
npm install
npm run dev       # dev server at http://localhost:5173
```

Other scripts:

```bash
npm run build     # typecheck (tsc -b) + production build to dist/
npm run preview   # serve the production build locally
npm run lint      # eslint
```

## Routes

| Path | Page |
| --- | --- |
| `/` | Landing |
| `/setup` | Connect a computer (access setup) — `/demo` redirects here |
| `/dashboard` | Recent sessions |
| `/computers` | Connected computers and their access |
| `/files` | Files Kylian has touched during sessions |
| `/session/:sessionId` | Live session view — `/session` redirects to the demo session |

## Project structure

```
src/
  app/          router, App shell, usePageTitle
  layouts/      MarketingLayout, DashboardLayout
  pages/        one file per route
  features/     access, devices, sessions, files, live-session (components + types)
  components/   ui/ primitives, navigation/, brand/, marketing/ sections
  data/         mock data (computers, sessions, files)
  services/     typed Promise-returning mock API boundary (swap for fetch later)
  styles/       tokens.css, globals.css, components.css, responsive.css
```

## Access model

Each computer has an access policy (`src/features/access/types.ts`):

- **Full access** — Kylian can access files and applications during an active session.
- **Selected access** — you choose the allowed folders and applications.
- **Ask every time** (default, recommended) — Kylian asks before opening each new folder or application.

Secondary controls: voice, live view, and ask-before-sending-files.

## Deploying

This is a client-side routed SPA: **production hosting must rewrite unknown routes to `index.html`** (e.g. a catch-all rewrite on Vercel/Netlify, `try_files $uri /index.html` on nginx) so direct links and refreshes work.
