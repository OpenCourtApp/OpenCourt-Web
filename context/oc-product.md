# OpenCourt — Product Context

## What is OpenCourt?

A web application for centralizing court scheduling at schools and private
facilities. Teachers, student representatives, and principals can book courts,
view occupancy, and manage who has access.

---

## Stack

| Layer        | Technology                     |
| ------------ | ------------------------------ |
| Framework    | Next.js 16.2.7 (App Router)    |
| UI           | shadcn/ui (Radix Maia style)   |
| Styling      | Tailwind CSS v4                |
| Auth         | Supabase Auth                  |
| Database     | Supabase (PostgreSQL)          |
| ORM          | Supabase JS client (no Prisma) |
| Deployment   | Vercel                         |
| Icons        | Remixicon (primary), Lucide    |
| Charts       | Recharts                       |
| Font         | DM Sans (next/font/google)     |

---

## Routes

| Route            | Purpose                                           | Status      |
| ---------------- | ------------------------------------------------- | ----------- |
| `/`              | Redirects to `/dashboard`                         | Done        |
| `/login`         | Sign in (login-02 block, flipped)                 | Done        |
| `/register`      | Sign up (signup-01 block)                         | Done        |
| `/onboarding`    | Post-signup: create a school (become principal)   | Done        |
| `/welcome`       | Accept an email invitation (join a school)        | Done        |
| `/auth/callback` | OAuth code exchange (route handler)               | Done        |
| `/dashboard`     | Stats, weekly chart, upcoming list                | Done        |
| `/calendar`      | Big Calendar (month/week/day/agenda) of bookings  | Done        |
| `/collaborators` | Members + pending invites table, invite dialog    | Done        |
| `/settings`      | Profile, Institutions, access token, notifications| Done        |

---

## Screen Specifications

### Login (`/login`)
2-column desktop layout. Left: OpenCourt logo → LoginForm. Right: hero image + gradient overlay.

### Register (`/register`)
Single column. Logo at top, SignupForm below (max-w-sm Card). Fields: Full name, Email, Password. School chosen later on `/onboarding`.

### Onboarding (`/onboarding`)
Reached after any new signup. **Create a school only** — no join-by-token tab.
Fields: Full name, School name. Creator becomes principal; an organization identifier (`OC-XXXX-XXXX`) is generated server-side. Sign out escape hatch.

### Welcome (`/welcome`)
Reached via invite link (or directly when signed in with a pending invite).
- With invitation: Card showing org name + role Badge (read-only) + Full name input + optional password (hidden for Google users) → join button.
- Without invitation: neutral state with "Create an organization" + Sign out.

### Dashboard (`/dashboard`)
Stats row (Court Status, Today's Bookings, Available Slots), weekly Recharts bar chart, upcoming today list. Scoped to the active school.

### Calendar (`/calendar`)
Month/Week/Day/Agenda views via the Shadcn UI Big Calendar (`react-big-calendar`,
added from the `list-jonas/shadcn-ui-big-calendar` registry). Events come from
`useBookings`; clicking one opens the edit dialog; "New booking" lives in the
header. Owned bookings render in the primary color, others in secondary.

### Collaborators (`/collaborators`)
Combined table of active members (from `memberships`) and pending invitations. Client-side search by name/email. "Invite collaborator" dialog (principal only) — fields: Email + Role. Status badges: Active / Pending. Actions: Remove (active non-principal), Resend + Cancel (pending).

### Settings (`/settings`)
- **Profile**: name, email, password inputs.
- **Institutions**: list of all schools the user belongs to. Role Badge + active check. "Switch" button for non-active schools (>1 school). 
- **Authorization**: principal-only. Organization identifier (`access_token`) with Copy button. Not used for login.
- **Notifications**: email toggle switches.
- **Appearance**: theme selector.

---

## Business Rules

1. **Invite-only join** — users cannot join a school without an invitation from its principal. Self-signup at `/register` only allows creating a new school.
2. **Multi-school** — a user can be a member of multiple schools with different roles in each. `users.active_school_id` defines the current context; switching happens in the sidebar switcher or Settings → Institutions.
3. **Role is per-school, set by the inviter** — `role` lives in `memberships`, not on the user profile. Invitees cannot choose their own role.
4. **Active school in JWT** — `raw_user_meta_data` carries `active_school_id` + `role` (for the active school). Refreshed after `create_school`, `accept_invitation`, and `switch_school`.
5. **Access token is an identifier only** — the `OC-XXXX-XXXX` token is the organization's identifier, reserved for future use. It is not used for login, joining, or any auth flow.
6. **Principal protected** — no destructive action on a principal's row; principals cannot be removed.
7. **No booking overlap** — exclusion constraint at DB level + UI conflict warning (planned).
8. **Email confirmation** — disabled in Supabase Auth Settings.
