# OpenCourt — Backend Context

## Supabase

- **Project ref:** `pmllugwxnbfmspbtzmzm`
- **URL:** `https://pmllugwxnbfmspbtzmzm.supabase.co`
- **Anon key:** see `.env.example` (publishable key — safe to expose to the browser)
- **DB password:** not stored in the repo (Supabase dashboard → Project Settings → Database)
- **Location:** Fly.io (Frankfurt)
- **Email confirmation:** Disabled in Auth Settings

---

## Environment Variables (`.env.local`, documented in `.env.example`)

The canonical template lives at the repo root in `.env.example` — copy it to
`.env.local` and fill in the values. Full contents:

```dotenv
# OpenCourt — variáveis de ambiente
# Copie este arquivo para .env.local e preencha com seus valores.
# Nunca commite o .env.local com credenciais reais.

# ============================================================
# Supabase (obrigatório)
# ============================================================

# URL do projeto Supabase. Obtenha em:
#   Supabase Dashboard → Project Settings → API → Project URL
NEXT_PUBLIC_SUPABASE_URL=

# Anon key (public safe). Obtenha em:
#   Supabase Dashboard → Project Settings → API → anon public key
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Service role key (server-only secret). Obtenha em:
#   Supabase Dashboard → Project Settings → API → service_role key
#   ⚠️ Nunca exponha este valor no frontend nem commitá-lo.
SUPABASE_SERVICE_ROLE_KEY=

# ============================================================
# Brevo (envio de convites por email)
# ============================================================

# Chave de API do Brevo (gerada em SMTP & API → API Keys)
BREVO_API_KEY=

# Endereço de remetente verificado no Brevo (ex: nome <seu-email@gmail.com>)
BREVO_FROM_EMAIL=

# ============================================================
# Site URL (opcional, recomendado para produção)
# ============================================================

# Origem canônica do seu site (ex: https://opencourt.vercel.app).
# Usado como fallback para redirects de OAuth e links de email.
NEXT_PUBLIC_SITE_URL=
```

`SUPABASE_SERVICE_ROLE_KEY` is **never** exposed to the browser or via a
`NEXT_PUBLIC_*` var. It is imported only from `'use server'` files via
`lib/supabase/admin.ts` and gates invitations through `hasAdminKey()`.

`BREVO_API_KEY` / `BREVO_FROM_EMAIL` are server-only and used by
`lib/email/brevo.ts` (`sendInviteEmail`) to send invitation emails.

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

> **Optional facilitator.** Google sign-in is a convenience, not a requirement.
> The primary, always-available method is email + password. The app works fully
> without Google configured; only the "Continue with Google" button becomes
> unavailable. Enable it only if you want the extra provider.

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

### Invitation emails are sent via Brevo (not Supabase)

There is **no** passwordless login on `/login`. The only outbound invitation is
the one the principal triggers in Collaborators: `inviteMember` →
`supabase.rpc('invite_member', …)` writes the `invitations` row and returns its
`id` → `sendInviteEmail` (`lib/email/brevo.ts`) sends an email through the Brevo
API with the link
`<origin>/auth/callback?invitation_id=<id>&type=invite&next=/welcome`.
Invite-only and inviter-set roles (business rules #1 & #3) hold because the
invite row + RPC are the join path — the email is just the delivery channel.

`app/auth/callback/route.ts` handles `?invitation_id=` by validating the
invitation in the database (must be `pending` and not expired):

- **No session** → `/login?invitation_id=<id>&next=/welcome` (sign in or sign up
  first; the invitation is carried through the login flow).
- **Session email ≠ invitation email** → `/login?error=invitation_email_mismatch`.
- **Match** → `/welcome?invitation_id=<id>`.

On `/welcome`, non-Google invitees **must** set a password (their only credential,
applied via `updateUser` in `acceptInvitation`); Google invitees set none. The
acceptance itself is the `accept_invitation` RPC, which looks the pending invite
up by the authenticated email. Afterwards users sign in normally at `/login`.

> **Callback variants.** The callback still supports `?code=` (Google OAuth /
> PKCE started in the same browser → `exchangeCodeForSession`) and
> `?token_hash=&type=` (Supabase magic links → `verifyOtp`). Only the Brevo
> invitation uses `?invitation_id=`.

> **Brevo config (manual, can't be done from code):** verify the sender address
> in Brevo and set `BREVO_API_KEY` + `BREVO_FROM_EMAIL` in the server environment.
> The default Supabase **Invite user** email template is no longer used, so no
> template edit is required.

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
1. Validates + `requirePrincipal()` (JWT role check) + `hasAdminKey()` guard
2. `supabase.rpc('invite_member', { p_email, p_role })` — writes the `invitations`
   row and returns its `id`
3. Builds `inviteUrl = <origin>/auth/callback?invitation_id=<id>&type=invite&next=/welcome`
   and calls `sendInviteEmail({ email, inviteUrl })` (Brevo)
4. If the email fails, the invitation row already exists — the action returns a
   "resend" error and the principal can retry from Collaborators

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

---

Português: [`../pt-br/oc-backend.md`](../pt-br/oc-backend.md)
