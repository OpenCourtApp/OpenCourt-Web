# OpenCourt — Frontend Context

## Pages Structure

```
app/
├── page.tsx                        # Redirect → /dashboard
├── layout.tsx                      # Root layout (DM Sans, light mode, Toaster)
├── globals.css                     # Tailwind v4 + shadcn CSS vars
│
├── (auth)/                         # Standalone auth pages
│   ├── login/page.tsx              # Login (2-column flipped layout)
│   ├── register/page.tsx           # Register (single column)
│   ├── onboarding/page.tsx         # Create-school page (requires session, no active school)
│   └── welcome/page.tsx            # Invitation acceptance (requires session)
│
├── auth/
│   └── callback/route.ts           # OAuth code exchange (exchangeCodeForSession)
│
└── (app)/                          # Authenticated + onboarded routes
    ├── layout.tsx                  # SidebarProvider + AppSidebar + HeaderBar
    ├── dashboard/page.tsx          # Stats row, weekly chart, upcoming list
    ├── calendar/page.tsx           # Placeholder (EmptyState "coming soon")
    ├── collaborators/page.tsx      # Server component → CollaboratorsView
    └── settings/page.tsx           # Profile, Institutions, authorization, notifications, appearance
```

---

## Auth Pages

### Login (`/login`)
2-column layout. Left: `OpenCourtLogo` + LoginForm. Right: hero image + gradient.

### Register (`/register`)
Single column. `OpenCourtLogo` + SignupForm (Card, max-w-sm).

### Onboarding (`/onboarding`)
Server component. Redirects to `/login` without session, `/dashboard` if already
onboarded (has `active_school_id`). Renders `OnboardingForm` with email + name prefilled.
Only one tab now — **Create a school** (no join-by-token flow).

### Welcome (`/welcome`)
Server component. Requires a session (proxy guarantees it). Fetches a `pending`,
non-expired invitation for the authenticated user's email from the `invitations` table.

- **With invitation**: renders `WelcomeForm` (`components/auth/welcome-form.tsx`) showing
  org name, role Badge, Full name input (prefilled), optional password input (hidden for
  Google OAuth). Submit → `acceptInvitation()` → `/dashboard`.
- **Without invitation**: neutral Card with "Create an organization" CTA + Sign out.

---

## Authenticated Layout (`app/(app)/layout.tsx`)

```tsx
<SidebarProvider>
  <AppSidebar />     {/* NavSchoolSwitcher (header), NavMain, NavUser (footer) */}
  <SidebarInset>
    <HeaderBar />    {/* title/description + optional CTA only — no account menu */}
    <main>{children}</main>
  </SidebarInset>
</SidebarProvider>
```

---

## Form Components

### `components/onboarding-form.tsx`
Create-school form only (no tabs). Fields: Full name + School name (`RiSchoolLine`).
Calls `createSchool()`. Sign out escape hatch.

### `components/auth/welcome-form.tsx`
Invite acceptance form. Shows org name, role Badge (read-only), Full name input,
optional password (hidden for Google users). Calls `acceptInvitation()`.

---

## Sidebar (`components/app-sidebar.tsx`)

`'use client'` — loads schools + active role + the user profile via `useEffect`, then
renders. **Placement (Notion/Linear/Slack convention):** workspace context (school
switcher) in the **header**, personal account (`NavUser`) in the **footer**. In a
multi-school app the active-school context is the primary orientation, so the switcher
leads and doubles as branding (no standalone logo). The top header bar therefore
carries no account menu — only title/description/CTA.

### `components/nav-school-switcher.tsx` (SidebarHeader)
- **Trigger** (`SidebarMenuButton size="lg"`): `OpenCourtMark` in rounded square
  (`bg-sidebar-primary`), school name (primary), role (muted), `RiExpandUpDownLine`.
  In collapsed icon mode: only the mark is visible.
- **DropdownMenu** (`side="bottom"`, opens downward from the header): label
  "Organizations" → list all schools with `RiCheckLine` on active. Selecting →
  `switchSchool(school_id)` → `window.location.reload()`. Separator → "Create
  organization" (`RiAddLine`) → `/onboarding`.

