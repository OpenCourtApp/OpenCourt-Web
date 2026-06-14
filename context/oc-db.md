# OpenCourt — Database Context

## Setup

`supabase/seed.sql` is the canonical one-shot install: a single idempotent
script that produces the full, secure end state — schema, RLS, triggers, and
all RPCs. Apply via `supabase db reset` (local dev) or paste into the Supabase
SQL Editor. Also turn OFF "Confirm email" in Auth Settings. The dated
`migrations/*.sql` are the incremental history (apply them in order on a
running database).

## Schema (final state)

### Enums

```sql
CREATE TYPE user_role AS ENUM ('principal', 'teacher', 'student_rep');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
```

### Table: `schools`

| Column       | Type        | Constraints                              |
| ------------ | ----------- | ---------------------------------------- |
| id           | uuid        | PK, DEFAULT gen_random_uuid()            |
| name         | text        | NOT NULL                                 |
| access_token | text        | UNIQUE NOT NULL (format `OC-XXXX-XXXX`)  |
| created_at   | timestamptz | DEFAULT now()                            |

`access_token` is the **organization identifier** — retained for future use,
not used for login or access control.

### Table: `users` (profile)

| Column           | Type        | Constraints                                       |
| ---------------- | ----------- | ------------------------------------------------- |
| id               | uuid        | PK, FK → auth.users(id) ON DELETE CASCADE         |
| full_name        | text        | NOT NULL                                          |
| email            | text        | UNIQUE NOT NULL                                   |
| active_school_id | uuid        | FK → schools(id) ON DELETE SET NULL (nullable)    |
| created_at       | timestamptz | DEFAULT now()                                     |

Avatars are **not** a profile column: the photo URL lives in auth metadata
(`raw_user_meta_data.avatar_url`) — the Google identity photo, or the URL of a
file uploaded to the **`avatars` storage bucket** (below). Reading from metadata
means avatar display never depends on a schema migration.

### Table: `memberships`

| Column     | Type        | Constraints                               |
| ---------- | ----------- | ----------------------------------------- |
| id         | uuid        | PK, DEFAULT gen_random_uuid()             |
| user_id    | uuid        | NOT NULL, FK → users(id) ON DELETE CASCADE |
| school_id  | uuid        | NOT NULL, FK → schools(id) ON DELETE CASCADE |
| role       | user_role   | NOT NULL                                  |
| created_at | timestamptz | DEFAULT now()                             |

`UNIQUE (user_id, school_id)` — a user has at most one membership per school.

### Table: `invitations`

| Column     | Type               | Constraints                               |
| ---------- | ------------------ | ----------------------------------------- |
| id         | uuid               | PK, DEFAULT gen_random_uuid()             |
| school_id  | uuid               | NOT NULL, FK → schools(id) ON DELETE CASCADE |
| email      | text               | NOT NULL (stored `lower(trim(email))`)    |
| role       | user_role          | NOT NULL                                  |
| invited_by | uuid               | FK → users(id)                            |
| status     | invitation_status  | NOT NULL DEFAULT 'pending'                |
| expires_at | timestamptz        | DEFAULT now() + interval '7 days'         |
| created_at | timestamptz        | DEFAULT now()                             |

`UNIQUE (school_id, email) WHERE (status = 'pending')` — one pending invite per email per school.

### Table: `courts`

| Column     | Type        | Constraints                                  |
| ---------- | ----------- | -------------------------------------------- |
| id         | uuid        | PK, DEFAULT gen_random_uuid()                |
| school_id  | uuid        | NOT NULL, FK → schools(id) ON DELETE CASCADE |
| name       | text        | NOT NULL                                     |
| created_at | timestamptz | DEFAULT now()                                |

`UNIQUE (school_id, name)`. New schools start with **zero** courts — the
principal registers the first court in-app (FirstCourtGate blocks the app
until then). RLS: members of the active school can SELECT; only the
principal can INSERT/UPDATE/DELETE.

### Table: `bookings`

| Column     | Type        | Constraints                                  |
| ---------- | ----------- | -------------------------------------------- |
| id         | uuid        | PK, DEFAULT gen_random_uuid()                |
| title      | text        | NOT NULL                                     |
| school_id  | uuid        | NOT NULL, FK → schools(id) ON DELETE CASCADE |
| court_id   | uuid        | NOT NULL, FK → courts(id) ON DELETE RESTRICT |
| booked_by  | uuid        | NOT NULL, FK → users(id) ON DELETE CASCADE   |
| date       | date        | NOT NULL                                     |
| start_time | time        | NOT NULL                                     |
| end_time   | time        | NOT NULL                                     |
| notes      | text        | nullable                                     |
| created_at | timestamptz | DEFAULT now()                                |

