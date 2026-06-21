# OpenCourt

> Court scheduling for schools and private facilities.

OpenCourt centralizes court booking for an organization. Principals create a
school, invite teachers and student representatives, register their courts, and
everyone books and views occupancy on a shared calendar — all scoped to the
organization the member is currently working in.

---

## Features

- **Multi-school workspaces** — one account can belong to several schools with a
  different role in each, and switch the active context from the sidebar.
- **Invite-only membership** — principals invite collaborators by email; roles
  (`principal` / `teacher` / `student_rep`) are set by the inviter, never
  self-selected.
- **Court booking** — create, view, and manage bookings on a month / week / day /
  agenda calendar, with overlap prevention.
- **Dashboard** — court status, today's bookings, available slots, and a weekly
  occupancy chart.
- **Google & email auth** — sign in with Google (OAuth/PKCE) or email + password.
- **Profiles & settings** — avatars, institution switching, notification
  preferences, and per-organization court management.

---

## Tech stack

| Layer        | Technology                                   |
| ------------ | -------------------------------------------- |
| Framework    | Next.js 16 (App Router) · React 19           |
| Language     | TypeScript                                   |
| Styling      | Tailwind CSS v4                              |
| UI           | shadcn/ui · Radix · Remixicon / Lucide       |
| Charts       | Recharts                                     |
| Calendar     | react-big-calendar                           |
| Auth & DB    | Supabase (Auth + PostgreSQL, RLS)            |
| Data access  | `@supabase/ssr` (no ORM)                     |
| Forms        | react-hook-form + Zod                        |
| Font         | DM Sans (`next/font/google`)                 |
| Hosting      | Vercel                                       |

---

## Architecture

**Auth & access model.** Supabase Auth issues the session. Each user's active
organization lives in the JWT (`user_metadata.active_school_id` + `role`), so
Row Level Security policies authorize every query from the token alone — they
never join the `users` table, which avoids recursion. After any context change
(`create_school`, `accept_invitation`, `switch_school`) the app calls
`refreshSession()` so the new claims reach the cookie.

**Mutations are server actions.** Writes go through `'use server'` actions in
`lib/*/actions.ts`, which call `SECURITY DEFINER` Postgres RPCs (`create_school`,
`invite_member`, `accept_invitation`, …). Business rules live in the database, not
just the UI.

**Three Supabase clients.** `lib/supabase/client.ts` (browser), `server.ts`
(server components / actions, cookie-aware), and `admin.ts` (service-role,
server-only — used solely for `inviteUserByEmail`). The service-role key is never
exposed to the browser.

