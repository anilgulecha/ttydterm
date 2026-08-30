

import type { PaneLaunchOptions } from './types';

export const shellQuote = (value: string): string => `'${String(value).replace(/'/g, `'"'"'`)}'`;

export const TTYD_AUTH = 'user:password';
export const TTYD_PORT = 7681;
export const TTYD_INDEX = '"$HOME/ttydterm.html"';
export const TTYD_URL = `http://localhost:${TTYD_PORT}`;

export const TTYD_FLAGS: ReadonlyArray<readonly [string, string]> = [
  ['-i 127.0.0.1', 'Binds the listener to the loopback interface only, so nothing off this machine can reach it.'],
  [`-p ${TTYD_PORT}`, 'The TCP port ttyd listens on.'],
  ['-W', 'Makes the terminal writable; without it the browser could only watch output.'],
  ['-O', 'Rejects WebSocket upgrades whose Origin header is not this server. It is an origin check, not a CORS switch and not authentication.'],
  [`-c ${TTYD_AUTH}`, 'Turns on HTTP Basic Auth. Replace user and password with credentials you choose. The browser asks for them before it opens the terminal.'],
  ['-I "$HOME/ttydterm.html"', 'Serves this custom index instead of ttyd\u2019s stock page, so the UI is same-origin with /token and /ws.'],
  ['-t cursorBlink=false', 'A steady cursor: a dozen panes blinking on their own phases is the noisiest thing on screen.'],
  ['bash -l', 'The command ttyd runs for each connection: a login shell.'],
];

export const ttydLaunchCommand = (): string =>
  `ttyd -i 127.0.0.1 -p ${TTYD_PORT} -W -O -c ${TTYD_AUTH} ` +
  `-I ${TTYD_INDEX} -t cursorBlink=false bash -l`;

export const ttydDownloadCommand = (): string =>
  'curl -fL https://raw.githubusercontent.com/anilgulecha/ttydterm/main/index.html -o "$HOME/ttydterm.html"';

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

  return `printf '\\033[2J\\033[H'; ${launch}`;
};
