# ttydterm

**Current application version: 1.0.** The same version is shown beneath the
`ttydterm` wordmark in the app.

ttydterm is a terminal experience right in your browser. It uses ttyd, with a
special customized `index.html` file to give you a great terminal experience
right in your browser. The app ships as one completely offline HTML file: each
workspace owns a theme, background pattern, and split tree of terminal panes,
with optional tmux continuity.

The same artifact has three modes: real terminals when served by writable ttyd,
a seven-workspace documentation/demo on static hosting or `file://`, and
`?mock=1` for deterministic browser tests. Documentation mode never replaces a
saved real-workspace configuration.

## Edit, build, and run

The authored source is split for maintainability; `index.html` is the generated,
single-file artifact users download and pass to ttyd.

```text
src/template.html   document shell, import map, and explicit inline slots
src/styles.css      styles
src/app.tsx         strictly typed React application
src/modal.tsx       shared modal shell, form, fields, and actions
src/types.ts        runtime/config/layout domain types
src/commands.ts     canonical ttyd, shell, and tmux command construction
src/docs.ts         typed seven-page static documentation content
src/version.ts      application version source of truth
tsconfig.json       strict compile-time checks
build.mjs           typecheck + deterministic Bun assembler
index.html          generated distributable; do not edit directly
```

Build with globally installed Bun. There is deliberately no `package.json`,
lockfile, `node_modules`, or install step:

```bash
bun run build.mjs
```

The build type-checks the TSX, bundles it with Bun, fetches pinned vendor releases
at build time, and inlines all JavaScript and CSS. The generated artifact has no
runtime network dependencies.

Preview it with the repository's normal dumb static-server workflow:

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

## The design law

**The only text outside a terminal is the product name, application version,
and workspace names.** `ttydterm` and `v1.0` sit once at the head of the rail,
with the collapse toggle beside them; folder names run beneath. Everything else is a pictogram revealed on hover,
or lives inside an overlay — a dialog, the command palette, or a pane's own
settings popover. Those three may show words because the user opened them to
read words.

That single rule drove most of the decisions below. The command palette shows
words because it *is* an overlay; that is the exemption, not a breach.

## Four rules the layout obeys

Each one earned by getting it wrong first.

**1. Nothing moves that the user did not move.** A terminal is a fixed glyph
grid, and the chrome around it has to behave like one. Hovering a pane does not
reflow its text; focusing one adds a ring that costs the terminal no geometry;
collapsing the sidebar does not relocate a single icon. An earlier pass reserved
a right-hand gutter while the pane chrome was up so output could not be struck
through — right about the occlusion, wrong about the cure: it moved the text
under the pointer. The control now floats over the corner as one opaque 22px
glyph, inset clear of the border, covering a bounded patch on hover only.

