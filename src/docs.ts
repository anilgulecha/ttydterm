/* Static hosts and file:// cannot open a ttyd terminal. In those modes the app
   shows four documentation workspaces. This typed model keeps the copy,
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
  fileName: string;
  blocks: DocBlock[];
}

/* The README uses the product's split layout to keep the overview compact. */
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
  'A terminal in your browser, with unix tools (ttyd, tmux) that you love and trust.';

const readmeMain: DocSection = {
  fileName: 'readme.md',
  blocks: [
    { kind: 'lead', spans: [em(README_LEAD)] },
    { kind: 'para', spans: [t('ttydterm adds workspaces, split panes, themes, tmux continuity, and command completion alerts to vanilla ttyd.')] },
    { kind: 'para', spans: [t('One offline '), code('index.html'), t(' contains the full interface.')] },
    { kind: 'para', spans: [t('Open '), em('Using it'), t(' for installation and setup.')] },
    { kind: 'para', spans: [link(REPO), t(' (MIT licensed)')] },
    { kind: 'heading', text: 'Contributions' },
    { kind: 'para', spans: [t('This project accepts contributions only as issues. Include your request and, optionally, a prompt you tested that builds the feature.')] },
    { kind: 'para', spans: [t('Please do not open pull requests. I only trust changes I build myself, in my own way.')] },
    { kind: 'para', spans: [t('Forks and experimentation are welcome. If you try something interesting, send me an email note. :)')] },
  ],
};

const readmeFeatures: DocSection = {
  fileName: 'features.md',
  blocks: [
    { kind: 'heading', text: 'Features' },
    { kind: 'list', items: [
      [em('Workspaces:'), t(' Keep projects and terminals separate, then drag their icons to set the order.')],
      [em('Split panes:'), t(' Arrange rows and columns, then exchange running terminals between pane slots.')],
      [em('Pane setup:'), t(' Choose each command and working directory.')],
      [em('tmux continuity:'), t(' Keep processes running through disconnects.')],
      [em('Completion alerts:'), t(' Mark finished commands and notify when away.')],
      [em('Themes:'), t(' Choose colors, patterns, fonts, and weights.')],
      [em('Keyboard control:'), t(' Navigate and search without the mouse.')],
      [em('Backup:'), t(' Export and restore your workspace configuration.')],
      [em('Offline:'), t(' Run the complete interface from one index.html.')],
      [em('Hackable:'), t(" Build your terminal just like you want it. I've set up the base.")],
    ] },
  ],
};

const readmeKeyboard: DocSection = {
  fileName: 'keyboard.md',
  blocks: [
    { kind: 'heading', text: 'Keyboard' },
    { kind: 'defs', items: [
      { term:'Alt + 1…9', detail:'switch workspace' },
      { term:'Alt + Arrow', detail:'move between panes' },
      { term:'Ctrl/⌘ + K or P', detail:'find a workspace or terminal' },
      { term:'Ctrl/⌘ + B', detail:'toggle the sidebar' },
      { term:'Ctrl/⌘ + ,', detail:'open global settings' },
      { term:'Ctrl/⌘ + Shift + ,', detail:'open workspace settings' },
      { term:'Escape', detail:'close a menu or dialog' },
    ] },
    { kind: 'para', spans: [t('Right-click a pane for splits, paste, settings, and close. Move to the top-left corner of a pane to reveal its exchange handle. Drag the handle onto another pane, or focus it and use Enter, the arrow keys, and Enter again.')] },
  ],
};

const usingIt: DocSection = {
  fileName: 'using-it.md',
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
    { kind: 'para', spans: [t('Turn on '), em('Use tmux when available'), t(' in global settings. ttydterm starts every command in a tmux session. When the browser or ttyd disconnects, the process keeps running. The pane reconnects to the same session later.')] },
    { kind: 'para', spans: [t('ttydterm checks for tmux in the PATH used by ttyd’s login shell. If it is installed but not found, run '), em('command -v tmux'), t(' in a pane and update that shell’s login PATH.')] },
    { kind: 'para', spans: [t('The process lasts while the tmux server and session run. A host reboot or a stopped tmux session ends it.')] },
  ],
};

const themes: DocSection = {
  fileName: 'themes.md',
  blocks: [
    { kind: 'lead', spans: [em('Each workspace keeps its own theme.')] },
    { kind: 'para', spans: [t('Choose a theme below. The app repaints this workspace at once. Other workspaces keep their current themes.')] },
    { kind: 'themes' },
    { kind: 'para', spans: [t('Open another page and return here to check the saved choice. A real ttyd session puts this control in each workspace settings dialog. Open global settings with '), code('Ctrl/⌘ + ,'), t(' for app-wide font, tmux, and notification choices.')] },
    { kind: 'para', spans: [t('Every built-in theme passes the text and focus contrast checks in the test suite.')] },
    { kind: 'para', spans: [t('This demo keeps changes in memory. It does not replace a saved terminal workspace.')] },
  ],
};

const security: DocSection = {
  fileName: 'security.md',
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
    { kind: 'heading', text: 'Keep notifications private' },
    { kind: 'para', spans: [t('Completion notifications name only the workspace because operating systems can show notification text on a lock screen. They require explicit browser permission, a secure origin, and an open ttydterm page.')] },
  ],
};

/* Keep README first. Each page uses a different pattern. */
export const DOC_PAGES: DocPage[] = [
  { id:'readme', name:'README', title:'README', icon:'book', pattern:'dots', theme:'paper', layout:'demo-split',
    sections:[readmeMain, readmeFeatures, readmeKeyboard] },
  { id:'using', name:'Using it', title:'Using it', icon:'rocket', pattern:'grid', theme:'daylight', layout:'single', sections:[usingIt] },
  { id:'themes', name:'Themes', title:'Themes', icon:'palette', pattern:'waves', theme:'night', layout:'single', sections:[themes] },
  { id:'security', name:'Security', title:'Security', icon:'shield', pattern:'bricks', theme:'paper', layout:'single', sections:[security] },
];

export const docPage = (id: string | undefined): DocPage | null =>
  DOC_PAGES.find((page) => page.id === id) || null;
