# Steel ricochet danger zones — Design

Date: 2026-11-27
Status: Approved 2026-11-27

## 1. What this is and why

An on-screen overlay in the stage plan editor that draws the ricochet danger zones of the steel targets placed on the plan. Each zone is drawn exactly as a published source defines it, and each can be switched on or off.

**Why:** the user's gun club has concerns, not backed by evidence, that the club's long-standing steel shooting is now dangerous and could send ricochets onto neighboring property. A board member's Google Earth sketch tried to answer this with straight lines of fire, which no published ricochet model uses. This overlay lets the club see the published zones laid over a real stage plan, and serves other Match Sketch users with real steel-safety questions.

**Honesty rule (user accepted, 2026-11-27):** draw each source as published, never tuned toward a reassuring answer. Label every shape with its source and with what it means. The Army danger-zone template is a 1-in-1,000,000 escape envelope (AR 385-63 ¶3-1b), not where rounds usually go. Berms and baffles are not modeled (spec §2 non-goal), so a drawn zone is the open-ground worst case.

## 2. Goals, non-goals, anti-goals

**Goals**

1. Draw splash rays off every steel target on the plan, per source.
2. Draw the caliber-specific ricochet fan (Army batwing template) from each shooting position through each steel target, with separate toggles for 9mm Luger and 5.56 NATO.
3. Every drawn shape traces back to a document, paragraph and figure that the legend names.

**Non-goals** (dropped when the user narrowed scope, 2026-11-27)

- Site or neighborhood maps, aerial imagery, Google Earth (KML) export.
- The vertical danger zone or any side view.
- Minimum engagement distance rings.
- Saving the toggles with the plan, printing the overlay, showing it in shared links.
- Berms, baffles, terrain, line-of-sight through walls.

**Anti-goals**

- Any shape not traceable to a published source, or a published number changed to look safer or scarier.
- An overlay that reads as "where rounds go" rather than "the boundary the source says to keep clear".

## 3. Sources and the exact geometry

All primary documents were read in full text; the figures were checked visually from the PDF.

### 3.1 Splash off the plate (caliber-independent)

| Toggle | Source | Geometry |
|---|---|---|
| **AR 385-63 splash** | AR 385-63/MCO 3570.1D, 23 May 2025, ¶2-17a(2), Fig. 2-5 (top view) | From the impact point, two rays at **20° off the plate face plane**, toward the shooter's side, one left and one right, each **50 yd (45.72 m)** long. The text says "up to 45 m"; the figure says 50 yd. Use the figure's 45.72 m, the larger of the two. |
| **Pistol NZ splash** | Pistol New Zealand, *Steel Target Safe Use Guide 2025 V4*, 28 May 2025, §8 "What happens when a projectile hits Steel? The Splatter Pattern", p. 6, Fig. 1 | Fragments leave at **0–20° from the plate surface** in a full circle. In plan view that is the same left and right wedges. Reach: "at least 25-30 metres… you must assume that the side splatter can cause injury at any distance within the splatter zone". This is a **minimum, not a limit**: draw solid to 30 m, then dashed to the bay edge, labeled "≥ 25–30 m, no stated limit". |

Each splash zone is drawn as a filled wedge between the face line and the 20° ray, with the ray drawn as an arrow. AR 385-63 defines the angle relative to the plate face, not the line of fire (¶2-17a(2)), so the wedge follows the plate's orientation whatever the shooting position.

Other sources agree on 20° but give no reach (DOE *Use of Bullet Traps and Steel Targets*, June 2012; Action Target *Steel Resource Guide*; Tactical AR500 *Safe Shooting*). They add no distinct shape and get no toggle. The NRA Range Source Book (ordered on USB) is added later as a toggle if it differs.

### 3.2 Ricochet fan from the shooting position (caliber-specific)

Source: AR 385-63, ch. 5. ¶5-1c requires the **batwing** template "when designing ranges that involve fire and movement… or when ricochet hazards outside the range boundary may endanger nonparticipating personnel", which covers practical shooting stages. The cone template (Fig. 5-1) is not offered. The dispersion area stays at the standard **5°**; the 2° reduction in ¶5-1d is only for static fire.

Geometry (Fig. 5-3, definitions ¶5-2b), for one firing point F and one gun-target line (GTL) from F through the target:

