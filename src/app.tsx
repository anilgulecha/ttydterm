import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { paneLaunchCommand, shellCwd, shellQuote, tmuxLaunchCommand, ttydLaunchCommand } from './commands';
import { DOC_PAGES, docPage } from './docs';
import { updateFavicon } from './favicon';
import { CountGlyph, Ico, WS_ICONS, WS_ICON_KEYS, WsIcon } from './icons';
import { countPanes, equal, findPane, layoutFrames, listPanes, mapTree, neighborPane, nodeMin, normalize, pane, removePane, splitPane, swapPanes, uid } from './layout';
import type { Direction, Frame } from './layout';
import type { DocBlock, DocPage, DocSection, DocSpan } from './docs';
import { Button, CheckboxField, Field, FieldGroup, ModalActions, ModalForm, ModalShell } from './modal';
import type {
  Capabilities, Config, Folder, FontWeight, LayoutNode, PaneNode, PatternName, Runtime,
  SplitAxis, SplitNode, Theme, TmuxState, TtydEndpoints, UiState, ValidationResult,
} from './types';
import { chromeVars, contrastAudit, paneGridIndex, seededPane, sidebarAtmosphereVars, softHorizonBackground, THEME_KEYS, THEMES, themeOf, themeVars } from './themes';
import { APP_VERSION } from './version';

window.__contrastAudit=contrastAudit;
window.__swapPanes=swapPanes;
window.__layoutFrames=layoutFrames;
window.__terminalAtmosphere = { seededPane, softHorizonBackground, paneGridIndex, sidebarAtmosphereVars };

const STORE_KEY = 'ttyd-workspace-v2';
const BG_KEY = 'ttyd-workspace-bg';
const CONFIG_VERSION = 8;
const FONT_SIZES = [11, 12, 13, 14, 16, 18];
const FONT_WEIGHTS: Array<{key:FontWeight;label:string;value:number}> = [{key:'regular',label:'Regular',value:400},{key:'semibold',label:'Semi bold',value:600},{key:'bold',label:'Bold',value:700}];
const PATTERNS: PatternName[] = ['plain','dots','grid','diagonal','cross','waves','bricks'];
const defaultPattern = (id: string): PatternName => PATTERNS[1 + (hash32(id) % (PATTERNS.length - 1))];
const GAP = (() => {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
  return Number.isFinite(v) && v > 0 ? v : 8;
})();
const FLOOR = 0.08;  // smallest share a slot may be dragged to (bounds canvas growth)

const RAIL_MIN = 148, RAIL_MAX = 420, RAIL_DEFAULT = 176;

const RAIL_COLLAPSED = 52;
const COMPLETION_ATTENTION_MS = 5000;

/* Activity: ephemeral output intensity per workspace. Never persisted. */
const ACTIVITY_TICK_MS = 250;      // coalescing cadence, well below a frame budget
const ACTIVITY_DECAY = 0.68;       // per tick; a saturated burst fades out in about 3 seconds
const ACTIVITY_FLOOR = 24;         // rolling bytes below this read as idle
const ACTIVITY_REFERENCE = 4096;   // rolling bytes that saturate the top level
const ACTIVITY_LEVELS = 3;
const ACTIVITY_GRACE_MS = 700;     // startup banner/launch echo is not user activity
const PRIMARY_SELECTION_HINT = 'Primary selection paste is unavailable here. Use right-click Paste.';
const BROWSER_RESIZE_SETTLE_MS = 140;
window.__primarySelectionHint = PRIMARY_SELECTION_HINT;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/* Pure: rolling byte total to a capped level. Log scale so a chatty tail and a
   quiet prompt still separate, and a flood cannot exceed the top bucket. */
const activityLevel = (bytes: number): number => {
  if (!Number.isFinite(bytes) || bytes < ACTIVITY_FLOOR) return 0;
  const ratio = Math.log(bytes / ACTIVITY_FLOOR + 1) / Math.log(ACTIVITY_REFERENCE / ACTIVITY_FLOOR + 1);
  return clamp(Math.ceil(ratio * ACTIVITY_LEVELS), 1, ACTIVITY_LEVELS);
};
window.__activityLevel = activityLevel;

/* Pure: a workspace override wins over the global size; anything else is global. */
const workspaceFontSize = (folderFontSize: number | undefined, globalFontSize: number): number =>
  typeof folderFontSize === 'number' && FONT_SIZES.includes(folderFontSize) ? folderFontSize : globalFontSize;
window.__workspaceFontSize = workspaceFontSize;

function defaultConfig(): Config {
  return {
    version: CONFIG_VERSION,
    ui: { railWidth: RAIL_DEFAULT, railOpen: true, fontSize: 13, fontWeight:'regular', notifyOnCommandFinish:false, useTmux:true },
    folders: [
      {
        id: 'f-jr', name: 'kalviumjr', cwd: '~/work/kalviumjr', icon: 'code', pattern: 'dots' as const, theme:'night',
        layout: {
          type: 'split' as const, axis: 'columns' as const, sizes: [0.56, 0.44],
          children: [
            pane('pi', true),
            { type: 'split' as const, axis: 'rows' as const, sizes: [0.55, 0.45],
              children: [ pane('npm run dev', true), pane('git status', true) ] },
          ],
        },
      },
      {
        id: 'f-infra', name: 'infra', cwd: '~/work/infra', icon: 'server', pattern: 'grid' as const, theme:'ocean',
        layout: { type: 'split' as const, axis: 'rows' as const, sizes: [0.62, 0.38],
          children: [ pane('k9s', true), pane('journalctl -f', true) ] },
      },
      { id: 'f-notes', name: 'notes', cwd: '~/notes', icon: 'book', pattern: 'diagonal' as const, theme:'paper', layout: pane('ls -la', true) },
    ],
  };
}

