# Match Sketch — Visual Theme Design

Date: 2026-11-21. Status: draft for the user's review.
Parent spec: `2026-11-21-match-sketch-design.md` (this document adds the app's look; it does not change the stage drawing or print rules there).

## 1. What this is and why

Match Sketch should look fun and borrow from current tactical product styling: big, eye-catching varsity lettering over a trendy camouflage pattern, like the sunshirt the user shared (a brown/mauve tiger stripe with a bold white-and-black logo). The audience is match directors and shooters in practical shooting, who know military camouflage well and will notice fakes.

Each user picks a **theme** for the app: a solid color, a plaid, or an authentic military camouflage pattern. Headings and buttons use a sporty, varsity/football look: big blocky letters, white fill, black outline. Buttons are large enough for fingers, ready for the later mobile phase. Styling moves to **Tailwind CSS**.

## 2. Goals, non-goals, anti-goals

### Goals

1. A theme picker with three families: **solid**, **plaid**, **camo**. The choice applies across the whole app immediately.
2. Camo themes that are **authentic** reproductions of real issued patterns, in rich, fabric-like colors.
3. Varsity type: a heavy outlined wordmark, outlined panel titles, outlined button labels.
4. Touch-friendly controls: every button and toggle at least 44 × 44 px.
5. One styling system: every component styled with Tailwind; the current per-component CSS is migrated.
6. Works offline: fonts and pattern tiles ship with the app.

### Non-goals (for now)

- Theming the stage (bay, grid, objects) or anything printed. Both stay white and plain (user decision).
- An aerial photo underlay on the stage (recorded as post-MVP in the parent spec §10).
- A phone layout. Controls are sized for touch now; the mobile layout is a later phase.
- Dark mode.

### Anti-goals (a failure even if it works)

- Camo that looks fake or "inspired by". The user rejected procedurally generated camo for this reason.
- Shipping artwork we have no right to ship. The repo is **public**, so every committed asset must be public domain, openly licensed for commercial use, our own work, or licensed for use in an app.
- Using restricted patterns: MultiCam (Crye Precision), OCP (US Army, government use only), MARPAT (USMC), AOR1/AOR2 (US Navy), CADPAT (Canada), MTP (UK).
- Text that is hard to read because it sits on a busy pattern.
- Heavy assets that slow the app: each pattern tile should stay well under 250 KB.

## 3. Constraints

- SvelteKit 3, Svelte 5 runes, TypeScript (parent spec §3). Svelte files go through the Svelte MCP autofixer (project convention).
- **Tailwind CSS 4.3** through `@tailwindcss/vite` (supports the project's Vite 8). Configuration is CSS-first (`@theme` in `app.css`); no `tailwind.config.js`.
- Offline: the font comes from `@fontsource/graduate` (OFL-1.1), self-hosted. Pattern tiles are static files.
- Existing e2e test ids, roles, and accessible names stay unchanged during the migration.
- Licenses: the UK Open Government Licence requires an attribution statement; CC BY-SA (if ever used) requires share-alike on the derived tile. Credits must be shown in the app.

## 4. Approaches considered

**Styling and theme switching**

| Approach | Verdict |
| --- | --- |
| **Tailwind 4 with CSS variables per theme, switched by `data-theme` on `<html>`** (`@theme inline` maps utilities to the variables) | **Chosen.** Tailwind's documented pattern for runtime themes; switching is instant, no reload, one stylesheet. |
| One stylesheet per theme, loaded on demand | Rejected: more files, slower switching, no benefit. |
| A component kit (e.g. shadcn-svelte) | Rejected: its look fights the varsity style, and only about seven custom pieces are needed. |
| Tailwind 3 (`tailwind.config.js`) | Rejected: superseded by v4's CSS-first config. |

**Where the camo comes from** (the user chose the last row)

| Approach | Verdict |
| --- | --- |
| Generate camo procedurally | Rejected by the user: looked fake. |
| Buy stock vectors | Rejected: few listings are faithful or name the real pattern; web-app use needs extended licenses ($24–$249 per item on Creative Market); Adobe Stock's Standard license is unclear about artwork shipped inside an app's UI. |
| Scan real fabric | Viable and cleanest for rights, but the user preferred working from images online. Still the fallback for any pattern without a usable image. |
| **Trace authentic reference images with clear rights into seamless vector masters, then render small WebP tiles** | **Chosen.** Proven in a throwaway spike on M81 (from the ERDL swatch), DPM, and tiger stripe. |

## 5. Decisions made with the user

- **Where the theme shows (option A):** the top bar, panel title strips, plan-card headers, and primary buttons. Lists, forms, dialogs' bodies, the stage, and printouts stay white.
- **Button rule:** white buttons on patterned bars; patterned primary buttons on white surfaces. 3 px black border, rounded corners, hard 3 px offset shadow, presses down on tap, minimum 44 px tall. Labels in the display font.
- **Display font: Graduate** (varsity/college-jersey block).
- **Wordmark ("bigger and heavier"):** "MATCH SKETCH" drawn as inline SVG text in Graduate at 30 px: a 9 px black outline with round joins (HTML text outlines grow spikes at sharp corners), white letters thickened by a 1.6 px white stroke, and a 5 px offset black block shadow. It has an accessible name.
- **Theme families:** solid, plaid, camo. Plaids are generated from thread-count recipes (arbitrary designs are fine); camo must be authentic.
- **Camo lineup** (all unrestricted, real issued patterns): M81 Woodland, ERDL, Tiger Stripe (Vietnam-era), 6-color desert ("Chocolate Chip"), 3-color desert (DCU), UCP, Flecktarn, Woodland DPM, and **Desert Night Camouflage** (the user's favorite).
- **Color richness:** camo colors are calibrated to look like real fabric, not muted digital swatches. The user picked the richest of three M81 options. **M81 palette:** khaki `#c8ae5c`, green `#336530`, brown `#644c2a`, black `#202927`. Every camo theme is calibrated to the same richness.
- **Tiger stripe target look:** the classic Vietnam-era pattern (olive base, black stripes, small brown and khaki brushstrokes) from the 750 px reference image the user supplied, not the Malaysian variant. The spike traced it into a seamless tile the user approved.
- **Desert Night Camouflage:** **green** palette (light `#939881`, dark `#262a1d`, from the user's first reference; the issued spec calls for a light-green ground). The grid is rebuilt as exact geometry (square cells, about 64% of the period, measured from the user's fabric photo); the rubble shapes are real blobs traced from that photo, **spread evenly** over a large wrap-around tile (64 × 40 cells, about 10% coverage, random quarter-turns and flips) because the photo's own layout looked clustered and repeated too often. Display cell size about 12 px. The user approved this version.
- **Licensing decisions are deferred** by the user (see §8).

## 6. How it works

### 6.1 Theme model

A TypeScript registry, `src/lib/theme/themes.ts`:

```ts
type ThemeFamily = 'solid' | 'plaid' | 'camo';
type Theme = {
	id: string;              // 'm81', 'tiger-stripe', 'coyote', …
	name: string;            // 'M81 Woodland'
	family: ThemeFamily;
	base: string;            // solid fill behind the tile (and the whole look for solids)
	accent: string;          // selection/pressed tint used on white surfaces
	tile?: { src: string; width: number; height: number }; // display size in CSS px
	credit?: string;         // id into the credits list
};
```

`app.css` maps theme variables to Tailwind utilities:

```css
@import 'tailwindcss';
@theme inline {
	--color-theme-base: var(--theme-base);
	--color-theme-accent: var(--theme-accent);
	--font-display: 'Graduate', serif;
}
```

Each theme sets `--theme-base`, `--theme-accent`, `--theme-tile` (a `url()`), and `--theme-tile-size` under `[data-theme='<id>']`, generated from the registry so the two never drift. A `bg-theme` utility (or small component class) paints `background: var(--theme-base) var(--theme-tile) 0 0 / var(--theme-tile-size)`.

### 6.2 Choosing and keeping a theme

- A **Theme** button in the top bar opens a picker: swatches grouped Solid / Plaid / Camo, each a small tile preview with its name; the current one is marked. Choosing applies it at once.
- The choice is a **per-user setting** that applies app-wide, stored on the device (IndexedDB, alongside the existing stores) and later synced with the account (Plan 5). `data-theme` is set before first paint so there is no flash of the default theme.
- **Default theme:** M81 Woodland once cleared (§8); DPM until then.

### 6.3 Themed surfaces

Some surfaces named in §5 don't exist yet; this work creates them:

- **Home page:** a top bar with the full wordmark, a **Theme** button, and the page actions. Plans become **cards** with a patterned header (stage number/name) and a white body (canvas, dimensions); Plan 4 later adds thumbnails to the card bodies. The canvas library stays a white list.
- **Editor:** one top bar, not two. It carries the wordmark at a smaller size (same treatment, about 20 px) as the link back to the plans list, the stage title in outlined type, and the tools. Later plans add tools to this bar; when it gets crowded, the wordmark drops to a compact form first.
- **Side panels:** the symbol palette and the properties panel each get a patterned title strip ("Symbols", "Properties").
- **Dialogs:** patterned header strip, white body.

### 6.4 Shared pieces

`Wordmark`, `Button` (primary / secondary / danger / icon), `PanelHeader` (patterned strip with outlined title), `Field`, `Select`, `Dialog` (patterned header, white body), `Toggle`. Existing screens are rebuilt on these during the migration.

### 6.5 Outlined type

- Panel titles and button labels use a smaller version of the wordmark treatment. For HTML text, the outline is a ring of `text-shadow`s (round, no spikes) plus a block shadow; sizes and thicknesses scale with the font size.
- Only display text is outlined. Body text (lists, fields, help) stays the system font on white.
- Focus rings must be visible on any pattern: a white ring inside a black ring.

### 6.6 Pattern pipeline (repeatable, committed)

A Python tool under `tools/patterns/` (run with `uv`; not part of the app build):

1. **Sources manifest** (`sources.json`): for each camo theme, the source image URL, file page, author, license, and a checksum. The tool downloads sources into a git-ignored cache; source images are not committed.
2. **Color separation:** flat digital swatches map to their exact colors; fabric photos are evened out for lighting, denoised, and split into the pattern's colors (k-means in Lab), with specks removed.
3. **Repeat:** if the source contains a full repeat (detected by autocorrelation, e.g. the ERDL swatch repeats every 1144 px vertically), use it; otherwise make a seamless tile by morphing shapes across each wrap seam (per-color signed distance fields blended over a band).
4. **Calibration:** each pattern's colors are replaced by its calibrated palette (named colors in the manifest), tuned by eye against real-fabric photos to the agreed richness.
5. **Geometric patterns (DNC):** measure the grid (period, cell size) from the source and redraw it exactly; extract the rubble as dark areas thicker than a grid line (distance to the nearest light pixel above a crossing's half-diagonal), keep each blob as a shape, and scatter the library evenly (Poisson-disk on a torus) over a tile that is a whole number of cells, so it is seamless by construction.
6. **Pixel patterns (UCP):** skip tracing and smoothing; detect the pixel grid and rebuild the tile pixel-exact, then scale with nearest-neighbor so the squares stay crisp.
7. **Output:** a seamless vector master (SVG, traced with `vtracer`, kept in the tool's output) and the shipped asset: a WebP tile in `static/themes/<id>.webp`, sized for 2× screens, target ≤ 250 KB.
8. **Plaids:** the same tool renders plaids from thread-count recipes (stripe colors and widths, mirrored setts) with a twill texture, into WebP tiles.

### 6.7 Review gate

Authenticity is the user's call. Every camo tile is shown to the user in a side-by-side preview (reference image, the tile on an app bar, and a repeated area with seam markers) and ships only after approval. A tile whose source rights are cleared but whose result looks weak (e.g. low resolution, a garment crop with folds) waits for a better source instead of shipping.

### 6.8 Credits

An **About & credits** dialog (reachable from the home page and the theme picker) lists each pattern's source, author, and license, including the OGL attribution statement for DPM ("Contains public sector information licensed under the Open Government Licence v1.0"), and the font's OFL license.

### 6.9 Tailwind migration

- Install Tailwind 4.3 + `@tailwindcss/vite`; move the design tokens in `app.css` into `@theme`.
- Convert every component's scoped `<style>` to utility classes (or the shared pieces above). Stage SVG styling (bay, grid, objects) keeps its current look; it may stay as scoped CSS where SVG presentation attributes are clearer.
- Behavior, test ids, and accessible names do not change; the existing unit and e2e suites must pass after each migration commit.

### 6.10 When this happens

This is its own plan, **Plan 1b: Visual theme**, written after Plan 1 finishes (its Tasks 10–12 are built in the current CSS approach and migrated here). It runs before the scale-break spike and Plan 2, so every later plan is written in Tailwind from the start. The roadmap records it.

## 7. Pattern sources (as of 2026-11-21)

| Theme | Source | Rights | Status |
| --- | --- | --- | --- |
| M81 Woodland | Commons: `Brown-dominant "highland" ERDL camouflage pattern swatch.png` (M81 is brown-dominant ERDL enlarged 60%) | Public domain tag | **Proven in spike** |
| ERDL | Same swatch, original scale; green-dominant variant also on Commons | Public domain tag | Ready |
| Woodland DPM | Commons: `DPM Combat 95 Camouflage Material MOD 45149982.jpg` (UK MOD fabric photo) | OGL v1.0 (attribution) | **Proven in spike** |
| UCP | Commons: `Universal Camouflage Pattern swatch.jpg` (US Army) | Public domain | Ready (pixel pattern) |
| 6-color desert | Commons: `Man modelling DBDU in 1976.jpg` (US Army Natick) | Public domain | Needs a crop of the garment |
| 3-color desert (DCU) | Commons: `DCU camo swatch.png`, 800 px | Public domain tag | Ready, low resolution |
| Tiger Stripe | User-supplied reference (750 px), origin unknown | **Unknown** | **Proven in spike**; rights deferred (§8) |
| Flecktarn | Only small or national-variant images found | — | **Needs a source** |
| Desert Night | User-supplied fabric photo (1333 × 2000, rubble and grid) + first reference (color) | **Unconfirmed** (whether the user took the photo) | **Proven in spike**; rights deferred (§8) |

Note: some Commons "public domain" swatches credit third-party sellers' artwork. The underlying patterns are US government works and a faithful copy adds no new authorship, so the risk is judged low; every source is still recorded in the credits.

## 8. Open with the user (blocking single themes, not the plan)

**Licensing is deferred by the user ("we'll run the licensing risk later").** Until each item is decided:

1. **M81 / ERDL:** the Commons swatch is tagged public domain but credits a Spoonflower designer. Options put to the user: accept the low risk, ask the designer for permission (designer's pick), or photograph real M81 fabric.
2. **DCU:** same question; the swatch credits a shop's product photo.
3. **Tiger stripe:** the user's reference image has an unknown origin (likely someone's digital redraw); license it at full resolution, or find a licensable equivalent.
4. **Desert Night:** confirm whether the user took the fabric photo (if so, it is clean).
5. **Flecktarn:** still needs a higher-resolution authentic source.

**Designer's call while deferred:** the pattern tool may generate tiles from uncleared sources locally, but those tiles are **not committed** to the public repo, and their themes stay out of the shipped registry, until the user clears them. A theme moves to "shipped" by adding its tile and flipping its registry entry, with no other code change. The plan delivers the theme system with the cleared camo (DPM, UCP, 6-color desert), all solids and plaids, and the others as they clear.

## 9. Calls made by the designer (correctable)

- **Solids:** Coyote `#81613c`, Ranger Green `#4a5240`, Wolf Grey `#5e6366`, Blackout `#1f1f1f`, Blaze `#e8590c`.
- **Plaids:** Buffalo Check (red/black), Hunter (green/navy with a yellow line), Range Day (tan/olive with an orange line), all original setts.
- Default theme M81 Woodland once its source is cleared; **DPM until then**. Theme stored per device until accounts exist.
- ERDL ships as its own theme from the same artwork at the original scale with ERDL's calibrated palette.
- Tile display scale per theme is tuned so a 64 px bar shows a recognizable slice of the pattern (M81 about 1500 px wide per tile).

## 10. Left to the builder

- Exact Tailwind class conventions and file layout of the shared pieces.
- Picker layout details (dialog vs. popover; swatch size).
- Plaid thread counts; calibrated palettes for patterns other than M81, tuned to match M81's richness.
- WebP quality settings within the size budget.

## 11. Testing

- **Unit (Vitest):** every registry theme has the required fields; every camo theme with a tile has a matching file and a credit entry; theme CSS generated from the registry contains every id; the theme preference store saves and loads.
- **E2E (Playwright):** choosing a theme updates `data-theme` and survives a reload; the bay stays white under a patterned theme; primary and toolbar buttons are at least 44 px tall; the wordmark has the accessible name "Match Sketch"; existing suites pass unchanged after migration.
- **Pattern tool:** a smoke check that each generated tile is seamless (label mismatch across each wrap seam no worse than between ordinary neighboring rows/columns, as measured in the spike) and within the size budget.
