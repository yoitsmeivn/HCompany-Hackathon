# Kylian frontend

Vite + React + TypeScript + React Router SPA. No Next.js — do not reintroduce Next.js APIs, `app/` routing, server components, or API routes. There is no backend in this repo; data comes from typed mock services in `src/services/` (a separate Node/Express backend will be added later).

Conventions:

- All application code lives under `src/` (pages, layouts, features, components, data, services, styles).
- Styling is inline `style={{}}` objects plus global `k-*` utility classes in `src/styles/` (tokens, globals, components, responsive). No Tailwind, no CSS modules. Preserve the warm-white/black/muted-gray minimalist design language and the existing responsive breakpoints.
- Use `var(--k-*)` design tokens (see `src/styles/tokens.css`) in new code.
- Routing uses standard `react-router-dom` SPA APIs (`createBrowserRouter`, `Link`, `NavLink`, `Navigate`) — no loaders, actions, or framework mode.
- UI copy uses consumer-facing access language: "Full access", "Selected access", "Ask every time", "Allowed folders", "Allowed applications" — never "access grant", "permission scope", or "read-send".
