/* =====================================================================
   DOCUMENTATION MODEL

   Static hosting (and `file://`) has no ttyd behind it, so the app has nothing
   real to run. Instead of showing an empty shell it renders ITSELF as the
   documentation: seven workspaces, each a terminal-styled page.

   The content is DATA, not markup: a discriminated union of blocks and spans.
   That keeps the renderer small and total (every `kind` is handled once,
   checked by the compiler), lets one page embed a live control — the theme
   picker — without the doc layer knowing anything about React, and keeps the
   canonical launch command a single import rather than four prose copies.
   ===================================================================== */

import { TTYD_FLAGS, TTYD_URL, TTYD_USER, ttydDownloadCommand, ttydLaunchCommand } from './commands';
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
  /* The one sentence a page is built around: bigger, with real space above and
     below it, because a wall of even paragraphs has no entry point. */
  | { kind: 'lead'; spans: DocSpan[] }
  | { kind: 'para'; spans: DocSpan[] }
  | { kind: 'heading'; text: string }
  | { kind: 'command'; caption?: string; command: string }
  | { kind: 'list'; items: DocSpan[][] }
  | { kind: 'defs'; items: Array<{ term: string; detail: string }> }
  /* Interactive: renders the app's own accessible theme radios. */
  | { kind: 'themes' };

export interface DocSection {
  blocks: DocBlock[];
}

/* How a page's sections are arranged on screen. `demo-split` exists so the
   Customizations page can DEMONSTRATE a layout while describing it: equal
   left/right halves, the right half split into equal top/bottom panes. */
export type DocLayout = 'single' | 'demo-split';

export interface DocPage {
  id: string;
  /* Sidebar label. Kept short enough to survive a narrow rail; the page's own
     title carries the full wording. */
  name: string;
  title: string;
  icon: string;
  pattern: PatternName;
  theme: string;
  layout: DocLayout;
  sections: DocSection[];
}

const REPO = 'https://github.com/anilgulecha/ttydterm';

/* The exact opening sentence of the README page, kept as one constant so the
   regression test and the renderer cannot disagree about its wording. */
export const README_LEAD =
  'ttydterm is a terminal experience right in your browser. It uses ttyd, with a special customized index.html file to give you a great terminal experience right in your browser.';

const readme: DocSection = {
  blocks: [
    { kind: 'lead', spans: [em(README_LEAD)] },
    { kind: 'para', spans: [t('You start it with one command in a terminal on your own machine:')] },
    { kind: 'command', command: ttydLaunchCommand() },
    { kind: 'para', spans: [link(REPO), t(' '), t('(MIT licensed)')] },
    { kind: 'para', spans: [t('How it works: ttyd serves this one self-contained offline index.html, so the page has no network dependency of its own. The page then talks to the same origin it came from — /token for the session token and /ws for the terminal stream — and feeds that stream into the xterm.js bundled inside it.')] },
    { kind: 'para', spans: [t('From there the page is the workspace: several workspaces in the sidebar, each with its own split layout of panes, each pane running its own command. Panes marked to run in tmux keep their process alive when the browser disconnects.')] },
    { kind: 'para', spans: [t('Next, open '), em('Using it'), t(' in the sidebar — it has the install and run steps.')] },
  ],
};

