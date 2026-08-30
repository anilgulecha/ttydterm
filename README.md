# ttydterm

**Current version: 1.2.** The sidebar shows the same version below the
`ttydterm` name.

ttydterm adds workspaces, split panes, themes, and tmux support to vanilla ttyd.
It ships as one offline `index.html` file. ttyd serves that file and the terminal
endpoints from the same origin.

## Modes

The same file supports three modes:

- ttyd mode connects xterm.js panes to the same-origin `/token` and `/ws`
  endpoints.
- Documentation mode runs on a static host or from `file://`. It shows seven
  terminal-style help workspaces and leaves saved terminal settings unchanged.
- Mock mode uses `?mock=1` for deterministic browser tests.

## Source files

`src/` holds the canonical source. `build.mjs` generates `index.html`.

```text
src/template.html   document shell and inline build slots
src/styles.css      themes and layout styles
src/app.tsx         React application and terminal runtime
src/modal.tsx       shared modal and form controls
src/types.ts        runtime, config, and layout types
src/commands.ts     ttyd, shell, and tmux command builders
src/docs.ts         documentation pages
src/version.ts      application version
build.mjs           typecheck, bundle, and offline assembly
test.mjs            browser, accessibility, and contrast tests
index.html          generated release file
```

The project uses global Bun and TypeScript. It has no package manifest, lockfile,
or local `node_modules` directory.

## Build

```bash
bun run build.mjs
```

The build runs strict TypeScript checks, downloads pinned build inputs, bundles
them, and writes one offline HTML file. The output makes no runtime network
requests for scripts or styles.

## Preview

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

A static server opens documentation mode.

## Run with ttyd

Install ttyd and tmux with your package manager.

```bash
# Homebrew / macOS
brew install ttyd tmux

# Debian / Ubuntu
sudo apt install ttyd tmux

# Fedora
sudo dnf install ttyd tmux

# Arch
sudo pacman -S ttyd tmux
```

Download the release file:

```bash
curl -fL https://www.gulecha.org/ttydterm/index.html -o "$HOME/ttydterm.html"
```

Replace `user:password` with credentials you choose, then start ttydterm after
each computer boot:

```bash
ttyd -i 127.0.0.1 -p 7681 -W -O -c user:password -I "$HOME/ttydterm.html" -t cursorBlink=false bash -l
```

Open <http://localhost:7681>. The browser asks for the username and password
before it opens the terminal.

The command binds ttyd to `127.0.0.1`. Keep that default for local use. If you
bind ttyd to another interface, add TLS. Plain HTTP exposes Basic Auth
credentials to anyone who can read the traffic.

The direct command includes the Basic Auth credential after `-c`. Do not put the
credential in a URL, ttydterm setting, or backup. Your shell may save the command
in its history.

The launch flags have these jobs:

| Flag | Purpose |
|---|---|
| `-i 127.0.0.1` | Accept connections from this computer only |
| `-p 7681` | Listen on port 7681 |
| `-W` | Allow terminal input |
| `-O` | Reject WebSocket requests with another Origin |
| `-c user:password` | Require HTTP Basic Auth with credentials you choose |
| `-I "$HOME/ttydterm.html"` | Serve the ttydterm interface |
| `-t cursorBlink=false` | Use a steady cursor |
| `bash -l` | Start a login shell |

The `-I` flag keeps the page, `/token`, and `/ws` on one origin. The browser
needs no cross-origin permission. The `-O` flag checks the WebSocket Origin; it
does not provide authentication.

Pane commands and restored configurations contain executable shell input.
Review a backup before you restore it. tmux keeps a process alive after a browser
or ttyd disconnect. A host reboot or stopped tmux session ends that process.

## Command completion

Each completed Bash command marks its workspace in the sidebar until that
workspace is opened. Enable **Notify when commands finish** in global settings
to also show a system notification when the workspace is inactive or the page
is hidden or unfocused. Enabling the setting asks for browser permission. The
notification names only the workspace and does not expose command text or
terminal output on the lock screen.

Completion tracking uses OSC 133 markers installed in ttydterm-managed Bash
shells. ttydterm enables passthrough only on the tmux sessions it manages; it
does not change the user's global tmux configuration. Programs inside SSH,
nested shells, or full-screen applications need their own compatible shell
integration. Notifications require the page to remain open and require browser
support on a secure origin such as localhost or HTTPS.

## Interface rules

