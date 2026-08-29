/* Pure shell-command construction. Keep all untrusted workspace/pane values
   behind these functions; rendering and websocket code must not concatenate
   shell fragments itself. */

import type { PaneLaunchOptions } from './types';

export const shellQuote = (value: string): string => `'${String(value).replace(/'/g, `'"'"'`)}'`;

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
