# METALEARNINGS — ttyd-workspace

Generalized principles inferred from the feedback rounds, per
`prototypes/AGENTS.md` rule 7. Portable rules, not a task log.

1. **Prove the delivery channel before designing for it.** Three rounds went
   into a GitHub-Pages app embedding a local ttyd (mixed content, local-network
   permission, cross-origin `window.term`) before the constraint that actually
   mattered surfaced: *the user should download one file*. That reframed
   everything — same-origin via ttyd's own `--index`, no CORS, no permission
   prompt, `window.term` reachable. **Ask "how does this reach the user?" before
   "what does it do?"** — the answer usually deletes a whole category of
   problems rather than solving them.

2. **A "only X is visible" constraint is a design engine, not a restriction.**
   "The only text outside a terminal is the folder name" sounds like a
   limitation; it decided the entire interface — pictogram rails on hover,
   dialogs as the only place words live, split *counts* as divided-rectangle
   glyphs instead of a "2 / 3 / 4" segmented control. When a constraint like
   this appears, encode it as an **assertion** (here: a DOM walk that fails on
   any stray text node) so it can't quietly erode.

3. **Name an axis by what you get, not by the divider's orientation.**
   "Horizontal split" is ambiguous in every multiplexer — is the divider
   horizontal, or are the panes side by side? `columns` / `rows` names the
   *result*. Any two-way geometric term that has bitten users before should be
   renamed at the schema level, not clarified in a tooltip.

4. **Fractional sizes with per-child minimums need `max(minᵢ/sizeᵢ)`, not
   `Σminᵢ`.** The obvious "sum the minimums" is wrong the moment sizes are
   uneven: a 0.9/0.1 split satisfies the sum while the 0.1 child is far under
   its minimum. Whenever a proportional layout also has absolute floors, the
   container's minimum is driven by the *worst ratio*, not the total.

5. **A clamp that is always correct can still produce a dead control.** Sizing
   the canvas to the tightest fit means whichever subtree forces that width sits
   exactly on its minimum — so its divider had a zero-width legal range and
   froze. The clamp wasn't buggy; the *system* left no slack. Fix: detect the
   degenerate range and fall back to a looser floor that grows the canvas.
   **When a constraint solver yields an empty solution set, the UI needs a
   defined escape, not the empty set.**

6. **Screenshots find what assertions can't — look at every one.** All
   assertions passed while `ls` was collapsing to a single column in narrow
   panes, `ls -la` printed a dead `…`, and panes sat flush against the viewport
   edge. None had a natural assertion; all three were obvious on sight. Inspect
   the render at *every* state the tests visit, not just the happy path.

7. **A mock's job is to be faithful where the eye lands.** Fixing `ls` to size
   columns to the longest entry (what real `ls` does) rather than a guessed
   `min-width` was a five-line change that made every narrow pane read as a
   terminal instead of a list. For placeholder content, copy the *rule* the real
   thing follows, not a static sample of its output.

8. **Test isolation matters more when the app persists to localStorage.** The
   first test run passed against seeded defaults; the second would have asserted
   against the first run's mutations. Any prototype with persistence needs the
   test to clear storage before asserting — otherwise the suite silently tests a
   different app on every run.

9. **A "source of truth" normaliser must know which routes it does not own.**
    An effect that rewrote the hash to match the active folder looked correct
    until routes appeared that carry no folder id (`#/backup`, `#/new`). It
    stomped them — and the stomp produced *three* symptoms that read as
    unrelated bugs: the URL changed, the user's place was lost, and the dialog
    wedged shut. **When one control writes a shared piece of state, enumerate
    the states it must leave alone**, or it will silently overwrite peers.

10. **Setting a value equal to its current value fires no change event.**
    `location.hash = x` when the hash is already `x` dispatches nothing, so a
    listener-driven router never re-reads and the UI freezes. This is the
    hidden second half of bug 9: the stomp pre-installed the exact hash that
    "Close" would later write. Any event-sourced navigation needs an explicit
    re-announce for the no-op write.

11. **A regression test must be watched to FAIL.** Two of these assertions
    passed against half-reverted code because a *second* fix masked the first.
    Only reverting to the true pre-fix state proved they caught the real defect.
    **Revert the fix and watch the new test go red** — a green test on broken
    code is worse than no test, because it certifies the bug as fixed.

