# OpenCourt — Project Context

## What is OpenCourt

OpenCourt is a web app for centralizing court scheduling at schools and private facilities. Teachers, student representatives, and principals can book courts, view occupancy, and manage who has access to the system — with zero overlap and full visibility.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI components | shadcn/ui (see setup below) |
| Styling | Tailwind CSS v4 |
| Auth | Supabase Auth |
| Database | Supabase (PostgreSQL) |
| ORM | Supabase JS client (no Prisma) |
| Deployment | Vercel |

---

## shadcn Setup

**Initialize the project with this exact command:**

```bash
npx shadcn@latest init --preset b5JgzdSVs --template next --pointer
```

**Then add these blocks:**

```bash
npx shadcn@latest add sidebar-07
npx shadcn@latest add login-02
npx shadcn@latest add signup-01
```

### Rules

- **All UI must use shadcn.** Every component — buttons, inputs, modals, tables, badges, toggles, dropdowns, charts — must be a shadcn primitive or built directly on top of one. No other component library.
- **Theme is already configured** by the preset above. Do not hardcode color values or override CSS variables manually.
- **Light mode only.** Force light mode in `layout.tsx` by setting `className="light"` on the `<html>` element. Do not implement dark mode or a theme switcher.
- The Figma screens provided are **reference only** — feel free to improve UI or UX as long as it stays within shadcn components and the light theme.

---

## Screen Structure

```
/                     → redirect to /dashboard
/login                → Login screen (login-02 block)
/register             → Register screen (signup-01 block)
/dashboard            → Dashboard (default after login)
/calendar             → Weekly calendar view
/collaborators        → Collaborators list
/settings             → User settings
```

### Authenticated Layout

All routes under `/(app)` share a persistent shell built on the `sidebar-07` block:
- **Left sidebar**: OpenCourt logo, nav links (Dashboard, Calendar, Collaborators), user avatar + name + role at the bottom (expandable to a profile dropdown with Settings and Log out)
- **Main content**: full-height scrollable area with a page header (title + subtitle) and a top-right CTA button where applicable

---

## Screen Descriptions

### /login
Use the `login-02` block as the base. Left panel: aerial court photo with tagline and feature bullets. Right panel: email + password form, "Enter" CTA, link to register. Adapt copy and layout to fit the block structure.

### /register
Use the `signup-01` block as the base. Fields: Full name, Email, Password, Access token (lock icon prefix, `OC-XXXX-XXXX` placeholder), School role (Select dropdown). "Register" CTA, link to sign in.

### /dashboard
- Top stats row (3 cards using shadcn `Card`): Court Status (current booking name, booked by, time range, "ends in X min", "In use" badge), Today's Bookings (count + delta vs yesterday), Available Slots (count + of total)
- Weekly court usage bar chart using shadcn `ChartBar` (Mon–Sun, current day highlighted, others muted)
- Upcoming today list (right column): event name, time range, professor — each item as a `Card` with a left border accent

### /calendar
Weekly grid view (Mon–Sun columns, hourly time slots from 07:00). Booking cards sit inside the grid cells, sized proportionally to duration, with a left border accent. Right-click on any booking opens a shadcn `ContextMenu` with "Edit booking" and "Delete booking" (destructive). "+ New Booking" button (top-right) opens a shadcn `Dialog` with: event title input, date picker, time range picker, optional notes textarea, Cancel + Save Booking actions.

### /collaborators
shadcn `Table` with columns: Name (avatar initials + full name), Role (shadcn `Badge`), Email, Actions (edit icon button + delete icon button). Top-right: shadcn `Input` for search + "+ Add collaborator" `Button` that opens a `Dialog`. Role badge variants: Principal (default/green), Teacher (secondary/gray), Student Rep (outline/blue). Principal row has no delete button.

### /settings
Left sub-nav using shadcn `Tabs` or a vertical nav list. Sections rendered as `Card` panels:
- **Profile**: Full name input, Email input, New password input (blank = keep current), Save changes button
- **Authorization token**: Read-only masked input (`OC-****-****`), shadcn `Alert` with warning copy "Issued by the principal. This field cannot be edited by users."
- **Notifications**: "Email on new booking" and "Email on booking changes" — each as a labeled shadcn `Switch`

> Remove the Appearance/Theme section entirely since the app is light mode only.

---

## Data Model

### `users`
```
id          uuid (PK)
full_name   text
email       text (unique)
role        enum: 'principal' | 'teacher' | 'student_rep'
school_id   uuid (FK → schools)
created_at  timestamptz
```

### `schools`
```
id            uuid (PK)
name          text
access_token  text (unique) — format OC-XXXX-XXXX, issued by principal
created_at    timestamptz
```

### `bookings`
```
id          uuid (PK)
title       text
school_id   uuid (FK → schools)
booked_by   uuid (FK → users)
date        date
start_time  time
end_time    time
notes       text (nullable)
created_at  timestamptz
```

---

## Business Rules

1. **Access token required on register.** A new user can only sign up if they provide a valid `access_token` matching a school record. This links them to that school.

2. **Role hierarchy:**
   - `principal` — full admin: add/remove any user, edit any booking, manage access tokens
   - `teacher` — create, edit, delete their own bookings; view all bookings
   - `student_rep` — same as teacher

3. **Principal is protected.** No delete action is shown for the principal's row in Collaborators.

4. **No booking overlap.** Bookings for the same school on the same date cannot have overlapping time ranges. Enforce at DB level (exclusion constraint) and in the UI (conflict warning before save).

5. **Access token is school-scoped.** One token per school. Principal sees it unmasked in Settings; all other users see it masked and read-only.

6. **Booking ownership.** Only the booking owner or a principal can edit or delete a booking.

---

## File Structure (suggested)

```
app/
  (auth)/
    login/page.tsx
    register/page.tsx
  (app)/
    layout.tsx          ← sidebar-07 shell
    dashboard/page.tsx
    calendar/page.tsx
    collaborators/page.tsx
    settings/page.tsx
components/
  ui/                   ← shadcn auto-generated
  calendar/
    WeekView.tsx
    BookingCard.tsx
    NewBookingModal.tsx
    BookingContextMenu.tsx
  dashboard/
    StatsRow.tsx
    WeeklyChart.tsx
    UpcomingList.tsx
  collaborators/
    CollaboratorsTable.tsx
    AddCollaboratorDialog.tsx
  settings/
    ProfileForm.tsx
    NotificationsPanel.tsx
  shared/
    AppSidebar.tsx
    UserAvatar.tsx
    RoleBadge.tsx
lib/
  supabase/
    client.ts
    server.ts
  auth.ts
  bookings.ts
  collaborators.ts
types/
  index.ts
```