const usingIt: DocSection = {
  blocks: [
    { kind: 'lead', spans: [em('Install ttyd and tmux, download this file to your home directory, then run one command each time you want a terminal in the browser.')] },
    { kind: 'heading', text: '1. Install ttyd and tmux' },
    { kind: 'command', caption: 'Homebrew / macOS', command: 'brew install ttyd tmux' },
    { kind: 'command', caption: 'Debian / Ubuntu', command: 'sudo apt install ttyd tmux' },
    { kind: 'command', caption: 'Fedora', command: 'sudo dnf install ttyd tmux' },
    { kind: 'command', caption: 'Arch', command: 'sudo pacman -S ttyd tmux' },
    { kind: 'heading', text: '2. Download ttydterm to your home directory' },
    { kind: 'command', command: ttydDownloadCommand() },
    { kind: 'heading', text: '3. Run it after each boot' },
    { kind: 'para', spans: [t('ttyd is a program on your machine, not a service that survives a restart, so after each PC boot you run this once in a terminal:')] },
    { kind: 'command', command: ttydLaunchCommand() },
    { kind: 'para', spans: [t('It asks for a password without echoing it, then starts. Visit '), link(TTYD_URL), t(' and the browser asks for HTTP Basic Auth credentials: the username is '), code(TTYD_USER), t(' and the password is the one you just typed at the prompt.')] },
    { kind: 'heading', text: 'Why tmux is worth having' },
    { kind: 'para', spans: [t('Turn on '), em('Run in tmux'), t(' for a pane and its process runs inside a tmux session instead of directly under ttyd. Closing the tab, losing the network, or restarting ttyd then leaves that process running: reconnect and the pane reattaches where it was.')] },
    { kind: 'para', spans: [t('This is process continuity, not permanence. It lasts as long as the tmux server and its session do — rebooting the host, or killing the session, ends it like any other process.')] },
  ],
};

const keyboard: DocSection = {
  blocks: [
    { kind: 'lead', spans: [em('The full, current list of keyboard shortcuts lives in the app itself.')] },
    { kind: 'para', spans: [t('Click the keyboard icon in the sidebar footer to open it. If the sidebar is collapsed to its icon column, expand it first with the panel toggle at the top of the sidebar, or with '), code('Ctrl/⌘ + B'), t('.')] },
    { kind: 'heading', text: 'The ones worth memorising' },
    { kind: 'list', items: [
      [code('Alt + 1…9'), t(' — jump to that workspace and refocus the terminal you last used there.')],
      [code('Alt + Arrow'), t(' — move between panes in the current workspace.')],
      [code('Ctrl/⌘ + K'), t(' — find any workspace or terminal by name and focus it.')],
      [code('Ctrl/⌘ + B'), t(' — collapse or expand the sidebar.')],
      [code('Ctrl/⌘ + ,'), t(' — global settings; add Shift for the current workspace’s settings.')],
      [code('Escape'), t(' — close whichever menu or dialog is open.')],
    ] },
    { kind: 'para', spans: [t('Everything else is your shell’s: application shortcuts are handled before the terminal sees them, and unrelated keys pass straight through to the process in the pane.')] },
  ],
};

const themes: DocSection = {
  blocks: [
    { kind: 'lead', spans: [em('Each workspace remembers its own theme.')] },
    { kind: 'para', spans: [t('Pick one below. This documentation workspace repaints as you choose — chrome, sidebar and terminals together — while the other pages keep whatever theme they already had.')] },
    { kind: 'themes' },
    { kind: 'para', spans: [t('Switch to another page in the sidebar and back to see it: the theme is a property of the workspace, not a global setting, so a dark workspace and a light one can sit next to each other.')] },
    { kind: 'para', spans: [t('In a real ttyd session the same control is in each workspace’s settings, and in '), code('Ctrl/⌘ + ,'), t('. Every theme ships accessible: all of its text colours clear WCAG AA against their own background, and the test suite recomputes that matrix on every build.')] },
    { kind: 'para', spans: [t('Nothing you change here is saved. Documentation mode never writes over a real saved workspace.')] },
  ],
};