- **Dispersion area:** rays at ±5° from the GTL, from F out to Distance X.
- **Ricochet area, each side:**
  - Point A: on the ray at (5° + P) from the GTL, at perpendicular distance W from the dispersion edge. Its distance along the dispersion edge is W / tan P.
  - Point B: also at perpendicular distance W, at distance Y − W / tan Q along the dispersion edge. A→B runs parallel to the dispersion edge.
  - Point C: on the dispersion edge at Distance Y. Angle Q sits at C between the dispersion edge and C→B.
  - Outline: F → A → B → C on each side, plus the dispersion area out to X.

Values, steel/concrete impact media:

| Toggle | Table | Load | X (m) | Y (m) | W (m) | P | Q |
|---|---|---|---|---|---|---|---|
| **9mm Luger** | 5-4 | Ball M882, M1, subsonic | 1,800 | 1,211 | 399 | 61.10° | 30.40° |
| **5.56 NATO** | 5-11 | M193 Ball | 3,100 | 1,666 | 323 | 19.00° | 26.90° |

5.56 uses **M193** (55 gr ball) because it is the only 5.56 ball load AR 385-63 gives steel-media values for (Table 5-11 also gives them for the M196 and M856 tracers and the M862A1 plastic short-range round). The NATO-standard M855 (Table 5-12) lists only earth and armor media. The legend says so.

The fan is drawn as outline polygons with the ricochet-area edges as arrows; the dispersion area is drawn lighter. At bay scale, nearly all of it lies beyond the bay (see §4.4).

## 4. How it works

### 4.1 Which objects count

- **Steel targets:** `popper`, `popper-static`, `popper-trigger`, `popper-auto-reset`, `steel-static`, `plate-kd`, `plate-stop`, `plate-rack`, `ducks`, `bottle`, `spinner`, `texas-star`, `whirly-gig`. Mark these with a catalog flag (e.g. `steel: true`) rather than a hard-coded list, so new symbols opt in. A counted target ("KD ×4") is one origin at its position.
- **Firing points:** `shooting-position` markers and the center of each `shooting-box`.

### 4.2 Plate orientation

A plate faces straight uprange (its face normal points to −y) and turns with the object's `rotation`. Target glyphs are drawn front-facing (spec §7.3), so rotation already reads as "which way it faces".

### 4.3 What gets drawn when

- **Splash:** for every steel target, for each splash toggle that is on.
- **Ricochet fan:** for every firing point × steel target pair, for each caliber toggle that is on. A firing point at the target's own position is skipped.
- **Selection** (`selection` is a list of object ids): with nothing relevant selected, draw everything. Otherwise draw the union over the selected objects:
  - a selected steel target contributes its own splash and the fans from every firing point through it;
  - a selected firing point contributes its fans through every steel target, plus the splash of those targets.
  
  This is how the user gets "one target alone or all together". Selecting one target and one firing point shows the union, not just that pair.

### 4.4 Drawing at bay scale

