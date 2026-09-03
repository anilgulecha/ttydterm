# METALEARNINGS

These rules apply to terminal workspaces and other single-file browser tools.

1. Confirm how users receive the product before you design its runtime model.
   A same-origin custom ttyd index avoids iframe, CORS, and mixed-content work.

2. Turn visual constraints into tests. A DOM text scan protects an interface
   that allows text only in named areas.

3. Name split axes by the pane result. `columns` places panes side by side and
   `rows` stacks them.

4. Compute a proportional layout minimum with the largest `minimum / share`
   ratio. Summing child minimums fails for uneven shares.

5. Give a constrained resize operation a defined escape. When a divider has no
   legal movement, grow the canvas instead of freezing the control.

6. Open every screenshot. Behaviour tests can miss wrapping, weak icons,
   transparency, and layout balance.

7. Make mock output follow the same layout rules as real output. For example,
   size mock `ls` columns from the longest item.

8. Clear persisted browser state before a deterministic test. A previous run
   must not change the next run's starting point.

9. List every route before an effect writes navigation state. Folder routing
   must leave backup, new-folder, settings, and palette routes alone.

10. Handle navigation to the current hash explicitly. Browsers emit no hash
    change event when code writes the same value.

11. Prove each regression test by restoring the broken behaviour and watching
    the test fail.

12. Repeat open and close flows. State leaks often appear on the second cycle.

13. Start a new split with a shell. Cloning a running command can start duplicate
    servers or jobs.

14. Keep terminal output fixed during hover and focus. Overlay small controls
    instead of adding temporary padding that moves the glyph grid.

15. Keep inactive workspaces mounted. Scope tests and DOM queries to the visible
    workspace.

16. Test icons at their shipping size. A detailed shape can turn into a smudge
    at 14px.

17. Reduce resting controls. Put related pane actions behind one menu and show
    status on that same control when possible.

18. Place an opaque popup outside ancestors that animate opacity. A solid child
    still fades with its parent.

19. Wait for CSS animations before you measure opacity or geometry.

20. Derive decorative surfaces from the active terminal theme. Use audited
    semantic tokens for navigation text and controls.

21. Install observers early when a test must detect a short-lived state. At
    document start, observe `document` because `documentElement` may not exist.

22. Composite transparent backgrounds through their ancestors before you test
    contrast.

23. Draw a continuous focus border with an inset overlay above pane content.
    Borders on the pane can sit below the terminal or clip at an ancestor.

24. Keep focus geometry constant. Change colour or shadow without changing box
    size.

25. Use one sidebar element in expanded and collapsed states. A shared icon
    track keeps controls in place.

26. Keep all primary gutters on one spacing token. Measure rendered box edges
    instead of reading CSS variables alone.

27. Measure the surface that creates a borderless edge. Check the gutter against
    both neighbouring surfaces in every theme.

28. Drive state sweeps one step at a time from the browser harness. Confirm that
    each step reached a different state before you trust the results.

29. Check rendered boxes when a test makes a visual claim. Hidden DOM nodes still
    exist and still match selectors.

30. Run a CSS structure check after comment edits. Stray prose outside a comment
    can make the parser drop the next rule.

31. Keep source files small and assemble the single release file with a
    deterministic build. Single-file delivery does not require single-file
    authorship.

32. Define explicit theme tokens for text, fields, selection, danger, focus, and
    surfaces. One colour-mix formula cannot protect every contrast pair.

33. Use a low-opacity pattern as a second workspace cue. Keep it behind the
    glyph layer and include it in rendered contrast checks.

34. Detect ttyd by the `/token` response shape. A successful HTTP response can
    still contain a static host's HTML or error body.

35. Build documentation with the production layout and controls. A split guide
    should use a real split tree, and a theme guide should use the real picker.

36. Keep security boundaries separate. Loopback binding, Origin checks, Basic
    Auth, TLS, shell quoting, and tmux solve different problems.

37. Generate the launch command and its flag descriptions from one module. This
    keeps instructions in sync with the command that users copy.

38. Keep runtime dispatch components free of branch-specific hooks. Put hooks in
    leaf renderers and test the probing-to-connected transition.

39. Use sibling buttons for a row and its action menu. Nested interactive
    controls break keyboard activation and accessibility semantics.

40. Give long documentation a labelled focusable scroll region. Reserve enough
    bottom space to scroll the final line above a fixed banner.

41. Render terminal documentation with the terminal font, size, line height, and
    plain background. Semantic HTML can remain in the DOM without turning output
    into cards or web prose.

42. Audit release copy against `/mnt/onetrust/ai-tells.md`. Use direct active
    sentences, remove em and en dashes, explain technical terms, and state the
    mechanism behind each conclusion.

43. A PTY byte stream has no process lifecycle. Detect command completion with
    shell-emitted semantic markers, not prompt matching or output-idle guesses.

44. Separate completion attention from system notification policy. Record an
    unread event first, then apply permission, visibility, focus, and privacy
    checks before asking the operating system to notify.

45. Consolidate product documentation with the product's own layout. A compact
    split overview can teach structure, controls, and features without extra
    navigation pages.