The main view shows text only in terminals, the product name and version, and
workspace names. Buttons use pictograms. Dialogs, menus, the command palette,
and pane settings show labels when the user opens them.

The interface follows these layout rules:

1. Hover and focus do not move terminal output.
2. Every primary gutter uses `--gap`.
3. Inactive workspaces stay mounted, so switching does not restart terminals.
4. Settings take effect when the user changes them.
5. Text, controls, and focus rings meet their contrast targets in every built-in
   theme.
6. Reduced-motion mode removes nonessential animation.

## Workspace model

```jsonc
{
  "version": 7,
  "ui": {
    "railWidth": 176,
    "railOpen": true,
    "fontSize": 13,
    "fontWeight": "regular",
    "notifyOnCommandFinish": false
  },
  "folders": [{
    "id": "f-jr",
    "name": "project",
    "cwd": "~/work/project",
    "icon": "code",
    "theme": "night",
    "pattern": "dots",
    "layout": {
      "type": "split",
      "axis": "columns",
      "sizes": [0.56, 0.44],
      "children": [
        { "type": "pane", "id": "p-1", "command": "pi", "persist": true },
        {
          "type": "split",
          "axis": "rows",
          "sizes": [0.55, 0.45],
          "children": []
        }
      ]
    }
  }]
}
```

`columns` places panes side by side. `rows` stacks panes. Each `sizes` array
stores fractions that add up to 1. The layout grows its scrollable canvas when a
pane would fall below its minimum size.

Each workspace stores its own theme and pattern. Activating a workspace applies
its palette to the terminals, stage, dialogs, and sidebar. The app keeps every
workspace mounted and hides inactive surfaces with `visibility`, which preserves
terminal sessions and layout measurements.

## Controls

| Action | Result |
|---|---|
| Hover or focus a workspace | Show its menu button |
| Double-click a workspace | Open workspace settings |
| Right-click a pane | Open the pane menu |
| Drag a pane divider | Resize its two neighbours |
| Focus a divider and press an arrow key | Resize with the keyboard |
| Drag the sidebar edge | Resize the sidebar from 148px to 420px |
| `Alt+1` through `Alt+9` | Open a workspace |
| `Alt+Arrow` | Move between panes |
| `Ctrl/⌘+K` or `Ctrl/⌘+P` | Open the command palette |
| `Ctrl/⌘+B` | Toggle the sidebar |
| `Ctrl/⌘+,` | Open global settings |
| `Ctrl/⌘+Shift+,` | Open current workspace settings |
| `Escape` | Close the open menu or dialog |

The workspace menu and pane menu use separate sibling controls, so keyboard
input reaches each button. Pane right-click remains available for tmux panes.

## Themes and contrast

Each built-in theme defines terminal colours and semantic interface tokens. The
test suite checks every text colour at 4.5:1 or higher. It checks controls,
borders, and focus rings at 3:1 or higher. The browser tests also measure the
rendered colours after opacity and background composition.

Patterns add a non-colour workspace cue behind terminal text. Their low opacity
does not change the tested text background.

## Documentation mode

Documentation mode shows these workspaces in order:

1. README
2. Using it
3. Keyboard
4. Themes
5. Customizations
6. Security
7. Contributing

Each page renders as monospace file output inside a terminal surface. Long pages
provide a labelled focusable scroll region. The fixed setup banner leaves enough
bottom space for the final output line at desktop, tablet, and phone widths.

The Themes page uses the same accessible theme picker as the app. The
Customizations page uses a real split tree. Documentation mode keeps all changes
in memory and does not write a terminal workspace to local storage.

## Test

```bash
python3 -m http.server 8791 &
BASE=http://127.0.0.1:8791/ node test.mjs
```

The browser suite covers:

- boot, routes, dialogs, and persistence
- split creation and pointer or keyboard resizing
- stable hover, focus, and workspace-switch geometry
- sidebar expansion, collapse, resize, and keyboard access
- pane focus and right-click menus
- theme retention and rendered contrast
- static documentation order, copy, layout, and non-persistence
- monospace documentation output and keyboard scrolling
- secure launch-command flags and password handling
- OSC command-completion parsing, workspace indicators, and notification policy
- real ttyd probing without React hook-order changes
- reduced motion

Screenshots go to `/tmp/ttyd-shots`.

Before a release, run:

```bash
bun run build.mjs
BASE=http://127.0.0.1:8791/ node test.mjs
git diff --check
```

When build inputs change, build twice and compare `index.html` to confirm
deterministic output.