- Geometry is computed in true feet (meters × 3.28084), in plan coordinates (x right, y downrange).
- Shapes are clipped to the bay rectangle.
- **Where a line leaves the bay** (added at the user's request, 2026-11-27), it ends in an outward arrowhead at the bay edge. Its edge tag shows the published number, plus how far the line goes past the edge.
  - The published number is in the plan's unit with the source's meters in parentheses.
  - The past-the-edge distance is derived and labeled "past bay", in the plan's unit only, rounded to whole units. Leaving off the meters keeps it visibly separate from published values.
  - **A splash ray leaving the bay:** its reach plus the remainder, e.g. "50 yd (45.72 m) · 12 yd past bay". The remainder is the reach minus the distance from the target to the exit point.
  - **A Pistol NZ ray:** "≥ 27–33 yd (25–30 m) · no stated limit", because the source gives no limit to subtract from.
  - **A dispersion edge:** "X 1,969 yd (1,800 m) · 1,952 yd past bay". The remainder is X minus the distance from the firing point to the exit point.
  - **Each ricochet area,** tagged once where it leaves the bay: "W 436 yd (399 m) · Y 1,324 yd (1,211 m) · reaches 1,190 yd past bay". The reach is the largest distance from any outline corner (A, B, C) to the bay rectangle.
  - The F→A edge gets no tag of its own.
- With a scale break on, every edge is subdivided and each point passes through `toDrawn` (`src/lib/geometry/depth-map.ts`), like everything else drawn in the far strip.
- The layer sits under objects and annotations and ignores pointer events.

### 4.5 Toggles and legend

- **Toggles:** a "Danger zones" control in the editor toolbar opens a small panel with four toggles: AR 385-63 splash, Pistol NZ splash, 9mm Luger fan, 5.56 NATO fan. Each layer has its own distinct stroke pattern, readable in grayscale.
- **State:** editor view state only, all off by default. Not saved with the plan, not printed.
- **Legend:** while any toggle is on, a legend card on the canvas lists each active layer, with a stroke sample, its citation, and its meaning in the source's own words:
  - **AR 385-63 splash:** "bullet splatter will angle off the target up to 20 degrees… and travel up to 45 m. The majority of all bullet fragments will exit the target within the 20-degree backsplash area" (¶2-17a(2)).
  - **Pistol NZ splash:** "splatter sideways at least 25-30 metres… you must assume that the side splatter can cause injury at any distance within the splatter zone" (Pistol New Zealand, Steel Target Safe Use Guide 2025 V4 (28 May 2025), §8 "What happens when a projectile hits Steel? The Splatter Pattern", p. 6, Fig. 1).
  - **9mm and 5.56 fans:** "Danger zone = 1 in 1,000,000 escape envelope (AR 385-63 ¶3-1b), not where rounds usually go." This line appears only while a fan toggle is on.
  - **Notes under a citation:** AR 385-63 splash: "Drawn to Fig. 2-5’s 50 yd (45.72 m)." 5.56 NATO: "M193 is the only 5.56 ball load AR 385-63 gives steel-impact data for (Table 5-11); M855 (Table 5-12) lists only earth and armor."
  - **Marks**, only the lines that apply to the active layers:
    - fans on: "Thin lines: dispersion area, 5° each side of the line of fire (AR 385-63 ¶5-1d, Fig. 5-3)."
    - fans on: "X = maximum range (AR 385-63 ¶9-2d); W = ricochet width beyond the dispersion edge; Y = farthest downrange point of a lateral ricochet (¶5-2b)." ¶5-2b defines W, Y, P and Q but not X; ¶9-2d is where the regulation glosses Distance X as maximum range.
    - Pistol NZ on: "Dotted continuation: Pistol NZ gives no outer limit."
    - any layer on: "“past bay” distances are computed by Match Sketch from this plan, not published."
  - **Hints:** "No steel targets on the plan." while any layer is on and the plan has none; "Add a shooting position or shooting box to see the ricochet fan." while a fan is on and the plan has no firing point.
  - **Always:** "Berms and baffles are not modeled."
  - The card collapses from a Legend button in its header and scrolls when taller than the stage.
- **Labels:** labels live in the legend. On the canvas the only text is the end tags (§4.4). Tags that leave the bay at the same point (the 9mm and 5.56 dispersion edges share a direction) share one arrowhead with their lines stacked, and each tag is anchored inward from its edge so it stays inside the bay.

## 5. Code shape

- `src/lib/safety/sources.ts`: the source records and numbers above, with citations, as typed data.
- `src/lib/safety/zones.ts`: pure functions that take a plan document plus the active toggles and return shapes (polygons, rays with end tags) in true feet. Clipping and depth mapping happen here or in a small helper, not in components.
- `src/lib/editor/components/DangerZoneLayer.svelte`: renders the shapes inside `EditorCanvas`.
- The toolbar control and its legend card.
- Catalog: the `steel` flag on the entries in §4.1.

## 6. Testing

- **Vitest:**
  - Splash ray endpoints for an unrotated and a rotated plate.
  - Batwing points A, B and C for the 9mm and 5.56 values. Hand-checked for 9mm: A at 220 m along the edge, B at 531 m.
  - Clipping to the bay, end tags.
  - Depth mapping through a scale break.
  - Selection filtering.
  - Catalog invariant: every steel-family target has the flag.
- **Playwright:** toggles show and hide each layer; the legend lists the active sources; nothing is drawn when the plan has no steel targets.

## 7. Calls made by the designer (correctable)

- AR 385-63 splash uses the figure's 45.72 m rather than the text's 45 m.
- Pistol NZ's "at least 25–30 m" is drawn as solid to 30 m, then dashed to the bay edge.
- Batwing, not cone; 5° dispersion, not 2°.
- 5.56 = M193, not M855.
- Steel set (§4.1), firing points (§4.1), plate orientation (§4.2), selection behavior (§4.3).
- No line-of-sight test: every firing point is paired with every steel target.
- On-screen only, all toggles off by default.
- Legend-only labeling with quoted meanings (§4.5); end tags show published values, plus a labeled "past bay" distance where a line leaves the bay (§4.4); selection is a union (§4.3).

## 8. Left to the builder

- Exact stroke styles and colors within the theme, and where the legend card sits.
- Clipping algorithm and subdivision step for the depth mapping.
- How to keep many overlapping fans readable (e.g. merge identical outlines, lighter fills).
