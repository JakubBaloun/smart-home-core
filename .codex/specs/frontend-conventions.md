# Frontend Conventions

> How `frontend/` is actually structured. `frontend/DESIGN.md` is the design-system document
> (tokens, themes, visual direction) and is binding; this spec is the code-structure companion
> to it. Where they overlap, they must agree — update both.
>
> Backend equivalents live in `backend-conventions.md`. Frontend tests are covered in
> `testing-patterns.md`.

## Stack

- React 19 + TypeScript, built by Vite 8
- Routing: `react-router-dom` v7, `useRoutes` (object routes, not JSX `<Route>` trees)
- Styling: Tailwind CSS v4 via `@tailwindcss/vite` — configured **in CSS**, no
  `tailwind.config.js`
- Charts: Recharts
- Lint: `oxlint` (`npm run lint`); tests: Vitest + Testing Library
- No state-management library, no data-fetching library. Polling is a hook (`usePolling`),
  server state is component state.

## Directory layout

```
src/
  api/client.ts          # apiFetch + ApiError — the only place fetch() is called
  app/
    App.tsx              # useRoutes: shell routes + kiosk routes
    AppShell.tsx         # nav rail + <Outlet/>
    modules.ts           # ModuleManifest type + shellModules registry
    theme.tsx            # ThemeProvider / useTheme
  hooks/usePolling.ts    # shared polling hook
  ui/                    # shared presentational primitives
  index.css              # theme blocks + Tailwind theme wiring
  modules/<name>/
    api/                 # typed calls built on apiFetch
    components/          # module-local components
    pages/               # route-level components
    types/               # wire types for this module
    routes.tsx           # ModuleManifest export
```

- `@/` is an alias for `src/` (`vite.config.ts` → `resolve.alias`). Cross-module and shared
  imports use it (`@/ui/icons`, `@/api/client`); imports inside a module stay relative
  (`./pages/TemperaturePage`).
- A module never imports from another module's internals. Shared code moves to `src/ui/`,
  `src/hooks/` or `src/api/`.
- `lib/` and `cook/` exist under `modules/recipes/` as needed; add subfolders per module rather
  than growing a global `utils/`.

## Modules and routing

A module exports a `ModuleManifest` from its `routes.tsx`:

```tsx
export const temperatureModule: ModuleManifest = {
  nav: {
    to: '/temperature',
    label: 'Temperature',
    icon: IconThermometer,
    isActive: (pathname) => pathname.startsWith('/temperature'),
  },
  routes: [{ path: '/temperature', element: <TemperaturePage /> }],
}
```

Registration is adding it to `shellModules` in `src/app/modules.ts`. That single array
determines both the nav rail order and the routes rendered inside `AppShell` — there is no
second place to update.

### Kiosk routes are composed outside the shell

Cook mode (`src/modules/recipes/cook/`, routes under `/cook/*`) is **not** in `shellModules`.
It is spread into `useRoutes` separately in `App.tsx`:

```tsx
const element = useRoutes([
  { element: <AppShell />, children: shellModules.flatMap((m) => m.routes) },
  ...cookRoutes,
])
```

That is what gives it the full screen with no nav rail and no app header. New kiosk-style
screens follow the same pattern: a separate route array, spread as a sibling of the `AppShell`
entry — never a manifest with the chrome hidden by CSS.

No shared navigation means no browser chrome either: the tablet runs `chromium --kiosk`, with no
address bar and no back button. So every kiosk *entry* screen must carry exactly one deliberate
way out — `CookPickerPage` links back to `/`, `CookRecipeDetailPage` links back to `/cook`. A
single small link in the top-left, not a rail.

Screens in the middle of a task are the exception: `CookStepsPage` keeps zero chrome on purpose,
so a mistimed tap cannot drop the user out of a step mid-cook. Its only way back is the explicit
`Recipe list` control in `CookNav`. The rule is *prevent accidental exit*, not *prevent exit*.

## Colors and tokens

Colors are CSS variables in `src/index.css`, defined once per theme in `[data-theme='dark']`
and `[data-theme='light']` blocks, then exposed to Tailwind through `@theme inline`.

**The default Tailwind palette is deliberately wiped** (`--color-*: initial` in `@theme`), so
only semantic utilities compile: `bg-surface`, `bg-surface-raised`, `bg-surface-sunken`,
`text-ink`, `text-ink-muted`, `text-ink-faint`, `border-line`, `border-line-strong`,
`text-accent`, `bg-accent`, `text-accent-ink`, `text-ok`, `text-cool`, `text-danger`,
`bg-overlay`.