**2. Contrast is measured, not eyeballed.** See [Colour](#colour).

**3. A workspace switch is a paint.** All folders stay mounted; switching raises
one. No fade, no re-boot, no skeleton replay — a 260ms surface transition made
switching feel slower than the terminals it was decorating.

**4. There is one gutter size.** The page's outer margin, the sidebar-to-stage
channel and the gap between any two panes are the same `--gap` (8px), measured
off the rendered boxes. See [Spacing](#spacing).

## Spacing

Every primary channel on screen is the **same number of pixels**, and `test.mjs`
measures them edge-to-edge off rendered geometry — outer page edge on all four
sides, the sidebar channel, and every adjacent pane pair on both axes — failing
if any two differ by more than 1px.

They used to disagree. `.shell` had `padding: 8px` **and** `gap: 8px`, with the
rail resizer between them collapsed to zero width by `margin: 0 -4px`. So the
sidebar channel measured **16px against 8px** between panes: the resizer was
invisible *and* the rail read as detached from the workspace it belongs to.
The resizer is now a real `--gap`-wide spacer and `.shell` has no flex gap of
its own, so one value produces every channel.

A divider's **hit area** may be as generous as it likes; what is asserted is the
painted channel between the two panes it separates. The gutter element is always
rendered — only its *resize behaviour* (and its separator semantics, which would
be a lie without it) is conditional on the rail being open — so the channel is
identical whether the sidebar is open or shut.

`GAP` in the script reads `--gap` off the stylesheet rather than repeating `8`,
so the space the layout maths reserves cannot drift from the space CSS paints.

## Borderless

A terminal is a filled rectangle in its own theme colour, and the stage behind
it is that colour shifted 16% toward the foreground. **That step is the edge.**
Panes carry no resting border and the sidebar carries no perimeter ring or
internal hairlines — a 1px line on top of two surfaces that already meet is a
second edge describing the first.

Removing it also gave `focused` something unambiguous to say: the ring is now
**present vs absent**, not one shade of grey vs another — which is exactly the
state it had been failing to communicate.

The risk is that "borderless" quietly becomes "invisible", so the steps are
measured in every theme rather than eyeballed in one:

| theme | terminal vs stage | gutter vs sidebar |
|---|---|---|
| night | 1.44 | 12.04 |
| ocean | 1.47 | 11.23 |
| paper | 1.34 | 1.32 |

`paper` is the tight one: rail `#f7f8fb` against terminal `#fbfaf6` is **1.02:1**
— the same white. What separates them is the **gutter**, so that is what the
test asserts: the gutter must step away from *both* surfaces it runs between.
Checking only rail-vs-stage would have passed while the sidebar dissolved into
the terminal.

## Model

```jsonc
{
  "version": 6,
  "ui": { "railWidth": 176, "railOpen": true },   // sidebar geometry rides along
  "folders": [{
    "id": "f-jr",
    "name": "kalviumjr",              // optional; falls back to the last cwd segment
    "cwd": "~/work/kalviumjr",
    "icon": "code",                   // optional; else the first two letters
    "theme": "night",                 // retained by this workspace
    "pattern": "dots",                // non-colour workspace identity
    "layout": {                       // a tree of splits and panes
      "type": "split", "axis": "columns", "sizes": [0.56, 0.44],
      "children": [
        { "type": "pane", "id": "p-1", "command": "pi", "persist": true },
        { "type": "split", "axis": "rows", "sizes": [0.55, 0.45], "children": [ /* … */ ] }
      ]
    }
  }]
}
```

- `axis` is named `columns` / `rows` rather than horizontal/vertical, which is
  ambiguous in every multiplexer (does "horizontal split" mean the divider is
  horizontal, or that panes sit side by side?). `columns` says exactly what you
  get.
- `sizes` are fractions that sum to 1, so a layout is resolution-independent —
  the same config looks right on a laptop and a 4K screen.
- Each folder/workspace retains its own `theme`; activating it repaints its
  terminals, stage, dialogs, and sidebar together.
- Terminal panes retain restrained solid/patterned backgrounds. The sidebar
  alone receives the pure-function-generated **soft horizon** treatment at its
  active 8% strength, with no drop shadow.
- Top-level `ui.fontSize` applies immediately to every terminal.
- A folder's `pattern` is one of seven non-colour terminal-background identities,
  deterministically assigned when absent.
- Older backup blobs still load: validation rebuilds untrusted JSON and defaults
  missing UI, icon, theme, and pattern values.

## Interactions

| Gesture | Result |
|---|---|
| Hover a pane | One control appears, top-right |
| Click it | Settings · close, then a row of column-splits and a row of row-splits (2/3/4 each) |
| Split | The existing pane keeps slot 0 (leftmost / topmost) |
| Drag a divider | Resizes the two neighbouring slots only; siblings hold their share |
| Drag the rail edge | Resizes the sidebar (148–420px), persisted in the config |
| Hover/focus a folder | Its overlaid triple-dot menu appears without changing the label width |
| Double-click a folder | Folder settings |
| `⌘/Ctrl+K` or `⌘/Ctrl+P` | Command palette |
| `⌘/Ctrl+B` | Collapse/expand the sidebar (also the toggle beside the wordmark) |

The settings gear lives on the **row it acts on**. A single gear in the footer
silently meant “the active folder”, so configuring any other workspace meant
switching to it first.

### Where the rail's own controls live

- **`+` is the last row of the workspace list**, not a footer button. It adds a
  row to the thing directly above it, so it belongs to that list — in the
  footer it sat among app-wide actions and read as one of them. It keeps the
  same fixed 52px icon track as every badge, so it lines up with them and holds
  its position when the rail collapses.
- **Search and backup share one footer row**, and a collapsed rail drops both
  entirely. At 52px a row cannot hold them without stacking into a column — and
  stacking is precisely what used to move every glyph on screen when the rail
  closed. Hiding is the honest answer; `⌘/Ctrl+K` still reaches the palette with
  the rail shut.

The pane's resting chrome is **one** button, not four. Four glyphs sitting on
every pane asked the eye to read four decisions before it had asked a question;
they now live behind a single ⋮ that expands to the full set. Persistence rides
on that same button as a dot rather than adding a second mark.

Every piece of pane chrome is **inset 7px** — more than the 2px ring plus the
corner radius — and the border is painted *above* all of it, so the perimeter is
continuous whether or not the chrome is up. The control used to carry a radial
scrim bleeding the pane background out to 56px, which painted straight over the
top-right arc: a focused pane had a visible notch in its ring exactly where the
button sat.

## Settings take effect when you choose them

There is **no Save button** on a pane or a folder. Picking a theme repaints the
terminal under the picker; typing a command re-runs it; ticking tmux flips the
marker. Save/Cancel asks the user to *describe* a change and then confirm it; a
live control just shows them. Closing is only closing.

The one exception is **New folder**: a folder that does not exist yet has
nothing to write through to, so that path keeps Create/Cancel over a local
draft.

Pane settings are a **full-pane overlay inside the pane**, not a modal — command
and run-in-tmux controls painted in that workspace's terminal palette. A
dialog was wrong twice over: it dimmed the entire window to change one terminal,
and it put the thing being configured behind a scrim *while you configured it*,
so the theme you were picking was the one colour you could not see. It keeps its
`#/f/:id/pane/:id` route, so a specific pane's settings stay linkable.

Themes are **swatches, not a dropdown**: each option is a miniature terminal
painted in that theme's own background and accent colours. A colour *name* in a
`<select>` told the user nothing, and hid every option behind a click.

## Command palette

`⌘/Ctrl+K` (or `⌘/Ctrl+P`) opens a Sublime/VSCode-style palette listing every
workspace **and every individual terminal**, searchable by command, workspace
name or cwd. Picking a terminal switches to its workspace, routes the hash to
it, and gives that pane DOM focus — so a named terminal is always two keystrokes
away, however deep in a split tree it sits.

## Routes

Hash routes, so it works from a dumb static server (and later from ttyd's own
`--index`):

```
#/f/:folderId                  the workspace
#/f/:folderId/settings         folder dialog
#/f/:folderId/pane/:paneId     pane settings (a popover in the pane, not a dialog)
#/new                          new folder
#/backup                       backup & restore
#/palette                      command palette
```

The URL is the source of truth for navigation — dialogs are routes, so any view
is linkable and back/forward work.

## Colour

**One audited palette per workspace.**

The active folder's `theme` paints its terminals, gaps, dialogs and sidebar.
Terminal panes retain that background plus the workspace pattern. The sidebar
matches the terminal base and alone layers the four deterministic soft-horizon
gradients at active 8% strength, without a shadow. Switching workspaces is an
instant paint to the next workspace's retained palette.

Matching does not waive contrast: the rail uses the same audited terminal
foreground and dim tokens as the pane it matches, while dialogs and fields retain
the explicit UI palette. Decorative gradients stay at 4%, so they provide
identity without becoming the surface on which readability depends. The gaps
still follow the theme, and pane borders remain mixed from each pane's colours.

### Contrast is measured, not eyeballed

Every theme colour that carries text clears **WCAG AA (4.5:1)** against its own
background; every control, border and focus ring clears **3:1**.

The first cut shipped `dim` at 3.1–4.2:1 in *all six* themes. `dim` is what a
terminal spends on timestamps, byte counts, `ls -la` mode bits and inactive log
levels — precisely the text a tired user squints at. It is now the palette's
floor, not its exception (worst case 4.65:1), while staying visibly separated
from `fg` (≥ 2.45:1 between them) so "dim" still reads as dim.

The focus ring is each theme's blue at full strength (7.3–8.7:1 on its own
background). Diluting it into the background is what made "active" ambiguous.
Since it is now the pane's *only* border, it is checked as a state indicator
under WCAG 1.4.11: ≥ 3:1 against both the terminal it rings **and** the stage
gutter outside it.

`test.mjs` recomputes the whole matrix **from the page's own theme table** (a
`window.__contrastAudit()` seam) so the assertion cannot drift from what ships —
*and* separately re-measures the colours the browser actually painted,
compositing transparent backgrounds up the ancestor chain, so a stray `opacity`
or a bad `color-mix` cannot pass a green source audit.

