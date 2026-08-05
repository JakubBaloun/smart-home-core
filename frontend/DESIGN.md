# Nexus — design system

Frontend pro domácí hub běžící na nástěnných tabletech.

## Vize

Základní filozofie zůstává „tichý domácí přístroj" — funkční, čitelný, bez zbytečného
plesu. Ale volba tématu je uživatelova: Nexus nabízí pět variant (jedno světlé, čtyři tmavé)
a každá tmavá varianta smí nést vlastní vizuální podpis — glow, gradient, glass, grain — pokud
dodrží dva závazné kontrakty:

1. **Tokenový kontrakt** — každé téma deklaruje stejnou sadu 17 sémantických proměnných
   (viz Tokeny) se stejným *významem*, jen s jinými hodnotami.
2. **Kontrastní kontrakt** — WCAG AA prahy (viz Kontrastní kontrakt) platí pro každou novou
   variantu bez výjimky.

V mezích těchto dvou kontraktů je vizuální identita tématu volná. „Tichý přístroj" tedy
neznamená „všechna témata vypadají stejně" — znamená „žádné téma nepůsobí rozbitě nebo
nečitelně".

## Tokeny

Všechny barvy jsou definované jako CSS proměnné v `src/index.css`, per téma v blocích
`[data-theme='<id>']` (pět bloků, viz Témata). Komponenty nikdy nepoužívají hex hodnoty —
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
| `accent` / `accent-strong` / `accent-ink` | `--accent…` | primární/interaktivní barva; `accent-ink` = text na akcentu |
| `ok` | `--ok` | úspěch, online, hotovo |
| `cool` | `--cool` | obecné grafy, informační série |
| `warm` | `--warm` | teplota (záměrně teplá barva, aby vysoká teplota nepůsobila „studeně") |
| `danger` | `--danger` | destruktivní akce, chyby |
| `extreme` | `--extreme` | vrchol progresivní závažnosti (např. extrémní teplota v grafu) |

To je 17 proměnných celkem. **Sémantika je napříč všemi tématy pevná** — `ok` vždy znamená
úspěch/online, `cool` vždy obecnou datovou řadu, `warm` vždy teplotu, `danger` vždy
destruktivní/chybový stav, `extreme` vždy vrchol závažnosti, `accent` vždy interaktivní prvek.
Nové téma smí měnit *hodnoty*, nikdy *význam* — komponenta se tedy nikdy nerozhoduje podle
aktivního tématu, jen podle sémantiky.

Písma: `font-display` (Familjen Grotesk — nadpisy), `font-mono` (Spline Sans Mono —
čísla, hodiny, telemetrie; vždy s `tabular-nums`), `font-sans` (system-ui — běžný text).
Sada fontů je společná pro všechna témata, neliší se.

## Témata

| id | Label | Mode | Vizuální podpis | Doporučené použití |
| --- | --- | --- | --- | --- |
| `light` | Light | light | flat, neutrální šedá | denní/venkovní světlo, tablet na přímém slunci |
| `graphite` | Graphite | dark | flat, teplý grafit (výchozí tma) | univerzální, výchozí volba |
| `obsidian-aurora` | Obsidian Aurora | dark | studený, vysoký kontrast; radiální gradient pozadí + glow na akcentu | noční provoz, důraz na čitelnost a klid |
| `amber-forge` | Amber Forge | dark | teplý, industriální, sytější grafit | útulnější/teplejší prostředí (kuchyň, obývák) |
| `midnight-chrome` | Midnight Chrome | dark | chladná ocel; glass/blur panely, jemný grain, chrome hrana | moderní/technický vzhled |

- `<html data-theme="…">` řídí, který blok proměnných platí. Inline skript
  v `index.html` ho nastaví před prvním paintem — čte `localStorage['nexus-theme']`
  (legacy hodnota `'dark'` se tiše mapuje na `'graphite'`), s fallbackem na
  `prefers-color-scheme` (`light` → `light`, jinak `graphite`) pro neznámou/chybějící hodnotu.
- `ThemeProvider` / `useTheme()` (`src/app/theme.tsx`) provede stejnou logiku a atribut jen
  zrcadlí a přepíná přes `setTheme(id)`; `THEMES` v témže souboru je autoritativní katalog
  pěti témat (id, label, mode) — zdroj pro `ThemePicker` i pro tuto tabulku.
- Nové téma = nový blok `[data-theme='…']` v `index.css` se všemi 17 proměnnými;
  komponenty se nemění (viz checklist níže).
- Recharts neumí CSS proměnné v SVG atributech → `useChartPalette()` (`theme.tsx`) vrací
  vypočtené hodnoty přes `getComputedStyle` a překreslí se při přepnutí tématu.

## Kontrastní kontrakt

Platí pro `ink` na tmavém/světlém pozadí a pro sémantické barvy na `surface`. Prahy jsou
závazné **pro každou novou variantu** (Obsidian Aurora, Amber Forge, Midnight Chrome).
Graphite a Light si drží svoje původní hodnoty beze změny (viz Global Constraints v plánu
implementace) — jejich dva historické podprahové případy jsou zdokumentované níže jako
mimo rozsah, ne jako regrese nového kontraktu.

- `ink` na `surface` ≥ 4.5:1
- `ink` na `surface-raised` ≥ 4.5:1
- `ink-muted` na `surface` ≥ 4.5:1
- `accent-ink` na `accent` ≥ 4.5:1
- `accent` na `surface` ≥ 3:1
- `danger` a `extreme` na `surface` ≥ 3:1
- `ok`, `cool`, `warm` na `surface` ≥ 3:1

Naměřené poměry (sRGB relativní luminance, standardní WCAG vzorec):

| Pár | Práh | Graphite | Light | Obsidian Aurora | Amber Forge | Midnight Chrome |
| --- | --- | --- | --- | --- | --- | --- |
| ink / surface | 4.5:1 | 16.77:1 | 15.45:1 | 17.39:1 | 16.52:1 | 16.16:1 |
| ink / surface-raised | 4.5:1 | 15.07:1 | 16.88:1 | 16.12:1 | 15.22:1 | 14.67:1 |
| ink-muted / surface | 4.5:1 | 7.50:1 | 6.53:1 | 8.89:1 | 8.94:1 | 8.69:1 |
| accent-ink / accent | 4.5:1 | 4.94:1 | 6.41:1 | 4.54:1 | 8.25:1 | 7.21:1 |
| accent / surface | 3:1 | 3.62:1 | 5.78:1 | 4.54:1 | 8.25:1 | 6.94:1 |
| danger / surface | 3:1 | 5.03:1 | 4.98:1 | 6.15:1 | 4.75:1 | 5.29:1 |
| extreme / surface | 3:1 | 2.58:1 ⚠︎ | 8.89:1 | 3.49:1 | 3.12:1 † | 3.14:1 † |
| ok / surface | 3:1 | 7.15:1 | 4.23:1 | 11.33:1 | 8.99:1 | 8.21:1 |
| cool / surface | 3:1 | 8.04:1 | 4.29:1 | 10.93:1 | 8.08:1 | 9.04:1 |
| warm / surface | 3:1 | 8.56:1 | 2.94:1 ⚠︎ | 9.75:1 | 9.66:1 | 8.78:1 |

- ⚠︎ **Graphite `extreme` (2.58:1) a Light `warm` (2.94:1)** jsou pod 3:1 — pre-existující
  hodnoty z doby před tímto kontraktem, ponechané beze změny podle Global Constraints
  („Graphite a Light si drží přesné současné hodnoty, byte-for-byte"). Mimo rozsah této
  práce; případná oprava je samostatný úkol (týkal by se `extreme`/`warm` u obou původních
  témat, ne jen nových variant).
- † **Amber Forge a Midnight Chrome `extreme`** projdou 3:1 jen s tenkou rezervou (3.12:1 a
  3.14:1, tj. +0.12 až +0.14). Obě hodnoty vzešly z ladění sytosti/odstínu beze změny (jen
  zvýšením HSL lightness) z návrhových hodnot, které pod 3:1 propadaly (`#9c1c1c` → 2.39:1,
  `#b31e2f` → 2.87:1). Označeno jako křehké — při budoucí úpravě `--surface` nebo `--extreme`
  u těchto dvou variant přeměřit.

Naměřené hodnoty jsou zapsané i jako komentáře přímo u `[data-theme='…']` bloků
v `index.css`.

## Opt-in efekty

Efekty jsou aditivní CSS utility, defaultně no-op (plochá/neviditelná varianta), takže jsou
bezpečné i pod tématy, která se k nim nehlásí. Komponenta jen přidá třídu — nikdy nezjišťuje
aktivní téma a nikdy neobsahuje hex.

| Utilita | Default (no-op) | Aktivní pod | Efekt |
| --- | --- | --- | --- |
| `.glow-accent` | `box-shadow: 0 0 0 0 transparent` | Obsidian Aurora | halo kolem akcentové barvy (`box-shadow` z `color-mix` s `--accent`) |
| `.glass` | `background: var(--overlay)` (plná výplň) | Midnight Chrome | `backdrop-filter: blur(12px)` + poloprůhledný `--overlay` |
| `.chrome-edge` | žádný (bez efektu mimo variantu) | Midnight Chrome | jemný `inset` horní highlight |
| `[data-theme='…'] body` gradient | plné `--surface` | Obsidian Aurora | radiální gradient `surface-raised → surface-sunken → surface` za celou aplikací |
| `[data-theme='…'] body::before` grain | žádný | Midnight Chrome | jemná dlaždicová šumová textura (`public/assets/noise.svg`, opacity 0.04) |

Pravidlo beze zbytku: **efekt žije v `index.css` pod `[data-theme='…']`, komponenta přidává
jen název třídy.** Žádný hex, žádná podmínka na jméno tématu v `.tsx` souboru — nikdy.

## Přidání dalšího tématu

1. Nový `[data-theme='<id>']` blok v `src/index.css` se všemi 17 tokeny (zkopírovat existující
   blok jako šablonu, přepočítat kontrast — netipovat, ne oči).
2. Nová položka `{ id, label, mode }` do `THEMES` v `src/app/theme.tsx`.
3. `<id>` přidat do `KNOWN` pole v inline skriptu v `index.html`.
4. `.theme-swatch-<id>` utilita v `index.css` (dvoutónová ukázka pro `ThemePicker`).
5. Nový řádek do kontrastní tabulky výše (a komentář s naměřenými poměry přímo u bloku
   v `index.css`).
6. `npm test` — `tokens.test.ts` ověří, že blok má všech 17 proměnných a že se shoduje
   s `THEMES`; `prepaint.test.ts` a `theme.test.tsx` ověří chování pre-paint skriptu a
   providera.

## Sdílené UI (`src/ui/`)

`Ring` (Nexus ring — logo, spinner, progress), `LiveDot` (plná tečka pro online/offline stav —
`Ring` se pro stav nepoužívá, aby nepůsobil jako spinner), `Button`/`ButtonLink`,
`Chip`/`ChipButton`, `PageHeader` (titulek + hodiny), `Loading`, `icons.tsx`,
`field.ts` (třídy pro inputy). `ThemePicker` (`src/app/ThemePicker.tsx`) je výběr tématu
v navigačním railu — menu se všemi položkami `THEMES`, každá s `theme-swatch-<id>` ukázkou.

Motion systém (`src/index.css`): `animate-breathe` (pomalý pulz, `LiveDot` online) a
`animate-fade-slide-in` (vstup karet, se stagger delay přes inline `animationDelay`). Motion
je společný napříč tématy, neliší se.

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
