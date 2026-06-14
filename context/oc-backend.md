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
  `acceptInvitationSchema` (+ `acceptInvitationWithPasswordSchema` for the
  non-Google welcome form), `inviteMemberSchema` + exported types.
  `joinSchoolSchema` was removed (token-join flow no longer exists).
- **`errors.ts`** — `friendlyAuthError(AuthError)`, `friendlyOnboardingError(message)`.
  Known RPC exception keys: `not_authenticated`, `no_invitation`, `already_member`,
  `not_a_member`, `member_already_exists`, `not_authorized`.
- **`actions.ts`** — `'use server'` actions returning `AuthActionResult`.

### `signIn`, `signUp`, `signOut`
Email/password flows (server actions). `signUp` redirects to `/onboarding` where the
user creates a school (only path for self-signup).

### Google OAuth — client-initiated, server-completed
Google sign-in is **not** a server action (a Server Action can't reliably perform the
cross-origin redirect to Google, and the PKCE code verifier must live in the browser).
The split:

- **Client (browser-initiated):** `components/google-sign-in-button.tsx` (used by both
  `LoginForm` and `SignupForm`) calls the **browser** client
  `createClient().auth.signInWithOAuth({ provider:'google', options:{ redirectTo:
  '<origin>/auth/callback?next=/dashboard' } })`. The browser client stores the PKCE
  verifier cookie and navigates the page to Google automatically.
- **Server (callback):** `app/auth/callback/route.ts` runs
  `supabase.auth.exchangeCodeForSession(code)` (server client reads the verifier
  cookie), then redirects to the validated relative `?next`. `proxy.ts` then routes by
  account state.
- **Routing after sign-in:** new Google users have `active_school_id = NULL` (created by
  the `handle_new_user()` trigger) → `proxy.ts` sends them to `/onboarding`; the
  `/onboarding` page redirects to `/welcome` if a pending invitation exists for their
  email (so invited users accept rather than create a school). Invite emails link
  straight to `/auth/callback?next=/welcome`.
- There is no `signInWithGoogle` server action anymore.

> **Dashboard checklist (manual, can't be done from code):** in Supabase → Authentication
> → Providers, enable **Google** and paste a Google Cloud OAuth **Client ID + Secret**;
> add the Supabase callback URL (`https://<project>.supabase.co/auth/v1/callback`) to the
> Google OAuth client's *Authorized redirect URIs*, and add the app origin(s) to Supabase
> → Authentication → URL Configuration (Site URL + redirect allow-list). Without this the
> button errors out at Google.

> **Production config — required, separate from dev (this is the #1 "works locally, fails
> on Vercel" cause).** Supabase only honors a `redirectTo` that matches its **Redirect URLs**
> allow-list; any other value silently falls back to the **Site URL**. If the production
> origin isn't allow-listed, Google auth completes but Supabase bounces the user to the Site
> URL (often still `http://localhost:3000` from dev) — the code then reaches a domain with no
> PKCE verifier cookie, `exchangeCodeForSession` fails, and the user lands on
> `/login?error=oauth_failed`. To fix, in Supabase → Authentication → URL Configuration:
> - **Site URL:** set to the canonical production origin, e.g. `https://<your-app>.vercel.app`.
> - **Redirect URLs (allow-list):** add `https://<your-app>.vercel.app/auth/callback`. To also
>   support Vercel preview deployments, add a wildcard such as
>   `https://<project>-*.vercel.app/auth/callback` (preview URLs vary per deployment).
> - Keep `http://localhost:3000/auth/callback` in the allow-list so local dev keeps working.
>
> The Google Cloud *Authorized redirect URI* (`https://<project>.supabase.co/auth/v1/callback`)
> is the same for dev and prod, so it needs no production-specific change. The app reads no
> `NEXT_PUBLIC_SITE_URL` for this flow — the redirect origin is taken from
> `window.location.origin` in the browser — so no Vercel env var is required for OAuth.

### The invitation email *is* the magic link
There is **no** passwordless login on `/login`. The only magic link in the app
is the one the principal triggers in Collaborators: `inviteMember` →
`admin.auth.admin.inviteUserByEmail(email, { redirectTo: origin +
'/auth/callback?next=/welcome' })`. The invitee clicks it, the callback
authenticates them, and `proxy.ts` routes them to `/welcome` to accept
(`accept_invitation`). Invite-only and inviter-set roles (business rules #1 & #3)
hold because the invite row + RPC are the join path — the email link is just
authentication. On `/welcome` non-Google invitees **must** set a password (it's
their only credential, applied via `updateUser` in `acceptInvitation`); Google
invitees set none. Afterwards they sign in normally at `/login` with email +
that password.

> **Token flow — why the callback uses `verifyOtp`, not `exchangeCodeForSession`,
> for email links.** An invite email is **admin-generated**: the recipient opens
> it in a browser that never started a PKCE flow, so there is **no code-verifier
> cookie** and the `?code=` / `exchangeCodeForSession` path (used by Google OAuth)
> cannot complete — it fails and dumps the user on `/login?error=oauth_failed`.
> `app/auth/callback/route.ts` therefore also handles `?token_hash=&type=` via
> `supabase.auth.verifyOtp({ type, token_hash })`, which authenticates straight
> from the emailed token (no verifier needed, works cross-device).
>
> **Dashboard requirement (manual, can't be done from code):** the default
> Supabase **Invite user** email template uses `{{ .ConfirmationURL }}`, which
> routes through `/auth/v1/verify` and produces the broken PKCE/hash redirect.
> Change it (Authentication → Emails → *Invite user*) so the link points straight
> at our callback with the token hash:
> ```html
> <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite">Accept the invitation</a>
> ```
> `{{ .RedirectTo }}` is the `redirectTo` we pass (`<origin>/auth/callback?next=/welcome`),
> so the link is origin-correct for dev and prod automatically — but `<origin>/auth/callback`
> must be in the **Redirect URLs** allow-list for `.RedirectTo` to be honored. (If
> `.RedirectTo` ever comes through empty, hardcode `{{ .SiteURL }}/auth/callback?next=/welcome&token_hash={{ .TokenHash }}&type=invite`
> instead.) The same applies to the **Magic Link** template if magic-link login is
> ever enabled.

### `createSchool(input)`
Calls `create_school` RPC → `refreshSession()` → `redirect('/dashboard')`.

### `acceptInvitation(input)`
1. Non-Google users (`provider !== 'google'`) **must** provide a password — the
   action rejects a missing one; then `supabase.auth.updateUser({ password })`.
   Google users set none.
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