function validateConfig(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Not an object.' };
  const source = raw as { folders?: unknown; theme?: unknown; ui?: unknown };
  if (!Array.isArray(source.folders)) return { ok: false, error: 'Missing a `folders` array.' };
  const seen = new Set<string>(),seenFolders=new Set<string>();
  const freshId=(prefix:string,requested:unknown,used:Set<string>)=>{
    const safe=typeof requested==='string'&&requested&&!Object.prototype.hasOwnProperty.call(Object.prototype,requested);
    let id=safe&&!used.has(requested)?requested:uid(prefix);
    while(used.has(id))id=uid(prefix);used.add(id);return id;
  };
  const walk = (input: unknown, where: string): LayoutNode | null => {
    if (!input) return null;
    const n = input as Record<string, unknown>;
    if (n.type === 'pane') {
      if (typeof n.command !== 'string') throw new Error(where + ': pane needs a string `command`.');
      const id=freshId('p-',n.id,seen);
      /* tmux is a global policy: every restored pane follows it, whatever it stored. */
      return { type:'pane', id, command: n.command as string, persist: tmuxPolicy };
    }
    if (n.type === 'split') {
      if (!Array.isArray(n.children) || n.children.length < 2) throw new Error(where + ': split needs 2+ children.');
      const axis: SplitAxis = n.axis === 'rows' ? 'rows' : 'columns';
      const children = n.children
        .map((c: unknown, i: number) => walk(c, where + '/' + i))
        .filter((c): c is LayoutNode => !!c);
      if (children.length < 2) throw new Error(where + ': split needs 2+ valid children.');
      const sizes = Array.isArray(n.sizes) && n.sizes.length === children.length
        ? normalize((n.sizes as unknown[]).map(Number)) : equal(children.length);
      return { type:'split', axis, sizes, children };
    }
    throw new Error(where + ': unknown node type ' + JSON.stringify(n.type));
  };
  const rawUi = (source.ui && typeof source.ui === 'object' ? source.ui : {}) as Record<string, unknown>;
  const tmuxPolicy = rawUi.useTmux === undefined ? true : rawUi.useTmux === true;
  try {
    const folders: Folder[] = source.folders.map((entry: unknown, i: number) => {
      if (!entry || typeof entry !== 'object') throw new Error('folder ' + i + ' is not an object.');
      const f = entry as Record<string, unknown>;
      const legacyTheme = typeof source.theme === 'string' ? source.theme : null;
      return {
        id:freshId('f-',f.id,seenFolders),
        name: typeof f.name === 'string' ? f.name : '',
        cwd: typeof f.cwd === 'string' ? f.cwd : '~',
        theme: typeof f.theme === 'string' && THEMES[f.theme] ? f.theme
             : (legacyTheme && THEMES[legacyTheme] ? legacyTheme : 'paper'),
        icon: typeof f.icon === 'string' && WS_ICONS[f.icon] ? f.icon : null,
        pattern: PATTERNS.includes(f.pattern as PatternName) ? f.pattern as PatternName
               : defaultPattern(typeof f.id === 'string' ? f.id : String(i)),
        layout: walk(f.layout, 'folder ' + i),
        ...(FONT_SIZES.includes(Number(f.fontSize)) ? { fontSize: Number(f.fontSize) } : {}),
      };
    });
    if (!folders.length) throw new Error('Needs at least one folder.');
    const ui = {
      railWidth: clamp(Number(rawUi.railWidth) || RAIL_DEFAULT, RAIL_MIN, RAIL_MAX),
      railOpen: rawUi.railOpen === undefined ? true : !!rawUi.railOpen,
      fontSize: FONT_SIZES.includes(Number(rawUi.fontSize)) ? Number(rawUi.fontSize) : 13,
      fontWeight: FONT_WEIGHTS.some(({key})=>key===rawUi.fontWeight) ? rawUi.fontWeight as FontWeight : 'regular',
      notifyOnCommandFinish: rawUi.notifyOnCommandFinish === true,
      useTmux: tmuxPolicy,
    };
    return { ok: true, config: { version: CONFIG_VERSION, ui, folders } };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

function loadConfig(): Config {
  try {
    const res = validateConfig(JSON.parse(localStorage.getItem(STORE_KEY) || 'null'));
    if (res.ok) return res.config;
  } catch {}
  return defaultConfig();
}
const hasSavedConfig = () => {
  try { return !!localStorage.getItem(STORE_KEY); } catch { return false; }
};

const ttydEndpoints = (): TtydEndpoints => {
  const path = location.pathname.replace(/[/]+$/, '');
  return {
    token: location.protocol + '//' + location.host + path + '/token',
    ws: (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + path + '/ws',
  };
};
async function detectRuntime(): Promise<Runtime> {
  if (new URLSearchParams(location.search).has('mock')) return { mode:'mock', reason:'Browser-test mock mode.' };
  if (location.protocol === 'file:') return { mode:'file', reason:'This file is not being served by ttyd.' };
  const endpoints = ttydEndpoints();
  try {
    const response = await fetch(endpoints.token, { cache:'no-store' });
    if (!response.ok) return { mode:'demo', reason:'No ttyd token endpoint on this origin.' };
    const json = await response.json();
    if (!json || typeof json.token !== 'string') return { mode:'demo', reason:'This origin is a static website, not ttyd.' };
    return { mode:'ttyd', token:json.token, endpoints };
  } catch { return { mode:'demo', reason:'No ttyd server was detected.' }; }
}
interface CapabilityProbeResult { home:string; cwd:string; shell:string; tmux:boolean }
const capabilityProbeCommand=(marker:string):string => {
  const script=`command -v tmux >/dev/null 2>&1 && __ttydterm_tmux=1 || __ttydterm_tmux=0; printf '\\0%s\\0%s\\0%s\\0%s\\0%s\\0%s\\0' '${marker}' "$HOME" "$PWD" "$SHELL" "$__ttydterm_tmux" '${marker}'; unset __ttydterm_tmux`;
  return `sh -c ${shellQuote(script)}\r`;
};
const parseCapabilityProbeOutput=(output:string,marker:string):CapabilityProbeResult|null=>{
  const boundary='\0'+marker+'\0',start=output.lastIndexOf(boundary);
  if(start<0)return null;
  const previous=output.lastIndexOf(boundary,start-1);
  if(previous<0)return null;
  const values=output.slice(previous+boundary.length,start).split('\0');
  if(values.length!==4||(values[3]!=='0'&&values[3]!=='1'))return null;
  return {home:values[0]||'~',cwd:values[1]||'~',shell:values[2]||'/bin/bash',tmux:values[3]==='1'};
};
window.__capabilityProbeCommand=capabilityProbeCommand;
window.__parseCapabilityProbeOutput=parseCapabilityProbeOutput;
async function probeCapabilities(runtime: Runtime, timeout=8000): Promise<Capabilities> {
  if(runtime.mode!=='ttyd') throw new Error('ttyd is not connected');
  const connected = runtime;
  const marker='__TTYDTERM_PROBE_'+Math.random().toString(36).slice(2)+'__';
  return new Promise<Capabilities>((resolve,reject)=>{
    const socket=new WebSocket(connected.endpoints.ws,['tty']),encoder=new TextEncoder(),decoder=new TextDecoder();let output='',sent=false,settled=false;
    const finish=(result:CapabilityProbeResult)=>{if(settled)return;settled=true;clearTimeout(timer);socket.close(1000);resolve({state:'ready',...result,writable:true})};
    const fail=(message:string)=>{if(settled)return;settled=true;clearTimeout(timer);socket.close();reject(new Error(message))};
    const timer=setTimeout(()=>fail('No writable shell response. Restart ttyd with --writable, then check again.'),timeout);
    const send=(text: string)=>{const bytes=encoder.encode(text),payload=new Uint8Array(bytes.length+1);payload[0]=48;payload.set(bytes,1);socket.send(payload)};
    socket.binaryType='arraybuffer';
    socket.onopen=()=>socket.send(encoder.encode(JSON.stringify({AuthToken:connected.token,columns:80,rows:24})));
    socket.onmessage=(event: MessageEvent<ArrayBuffer>)=>{const bytes=new Uint8Array(event.data);if(String.fromCharCode(bytes[0])!=='0')return;output+=decoder.decode(bytes.slice(1),{stream:true});if(!sent){sent=true;send(capabilityProbeCommand(marker))}const result=parseCapabilityProbeOutput(output,marker);if(result)finish(result)};
    socket.onerror=()=>fail('Could not open a shell connection for the tmux check.');
    socket.onclose=()=>fail('The shell connection closed before the tmux check finished.');
  });
}

const hash32 = (s: string) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed: number) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

type MockSpan = [string, string];
type MockRow = { kind: 'row'; spans: MockSpan[]; cursor?: boolean } | { kind: 'ls'; items: MockSpan[] };

const ENTRIES: MockSpan[] = [
  ['src','blue'], ['lib','blue'], ['dist','blue'], ['docs','blue'], ['scripts','blue'], ['assets','blue'],
  ['build.sh','green'], ['deploy.sh','green'], ['run','green'],
  ['README.md','fg'], ['package.json','fg'], ['tsconfig.json','fg'], ['notes.md','fg'], ['index.html','fg'],
  ['logo.svg','magenta'], ['cover.png','magenta'],
  ['archive.tar.gz','red'], ['backup.zip','red'],
  ['latest','cyan'], ['current','cyan'],
  ['.env','dim'], ['.gitignore','dim'],
];

function commandOutput(command: string, rand: () => number): MockSpan[][] | null {
  const c = command.toLowerCase();
  if (/^ls\b/.test(c)) return [
    [['total 48', 'dim']],
    [['drwxr-xr-x  6 anil anil  4096 Aug 29 11:04 ', 'dim'], ['src', 'blue']],
    [['drwxr-xr-x  3 anil anil  4096 Aug 28 18:22 ', 'dim'], ['docs', 'blue']],
    [['-rwxr-xr-x  1 anil anil  1204 Aug 27 09:15 ', 'dim'], ['build.sh', 'green']],
    [['-rw-r--r--  1 anil anil  8310 Aug 29 10:51 ', 'dim'], ['README.md', 'fg']],
    [['lrwxrwxrwx  1 anil anil    12 Aug 20 14:03 ', 'dim'], ['latest', 'cyan'], [' -> ', 'dim'], ['v2.1.0', 'fg']],
  ];
  if (c.includes('git')) return [
    [['On branch ', 'dim'], ['prototypes/ttyd-workspace', 'fg']],
    [['Changes to be committed:', 'fg']],
    [['        modified:   index.html', 'green']],
    [['        new file:   README.md', 'green']],
    [['Changes not staged for commit:', 'fg']],
    [['        modified:   app.jsx', 'red']],
  ];
  if (c.includes('npm') || c.includes('dev') || c.includes('serve') || c.includes('vite')) return [
    [['  VITE v5.2.0', 'green'], ['  ready in ', 'dim'], [String(300 + Math.floor(rand() * 400)) + ' ms', 'fg']],
    [['  ➜  Local:   ', 'dim'], ['http://localhost:5173/', 'cyan']],
    [['  ➜  Network: ', 'dim'], ['http://192.168.0.12:5173/', 'cyan']],
    [['  warn ', 'yellow'], ['large chunk after minification', 'dim']],
  ];
  if (c.includes('k9s') || c.includes('top') || c.includes('kube')) return [
    [['NAME                     READY   STATUS    RESTARTS', 'dim']],
    [['api-7d9f6c4b8-2xk4l      1/1     ', 'fg'], ['Running', 'green'], ['   0', 'fg']],
    [['web-5c8b7d9f4-mn3pq      1/1     ', 'fg'], ['Running', 'green'], ['   0', 'fg']],
    [['jobs-6b4d8f7c9-qr8st     0/1     ', 'fg'], ['Pending', 'yellow'], ['   2', 'fg']],
  ];
  if (c.includes('journal') || c.includes('log') || c.includes('tail')) return [
    [['12:04:11 ', 'dim'], ['INFO ', 'cyan'], ['listening on :8080', 'fg']],
    [['12:04:19 ', 'dim'], ['WARN ', 'yellow'], ['retrying upstream (1/3)', 'fg']],
    [['12:04:22 ', 'dim'], ['INFO ', 'cyan'], ['upstream recovered', 'fg']],
  ];
  if (c.includes('pi') || c.includes('claude') || c.includes('agent')) return [
    [['◆ ', 'magenta'], ['session ready', 'fg'], ['  ·  ', 'dim'], ['sonnet-4.6', 'dim']],
    [['  read  ', 'cyan'], ['prototypes/ttyd-workspace/index.html', 'fg']],
    [['  edit  ', 'yellow'], ['index.html', 'fg'], [' +42 -8', 'green']],
  ];
  return null;
}

function mockTerminal({ folder, pane }: { folder: Folder; pane: PaneNode }): MockRow[] {
  const rand = rng(hash32(pane.id + folder.cwd));
  const prompt = (cmd: string): MockRow => ({ kind:'row', spans: [
    ['anil', 'green'], ['@', 'dim'], ['fedora', 'green'], [':', 'dim'], [folder.cwd, 'blue'], ['$ ', 'dim'], [cmd, 'fg'],
  ]});

  const rows: MockRow[] = [prompt('ls')];
  const items = ENTRIES.filter(() => rand() > 0.28);
  rows.push({ kind:'ls', items: (items.length ? items : ENTRIES).slice(0, 14) });

  rows.push(prompt(pane.command));
  const out = commandOutput(pane.command, rand);
  if (out) out.forEach((spans) => rows.push({ kind:'row', spans }));
  else rows.push({ kind:'row', spans: [['…', 'dim']] });

  rows.push({ kind:'row', spans: [
    ['anil', 'green'], ['@', 'dim'], ['fedora', 'green'], [':', 'dim'], [folder.cwd, 'blue'], ['$ ', 'dim'],
  ], cursor: true });
  return rows;
}

const docPane = (page: DocPage, section: number): PaneNode =>
  ({ type:'pane', id:'doc-' + page.id + '-' + section, command:'cat ' + page.sections[section].fileName, persist:false, docSection:section });

const docLayout = (page: DocPage): LayoutNode => {
  if (page.layout === 'demo-split') {

    return { type:'split', axis:'columns', sizes:[0.5, 0.5], children:[
      docPane(page, 0),
      { type:'split', axis:'rows', sizes:[0.5, 0.5], children:[docPane(page, 1), docPane(page, 2)] },
    ] };
  }
  return docPane(page, 0);
};

const documentationConfig = (): Config => ({
  version: CONFIG_VERSION,
  ui: { railWidth: RAIL_DEFAULT, railOpen: true, fontSize: 13, fontWeight: 'regular', notifyOnCommandFinish:false, useTmux:true },
  folders: DOC_PAGES.map((page) => ({
    id: 'doc-' + page.id, name: page.name, cwd: '~/' + page.id, doc: page.id,
    icon: WS_ICONS[page.icon] ? page.icon : null, pattern: page.pattern, theme: page.theme,
    layout: docLayout(page),
  })),
});

const colorOf = (key: string) => (key === 'fg' ? 'var(--t-fg)' : key === 'dim' ? 'var(--t-dim)' : 'var(--t-' + key + ')');

const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

window.__shellCwd=shellCwd;
window.__tmuxLaunchCommand=tmuxLaunchCommand;

const xtermAppearance = (element: HTMLElement) => {
  const css=getComputedStyle(element), value=(name: string)=>css.getPropertyValue(name).trim();
  const background=value('--t-bg'),foreground=value('--t-fg');
  return {
    fontSize:parseFloat(css.getPropertyValue('--term-font-size'))||13,
    fontWeight:parseInt(css.getPropertyValue('--term-font-weight'))||400,
    theme:{

      background:'rgba(0,0,0,0)',foreground,cursor:value('--t-cursor'),cursorAccent:background,

      selectionBackground:value('--t-blue'),
      selectionForeground:background,
      black:background,brightBlack:value('--t-dim'),white:foreground,brightWhite:foreground,
      red:value('--t-red'),brightRed:value('--t-red'),green:value('--t-green'),brightGreen:value('--t-green'),
      yellow:value('--t-yellow'),brightYellow:value('--t-yellow'),blue:value('--t-blue'),brightBlue:value('--t-blue'),
      magenta:value('--t-magenta'),brightMagenta:value('--t-magenta'),cyan:value('--t-cyan'),brightCyan:value('--t-cyan'),
    },
  };
};
window.__xtermAppearance=xtermAppearance;

interface TerminalClient { term: XtermTerminal; fit: XtermFitAddon; socket: WebSocket }
type ConnectionState = 'connecting' | 'starting' | 'ready' | 'disconnected' | 'error';
interface CommandCompletion { folderId:string; paneId:string; exitStatus:number; duration:number }
const TerminalAppearanceContext=React.createContext('');

const parseCompletionStatus = (data: string): number | null => {
  const match = /^D;(\d{1,3});ttydterm$/.exec(data);
  if (!match) return null;
  const status = Number(match[1]);
  return status >= 0 && status <= 255 ? status : null;
};
window.__parseCompletionStatus=parseCompletionStatus;

const pasteIntoTerminal = (term:XtermTerminal, text:string) => {
  if (text) term.paste(text);
  term.focus();
};
window.__pasteIntoTerminal=pasteIntoTerminal;

function RealTerminal({ folder, pane, runtime, active, suspended, fitDeferred, layoutSize, titleOwner, useTmux, onCommandComplete, onOutputActivity }: {
  folder: Folder;
  pane: PaneNode;
  runtime: Runtime;
  active: boolean;
  suspended: boolean;
  fitDeferred: boolean;
  layoutSize: string;
  titleOwner: boolean;
  useTmux: boolean;
  onCommandComplete: (event:CommandCompletion) => void;
  onOutputActivity: (folderId:string, bytes:number) => void;
}) {
  const host = useRef<HTMLDivElement | null>(null), client = useRef<TerminalClient | null>(null);
  const [state,setState]=useState<ConnectionState>('connecting');
  const [toast,setToast]=useState<string|null>(null);
  /* A manual reconnect is a new connection attempt, not a retry of the old one.
     Bumping the attempt tears the previous terminal down through the normal
     cleanup path, so one pane rebuilds without touching its siblings. */
  const [attempt,setAttempt]=useState(0);
  const focusOnReady=useRef(false);
  const appearanceContext=React.useContext(TerminalAppearanceContext);
  const appearanceVersion=folder.theme+'\0'+String(folder.fontSize||'global')+'\0'+appearanceContext;
  const appliedAppearance=useRef(''),titleOwnerRef=useRef(titleOwner),paneTitle=useRef(''),appliedTitle=useRef('');
  titleOwnerRef.current=titleOwner;
  useLayoutEffect(() => {
    const hostEl = host.current;
    if (!hostEl || runtime.mode !== 'ttyd') return;
    /* A closing socket reports asynchronously. Once this attempt is torn down,
       its late close/error frames must not describe the attempt that replaced it. */
    let cancelled=false;
    const appearance=xtermAppearance(hostEl);
    const term = new globalThis.Terminal({cursorBlink:false,allowTransparency:true,scrollback:useTmux?0:1000,fontSize:appearance.fontSize,fontWeight:appearance.fontWeight,fontFamily:'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',convertEol:true,theme:appearance.theme});
    appliedAppearance.current=appearanceVersion;
    const fit = new globalThis.FitAddon.FitAddon(); term.loadAddon(fit);
    if(globalThis.WebLinksAddon) term.loadAddon(new globalThis.WebLinksAddon.WebLinksAddon());
    let commandStartedAt:number|null=null;
    const shellEvents=term.parser.registerOscHandler(133,(data)=>{
      if(data==='C;ttydterm'){commandStartedAt=Date.now();return true}
      const exitStatus=parseCompletionStatus(data);
      if(exitStatus===null||commandStartedAt===null)return false;
      const duration=Math.max(0,Date.now()-commandStartedAt);commandStartedAt=null;
      onCommandComplete({folderId:folder.id,paneId:pane.id,exitStatus,duration});return true;
    });
    term.open(hostEl);fit.fit();
    const encoder=new TextEncoder(),decoder=new TextDecoder();
    const socket=new WebSocket(runtime.endpoints.ws,['tty']);socket.binaryType='arraybuffer';let initialized=false,activityReadyAt=0,lastReportedSize='';
    const sendInput=(data: string)=>{if(socket.readyState!==1)return;const bytes=encoder.encode(data),payload=new Uint8Array(bytes.length+1);payload[0]=48;payload.set(bytes,1);socket.send(payload)};
    const publish=(next:ConnectionState)=>{if(!cancelled)setState(next)};
    socket.onopen=()=>{if(cancelled)return;lastReportedSize=term.cols+'x'+term.rows;socket.send(encoder.encode(JSON.stringify({AuthToken:runtime.token,columns:term.cols,rows:term.rows})));publish('starting')};
    socket.onmessage=(event: MessageEvent<ArrayBuffer>)=>{if(cancelled)return;const bytes=new Uint8Array(event.data),command=String.fromCharCode(bytes[0]),data=bytes.slice(1);if(command==='0'){term.write(data);if(!initialized){initialized=true;activityReadyAt=Date.now()+ACTIVITY_GRACE_MS;const launch=paneLaunchCommand({cwd:folder.cwd,command:pane.command,persist:useTmux,folderLabel:folderLabel(folder),paneId:pane.id,shellIntegration:true});sendInput(`${launch}\r`);publish('ready');
      /* Focus returns through xterm's own API so a reconnect leaves the pane
         typeable, exactly as it was before the connection dropped. */
      if(focusOnReady.current){focusOnReady.current=false;if(titleOwnerRef.current)term.focus()}
    }else if(Date.now()>=activityReadyAt)onOutputActivity(folder.id,data.byteLength)}else if(command==='1'){paneTitle.current=decoder.decode(data)+' · ttydterm';if(titleOwnerRef.current){document.title=paneTitle.current;appliedTitle.current=paneTitle.current}}};
    socket.onclose=()=>publish('disconnected');socket.onerror=()=>publish('error');
    const input=term.onData(sendInput),resize=term.onResize(({cols,rows})=>{
      if(socket.readyState!==1)return;
      const next=cols+'x'+rows;if(next===lastReportedSize)return;lastReportedSize=next;
      socket.send(encoder.encode('1'+JSON.stringify({columns:cols,rows})));
    });
    let toastTimer:ReturnType<typeof setTimeout>,primaryTimer:ReturnType<typeof setTimeout>;
    const showToast=(text:string)=>{if(cancelled)return;setToast(text);clearTimeout(toastTimer);toastTimer=setTimeout(()=>setToast(null),2200)};
    const pasteText=(text:string)=>pasteIntoTerminal(term,text);
    const readClipboard=async()=>{try{pasteText(await navigator.clipboard.readText())}catch{showToast('Clipboard access blocked');term.focus()}};
    const nativePaste=(event:ClipboardEvent)=>{clearTimeout(primaryTimer);const text=event.clipboardData?.getData('text/plain');if(text){event.preventDefault();pasteText(text)}};
    const menuPaste=()=>{void readClipboard()};
    const focusTerminal=()=>term.focus();
    const primarySelection=()=>{term.focus();clearTimeout(primaryTimer);primaryTimer=setTimeout(()=>showToast(PRIMARY_SELECTION_HINT),360)};
    hostEl.addEventListener('paste',nativePaste);hostEl.addEventListener('ttydterm-paste',menuPaste);hostEl.addEventListener('ttydterm-focus',focusTerminal);hostEl.addEventListener('ttydterm-primary-selection',primarySelection);
    term.attachCustomKeyEventHandler((event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='v'&&event.type==='keydown'){void readClipboard();return false}return true});
    const selection=term.onSelectionChange(async()=>{const text=term.getSelection();if(!text)return;try{await navigator.clipboard.writeText(text);showToast('Copied')}catch{}});
    client.current={term,fit,socket};
    return()=>{cancelled=true;clearTimeout(toastTimer);clearTimeout(primaryTimer);hostEl.removeEventListener('paste',nativePaste);hostEl.removeEventListener('ttydterm-paste',menuPaste);hostEl.removeEventListener('ttydterm-focus',focusTerminal);hostEl.removeEventListener('ttydterm-primary-selection',primarySelection);input.dispose();resize.dispose();selection.dispose();shellEvents.dispose();socket.close(1000);term.dispose();client.current=null};
  },[folder.cwd,folder.id,pane.id,pane.command,useTmux,runtime.mode,runtime.mode==='ttyd'?runtime.token:null,attempt,onCommandComplete,onOutputActivity]);

  useLayoutEffect(()=>{
    if(!host.current||!client.current||appliedAppearance.current===appearanceVersion)return;
    const appearance=xtermAppearance(host.current);
    client.current.term.options.theme=appearance.theme;
    client.current.term.options.fontSize=appearance.fontSize;
    client.current.term.options.fontWeight=appearance.fontWeight;
    appliedAppearance.current=appearanceVersion;
    if(active)try{client.current.fit.fit()}catch{}
  },[appearanceVersion]);
  useEffect(()=>{
    if(titleOwner){const next=paneTitle.current||'ttydterm';document.title=next;appliedTitle.current=next}
    else if(appliedTitle.current){if(document.title===appliedTitle.current)document.title='ttydterm';appliedTitle.current=''}
    return()=>{if(appliedTitle.current&&document.title===appliedTitle.current)document.title='ttydterm';appliedTitle.current=''};
  },[titleOwner]);
  /* Pane geometry keeps tracking a browser resize, but xterm waits for the
     short resize burst to settle so ttyd/tmux receive only the final grid. */
  useLayoutEffect(()=>{if(active&&!suspended&&!fitDeferred)try{client.current?.fit.fit()}catch{}},[active,suspended,fitDeferred,layoutSize]);
  const reconnect=()=>{focusOnReady.current=true;setState('connecting');setAttempt((current)=>current+1)};
  return <div className={'term xterm-term pattern-'+(folder.pattern||'plain')+(useTmux?' tmux-terminal':'')+' connection-'+state+(suspended?' xterm-suspended':'')}
              aria-label={suspended?'Terminal paused during layout change':'Terminal '+state} aria-busy={suspended||undefined}><div className="xterm-host" ref={host}/>{state==='ready'?null:(
                state==='disconnected'
                  ? <div className="connection-state"><span className="connection-label" role="status">Disconnected</span>
                      <button type="button" className="connection-retry" onClick={reconnect}>Reconnect</button></div>
                  : <div className="connection-state">{state}</div>
              )}{toast?<div className="copy-toast" role="status">{toast}</div>:null}</div>;
}

const DocThemeContext = React.createContext<((folderId: string, theme: string) => void) | null>(null);

const DocInline = ({ spans }: { spans: DocSpan[] }) => (
  <>{spans.map((span, i) => {
    switch (span.kind) {
      case 'text': return <React.Fragment key={i}>{span.text}</React.Fragment>;
      case 'em': return <strong className="doc-em" key={i}>{span.text}</strong>;
      case 'code': return <code className="doc-code" key={i}>{span.text}</code>;
      case 'link': return (
        <a className="term-link doc-link" key={i} href={span.href} target="_blank" rel="noopener noreferrer">{span.text}</a>
      );
    }
  })}</>
);

function DocBlockView({ block, folder }: { block: DocBlock; folder: Folder }) {
  const setDocTheme = React.useContext(DocThemeContext);
  switch (block.kind) {
    case 'lead': return <p className="doc-lead"><DocInline spans={block.spans} /></p>;
    case 'para': return <p className="doc-para"><DocInline spans={block.spans} /></p>;
    case 'heading': return <h3 className="doc-heading">{block.text}</h3>;
    case 'command': return (
      <div className="doc-command">
        {block.caption ? <span className="doc-caption">{block.caption}</span> : null}
        <code>{block.command}</code>
      </div>
    );
    case 'list': return (
      <ul className="doc-list">{block.items.map((item, i) => <li key={i}><DocInline spans={item} /></li>)}</ul>
    );
    case 'defs': return (
      <dl className="doc-defs">{block.items.map((item) => (
        <React.Fragment key={item.term}>
          <dt><code>{item.term}</code></dt>
          <dd>{item.detail}</dd>
        </React.Fragment>
      ))}</dl>
    );
    case 'themes': return (
      <div className="doc-themes">
        {}
        <ThemeChoice label="Theme for this workspace" value={folder.theme}
                     onChange={(theme) => setDocTheme?.(folder.id, theme || 'night')} />
      </div>
    );
  }
}

function DocTerminal({ folder, page, section, suspended }: { folder: Folder; page: DocPage; section: DocSection; suspended: boolean }) {
  const first = page.sections[0] === section;
  const [entering,setEntering]=useState(()=>!REDUCED());
  useEffect(()=>{if(!entering)return;const timer=setTimeout(()=>setEntering(false),240);return()=>clearTimeout(timer)},[entering]);
  return (
    <div className={'term doc-term pattern-' + (folder.pattern || 'plain') + (suspended ? ' resize-placeholder' : '')}
         data-ready="1" data-doc={page.id} role="region"
         aria-label={suspended ? 'Terminal paused during layout change' : page.title + ' documentation'}
         aria-busy={suspended || undefined} tabIndex={suspended ? -1 : 0}>
      <div className={'term-body'+(entering?' term-entering':'')} aria-hidden={suspended || undefined}>
        <span className="term-row">
          <span style={{ color: colorOf('green') }}>visitor@ttydterm</span>
          <span style={{ color: colorOf('dim') }}>:</span>
          <span style={{ color: colorOf('blue') }}>~/{page.id}</span>
          <span style={{ color: colorOf('dim') }}>$ </span>
          <span style={{ color: colorOf('fg') }}>cat {section.fileName}</span>
        </span>
        <div className="doc-body">
          {first ? <h2 className="doc-title">{page.title}</h2> : null}
          {section.blocks.map((block, i) => <DocBlockView key={i} block={block} folder={folder} />)}
        </div>
        <span className="term-row">
          <span style={{ color: colorOf('green') }}>visitor@ttydterm</span>
          <span style={{ color: colorOf('dim') }}>:</span>
          <span style={{ color: colorOf('blue') }}>~/{page.id}</span>
          <span style={{ color: colorOf('dim') }}>$ </span>
          <i className="cursor" />
        </span>
      </div>
    </div>
  );
}

function MockTerminal({ folder, pane, suspended }: {
  folder: Folder;
  pane: PaneNode;
  suspended: boolean;
}) {
  const rows = useMemo(() => mockTerminal({ folder, pane }), [folder.cwd, folder.doc, pane.id, pane.command]);
  const [phase,setPhase]=useState<'skeleton'|'entering'|'ready'>(()=>REDUCED()?'ready':'skeleton');
  useEffect(()=>{
    if(phase==='ready')return;
    const timer=setTimeout(()=>setPhase(phase==='skeleton'?'entering':'ready'),phase==='skeleton'?240:220);
    return()=>clearTimeout(timer);
  },[phase]);

  if (phase==='skeleton') {
    return (
      <div className={'term skeleton pattern-' + (folder.pattern || 'plain') + (suspended ? ' resize-placeholder' : '')}
           data-ready="0" aria-hidden="true">
        <div className="sk-line" style={{ width: '46%' }} />
        <div className="sk-grid">
          {[72, 54, 63, 48, 58, 66, 51, 60].map((w, i) => (
            <div className="sk-line" key={i} style={{ width: w + '%', animationDelay: (i % 4) * 90 + 'ms' }} />
          ))}
        </div>
        <div className="sk-line" style={{ width: '38%' }} />
        <div className="sk-line" style={{ width: '64%' }} />
      </div>
    );
  }

  return (
    <div className={'term pattern-' + (folder.pattern || 'plain') + (suspended ? ' resize-placeholder' : '')}
         data-ready="1" aria-label={suspended ? 'Terminal paused while resizing' : undefined}
         aria-busy={suspended || undefined}>
      <div className={'term-body'+(phase==='entering'?' term-entering':'')} aria-hidden={suspended || undefined}>
        {rows.map((row, i) =>
          row.kind === 'ls' ? (
            <div className="ls" key={i} style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(' +
                Math.max(...row.items.map(([n]) => n.length)) + 'ch, 1fr))',
            }}>
              {row.items.map(([name, c], j) => (
                <span key={j} style={{ color: colorOf(c), fontWeight: c === 'blue' || c === 'green' ? 600 : 400 }}>{name}</span>
              ))}
            </div>
          ) : (
            <span className="term-row" key={i}>
              {row.spans.map(([text, c], j) => {
                const parts = text.split(/(https?:\/\/[^\s]+)/g);
                return <React.Fragment key={j}>{parts.map((part, k) => /^https?:\/\//.test(part)
                  ? <a className="term-link" key={k} href={part} target="_blank" rel="noopener noreferrer" style={{ color: colorOf(c) }}>{part}</a>
                  : <span key={k} style={{ color: colorOf(c) }}>{part}</span>)}</React.Fragment>;
              })}
              {row.cursor ? <i className="cursor" /> : null}
            </span>
          )
        )}
      </div>
    </div>
  );
}