The last active background is mirrored to `localStorage` and painted by a tiny
inline script before React boots, so a refresh never flashes white.

## Motion

Restrained, and entirely off under `prefers-reduced-motion`:

- **workspace switching is not animated at all.** Every folder is already
  mounted, so showing one is a paint, not a transition. Nor is the selected row
  — a 120ms row fade is read as the *switch* being slow even when the surface
  behind it swapped in a single frame.
- panes fade in on open and out on close (opacity only — the earlier `scale()`
  moved the terminal, which rule 1 forbids; the tree waits 140ms for the exit)
- terminals boot through a **shimmering skeleton** that swaps to content — today
  that is 240ms of theatre, but it is the honest shape of a socket that has not
  opened yet, so it is worth having before ttyd lands
- the pane menu pops in; the resting control fades **in place**, never sliding

There is **no blinking cursor**. A dozen panes each blinking on their own phase
was the single most distracting thing on screen; the mock draws a steady block,
and real ttyd should be started with `-t cursorBlink=false`.

### How inactive workspaces are hidden

This is the whole of "switching is instant", and it is not the animations:

| | |
|---|---|
| `display:none` | **Wrong.** Restoring a display property *restarts every CSS animation in the subtree*, so every switch replayed the panes' entrance animation — the "it still feels animated" report, invisible to a test that only read the surface's own computed style. It also drops the box, so the surface re-measures on show. |
| `visibility:hidden` | **Right.** The subtree keeps its box and its layout, is not painted, is not hit-tested, and is out of the tab order. Flipping it starts nothing and measures nothing. |

