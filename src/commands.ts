

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
  'curl -fL https://www.gulecha.org/ttydterm/index.html -o "$HOME/ttydterm.html"';

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

const BASH_INTEGRATION = [
  `__ttydterm_emit(){ if [ -n "${'${TMUX-}'}" ]; then printf '\\033Ptmux;\\033\\033]133;%s\\007\\033\\\\' "$1"; else printf '\\033]133;%s\\007' "$1"; fi; }`,
  `__ttydterm_preexec(){ __ttydterm_emit 'C;ttydterm'; }`,
  `__ttydterm_precmd(){ local s=$?; __ttydterm_emit "D;$s;ttydterm"; __ttydterm_emit 'A;ttydterm'; return "$s"; }`,
  `PS0='$(__ttydterm_preexec)'"${'${PS0-}'}"`,
  `if declare -p PROMPT_COMMAND 2>/dev/null | grep -q 'declare \\-a'; then PROMPT_COMMAND=(__ttydterm_precmd "${'${PROMPT_COMMAND[@]}'}"); else PROMPT_COMMAND="__ttydterm_precmd${'${PROMPT_COMMAND:+;${PROMPT_COMMAND}}'}"; fi`,
].join('; ');

const integrationSetup = (name: string): { setup: string; rcPath: string } => {
  const directory = `"$HOME/.cache/ttydterm"`;
  const rcPath = `"$HOME/.cache/ttydterm/${name}.bashrc"`;
  const initialCommand = `if [ -n "${'${TTYDTERM_INITIAL_COMMAND+x}'}" ]; then __ttydterm_command=$TTYDTERM_INITIAL_COMMAND; unset TTYDTERM_INITIAL_COMMAND; __ttydterm_preexec; ( eval -- "$__ttydterm_command" ); __ttydterm_status=$?; __ttydterm_emit "D;$__ttydterm_status;ttydterm"; unset __ttydterm_command __ttydterm_status; fi`;
  const startup = `if [ -r "$HOME/.bashrc" ]; then . "$HOME/.bashrc"; fi; ${BASH_INTEGRATION}; ${initialCommand}; rm -f -- "${'${BASH_SOURCE[0]}'}"`;
  return { setup:`umask 077; mkdir -p ${directory} && chmod 700 ${directory} && printf '%s\\n' ${shellQuote(startup)} > ${rcPath}`, rcPath };
};

const integratedBash = (command: string, rcPath: string): string => {
  const userCommand = command.trim();
  const initial = !userCommand || /^(?:exec +)?bash(?: +-(?:i|l|il|li))?$/.test(userCommand)
    ? '' : `TTYDTERM_INITIAL_COMMAND=${shellQuote(userCommand)} `;
  return `${initial}exec bash --noprofile --rcfile ${rcPath} -i`;
};

export const tmuxLaunchCommand = (cwd: string, session: string, command = 'bash', shellIntegration = false): string => {
  const target = shellQuote(session);
  const integration = integrationSetup(session);
  const waitForClient = `while ! tmux list-clients -F '#{client_session}' 2>/dev/null | grep -Fxq ${target}; do sleep .05; done`;
  const newSession = shellIntegration
    ? `(${integration.setup} && tmux new-session -d -s ${target} ${shellQuote(`${waitForClient}; ${integratedBash(command, integration.rcPath)}`)})`
    : `tmux new-session -d -s ${target}`;
  const passthrough = shellIntegration ? ` && (tmux set-option -t ${target} allow-passthrough on 2>/dev/null || true)` : '';
  return `cd -- ${cwd} && (tmux has-session -t ${target} 2>/dev/null || ${newSession}) && tmux set-option -t ${target} mouse on && tmux set-option -t ${target} status off${passthrough} && (tmux unbind-key -n MouseDown3Pane 2>/dev/null || true) && exec tmux attach-session -t ${target}`;
};

export const paneLaunchCommand = ({ cwd, command, persist, folderLabel, paneId, shellIntegration = false }: PaneLaunchOptions): string => {
  const safeCwd = shellCwd(cwd);
  const userCommand = command || 'bash';
  const session = ttydSessionName(folderLabel, paneId);
  if (persist) return `printf '\\033[2J\\033[H'; ${tmuxLaunchCommand(safeCwd, session, userCommand, shellIntegration)}`;
  if (!shellIntegration) return `printf '\\033[2J\\033[H'; cd -- ${safeCwd} && ${userCommand}`;
  const integration = integrationSetup(session);
  return `printf '\\033[2J\\033[H'; ${integration.setup} && cd -- ${safeCwd} && ${integratedBash(userCommand, integration.rcPath)}`;
};