function Terminal({ folder, pane, runtime, active, suspended, fitDeferred, layoutSize, titleOwner, useTmux, onCommandComplete, onOutputActivity }: {
  folder: Folder;
  pane: PaneNode;
  runtime: Runtime;
  active: boolean;
  suspended: boolean;
  fitDeferred: boolean;
  layoutSize: string;
  titleOwner: boolean;
  useTmux: boolean|null;
  onCommandComplete: (event:CommandCompletion) => void;
  onOutputActivity: (folderId:string, bytes:number) => void;
}) {
  const page = folder.doc ? docPage(folder.doc) : null;
  const section = page ? page.sections[pane.docSection ?? 0] : null;

  if(page&&section)return <DocTerminal folder={folder} page={page} section={section} suspended={suspended}/>;
  if (!folder.doc&&runtime.mode==='ttyd'&&useTmux===null)return <div className={'term pattern-'+(folder.pattern||'plain')} aria-label="Terminal waiting for tmux check"><div className="connection-state">Checking for tmux…</div></div>;
  if (!folder.doc && runtime.mode === 'ttyd'&&useTmux!==null) return <RealTerminal folder={folder} pane={pane} runtime={runtime} active={active} suspended={suspended} fitDeferred={fitDeferred} layoutSize={layoutSize} titleOwner={titleOwner} useTmux={useTmux} onCommandComplete={onCommandComplete} onOutputActivity={onOutputActivity}/>;
  return <MockTerminal folder={folder} pane={pane} suspended={suspended}/>;
}

const parseHash = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
const go = (...parts: string[]) => {
  const next = '#/' + parts.map(encodeURIComponent).join('/');
  if (location.hash === next) dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = next;
};