**Route protection** is handled by `proxy.ts` (Next.js 16's middleware) →
`lib/supabase/proxy.ts`: unauthenticated users go to `/login`; authenticated
users without an active school go to `/onboarding`; everyone else reaches the app.

**Google OAuth is client-initiated, server-completed.** The browser starts the
PKCE flow (`google-sign-in-button.tsx`) so it owns the code verifier; Google
returns to `app/auth/callback/route.ts`, which exchanges the code for a session
server-side. The same callback also handles admin-generated invite links via
`verifyOtp`.

For the full picture, see the deep-dive docs in [`context/`](context/).

---

## Project structure

```
opencourt/
├── app/
│   ├── (auth)/            # login, register, onboarding, welcome
│   ├── (app)/             # dashboard, calendar, collaborators, settings, courts
│   ├── auth/callback/     # OAuth + invite-token exchange (route handler)
│   ├── layout.tsx         # Root layout (DM Sans, Toaster)
│   ├── page.tsx           # Redirects → /dashboard
│   └── globals.css        # Tailwind v4 + shadcn design tokens
├── components/            # Feature + shared components (ui/ = shadcn primitives)
├── hooks/                 # Reusable React hooks
├── lib/
│   ├── auth/              # validation, errors, sign-in/up server actions
│   ├── bookings/          # booking actions (overlap check)
│   ├── collaborators/     # invite / remove / revoke actions
│   ├── courts/            # court CRUD actions
│   ├── supabase/          # client · server · admin · proxy (session)
│   └── strings/           # centralized UI copy
├── types/                 # shared TypeScript types
├── proxy.ts               # Next.js 16 middleware → route protection
├── supabase/
│   ├── seed.sql           # canonical one-shot install (schema + RLS + RPCs)
│   ├── migrations/        # incremental migration history
│   └── *.sql              # setup / email-trigger helpers
└── context/               # product, db, backend, frontend, ui docs
```

---

## Getting started

### Prerequisites

- **Node.js 20.9+** (required by Next.js 16)
- A **Supabase** project ([supabase.com](https://supabase.com))

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy the example file and fill in your Supabase project values:

```bash
cp .env.example .env.local
```

| Variable                        | Required | Notes                                                          |
| ------------------------------- | :------: | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      |    ✅    | Project URL (Dashboard → Project Settings → API).              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` |    ✅    | Publishable/anon key — safe for the browser (RLS enforces access). |
| `SUPABASE_SERVICE_ROLE_KEY`     |    ✅    | **Server-only secret**, bypasses RLS. Required to send email invites. Never prefix with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL`          |    —     | Optional fallback origin for redirects; OAuth uses `window.location.origin`. |

> Restart `next dev` after changing `.env.local`.

### 3. Set up the database

`supabase/seed.sql` is an idempotent, one-shot install — schema, RLS policies,
triggers, and all RPCs. Apply it either way:

- **Hosted:** paste the contents into the Supabase **SQL Editor** and run it, or
- **Local CLI:** `supabase db reset` (applies `seed.sql`).

The dated files in `supabase/migrations/` are the incremental history — apply them
in order when evolving an already-seeded database.

### 4. Configure the Supabase dashboard (one-time, manual)

These can't be done from code:

1. **Auth → Settings:** turn **off** "Confirm email".
2. **Auth → Providers → Google:** enable it and paste a Google Cloud OAuth
   **Client ID + Secret**. In Google Cloud, add the Supabase callback
   `https://<project-ref>.supabase.co/auth/v1/callback` to the client's
   *Authorized redirect URIs*.
3. **Auth → URL Configuration:** set the **Site URL** and add your app origins to
   **Redirect URLs** (e.g. `http://localhost:3000/auth/callback`). See
   [Deployment](#deployment) for the production allow-list.
4. **Auth → Emails → Invite user:** point the link at the callback with the token
   hash so invites authenticate correctly:
   ```html
   <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite">Accept the invitation</a>
   ```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Scripts

| Command         | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`   | Start the development server         |
| `npm run build` | Production build                     |
| `npm run start` | Serve the production build           |
| `npm run lint`  | Run ESLint                           |

---

## Deployment

The app is built for **Vercel**, and `main` is the production branch — pushing to
`main` triggers a production deploy.

1. Set the three required env vars in the Vercel project settings.
2. **Configure the production OAuth allow-list** in Supabase → Auth → URL
   Configuration. This is the most common "works locally, fails in production"
   cause: Supabase only honors a `redirectTo` that matches its **Redirect URLs**
   allow-list, otherwise it silently falls back to the **Site URL**.
   - **Site URL:** your canonical production origin (e.g. `https://opencourt.app`).
   - **Redirect URLs:** add `https://<your-domain>/**` and keep
     `http://localhost:3000/**` for local dev. For Vercel preview deployments,
     add a wildcard like `https://<project>-*.vercel.app/**`.

   The Google Cloud *Authorized redirect URI* points at Supabase, so it's the same
   for dev and prod — no production-specific change there.

---

## Domain model

- **Schools** are organizations; each generates an `OC-XXXX-XXXX` identifier
  (reserved for future use — not a login credential).
- **Memberships** link a user to a school with a role; a user has at most one
  membership per school.
- **Invitations** are email + role rows created by a principal; one pending
  invite per email per school, expiring after 7 days.
- **Courts** belong to a school (principal-managed). A new school starts with
  zero courts — the principal registers the first one in-app.
- **Bookings** reserve a court for a date/time window; overlaps are rejected.

Roles: `principal` (full control, can't be removed), `teacher`, `student_rep`.

---

## Documentation

In-depth context lives in [`context/`](context/):

| Doc | Covers |
| --- | --- |
| [`oc-product.md`](context/oc-product.md)   | Product overview, routes, screens, business rules |
| [`oc-db.md`](context/oc-db.md)             | Schema, RLS policies, triggers, RPCs, storage     |
| [`oc-backend.md`](context/oc-backend.md)   | Supabase clients, auth flows, server actions      |
| [`oc-frontend.md`](context/oc-frontend.md) | Page structure, components, sidebar, settings     |
| [`oc-ui.md`](context/oc-ui.md)             | Design tokens, motion, visual conventions         |