The `hidden` attribute stays on the element for its ARIA meaning; its default
`display:none` is deliberately overridden.

## Sizing

Panes have minimums (`MIN_W` 260px, `MIN_H` 140px). Rather than let a split crush
its children, the canvas grows to the smallest box in which every leaf still
meets its minimum *at the current size fractions*, and the area scrolls. For a
columns split that is `max(min_i / sizes_i) + gaps` — the fraction matters, not
just the sum, or a 0.9/0.1 split would violate the minimum while the total
looked fine.

One consequence worth knowing: whichever subtree forces the canvas width sits
exactly on its minimum, so its divider has no slack. Dragging it would freeze.
Instead the drag falls back to a share floor and widens the canvas — you always
get movement, and the scroll absorbs it.

## Running with vanilla ttyd

On GitHub Pages, a static server, or `file://`, the artifact renders seven
terminal-style documentation workspaces: README, Using it, Keyboard, Themes,
Customizations, Security, and Contributing. A valid same-origin ttyd `/token`
endpoint instead activates bundled xterm.js panes connected to vanilla ttyd's
`/ws`.

Install ttyd and the recommended tmux package with your platform's package
manager, then download the artifact:

```bash
curl -fL https://raw.githubusercontent.com/anilgulecha/ttydterm/main/index.html -o "$HOME/ttydterm.html"
```

Run this once after each computer boot. It silently prompts for the password,
binds only to loopback, and enables browser Basic Auth with username `ttydterm`:

```bash
bash -c 'read -rsp "ttydterm password: " TTYDTERM_PASSWORD || exit; echo; ttyd -i 127.0.0.1 -p 7681 -W -O -c "ttydterm:$TTYDTERM_PASSWORD" -I "$HOME/ttydterm.html" -t cursorBlink=false bash -l; status=$?; unset TTYDTERM_PASSWORD; exit $status'
```

Open <http://localhost:7681>. The literal password is not stored in a URL,
ttydterm configuration, backup, or the saved command; ttyd still receives the
credential as a process argument. Basic Auth is not encryption, so any setup
bound beyond `127.0.0.1` also needs TLS.

