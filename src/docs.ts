/* Static hosts and file:// cannot open a ttyd terminal. In those modes the app
   shows seven documentation workspaces. This typed model keeps the copy,
   layout, and live theme picker separate from the React renderer. */

import { TTYD_FLAGS, TTYD_URL, ttydDownloadCommand, ttydLaunchCommand } from './commands';
import type { PatternName } from './types';

export type DocSpan =
  | { kind: 'text'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string };

export const t = (text: string): DocSpan => ({ kind: 'text', text });
export const em = (text: string): DocSpan => ({ kind: 'em', text });
export const code = (text: string): DocSpan => ({ kind: 'code', text });
export const link = (href: string, text = href): DocSpan => ({ kind: 'link', href, text });

export type DocBlock =
  | { kind: 'lead'; spans: DocSpan[] }
  | { kind: 'para'; spans: DocSpan[] }
  | { kind: 'heading'; text: string }
  | { kind: 'command'; caption?: string; command: string }
  | { kind: 'list'; items: DocSpan[][] }
  | { kind: 'defs'; items: Array<{ term: string; detail: string }> }
  | { kind: 'themes' };

export interface DocSection {
  blocks: DocBlock[];
}

/* The Customizations page uses the split layout that its text describes. */
export type DocLayout = 'single' | 'demo-split';

export interface DocPage {
  id: string;
  name: string;
  title: string;
  icon: string;
  pattern: PatternName;
  theme: string;
  layout: DocLayout;
  sections: DocSection[];
}

const REPO = 'https://github.com/anilgulecha/ttydterm';

export const README_LEAD =
  'ttydterm puts a terminal workspace in your browser. ttyd serves one custom index.html file with the full interface.';

const readme: DocSection = {
  blocks: [
    { kind: 'lead', spans: [em(README_LEAD)] },
    { kind: 'para', spans: [t('Start it with this command on your computer:')] },
    { kind: 'command', command: ttydLaunchCommand() },
    { kind: 'para', spans: [link(REPO), t(' (MIT licensed)')] },
    { kind: 'para', spans: [t('ttyd serves this offline index.html. The page reads the session token from /token and connects to the terminal at /ws on the same origin. The file bundles xterm.js, React, and all styles, so the interface loads without a runtime network dependency.')] },
    { kind: 'para', spans: [t('The sidebar holds workspaces. Each workspace has its own theme, pane layout, and commands. A pane can run its command in tmux so the process stays alive after the browser disconnects.')] },
    { kind: 'para', spans: [t('Open '), em('Using it'), t(' in the sidebar for install and run steps.')] },
  ],
};

const usingIt: DocSection = {
  blocks: [
    { kind: 'lead', spans: [em('Install ttyd and tmux, save this file in your home directory, and start ttydterm when you need it.')] },
    { kind: 'heading', text: '1. Install ttyd and tmux' },
    { kind: 'command', caption: 'Homebrew / macOS', command: 'brew install ttyd tmux' },
    { kind: 'command', caption: 'Debian / Ubuntu', command: 'sudo apt install ttyd tmux' },
    { kind: 'command', caption: 'Fedora', command: 'sudo dnf install ttyd tmux' },
    { kind: 'command', caption: 'Arch', command: 'sudo pacman -S ttyd tmux' },
    { kind: 'heading', text: '2. Download ttydterm' },
    { kind: 'command', command: ttydDownloadCommand() },
    { kind: 'heading', text: '3. Start ttydterm' },
    { kind: 'para', spans: [t('Replace '), code('user:password'), t(' with credentials you choose, then run this command after each computer boot:')] },
    { kind: 'command', command: ttydLaunchCommand() },
    { kind: 'para', spans: [t('Open '), link(TTYD_URL), t('. The browser asks for the username and password before it opens the terminal.')] },
    { kind: 'heading', text: 'Keep a process alive with tmux' },
    { kind: 'para', spans: [t('Turn on '), em('Run in tmux'), t(' in a pane. ttydterm starts the command in a tmux session. When the browser or ttyd disconnects, the process keeps running. The pane reconnects to the same session later.')] },
    { kind: 'para', spans: [t('The process lasts while the tmux server and session run. A host reboot or a stopped tmux session ends it.')] },
  ],
};

const keyboard: DocSection = {
  blocks: [
    { kind: 'lead', spans: [em('The app keeps the full shortcut list behind the keyboard icon in the sidebar footer.')] },
    { kind: 'para', spans: [t('Expand a collapsed sidebar with the top panel button or '), code('Ctrl/⌘ + B'), t(', then select the keyboard icon.')] },
    { kind: 'heading', text: 'Useful shortcuts' },
    { kind: 'list', items: [
      [code('Alt + 1…9'), t(': open that workspace and focus its last terminal.')],
      [code('Alt + Arrow'), t(': move between panes in the current workspace.')],
      [code('Ctrl/⌘ + K'), t(': find and focus a workspace or terminal.')],
      [code('Ctrl/⌘ + B'), t(': collapse or expand the sidebar.')],
      [code('Ctrl/⌘ + ,'), t(': open global settings. Add Shift to open settings for the current workspace.')],
      [code('Escape'), t(': close the open menu or dialog.')],
    ] },
    { kind: 'para', spans: [t('The app handles these shortcuts before xterm receives them. It sends all other keys to the process in the pane.')] },
  ],
};

