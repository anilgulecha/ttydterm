# AGENTS.md

## Project

ttydterm is a terminal workspace for vanilla ttyd. It ships as one completely
offline `index.html` file that is also the GitHub Pages homepage.

Canonical source lives in `src/`; `index.html` is generated.

## Invariants

- Keep the distributable as one self-contained offline HTML file.
- Do not add runtime network dependencies.
- Do not add `package.json`, lockfiles, or local `node_modules`.
- Use globally installed Bun and TypeScript.
- Keep React, xterm.js, and addons pinned and bundled by `build.mjs`.
- Do not edit generated `index.html` directly.
- Preserve vanilla ttyd compatibility and same-origin `/token` and `/ws` use.
- Never place Basic Auth credentials in URLs, configuration, or backups.
- Default setup instructions must bind ttyd to `127.0.0.1`.
- Static hosting is documentation/demo mode; `file://` provides setup guidance.
- Demo documentation must not overwrite saved real-workspace configuration.
- Keep themes, controls, menus, terminal selections, and focus indicators
  WCAG-compliant.
- Respect `prefers-reduced-motion`.
- Preserve keyboard and screen-reader accessibility.
- Keep custom pane right-click available in tmux panes.

## Source layout

- `src/app.tsx`: application, terminal runtime, workspace behavior
- `src/modal.tsx`: shared modal and form primitives
- `src/types.ts`: configuration and runtime domain types
- `src/commands.ts`: shell and tmux command construction
- `src/themes.ts`: theme data, contrast auditing, and semantic token mapping
- `src/layout.ts`: pure pane-tree construction, traversal, and sizing
- `src/icons.tsx`: application and workspace SVG icon components
- `src/favicon.ts`: deterministic theme-aware favicon rendering
- `src/styles.css`: all styling and semantic theme tokens
- `src/template.html`: generated document shell
- `src/vendor-types/`: pinned local declarations for global runtime libraries
- `build.mjs`: strict typecheck, bundle, and offline assembly
- `test.mjs`: browser regression, accessibility, and contrast assertions
- `index.html`: generated release and Pages artifact

## Development

Build:

```bash
bun run build.mjs
```

Test:

```bash
python3 -m http.server 8791 &
BASE=http://127.0.0.1:8791/ node test.mjs
```

Before finishing a change, run:

```bash
bun run build.mjs
node test.mjs
git diff --check
```

Build twice and compare `index.html` when changing the build pipeline or vendor
inputs; output must be deterministic.

## Coding rules

- Keep TypeScript strict; do not weaken checks with broad `any`,
  `@ts-ignore`, or unchecked assertions.
- Treat localStorage, restored JSON, ttyd responses, and clipboard access as
  untrusted runtime boundaries.
- Use discriminated unions for layout, route, and runtime state.
- Use the shared `ModalShell` and `ModalForm`; views must not create their own
  dialog geometry.
- Use semantic theme tokens. Component CSS must not introduce fixed UI colors.
- Extract event data before passing work into deferred React state callbacks.
- Application shortcuts that must override xterm/tmux belong in capture-phase
  handling; unrelated terminal keys must pass through.
- Use xterm APIs such as `focus()` and `paste()` rather than manipulating its
  internal DOM.
- Avoid layout movement on hover, focus, workspace switching, or menu changes.
- Keep inactive workspaces mounted; switching workspaces must not restart
  terminals or animations.
- Add a regression test for every bug fix. Test the reported outcome, not only
  the intermediate state. For example, verify xterm's input receives focus, not
  merely that the pane ring changes.
- Record key generalized learnings about how problems are approached, corrected,
  and solved in `METALEARNINGS.md`; keep it as portable guidance, not a task log.

## GitHub Pages

`.github/workflows/pages.yml` builds on pushes to `main`, verifies that the
committed `index.html` matches the generated artifact, and deploys it as the
Pages homepage.

Do not commit a source change without its regenerated `index.html`.