Rules:

- **No hex or `rgb()` values outside the `[data-theme]` blocks in `src/index.css`.** A hardcoded
  color does not respond to the theme switch, which is the whole point of the system.
- `bg-blue-500` and friends do not exist. If a utility silently does nothing, that is why.
- A new color is a new variable in *every* theme block plus an `@theme inline` mapping — never
  a one-off value in a component.
- SVG/`Ring` colouring goes through `currentColor`, so the parent's `text-*` drives it.
- **Recharts cannot read CSS variables from SVG attributes.** Use `useChartPalette()`, which
  returns computed values and re-renders on theme change. Do not pass `var(--accent)` to a
  Recharts prop.

Fonts: `font-display` (headings), `font-mono` (numbers, clocks, telemetry — always with
`tabular-nums`), `font-sans` (body).

## Shared UI (`src/ui/`)

`Ring`, `Button`/`ButtonLink`, `Chip`/`ChipButton`, `PageHeader`, `Loading`, `icons.tsx`,
`field.ts`. Reuse these instead of writing one-off markup.

`Ring` is the signature element and is deliberately overloaded — logo, loading spinner, active
nav indicator, availability dot, timer progress. Its modes are distinct and must stay visually
distinct in use:

| Mode                       | Props                        |
| -------------------------- | ---------------------------- |
| Static mark (78% arc)      | defaults                     |
| Loading                    | `spinning`                   |
| Progress (full track + arc)| `progress={0..1}`            |

A status indicator must never be rendered with `spinning` — see the checklist below.

`Button` sizes are `sm` = `min-h-10` (40px), `md` = `min-h-12` (48px), `lg` = `min-h-14`
(56px). The app runs on wall-mounted tablets, so `sm` is **below the 44px touch minimum** —
use it only for pointer-only or non-primary affordances, and default to `md` for anything
meant to be tapped.

## API layer

`src/api/client.ts` owns `fetch`. Module API files build on `apiFetch<T>`:

- Paths are passed **without** the `/api` prefix — `apiFetch('/devices')` hits `/api/devices`.
  Vite proxies `/api` to `localhost:8081` in dev; nginx proxies it to `smart-home-app:8081` in
  production.
- Non-2xx throws `ApiError` carrying `status`. Handle it by status, not by message text.
- 202 and 204 resolve to `undefined` — commands and deletes return nothing.
- **Wire types are camelCase**, matching the backend's Jackson-compatible schemas. Declare them
  in `modules/<name>/types/` and do not rename fields on the way in.
- Datetime fields arrive as strings in two different fraction formats (see the parity contract
  in `architecture-patterns.md`). Parse them; never assume a fixed digit count.

## Review checklist

> Deliberately identical to the checklist in `.codex/agents/ux-reviewer.md`. The agent and the
> spec must say the same thing — change both together. Run through it yourself before handing
> work to review.

- **Status indicators must not look like loading spinners.** A `Ring` used for
  online/offline/availability must be visually distinguishable from a `Ring` in `spinning`
  mode used for actual loading state. If they look the same, it's a bug.
- **The accent color must actually appear**, not just exist as a token. Check that active
  navigation state, primary actions, and key status actually apply `text-accent`/
  `bg-accent`/the active `Ring` treatment — not just that the CSS variable is defined.
- **Icons must be specific to the entity, not generic fallbacks.** If multiple different
  device/content types render the same icon, that's very likely an unmapped fallback, not
  a design choice — verify against the actual type→icon mapping.
- **Touch targets ≥ 44px** on anything reachable from a wall-mounted tablet — check
  `Button`'s `sm` size and any bespoke touch targets against this.
- **Cook mode routes have zero shared-shell chrome** — no nav rail, no app-level header —
  verify by checking `App.tsx` composition, not just visually.
- **No hardcoded hex/rgb colors** outside `src/index.css` theme blocks — grep for them.
- **Layout doesn't leave large unexplained empty regions** on realistic content volumes —
  flag if a grid/list looks sparse with a normal amount of data.

## Before calling frontend work done

```bash
cd frontend && npm run lint && npm test && npm run build
```

Type errors surface in `npm run build` (`tsc -b`), not in Vitest — running only the tests is
not enough.
