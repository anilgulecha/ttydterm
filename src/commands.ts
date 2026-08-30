/* Pure shell-command construction. Keep all untrusted workspace/pane values
   behind these functions; rendering and websocket code must not concatenate
   shell fragments itself. */

import type { PaneLaunchOptions } from './types';

export const shellQuote = (value: string): string => `'${String(value).replace(/'/g, `'"'"'`)}'`;

/* ---------------------------------------------------------------------
   THE canonical ttyd launch command.

   Every place that shows a user how to start ttydterm — the in-app README,
   "Using it", Security, and the demo banner's Copy button — renders THIS
   string. When the flags were duplicated as prose in four places they drifted:
   one copy still carried ttyd's `-a` (which this app never needed) while the
   others had dropped it.

   Credentials: an explicit Bash wrapper makes the silent `read` behave the
   same from Bash, Zsh, and other calling shells. The literal password never
   appears in the saved command or shell history. ttyd itself still receives it
   as an argument (`-c user:password`), which is visible to other processes on
   the host, and HTTP Basic Auth is only as private as its transport — loopback
   here, TLS if it is ever exposed.
   --------------------------------------------------------------------- */
export const TTYD_USER = 'ttydterm';
export const TTYD_PORT = 7681;
export const TTYD_INDEX = '"$HOME/ttydterm.html"';
export const TTYD_URL = `http://localhost:${TTYD_PORT}`;

/* The flag list, once, in the order the command uses them. The Security page
   renders its explanations from these same keys so no flag can be documented
   that is not shipped, and none can ship undocumented. */
export const TTYD_FLAGS: ReadonlyArray<readonly [string, string]> = [
  ['-i 127.0.0.1', 'Binds the listener to the loopback interface only, so nothing off this machine can reach it.'],
  [`-p ${TTYD_PORT}`, 'The TCP port ttyd listens on.'],
  ['-W', 'Makes the terminal writable; without it the browser could only watch output.'],
  ['-O', 'Rejects WebSocket upgrades whose Origin header is not this server. It is an origin check, not a CORS switch and not authentication.'],
  [`-c ${TTYD_USER}:…`, 'Turns on HTTP Basic Auth in the browser; the password comes from the silent prompt, never from the literal command.'],
  ['-I "$HOME/ttydterm.html"', 'Serves this custom index instead of ttyd\u2019s stock page, so the UI is same-origin with /token and /ws.'],
  ['-t cursorBlink=false', 'A steady cursor: a dozen panes blinking on their own phases is the noisiest thing on screen.'],
  ['bash -l', 'The command ttyd runs for each connection — a login shell.'],
];

export const ttydLaunchCommand = (): string =>
  `bash -c 'read -rsp "ttydterm password: " TTYDTERM_PASSWORD || exit; echo; ` +
  `ttyd -i 127.0.0.1 -p ${TTYD_PORT} -W -O -c "${TTYD_USER}:$TTYDTERM_PASSWORD" ` +
  `-I ${TTYD_INDEX} -t cursorBlink=false bash -l; ` +
  `status=$?; unset TTYDTERM_PASSWORD; exit $status'`;

/* Downloading the single file is part of the same one-command story. */
export const ttydDownloadCommand = (): string =>
  'curl -fL https://raw.githubusercontent.com/anilgulecha/ttydterm/main/index.html -o "$HOME/ttydterm.html"';

/* Quoting a literal `~/` prevents shell tilde expansion. Expand only the
   leading home shorthand ourselves, then quote the remainder safely. */
export const shellCwd = (value: string): string => {
  const path = String(value || '~').trim();
  if (path === '~' || path === '~/') return '"$HOME"';
  if (path.startsWith('~/')) return '"$HOME"/' + shellQuote(path.slice(2));
  return shellQuote(path);
};

export const ttydSessionName = (folderLabel: string, paneId: string): string =>
  ('ttydterm-' + folderLabel + '-' + paneId)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .slice(0, 64);

export const tmuxLaunchCommand = (cwd: string, session: string): string => {
  const target = shellQuote(session);
  return `cd -- ${cwd} && (tmux has-session -t ${target} 2>/dev/null || tmux new-session -d -s ${target}) && tmux set-option -t ${target} mouse on && tmux set-option -t ${target} status off && (tmux unbind-key -n MouseDown3Pane 2>/dev/null || true) && exec tmux attach-session -t ${target}`;
};

export const paneLaunchCommand = ({ cwd, command, persist, folderLabel, paneId }: PaneLaunchOptions): string => {
  const safeCwd = shellCwd(cwd);
  const launch = persist
    ? tmuxLaunchCommand(safeCwd, ttydSessionName(folderLabel, paneId))
    : `cd -- ${safeCwd} && ${command || 'exec bash -l'}`;
  /* ttyd starts bash before the client can attach. The initialization line
     would otherwise be echoed as if the user typed it. Clear only after the
     shell has accepted the complete line, immediately before the real launch. */
  return `printf '\\033[2J\\033[H'; ${launch}`;
};