const themes: DocSection = {
  blocks: [
    { kind: 'lead', spans: [em('Each workspace keeps its own theme.')] },
    { kind: 'para', spans: [t('Choose a theme below. The app repaints this workspace at once. Other workspaces keep their current themes.')] },
    { kind: 'themes' },
    { kind: 'para', spans: [t('Open another page and return here to check the saved choice. A real ttyd session puts this control in each workspace settings dialog and in global settings at '), code('Ctrl/⌘ + ,'), t('.')] },
    { kind: 'para', spans: [t('Every built-in theme passes the text and focus contrast checks in the test suite.')] },
    { kind: 'para', spans: [t('This demo keeps changes in memory. It does not replace a saved terminal workspace.')] },
  ],
};

const customizationsLeft: DocSection = {
  blocks: [
    { kind: 'lead', spans: [em('Each workspace keeps its own pane layout.')] },
    { kind: 'para', spans: [t('This page shows equal left and right columns. The right column has a top pane and a bottom pane.')] },
    { kind: 'para', spans: [t('Right-click a pane to open its menu. You can split it into 2, 3, or 4 columns or rows. The menu also opens settings, pastes text, and closes the pane.')] },
    { kind: 'para', spans: [t('Drag a divider to resize two panes. You can also focus the divider with Tab and use the arrow keys.')] },
  ],
};
const customizationsTop: DocSection = {
  blocks: [
    { kind: 'para', spans: [em('Each pane has its own command.'), t(' Open pane settings and enter a development server, log command, editor, or shell command.')] },
  ],
};
const customizationsBottom: DocSection = {
  blocks: [
    { kind: 'para', spans: [em('Each pane has its own tmux setting.'), t(' Turn on '), em('Run in tmux'), t(' for a process that should survive a browser or ttyd disconnect.')] },
  ],
};

const security: DocSection = {
  blocks: [
    { kind: 'lead', spans: [em('A writable browser terminal can run every command that your shell account can run. Review each launch flag before you start it.')] },
    { kind: 'command', command: ttydLaunchCommand() },
    { kind: 'defs', items: TTYD_FLAGS.map(([term, detail]) => ({ term, detail })) },
    { kind: 'heading', text: 'Keep one origin' },
    { kind: 'para', spans: [t('ttyd serves this page, /token, and /ws from one origin. The page only calls that origin. This setup needs no cross-origin browser permission. The '), code('-O'), t(' flag rejects a WebSocket request when its Origin header names another server.')] },
    { kind: 'heading', text: 'Use authentication and trusted commands' },
    { kind: 'para', spans: [t('Basic Auth checks a username and password before ttyd opens the terminal. Your shell still runs every pane command and every command from a restored configuration. Review a saved configuration as you would review a shell script.')] },
    { kind: 'para', spans: [t('The direct command includes the Basic Auth credential after '), code('-c'), t('. Do not put the credential in a URL, ttydterm setting, or backup. Your shell may save the command in its history.')] },
    { kind: 'heading', text: 'Keep the loopback binding' },
    { kind: 'para', spans: [code('-i 127.0.0.1'), t(' accepts connections from this computer only. If you bind ttyd to another interface, add TLS. Plain HTTP exposes Basic Auth credentials to anyone who can read the traffic.')] },
    { kind: 'heading', text: 'Use tmux for continuity' },
    { kind: 'para', spans: [t('tmux keeps a process alive across a browser or ttyd restart. It does not restrict the process, and a host reboot stops it.')] },
  ],
};

const contributing: DocSection = {
  blocks: [
    { kind: 'lead', spans: [em('This repository accepts issues instead of pull requests.')] },
    { kind: 'para', spans: [t('The maintainer makes repository changes. Open an issue when you want to suggest a change or report a bug.')] },
    { kind: 'heading', text: 'Suggest a change' },
    { kind: 'list', items: [
      [t('Ask your coding agent to open an issue at '), link(REPO + '/issues', REPO + '/issues'), t('.')],
      [t('State what should change and why.')],
      [t('Include an implementation prompt with enough detail for a coding agent to make the change in this repository.')],
    ] },
    { kind: 'para', spans: [t('The maintainer may use the suggestion when time allows.')] },
    { kind: 'para', spans: [t('For a bug, include steps to reproduce it, your browser, and your ttyd version.')] },
  ],
};

/* Keep README first. Each page uses a different pattern. */
export const DOC_PAGES: DocPage[] = [
  { id:'readme', name:'README', title:'README', icon:'book', pattern:'dots', theme:'paper', layout:'single', sections:[readme] },
  { id:'using', name:'Using it', title:'Using it', icon:'rocket', pattern:'grid', theme:'daylight', layout:'single', sections:[usingIt] },
  { id:'keyboard', name:'Keyboard', title:'Keyboard shortcuts', icon:'keyboard', pattern:'cross', theme:'mist', layout:'single', sections:[keyboard] },
  { id:'themes', name:'Themes', title:'Themes', icon:'palette', pattern:'waves', theme:'night', layout:'single', sections:[themes] },
  { id:'customizations', name:'Customizations', title:'Customizations', icon:'layers', pattern:'diagonal', theme:'sand', layout:'demo-split',
    sections:[customizationsLeft, customizationsTop, customizationsBottom] },
  { id:'security', name:'Security', title:'Security', icon:'shield', pattern:'bricks', theme:'paper', layout:'single', sections:[security] },
  { id:'contributing', name:'Contributing', title:'Contributing', icon:'users', pattern:'plain', theme:'daylight', layout:'single', sections:[contributing] },
];

export const docPage = (id: string | undefined): DocPage | null =>
  DOC_PAGES.find((page) => page.id === id) || null;