const customizationsLeft: DocSection = {
  blocks: [
    { kind: 'lead', spans: [em('Every workspace has its own layout.')] },
    { kind: 'para', spans: [t('This page is a demonstration of one: equal left and right halves, with the right half split again into a top and a bottom pane.')] },
    { kind: 'para', spans: [t('Right-click any pane — including this one — to open its menu. From there you can split it into 2, 3 or 4 columns or rows, open its settings, paste, or close it.')] },
    { kind: 'para', spans: [t('Drag the divider between two panes to resize them, or focus it with Tab and use the arrow keys.')] },
  ],
};
const customizationsTop: DocSection = {
  blocks: [
    { kind: 'para', spans: [em('Each pane has its own command.'), t(' Open the pane menu, choose settings, and type what should run there — a dev server, a log tail, an editor.')] },
  ],
};
const customizationsBottom: DocSection = {
  blocks: [
    { kind: 'para', spans: [em('Each pane has its own tmux setting.'), t(' Tick '), em('Run in tmux'), t(' for the long-running ones. Panes can be resized, closed and reconfigured independently.')] },
  ],
};

const security: DocSection = {
  blocks: [
    { kind: 'lead', spans: [em('A writable terminal in a browser is exactly as powerful as a terminal. Here is what every part of the launch command does.')] },
    { kind: 'command', command: ttydLaunchCommand() },
    { kind: 'defs', items: TTYD_FLAGS.map(([term, detail]) => ({ term, detail })) },
    { kind: 'heading', text: 'Same origin, so no CORS' },
    { kind: 'para', spans: [t('ttyd serves this page, its /token endpoint and its /ws socket from one origin, and the page only ever calls that same origin with a matching scheme. Nothing here asks a browser for cross-origin permission, so there is no CORS configuration to get wrong. '), code('-O'), t(' is the other half of that: it refuses WebSocket upgrades whose Origin is somewhere else.')] },
    { kind: 'heading', text: 'What authentication does and does not do' },
    { kind: 'para', spans: [t('Basic Auth stops an unauthenticated visitor from reaching the terminal. It does not make the shell safe from what you type into it. Pane commands and restored configurations are trusted, executable shell input by design: that is the product. Treat a saved config the way you would treat a shell script.')] },
    { kind: 'para', spans: [t('The password prompt keeps the literal password out of your command line and shell history, but ttyd still receives it as a process argument, so anyone who can list processes on the host can see it.')] },
    { kind: 'heading', text: 'Loopback is the safe default' },
    { kind: 'para', spans: [code('-i 127.0.0.1'), t(' means only this machine can connect. If you ever bind it wider, HTTP Basic Auth over plain HTTP sends the credential in reconstructible form on every request — use TLS as well as authentication, or put it behind something that terminates TLS for you.')] },
    { kind: 'heading', text: 'tmux is continuity, not security' },
    { kind: 'para', spans: [t('Running a pane in tmux keeps its process and session alive across a browser or ttyd restart. It is not a security boundary and it does not survive a host reboot.')] },
  ],
};

const contributing: DocSection = {
  blocks: [
    { kind: 'lead', spans: [em('This repository does not accept pull requests.')] },
    { kind: 'para', spans: [t('Changes land through the maintainer, so a PR would only sit open. Instead, send the idea in a form that can be built.')] },
    { kind: 'heading', text: 'How to suggest something' },
    { kind: 'list', items: [
      [t('Ask your coding agent to open an issue on '), link(REPO + '/issues', REPO + '/issues'), t('.')],
      [t('Have it include the recommendation itself — what should change and why.')],
      [t('And the implementation prompt that builds it: enough detail that an agent could carry it out against this repository.')],
    ] },
    { kind: 'para', spans: [t('The maintainer may merge or incorporate that work when time permits. No promises about when.')] },
    { kind: 'para', spans: [t('Bug reports are welcome in the same place. A reproduction, the browser, and the ttyd version are usually enough.')] },
  ],
};

/* The seven pages, in reading order. README is the landing page in every
   documentation mode — static hosting and `file://` alike. (An earlier build
   promoted Setup to the front for `file://` only, which meant the two demo
   modes disagreed about what the product is.) Every page takes a DISTINCT
   pattern from the seven the app ships, so the workspace identity cue is
   unique per page. */
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