function useRoute() {
  const [parts, setParts] = useState(parseHash);
  useEffect(() => {
    const on = () => setParts(parseHash());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return parts;
}

const tmuxState = (capabilities:Capabilities, runtime:Runtime):TmuxState => capabilities.state === 'ready'
  ? capabilities.tmux ? { state:'present' } : { state:'absent' }
  : capabilities.state === 'error' ? { state:'error', message:capabilities.error }
  : runtime.mode === 'demo' || runtime.mode === 'file' ? { state:'absent' } : { state:'probing' };

type PaneMenu = { source: 'trigger' | 'context'; x: number; y: number };
interface FocusRequest { id: string; n?: number; nonce?: number }

const Pane=React.memo(function Pane({ node, folder, runtime, active, focused, completed, closing, focusReq, resizing, fitDeferred, useTmux,
               frame, exchangeRole, canExchange, position, paneCount,
               onFocus, onSplit, onClose, canClose, onOpenSettings, onOpenWorkspaceSettings, onCommandComplete, onOutputActivity,
               onExchangePointer, onExchangeKey }: {
  node: PaneNode;
  folder: Folder;
  runtime: Runtime;
  active: boolean;
  focused: boolean;
  completed: number;
  closing: boolean;
  focusReq: FocusRequest | null;
  resizing: boolean;
  fitDeferred: boolean;
  useTmux: boolean|null;
  frame: Frame;
  exchangeRole: 'source' | 'target' | null;
  canExchange: boolean;
  position: number;
  paneCount: number;
  onFocus: (folderId:string,paneId:string) => void;
  onSplit: (folderId:string,paneId:string,axis:SplitAxis,count:number) => void;
  onClose: (paneId: string) => void;
  canClose: boolean;
  onOpenSettings: (folderId:string,paneId:string) => void;
  onOpenWorkspaceSettings: (folderId:string) => void;
  onCommandComplete: (event:CommandCompletion) => void;
  onOutputActivity: (folderId:string, bytes:number) => void;
  onExchangePointer: (paneId:string, event:React.PointerEvent<HTMLButtonElement>) => void;
  onExchangeKey: (paneId:string, event:React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const [menu, setMenu] = useState<PaneMenu | null>(null);
  const [gripVisible,setGripVisible]=useState(false);
  const [entering,setEntering]=useState(()=>!REDUCED());
  const ref = useRef<HTMLDivElement | null>(null),menuRef=useRef<HTMLDivElement|null>(null);
  const accent = themeOf(folder.theme);

  useEffect(()=>{if(!entering)return;const timer=setTimeout(()=>setEntering(false),180);return()=>clearTimeout(timer)},[entering]);
  useEffect(() => {
    if (!menu) return;
    const off = () => setMenu(null);
    addEventListener('pointerdown', off);
    return () => removeEventListener('pointerdown', off);
  }, [menu]);
  useLayoutEffect(()=>{
    const element=menuRef.current,pane=ref.current;
    if(!menu||!element||!pane)return;
    if(menu.source==='context'){
      const nextX=clamp(menu.x,7,Math.max(7,pane.clientWidth-element.offsetWidth-7));
      const nextY=clamp(menu.y,7,Math.max(7,pane.clientHeight-element.offsetHeight-7));
      if(nextX!==menu.x||nextY!==menu.y){setMenu({...menu,x:nextX,y:nextY});return}
      requestAnimationFrame(()=>element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus());
    }
  },[menu]);


  useEffect(() => {
    if (!focusReq || focusReq.id !== node.id) return;
    const t = setTimeout(() => {
      ref.current?.focus({ preventScroll: true });
      ref.current?.querySelector('.xterm-host')?.dispatchEvent(new Event('ttydterm-focus'));
      ref.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, 0);
    return () => clearTimeout(t);
  }, [focusReq, node.id]);

  const focusTerminal=()=>{
    const host=ref.current?.querySelector('.xterm-host');
    if(host)host.dispatchEvent(new Event('ttydterm-focus'));
    else ref.current?.focus({preventScroll:true});
  };
  const focusPane=()=>onFocus(folder.id,node.id);
  const paneControl=(target:EventTarget)=>target instanceof Element&&!!target.closest('.pane-grip,.rail-pane,.panepop,.connection-retry');
  const activateFromPointer=(target:EventTarget)=>{
    focusPane();
    if(paneControl(target))return;
    focusTerminal();
    requestAnimationFrame(()=>{if(!menuRef.current)focusTerminal()});
  };
  const split=(axis:SplitAxis,count:number)=>{setMenu(null);onSplit(folder.id,node.id,axis,count)};

  return (
    <div
      ref={ref}
      className={'pane' + (focused ? ' focused' : '') + (closing ? ' closing' : '') + (entering ? ' entering' : '')
        + (exchangeRole ? ' exchange-' + exchangeRole : '')}
      style={{ ...themeVars(accent), '--t-ring': accent.blue,
        left: frame.x + 'px', top: frame.y + 'px', width: frame.w + 'px', height: frame.h + 'px' }}
      data-pane-id={node.id}
      aria-label={'Terminal' + (completed ? ', ' + completed + ' completed command' + (completed === 1 ? '' : 's') + ' needing attention' : '')}
      tabIndex={-1}
      onPointerDownCapture={(event:React.PointerEvent<HTMLDivElement>)=>{
        activateFromPointer(event.target);
        if(useTmux&&event.button===1){
          event.stopPropagation();
          ref.current?.querySelector('.xterm-host')?.dispatchEvent(new Event('ttydterm-primary-selection'));
        }
      }}
      onMouseDownCapture={(event:React.MouseEvent<HTMLDivElement>)=>{if(useTmux&&event.button===1)event.stopPropagation()}}
      onAuxClickCapture={(event:React.MouseEvent<HTMLDivElement>)=>{if(useTmux&&event.button===1)event.stopPropagation()}}
      onPointerMoveCapture={(event:React.PointerEvent<HTMLDivElement>)=>{
        if(!canExchange)return;
        const bounds=ref.current?.getBoundingClientRect();
        if(!bounds)return;
        const next=event.clientX>=bounds.left&&event.clientX<=bounds.left+54&&event.clientY>=bounds.top&&event.clientY<=bounds.top+54;
        setGripVisible((current)=>current===next?current:next);
      }}
      onPointerLeave={()=>setGripVisible(false)}
      onFocus={focusPane}

      onContextMenu={(e) => {
        e.preventDefault();
        if(paneControl(e.target))focusPane();else activateFromPointer(e.target);
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        setMenu({ source:'context', x:e.clientX-r.left, y:e.clientY-r.top });
      }}
    >
      <Terminal folder={folder} pane={node} runtime={runtime} active={active} suspended={resizing} fitDeferred={fitDeferred} layoutSize={frame.w+'x'+frame.h} titleOwner={active&&focused} useTmux={useTmux} onCommandComplete={onCommandComplete} onOutputActivity={onOutputActivity} />
      {completed ? <span className="pane-complete" aria-hidden="true" /> : null}

      {}
      <div className="pane-edge" aria-hidden="true" />
      {exchangeRole ? <div className={'pane-exchange-cue ' + exchangeRole} aria-hidden="true" /> : null}

      {}
      {canExchange ? (
        <div className={'pane-grip'+(gripVisible?' visible':'')} onPointerDown={(e)=>e.stopPropagation()}>
          <button className="pico" type="button"
                  title="Exchange this terminal with another pane"
                  aria-label={'Exchange terminal ' + position + ' of ' + paneCount + ', drag or press Enter then use arrow keys'}
                  aria-pressed={exchangeRole === 'source'}
                  onPointerDown={(event) => onExchangePointer(node.id, event)}
                  onKeyDown={(event) => onExchangeKey(node.id, event)}><Ico.grip /></button>
        </div>
      ) : null}

      {}
      <div className={'pane-hotspot' + (menu ? ' open' : '')} aria-hidden="true" />
      <div className={'rail-pane' + (menu ? ' open' : '')} onPointerDown={(e) => e.stopPropagation()}>
        <button className={'pico' + (useTmux ? ' persist' : '')}
                title="Pane menu" aria-label="Pane menu"
                aria-expanded={!!menu} aria-haspopup="menu"
                onClick={(e) => { const x=e.currentTarget.offsetLeft,y=e.currentTarget.offsetTop+28;setMenu((v)=>v?null:{source:'trigger',x,y}); }}><Ico.menu /></button>
      </div>

      {menu ? (
        <div ref={menuRef} className="panepop" role="menu" tabIndex={-1}
             style={menu.source === "context" ? {left:menu.x+'px',top:menu.y+'px',right:'auto'} : undefined}
             onPointerDown={(e) => e.stopPropagation()}
             onKeyDown={(e) => {
               const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
               const i = items.indexOf(document.activeElement as HTMLButtonElement);
               if(e.key==="ArrowDown"||e.key==="ArrowRight"){e.preventDefault();items[(i+1+items.length)%items.length]?.focus()}
               else if(e.key==="ArrowUp"||e.key==="ArrowLeft"){e.preventDefault();items[(i-1+items.length)%items.length]?.focus()}
               else if(e.key==="Escape"){e.preventDefault();setMenu(null);focusTerminal()}
             }}>
          <div className="pane-menu-actions" role="none">
            <button className="pico" role="menuitem" title="Pane settings" aria-label="Pane settings"
                    onClick={() => { setMenu(null); onOpenSettings(folder.id,node.id); }}><Ico.gear /></button>
            <button className="pico" role="menuitem" title="Paste" aria-label="Paste"
                    onClick={()=>{setMenu(null);ref.current?.querySelector('.xterm-host')?.dispatchEvent(new Event('ttydterm-paste'))}}><Ico.paste /></button>
            <button className="pico" role="menuitem" title="Workspace appearance" aria-label="Workspace appearance"
                    onClick={()=>{setMenu(null);onOpenWorkspaceSettings(folder.id)}}><WsIcon name="palette" /></button>
            <button className="pico danger" role="menuitem" disabled={!canClose}
                    title={canClose?'Close pane':'The only pane cannot be closed'} aria-label={canClose?'Close pane':'Close pane unavailable: this is the only pane'}
                    onClick={() => { if(canClose){setMenu(null);onClose(node.id)} }}><Ico.close /></button>
          </div>
          <div className="pane-menu-splits axis-top" role="none">
            {[2, 3, 4].map((n) => (
              <button key={'c' + n} className="pico" role="menuitem"
                      title={'Split into ' + n + ' columns'} aria-label={'Split into ' + n + ' columns'}
                      onClick={() => split('columns', n)}><CountGlyph axis="columns" n={n} /></button>
            ))}
          </div>
          <div className="pane-menu-splits" role="none">
            {[2, 3, 4].map((n) => (
              <button key={'r' + n} className="pico" role="menuitem"
                      title={'Split into ' + n + ' rows'} aria-label={'Split into ' + n + ' rows'}
                      onClick={() => split('rows', n)}><CountGlyph axis="rows" n={n} /></button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
});

/* Resolve the split node a divider path points at, so resize math stays with
   the tree while rendering stays flat. */
function splitAt(root: LayoutNode | null, path: number[]): SplitNode | null {
  let node: LayoutNode | null = root;
  for (const index of path) {
    if (!node || node.type !== 'split') return null;
    node = node.children[index] ?? null;
  }
  return node && node.type === 'split' ? node : null;
}

/* Clamp a divider move against both neighbours' minimums, in tree terms. */
function clampSplit(split: SplitNode, index: number, delta: number, avail: number): number[] {
  const mins = split.children.map((child) => nodeMin(child, GAP));
  const columns = split.axis === 'columns';
  const a0 = split.sizes[index], b0 = split.sizes[index + 1];
  const minA = (columns ? mins[index].w : mins[index].h) / avail;
  const minB = (columns ? mins[index + 1].w : mins[index + 1].h) / avail;
  let lo = minA - a0, hi = b0 - minB;
  if (hi - lo < 0.01) { lo = FLOOR - a0; hi = b0 - FLOOR; }
  const d = Math.max(Math.min(delta, hi), lo);
  const next = split.sizes.slice();
  next[index] = a0 + d; next[index + 1] = b0 - d;
  return next;
}

type ExchangeState = { source: string; target: string | null; mode: 'pointer' | 'keyboard' };

function Surface({ folder, runtime, active, focusId, closingId, focusReq, completedByPane, appResizing, browserResizing, useTmux, fontSize, layoutVersion,
                   onFocus, onSplit, onClose, onResize, onAddFirst, onOpenSettings, onOpenWorkspaceSettings, onCommandComplete, onOutputActivity,
                   onExchange }: {
  folder: Folder;
  runtime: Runtime;
  active: boolean;
  focusId: string | null;
  closingId: string | null;
  focusReq: FocusRequest | null;
  completedByPane: Record<string,number>;
  appResizing: boolean;
  browserResizing: boolean;
  useTmux: boolean|null;
  fontSize: number;
  layoutVersion: string;
  onFocus: (folderId:string,paneId:string) => void;
  onSplit: (folderId:string,paneId:string,axis:SplitAxis,count:number) => void;
  onClose: (paneId: string) => void;
  onResize: (folderId:string,path:number[],sizes:number[]) => void;
  onAddFirst: (folderId:string) => void;
  onOpenSettings: (folderId:string,paneId:string) => void;
  onOpenWorkspaceSettings: (folderId:string) => void;
  onCommandComplete: (event:CommandCompletion) => void;
  onOutputActivity: (folderId:string, bytes:number) => void;
  onExchange: (folderId:string, a:string, b:string) => void;
}) {
  const viewport = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [resizing, setResizing] = useState(false);
  const [exchange,setExchange]=useState<ExchangeState|null>(null);
  const [announcement,setAnnouncement]=useState('');
  const announce=(message:string)=>{setAnnouncement('');requestAnimationFrame(()=>setAnnouncement(message))};
  useEffect(()=>{if(!active)setAnnouncement('')},[active]);

  const measureViewport=useCallback(()=>{
    const el=viewport.current;if(!el)return;
    const r=el.getBoundingClientRect(),w=r.width,h=r.height;
    setBox((current)=>current.w===w&&current.h===h?current:{w,h});
  },[]);
  /* App commits viewport and responsive-rail state together. Measure from that
     DOM in a layout effect, then commit pane frames before the browser paints. */
  useLayoutEffect(measureViewport,[layoutVersion,measureViewport]);
  useLayoutEffect(()=>{
    const el=viewport.current;if(!el)return;
    const ro=new ResizeObserver(measureViewport);ro.observe(el);
    return()=>ro.disconnect();
  },[measureViewport]);

  const min = useMemo(() => nodeMin(folder.layout,GAP), [folder.layout]);
  const canClose = useMemo(()=>countPanes(folder.layout)>1,[folder.layout]);
  const onResizeStart=useCallback(()=>setResizing(true),[]),onResizeEnd=useCallback(()=>setResizing(false),[]);

  const canvas = {
    w: Math.max(box.w, Math.ceil(min.w)),
    h: Math.max(box.h, Math.ceil(min.h)),
  };
  const frames = useMemo(
    () => layoutFrames(folder.layout, { x: 0, y: 0, w: canvas.w, h: canvas.h }, GAP),
    [folder.layout, canvas.w, canvas.h]);
  const paneFrames = frames.panes;
  const canExchange = paneFrames.length > 1;
  const labelOf = (id: string) => {
    const at = paneFrames.findIndex((item) => item.pane.id === id);
    return at < 0 ? 'terminal' : 'terminal ' + (at + 1) + ' of ' + paneFrames.length;
  };

  /* Focus follows the moved terminal so the exchange feels like one action. */
  const commitExchange=(a:string,b:string)=>{
    onExchange(folder.id,a,b);announce('Exchanged '+labelOf(a)+' with '+labelOf(b)+'.');
  };
  const cancelExchange=(reason='Exchange cancelled.')=>{setExchange(null);announce(reason)};
  useEffect(()=>{
    if(!exchange)return;
    if(!active){setExchange(null);return}
    if(exchange.mode!=='keyboard')return;
    const cancelKey=(event:KeyboardEvent)=>{
      if(event.key!=='Escape')return;
      event.preventDefault();event.stopPropagation();cancelExchange();
    };
    const cancelOnDeparture=(event:FocusEvent)=>{
      const target=event.target,source=document.querySelector<HTMLElement>(`[data-pane-id="${CSS.escape(exchange.source)}"] .pane-grip`);
      if(!(target instanceof Node)||!source?.contains(target))cancelExchange();
    };
    addEventListener('keydown',cancelKey,{capture:true});addEventListener('focusin',cancelOnDeparture);
    return()=>{removeEventListener('keydown',cancelKey,{capture:true});removeEventListener('focusin',cancelOnDeparture)};
  },[active,exchange]);

  const paneUnder = (x: number, y: number): string | null => {
    const host = viewport.current;
    if (!host) return null;
    for (const element of document.elementsFromPoint(x, y)) {
      const pane = element instanceof HTMLElement ? element.closest<HTMLElement>('.pane') : null;
      if (pane && host.contains(pane) && pane.dataset.paneId) return pane.dataset.paneId;
    }
    return null;
  };

  const onExchangePointer=(paneId:string,event:React.PointerEvent<HTMLButtonElement>)=>{
    if(event.button!==0||!canExchange)return;
    event.preventDefault();event.stopPropagation();
    const trigger=event.currentTarget,pointerId=event.pointerId;
    let target:string|null=null,done=false;
    trigger.setPointerCapture(pointerId);
    setExchange({source:paneId,target:null,mode:'pointer'});
    announce('Exchanging '+labelOf(paneId)+'. Drop on another pane.');

    const move=(moveEvent:PointerEvent)=>{
      const over=paneUnder(moveEvent.clientX,moveEvent.clientY),next=over&&over!==paneId?over:null;
      if(next===target)return;
      target=next;
      setExchange((current)=>current?.mode==='pointer'?{...current,target:next}:current);
    };
    const finish=(commit:boolean)=>{
      if(done)return;done=true;
      trigger.removeEventListener('pointermove',move);trigger.removeEventListener('pointerup',up);
      trigger.removeEventListener('pointercancel',cancel);trigger.removeEventListener('lostpointercapture',cancel);
      removeEventListener('keydown',escape,{capture:true});
      if(trigger.hasPointerCapture(pointerId))trigger.releasePointerCapture(pointerId);
      if(commit&&target)commitExchange(paneId,target);
      else announce('Exchange cancelled.');
      setExchange(null);
    };
    const up=(upEvent:PointerEvent)=>{
      const over=paneUnder(upEvent.clientX,upEvent.clientY);target=over&&over!==paneId?over:null;finish(!!target);
    },cancel=()=>finish(false);
    const escape=(keyEvent:KeyboardEvent)=>{if(keyEvent.key==='Escape'){keyEvent.preventDefault();finish(false)}};
    trigger.addEventListener('pointermove',move);trigger.addEventListener('pointerup',up);
    trigger.addEventListener('pointercancel',cancel);trigger.addEventListener('lostpointercapture',cancel);
    addEventListener('keydown',escape,{capture:true});
  };

  const onExchangeKey = (paneId: string, event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!canExchange) return;
    const keyboardActive = exchange && exchange.mode === 'keyboard' && exchange.source === paneId;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      if (!keyboardActive) {
        setExchange({source:paneId,target:null,mode:'keyboard'});
        announce('Exchanging '+labelOf(paneId)+'. Use arrow keys to choose a pane, Enter to swap, Escape to cancel.');
        return;
      }
      if(exchange.target)commitExchange(paneId,exchange.target);
      else announce('Exchange cancelled.');
      setExchange(null);
      return;
    }
    if (event.key === 'Escape' && keyboardActive) {
      event.preventDefault();
      event.stopPropagation();
      cancelExchange();
      return;
    }
    const directions: Record<string, Direction> = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    };
    const direction = directions[event.key];
    if (!direction || !keyboardActive) return;
    event.preventDefault();
    const from=exchange.target||paneId,next=neighborPane(paneFrames,from,direction);
    if(!next)return;
    if(next.id===paneId){setExchange({...exchange,target:null});announce(labelOf(paneId)+' selected as the source. Choose another pane.');return}
    setExchange({...exchange,target:next.id});
    announce(labelOf(next.id)+' selected. Enter swaps, Escape cancels.');
  };

  /* Resize keeps working on the tree while rendering stays flat. */
  const startDividerDrag = (path:number[],index:number,avail:number) => (event:React.PointerEvent<HTMLDivElement>) => {
    const split=splitAt(folder.layout,path);
    if(!split||avail<=0)return;
    event.preventDefault();
    const columns=split.axis==='columns';
    const startPos = columns ? event.clientX : event.clientY;
    const target = event.currentTarget;
    target.focus();
    target.classList.add('dragging');
    target.setPointerCapture(event.pointerId);
    onResizeStart();
    const move = (moveEvent: PointerEvent) => {
      const delta = ((columns ? moveEvent.clientX : moveEvent.clientY) - startPos) / avail;
      onResize(folder.id, path, clampSplit(split, index, delta, avail));
    };
    let done=false;
    const finish=()=>{
      if(done)return;done=true;target.classList.remove('dragging');
      target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',finish);
      target.removeEventListener('pointercancel',finish);target.removeEventListener('lostpointercapture',finish);
      onResizeEnd();
    };
    target.addEventListener('pointermove',move);target.addEventListener('pointerup',finish);
    target.addEventListener('pointercancel',finish);target.addEventListener('lostpointercapture',finish);
  };

  const onDividerKey = (path:number[],index:number,avail:number) => (event:React.KeyboardEvent<HTMLDivElement>) => {
    const split=splitAt(folder.layout,path);
    if(!split||avail<=0)return;
    const columns=split.axis==='columns';
    const dec=columns?'ArrowLeft':'ArrowUp',inc=columns?'ArrowRight':'ArrowDown';
    if(![dec,inc,'Home','End'].includes(event.key))return;
    event.preventDefault();
    const step = (event.shiftKey ? 64 : 24) / avail;
    const delta = event.key === dec ? -step : event.key === inc ? step
                : event.key === 'Home' ? -1 : 1;   // clamp turns ±1 into the legal limit
    onResize(folder.id, path, clampSplit(split, index, delta, avail));
  };

  return (
    <div className="surface" hidden={!active} style={{'--term-font-size':fontSize+'px'}}>
      <div className="viewport" ref={viewport}>
        {folder.layout ? (
          <div className="canvas" style={{ width: canvas.w, height: canvas.h }}>
            {frames.dividers.map((divider) => (
              <div key={divider.key} className={'divider ' + divider.axis}
                   style={{ left: divider.x + 'px', top: divider.y + 'px', width: divider.w + 'px', height: divider.h + 'px' }}
                   onPointerDown={startDividerDrag(divider.path,divider.index,divider.available)}
                   onKeyDown={onDividerKey(divider.path,divider.index,divider.available)}
                   role="separator" tabIndex={0}
                   aria-orientation={divider.axis === 'columns' ? 'vertical' : 'horizontal'}
                   aria-label={'Resize ' + (divider.axis === 'columns' ? 'columns ' : 'rows ') + (divider.index + 1) + ' and ' + (divider.index + 2)}
                   aria-valuemin={0} aria-valuemax={100}
                   aria-valuenow={Math.round(divider.before * 100)} />
            ))}
            {paneFrames.map((item, index) => (
              <Pane key={item.pane.id} node={item.pane} folder={folder} runtime={runtime} active={active}
                    focused={focusId === item.pane.id} completed={completedByPane[item.pane.id] || 0}
                    closing={closingId === item.pane.id}
                    focusReq={focusReq?.id === item.pane.id ? focusReq : null}
                    resizing={resizing || appResizing || !!exchange} fitDeferred={browserResizing} useTmux={useTmux}
                    frame={{ x: item.x, y: item.y, w: item.w, h: item.h }}
                    exchangeRole={exchange ? (exchange.source === item.pane.id ? 'source' : exchange.target === item.pane.id ? 'target' : null) : null}
                    canExchange={canExchange}
                    position={index + 1} paneCount={paneFrames.length}
                    onFocus={onFocus} onSplit={onSplit} onClose={onClose} canClose={canClose}
                    onOpenSettings={onOpenSettings} onOpenWorkspaceSettings={onOpenWorkspaceSettings}
                    onCommandComplete={onCommandComplete} onOutputActivity={onOutputActivity}
                    onExchangePointer={onExchangePointer} onExchangeKey={onExchangeKey} />
            ))}
          </div>
        ) : (
          <div className="empty-add">
            <button className="ico" title="Add a terminal" aria-label="Add a terminal" onClick={()=>onAddFirst(folder.id)}><Ico.plus /></button>
          </div>
        )}
      </div>
      <div className="sr-live" role="status" aria-live="polite">{active ? announcement : ''}</div>
    </div>
  );
}

const SWATCH_LINES: Array<[keyof Theme & ('fg'|'blue'|'green'|'dim'), string]> =
  [['fg', '78%'], ['blue', '58%'], ['green', '88%'], ['dim', '44%']];
const ThemeSwatch = ({ t }: { t: Theme }) =>
  <>{SWATCH_LINES.map(([c, w]) => <i key={c} style={{ background: t[c], width: w }} />)}</>;

function ThemeChoice({ label, value, onChange, folderTheme }: {
  label: string;
  value: string | null;
  onChange: (theme: string | null) => void;
  folderTheme?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const labelId = useId();
  const keys: Array<string | null> = folderTheme ? [null, ...THEME_KEYS] : [...THEME_KEYS];
  const current = value || null;


  const onKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const i = keys.indexOf(current);
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = keys[Math.min(i + 1, keys.length - 1)];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = keys[Math.max(i - 1, 0)];
    else if (e.key === 'Home') next = keys[0];
    else if (e.key === 'End') next = keys[keys.length - 1];
    else return;
    e.preventDefault();
    onChange(next);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  };

  return (
    <div className="field">
      <label id={labelId}>{label}</label>
      <div className="themes" role="radiogroup" aria-labelledby={labelId} ref={ref}>
        {keys.map((k) => {
          const t = themeOf(k || folderTheme);
          const on = current === k;
          return (
            <button type="button" key={k || 'inherit'} role="radio" aria-checked={on}
                    tabIndex={on ? 0 : -1}
                    className={'theme-opt' + (k ? '' : ' inherit')}
                    style={{ background: t.bg }}
                    title={k ? t.label : 'inherit from folder (' + t.label + ')'}
                    aria-label={k ? 'Theme ' + t.label : 'Inherit the folder theme, ' + t.label}
                    onClick={() => onChange(k)} onKeyDown={onKey}>
              <ThemeSwatch t={t} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

const initials = (label: string) => label.replace(/[^a-z0-9]+/gi, '').slice(0, 2) || '··';

function TmuxStatusHint({ tmux, present, absent, onCheck }: {
  tmux:TmuxState;
  present:string;
  absent:string;
  onCheck?:()=>void;
}) {
  const text=tmux.state==='present' ? present : tmux.state==='probing' ? 'Checking for tmux…'
    : tmux.state==='error' ? 'Could not check for tmux: '+tmux.message : absent;
  return <>{text}{onCheck&&tmux.state!=='present'&&tmux.state!=='probing' ? <button type="button" className="hint-action" onClick={onCheck}>Check again</button> : null}</>;
}

function FolderDialog({ folder, isNew, globalFontSize, onChange, onCreate, onDelete, onClose, canDelete }: {
  folder: Folder;
  isNew?: boolean;
  globalFontSize: number;
  onChange?: (patch: Partial<Folder>) => void;
  onCreate?: (folder: Folder) => void;
  onDelete?: () => void;
  onClose: () => void;
  canDelete?: boolean;
}) {
  const [draft, setDraft] = useState<Folder>(folder);
  /* Local edits own this draft. A different workspace resets it; a new object
     for the same workspace must not erase typing during unrelated rerenders. */
  useEffect(() => setDraft(folder), [folder.id]);
  const put = (patch: Partial<Folder>) => { setDraft((d) => ({ ...d, ...patch })); if (!isNew) onChange?.(patch); };
  const nameId = useId(), cwdId = useId();
  const label = draft.name.trim() || draft.cwd.split('/').filter((s) => s && s !== '~').pop() || 'workspace';

  return (
    <ModalForm
      variant="folder-dialog"
      title={isNew ? 'New workspace' : 'Workspace'}
      onClose={onClose}
      closeLabel={isNew ? 'Close new workspace' : 'Close workspace settings'}
      actions={
        <ModalActions
          destructive={!isNew && canDelete ? <Button kind="danger" onClick={onDelete}>Delete workspace</Button> : null}
          secondary={isNew ? <Button onClick={onClose}>Cancel</Button> : null}
          primary={isNew
            ? <Button kind="primary" onClick={() => onCreate?.({ ...draft, name: draft.name.trim(), cwd: draft.cwd.trim() || '~' })}>Create</Button>

            : <Button kind="primary" onClick={onClose}>Done</Button>}
        />
      }
    >
      <Field label="Working directory" htmlFor={cwdId}>
        <input id={cwdId} type="text" className="mono" value={draft.cwd}
               onChange={(e) => put({ cwd: e.target.value })} spellCheck="false" autoFocus
               onBlur={() => put({ cwd: draft.cwd.trim() || '~' })} placeholder="~/work/project" />
      </Field>
      <Field label="Name: optional; falls back to the last segment of the working directory" htmlFor={nameId}>
        <input id={nameId} type="text" value={draft.name}
               onChange={(e) => put({ name: e.target.value })}
               onBlur={() => put({ name: draft.name.trim() })}
               placeholder={draft.cwd.split('/').filter((s) => s && s !== '~').pop() || 'workspace'} />
      </Field>
      <FieldGroup label={'Icon: shown when the sidebar is collapsed; without one it falls back to “' + initials(label) + '”'}>
        {(labelledBy) => (
          <div className="iconpick" role="group" aria-labelledby={labelledBy}>
            <button type="button" className={draft.icon ? '' : 'on'} title="No icon: use initials"
                    aria-label="No icon, use initials" aria-pressed={!draft.icon}
                    onClick={() => put({ icon: null })}>{initials(label)}</button>
            {WS_ICON_KEYS.map((k) => (
              <button type="button" key={k} className={draft.icon === k ? 'on' : ''} title={k}
                      aria-label={'Icon ' + k} aria-pressed={draft.icon === k}
                      onClick={() => put({ icon: k })}><WsIcon name={k} /></button>
            ))}
          </div>
        )}
      </FieldGroup>
      <ThemeChoice label="Theme" value={draft.theme || 'paper'} onChange={(theme) => put({ theme: theme || 'paper' })} />
      <FieldGroup label="Terminal font size">
        {(labelledBy)=><div className="font-groups workspace-fonts" role="radiogroup" aria-labelledby={labelledBy}>
          <button type="button" role="radio" aria-checked={draft.fontSize===undefined}
                  className={draft.fontSize===undefined?'on':''} onClick={()=>put({fontSize:undefined})}>Global · {globalFontSize}</button>
          {FONT_SIZES.map((size)=><button key={size} type="button" role="radio" aria-checked={draft.fontSize===size}
                  className={draft.fontSize===size?'on':''} style={{fontSize:size+'px'}} onClick={()=>put({fontSize:size})}>{size}</button>)}
        </div>}
      </FieldGroup>
      <FieldGroup label="Terminal pattern">
        {(labelledBy) => (
          <div className="pattern-choices" role="radiogroup" aria-labelledby={labelledBy}>
            {PATTERNS.map((p) => (
              <button type="button" key={p} className={'pattern-chip pattern-' + p + (draft.pattern === p ? ' on' : '')}
                      aria-label={'Pattern ' + p} aria-checked={draft.pattern === p} role="radio"
                      onClick={() => put({ pattern: p })}><span>{p}</span></button>
            ))}
          </div>
        )}
      </FieldGroup>
    </ModalForm>
  );
}

function PaneSettings({ node, folder, onChange, onClose }: {
  node: PaneNode;
  folder: Folder;
  onChange: (patch: Partial<PaneNode>) => void;
  onClose: () => void;
}) {
  const cmdRef = useRef<HTMLInputElement | null>(null);
  const cmdId = useId();
  const [commandDraft,setCommandDraft]=useState(node.command);
  const committedCommand=useRef(node.command);

  useEffect(()=>{setCommandDraft(node.command);committedCommand.current=node.command},[node.id,node.command]);
  useEffect(() => {
    const id = setTimeout(() => cmdRef.current?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(id);
  }, []);
  const commitCommand=()=>{
    const command=commandDraft.trim()||'bash';
    setCommandDraft(command);
    if(command===committedCommand.current)return;
    committedCommand.current=command;
    onChange({command});
  };
  const finish=()=>{commitCommand();onClose()};

  return (
    <ModalForm variant="panesettings" title="Pane" onClose={finish} closeLabel="Close pane settings"
               actions={<ModalActions primary={<Button kind="primary" onClick={finish}>Done</Button>} />}>
      <Field label="Command" htmlFor={cmdId} hint={'Runs in '+folder.cwd+'. Press Enter or leave the field to restart the pane.'}>
        <input id={cmdId} className="mono ps-input" type="text" value={commandDraft} spellCheck="false" ref={cmdRef}
               placeholder="bash"
               onChange={(e) => setCommandDraft(e.target.value)}
               onBlur={commitCommand}
               onKeyDown={(e)=>{if(e.key==='Enter'){e.preventDefault();commitCommand()}}} />
      </Field>
    </ModalForm>
  );
}

function SetupNotice({mode,onRetry}: {mode: Runtime['mode']; onRetry: () => void}) {
  const [copied,setCopied]=useState(false), command=ttydLaunchCommand();
  return <div className="setup-notice" role="status"><strong>{mode==='file'?'Opened directly':'Demo mode'}</strong><span>{mode==='file'?'Browsers cannot start a shell. Launch this file with ttyd.':'This interactive guide is not connected to ttyd.'}</span><code>{command}</code><button onClick={()=>navigator.clipboard?.writeText(command).then(()=>setCopied(true))}>{copied?'Copied':'Copy launch command'}</button><button onClick={onRetry}>Retry ttyd</button></div>;
}

function FirstRunDialog({ capabilities, onProbe, onCreate }: {
  capabilities: Capabilities;
  onProbe: () => void;
  onCreate: (cwd: string, name: string) => void;
}) {
  const [cwd,setCwd]=useState('~'),[name,setName]=useState('home');
  const cwdId = useId(), nameId = useId();
  useEffect(()=>{if(capabilities.state==='ready'){setCwd(capabilities.cwd||capabilities.home||'~');setName((capabilities.cwd||'home').split('/').filter(Boolean).pop()||'home')}},[capabilities.state]);
  return (

    <ModalForm variant="first-run" title="Welcome to ttydterm"
               description="ttyd is connected. Check the shell, then create your first real workspace."
               actions={
                 <ModalActions
                   destructive={<Button disabled={capabilities.state === 'probing'} onClick={onProbe}>
                     {capabilities.state === 'probing' ? 'Checking…' : 'Check environment'}
                   </Button>}
                   primary={<Button kind="primary" onClick={() => onCreate(cwd || '~', name.trim())}>Create workspace</Button>}
                 />
               }>
      <Field label="Working directory" htmlFor={cwdId}>
        <input id={cwdId} className="mono" value={cwd} onChange={(e) => setCwd(e.target.value)} />
      </Field>
      <Field label="Optional name" htmlFor={nameId}>
        <input id={nameId} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
    </ModalForm>
  );
}

type NotificationPermissionState = NotificationPermission | 'unsupported';
const notificationPermission = ():NotificationPermissionState =>
  typeof Notification === 'undefined' || !isSecureContext ? 'unsupported' : Notification.permission;

function GlobalSettings({ fontSize, fontWeight, useTmux, tmux, notifyOnCommandFinish, notificationState,
                          onFontSize, onFontWeight, onTmux, onCheckTmux, onNotifications, onClose }: {
  fontSize: number;
  fontWeight: FontWeight;
  useTmux:boolean;
  tmux:TmuxState;
  notifyOnCommandFinish:boolean;
  notificationState:NotificationPermissionState;
  onFontSize: (size: number) => void;
  onFontWeight: (weight:FontWeight) => void;
  onTmux:(enabled:boolean)=>void;
  onCheckTmux?:()=>void;
  onNotifications:(enabled:boolean)=>void;
  onClose: () => void;
}) {
  return (
    <ModalForm variant="global-settings" title="Global settings" onClose={onClose} closeLabel="Close global settings"
               actions={<ModalActions primary={<Button kind="primary" onClick={onClose}>Done</Button>} />}>
      <FieldGroup label="Terminal font size">
        {(labelledBy) => (
          <div className="font-groups" role="radiogroup" aria-labelledby={labelledBy}>
            {FONT_SIZES.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={fontSize === n}
                      aria-label={n + 'px'}
                      className={fontSize === n ? 'on' : ''} style={{ fontSize: n + 'px' }}
                      onClick={() => onFontSize(n)}>{n}</button>
            ))}
          </div>
        )}
      </FieldGroup>
      <FieldGroup label="Terminal font weight">
        {(labelledBy)=><div className="weight-groups" role="radiogroup" aria-labelledby={labelledBy}>{FONT_WEIGHTS.map(({key,label,value})=><button key={key} type="button" role="radio" aria-checked={fontWeight===key} className={fontWeight===key?'on':''} style={{fontWeight:value}} onClick={()=>onFontWeight(key)}>{label}</button>)}</div>}
      </FieldGroup>
      <CheckboxField
        label="Use tmux when available"
        checked={useTmux}
        disabled={tmux.state==='probing'}
        onChange={onTmux}
        hintTone={tmux.state==='absent'||tmux.state==='error'?'warn':'default'}
        hint={<TmuxStatusHint tmux={tmux} onCheck={onCheckTmux}
          present="Changing this restarts every terminal. tmux keeps them alive after the browser closes."
          absent="tmux is unavailable in the PATH used by ttyd’s login shell. Terminals run without it." />}
      />
      <CheckboxField
        label="Notify when commands finish"
        checked={notifyOnCommandFinish}
        disabled={notificationState==='unsupported'||notificationState==='denied'}
        onChange={onNotifications}
        hint={notificationState==='unsupported' ? 'System notifications need browser support and a secure origin such as localhost or HTTPS.'
             : notificationState==='denied' ? 'Notifications are blocked. Allow them in this site’s browser settings.'
             : 'Notifies only when its terminal is not focused or this browser tab or window is not focused.'}
        hintTone={notificationState==='unsupported'||notificationState==='denied'?'warn':'default'}
      />
    </ModalForm>
  );
}

function BackupDialog({ config, onRestore, onClose }: {
  config: Config;
  onRestore: (config: Config) => void;
  onClose: () => void;
}) {
  const serialized = useMemo(() => JSON.stringify(config, null, 2), [config]);
  const [text, setText] = useState(serialized);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const taId = useId();
  useEffect(() => { setText(serialized); setMsg(null); }, [serialized]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setMsg({ ok: true, text: 'Copied to clipboard.' }); }
    catch { setMsg({ ok: false, text: 'Clipboard blocked: select the text and copy manually.' }); }
  };
  const restore = () => {
    let parsed: unknown;
    try { parsed = JSON.parse(text); }
    catch (e) { return setMsg({ ok: false, text: 'Invalid JSON: ' + (e instanceof Error ? e.message : String(e)) }); }
    const res = validateConfig(parsed);
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    onRestore(res.config);
  };

  return (
    <ModalForm title="Backup & restore" onClose={onClose} closeLabel="Close backup and restore"
               actions={
                 <ModalActions
                   destructive={<Button onClick={copy}>Copy</Button>}
                   secondary={<Button onClick={onClose}>Close</Button>}
                   primary={<Button kind="primary" onClick={restore}>Restore</Button>}
                 />
               }>
      <Field label="The entire workspace: workspaces, panes, splits, sizes, themes, sidebar width"
             htmlFor={taId}
             hintTone={msg && !msg.ok ? 'error' : 'default'}
             hint={msg ? msg.text : 'Paste a saved copy over this and press Restore.'}>
        <textarea id={taId} value={text} spellCheck="false"
                  onChange={(e) => { setText(e.target.value); setMsg(null); }} />
      </Field>
    </ModalForm>
  );
}

interface PaletteRow {
  kind: 'folder' | 'pane';
  key: string;
  folder: Folder;
  pane?: PaneNode;
  title: string;
  sub: string;
  hay: string;
}

function CommandPalette({ folders, activeId, onPick, onClose, inputRef }: {
  folders: Folder[];
  activeId: string;
  onPick: (row: PaletteRow) => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo<PaletteRow[]>(() => {
    const out: PaletteRow[] = [];
    folders.forEach((f) => {
      const label = folderLabel(f);
      out.push({ kind:'folder', key:'f:' + f.id, folder:f, title:label, sub:f.cwd,
                 hay: (label + ' ' + f.cwd).toLowerCase() });
      listPanes(f.layout).forEach((p) => {
        out.push({ kind:'pane', key:'p:' + p.id, folder:f, pane:p, title:p.command, sub:label + ' · ' + f.cwd,
                   hay: (p.command + ' ' + label + ' ' + f.cwd).toLowerCase() });
      });
    });
    return out;
  }, [folders]);

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) {
      return rows.slice().sort((a, b) => Number(b.folder.id === activeId) - Number(a.folder.id === activeId));
    }
    return rows.filter((r) => needle.split(/\s+/).every((t) => r.hay.includes(t)));
  }, [rows, q, activeId]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => {
    const el = listRef.current?.children[sel];
    el?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const commit = (row: PaletteRow | undefined) => { if (row) onPick(row); };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => hits.length ? (s+1)%hits.length : 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => hits.length ? (s-1+hits.length)%hits.length : 0); }
    else if (e.key === 'Enter') { e.preventDefault(); commit(hits[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <ModalForm variant="palette-form" title="Find a workspace or terminal" onClose={onClose} closeLabel="Close command palette">
      <div className="palette-body">
      <input ref={inputRef} className="pal-input" autoFocus value={q} spellCheck="false"
             aria-label="Search workspaces and terminals"
             placeholder="Go to a workspace or a terminal…"
             onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
      {hits.length ? (
        <div className="pal-list" ref={listRef} role="listbox" aria-label="Results">
          {hits.map((r, i) => {
            const th = themeOf(r.folder.theme);
            return (
              <button key={r.key} className={'pal-row' + (i === sel ? ' on' : '')} role="option"
                      aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => commit(r)}>
                <span className="pal-badge" style={{ '--p-bg': th.bg, '--p-fg': r.kind === 'pane' ? th.blue : th.fg }}>
                  {r.kind === 'pane'
                    ? <WsIcon name="terminal" />
                    : r.folder.icon ? <WsIcon name={r.folder.icon} /> : initials(r.title)}
                </span>
                <span className="pal-main">
                  <span className="pal-title">
                    {r.kind === 'pane' ? <span className="mono">{r.title}</span> : r.title}
                  </span>
                  <span className="pal-sub">{r.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="pal-empty">Nothing matches “{q}”.</p>
      )}
      <div className="pal-foot">
        <span><kbd>↑</kbd> <kbd>↓</kbd> move</span>
        <span><kbd>↵</kbd> open &amp; focus</span>
        <span><kbd>esc</kbd> close</span>
      </div>
      </div>
    </ModalForm>
  );
}

const folderLabel = (f: Folder) => f.name || f.cwd.split('/').filter((s: string) => s && s !== '~').pop() || 'workspace';

function ShortcutsDialog({onClose}:{onClose:()=>void}) {
  const groups=[['Workspaces',[['Alt + 1…9','Switch workspace and restore its last terminal'],['Ctrl/⌘ + Shift + ,','Workspace settings']]],['Panes',[['Alt + Arrow keys','Move between terminals'],['Enter · ↑↓ · Enter','Exchange terminals from the focused handle'],['Arrow keys','Navigate an open pane menu'],['Enter','Activate the selected item']]],['Application',[['Ctrl/⌘ + K or P','Find a workspace or terminal'],['Ctrl/⌘ + B','Toggle sidebar'],['Ctrl/⌘ + ,','Global settings'],['Escape','Close a menu or dialog']]]] as const;
  return <ModalForm variant="shortcuts-dialog" title="Keyboard shortcuts" onClose={onClose}>{groups.map(([title,items])=><section key={title} className="shortcut-group"><h3>{title}</h3>{items.map(([keys,label])=><div key={keys} className="shortcut-row"><kbd>{keys}</kbd><span>{label}</span></div>)}</section>)}</ModalForm>;
}

type FolderMenuState={source:'trigger'|'context';x:number;y:number};
function FolderRow({folder,compact,index,count,active,activity,canRemove,completedByPane,dragging,dragOffset,reordering,onDragStart,onFocus,onRemove,onMove}:{
  folder:Folder;compact:boolean;index:number;count:number;active:boolean;activity:number;canRemove:boolean;
  completedByPane:Record<string,number>;dragging:boolean;dragOffset:number;reordering:boolean;
  onDragStart:(folderId:string,event:React.PointerEvent<HTMLElement>)=>void;
  onFocus:(folder:Folder)=>void;onRemove:(id:string)=>void;onMove:(id:string,targetIndex:number)=>void;
}){
  const label=folderLabel(folder),completed=listPanes(folder.layout).reduce((sum,pane)=>sum+(completedByPane[pane.id]||0),0);
  const [menu,setMenu]=useState<FolderMenuState|null>(null);
  const trigger=useRef<HTMLButtonElement|null>(null),main=useRef<HTMLButtonElement|null>(null),menuRef=useRef<HTMLSpanElement|null>(null);
  useEffect(()=>{if(!menu)return;const close=()=>setMenu(null);addEventListener('pointerdown',close);return()=>removeEventListener('pointerdown',close)},[menu]);
  useLayoutEffect(()=>{
    const element=menuRef.current;if(!menu||!element)return;
    const nextX=clamp(menu.x,6,Math.max(6,innerWidth-element.offsetWidth-6));
    const nextY=clamp(menu.y,6,Math.max(6,innerHeight-element.offsetHeight-6));
    if(nextX!==menu.x||nextY!==menu.y){setMenu({...menu,x:nextX,y:nextY});return}
    requestAnimationFrame(()=>element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus());
  },[menu]);
  const closeToSource=()=>{const source=menu?.source;(source==='trigger'?trigger.current:main.current)?.focus();setMenu(null)};
  const menuKeys=(event:React.KeyboardEvent<HTMLSpanElement>)=>{
    const items=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],at=items.indexOf(document.activeElement as HTMLButtonElement);
    if(event.key==='ArrowDown'||event.key==='ArrowRight'){event.preventDefault();items[(at+1+items.length)%items.length]?.focus()}
    else if(event.key==='ArrowUp'||event.key==='ArrowLeft'){event.preventDefault();items[(at-1+items.length)%items.length]?.focus()}
    else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeToSource()}
  };
  return <div className={'folder'+(active?' active':'')+(activity?' activity-'+activity:'')+(dragging?' dragging':'')+(reordering?' reordering':'')}
              title={label+(index<9?': Alt+'+(index+1):'')}
              style={reordering?{transform:'translateY('+dragOffset+'px)'}:undefined}
              onContextMenu={(event:React.MouseEvent<HTMLDivElement>)=>{event.preventDefault();event.stopPropagation();setMenu({source:'context',x:event.clientX,y:event.clientY})}}>
    {activity?<span className="folder-activity" aria-hidden="true"/>:null}
    <button ref={main} type="button" className="folder-main" aria-current={active?'true':undefined}
            aria-keyshortcuts={index<9?'Alt+'+(index+1):undefined}
            aria-label={(compact?label:'Workspace '+label)+', position '+(index+1)+' of '+count+(completed?', '+completed+' completed command'+(completed===1?'':'s'):'')+(index<9?', Alt+'+(index+1):'')}
            onClick={()=>onFocus(folder)} onDoubleClick={()=>go('f',folder.id,'settings')}>
      <span className="folder-badge" title={'Drag to reorder '+label}
            onPointerDown={(event:React.PointerEvent<HTMLSpanElement>)=>onDragStart(folder.id,event)}>
        {folder.icon?<WsIcon name={folder.icon}/>:initials(label)}
      </span>
      {compact?null:<span className="folder-name">{label}</span>}
      {completed?<span className="folder-complete" aria-hidden="true"/>:null}
    </button>
    {compact?null:<span className={'folder-actions'+(menu?' open':'')} onPointerDown={(event)=>event.stopPropagation()}
      onKeyDown={(event)=>{if(event.key==='Escape'&&menu){event.preventDefault();event.stopPropagation();closeToSource()}}}>
      <button ref={trigger} className="folder-act" title={'Workspace menu: '+label} aria-label={'Workspace menu for '+label}
              aria-haspopup="menu" aria-expanded={!!menu} onClick={(event)=>{event.stopPropagation();const r=event.currentTarget.getBoundingClientRect();setMenu((value)=>value?null:{source:'trigger',x:r.right,y:r.bottom})}}><Ico.menu/></button>
    </span>}
    {menu?<span ref={menuRef} className="folder-menu fixed" role="menu" style={{left:menu.x+'px',top:menu.y+'px'}}
      onPointerDown={(event)=>event.stopPropagation()} onKeyDown={menuKeys}>
      <button role="menuitem" disabled={index===0} onClick={(event)=>{event.stopPropagation();setMenu(null);onMove(folder.id,index-1);requestAnimationFrame(()=>main.current?.focus())}}><span aria-hidden="true">↑</span><span>Move up</span></button>
      <button role="menuitem" disabled={index===count-1} onClick={(event)=>{event.stopPropagation();setMenu(null);onMove(folder.id,index+1);requestAnimationFrame(()=>main.current?.focus())}}><span aria-hidden="true">↓</span><span>Move down</span></button>
      <button role="menuitem" onClick={(event)=>{event.stopPropagation();setMenu(null);go('f',folder.id,'settings')}}><Ico.gear/><span>Settings</span></button>
      {canRemove?<button className="danger" role="menuitem" onClick={(event)=>{event.stopPropagation();setMenu(null);onRemove(folder.id)}}><Ico.close/><span>Close</span></button>:null}
    </span>:null}
  </div>;
}

function App() {
  const testMock = new URLSearchParams(location.search).has('mock');
  const [configured, setConfigured] = useState(() => testMock || hasSavedConfig());
  const [config, setConfig] = useState<Config>(() => testMock ? loadConfig() : (hasSavedConfig() ? loadConfig() : documentationConfig()));
  const [runtime, setRuntime] = useState<Runtime>(() => location.protocol==='file:' ? {mode:'file',reason:'Opened directly'} : {mode:'probing'});
  const [capabilities, setCapabilities] = useState<Capabilities>(()=>testMock
    ? {state:'ready',tmux:true,home:'~',cwd:'~',shell:'/bin/bash',writable:true}
    : {state:'unknown',tmux:false,home:'~',cwd:'~'});
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusReq, setFocusReq] = useState<FocusRequest | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null);
  const [appResizing, setAppResizing] = useState(false);
  const [lastPaneByFolder,setLastPaneByFolder]=useState<Record<string,string>>({});
  const [completedByPane,setCompletedByPane]=useState<Record<string,number>>({});
  const [activityByFolder,setActivityByFolder]=useState<Record<string,number>>({});
  const activityEnergy=useRef<Record<string,number>>({});
  const activityBytes=useRef<Record<string,number>>({});
  const [notificationState,setNotificationState]=useState<NotificationPermissionState>(notificationPermission);
  const paletteInputRef=useRef<HTMLInputElement|null>(null);
  const route = useRoute();
  const tmux = tmuxState(capabilities,runtime);
  const knownTmux=useRef<boolean|null>(capabilities.state==='ready'?capabilities.tmux:null);
  if(capabilities.state==='ready')knownTmux.current=capabilities.tmux;
  else if(capabilities.state==='error'&&knownTmux.current===null)knownTmux.current=false;

  const ui = config.ui;
  const effectiveTmux=ui.useTmux?(tmux.state==='present'?true:tmux.state==='absent'?false:knownTmux.current):false;
  const [viewportSize,setViewportSize]=useState(()=>({w:innerWidth,h:innerHeight,narrow:matchMedia('(max-width: 720px)').matches}));
  const viewportSizeRef=useRef(viewportSize);viewportSizeRef.current=viewportSize;
  const [browserResizing,setBrowserResizing]=useState(false);
  const browserResizeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const narrowViewport=viewportSize.narrow;
  const [narrowRailOpen,setNarrowRailOpen]=useState(false);
  const railOpen = narrowViewport ? narrowRailOpen : ui.railOpen;
  const setUi = useCallback((patch: Partial<UiState>) => setConfig((c) => ({ ...c, ui: { ...c.ui, ...patch } })), []);
  const setTmuxPolicy=useCallback((useTmux:boolean)=>setConfig((current)=>({
    ...current,ui:{...current.ui,useTmux},folders:current.folders.map((folder)=>({
      ...folder,layout:mapTree(folder.layout,(node)=>node.type==='pane'?{...node,persist:useTmux}:node),
    })),
  })),[]);
  const setRailOpen = useCallback((value: boolean | ((previous:boolean)=>boolean)) => {
    const next=typeof value==='function'?value(railOpen):value;
    if(narrowViewport)setNarrowRailOpen(next);
    else setUi({railOpen:next});
  },[narrowViewport,railOpen,setUi]);

  const checkCapabilities=useCallback(()=>{
    if(runtime.mode!=='ttyd')return;
    setCapabilities((current)=>({state:'probing',tmux:current.tmux,home:current.home,cwd:current.cwd}));
    probeCapabilities(runtime).then(setCapabilities).catch((error:unknown)=>setCapabilities({state:'error',tmux:false,home:'~',cwd:'~',error:error instanceof Error?error.message:String(error)}));
  },[runtime]);
  useEffect(() => { detectRuntime().then(setRuntime); }, []);
  useEffect(()=>{if(runtime.mode==='ttyd'&&capabilities.state==='unknown')checkCapabilities()},[runtime,capabilities.state,checkCapabilities]);
  useEffect(() => { if(configured) localStorage.setItem(STORE_KEY, JSON.stringify(config)); }, [config, configured]);
  const onOutputActivity=useCallback((folderId:string,bytes:number)=>{activityBytes.current[folderId]=(activityBytes.current[folderId]||0)+bytes},[]);
  useEffect(()=>{
    const timer=setInterval(()=>{
      const ids=new Set([...Object.keys(activityEnergy.current),...Object.keys(activityBytes.current)]),levels:Record<string,number>={};
      for(const id of ids){
        const next=Math.min(ACTIVITY_REFERENCE,(activityEnergy.current[id]||0)*ACTIVITY_DECAY+(activityBytes.current[id]||0));delete activityBytes.current[id];
        if(next>=ACTIVITY_FLOOR){activityEnergy.current[id]=next;levels[id]=activityLevel(next)}else delete activityEnergy.current[id];
      }
      setActivityByFolder((current)=>{const keys=new Set([...Object.keys(current),...Object.keys(levels)]);return [...keys].every((key)=>current[key]===levels[key])?current:levels});
    },ACTIVITY_TICK_MS);
    return()=>clearInterval(timer);
  },[]);

  const folders = config.folders;
  useEffect(()=>{
    const live=new Set(folders.map((folder)=>folder.id));
    for(const id of Object.keys(activityEnergy.current))if(!live.has(id))delete activityEnergy.current[id];
    for(const id of Object.keys(activityBytes.current))if(!live.has(id))delete activityBytes.current[id];
    setActivityByFolder((current)=>{const next=Object.fromEntries(Object.entries(current).filter(([id])=>live.has(id)));return Object.keys(next).length===Object.keys(current).length?current:next});
  },[folders]);
  const routedId = route[0] === 'f' ? route[1] : null;


  const [stickyId, setStickyId] = useState(routedId);
  const active = folders.find((f) => f.id === routedId)
              || folders.find((f) => f.id === stickyId)
              || folders[0];
  useEffect(() => { if (active) setStickyId(active.id); }, [active?.id]);


  if(!active) throw new Error('Configuration has no folders');
  const activeTheme = THEMES[active.theme] || THEMES.paper;
  const hasAttention=useMemo(()=>folders.some((folder)=>listPanes(folder.layout).some((item)=>(completedByPane[item.id]||0)>0)),[folders,completedByPane]);
  const configRef=useRef(config),activeIdRef=useRef(active.id);
  configRef.current=config;activeIdRef.current=active.id;
  useEffect(() => { document.documentElement.style.colorScheme = activeTheme.appearance; }, [activeTheme.appearance]);
  useEffect(()=>updateFavicon(activeTheme,hasAttention?'attention':'normal'),[activeTheme,hasAttention]);
  useEffect(() => {
    try { localStorage.setItem(BG_KEY, String(chromeVars(activeTheme)['--stage-bg'])); } catch {}
  }, [activeTheme]);


  const ownsUrl = route[0] === 'backup' || route[0] === 'new' || route[0] === 'palette' || route[0] === 'settings' || route[0] === 'shortcuts';
  useEffect(() => {
    if (ownsUrl) return;
    if (active && routedId !== active.id) history.replaceState(null, '', '#/f/' + encodeURIComponent(active.id));
  }, [active, routedId, ownsUrl]);

  const clearCompleted=useCallback((paneId:string)=>setCompletedByPane((current)=>{
    if(!current[paneId])return current;const next={...current};delete next[paneId];return next;
  }),[]);
  const focusFolderPane=useCallback((folder:Folder)=>{
    const panes=listPanes(folder.layout);const id=lastPaneByFolder[folder.id]&&panes.some(p=>p.id===lastPaneByFolder[folder.id])?lastPaneByFolder[folder.id]:panes[0]?.id;
    go('f',folder.id);if(id){clearCompleted(id);setFocusId(id);setFocusReq({id,n:Date.now()})}
  },[clearCompleted,lastPaneByFolder]);
  const onCommandComplete=useCallback((event:CommandCompletion)=>{
    if(event.duration<COMPLETION_ATTENTION_MS)return;
    const focusedPane=document.activeElement?.closest<HTMLElement>('.pane')?.dataset.paneId;
    const needsAttention=event.folderId!==activeIdRef.current||event.paneId!==focusedPane||document.visibilityState!=='visible'||!document.hasFocus();
    if(!needsAttention)return;
    setCompletedByPane((current)=>({...current,[event.paneId]:Math.min(99,(current[event.paneId]||0)+1)}));
    if(!configRef.current.ui.notifyOnCommandFinish||typeof Notification==='undefined'||Notification.permission!=='granted')return;
    const folder=configRef.current.folders.find((item)=>item.id===event.folderId);if(!folder)return;
    try{
      const notification=new Notification('Command finished',{body:'Workspace “'+folderLabel(folder)+'”',tag:'ttydterm-'+event.paneId});
      notification.onclick=()=>{window.focus();clearCompleted(event.paneId);go('f',event.folderId);setFocusId(event.paneId);setLastPaneByFolder((current)=>({...current,[event.folderId]:event.paneId}));setFocusReq({id:event.paneId,n:Date.now()});notification.close()};
    }catch{}
  },[clearCompleted]);
  useEffect(()=>{
    window.__reportCommandCompletion=onCommandComplete;
    return()=>{if(window.__reportCommandCompletion===onCommandComplete)delete window.__reportCommandCompletion};
  },[onCommandComplete]);
  useEffect(()=>{
    const acknowledgeFocusedPane=()=>{
      if(document.visibilityState!=='visible'||!document.hasFocus())return;
      const paneId=document.activeElement?.closest<HTMLElement>('.pane')?.dataset.paneId;
      if(paneId)clearCompleted(paneId);
    };
    addEventListener('focus',acknowledgeFocusedPane);document.addEventListener('visibilitychange',acknowledgeFocusedPane);
    return()=>{removeEventListener('focus',acknowledgeFocusedPane);document.removeEventListener('visibilitychange',acknowledgeFocusedPane)};
  },[clearCompleted]);
  const setCommandNotifications=useCallback(async(enabled:boolean)=>{
    if(!enabled){setUi({notifyOnCommandFinish:false});return}
    let permission=notificationPermission();
    if(permission==='default')try{permission=await Notification.requestPermission()}catch{permission='default'}
    setNotificationState(permission);
    setUi({notifyOnCommandFinish:permission==='granted'});
  },[setUi]);
  useEffect(()=>{
    const refresh=()=>{const permission=notificationPermission();setNotificationState(permission);if(permission==='denied'||permission==='unsupported')setUi({notifyOnCommandFinish:false})};
    refresh();addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)};
  },[setUi]);

  useEffect(() => {
    const paneIds:string[]=[];const collect=(n:LayoutNode|null|undefined):void=>{if(!n)return;if(n.type==='pane')paneIds.push(n.id);else n.children.forEach(collect)};collect(active?.layout);
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (e.altKey && /^[1-9]$/.test(e.key)) { const folder=folders[Number(e.key)-1];if(folder){e.preventDefault();e.stopPropagation();focusFolderPane(folder)}return; }
      if(e.altKey && ['arrowleft','arrowup','arrowright','arrowdown'].includes(k)) { const at=Math.max(0,paneIds.indexOf(focusId||''));const delta=k==='arrowleft'||k==='arrowup'?-1:1;const id=paneIds[(at+delta+paneIds.length)%paneIds.length];if(id){e.preventDefault();e.stopPropagation();setFocusId(id);setFocusReq({id,nonce:Date.now()})}return; }
      if (!mod) return;
      if (k === 'b') { e.preventDefault();e.stopPropagation();setRailOpen((v) => !v); }
      else if (k === 'k' || k === 'p') { e.preventDefault();e.stopPropagation();go('palette'); }
      else if (k === ',') { e.preventDefault();e.stopPropagation();go(e.shiftKey&&active?'f': 'settings', ...(e.shiftKey&&active?[active.id,'settings']:[])); }
    };

    addEventListener('keydown',onKey,{capture:true});
    return()=>removeEventListener('keydown',onKey,{capture:true});
  }, [setRailOpen,folders,active,focusId,focusFolderPane]);


  useEffect(()=>{
    const apply=()=>{
      const next={w:innerWidth,h:innerHeight,narrow:matchMedia('(max-width: 720px)').matches},previous=viewportSizeRef.current;
      if(previous.w!==next.w||previous.h!==next.h||previous.narrow!==next.narrow){
        viewportSizeRef.current=next;setViewportSize(next);
        if(previous.narrow!==next.narrow)setNarrowRailOpen(false);
      }
      setBrowserResizing(true);
      if(browserResizeTimer.current)clearTimeout(browserResizeTimer.current);
      browserResizeTimer.current=setTimeout(()=>{browserResizeTimer.current=null;setBrowserResizing(false)},BROWSER_RESIZE_SETTLE_MS);
    };
    addEventListener('resize',apply);
    return()=>{removeEventListener('resize',apply);if(browserResizeTimer.current)clearTimeout(browserResizeTimer.current)};
  },[]);

  const patchFolder = useCallback((id: string, fn: (folder:Folder)=>Folder) => {
    setConfig((c) => ({ ...c, folders: c.folders.map((f) => (f.id === id ? fn(f) : f)) }));
  }, []);


  const setDocTheme = useCallback((folderId: string, theme: string) => {
    patchFolder(folderId, (f) => (f.doc ? { ...f, theme } : f));
  }, [patchFolder]);

  const onSplit=useCallback((folderId:string,paneId:string,axis:SplitAxis,count:number)=>{
    patchFolder(folderId,(folder)=>({...folder,layout:splitPane(folder.layout,paneId,axis,count,ui.useTmux)}));
  },[patchFolder,ui.useTmux]);


  const commitClose = useCallback(() => {
    const paneId=confirmCloseId;if(!paneId)return;
    setConfirmCloseId(null);
    const commit=()=>{patchFolder(active.id,(f)=>({...f,layout:removePane(f.layout,paneId)}));setClosingId(null)};
    if(REDUCED())return commit();setClosingId(paneId);setTimeout(commit,160);
  },[active,patchFolder,confirmCloseId]);
  const onClose = useCallback((paneId: string) => setConfirmCloseId(paneId), []);

  const onResize=useCallback((folderId:string,path:number[],sizes:number[])=>{
    patchFolder(folderId,(f)=>{
      const walk = (node: LayoutNode, depth: number): LayoutNode => {
        if (depth === path.length) return node.type==='split' ? { ...node, sizes } : node;
        const i = path[depth];
        if(node.type==='pane') return node;
        const children = node.children.slice();
        children[i] = walk(children[i], depth + 1);
        return { ...node, children };
      };
      return { ...f, layout: f.layout ? walk(f.layout, 0) : null };
    });
  },[patchFolder]);

  const addFirstPane=useCallback((folderId:string)=>{
    patchFolder(folderId,(folder)=>({...folder,layout:pane('bash',ui.useTmux)}));
  },[patchFolder,ui.useTmux]);

  /* Exchanging trades two pane leaves. Terminals stay mounted because every
     pane keeps its id, and React keys panes by that id. */
  const onPaneExchange=useCallback((folderId:string,a:string,b:string)=>{
    patchFolder(folderId,(folder)=>({...folder,layout:swapPanes(folder.layout,a,b)}));
    setFocusId(a);
    setFocusReq({id:a,n:Date.now()});
  },[patchFolder]);

  const moveFolder=useCallback((id:string,targetIndex:number)=>setConfig((current)=>{
    const source=current.folders.findIndex((folder)=>folder.id===id);
    if(source<0||targetIndex<0||targetIndex>=current.folders.length||source===targetIndex)return current;
    const folders=current.folders.slice(),[folder]=folders.splice(source,1);folders.splice(targetIndex,0,folder);
    return {...current,folders};
  }),[]);

  const removeFolder = useCallback((id: string) => {
    setConfig((c) => {
      if (c.folders.length < 2) return c;
      const rest = c.folders.filter((f) => f.id !== id);
      if (id === active.id) go('f', rest[0].id);
      return { ...c, folders: rest };
    });
  }, [active]);


  const railRef = useRef<HTMLElement | null>(null);
  const startRailDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const target = e.currentTarget;
    const left = railRef.current?.getBoundingClientRect().left ?? 0;
    target.focus();
    target.classList.add('dragging');
    target.setPointerCapture(e.pointerId);
    setAppResizing(true);
    const move = (ev: PointerEvent) => setUi({ railWidth: clamp(Math.round(ev.clientX - left), RAIL_MIN, RAIL_MAX) });
    let done=false;
    const finish=()=>{
      if(done)return;done=true;target.classList.remove('dragging');
      target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',finish);
      target.removeEventListener('pointercancel',finish);target.removeEventListener('lostpointercapture',finish);
      setAppResizing(false);
    };
    target.addEventListener('pointermove',move);target.addEventListener('pointerup',finish);
    target.addEventListener('pointercancel',finish);target.addEventListener('lostpointercapture',finish);
  };
  const onRailKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const step = e.shiftKey ? 48 : 16;
    const next = e.key === 'Home' ? RAIL_MIN : e.key === 'End' ? RAIL_MAX
               : ui.railWidth + (e.key === 'ArrowLeft' ? -step : step);
    setUi({ railWidth: clamp(next, RAIL_MIN, RAIL_MAX) });
  };


  const routedPane = route[0] === 'f' && route[2] === 'pane' ? findPane(active?.layout, route[3]) : null;
  const showFolderDlg = route[0] === 'f' && route[2] === 'settings';
  const showNewDlg = route[0] === 'new';
  const showBackup = route[0] === 'backup';
  const showPalette = route[0] === 'palette';
  const showGlobalSettings = route[0] === 'settings';
  const showShortcuts=route[0]==='shortcuts';
  const closeDialog = () => go('f', active.id);

  const [newDraft, setNewDraft] = useState<Folder | null>(null);
  useEffect(() => {
    if (showNewDlg && !newDraft) setNewDraft({ id: uid('f-'), name: '', cwd: '~/', icon: null, pattern:'dots', theme:active?.theme||'paper', layout:null });
    if (!showNewDlg && newDraft) setNewDraft(null);
  }, [showNewDlg, newDraft]);


  const onPaneFocus=useCallback((folderId:string,paneId:string)=>{
    clearCompleted(paneId);setFocusId(paneId);setLastPaneByFolder((current)=>({...current,[folderId]:paneId}));
  },[clearCompleted]);
  const openPaneSettings=useCallback((folderId:string,paneId:string)=>go('f',folderId,'pane',paneId),[]);
  const openWorkspaceSettings=useCallback((folderId:string)=>go('f',folderId,'settings'),[]);

  const onPaneChange = useCallback((paneId: string, patch: Partial<PaneNode>) => {
    patchFolder(active.id, (f) => ({
      ...f,
      layout: mapTree(f.layout, (n) => (n.type === 'pane' && n.id === paneId ? { ...n, ...patch } : n)),
    }));
  }, [active, patchFolder]);

  const onPalettePick = (row: PaletteRow) => {
    if(row.kind==='pane'&&row.pane){clearCompleted(row.pane.id);go('f',row.folder.id);setFocusId(row.pane.id);setLastPaneByFolder(v=>({...v,[row.folder.id]:row.pane!.id}));setFocusReq({id:row.pane.id,n:Date.now()})}
    else focusFolderPane(row.folder);
  };

  /* Surfaces render in first-mount order, never in sidebar order. Reordering
     workspaces must not move a live terminal's DOM node. */
  const surfaceOrder=useRef<string[]>([]);
  {
    const live=new Set(folders.map((folder)=>folder.id));
    const kept=surfaceOrder.current.filter((id)=>live.has(id));
    const known=new Set(kept);
    surfaceOrder.current=kept.concat(folders.filter((folder)=>!known.has(folder.id)).map((folder)=>folder.id));
  }
  const mountedFolders=surfaceOrder.current
    .map((id)=>folders.find((folder)=>folder.id===id))
    .filter((folder): folder is Folder => !!folder);

  /* Sidebar rows preview their final slots with transforms. The persisted
     array changes once on release, so a pointermove never writes localStorage. */
  const [dragOrder,setDragOrder]=useState<string[]|null>(null);
  const [workspaceAnnouncement,setWorkspaceAnnouncement]=useState('');
  const announceWorkspace=(message:string)=>{setWorkspaceAnnouncement('');requestAnimationFrame(()=>setWorkspaceAnnouncement(message))};
  const [draggingFolder,setDraggingFolder]=useState<{id:string;offset:number;stride:number}|null>(null);
  const railListRef=useRef<HTMLDivElement|null>(null),suppressFolderClick=useRef<string|null>(null);

  const startFolderDrag=useCallback((folderId:string,event:React.PointerEvent<HTMLElement>)=>{
    if(event.button!==0||folders.length<2)return;
    const list=railListRef.current,row=event.currentTarget.closest<HTMLElement>('.folder'),trigger=event.currentTarget;
    if(!list||!row)return;
    const initialOrder=folders.map((folder)=>folder.id),sourceIndex=initialOrder.indexOf(folderId);
    const rows=[...list.querySelectorAll<HTMLElement>('.folder')];
    const stride=rows.length>1?Math.abs(rows[1].offsetTop-rows[0].offsetTop):row.offsetHeight;
    if(sourceIndex<0||stride<=0)return;
    const startY=event.clientY,startScroll=list.scrollTop,firstTop=rows[0]?.offsetTop||0;
    let order=initialOrder,dragging=false,lastY=startY,scrollTimer=0,done=false;
    trigger.setPointerCapture(event.pointerId);

    const apply=(clientY:number)=>{
      lastY=clientY;
      const offset=clientY-startY+(list.scrollTop-startScroll),slot=(row.offsetTop+offset-firstTop)/stride;
      const target=clamp(Math.round(slot),0,initialOrder.length-1);
      setDraggingFolder({id:folderId,offset,stride});
      const next=initialOrder.slice(),[moved]=next.splice(sourceIndex,1);next.splice(target,0,moved);
      if(next.some((id,index)=>id!==order[index])){order=next;setDragOrder(next)}
    };
    const stopScroll=()=>{if(scrollTimer){clearInterval(scrollTimer);scrollTimer=0}};
    const autoScroll=(clientY:number)=>{
      const box=list.getBoundingClientRect(),edge=28;
      const speed=clientY<box.top+edge?-12:clientY>box.bottom-edge?12:0;
      if(!speed){stopScroll();return}
      if(scrollTimer)return;
      scrollTimer=window.setInterval(()=>{
        const before=list.scrollTop;list.scrollTop+=speed;
        if(list.scrollTop===before){stopScroll();return}
        apply(lastY);
      },16);
    };
    const move=(moveEvent:PointerEvent)=>{
      if(!dragging){
        if(Math.abs(moveEvent.clientY-startY)<4)return;
        dragging=true;setDragOrder(initialOrder);
      }
      moveEvent.preventDefault();apply(moveEvent.clientY);autoScroll(moveEvent.clientY);
    };
    const finish=(commit:boolean)=>{
      if(done)return;done=true;
      trigger.removeEventListener('pointermove',move);trigger.removeEventListener('pointerup',up);
      trigger.removeEventListener('pointercancel',cancel);trigger.removeEventListener('lostpointercapture',cancel);
      removeEventListener('keydown',escape,{capture:true});stopScroll();
      if(trigger.hasPointerCapture(event.pointerId))trigger.releasePointerCapture(event.pointerId);
      if(dragging){
        suppressFolderClick.current=folderId;
        setTimeout(()=>{if(suppressFolderClick.current===folderId)suppressFolderClick.current=null},0);
      }
      if(commit&&dragging){
        const committed=order.slice(),position=committed.indexOf(folderId)+1;
        announceWorkspace('Moved workspace '+folderLabel(folders[sourceIndex])+' to position '+position+' of '+committed.length+'.');
        setConfig((current)=>{
          const byId=new Map(current.folders.map((folder)=>[folder.id,folder]));
          const next=committed.map((id)=>byId.get(id)).filter((folder):folder is Folder=>!!folder);
          return next.length===current.folders.length&&next.some((folder,index)=>folder!==current.folders[index])?{...current,folders:next}:current;
        });
      }
      setDragOrder(null);setDraggingFolder(null);
    };
    const up=(upEvent:PointerEvent)=>{
      const box=list.getBoundingClientRect(),inside=upEvent.clientX>=box.left&&upEvent.clientX<=box.right&&upEvent.clientY>=box.top&&upEvent.clientY<=box.bottom;
      finish(inside);
    },cancel=()=>finish(false);
    const escape=(keyEvent:KeyboardEvent)=>{if(keyEvent.key==='Escape'){keyEvent.preventDefault();finish(false)}};
    trigger.addEventListener('pointermove',move);trigger.addEventListener('pointerup',up);
    trigger.addEventListener('pointercancel',cancel);trigger.addEventListener('lostpointercapture',cancel);
    addEventListener('keydown',escape,{capture:true});
  },[folders]);
  const focusFolderFromRow=useCallback((folder:Folder)=>{
    if(suppressFolderClick.current===folder.id){suppressFolderClick.current=null;return}
    focusFolderPane(folder);
  },[focusFolderPane]);
  const moveFolderWithAnnouncement=(id:string,targetIndex:number)=>{
    const folder=folders.find((item)=>item.id===id);if(!folder)return;
    moveFolder(id,targetIndex);announceWorkspace('Moved workspace '+folderLabel(folder)+' to position '+(targetIndex+1)+' of '+folders.length+'.');
  };


  return (
    <DocThemeContext.Provider value={setDocTheme}>
    <TerminalAppearanceContext.Provider value={ui.fontSize+':'+ui.fontWeight}>
    <div className="shell" data-appearance={activeTheme.appearance} data-version={APP_VERSION}
         style={{...chromeVars(activeTheme),'--term-font-size':ui.fontSize+'px','--term-font-weight':FONT_WEIGHTS.find(({key})=>key===ui.fontWeight)?.value||400}}>
      {}
      <nav className={'rail' + (railOpen ? '' : ' collapsed')} aria-label="Workspaces" ref={railRef}
           style={{ flexBasis: (railOpen ? ui.railWidth : RAIL_COLLAPSED) + 'px' }}>
        {}
        <div className="rail-head">
          <button className="rail-toggle" title={(railOpen ? 'Hide' : 'Show') + ' sidebar (⌘/Ctrl+B)'}
                  aria-label={railOpen ? 'Hide sidebar' : 'Show sidebar'} aria-expanded={railOpen}
                  onClick={() => setRailOpen(!railOpen)}><Ico.panel /></button>
        </div>
        {}
        <div className={'rail-list'+(dragOrder?' reordering':'')} ref={railListRef}>
          {folders.map((folder,index)=>{const previewIndex=dragOrder?.indexOf(folder.id)??index,offset=draggingFolder?.id===folder.id
            ?draggingFolder.offset:(previewIndex-index)*(draggingFolder?.stride||0);return <FolderRow key={folder.id} folder={folder} index={index} count={folders.length} compact={!railOpen}
            active={folder.id===active.id} activity={activityByFolder[folder.id]||0} canRemove={folders.length>1} completedByPane={completedByPane}
            dragging={draggingFolder?.id===folder.id} dragOffset={offset}
            reordering={!!dragOrder} onDragStart={startFolderDrag}
            onFocus={focusFolderFromRow} onRemove={removeFolder} onMove={moveFolderWithAnnouncement}/>})}
          <button className="ico add" title="New workspace" aria-label="New workspace"
                  onClick={() => go('new')}><Ico.plus /></button>
        </div>
        {}
        {railOpen?<div className="rail-brand-meta">
          <span className="brand-block"><span className="brand-name">ttydterm</span><span className="brand-version" aria-label={'version '+APP_VERSION}>{APP_VERSION}</span></span>
        </div>:null}
        <div className="sr-live" role="status" aria-live="polite">{workspaceAnnouncement}</div>
        <div className="rail-foot">
          <button className="ico" title="Keyboard shortcuts" aria-label="Keyboard shortcuts" onClick={()=>go('shortcuts')}><Ico.keyboard /></button>
          <button className="ico rail-global" title="Global settings" aria-label="Global settings" onClick={() => go('settings')}><Ico.gear /></button>
          <button className="ico" title="Find a workspace or terminal (⌘/Ctrl+K)" aria-label="Command palette"
                  onClick={() => go('palette')}><Ico.search /></button>
          <button className="ico" title="Backup & restore" aria-label="Backup and restore"
                  onClick={() => go('backup')}><Ico.export /></button>
        </div>
      </nav>

      {}
      <div className={'rail-gutter' + (railOpen ? ' resizable' : '')}
           onPointerDown={railOpen ? startRailDrag : undefined}
           onKeyDown={railOpen ? onRailKey : undefined}
           role={railOpen ? 'separator' : undefined}
           tabIndex={railOpen ? 0 : undefined}
           aria-orientation={railOpen ? 'vertical' : undefined}
           aria-label={railOpen ? 'Resize sidebar' : undefined}
           aria-valuemin={railOpen ? RAIL_MIN : undefined}
           aria-valuemax={railOpen ? RAIL_MAX : undefined}
           aria-valuenow={railOpen ? ui.railWidth : undefined} />

      <main className="stage">
        {runtime.mode !== 'ttyd' && runtime.mode !== 'mock' ? <SetupNotice mode={runtime.mode} onRetry={()=>{setRuntime({mode:'probing'});detectRuntime().then(setRuntime)}} /> : null}
        {mountedFolders.map((f) => (
          <Surface key={f.id} folder={f} runtime={runtime} active={f.id===active.id} focusId={focusId} appResizing={appResizing} browserResizing={browserResizing}
                   closingId={closingId} focusReq={focusReq} completedByPane={completedByPane} useTmux={effectiveTmux} fontSize={workspaceFontSize(f.fontSize,ui.fontSize)}
                   layoutVersion={viewportSize.w+'x'+viewportSize.h+':'+String(railOpen)+':'+ui.railWidth}
                   onFocus={onPaneFocus} onSplit={onSplit} onClose={onClose} onResize={onResize}
                   onAddFirst={addFirstPane} onOpenSettings={openPaneSettings} onOpenWorkspaceSettings={openWorkspaceSettings} onCommandComplete={onCommandComplete} onOutputActivity={onOutputActivity}
                   onExchange={onPaneExchange} />
        ))}
      </main>

      {}
      <ModalShell open={!!confirmCloseId} onClose={() => setConfirmCloseId(null)}>
        <ModalForm variant="confirm-close" title="Close terminal?"
                   description="This ends the pane's current terminal connection."
                   onClose={() => setConfirmCloseId(null)} closeLabel="Keep the terminal open"
                   actions={
                     <ModalActions
                       secondary={<Button onClick={() => setConfirmCloseId(null)}>Cancel</Button>}
                       primary={<Button kind="danger" onClick={commitClose}>Close pane</Button>}
                     />
                   }><></></ModalForm>
      </ModalShell>

      <ModalShell open={runtime.mode === 'ttyd' && !configured} dismissible={false} onClose={() => {}}>
        <FirstRunDialog
          capabilities={capabilities}
          onProbe={checkCapabilities}
          onCreate={(cwd, name) => {
            const folder: Folder = { id: uid('f-'), name, cwd, icon: 'terminal', pattern: 'dots', theme: 'paper', layout: pane('exec bash -l', true) };
            setConfig({ version: CONFIG_VERSION, ui: { railWidth: RAIL_DEFAULT, railOpen: true, fontSize: 13, fontWeight:'regular', notifyOnCommandFinish:false, useTmux:true }, folders: [folder] });
            setConfigured(true);
            go('f', folder.id);
          }} />
      </ModalShell>

      <ModalShell open={showGlobalSettings} onClose={closeDialog}>
        <GlobalSettings fontSize={ui.fontSize} fontWeight={ui.fontWeight} useTmux={ui.useTmux} tmux={tmux}
          notifyOnCommandFinish={ui.notifyOnCommandFinish} notificationState={notificationState} onNotifications={setCommandNotifications} onClose={closeDialog}
          onTmux={setTmuxPolicy} onCheckTmux={runtime.mode==='ttyd'?checkCapabilities:undefined} onFontSize={(fontSize) => setUi({ fontSize })} onFontWeight={(fontWeight)=>setUi({fontWeight})} />
      </ModalShell>

      <ModalShell open={!!routedPane} className="pane-settings-dialog" onClose={closeDialog}>
        {routedPane ? <PaneSettings node={routedPane} folder={active} onChange={(patch) => onPaneChange(routedPane.id, patch)} onClose={closeDialog}/> : null}
      </ModalShell>

      <ModalShell open={showFolderDlg} onClose={closeDialog}>
        <FolderDialog folder={active} globalFontSize={ui.fontSize} canDelete={folders.length > 1} onClose={closeDialog}
          onChange={(patch) => patchFolder(active.id, (f) => ({ ...f, ...patch }))}
          onDelete={() => removeFolder(active.id)} />
      </ModalShell>

      <ModalShell open={showNewDlg && !!newDraft} onClose={() => go('f', active.id)}>
        {newDraft ? (
          <FolderDialog folder={newDraft} isNew globalFontSize={ui.fontSize} onClose={() => go('f', active.id)}
            onCreate={(next) => {
              const folder: Folder = { ...next, theme: next.theme || active.theme || 'paper', layout: pane('bash', ui.useTmux) };
              setConfig((c) => ({ ...c, folders: c.folders.concat(folder) }));
              go('f', folder.id);
            }} />
        ) : null}
      </ModalShell>

      <ModalShell open={showBackup} onClose={closeDialog}>
        <BackupDialog config={config} onClose={closeDialog}
          onRestore={(next) => { setConfig(next); go('f', next.folders[0].id); }} />
      </ModalShell>

      <ModalShell open={showPalette} className="palette" initialFocusRef={paletteInputRef} onClose={closeDialog}>
        <CommandPalette folders={folders} activeId={active.id} inputRef={paletteInputRef} onClose={closeDialog} onPick={onPalettePick} />
      </ModalShell>
      <ModalShell open={showShortcuts} onClose={closeDialog}><ShortcutsDialog onClose={closeDialog}/></ModalShell>
    </div>
    </TerminalAppearanceContext.Provider>
    </DocThemeContext.Provider>
  );
}

const root=document.getElementById('root');
if(!root) throw new Error('Missing #root');
createRoot(root).render(<App />);
