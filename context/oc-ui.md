# OpenCourt — UI Context

## Design direction

Sober and professional, in the spirit of Notion/Linear: mostly-neutral palette,
generous whitespace, 1px borders instead of floating shadows, clear type
hierarchy, comfortable information density. **Accent color is used sparingly**
— only for primary actions, focus rings, live/state indicators, links, and
charts. Navigation active states, avatars, and decorative elements stay
neutral. **Gradients are allowed, but sparingly and tastefully** — only when they
are subtle, derived from the theme tokens (not arbitrary hues), and genuinely
additive on a deliberate accent surface. Sanctioned uses today: the login hero
panel (`from-chart-3 via-primary to-chart-5` + a `black/60` legibility scrim) and the
weekly-chart dot-matrix backdrop (`radial-gradient` of `--muted-foreground` at low
opacity). (The former "Nova reserva" button sheen was removed — primary CTAs are now
a flat solid `--btn` fill; see Buttons.) The bar to add a new one: it must read as part of the same engineered,
minimalist material — no loud multi-hue ramps, no gradients on content/data
surfaces (cards, tables, list rows), and never as a substitute for a solid token.
Still banned outright: glassmorphism, glow, and emojis.

## Theme

- **Mode:** light / dark / system. An inline script in `app/layout.tsx` applies the stored theme class before first paint (no flash); `components/shared/theme-provider.tsx` manages it afterwards and follows OS changes live when "system" is selected. Selector UI lives in Settings → Appearance.
- **Native controls:** `globals.css` sets `color-scheme: light` on `:root` and `color-scheme: dark` on `.dark`, so browser-rendered UI (the `<input type="date">` / `type="time"` picker icons + popups in the booking dialog, scrollbars, the Big Calendar's native bits) matches the active theme instead of defaulting to light.
- **Pure monochrome grayscale (chroma 0, no hue).** Surfaces *and* the accent are neutral grays, so `--primary` reads as a "dark/light UI element", not a brand color — fitting a utility scheduling tool. No blue/teal tint anywhere.
  - `--primary`: `oklch(0.40 0 0)` (light) / `oklch(0.72 0 0)` (dark). **Contrast note:** light mode = dark primary + near-white `--primary-foreground`; dark mode = light primary + **dark** `--primary-foreground` (`oklch(0.20 0 0)`) — white-on-0.72 fails WCAG AA, so the foreground flips. Both pairings clear AA (~6:1). `--primary` is for low-emphasis accents (sidebar mark, `/10` tinted chips), **not** the solid CTA fill — that's `--btn` (see Buttons).
- **Neutral scale (chroma 0).** Light: `--background oklch(0.99 0 0)`, near-white cards `oklch(0.995 0 0)`, `--sidebar oklch(0.97 0 0)`, `--border oklch(0.91 0 0)`. Dark: `--background oklch(0.16 0 0)`, cards `0.21`, sidebar `0.185`, hairline borders `oklch(1 0 0 / 8%)`.
- **Status tokens:** `--success`, `--warning`, `--destructive` — desaturated semantic hues, **kept separate from the monochrome** (folding them in would kill error/warning/success signaling). Light + dark variants. Usage: `bg-success/10 text-success`. Never hardcode palette colors (`emerald-*`, `red-*`, etc.). **Contrast:** these are tuned so the foreground (`text-success`/`text-warning`/`text-destructive`) clears WCAG AA (4.5:1) **as small badge text on its own `/10`–`/15` tint** — the most demanding use. Light `--success`/`--warning` were darkened (L 0.55→0.51, 0.62→0.52) for this; the original lighter values failed (~4.2:1 / ~3.4:1). When editing a status token, re-check the `text-* on bg-*/10` ratio, not just the solid fill.
- **Charts:** `--chart-1..5` is a grayscale ramp (L 0.80→0.40, chroma 0), same in both modes.
- **Focus ring:** `--ring` is a neutral gray (chroma 0) at 50–60% alpha.
- **CSS:** Tailwind v4 via `@import "tailwindcss"` in `app/globals.css`; imports `tw-animate-css` + `shadcn/tailwind.css`.
- **Radius:** `0.5rem` base. **Buttons and inputs are pills** (`rounded-4xl`); cards `rounded-xl`, badges `rounded-md`. The pill radius is shared by buttons + inputs so they stay visually paired.
- **Surfaces:** cards are `border border-border bg-card`, shadow-free. The app content area sits on `bg-sidebar` so white cards read as quiet panels.

---

## Buttons (`components/ui/button.tsx`)

`cva` variants, all pill-shaped (`rounded-4xl`), with `shadow-xs`/`-sm` for a solid, raised feel:

- **`default`** — the solid high-contrast CTA. Fills with the dedicated **`--btn`** token: a rich **off-black** `oklch(0.21 0 0)` (light) / **off-white** `oklch(0.93 0 0)` (dark) — deliberately *not* `#000`/`#fff`, so it reads bold and professional without harshness (~16:1 light, ~15:1 dark). `text-btn-foreground`, `shadow-sm`, subtle `hover:bg-btn/90` + `active:scale-[0.98]`. `--btn` is decoupled from `--foreground` so the dark value can be softened from near-white. No sheen/shimmer.
- **`secondary`** — filled neutral (`bg-secondary` + `border-border` + `shadow-xs`); visible on every surface in both themes.
- **`outline`** — bordered; transparent over light surfaces, but lifts off the near-black page in dark via `dark:bg-secondary/40` so it never reads as a floating outline. `hover:bg-muted`.
- **`ghost`** — text-only, `hover:bg-muted`; for icon buttons / toolbars.
- **`destructive`** — soft tinted danger (`bg-destructive/10 text-destructive` + tinted border), not a loud solid red; text clears AA on the tint.
- **`link`** — `text-foreground` underline.

**Rule:** never hardcode `white`/`black`/`#fff`/`#000` in button styles — use the tokens (`--btn`, `--foreground`, `--secondary`, `--destructive`, …). The primary CTA's contrast is intentionally high, but tuned via `--btn`, never pure black/white.

---

## Font

- **DM Sans** via `next/font/google`
- CSS variable: `--font-dm-sans`, mapped to `--font-sans`/`--font-heading` in `@theme inline` (globals.css)
- Applied as both `variable` (for CSS var) and `className` (on `<body>`)

---

## App icon

- Browser tab / PWA icon: `app/icon.png` (512×512) + `app/apple-icon.png` (180×180),
  auto-detected by the Next.js App Router (no manual `<link>` / metadata needed). The
  stock `app/favicon.ico` was removed. Source art: a monochrome blue-gray basketball-court
  mark — also the seed for the slate `--primary`.
- **Scope:** this is the favicon/app icon only. The in-app SVG logo components
  (`components/shared/oc-logo.tsx` — `OpenCourtLogo` / `OpenCourtMark`) are **unchanged**;
  they remain the source of truth for the sidebar/auth-page wordmark and stay crisp/themeable.

## Icons

- **Primary:** Remixicon (`@remixicon/react`) — `Ri*` components
- **Secondary:** Lucide React (`lucide-react`) — for shadcn auto-generated components
- Sidebar nav: `RiDashboardLine`, `RiCalendarCheckLine`, `RiTeamLine`
- Auth forms: `RiLockLine` (access token), `RiArrowUpDownLine` (user dropdown), `RiSettingsLine`, `RiLogoutBoxLine`

---

## Sidebar (`components/app-sidebar.tsx`)

- `collapsible="icon"` — collapses to icon-only mode
- **Placement convention:** workspace context at the top, personal account at the
  bottom — the Notion/Linear/Slack/Vercel pattern. For a multi-school product the
  active-school context is the primary orientation, so the school switcher leads and
  doubles as branding (no standalone product logo in the sidebar). The account lives
  only here — there is no user menu in the top header bar (it carries title/CTA only).
- **Header:** `NavSchoolSwitcher` — `OpenCourtMark` in a rounded square + active
  school name + role + `RiExpandUpDownLine`; collapses to the mark only in icon mode.
  Dropdown opens **downward** (`side="bottom"`): Schools list (`RiCheckLine` on active)
  + "Create organization". `NavRowSkeleton` placeholder while data loads.
- **Nav:** `NavMain` with 3 items — Dashboard (`RiDashboardLine`), Calendar (`RiCalendarCheckLine`), Collaborators (`RiTeamLine`). Court management is **not** a nav item — it lives in Settings → Courts (principal-only section).
- **Footer:** `NavUser` — avatar (initials) + name + role; collapses to avatar-only in
  icon mode; dropdown opens to the side (`side="right"`) with Settings + Log out.
  `NavRowSkeleton` placeholder while the profile loads.
- `SidebarRail` for manual resize handle

## `components/nav-main.tsx`

- Flat links (no collapsible groups)
- Active detection via `usePathname()`:
  - Exact match: `pathname === item.url`
  - Prefix match: `pathname.startsWith(item.url + '/')`
- Uses `Link` from Next.js inside `SidebarMenuButton`

## `components/nav-user.tsx`

- Props: `{ name: string, email: string, role: Role, avatarUrl?: string | null }`
- Renders `AvatarImage` when `avatarUrl` is set, falling back to initials (first
  two characters of name, uppercase). `avatarUrl` is the uploaded photo
  (email+password users) or the Google identity photo, resolved in `app-sidebar.tsx`.
- DropdownMenu:
  - Label: avatar + name + email
  - Settings: Link to `/settings`
  - Log out: calls `signOut()` server action, then `window.location.href = '/login'`

---

## shadcn/ui Components Installed

All inside `components/ui/` — auto-generated by `shadcn` CLI, customized for Radix Maia style:

`alert`, `alert-dialog`, `avatar`, `badge`, `breadcrumb`, `button`, `card`, `chart`, `collapsible`, `context-menu`, `dialog`, `dropdown-menu`, `field`, `input`, `label`, `select`, `separator`, `sheet`, `sidebar` (705 lines, core), `skeleton`, `switch`, `table`, `tabs`, `textarea`, `tooltip`

---

## Hooks

### `hooks/use-mobile.ts`
- Detects mobile via `matchMedia('(max-width: 768px)')`
- Used by shadcn sidebar for responsive behavior