46. Capture release screenshots from the generated artifact, then inspect the
    final crop. Test fixtures can be correct while the image still truncates a
    label or gives empty space too much weight.

47. Make simulated terminal commands agree with the content in each pane. When
    split documentation represents separate files, unique filenames preserve
    the terminal metaphor and make the layout understandable at a glance.

48. Social preview metadata needs absolute public image URLs, explicit image
    dimensions, and useful alt text. Assert the metadata and the source image
    dimensions together so a replaced screenshot cannot silently break cards.

49. Derive attention indicators from the exact interaction target. A workspace
    summary should aggregate pane state, while focusing one pane clears only
    that pane. Ignore short background work so the marker stays meaningful.

50. Clipboard actions launched from custom menus must restore focus through the
    terminal's public API after the asynchronous clipboard read and paste. A
    visual pane ring does not prove that the terminal input can receive typing.

51. Capability-driven defaults should wait for a real probe, apply only to newly
    created resources, and expose an explicit opt-out. Never rewrite restored
    user choices when the environment changes.

52. Interactive PTYs echo commands before returning results. A capability probe
    must use framing bytes that cannot appear in the echoed command and parse a
    complete validated frame, not the first visible marker in terminal output.

53. Do not collapse capability absence and probe failure into one UI state. A
    genuine PATH miss, a read-only ttyd, and a failed WebSocket need different
    explanations plus a retry path.

54. Configuration fields that restart a process or connection need local edit
    drafts and an explicit commit boundary. Persisting each keystroke can run
    partial commands, churn sockets, and make destructive prefixes executable.

55. Dependency-less layout effects are multiplicative in mounted workspaces.
    Scope style reads and terminal fitting to actual appearance changes, then
    measure fit calls at realistic pane counts before adding memoization.

56. Components with local interaction state must have stable component identity.
    Defining them inside a parent render silently remounts them and can close
    menus or discard focus whenever unrelated state changes.

57. Dynamic favicons should be low-frequency, privacy-safe supplements to visible
    state. Render them from trusted theme tokens, use a static offline fallback,
    avoid names and commands, and never rely on color alone for attention.

58. Aggregate high-rate terminal output outside React state, publish only coarse
    visual levels at a fixed cadence, and keep transient activity out of saved
    configuration and accessible names.

59. Terminal mouse protocols can consume browser buttons before native actions run.
    Intercept only the conflicting button in capture phase, preserve the browser
    default, and explain when a platform selection mechanism is unavailable.

60. A setting labelled global needs one source of truth and one effective runtime
    value. If changing it restarts processes, state that in the control and test
    every mounted process rather than only the active one.

61. Pointer reordering needs an equivalent keyboard path. Keep stable item identity,
    persist the array order, and verify that moving an item does not activate it or
    remount its long-lived content.

62. A capability retry is diagnostic, not a policy change. Preserve the last known
    effective mode while probing so a retry cannot tear down running connections.

63. Treat restored identifiers as object-map input as well as React keys. Reject
    duplicates and inherited property names, or store keyed state in prototype-free
    maps.

64. Clamp context menus from their measured box after layout. Fixed height guesses
    fail when actions change, and initial focus must skip disabled menu items.

65. Reordering previews should stay ephemeral. Move visible rows under pointer
    control, persist once on release, and keep long-lived content in a stable DOM
    order when its visual order does not matter.

66. A layout leaf can outlive its tree position only when rendering ownership is
    independent of that position. Flatten stably keyed clients and derive their
    geometry from the tree before offering cross-branch drag operations.

67. Drag cancellation is a complete interaction path. Release capture, stop edge
    scrolling, clear every transient cue, suppress the trailing click, and restore
    keyboard focus without disposing the controlled resource.

68. Overlay controls must not buy visibility with permanent content padding. Reveal
    them only inside a bounded discovery area, keep the resource surface full-size,
    and preserve a keyboard focus path that does not move the content beneath it.

69. Sync a local form draft to stable entity identity, not object reference. Parent
    rerenders routinely create equivalent objects and must not erase active typing.

70. A selected pane and a focused terminal input are different states. Pointer
    activation should update both, while embedded controls retain their own focus.

71. Temporary visual suspension must preserve live and animated descendants. Toggle
    visibility on stable nodes so resize cannot reconnect clients or replay entrances.

72. Give responsive pane geometry and terminal fitting one ordered resize path. Commit
    the final rail and frame dimensions before paint, then report each distinct PTY grid
    once so a terminal multiplexer performs only its necessary redraw.

73. Window-manager maximize events can expose several valid viewport sizes. Keep visual
    geometry responsive, but wait for a short quiet period before fitting the emulator
    and PTY so intermediate grids do not make full-screen applications redraw twice.

74. A dead connection needs an explicit recovery control next to the state that reports
    it, and that control must rebuild only its own resource. Route the retry through the
    normal teardown path, guard the old handlers so late close and error callbacks cannot
    describe the attempt that replaced them, and return focus through the component's
    public API once the replacement is ready.
