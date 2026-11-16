# OpenCourt

> Court scheduling for schools and private facilities.

OpenCourt centralizes court booking for an organization. Principals create a
school, invite teachers and student representatives, register their courts, and
everyone books and views occupancy on a shared calendar — all scoped to the
organization the member is currently working in.

---

## Team

| Full name                         | Student ID |
| --------------------------------- | ---------- |
| Breno Valentim Bernardo           | 20240207   |
| João Pedro Crepaldi Gonçalves     | 20230465   |
| Gabriel Loureiro Amorim Hugi      | 20240192   |

---

## Project description

At Etec Bento Quirino, the court is a space shared by the entire school
community. The same court used by the Physical Education teacher during classes
is the court the administration uses to schedule events (such as TCC
presentations and rentals to outside schools) and that the Student Council uses
to organize the interclass tournament — and so on.

Because each of these groups booked the court through separate channels and
without a shared view of occupancy, reservations often collided or were not
transparent to the rest of the school. This made court management disorganized:
an event scheduled by the administration could be overlapped by a PE class, and
it was not always possible to know who had booked which time slot.

This need from the school community is what gave rise to **OpenCourt**: a web
application that brings together, in a single place, the registration of spaces,
access rules, and all court reservations, with a shared calendar and schedule
conflict prevention.

---

## Objectives

**Overall goal:** centralize and organize court scheduling at the school, ensuring
that every use — classes, institutional events, and student activities — can
coexist without time conflicts and with full visibility.

**Specific objectives:**

- **Prevent scheduling collisions** — stop an event scheduled by the
  administration from being overlapped by a PE class, and vice versa, with
  conflict validation at booking time.
- **Provide occupancy transparency** — every member of the organization can see,
  in a single calendar (month, week, day, and agenda), what is already booked,
  by whom, and at what time.
- **Organize access by role** — define who can book, manage courts, and invite
  people, through roles (`principal`, `teacher`, `student_rep`) assigned at
  invitation time.
- **Make daily use easier** — offer a dashboard with court status, the day's
  bookings, and available time slots, reducing reliance on informal
  communication.

**Expected outcomes:** a court with clear, traceable occupancy, fewer schedule
conflicts, less rework for the administration, and more autonomy for teachers and
the Student Council to check and book the space.

---

## Methodology

Development was carried out incrementally, with the following stages and
procedures:

1. **Requirements gathering.** The team talked with the school community at Etec
   Bento Quirino to understand how the court is used today and which conflicts
   needed to be solved. This contact was made possible by the technical course
   coordination, which bridged the team and the different school sectors
   (teachers, administration, and Student Council).

2. **Scope definition and business rules.** From the requirements, the access
   roles were defined (administration/coordination, teacher, and student
   representative), along with the member invitation flow, court registration,
   and the core rule of the system: **do not allow bookings that overlap in time
   on the same court**.

3. **Data modeling.** The system's structure (organizations, members,
   invitations, courts, and bookings) was modeled as a relational database in
   Supabase, with business rules also enforced in the database through SQL
   functions (`RPC`).

4. **Development.** The application was built as a web app with **Next.js 16
   (App Router)**, **React 19**, and **TypeScript**, with a **Tailwind CSS v4**
   + **shadcn/ui** interface, and authentication and persistence via
   **Supabase**.

5. **Deployment.** The application was published on **Vercel**, with the
   production environment configured from the project repository.

> The stages were executed iteratively: each feature was implemented, reviewed
> with the group, and adjusted as the understanding of the need evolved.

---

## Technologies used

### Database

**Supabase (PostgreSQL).** The database is a PostgreSQL instance hosted on
Supabase, responsible for storing organizations, members, invitations, courts,
and bookings. Beyond storage, the database concentrates the business rules
through SQL functions (`RPC`) executed on the server, such as school creation,
member invitation, and schedule conflict checking. Supabase also provides the
authentication service (email/password as the main method and Google as an
optional facilitator).

### Artificial Intelligence

**Claude Code.** An AI assistant used to support development — it helped with
writing and refactoring code, reviewing application snippets, and organizing the
project structure. Product decisions, data modeling, and business rules remained
the team's responsibility.

### Other technologies

| Layer         | Technology                                   |
| ------------- | -------------------------------------------- |
| Framework     | Next.js 16 (App Router) · React 19           |
| Language      | TypeScript                                   |
| Styling       | Tailwind CSS v4                              |
| UI            | shadcn/ui · Radix · Remixicon / Lucide       |
| Charts        | Recharts                                     |
| Calendar      | react-big-calendar                           |
| Auth & DB     | Supabase (Auth + PostgreSQL)                 |
| Data access   | `@supabase/ssr` (no ORM)                     |
| Forms         | react-hook-form + Zod                        |
| Font          | DM Sans (`next/font/google`)                 |
| Email         | Brevo (transactional email API)              |
| Hosting       | Vercel                                       |

### Execution environment and infrastructure

- **Runtime:** Node.js 20.9+ (required by Next.js 16), running the application as
  server components and serverless functions.