### `components/nav-user.tsx` (SidebarFooter)
- Props `{ name, email, role }` (fed from `app-sidebar.tsx`'s profile fetch).
- **Trigger**: avatar (initials) + name + role + `RiArrowUpDownLine`; collapses to
  **avatar-only** in icon mode (`group-data-[collapsible=icon]:hidden` on text + chevron).
- **DropdownMenu** (`side="right"`, opens beside the sidebar): label avatar + name +
  email, Settings → `/settings`, Log out → `signOut()`.
- Both slots show a `NavRowSkeleton` (avatar + two lines) while loading. The former
  top-bar `HeaderUser` component was removed.

### NavMain
Flat `Link` items inside `SidebarMenuButton`; active via `usePathname()`.

---

## App Pages

| Page            | Status      | Content                                                                          |
| --------------- | ----------- | -------------------------------------------------------------------------------- |
| `/dashboard`    | Done        | Stats cards, Recharts bar chart, upcoming today list                             |
| `/calendar`     | Placeholder | Weekly grid (Mon-Sun), booking cards                                             |
| `/collaborators`| Done        | Combined members + pending invites table, invite dialog, role/status badges      |
| `/settings`     | Done        | Profile, Institutions switcher, access token (principal only), notifications, appearance |

---

## Collaborators (`/collaborators`)

Server component fetches two queries in parallel (scoped to `active_school_id`):
1. `memberships` joined with `users` (profiles) → `ActiveMember[]`
2. `invitations` where `status = 'pending'` → `PendingInvite[]`

Types exported from `app/(app)/collaborators/page.tsx`:
```ts
type ActiveMember = { type:'member', id, user_id, full_name, email, role }
type PendingInvite = { type:'invite', id, email, role, expires_at }
type CollaboratorRow = ActiveMember | PendingInvite
```

### `components/collaborators/collaborators-view.tsx`
Sets header: "Collaborators" + "Invite collaborator" CTA (`RiUserAddLine`, principal only).
Merges members + pending into `allRows`, filters by name/email search.

### `components/collaborators/collaborators-table.tsx`
Columns: Name | Email | Role | Status | Actions.
- **Active** row: avatar + full_name, RoleBadge, `StatusBadge active`, Remove button (`RemoveMemberButton`) for non-principal non-self rows.
- **Pending** row: "—" name, email, RoleBadge, `StatusBadge pending`, Resend (`ResendInvitationButton`) + Cancel (`RevokeInvitationButton`).

### `components/collaborators/collaborator-actions.tsx`
Three buttons: `RemoveMemberButton` (AlertDialog → `removeMember`), `RevokeInvitationButton` (icon → `revokeInvitation`), `ResendInvitationButton` (icon → `inviteMember` with same email+role).

### `components/collaborators/add-collaborator-dialog.tsx`
Fields: Email + Role (Teacher / Student Rep). Submit → `inviteMember` → `toast.success('Invitation sent')`.

---

## Settings (`/settings`)

Scrollspy sidebar nav with sections: Profile · Institutions · Authorization · Notifications · Appearance.

### `components/settings/InstitutionsPanel.tsx`
Loads user's memberships client-side. Lists schools with role Badge + active indicator
(`RiCheckLine`). If >1 school: "Switch" button → `switchSchool()` → `window.location.reload()`.
Informational if only one school.

### `components/settings/AuthorizationPanel.tsx`
Principal-only. Fetches `access_token` from `schools` table for the active school.
Shows the token with a Copy button (`RiFileCopyLine`). Alert: "Organization identifier — reserved for future use."

---

## Shared Components

### `components/shared/header-context.tsx`
`HeaderProvider` + `useHeader()` — pages set `{ title, description, cta }` in `useEffect`.

### `components/shared/oc-logo.tsx`
`OpenCourtLogo` (full horizontal SVG) and `OpenCourtMark` (compact mark). Used in auth
pages and inside the sidebar school switcher.

### `components/shared/empty-state.tsx`
`EmptyState({ icon, title, description?, action? })` — used by Calendar, Collaborators,
and upcoming list.

---

## Badge / Token Conventions

| State      | Classes                               |
| ---------- | ------------------------------------- |
| Active     | `bg-muted text-muted-foreground`      |
| Pending    | `bg-warning/10 text-warning`          |
| Principal  | `bg-success/10 text-success`          |
| Teacher    | `bg-muted text-muted-foreground`      |
| Student Rep| `variant="outline"` `border-primary/40 text-primary` |

Never hardcode color names. Always use CSS variable tokens.

---

## Motion conventions

Sober, Notion/Linear-inspired micro-motion — no bouncy easing, no scale-pop, no
glow/gradient decoration. Powered by Tailwind v4 transition utilities and
`tw-animate-css` (imported in `globals.css`); **no extra animation libraries**.

| Pattern | Implementation | Duration |
| --- | --- | --- |
| Hover/active color changes | `transition-colors` (default ease) | 150ms |
| Primary button press | `motion-safe:active:scale-[0.98]` (default variant only; ghost/link/outline excluded). All buttons keep the base `active:translate-y-px` nudge. | base `transition-all` |
| Sidebar menu buttons | base adds `color,background-color` to `transition-[…] duration-150` so active/hover states fade instead of snapping | 150ms |
| Sidebar logo expand/collapse | two stacked layers cross-fade via `transition-opacity` + `delay-*`: expanding → mark fades out instantly, full logo fades in after 200ms; collapsing → logo out instantly, mark fades in after 200ms | 200ms |
| Dialog / AlertDialog / Sheet / Dropdown | shadcn + Radix defaults via `tw-animate-css` (`data-open:animate-in fade-in-0 zoom-in-95` / slide for side surfaces). Do not add extra easing or override. | ~100ms |
| Table rows | `transition-colors hover:bg-muted/50` (built into `ui/table.tsx` `TableRow`) | 150ms |
| Toasts | Sonner defaults (unchanged) | — |
| Skeletons | `ui/skeleton.tsx` `animate-pulse`; use anywhere data loads client-side (sidebar `NavRowSkeleton` for switcher + NavUser, InstitutionsPanel) | — |
| One-time entrances | Dashboard stat cards: `motion-safe:animate-in fade-in-0 slide-in-from-bottom-2` with `delay-75`/`delay-150` stagger via the grid container. Entrances may run ~300ms; reserve this for mount, not persistent decoration. | 300ms |

Rules:
- **All interactive transitions stay 100–200ms.** Only one-time mount entrances may reach ~300ms.
- **Respect reduced motion:** wrap any movement/scale entrance in `motion-safe:`
  so it's disabled under `prefers-reduced-motion`. Pure color/opacity fades may stay
  unprefixed (they degrade to an instant change).
- No gradients, glow, or glassmorphism on UI surfaces (see `oc-ui.md`).

**Follow-up (not implemented):** animating collaborator rows *out* on
`removeMember`/`revokeInvitation` needs client-side exit state (the rows come from a
server component re-render after `revalidatePath`, so they currently vanish abruptly).
Track exiting ids in `collaborators-view.tsx`, apply `animate-out fade-out-0`, then
revalidate — deferred to avoid client/server state coupling here.