RLS: members of the active school can SELECT; INSERT requires
`booked_by = auth.uid()` and the active school; DELETE allowed to the owner
or the principal. Overlap prevention is enforced in the `createBooking`
server action (`lib/bookings/actions.ts`), not by a DB constraint.

---

## Storage

### Bucket `avatars` (public)
Profile photos for email+password users. **Public read** (so `<img src>` works
without signed URLs); writes are gated by RLS on `storage.objects`: a user may
only INSERT/UPDATE/DELETE objects whose first path segment is their own id
(`(storage.foldername(name))[1] = auth.uid()::text`). Upload path convention:
`avatars/<user_id>/avatar-<timestamp>.<ext>`. Defined in `seed.sql` and
`migrations/20260616_avatars.sql`.

---

## RLS Policies

All policies use `auth.jwt() → 'user_metadata'` claims (never join `users`)
to avoid recursion. `memberships` policies never reference the `users` table.

### `schools`
- **Members can view their schools** — SELECT for rows where `EXISTS (memberships where school_id = schools.id AND user_id = auth.uid())`

### `memberships`
- **View active school members** — SELECT where `school_id = active_school_id` (JWT claim)
- **View own memberships** — SELECT where `user_id = auth.uid()`
- **Principal can add/remove members** — INSERT/DELETE guarded by `role = 'principal'` AND `school_id = active_school_id` (both from JWT claims)

### `users`
- **Users can view own profile** — SELECT where `id = auth.uid()`
- **Users can view same active school** — SELECT where `EXISTS (memberships where user_id = users.id AND school_id = active_school_id_claim)`
- **Users can update their own profile** — UPDATE where `id = auth.uid()`

### `invitations`
- **Principal can manage invitations** — ALL where `role = 'principal' AND school_id = active_school_id` (JWT claims)
- **Invitees can view their own invitations** — SELECT where `email = auth.user().email`

---

## Triggers

**`handle_new_user()`** (AFTER INSERT ON auth.users) — creates the `public.users`
profile with `id`, `email`, `full_name` (from metadata), `active_school_id = NULL`.
Uses `ON CONFLICT (id) DO NOTHING` — `inviteUserByEmail` also fires this trigger.

**`sync_user_email()`** (AFTER UPDATE OF email ON auth.users) — keeps `public.users.email`
in sync when the user changes their email.

---

## RPCs (all `SECURITY DEFINER`, granted to `authenticated`)

### `create_school(p_school_name, p_full_name)`
Generates a unique `OC-XXXX-XXXX` token → inserts `schools` → inserts `memberships(role='principal')` → updates `users.active_school_id` + `full_name` → merges JWT claims (`active_school_id`, `role='principal'`).

### `accept_invitation(p_full_name)`
Looks up `pending`, non-expired invitation by `auth.email()` → raises `no_invitation` if none → `already_member` guard → inserts membership with the invitation's role → updates `users.active_school_id` → marks invitation `accepted` → merges JWT claims.

### `switch_school(p_school_id)`
Validates membership exists → raises `not_a_member` → updates `users.active_school_id` → merges JWT claims (`active_school_id` + membership role).

### `invite_member(p_email, p_role)`
Principal-only (JWT check) → normalizes email → `member_already_exists` guard → inserts `invitations` (ON CONFLICT DO NOTHING) → returns invitation `id`.

### `revoke_invitation(p_invitation_id)`
Principal-only → sets status `revoked` on the matching pending invitation.

### `remove_member(p_user_id)`
Principal-only → refuses to remove another principal or self → deletes membership in active school → clears removed user's `active_school_id` and JWT claims if they pointed to this school.

---

## JWT Claims

`auth.users.raw_user_meta_data` carries `active_school_id` and `role` (role in the active school). Updated by `create_school`, `accept_invitation`, and `switch_school`. The app calls `supabase.auth.refreshSession()` after each so the new claims reach the cookie and the proxy.

---

## TypeScript Types (`types/index.ts`)

```typescript
export type Role = 'principal' | 'teacher' | 'student_rep'

export interface User {
  id: string; full_name: string; email: string
  active_school_id: string | null; created_at: string
}
export interface Membership {
  id: string; user_id: string; school_id: string
  role: Role; created_at: string
}
export interface Invitation {
  id: string; school_id: string; email: string; role: Role
  invited_by: string | null
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  expires_at: string; created_at: string
}
export type UserSchool = { school_id: string; school_name: string; role: Role }
```
