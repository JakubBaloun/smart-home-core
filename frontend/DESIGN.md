# Nexus — design system

Frontend pro domácí hub běžící na nástěnných tabletech. Vizuální směr: „tichý domácí
přístroj" — teplý grafit (dark) / neutrální šedá (light) se sytějším kontrastem, elektricky
modrý akcent (Volt), kruhový motiv (Nexus ring).

## Tokeny

Všechny barvy jsou definované jako CSS proměnné v `src/index.css`, per téma v blocích
`[data-theme='dark']` a `[data-theme='light']`. Komponenty nikdy nepoužívají hex hodnoty —
Tailwind má výchozí paletu vypnutou (`--color-*: initial`), takže se zkompilují jen
sémantické utility:

| Utility (`bg-` / `text-` / `border-` …) | Proměnná | Význam |
| --- | --- | --- |
| `surface-sunken` | `--surface-sunken` | pozadí rámu (rail, zapuštěné plochy) |
| `surface` | `--surface` | základní pozadí stránky |
| `surface-raised` | `--surface-raised` | karty, pole |
| `overlay` | `--overlay` | tooltips, vyskakovací vrstvy |
| `line` / `line-strong` | `--line`, `--line-strong` | ohraničení |
| `ink` / `ink-muted` / `ink-faint` | `--ink…` | text: hlavní / vedlejší / potlačený |
| `accent` / `accent-strong` / `accent-ink` | `--accent…` | Volt modrá; `accent-ink` = text na akcentu |
| `ok` | `--ok` | Sage — online, hotovo |
| `cool` | `--cool` | Glacier — obecné grafy, informační |
| `warm` | `--warm` | bývalá Hearth jantar — grafy teploty (aby vysoká teplota nepůsobila "studeně") |
| `danger` | `--danger` | destruktivní akce, chyby |

Písma: `font-display` (Familjen Grotesk — nadpisy), `font-mono` (Spline Sans Mono —
čísla, hodiny, telemetrie; vždy s `tabular-nums`), `font-sans` (system-ui — běžný text).

## Témata

- `<html data-theme="dark|light">` řídí, který blok proměnných platí. Inline skript
  v `index.html` ho nastaví před prvním paintem (localStorage `nexus-theme`,
  fallback `prefers-color-scheme`).
- `ThemeProvider` / `useTheme()` (`src/app/theme.tsx`) atribut jen zrcadlí a přepíná.
- Nové téma = nový blok `[data-theme='…']` v `index.css` se všemi proměnnými;
  komponenty se nemění.
- Recharts neumí CSS proměnné v SVG atributech → `useChartPalette()` vrací
  vypočtené hodnoty a překreslí se při přepnutí tématu.

## Sdílené UI (`src/ui/`)

`Ring` (Nexus ring — logo, spinner, progress), `LiveDot` (plná tečka pro online/offline stav —
`Ring` se pro stav nepoužívá, aby nepůsobil jako spinner), `Button`/`ButtonLink`,
`Chip`/`ChipButton`, `PageHeader` (titulek + hodiny), `Loading`, `icons.tsx`,
`field.ts` (třídy pro inputy).

Motion systém (`src/index.css`): `animate-breathe` (pomalý pulz, `LiveDot` online) a
`animate-fade-slide-in` (vstup karet, se stagger delay přes inline `animationDelay`).

## Moduly a routing

Feature moduly žijí v `src/modules/<název>/` (api/, types/, components/, pages/,
routes.tsx). Modul exportuje `ModuleManifest` (`src/app/modules.ts`):

```ts
export const thingsModule: ModuleManifest = {
  nav: { to: '/things', label: 'Things', icon: IconCube, isActive: (p) => p.startsWith('/things') },
  routes: [{ path: '/things', element: <ThingsPage /> }],
}
```

Registrace = přidání do `shellModules` v `src/app/modules.ts`. Tím modul dostane
položku v levém railu a jeho routy se vykreslí uvnitř `AppShell`.

**Kiosk routy** (cook mode, `src/modules/recipes/cook/routes.tsx`) se do
`shellModules` nepřidávají — skládají se v `src/app/App.tsx` mimo shell, takže
nemají navigační rail a vlastní si celou obrazovku.