12. **Reproduce on the second cycle, not the first.** The stuck dialog was
    invisible on first open and only appeared on reopen, because the first
    close left the URL in the poisoned state. **Open/close (or
    connect/disconnect) at least twice** — the second iteration is where
    state-leak bugs live.

13. **Duplicating a running process is not a sensible default.** Splitting a
    pane cloned its command, so splitting `npm run dev` three ways meant three
    servers fighting for one port. A "new slot" should default to the *neutral*
    thing (a shell), inheriting only cosmetics. Ask what a clone would DO, not
    just what it would look like.

14. **Fixing an overlap by reserving space can be worse than the overlap.**
    Padding the first line to clear the opaque hover toolbar stopped the
    strike-through — and permanently wrapped the prompt onto two lines in
    narrow panes. The assertion went green on a worse result. The fix was to
    reserve the gutter *only while the chrome is actually visible*, so resting
    text is never reflowed. **Chrome that appears on demand should cost layout
    only on demand** — and an assertion measuring the resting state would have
    passed vacuously, so it has to measure the hovered state too.

15. **Keep every workspace mounted, hidden — and make selectors respect it.**
   Tearing down inactive folders would kill their terminals, which is exactly
   wrong once these are live PTYs. Hiding instead means a bare `.pane` selector
   can resolve to an invisible node, so tests must scope to the visible surface.
   **The architecture that's right for the product changes what a correct
   selector looks like.**

16. **An icon is only correct if it survives its own silhouette at its real
    size.** "Settings" shipped as a circle with rays and read as *brightness*.
    The first fix — a lucide-style ring of twelve tiny arcs — turned to a smudge
    at 14px. The second — a circle with six radial spokes — became the sun
    again, because *anything radiating from a circle is a sun*. Only a filled
    ring with teeth cut into the perimeter reads as a cog. **Judge a glyph by
    rendering it at the size it will actually be used, beside the thing it must
    not be confused with**; a four-line script that screenshots the SVG at
    15/42/120px settles in seconds what argument cannot.

17. **Controls at rest are questions asked of the eye.** Four glyphs on every
    pane meant every pane asked four questions before the user had asked one.
    Collapsing them behind a single ⋮ that expands to the full palette costs one
    click and buys back the entire resting screen. Corollary: fold status
    ("this one persists") *onto* the existing control as a dot rather than adding
    a second mark — **a second glyph is a second question**.

18. **Nesting inside a fading container inherits the fade.** The pane menu was a
    child of the hover rail, which animates `opacity: 0 → 1`. However opaque the
    menu's own background, it composited through its parent — terminal text was
    legible straight through it. A popup that must occlude has to live *outside*
    any ancestor that animates opacity. **Opacity is inherited by compositing,
    not by cascade; `background: <opaque>` cannot rescue a transparent parent.**

19. **Never assert on a property mid-animation.** `opacity: 0.82` on an element
    whose open animation is 130ms is not a bug in the element, it is a bug in
    the assertion — Playwright clicks and measures faster than CSS finishes.
    Await `el.getAnimations()` before measuring anything animated. The same trap
    runs the other way: an assertion that *passes* only because it sampled the
    frame where the value happened to be right.

