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
