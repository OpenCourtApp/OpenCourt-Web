# OpenCourt — Backend Context

## Supabase

- **Project ref:** `pmllugwxnbfmspbtzmzm`
- **URL:** `https://pmllugwxnbfmspbtzmzm.supabase.co`
- **Anon key:** `sb_publishable_L5KExncuKXOHws3SuhdA1Q_3sUVlOnQ`
- **DB password:** `OpenCourt@34555`
- **Location:** Fly.io (Frankfurt)
- **Email confirmation:** Disabled in Auth Settings

---

## Environment Variables (`.env.local`, documented in `.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL=https://pmllugwxnbfmspbtzmzm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_L5KExncuKXOHws3SuhdA1Q_3sUVlOnQ
# SERVER-ONLY secret (Dashboard → Project Settings → API → service_role).
# Bypasses RLS; required by inviteMember (admin.inviteUserByEmail).
# Restart `next dev` after setting.
SUPABASE_SERVICE_ROLE_KEY=
# Optional fallback origin for OAuth redirects (defaults to Origin header)
# NEXT_PUBLIC_SITE_URL=
```

`SUPABASE_SERVICE_ROLE_KEY` is **never** exposed to the browser or via a
`NEXT_PUBLIC_*` var. It is imported only from `'use server'` files via
`lib/supabase/admin.ts`.

---

## Supabase Clients

### Browser (`lib/supabase/client.ts`)
`createBrowserClient(url, anonKey)` — used in client components.

### Server (`lib/supabase/server.ts`)
`createServerClient(url, anonKey, { cookies })` — reads/writes Next.js cookies;
used in server components and server actions.

### Admin (`lib/supabase/admin.ts`)
`createClient(url, serviceRoleKey, { auth: { persistSession: false } })` —
bypasses RLS; imported only from `'use server'` files. `hasAdminKey()` is a
preflight guard.

---

## Auth Layer (`lib/auth/`)

- **`validation.ts`** — `signInSchema`, `signUpSchema`, `createSchoolSchema`,
  `acceptInvitationSchema`, `inviteMemberSchema` + exported types. `joinSchoolSchema`
  was removed (token-join flow no longer exists).
- **`errors.ts`** — `friendlyAuthError(AuthError)`, `friendlyOnboardingError(message)`.
  Known RPC exception keys: `not_authenticated`, `no_invitation`, `already_member`,
  `not_a_member`, `member_already_exists`, `not_authorized`.
- **`actions.ts`** — `'use server'` actions returning `AuthActionResult`.

### `signIn`, `signUp`, `signInWithGoogle`, `signOut`
Standard flows — unchanged from before. `signUp` redirects to `/onboarding` where
the user creates a school (only path for self-signup).

### `createSchool(input)`
Calls `create_school` RPC → `refreshSession()` → `redirect('/dashboard')`.

### `acceptInvitation(input)`
1. If `password` is provided (non-Google user): `supabase.auth.updateUser({ password })`
2. `supabase.rpc('accept_invitation', { p_full_name })`
3. `refreshSession()` → `redirect('/dashboard')`

### `switchSchool(schoolId)`
1. `supabase.rpc('switch_school', { p_school_id: schoolId })`
2. `refreshSession()`
3. `revalidatePath('/', 'layout')` — client calls `window.location.reload()` after

---

## Collaborators Layer (`lib/collaborators/`)

- **`validation.ts`** — `inviteMemberSchema` (email + role), `removeMemberSchema`,
  `revokeInvitationSchema`. `addCollaboratorSchema` was removed.
- **`errors.ts`** — `GENERIC_COLLABORATOR_ERROR`, `NOT_PRINCIPAL_ERROR`,
  `MISSING_ADMIN_KEY_ERROR`.
- **`actions.ts`** — `'use server'` actions; all call `revalidatePath('/collaborators')`.

### `inviteMember(input)`
1. Validates + `requirePrincipal()` (JWT role check)
2. `supabase.rpc('invite_member', { p_email, p_role })` — writes `invitations` row
3. `admin.auth.admin.inviteUserByEmail(email, { redirectTo: origin + '/auth/callback?next=/welcome' })` — pre-registers the email and sends the link
4. If "already registered": swallows the error (invite row exists in DB; user reaches `/welcome` on next sign-in)

### `revokeInvitation(invitationId)`
`supabase.rpc('revoke_invitation', { p_invitation_id })` → revalidate

### `removeMember(userId)`
`supabase.rpc('remove_member', { p_user_id })` → revalidate

---

## Route Protection (`proxy.ts`)

Delegates to `lib/supabase/proxy.ts → updateSession()`:

- Public paths: `/login`, `/register`, `/auth/callback`
- **Unauthenticated** → `/login`
- `/auth/callback` → always pass (OAuth handshake)
- **Authenticated, no `active_school_id`** → allow `/onboarding` and `/welcome`; otherwise → `/onboarding`
- **Authenticated, has `active_school_id`** → allow `/welcome` (accept additional invites); redirect public/onboarding to `/dashboard`

The proxy checks `user.user_metadata?.active_school_id` (not `school_id`).