20. **Derive chrome from content when the content IS the product.** A light app
    frame around six dark terminals reads as unfinished — two designs sharing a
    window. Mixing every chrome colour from the active theme (`color-mix` off the
    terminal's own bg/fg) makes one surface, and switching theme re-skins the
    whole window for free. Worth deviating from a house default for, *and worth
    writing down why* — the next reader will otherwise "fix" it back.

21. **A placeholder is a promise about latency.** The boot skeleton is pure
    theatre against a mock, but it is the exact shape of a PTY socket that has
    not opened yet. Building the loading state while the data is still fake means
    the real thing slots in without a redesign — and it forces the test to ask
    "is the content ready?" instead of "does the element exist?", which is the
    honest question either way.

22. **`MutationObserver` at document-start needs `document`, not
    `documentElement`.** In an init script the latter is still `null` and
    `observe` throws — into the page's error channel, where it also fails an
    unrelated-looking "no console errors" assertion. Observing an *ephemeral*
    state (a skeleton that lasts 240ms) is otherwise a race the test loses; an
    observer installed before the document runs cannot miss it.

23. **In a terminal UI, "nothing moves that the user did not move" outranks
    "nothing is occluded."** A hover-reserved gutter stopped the pane control
    covering output — by reflowing the text under the pointer. The occlusion was
    real; the cure was worse, because a PTY's glyph grid is a *grid*, and a grid
    that twitches when the mouse crosses it feels broken in a way that a briefly
    covered word does not. When two invariants collide, rank them by which
    violation the eye reads as a *malfunction* rather than as a *cost*. (The
    third way: occlude, but on a gradient scrim, so the covered text fades
    instead of being chopped — the cost stops looking like a bug.)

24. **A derived-from-content palette cannot carry a contrast budget.** Mixing the
    chrome from the active theme (learning 20) is right for the *gaps* and wrong
    for *navigation*: it hands a user's choice of shell colours veto power over
    whether the app's own controls are readable, and a low-contrast terminal
    theme is a legitimate thing to want. Split the surfaces — content-derived
    where it decorates, fixed system palette where it must stay legible. Learning
    20 was not wrong, it was over-applied; scope it to what the content actually
    owns.

25. **The dimmest colour in a palette is the one that carries the most
    forgettable text — and the most of it.** Every one of six hand-picked themes
    shipped `dim` between 3.1 and 4.2:1 while every other colour cleared AA
    comfortably. `dim` is timestamps, byte counts, mode bits, inactive log
    levels: low-salience *by design*, which is exactly why it never gets looked
    at during design. Audit the de-emphasised colour first; it is where the
    accessibility debt hides. (Fix by mixing toward `fg` until it clears the
    floor, then assert the *separation* from `fg` too, or "dim" stops reading as
    dim.)

26. **Measure contrast from the shipping source AND from the rendered pixels.**
    A table of hex pairs in the test is a copy that drifts; a `getComputedStyle`
    sweep alone cannot enumerate themes that are not currently mounted. Do both:
    expose the palette as a test seam so every theme is audited from the real
    object, and re-measure what the browser actually painted so a stray
    `opacity`, a bad `color-mix` or an inherited colour cannot pass a green
    source audit. They fail in different ways, which is the point.

27. **`rgba(0,0,0,0)` is not a colour, and treating it as one invents failures.**
    A resting row is `background: transparent`; read literally that is black, so
    every unselected label "failed" against a background that is not on screen.
    Any computed-style contrast check must composite up the ancestor chain to the
    first opaque paint. Equally: sample by *state*, not by position — `.folder-name`
    first is the active row in one theme and an inactive one in the next, and the
    diff "proves" a difference that is only the selection having moved.

28. **A border that must be continuous belongs to an overlay, not to the box.**
    Two plausible implementations both fail invisibly: an *outer* box-shadow is
    clipped by the first ancestor with `overflow: hidden` (ring on two sides for
    any pane at the canvas edge), and an *inset* one is painted underneath the
    child's own opaque background. A dedicated absolutely-positioned sibling
    above the content is the only version that is whole on all four sides in
    every position. Assert the ring's *rect equals the box's rect* — "it has a
    box-shadow" is true in both broken cases.

29. **State changes may repaint, never resize.** Focus that thickens a border
    reflows whatever is inside it. Keep the geometry constant and change only the
    colour — then assert it, by extracting the px values from both computed
    shadows and demanding they match.

30. **Two elements swapped at a breakpoint guarantee the icons will jump.** The
    collapsed sidebar was a *different element* with its own layout — five footer
    buttons in a row became two in a column, and every glyph on screen moved. One
    element whose width changes, over a fixed icon track that both states share,
    is the only way "nothing moves" survives contact. Assert it as *drift*:
    capture each control's centre point in both states and require ≤ 1px.

31. **When everything is already in memory, animating the switch is a lie about
    the cost.** All folders stay mounted, so raising one is a paint — but a 260ms
    cross-fade told the user it was a load, and made switching feel slower than
    the terminals it was decorating. Worse, the entrance animation replayed a
    "boot" for sessions that had been alive the whole time. Animate work that is
    actually happening; when the answer is already there, show it.

32. **A control that belongs to a row belongs ON the row.** One gear in the
    footer silently meant "the active folder", so configuring any *other*
    workspace meant switching to it first — a mode nobody asked for. Per-row
    actions must reserve their space permanently and only fade in, so the row's
    geometry (and the label's ellipsis point) is identical hovered or not.

33. **"It still feels animated" is a report about a MECHANISM, not a duration.**
    Every animation on the workspace switch had already been deleted and the
    assertions agreed — no transition, no entrance, under 250ms. It still felt
    animated, because inactive surfaces were `display:none`: **restoring a
    display property restarts every CSS animation in the subtree**, so each
    switch replayed the panes' own entrance. `visibility` starts nothing. When a
    symptom survives the removal of its obvious cause, the cause is a side
    effect of something you are not filing under "animation" at all — and the
    assertion must measure the thing itself (`getAnimations()` on the arriving
    subtree), not the styles that were supposed to produce it.

34. **A live control beats a described one.** Save/Cancel asks the user to
    describe a change and then confirm it; a swatch that repaints the terminal
    underneath just shows them. The same move three times in one round: colour
    *names* in a `<select>` became miniature terminals, the pane's modal became
    a popover inside the pane, and both settings surfaces lost Save entirely.
    A modal is especially wrong for appearance: it puts the thing being
    configured behind a scrim *while you configure it*. If a control's effect is
    visible, show the effect instead of naming it, and apply it where the user
    can watch it land.

35. **CSS specificity collisions are invisible to behavioural assertions.**
    `.ps-row > label` (0,1,1) silently outranked `.ps-check` (0,1,0), so a
    checkbox row inherited a caption's uppercase, its dim colour and
    `display:block` — the control rendered as a disabled-looking heading. Every
    assertion about it passed: it existed, it was labelled, it toggled, it
    persisted. Only the screenshot showed it. Style a component **by class,
    never by descendant element**; and when a fix is a specificity fix, assert
    the *computed* result (`display`, `text-transform`, the measured gap between
    box and label), because that is what can regress in silence.

36. **Know which scroll is yours.** A "nothing moved" assertion failed with a
    493px delta that no in-page reproduction could produce: Playwright's
    `locator.click()` scrolls a scroll-container to its "ideal" position as part
    of actionability, *even when the target is already fully visible*. The app
    was innocent; the harness moved the viewport. Before fixing a positional
    failure, reproduce it without the test framework — if it will not reproduce,
    the framework is the subject. (The hunt did find real hardening on the way:
    `autoFocus` on a popover input lets the browser scroll it into view, which
    genuinely does drag the workspace sideways. `focus({preventScroll:true})`.)

37. **A screenshot of an animating element is a sample, not a picture.** A panel
    looked part-transparent with terminal text bleeding through it — a
    convincing bug that was a capture taken mid `pop-in`. Await
    `getAnimations()` before measuring or photographing anything whose opacity
    or transform is in flight, or you will spend the afternoon chasing a frame.

38. **Chrome that floats over content must be inset further than the border it
    must not touch.** The pane control carried a radial scrim bleeding the
    background out to 56px, which painted straight over the top-right arc of the
    focus ring: the "border is partial and not apparent" report. Fix in two
    parts — inset every floating control further than (ring + corner radius),
    and paint the border *above* all chrome so it cannot be overdrawn. Assert
    both: minimum inset from the pane box, and z-order.

39. **One spacing token means nothing if two boxes each consume it.** The page
    margin and the pane gaps were both 8px and both correct, yet the sidebar sat
    twice as far from the workspace as two panes sat from each other: `.shell`
    had `padding: 8px` *and* `gap: 8px`, and the element between them had
    collapsed to zero width via negative margins, so two channels stacked into
    one. The token was right; the *composition* was not. **Assert spacing by
    measuring rendered boxes edge-to-edge, never by reading the variable** — and
    for a gutter that is also a control, give it a real width and let it BE the
    gap instead of laying a gap beside it.

40. **A hit area and a painted channel are different things, and only one of
    them is the design.** A resize handle may be as grabbable as it likes; what
    the eye judges is the space between the two things it separates. Keeping
    them equal here was simplest, but the assertion is written against the
    painted channel so a future fatter handle cannot silently widen the layout.

41. **Removing a border can be what finally makes a state visible.** Panes had a
    resting hairline and a focused ring of the same width in a different shade,
    and "active" read as partial and unclear — the ring had no vocabulary left,
    because *every* pane already had a border. Deleting the resting one turned
    the signal from "one grey vs another" into "present vs absent". **When a
    state indicator reads weakly, check whether the resting state is already
    spending the channel the indicator needs.**

42. **Borderless is a contrast claim, so it needs a contrast test.** Once edges
    are drawn by two surfaces meeting rather than by a line, "does it still have
    an edge?" is a measurable question in every theme — and the light theme is
    where it fails first: the rail (`#f7f8fb`) and a paper terminal (`#fbfaf6`)
    are the same white to 1.02:1. What separates them is the *gutter*, so the
    gutter is what must be asserted, against **both** neighbours. A test that
    only measured rail-vs-stage passed green while the sidebar dissolved into
    the terminal. **Assert the thing doing the work, not the thing next to it.**

43. **A probe that sweeps a dimension must prove it moved along it.** The
    per-theme colour probe clicked all three workspaces inside one
    `page.evaluate` and read identical values three times: the rows route
    through `location.hash`, and React cannot commit between iterations of a
    synchronous loop. Six assertions passed having never once looked at the
    light theme they existed to check. Drive such loops from the harness (real
    events, one step per iteration) **and add a guard that the swept values were
    actually distinct** — a probe that silently samples the same point N times
    is worse than no probe, because it reports confidence.

44. **`display:none` is in the DOM; `querySelectorAll` will hand it to you.** An
    assertion that a collapsed rail "hides the footer entirely" failed against a
    footer that was correctly hidden, because it counted nodes rather than
    boxes. When the claim is visual, filter on a rendered box (or read
    `display`) — presence in the tree is not presence on screen.

45. **Prose pasted next to a comment terminator becomes a CSS rule.** Twice this
    round an explanatory paragraph landed *after* a comment's `*/`, and the
    stylesheet silently dropped the rule that followed — the shell lost
    `display:flex` and the whole app collapsed into a column. CSS has no syntax
    errors that stop the parser; it discards and continues. A five-line
    structural lint (track brace depth, flag text at depth 0) catches it
    instantly, and is worth running after any edit that adds commentary to a
    stylesheet.

46. **Single-file delivery does not require single-file authorship.** Once an
    artifact grows past comfortable review size, keep small canonical source
    files and deterministically assemble the downloadable HTML. The generated
    file remains the product boundary; the split source remains the maintenance
    boundary. A tiny global-tool script with validated sentinels is preferable
    to adding a package graph merely to concatenate text.

47. **A global theme needs explicit semantic UI tokens, not percentage mixes.**
    The same `color-mix()` recipe cannot guarantee readable muted text, controls,
    and selected states across charcoal and cream backgrounds. Built-in themes
    now carry audited terminal colours and audited UI surface/text pairs; custom
    theme generation can be algorithmic later, but shipped themes should be
    predictable by construction.

48. **Workspace identity can live behind content without competing with it.**
    Gutters were too narrow to build spatial memory. Low-opacity monochrome
    patterns on the terminal surface survive color-vision differences and remain
    recognizable across global themes, provided they never reduce text contrast
    or enter the glyph layer.

49. **Procedural decoration should be a pure function of stable identity and
    state — and applied only where it earns its visual weight.** Deterministic
    gradient generation keeps reloads stable and gives tests an exact seam, but
    putting the result behind every terminal made the workspace busier than its
    earlier restrained surfaces. The sidebar benefits from atmosphere because
    it is one orienting surface; repeating it across every content pane does not.

50. **Matching surfaces must also match their contrast-bearing palette.** A
    sidebar can share a terminal's base and subtle decoration, but retaining UI
    text chosen for a different surface invalidates the contrast claim. When a
    navigation surface deliberately matches content, move its audited foreground
    and dim tokens with it; keep decoration too weak to become the effective
    background.

51. **A missing native host can be a useful product mode, not merely an error.**
    The same self-contained page can demonstrate and teach itself on a static
    origin, explain the one-time launch under `file://`, and become the real app
    only after validating the host's protocol endpoint. This keeps documentation
    visually honest and eliminates a separately maintained marketing frontend.

52. **Detect a protocol by shape, not by URL convention.** Static hosts can
    return HTML or custom 404 responses for `/token`; an HTTP 200 alone does not
    identify ttyd. Require the expected JSON token shape before mounting real
    terminal clients, and derive token/WebSocket paths exactly as upstream does
    so reverse-proxy base paths remain valid.
