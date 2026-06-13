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
  <AppSidebar />     {/* school switcher header, NavMain, NavUser */}
  <SidebarInset>
    <HeaderBar />    {/* dynamic title/description/CTA via header-context */}
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

`'use client'` — loads data via `useEffect` then renders:

### `components/nav-school-switcher.tsx` (SidebarHeader)
- **Trigger** (`SidebarMenuButton size="lg"`): `OpenCourtMark` in rounded square
  (`bg-sidebar-primary`), school name (primary), role (muted), `RiExpandUpDownLine`.
  In collapsed icon mode: only the mark is visible.
- **DropdownMenu**: label "Schools" → list all schools with `RiCheckLine` on active.
  Selecting → `switchSchool(school_id)` → `window.location.reload()`.
  Separator → "Create school" (`RiAddLine`) → `/onboarding`.
- Single school: trigger renders without dropdown; "Create school" link only.

### NavMain / NavUser
Unchanged patterns. NavUser reads `full_name`, `email`, and active role from loaded profile.

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