- **Application:** Next.js 16 with the App Router, served by Vercel.
- **Database and authentication:** Supabase Cloud (managed PostgreSQL + Supabase
  Auth), accessed via `@supabase/ssr`.
- **Hosting and deploy:** Vercel, with the `main` branch as the production
  environment.

### External services and integrations

To run, the application depends on external services:

| Service                | Required?          | Role |
| ---------------------- | :----------------: | ---- |
| **Supabase**           | Yes                | PostgreSQL database and email/password authentication. It is the application's persistence and access layer. |
| **Brevo**              | Yes (for invites)  | Sends invitation emails via API. Required for the email invite flow. |
| **Vercel**             | Yes                | Application hosting and execution of serverless functions in production. |
| **Google Cloud OAuth** | No (facilitator)   | Sign-in with Google via OAuth/PKCE. An optional facilitator — email and password access works independently. |

> Sign-in with Google is an access convenience, not a dependency: without it, the
> application keeps working normally with email and password.

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
- **Email and Google sign-in** — sign in with email + password (the main method)
  or with Google (OAuth/PKCE, an optional facilitator).
- **Profiles & settings** — avatars, institution switching, notification
  preferences, and per-organization court management.

---

## Architecture

**Auth & access model.** Supabase Auth issues the session. Each user's active
organization lives in the JWT (`user_metadata.active_school_id` + `role`), so
**Row Level Security (RLS)** policies authorize every query from the token alone —
they never join the `users` table, which avoids recursion. After any context
change (`create_school`, `accept_invitation`, `switch_school`) the app calls
`refreshSession()` so the new claims reach the cookie.

**Mutations are server actions.** Writes go through `'use server'` actions in
`lib/*/actions.ts`, which call PostgreSQL functions (`RPC`). Business rules live
in the database, not just the UI.

**Three Supabase clients.** `lib/supabase/client.ts` (browser), `server.ts`
(server components / actions, cookie-aware), and `admin.ts` (service-role,
server-only — provides `hasAdminKey()`, which gates invite sending). The
service-role key is never exposed to the browser.

**Route protection** is handled by `proxy.ts` (Next.js 16's middleware) →
`lib/supabase/proxy.ts`: unauthenticated users go to `/login`; authenticated
users without an active school go to `/onboarding`; everyone else reaches the app.

**Google OAuth is optional and client-initiated.** When configured, the browser
starts the PKCE flow (`google-sign-in-button.tsx`) so it owns the code verifier;
Google returns to `app/auth/callback/route.ts`, which exchanges the code for a
session server-side. The same callback handles **Brevo** invitation links (via
`invitation_id`) and Supabase magic links (via `verifyOtp`). Without Google, email
and password sign-in keeps working normally.

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
│   ├── seed.sql           # canonical one-shot install (schema + triggers + RPCs)
│   ├── migrations/        # incremental migration history
│   └── *.sql              # setup / email-trigger helpers
└── context/               # docs in en/ and pt-br/ (product, db, backend, frontend, ui)
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
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` |    ✅    | Publishable/anon key — safe for the browser.                   |
| `SUPABASE_SERVICE_ROLE_KEY`     |    ✅    | **Server-only secret**, bypasses access rules. Required to gate invite sending. Never prefix with `NEXT_PUBLIC_`. |
| `BREVO_API_KEY`                 |    ✅    | Brevo API key, used to send invitation emails. Server-only.    |
| `BREVO_FROM_EMAIL`              |    ✅    | Verified Brevo sender (e.g. `OpenCourt <no-reply@domain.com>`). |
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
2. **Auth → Providers → Google (optional):** to enable Google sign-in, turn on
   the provider and paste a Google Cloud OAuth **Client ID + Secret**. In Google
   Cloud, add the Supabase callback
   `https://<project-ref>.supabase.co/auth/v1/callback` to the client's
   *Authorized redirect URIs*.
3. **Auth → URL Configuration:** set the **Site URL** and add your app origins to
   **Redirect URLs** (e.g. `http://localhost:3000/auth/callback`). See
   [Deployment](#deployment) for the production allow-list.
4. **Brevo (for invites):** verify the sender address in your Brevo account and
   set `BREVO_API_KEY` + `BREVO_FROM_EMAIL`. Invitation emails are sent through
   the Brevo API (the default Supabase *Invite user* template is no longer used).

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

In-depth context lives in [`context/en/`](context/en/) (Portuguese versions in
[`context/pt-br/`](context/pt-br/)):

| Doc | Covers |
| --- | ------ |
| [`oc-product.md`](context/en/oc-product.md)   | Product overview, routes, screens, business rules |
| [`oc-db.md`](context/en/oc-db.md)             | Schema, database rules, triggers, RPCs, storage    |
| [`oc-backend.md`](context/en/oc-backend.md)   | Supabase clients, auth flows, server actions      |
| [`oc-frontend.md`](context/en/oc-frontend.md) | Page structure, components, sidebar, settings     |
| [`oc-ui.md`](context/en/oc-ui.md)             | Design tokens, motion, visual conventions         |

---

## Versão em português

A versão em português deste README está disponível em
[`README.md`](README.md).