`-I` makes the page, `/token`, and `/ws` same-origin, so this setup needs no CORS
permission. `-O` independently rejects foreign WebSocket Origins; it is not a
CORS switch or authentication. Pane commands and restored configurations remain
trusted executable shell input. A tmux pane can survive a browser/ttyd reconnect
while its tmux server and session live; tmux is not a security boundary or
host-reboot persistence.

## Test

```bash
python3 -m http.server 8791 &
BASE=http://127.0.0.1:8791/ node test.mjs
```

The headless Chromium suite covers the complete interaction surface. Alongside boot, the design law (a DOM walk
asserting no stray text), the gear glyph, a non-blinking cursor, split, resize,
sidebar resize + persistence, minimum-size overflow, every dialog, the icon
picker, the command palette, config validation, reload persistence, deep links
and a reduced-motion pass, these groups encode this round's feedback:

- **hover never moves terminal content** — the *inked* extent of the first line
  is measured at rest, hovered, and at rest again, and must be identical to
  0.5px; no descendant of `.term` may carry hover padding; the control may not
  translate.
- **one gutter size everywhere** — the page edge (all four sides), the sidebar
  channel and every adjacent pane pair on both axes are measured off rendered
  boxes; all must equal `--gap`, and rounding them must yield exactly **one**
  distinct value. The resize handle must fill its channel rather than widen it.
- **borderless at rest** — a resting pane paints no border at all; the rail has
  no perimeter ring and its head and footer no hairlines; and the colour steps
  that replace them are re-measured **per theme** against a 1.12 floor, in both
  directions (terminal↔stage and gutter↔sidebar).
- **focused border** — the edge overlay covers the pane on all four sides, sits
  above the terminal background, is an inset ring (so nothing can clip it),
  rings *exactly* the focused pane, costs the terminal no geometry, and clears
  3:1 against both the terminal and the gutter.
- **collapsed rail: stable geometry** — ≤ 1px drift for every badge *and* for
  the add-workspace button across a collapse and across a resize drag; the `+`
  is the last row of the list (not a footer button) and sits on the badge track;
  search and backup share one row; the footer is `display:none` when collapsed.
- **contrast (WCAG AA)** — 9 themes × terminal colours, explicit UI token pairs and focus rings from the
  page's own table, plus every glyph actually painted on screen.
- **per-workspace theme** — the rail, stage, terminals and dialogs repaint from
  the active workspace; switching away and back restores each workspace's
  retained palette.
- **instant workspace switch** — no surface animation or transition, no row
  fade, no skeleton replay, the target surface committed in the switching
  render, previous folder still mounted, inactive surfaces never `display:none`,
  and — the one that would have caught
  the bug — **no animation is *running* on the arriving panes**, measured with
  `getAnimations()` on both the outward and the return trip.
- **pane settings live in the pane** — not a dialog, contained within the pane's
  box, compact, opaque once settled, exactly command + tmux, no Save/Cancel,
  and both controls autosave.
- **pane chrome never breaks the border** — every control is ≥ 3px inside the
  pane and the edge overlay's z-index is above all of them.

Screenshots land in `/tmp/ttyd-shots` — **look at them.** Three of this round's
four real defects were invisible to every assertion that passed: the tmux row
rendering as a dim uppercase caption (a CSS specificity collision), theme
swatches wrapping to two rows as unrecognisable smudges, and a popover that
looked transparent (that last one a false alarm — a screenshot caught mid
`pop-in`, which is why the test now waits on `getAnimations()` before measuring
opacity).

Two harness notes:

`locator.click()` scrolls a scroll-container to its "ideal" position as part of
actionability, **even when the target is already fully visible**. Where the
canvas overflows, that shifts the viewport ~230px, and a "nothing moved"
assertion then measures Playwright rather than the app — it failed with a 493px
delta that did not reproduce when the same clicks were dispatched in-page. Those
few clicks are dispatched in-page for that reason.

The converse also bites. A loop of **in-page** `el.click()` calls inside one
`page.evaluate` cannot switch workspaces: the row routes through
`location.hash`, and React never commits between iterations — so the per-theme
colour probe read the *same* (night) values three times and passed the entire
borderless section without once looking at the light theme. It is driven from
Playwright, one theme per iteration, and guarded by an assertion that the probe
actually saw more than one distinct stage colour. **A probe that sweeps a
dimension needs to prove it moved along it.**
