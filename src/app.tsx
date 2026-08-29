import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { paneLaunchCommand, shellCwd, shellQuote, tmuxLaunchCommand } from './commands';
import { Button, CheckboxField, Field, FieldGroup, ModalActions, ModalForm, ModalShell } from './modal';
import type {
  Capabilities, Config, Folder, FontWeight, LayoutNode, PaneNode, PatternName, Runtime,
  SplitAxis, Theme, TmuxState, TtydEndpoints, UiState, ValidationResult,
} from './types';

/* =====================================================================
   1. THEMES — a terminal palette is the pane's content surface, so these
   stay dark by default; the app chrome around them is now DERIVED from
   whichever theme is active (see chromeVars) so the whole window reads as
   one surface. `paper` is here so a light terminal is a first-class choice.
   ===================================================================== */
/* EVERY colour below carries text, so every one of them is measured against
   its own background at >= 4.5:1 (WCAG AA) — `dim` included. `dim` is what a
   terminal spends on timestamps, byte counts, `ls -la` mode bits and inactive
   log levels; the first cut of these palettes had it at 3.1-4.2:1 across all
   six themes, which is precisely the text a tired user squints at. It is now
   the palette's floor, not its exception. test.mjs recomputes the whole matrix
   from this object and fails the run if anything drops below AA. */
const THEMES: Record<string, Theme> = {
  night:  { label:'night', appearance:'dark', bg:'#11141c', fg:'#c8d1e4', dim:'#7682a1', cursor:'#7aa2f7', red:'#f7768e', green:'#9ece6a', yellow:'#e0af68', blue:'#7aa2f7', magenta:'#bb9af7', cyan:'#7dcfff', ui:{ canvas:'#272a31', sidebar:'#45474d', raised:'#2c2f36', field:'#20232a', hover:'#5d5f64', active:'#344a78', edge:'#7b7e85', text:'#f4f6fb', muted:'#d1d5df', danger:'#f7768e', warning:'#e0af68', success:'#9ece6a', focus:'#8bb3ff' } },
  ink:    { label:'ink', appearance:'dark', bg:'#0d0d0f', fg:'#d0d0d2', dim:'#7d7d83', cursor:'#d0d0d2', red:'#e05561', green:'#8cc265', yellow:'#d4b062', blue:'#61a6f2', magenta:'#c162de', cyan:'#56b6c2', ui:{ canvas:'#252527', sidebar:'#424244', raised:'#29292b', field:'#1d1d1f', hover:'#59595b', active:'#304b70', edge:'#77777a', text:'#f5f5f6', muted:'#d0d0d4', danger:'#f7768e', warning:'#e0af68', success:'#9ece6a', focus:'#78b7ff' } },
  ocean:  { label:'ocean', appearance:'dark', bg:'#0e1a2b', fg:'#c3d4e8', dim:'#7087a2', cursor:'#4fc3f7', red:'#ef7d84', green:'#7fd1a4', yellow:'#e5c07b', blue:'#5eb0ef', magenta:'#b48ead', cyan:'#4fc3f7', ui:{ canvas:'#253243', sidebar:'#405062', raised:'#293849', field:'#1c2a3b', hover:'#586879', active:'#285478', edge:'#75879a', text:'#edf5ff', muted:'#c5d2e2', danger:'#f7768e', warning:'#e0af68', success:'#9ece6a', focus:'#64c7ff' } },
  forest: { label:'forest', appearance:'dark', bg:'#101a13', fg:'#c6d6c4', dim:'#718a73', cursor:'#8fd97a', red:'#e08a7a', green:'#8fd97a', yellow:'#d9c471', blue:'#79b8c4', magenta:'#b394c9', cyan:'#79c4bb', ui:{ canvas:'#263128', sidebar:'#435047', raised:'#2a372d', field:'#1e2a21', hover:'#5b685e', active:'#315d48', edge:'#78897c', text:'#eff8ee', muted:'#c9d7c9', danger:'#f7768e', warning:'#e0af68', success:'#9ece6a', focus:'#9cecff' } },
  amber:  { label:'amber', appearance:'dark', bg:'#1a1510', fg:'#e0d3bd', dim:'#937f62', cursor:'#f0b429', red:'#e88b6a', green:'#b9c46b', yellow:'#f0b429', blue:'#94b3c9', magenta:'#c79ac0', cyan:'#8ec4bd', ui:{ canvas:'#332d25', sidebar:'#514a40', raised:'#393229', field:'#29231c', hover:'#696157', active:'#66511f', edge:'#908477', text:'#fff5e6', muted:'#ded1bc', danger:'#f7768e', warning:'#e0af68', success:'#9ece6a', focus:'#ffd166' } },
  paper:  { label:'paper', appearance:'light', bg:'#fbfaf6', fg:'#2c3038', dim:'#6c7079', cursor:'#2c3038', red:'#b3405a', green:'#4a7a32', yellow:'#96690b', blue:'#2a5db0', magenta:'#8a4a9e', cyan:'#1c7480', ui:{ canvas:'#e1e0dc', sidebar:'#d2d1cd', raised:'#f1f0ec', field:'#f8f7f3', hover:'#c3c2be', active:'#b9c9e8', edge:'#74777d', text:'#20242b', muted:'#545963', danger:'#9f2945', warning:'#765000', success:'#356b2d', focus:'#174fa7' } },
  daylight:{ label:'daylight', appearance:'light', bg:'#f7f8fa', fg:'#20242c', dim:'#626873', cursor:'#20242c', red:'#ad314b', green:'#3c7429', yellow:'#875e00', blue:'#245aa8', magenta:'#824292', cyan:'#166d78', ui:{ canvas:'#dde0e5', sidebar:'#cdd2d9', raised:'#eef0f3', field:'#f8f9fb', hover:'#bcc3cc', active:'#b5c8e6', edge:'#6c737d', text:'#171b22', muted:'#4d5560', danger:'#9f2945', warning:'#765000', success:'#356b2d', focus:'#174f9e' } },
  mist:   { label:'mist', appearance:'light', bg:'#eef3f7', fg:'#202a35', dim:'#5d6875', cursor:'#202a35', red:'#a83650', green:'#356f37', yellow:'#805b00', blue:'#20599f', magenta:'#79458d', cyan:'#146b75', ui:{ canvas:'#d4dce3', sidebar:'#c3ced8', raised:'#e4ebf0', field:'#f1f5f8', hover:'#b2c0cc', active:'#aec6df', edge:'#65717d', text:'#17212b', muted:'#465462', danger:'#9f2945', warning:'#765000', success:'#356b2d', focus:'#145296' } },
  sand:   { label:'sand', appearance:'light', bg:'#f4efe3', fg:'#302c25', dim:'#696158', cursor:'#302c25', red:'#aa394c', green:'#467126', yellow:'#805900', blue:'#315a9b', magenta:'#7d478a', cyan:'#1c6b70', ui:{ canvas:'#ddd6c8', sidebar:'#cec4b3', raised:'#ebe4d7', field:'#f6f1e8', hover:'#bfb3a1', active:'#c3c9d7', edge:'#746b60', text:'#262119', muted:'#574f45', danger:'#9f2945', warning:'#765000', success:'#356b2d', focus:'#274f91' } },
};
const THEME_KEYS = Object.keys(THEMES);

/* The contrast maths, in the page, so the test measures THIS source of truth
   instead of a copy that can drift out of step with it. */
/* The active theme, resolved safely: an unknown key (a hand-edited backup, a
   removed theme) falls back rather than handing `undefined` to the renderer. */
const themeOf = (key: string | null | undefined): Theme => (key ? THEMES[key] : undefined) || THEMES.paper;

const _rgb = (h: string) => { h = h.replace('#',''); return [0,2,4].map((i) => parseInt(h.slice(i,i+2),16)); };
const _lin = (c: number) => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
const luminance = (h: string) => { const [r,g,b] = _rgb(h).map(_lin); return 0.2126*r + 0.7152*g + 0.0722*b; };
const contrast = (a: string, b: string) => {
  const l1 = luminance(a), l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};
/* Test seam: every theme colour that carries text, against its own bg. */
window.__contrastAudit = () => {
  const TEXT: Array<keyof Theme & ('fg'|'dim'|'red'|'green'|'yellow'|'blue'|'magenta'|'cyan'|'cursor')> =
    ['fg','dim','red','green','yellow','blue','magenta','cyan','cursor'];
  const out: Array<{ theme: string; key: string; kind: string; ratio: number; min: number }> = [];
  for (const [name, t] of Object.entries(THEMES)) {
    TEXT.forEach((k) => out.push({ theme:name, key:k, kind:'text', ratio:+contrast(t[k], t.bg).toFixed(2), min:4.5 }));
    // Explicit UI tokens are audited on the exact surfaces that carry them.
    out.push({ theme:name, key:'focus-ring', kind:'ui', ratio:+contrast(t.blue, t.bg).toFixed(2), min:3 });
    /* Selection forces terminal-background ink onto solid theme blue. This
       keeps selected ANSI colours from becoming unreadable and clears AA. */
    out.push({ theme:name, key:'terminal-selection', kind:'text', ratio:+contrast(t.bg, t.blue).toFixed(2), min:4.5 });
    out.push({ theme:name, key:'ui-text/sidebar', kind:'text', ratio:+contrast(t.ui.text, t.ui.sidebar).toFixed(2), min:4.5 });
    out.push({ theme:name, key:'ui-muted/sidebar', kind:'text', ratio:+contrast(t.ui.muted, t.ui.sidebar).toFixed(2), min:4.5 });
    out.push({ theme:name, key:'ui-text/raised', kind:'text', ratio:+contrast(t.ui.text, t.ui.raised).toFixed(2), min:4.5 });
    out.push({ theme:name, key:'ui-muted/raised', kind:'text', ratio:+contrast(t.ui.muted, t.ui.raised).toFixed(2), min:4.5 });
    out.push({ theme:name, key:'ui-focus/sidebar', kind:'ui', ratio:+contrast(t.ui.focus, t.ui.sidebar).toFixed(2), min:3 });
    out.push({ theme:name, key:'ui-danger/raised', kind:'text', ratio:+contrast(t.ui.danger, t.ui.raised).toFixed(2), min:4.5 });
    out.push({ theme:name, key:'ui-warning/raised', kind:'text', ratio:+contrast(t.ui.warning, t.ui.raised).toFixed(2), min:4.5 });
    out.push({ theme:name, key:'ui-success/raised', kind:'text', ratio:+contrast(t.ui.success, t.ui.raised).toFixed(2), min:4.5 });
    out.push({ theme:name, key:'selected-ink/selected', kind:'text', ratio:+contrast(t.bg, t.blue).toFixed(2), min:4.5 });
  }
  return out;
};

/* A pane's own palette. Note --t-edge / --t-ring: the pane border and focus
   ring are MIXED FROM THE PANE'S OWN COLOURS, so a paper pane gets a soft grey
   hairline and a night pane a soft light one — no fixed app blue anywhere. */
/* Deterministic, DOM-free terminal atmosphere. Grid index is the only identity
   input, so the same layout always receives the same four soft-horizon fields.
   Focus doubles colour from 4% to 8%; neither state adds a drop shadow. */
const seededPane = (index: number, salt = 3) => {
  let x = (index + 1) * 2654435761 + salt * 1013904223;
  x ^= x >>> 16;
  return x >>> 0;
};
const hsla = (h: number, s: number, l: number, a: number) => `hsla(${((h % 360) + 360) % 360} ${s}% ${l}% / ${a})`;
const softHorizonBackground = (index: number, active = false) => {
  const amount = 0.04 * (active ? 2 : 1);
  const seed = seededPane(index);
  const rotation = seed % 360;
  return [
    `linear-gradient(${175 + seed % 12}deg,${hsla(rotation + 215,72,52,amount * .8)} 0%,transparent 42%)`,
    `linear-gradient(${5 + seed % 15}deg,transparent 52%,${hsla(rotation + 165,68,51,amount * .72)} 100%)`,
    `linear-gradient(90deg,${hsla(rotation + 28,75,53,amount * .55)} 0%,transparent 35%)`,
    `linear-gradient(270deg,${hsla(rotation + 300,70,53,amount * .45)} 0%,transparent 30%)`,
  ].join(',');
};
const paneGridIndex = (layout: LayoutNode | null, paneId: string): number => {
  let index = 0;
  const visit = (node: LayoutNode | null): number => {
    if (!node) return -1;
    if (node.type === 'pane') return node.id === paneId ? index : (index++, -1);
    for (const child of node.children) {
      const found = visit(child);
      if (found >= 0) return found;
    }
    return -1;
  };
  return Math.max(0, visit(layout));
};
/* The terminal panes retain their existing solid/patterned treatment. Only the
   sidebar uses the finalized atmosphere, at its active 8% strength. */
const sidebarAtmosphereVars = () => softHorizonBackground(0, true);
/* Small verification seam: the shipping pure functions, not a test-side copy. */
window.__terminalAtmosphere = { seededPane, softHorizonBackground, paneGridIndex, sidebarAtmosphereVars };

const themeVars = (t: Theme): React.CSSProperties => ({
  '--t-bg': t.bg, '--t-fg': t.fg, '--t-dim': t.dim, '--t-cursor': t.cursor,
  '--t-red': t.red, '--t-green': t.green, '--t-yellow': t.yellow,
  '--t-blue': t.blue, '--t-magenta': t.magenta, '--t-cyan': t.cyan,
  '--t-edge': 'color-mix(in srgb, ' + t.fg + ' 26%, ' + t.bg + ')',
  /* The focus ring is the theme's blue at full strength: diluting it into the
     background is what made "active" ambiguous. Every theme's blue clears 3:1
     on its own bg (7.3-8.7 in practice) — asserted in the audit above. */
  '--t-ring': t.blue,
  '--t-skel': 'color-mix(in srgb, ' + t.fg + ' 12%, ' + t.bg + ')',
  /* Workspace identity should be sensed, not read. Keep pattern ink only 5%
     away from the terminal background; using foreground with opacity made a
     second text-like layer that competed with real output. */
  '--t-pattern': 'color-mix(in srgb, ' + t.fg + ' 5%, ' + t.bg + ')',
});

/* Chrome derived from the ACTIVE theme. Since panes carry NO resting border,
   this step is the only thing separating a terminal from the surface around
   it — so it is doing real work and is measured, not guessed. At the old 8%
   the terminal/stage ratio was ~1.17, which reads as one flat slab once the
   hairline is gone; at 16% it is ~1.40, a clear edge that is still quiet
   enough that six panes do not look like six cards on a contrasting mat.
   test.mjs measures the RENDERED colours against a floor in every theme. */
const chromeVars = (t: Theme): React.CSSProperties => ({
  ...themeVars(t),
  '--stage-bg': t.ui.canvas,
  '--stage-panel': t.ui.raised,
  '--stage-edge': t.ui.edge,
  '--stage-ink': t.ui.text,
  '--stage-accent': t.ui.focus,
  /* Finalized rail: terminal base + pane-zero horizon + terminal text tokens. */
  '--ui-panel': t.bg,
  '--ui-panel-atmosphere': sidebarAtmosphereVars(),
  '--ui-raised': t.ui.raised,
  '--ui-field': t.ui.field,
  '--ui-hover': 'color-mix(in srgb, ' + t.fg + ' 14%, ' + t.bg + ')',
  '--ui-active': t.blue,
  '--ui-active-ink': t.bg,
  '--ui-edge': t.ui.edge,
  '--ui-ink': t.fg,
  '--ui-muted': t.dim,
  '--ui-accent': t.ui.focus,
  '--ui-danger': t.ui.danger,
  '--ui-warn': t.ui.warning,
  '--ui-success': t.ui.success,
  '--ui-selected-ink': t.bg,
  '--ui-shadow': 'color-mix(in srgb, ' + t.bg + ' 62%, transparent)',
  '--ui-scrim': 'color-mix(in srgb, ' + t.bg + ' 62%, transparent)',
  '--panel': t.ui.raised, '--ink': t.ui.text, '--muted': t.ui.muted,
  '--line': t.ui.edge, '--accent': t.ui.focus, '--danger': t.ui.danger,
});

/* =====================================================================
   2. CONFIG — one JSON object, the whole app state, backup/restore-able.
   v3 adds `ui` (rail width/open) and a per-folder `icon`; a v2 blob still
   loads because validate rebuilds from scratch and defaults what is missing.
   ===================================================================== */
const STORE_KEY = 'ttyd-workspace-v2';
const BG_KEY = 'ttyd-workspace-bg';
const CONFIG_VERSION = 6;
const FONT_SIZES = [11, 12, 13, 14, 16, 18];
const FONT_WEIGHTS: Array<{key:FontWeight;label:string;value:number}> = [{key:'regular',label:'Regular',value:400},{key:'semibold',label:'Semi bold',value:600},{key:'bold',label:'Bold',value:700}];
const PATTERNS: PatternName[] = ['plain','dots','grid','diagonal','cross','waves','bricks'];
const defaultPattern = (id: string): PatternName => PATTERNS[1 + (hash32(id) % (PATTERNS.length - 1))];
const MIN_W = 260;   // a pane never renders narrower than this…
const MIN_H = 140;   // …or shorter than this; the area scrolls instead.
/* THE spacing token, read from the stylesheet rather than repeated here. The
   layout maths reserves this much for every divider, and CSS paints exactly
   this much for every gutter (page margin, sidebar channel, pane channel), so
   there is one number and it cannot drift out of step with itself. */
const GAP = (() => {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
  return Number.isFinite(v) && v > 0 ? v : 8;
})();
const FLOOR = 0.08;  // smallest share a slot may be dragged to (bounds canvas growth)
const RAIL_MIN = 148, RAIL_MAX = 420, RAIL_DEFAULT = 208;
/* Collapsed width == the fixed icon track in the stylesheet (--rail-icon-col),
   so a badge sits at the same x whether the rail is open or shut. */
const RAIL_COLLAPSED = 52;

const uid = (p: string) => p + Math.random().toString(36).slice(2, 9);
const pane = (command: string, persist = false): PaneNode => ({ type:'pane', id: uid('p-'), command, persist });
const equal = (n: number) => Array.from({ length: n }, () => 1 / n);
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function defaultConfig(): Config {
  return {
    version: CONFIG_VERSION,
    ui: { railWidth: RAIL_DEFAULT, railOpen: true, fontSize: 13, fontWeight:'regular' },
    folders: [
      {
        id: 'f-jr', name: 'kalviumjr', cwd: '~/work/kalviumjr', icon: 'code', pattern: 'dots' as const, theme:'paper',
        layout: {
          type: 'split' as const, axis: 'columns' as const, sizes: [0.56, 0.44],
          children: [
            pane('pi', true),
            { type: 'split' as const, axis: 'rows' as const, sizes: [0.55, 0.45],
              children: [ pane('npm run dev', true), pane('git status', false) ] },
          ],
        },
      },
      {
        id: 'f-infra', name: 'infra', cwd: '~/work/infra', icon: 'server', pattern: 'grid' as const, theme:'paper',
        layout: { type: 'split' as const, axis: 'rows' as const, sizes: [0.62, 0.38],
          children: [ pane('k9s', true), pane('journalctl -f', true) ] },
      },
      { id: 'f-notes', name: 'notes', cwd: '~/notes', icon: 'book', pattern: 'diagonal' as const, theme:'paper', layout: pane('ls -la', false) },
    ],
  };
}

/* Restore input is UNTRUSTED: it arrives from a textarea or from localStorage,
   so it enters as `unknown` and only becomes a Config by being rebuilt here. */
function validateConfig(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Not an object.' };
  const source = raw as { folders?: unknown; theme?: unknown; ui?: unknown };
  if (!Array.isArray(source.folders)) return { ok: false, error: 'Missing a `folders` array.' };
  const seen = new Set<string>();
  const walk = (input: unknown, where: string): LayoutNode | null => {
    if (!input) return null;
    const n = input as Record<string, unknown>;
    if (n.type === 'pane') {
      if (typeof n.command !== 'string') throw new Error(where + ': pane needs a string `command`.');
      const id = typeof n.id === 'string' && n.id && !seen.has(n.id) ? n.id : uid('p-');
      seen.add(id);
      return { type:'pane', id, command: n.command as string, persist: !!n.persist };
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
  try {
    const folders: Folder[] = source.folders.map((entry: unknown, i: number) => {
      if (!entry || typeof entry !== 'object') throw new Error('folder ' + i + ' is not an object.');
      const f = entry as Record<string, unknown>;
      const legacyTheme = typeof source.theme === 'string' ? source.theme : null;
      return {
        id: typeof f.id === 'string' && f.id ? f.id : uid('f-'),
        name: typeof f.name === 'string' ? f.name : '',
        cwd: typeof f.cwd === 'string' ? f.cwd : '~',
        theme: typeof f.theme === 'string' && THEMES[f.theme] ? f.theme
             : (legacyTheme && THEMES[legacyTheme] ? legacyTheme : 'paper'),
        icon: typeof f.icon === 'string' && WS_ICONS[f.icon] ? f.icon : null,
        pattern: PATTERNS.includes(f.pattern as PatternName) ? f.pattern as PatternName
               : defaultPattern(typeof f.id === 'string' ? f.id : String(i)),
        layout: walk(f.layout, 'folder ' + i),
      };
    });
    if (!folders.length) throw new Error('Needs at least one folder.');
    const rawUi = (source.ui && typeof source.ui === 'object' ? source.ui : {}) as Record<string, unknown>;
    const ui = {
      railWidth: clamp(Number(rawUi.railWidth) || RAIL_DEFAULT, RAIL_MIN, RAIL_MAX),
      railOpen: rawUi.railOpen === undefined ? true : !!rawUi.railOpen,
      fontSize: FONT_SIZES.includes(Number(rawUi.fontSize)) ? Number(rawUi.fontSize) : 13,
      fontWeight: FONT_WEIGHTS.some(({key})=>key===rawUi.fontWeight) ? rawUi.fontWeight as FontWeight : 'regular',
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

/* Same-origin paths exactly follow vanilla ttyd, including --base-path. A
   static host's /token will fail this shape check and stays in documentation
   mode; file:// is classified without making a meaningless request. */
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
async function probeCapabilities(runtime: Runtime, timeout=5000): Promise<Capabilities> {
  if(runtime.mode!=='ttyd') throw new Error('ttyd is not connected');
  const connected = runtime;
  const marker='__TTYDTERM_PROBE_'+Math.random().toString(36).slice(2)+'__';
  return new Promise<Capabilities>((resolve,reject)=>{
    const socket=new WebSocket(connected.endpoints.ws,['tty']),encoder=new TextEncoder(),decoder=new TextDecoder();let output='',sent=false;
    const timer=setTimeout(()=>{socket.close();reject(new Error('No writable shell response. Restart ttyd with --writable.'))},timeout);
    const send=(text: string)=>{const bytes=encoder.encode(text),payload=new Uint8Array(bytes.length+1);payload[0]=48;payload.set(bytes,1);socket.send(payload)};
    socket.binaryType='arraybuffer';
    socket.onopen=()=>socket.send(encoder.encode(JSON.stringify({AuthToken:connected.token,columns:80,rows:24})));
    socket.onmessage=(event: MessageEvent<ArrayBuffer>)=>{const bytes=new Uint8Array(event.data);if(String.fromCharCode(bytes[0])!=='0')return;output+=decoder.decode(bytes.slice(1),{stream:true});if(!sent){sent=true;send(`printf '${marker}|%s|%s|%s|' "$HOME" "$PWD" "$SHELL"; command -v tmux >/dev/null && printf '1' || printf '0'; printf '|${marker}\\n'\r`)}const start=output.indexOf(marker+'|'),end=output.indexOf('|'+marker,start+marker.length+1);if(start>=0&&end>start){clearTimeout(timer);const values=output.slice(start+marker.length+1,end).split('|');socket.close(1000);resolve({state:'ready',home:values[0]||'~',cwd:values[1]||'~',shell:values[2]||'/bin/bash',tmux:values[3]==='1',writable:true})}};
    socket.onerror=()=>{clearTimeout(timer);reject(new Error('Capability probe connection failed'))};
  });
}

/* =====================================================================
   3. LAYOUT TREE
   ===================================================================== */
const normalize = (sizes: number[]): number[] => {
  const clean = sizes.map((s) => (Number.isFinite(s) && s > 0 ? s : 0.0001));
  const sum = clean.reduce((a, b) => a + b, 0);
  return clean.map((s) => s / sum);
};

/* Minimum px box in which every leaf still meets MIN_W/MIN_H at the CURRENT
   size fractions. For a columns split a child gets sizes[i]*(W-gaps), so the
   parent needs W >= max(min_i / sizes[i]) + gaps. Overflow past the viewport is
   what produces the scrollbars. */
function nodeMin(node: LayoutNode | null): { w: number; h: number } {
  if (!node) return { w: MIN_W, h: MIN_H };
  if (node.type === 'pane') return { w: MIN_W, h: MIN_H };
  const kids = node.children.map(nodeMin);
  const gaps = (node.children.length - 1) * GAP;
  if (node.axis === 'columns') {
    return {
      w: Math.max(...kids.map((k, i) => k.w / Math.max(node.sizes[i], 1e-4))) + gaps,
      h: Math.max(...kids.map((k) => k.h)),
    };
  }
  return {
    w: Math.max(...kids.map((k) => k.w)),
    h: Math.max(...kids.map((k, i) => k.h / Math.max(node.sizes[i], 1e-4))) + gaps,
  };
}

const mapTree = (node: LayoutNode | null, fn: (node: LayoutNode) => LayoutNode): LayoutNode | null => {
  if (!node) return null;
  const out = fn(node);
  if (out !== node) return out;
  if (node.type === 'split') {
    const children = node.children.map((c) => mapTree(c, fn)).filter((c): c is LayoutNode => !!c);
    return children.some((c, i) => c !== node.children[i]) ? { ...node, children } : node;
  }
  return node;
};

/* Split a leaf into `count` slots. The existing pane always becomes children[0]
   — i.e. it keeps the leftmost column / topmost row. */
const splitPane = (root: LayoutNode | null, paneId: string, axis: SplitAxis, count: number) =>
  mapTree(root, (n) => {
    if (n.type !== 'pane' || n.id !== paneId) return n;
    // A new slot is a NEW SHELL, not a second copy of whatever the source pane
    // happens to be running: cloning `npm run dev` into three panes would boot
    // three dev servers on the same port. Fresh panes get `bash` (the command
    // ttyd itself is started with) and never inherit `persist`.
    const extra = Array.from({ length: count - 1 }, () => pane('bash', false));
    return { type:'split', axis, sizes: equal(count), children: [n, ...extra] };
  });

/* Remove a leaf; collapse a split that drops to a single child. */
function removePane(node: LayoutNode | null, paneId: string): LayoutNode | null {
  if (!node) return null;
  if (node.type === 'pane') return node.id === paneId ? null : node;
  const kept: LayoutNode[] = [];
  const sizes: number[] = [];
  node.children.forEach((c, i) => {
    const next = removePane(c, paneId);
    if (next) { kept.push(next); sizes.push(node.sizes[i]); }
  });
  if (!kept.length) return null;
  if (kept.length === 1) return kept[0];
  return { ...node, children: kept, sizes: normalize(sizes) };
}

const eachPane = (node: LayoutNode | null, fn: (pane: PaneNode) => void): void => {
  if (!node) return;
  if (node.type === 'pane') fn(node);
  else node.children.forEach((c) => eachPane(c, fn));
};
const findPane = (node: LayoutNode | null, id: string | undefined): PaneNode | null => {
  let hit: PaneNode | null = null;
  eachPane(node, (p) => { if (p.id === id) hit = p; });
  return hit;
};
const countPanes = (node: LayoutNode | null) => { let n = 0; eachPane(node, () => n++); return n; };
const listPanes = (node: LayoutNode | null): PaneNode[] => { const out: PaneNode[] = []; eachPane(node, (p) => out.push(p)); return out; };

/* =====================================================================
   4. MOCK TERMINAL — the single seam ttyd replaces.
   Returns rows of coloured spans so every palette entry is visible.
   ===================================================================== */
const hash32 = (s: string) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed: number) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

/* A mock row is a list of [text, colour-key] spans, or one `ls` grid. */
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

/* Returns: [{ kind:'row'|'ls', spans|items }] */
const DOCS: Record<string, MockSpan[]> = {
  readme: [
    ['ttydterm is a terminal workspace in one offline HTML file.', 'fg'],
    ['Without ttyd, this page is its own interactive guide.', 'dim'],
    ['With ttyd, every pane becomes a real writable terminal.', 'green'],
    ['https://github.com/anilgulecha/ttydterm', 'cyan'],
  ],
  install: [
    ['1. Save this page as ~/ttydterm.html', 'fg'],
    ['2. Install vanilla ttyd using your package manager.', 'fg'],
    ['3. Run the launch command shown in the Setup workspace.', 'fg'],
    ['The default binds only to 127.0.0.1.', 'yellow'],
  ],
  setup: [
    ['Browsers cannot start a local shell.', 'yellow'],
    ['Open a terminal and run:', 'fg'],
    ['ttyd -i 127.0.0.1 -p 7681 -W -a -O -I "$HOME/ttydterm.html" -t cursorBlink=false bash -l', 'cyan'],
    ['Then open http://127.0.0.1:7681', 'green'],
  ],
  keyboard: [
    ['Alt+1…9        switch workspace', 'fg'],
    ['Alt+Arrow      focus neighbouring pane', 'fg'],
    ['Ctrl/Cmd+K     search workspaces and panes', 'fg'],
    ['Ctrl/Cmd+B     toggle sidebar', 'fg'],
    ['Ctrl/Cmd+,     global settings', 'fg'],
  ],
  themes: [
    ['Open Global settings with Ctrl/Cmd+,', 'fg'],
    ['Choose from five dark and four accessible light themes.', 'fg'],
    ['Font size and theme take effect immediately.', 'green'],
  ],
  security: [
    ['Writable terminals are powerful.', 'yellow'],
    ['Keep the default 127.0.0.1 interface for local use.', 'fg'],
    ['If exposing ttyd, always use credentials and TLS.', 'red'],
    ['Credentials are handled by ttyd/browser Basic Auth.', 'dim'],
  ],
};

function mockTerminal({ folder, pane }: { folder: Folder; pane: PaneNode }): MockRow[] {
  const rand = rng(hash32(pane.id + folder.cwd));
  if (folder.doc && DOCS[folder.doc]) {
    const rows: MockRow[] = [{ kind:'row', spans:[['visitor@ttydterm', 'green'], [':', 'dim'], ['~/'+folder.doc, 'blue'], ['$ cat '+folder.doc+'.txt', 'fg']] }];
    DOCS[folder.doc].forEach((spans) => rows.push({ kind:'row', spans:[spans] }));
    rows.push({ kind:'row', spans:[['visitor@ttydterm', 'green'], [':', 'dim'], ['~/'+folder.doc, 'blue'], ['$ ', 'dim']], cursor:true });
    return rows;
  }
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

const documentationConfig = (directFile=false): Config => {
  const docs: Array<[string, string, string, PatternName]> = [['readme','README','book','dots'],['install','Installation','archive','grid'],['setup','Setup','terminal','diagonal'],['keyboard','Keyboard','keyboard','cross'],['themes','Themes','palette','waves'],['security','Security','shield','bricks']];
  if(directFile) docs.unshift(...docs.splice(docs.findIndex(([id])=>id==='setup'),1));
  return {version:CONFIG_VERSION,ui:{railWidth:208,railOpen:true,fontSize:13,fontWeight:'regular'},folders:docs.map(([doc,name,icon,pattern])=>({id:'doc-'+doc,name,cwd:'~/'+doc,doc,icon:WS_ICONS[icon]?icon:null,pattern,theme:'paper',layout:pane('cat '+doc+'.txt',false)}))};
};

const colorOf = (key: string) => (key === 'fg' ? 'var(--t-fg)' : key === 'dim' ? 'var(--t-dim)' : 'var(--t-' + key + ')');

const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* A terminal shows a skeleton first, then its content. Today that stands in for
   nothing; once this is ttyd it is the honest picture of a socket that has not
   opened yet, so the shape is worth having now. Shell construction lives in
   commands.js so settings values pass through one audited pure-function seam. */
window.__shellCwd=shellCwd;
window.__tmuxLaunchCommand=tmuxLaunchCommand;

const xtermAppearance = (element: HTMLElement) => {
  const css=getComputedStyle(element), value=(name: string)=>css.getPropertyValue(name).trim();
  const background=value('--t-bg'),foreground=value('--t-fg');
  return {
    fontSize:parseFloat(css.getPropertyValue('--term-font-size'))||13,
    fontWeight:parseInt(css.getPropertyValue('--term-font-weight'))||400,
    theme:{
      /* xterm's own opaque default background would cover .term::before and
         hide the selected workspace pattern. Let the outer terminal surface
         own the background while xterm paints only glyphs and selections. */
      background:'rgba(0,0,0,0)',foreground,cursor:value('--t-cursor'),cursorAccent:background,
      /* Solid blue plus forced background-colour ink guarantees AA even when
         the selected glyph originally used an arbitrary ANSI foreground. */
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

function RealTerminal({ folder, pane, runtime, suspended }: {
  folder: Folder;
  pane: PaneNode;
  runtime: Runtime;
  suspended: boolean;
}) {
  const host = useRef<HTMLDivElement | null>(null), client = useRef<TerminalClient | null>(null);
  const [state,setState]=useState<ConnectionState>('connecting');
  const [toast,setToast]=useState<string|null>(null);
  useLayoutEffect(() => {
    const hostEl = host.current;
    if (!hostEl || runtime.mode !== 'ttyd') return;
    const appearance=xtermAppearance(hostEl);
    const term = new globalThis.Terminal({cursorBlink:false,allowTransparency:true,scrollback:pane.persist?0:1000,fontSize:appearance.fontSize,fontWeight:appearance.fontWeight,fontFamily:'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',convertEol:true,theme:appearance.theme});
    const fit = new globalThis.FitAddon.FitAddon(); term.loadAddon(fit);
    if(globalThis.WebLinksAddon) term.loadAddon(new globalThis.WebLinksAddon.WebLinksAddon());
    term.open(hostEl);fit.fit();
    const encoder=new TextEncoder(),decoder=new TextDecoder();
    const socket=new WebSocket(runtime.endpoints.ws,['tty']);socket.binaryType='arraybuffer';let initialized=false;
    const sendInput=(data: string)=>{if(socket.readyState!==1)return;const bytes=encoder.encode(data),payload=new Uint8Array(bytes.length+1);payload[0]=48;payload.set(bytes,1);socket.send(payload)};
    socket.onopen=()=>{socket.send(encoder.encode(JSON.stringify({AuthToken:runtime.token,columns:term.cols,rows:term.rows})));setState('starting')};
    socket.onmessage=(event: MessageEvent<ArrayBuffer>)=>{const bytes=new Uint8Array(event.data),command=String.fromCharCode(bytes[0]),data=bytes.slice(1);if(command==='0'){term.write(data);if(!initialized){initialized=true;const launch=paneLaunchCommand({cwd:folder.cwd,command:pane.command,persist:pane.persist,folderLabel:folderLabel(folder),paneId:pane.id});sendInput(`${launch}\r`);setState('ready')}}else if(command==='1')document.title=decoder.decode(data)+' · ttydterm'};
    socket.onclose=()=>setState('disconnected');socket.onerror=()=>setState('error');
    const input=term.onData(sendInput),resize=term.onResize(({cols,rows})=>socket.readyState===1&&socket.send(encoder.encode('1'+JSON.stringify({columns:cols,rows}))));
    let toastTimer:ReturnType<typeof setTimeout>;
    const showToast=(text:string)=>{setToast(text);clearTimeout(toastTimer);toastTimer=setTimeout(()=>setToast(null),1400)};
    const pasteText=(text:string)=>{if(text)term.paste(text)};
    const readClipboard=async()=>{try{pasteText(await navigator.clipboard.readText())}catch{showToast('Clipboard access blocked')}};
    const nativePaste=(event:ClipboardEvent)=>{const text=event.clipboardData?.getData('text/plain');if(text){event.preventDefault();pasteText(text)}};
    const menuPaste=()=>{void readClipboard()};
    const focusTerminal=()=>term.focus();
    hostEl.addEventListener('paste',nativePaste);hostEl.addEventListener('ttydterm-paste',menuPaste);hostEl.addEventListener('ttydterm-focus',focusTerminal);
    term.attachCustomKeyEventHandler((event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='v'&&event.type==='keydown'){void readClipboard();return false}return true});
    const selection=term.onSelectionChange(async()=>{const text=term.getSelection();if(!text)return;try{await navigator.clipboard.writeText(text);showToast('Copied')}catch{}});
    const ro=new ResizeObserver(()=>{try{fit.fit()}catch{}});ro.observe(hostEl);client.current={term,fit,socket};
    return()=>{clearTimeout(toastTimer);hostEl.removeEventListener('paste',nativePaste);hostEl.removeEventListener('ttydterm-paste',menuPaste);hostEl.removeEventListener('ttydterm-focus',focusTerminal);ro.disconnect();input.dispose();resize.dispose();selection.dispose();socket.close(1000);term.dispose();client.current=null};
  },[folder.cwd,pane.id,pane.command,pane.persist,runtime.mode,runtime.mode==='ttyd'?runtime.token:null]);
  /* xterm paints ANSI colours on its own canvas/DOM layers; CSS variables do
     not reach those glyphs. Re-apply the complete app palette after every
     React render so live global theme/font changes update existing sessions. */
  useLayoutEffect(()=>{
    if(!host.current||!client.current)return;
    const appearance=xtermAppearance(host.current);
    client.current.term.options.theme=appearance.theme;
    client.current.term.options.fontSize=appearance.fontSize;
    client.current.term.options.fontWeight=appearance.fontWeight;
    try{client.current.fit.fit()}catch{}
  });
  useEffect(()=>{if(!suspended)try{client.current?.fit.fit()}catch{}},[suspended]);
  return <div className={'term xterm-term pattern-'+(folder.pattern||'plain')+(pane.persist?' tmux-terminal':'')+' connection-'+state+(suspended?' xterm-suspended':'')} aria-label={'Terminal '+state}><div className="xterm-host" ref={host}/>{state==='ready'?null:<div className="connection-state">{state}</div>}{toast?<div className="copy-toast" role="status">{toast}</div>:null}</div>;
}

function Terminal({ folder, pane, runtime, suspended }: {
  folder: Folder;
  pane: PaneNode;
  runtime: Runtime;
  suspended: boolean;
}) {
  if (!folder.doc && runtime?.mode === 'ttyd') return <RealTerminal folder={folder} pane={pane} runtime={runtime} suspended={suspended}/>;
  const rows = useMemo(() => mockTerminal({ folder, pane }), [folder.cwd, folder.doc, pane.id, pane.command]);
  const [ready, setReady] = useState(() => REDUCED());
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setReady(true), 240);
    return () => clearTimeout(t);
  }, [ready]);

  if (suspended) return (
    <div className={"term resize-placeholder pattern-" + (folder.pattern || "plain")}
         aria-label="Terminal paused while resizing" />
  );

  if (!ready) {
    return (
      <div className="term skeleton" data-ready="0" aria-hidden="true">
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
    <div className={"term pattern-" + (folder.pattern || "plain")} data-ready="1">
      <div className="term-body">
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

/* =====================================================================
   5. ICONS — pictograms only; no text escapes a terminal.
   ===================================================================== */
const S = { fill:'none', stroke:'currentColor', strokeWidth:1.7, strokeLinecap:'round', strokeLinejoin:'round' };
const svg = (name: string, body: React.ReactNode) => () => <svg viewBox="0 0 24 24" data-icon={name} {...S}>{body}</svg>;

const Ico = {
  plus:  svg('plus', <path d="M12 5v14M5 12h14" />),
  /* A real cog: a toothed ring, not the sun-with-rays that was here before. */
  /* A cog drawn as a FILLED silhouette: an 8-tooth ring with the hub punched
     out by evenodd. Two earlier attempts failed for the same reason — anything
     built from lines RADIATING from a circle reads as a sun at 14px, which is
     exactly the "brightness" glyph this replaced. The teeth have to be part of
     the perimeter, not spokes attached to it. */
  gear: () => (
    <svg viewBox="0 0 24 24" data-icon="gear" fill="currentColor" fillRule="evenodd" clipRule="evenodd" stroke="none">
      <path d="M10.28 2.56A9.6 9.6 0 0 1 13.72 2.56L13.54 4.86A7.3 7.3 0 0 1 15.96 5.87L17.46 4.10A9.6 9.6 0 0 1 19.90 6.54L18.13 8.04A7.3 7.3 0 0 1 19.14 10.46L21.44 10.28A9.6 9.6 0 0 1 21.44 13.72L19.14 13.54A7.3 7.3 0 0 1 18.13 15.96L19.90 17.46A9.6 9.6 0 0 1 17.46 19.90L15.96 18.13A7.3 7.3 0 0 1 13.54 19.14L13.72 21.44A9.6 9.6 0 0 1 10.28 21.44L10.46 19.14A7.3 7.3 0 0 1 8.04 18.13L6.54 19.90A9.6 9.6 0 0 1 4.10 17.46L5.87 15.96A7.3 7.3 0 0 1 4.86 13.54L2.56 13.72A9.6 9.6 0 0 1 2.56 10.28L4.86 10.46A7.3 7.3 0 0 1 5.87 8.04L4.10 6.54A9.6 9.6 0 0 1 6.54 4.10L8.04 5.87A7.3 7.3 0 0 1 10.46 4.86ZM12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" />
    </svg>
  ),
  close: svg('close', <path d="M6 6l12 12M18 6L6 18" />),
  menu:  svg('menu', <><circle cx="12" cy="5.6" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="18.4" r="1.5" /></>),
  export: svg('export', <><path d="M12 3.5v11M7.8 7.8 12 3.5l4.2 4.3" /><path d="M5 12.5v6.2a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8v-6.2" /></>),
  panel: svg('panel', <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M9.5 4.5v15" /></>),
  search: svg('search', <><circle cx="11" cy="11" r="6.2" /><path d="m20 20-4.6-4.6" /></>),
  keyboard: svg('keyboard', <><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 9h.01M9 9h.01M12 9h.01M15 9h.01M18 9h.01M7 12h.01M10 12h.01M13 12h.01M16 12h.01M7 15h10"/></>),
  paste:svg('paste',<><path d="M9 5h6v3H9z"/><path d="M8 6H6v14h12V6h-2M9 12h6M9 16h5"/></>),
};

/* 36 workspace icons — enough that a real set of projects each gets a
   distinguishable mark in the collapsed rail. */
const WS_ICONS: Record<string, React.ReactElement> = {
  terminal: <><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="m7 10 2.6 2.2L7 14.4M12.8 15h4" /></>,
  code:     <path d="m9 8-4 4 4 4M15 8l4 4-4 4M13.4 5.5l-2.8 13" />,
  folder:   <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h3.2l1.6 2h8.2A1.5 1.5 0 0 1 20 9.5v8A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" />,
  server:   <><rect x="3.5" y="4.5" width="17" height="6" rx="1.6" /><rect x="3.5" y="13.5" width="17" height="6" rx="1.6" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
  database: <><ellipse cx="12" cy="6.5" rx="7" ry="2.8" /><path d="M5 6.5v11c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8v-11M5 12c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8" /></>,
  cloud:    <path d="M7.2 18.5h9.3a3.6 3.6 0 0 0 .4-7.18A5.1 5.1 0 0 0 7.4 10.2a4.1 4.1 0 0 0-.2 8.3z" />,
  globe:    <><circle cx="12" cy="12" r="8.2" /><path d="M3.8 12h16.4M12 3.8c2.1 2.3 3.2 5.2 3.2 8.2s-1.1 5.9-3.2 8.2c-2.1-2.3-3.2-5.2-3.2-8.2s1.1-5.9 3.2-8.2z" /></>,
  rocket:   <><path d="M12 3.2c2.9 2.2 4.4 5.2 4.4 8.4L12 15.6l-4.4-4c0-3.2 1.5-6.2 4.4-8.4z" /><path d="M7.6 12.6 5 14.4l1 3.2 2.6-1M16.4 12.6 19 14.4l-1 3.2-2.6-1" /><circle cx="12" cy="9.4" r="1.5" /></>,
  bug:      <><path d="M8.5 9.5a3.5 3.5 0 0 1 7 0v4a3.5 3.5 0 0 1-7 0z" /><path d="M9.4 7.2 8 5.4M14.6 7.2 16 5.4M8.5 11H5M19 11h-3.5M8.5 14.5 5.6 16.4M15.5 14.5l2.9 1.9" /></>,
  flask:    <><path d="M9.6 3.5v5.2L5.3 17a2 2 0 0 0 1.8 3h9.8a2 2 0 0 0 1.8-3l-4.3-8.3V3.5" /><path d="M8.6 3.5h6.8M7.4 14.5h9.2" /></>,
  box:      <><path d="M12 3.6 20 8v8l-8 4.4L4 16V8z" /><path d="M4 8l8 4.4L20 8M12 12.4V20.4" /></>,
  layers:   <><path d="m12 3.5 8 4.2-8 4.2-8-4.2z" /><path d="m4 12.2 8 4.2 8-4.2M4 16.4l8 4.2 8-4.2" /></>,
  branch:   <><circle cx="7" cy="6" r="2.2" /><circle cx="7" cy="18" r="2.2" /><circle cx="17" cy="9" r="2.2" /><path d="M7 8.2v7.6M17 11.2c0 3-3.4 3.4-6.2 4.2" /></>,
  cpu:      <><rect x="7" y="7" width="10" height="10" rx="1.6" /><path d="M10 3.6v3.4M14 3.6v3.4M10 17v3.4M14 17v3.4M3.6 10H7M3.6 14H7M17 10h3.4M17 14h3.4" /></>,
  pulse:    <path d="M3 12h4l3-7 4 14 3-7h4" />,
  shield:   <path d="M12 3.4 19 6v6c0 4-3 7.2-7 8.6-4-1.4-7-4.6-7-8.6V6z" />,
  key:      <><circle cx="8" cy="12" r="3.4" /><path d="M11.4 12H21M18 12v3M15 12v2.4" /></>,
  lock:     <><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.4 10.5V8a3.6 3.6 0 0 1 7.2 0v2.5" /></>,
  bell:     <><path d="M17.6 16.5H6.4c1.1-1.2 1.6-2.4 1.6-4v-2a4 4 0 0 1 8 0v2c0 1.6.5 2.8 1.6 4z" /><path d="M10.4 19.4a1.9 1.9 0 0 0 3.2 0" /></>,
  book:     <><path d="M5 5.4A1.4 1.4 0 0 1 6.4 4H19v13.6H6.4A1.4 1.4 0 0 0 5 19z" /><path d="M5 19a1.4 1.4 0 0 0 1.4 1.4H19v-2.8" /></>,
  file:     <><path d="M7 3.6h6.4L18 8.2v12.2H7z" /><path d="M13.2 3.6v4.8H18M9.6 13h6M9.6 16.4h6" /></>,
  pen:      <><path d="m4 20.2 1.1-4.3L15.8 5.2a2 2 0 0 1 2.9 2.9L8 18.9z" /><path d="m14.4 6.6 3 3" /></>,
  palette:  <><path d="M12 3.6a8.4 8.4 0 0 0 0 16.8c1.2 0 1.9-.8 1.9-1.7 0-.5-.2-.9-.5-1.2a1.7 1.7 0 0 1 1.2-2.9h1.6a4.2 4.2 0 0 0 4.2-4.2c0-4-3.8-6.8-8.4-6.8z" /><circle cx="8.2" cy="10.4" r="1.1" /><circle cx="12" cy="7.8" r="1.1" /><circle cx="15.8" cy="10" r="1.1" /></>,
  camera:   <><path d="M4 8.6h3.4L9 6.2h6l1.6 2.4H20v10.2H4z" /><circle cx="12" cy="13.4" r="3.2" /></>,
  music:    <><path d="M9 18V6.2l10-2V16" /><circle cx="7" cy="18" r="2.2" /><circle cx="17" cy="16" r="2.2" /></>,
  video:    <><rect x="3.5" y="6" width="12" height="12" rx="2" /><path d="m15.5 11 5-3v8l-5-3z" /></>,
  mail:     <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 8 8 5.4L20 8" /></>,
  chat:     <path d="M4.5 6.6A1.6 1.6 0 0 1 6.1 5h11.8a1.6 1.6 0 0 1 1.6 1.6v7.8a1.6 1.6 0 0 1-1.6 1.6H9.2L4.5 19.6z" />,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /></>,
  clock:    <><circle cx="12" cy="12" r="8.2" /><path d="M12 7.4V12l3 2" /></>,
  star:     <path d="m12 3.8 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 10l5.9-.8z" />,
  heart:    <path d="M12 20.2S3.8 15.4 3.8 9.7A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 8.2 2.1c0 5.7-8.2 10.5-8.2 10.5z" />,
  flag:     <><path d="M6 20.4V4.6h11.4l-2 3.6 2 3.6H6" /><path d="M6 4.6v15.8" /></>,
  bolt:     <path d="M13.2 3 5.6 13.6H12l-1.2 7.4 7.6-10.6H12z" />,
  flame:    <path d="M12 3.4c3.4 3.2 5.4 6 5.4 9a5.4 5.4 0 0 1-10.8 0c0-1.6.8-3 2.2-4 .2 1.4.9 2.2 1.8 2.4-.4-2.6.1-5 1.4-7.4z" />,
  leaf:     <><path d="M20.2 3.8C10 3.8 4 8.9 4 15.4c0 2.6 1.6 4.8 4.2 4.8 6.6 0 12-6.2 12-16.4z" /><path d="M4.6 20 14 10.4" /></>,
  moon:     <path d="M20 14.6A8.6 8.6 0 1 1 10.4 4 6.9 6.9 0 0 0 20 14.6z" />,
  compass:  <><circle cx="12" cy="12" r="8.2" /><path d="m15.2 8.8-1.9 4.5-4.5 1.9 1.9-4.5z" /></>,
  pin:      <><path d="M12 20.8s6.4-6.1 6.4-10.4a6.4 6.4 0 1 0-12.8 0C5.6 14.7 12 20.8 12 20.8z" /><circle cx="12" cy="10.2" r="2.4" /></>,
  home:     <><path d="m4 11 8-6.6 8 6.6v8.4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M9.6 20.4v-6h4.8v6" /></>,
  wrench:   <path d="M20.2 6.4 17 9.6l-2.6-2.6 3.2-3.2a5.4 5.4 0 0 0-7 6.8L4.4 17.8a2 2 0 0 0 2.8 2.8l7.2-6.2a5.4 5.4 0 0 0 5.8-8z" />,
  gauge:    <><path d="M4.4 16.6a8.6 8.6 0 1 1 15.2 0" /><path d="m12 12.6 4-3.4" /><circle cx="12" cy="13.4" r="1.3" /></>,
  chart:    <><path d="M4 20h16" /><path d="M7 20v-6M12 20V6.5M17 20v-9" /></>,
  users:    <><circle cx="9" cy="8.4" r="3.1" /><path d="M3.6 19.4a5.4 5.4 0 0 1 10.8 0" /><path d="M16 5.6a3.1 3.1 0 0 1 0 5.9M17 14.6a5.4 5.4 0 0 1 3.4 4.8" /></>,
};
const WS_ICON_KEYS = Object.keys(WS_ICONS);
const WsIcon = ({ name }: { name: string }) => (
  <svg viewBox="0 0 24 24" data-icon={name} {...S}>{WS_ICONS[name]}</svg>
);

/* count pictograms: a box divided into n slices along `axis` */
function CountGlyph({ axis, n }: { axis: SplitAxis; n: number }) {
  const lines: React.ReactElement[] = [];
  for (let i = 1; i < n; i++) {
    const p = 3.5 + (17 * i) / n;
    lines.push(axis === 'columns'
      ? <path key={i} d={'M' + p + ' 4.5v15'} />
      : <path key={i} d={'M3.5 ' + (4.5 + (15 * i) / n) + 'h17'} />);
  }
  return <svg viewBox="0 0 24 24" data-icon={'split-' + axis + '-' + n} {...S}><rect x="3.5" y="4.5" width="17" height="15" rx="2" />{lines}</svg>;
}

/* =====================================================================
   6. HASH ROUTES
      #/f/:folderId · /settings · /pane/:paneId · #/new · #/backup · #/palette
   ===================================================================== */
const parseHash = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
const go = (...parts: string[]) => {
  const next = '#/' + parts.map(encodeURIComponent).join('/');
  // Assigning an IDENTICAL hash fires no `hashchange`, so a listener-driven
  // router would never re-read the URL and the view would freeze (this is how
  // "Close" on a dialog became a no-op once anything else had already put that
  // exact hash in the bar). Re-announce it instead of assigning.
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

/* =====================================================================
   7. tmux probe — STUB. Later this rides ttyd's websocket (open /ws with
   `arg=has-tmux`, read the reply). For now it resolves optimistically so the
   persistence toggle can already show what it will show.
   ===================================================================== */
function useTmux(): TmuxState {
  const [tmux, setTmux] = useState<TmuxState>({ state: 'probing' });
  useEffect(() => {
    const t = setTimeout(() => setTmux({ state: 'present', version: '3.4' }), 400);
    return () => clearTimeout(t);
  }, []);
  return tmux;
}

/* =====================================================================
   8. PANES + SPLIT TREE
   ===================================================================== */
/* Where a pane's popup was opened from: the trigger button (anchored under it)
   or a right-click (anchored at the pointer). */
type PaneMenu = { source: 'trigger' | 'context'; x: number; y: number };
interface FocusRequest { id: string; n?: number; nonce?: number }

function Pane({ node, folder, runtime, focused, closing, focusReq, resizing,
               onFocus, onSplit, onClose, canClose, onOpenSettings }: {
  node: PaneNode;
  folder: Folder;
  runtime: Runtime;
  focused: boolean;
  closing: boolean;
  focusReq: FocusRequest | null;
  resizing: boolean;
  onFocus: () => void;
  onSplit: (paneId: string, axis: SplitAxis, count: number) => void;
  onClose: (paneId: string) => void;
  canClose: boolean;
  onOpenSettings: (paneId: string) => void;
}) {
  const [menu, setMenu] = useState<PaneMenu | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const accent = themeOf(folder.theme);

  useEffect(() => {
    if (!menu) return;
    const off = () => setMenu(null);
    addEventListener('pointerdown', off);
    return () => removeEventListener('pointerdown', off);
  }, [menu]);

  /* The command palette hands focus to a specific terminal. Deferred a tick so
     it lands after the dialog has actually closed. */
  useEffect(() => {
    if (!focusReq || focusReq.id !== node.id) return;
    const t = setTimeout(() => {
      ref.current?.focus({ preventScroll: true });
      ref.current?.querySelector('.xterm-host')?.dispatchEvent(new Event('ttydterm-focus'));
      ref.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, 0);
    return () => clearTimeout(t);
  }, [focusReq, node.id]);

  const split = (axis: SplitAxis, n: number) => { setMenu(null); onSplit(node.id, axis, n); };

  return (
    <div
      ref={ref}
      className={'pane' + (focused ? ' focused' : '') + (closing ? ' closing' : '')}
      style={{ ...themeVars(accent), '--t-ring': accent.blue }}
      tabIndex={-1}
      onPointerDownCapture={onFocus}
      onFocus={onFocus}
      /* The workspace owns right-click even in tmux panes. commands.js removes
         tmux's MouseDown3Pane binding so the same gesture cannot open two menus. */
      onContextMenu={(e) => {
        e.preventDefault(); onFocus();
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        setMenu({ source:'context', x:e.clientX-r.left, y:e.clientY-r.top });
      }}
    >
      <Terminal folder={folder} pane={node} runtime={runtime} suspended={resizing} />

      {/* The border, as an overlay ABOVE the terminal: an inset shadow on the
          pane would be painted under .term's background, and an outer one is
          clipped by the slot/canvas/viewport chain. Same 2px in both states. */}
      <div className="pane-edge" aria-hidden="true" />

      {/* ONE resting control. Everything else lives in its popup. */}
      <div className={'pane-hotspot' + (menu ? ' open' : '')} aria-hidden="true" />
      <div className={'rail-pane' + (menu ? ' open' : '')} onPointerDown={(e) => e.stopPropagation()}>
        <button className={'pico' + (node.persist ? ' persist' : '')}
                title="Pane menu" aria-label="Pane menu"
                aria-expanded={!!menu} aria-haspopup="menu"
                onClick={(e) => { const x=e.currentTarget.offsetLeft,y=e.currentTarget.offsetTop+28;setMenu((v)=>v?null:{source:'trigger',x,y}); }}><Ico.menu /></button>
      </div>


      {menu ? (
        <div className="panepop" role="menu" tabIndex={-1}
             style={menu.source === "context" ? { left:`clamp(7px, ${menu.x}px, calc(100% - 100px))`, top:`clamp(7px, ${menu.y}px, calc(100% - 100px))`, right:"auto" } : undefined}
             onPointerDown={(e) => e.stopPropagation()}
             onKeyDown={(e) => {
               const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
               const i = items.indexOf(document.activeElement as HTMLButtonElement);
               if(e.key==="ArrowDown"||e.key==="ArrowRight"){e.preventDefault();items[(i+1+items.length)%items.length]?.focus()}
               else if(e.key==="ArrowUp"||e.key==="ArrowLeft"){e.preventDefault();items[(i-1+items.length)%items.length]?.focus()}
               else if(e.key==="Escape"){e.preventDefault();setMenu(null);ref.current?.focus()}
             }}
             ref={(el: HTMLDivElement | null) => { if(el && menu.source === "context") requestAnimationFrame(()=>el.querySelector("button")?.focus()); }}>
          <button className="pico" role="menuitem" title="Pane settings" aria-label="Pane settings"
                  onClick={() => { setMenu(null); onOpenSettings(node.id); }}><Ico.gear /></button>
          <button className="pico" role="menuitem" title="Paste" aria-label="Paste"
                  onClick={()=>{setMenu(null);ref.current?.querySelector('.xterm-host')?.dispatchEvent(new Event('ttydterm-paste'))}}><Ico.paste /></button>
          <button className="pico danger row-end" role="menuitem" disabled={!canClose}
                  title={canClose?'Close pane':'The only pane cannot be closed'} aria-label={canClose?'Close pane':'Close pane unavailable: this is the only pane'}
                  onClick={() => { if(canClose){setMenu(null);onClose(node.id)} }}><Ico.close /></button>
          {[2, 3, 4].map((n) => (
            <button key={'c' + n} className="pico axis-top" role="menuitem"
                    title={'Split into ' + n + ' columns'} aria-label={'Split into ' + n + ' columns'}
                    onClick={() => split('columns', n)}><CountGlyph axis="columns" n={n} /></button>
          ))}
          {[2, 3, 4].map((n) => (
            <button key={'r' + n} className="pico" role="menuitem"
                    title={'Split into ' + n + ' rows'} aria-label={'Split into ' + n + ' rows'}
                    onClick={() => split('rows', n)}><CountGlyph axis="rows" n={n} /></button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface NodeProps {
  node: LayoutNode;
  folder: Folder;
  runtime: Runtime;
  focusId: string | null;
  closingId: string | null;
  focusReq: FocusRequest | null;
  resizing: boolean;
  onResizeStart: () => void;
  onResizeEnd: () => void;
  onFocus: (paneId: string) => void;
  onSplit: (paneId: string, axis: SplitAxis, count: number) => void;
  onClose: (paneId: string) => void;
  canClose: boolean;
  onResize: (path: number[], sizes: number[]) => void;
  onOpenSettings: (paneId: string) => void;
  path: number[];
}

function Node({ node, folder, runtime, focusId, closingId, focusReq, resizing, onResizeStart, onResizeEnd,
               onFocus, onSplit, onClose, canClose, onResize, onOpenSettings, path }: NodeProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  if (node.type === 'pane') {
    const leaf = node;
    return (
      <Pane node={leaf} folder={folder} runtime={runtime} focused={focusId === leaf.id} closing={closingId === leaf.id}
            focusReq={focusReq} resizing={resizing}
            onFocus={() => onFocus(leaf.id)} onSplit={onSplit} onClose={onClose} canClose={canClose}
            onOpenSettings={onOpenSettings} />
    );
  }

  const kidMins = node.children.map(nodeMin);
  const gaps = (node.children.length - 1) * GAP;

  /* The one clamp both input methods share, so a keyboard nudge can never
     reach a size a drag would have refused (and vice versa). */
  const clampDelta = (i: number, delta: number, avail: number) => {
    const a0 = node.sizes[i], b0 = node.sizes[i + 1];
    const minA = (node.axis === 'columns' ? kidMins[i].w : kidMins[i].h) / avail;
    const minB = (node.axis === 'columns' ? kidMins[i + 1].w : kidMins[i + 1].h) / avail;
    // Normal case: neither neighbour may cross its pixel minimum, so panes
    // stop dead at MIN_W/MIN_H the way they do in a real multiplexer.
    let lo = minA - a0, hi = b0 - minB;
    // Degenerate case: this subtree is the one FORCING the canvas width, so
    // both neighbours already sit exactly on their minimum and the range above
    // is empty — the divider would be frozen. Fall back to a share floor: the
    // drag then widens the canvas (and the area scrolls further) instead of
    // silently doing nothing.
    if (hi - lo < 0.01) { lo = FLOOR - a0; hi = b0 - FLOOR; }
    const d = Math.max(Math.min(delta, hi), lo);
    const next = node.sizes.slice();
    next[i] = a0 + d; next[i + 1] = b0 - d;
    return next;
  };

  const availOf = () => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return 0;
    return (node.axis === 'columns' ? box.width : box.height) - gaps;
  };

  const startDrag = (i: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const avail = availOf();
    if (avail <= 0) return;
    const startPos = node.axis === 'columns' ? e.clientX : e.clientY;
    const target = e.currentTarget;
    target.focus();
    target.classList.add('dragging');
    target.setPointerCapture(e.pointerId);
    onResizeStart();

    const move = (ev: PointerEvent) => {
      const delta = ((node.axis === 'columns' ? ev.clientX : ev.clientY) - startPos) / avail;
      onResize(path, clampDelta(i, delta, avail));
    };
    const up = () => {
      target.classList.remove('dragging');
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      onResizeEnd();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };

  /* A divider is a real control, so it is reachable and operable without a
     pointer: arrows nudge (Shift = coarse), Home/End slam it to the limit the
     same clamp would allow. */
  const onDividerKey = (i: number) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    const horizontal = node.axis === 'columns';
    const dec = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const inc = horizontal ? 'ArrowRight' : 'ArrowDown';
    if (![dec, inc, 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const avail = availOf();
    if (avail <= 0) return;
    const step = (e.shiftKey ? 64 : 24) / avail;
    const delta = e.key === dec ? -step : e.key === inc ? step
                : e.key === 'Home' ? -1 : 1;   // clamp turns ±1 into the legal limit
    onResize(path, clampDelta(i, delta, avail));
  };

  return (
    <div className={'split ' + node.axis} ref={ref}>
      {node.children.map((child, i) => (
        <React.Fragment key={child.type === 'pane' ? child.id : 's' + i}>
          {i > 0 ? (
            <div className="divider" onPointerDown={startDrag(i - 1)} onKeyDown={onDividerKey(i - 1)}
                 role="separator" tabIndex={0}
                 aria-orientation={node.axis === 'columns' ? 'vertical' : 'horizontal'}
                 aria-label={'Resize ' + (node.axis === 'columns' ? 'columns ' : 'rows ') + i + ' and ' + (i + 1)}
                 aria-valuemin={0} aria-valuemax={100}
                 aria-valuenow={Math.round(node.sizes.slice(0, i).reduce((a, b) => a + b, 0) * 100)} />
          ) : null}
          <div className="slot" style={{ flexBasis: 'calc((100% - ' + gaps + 'px) * ' + node.sizes[i] + ')' }}>
            <Node node={child} folder={folder} runtime={runtime} focusId={focusId} closingId={closingId} focusReq={focusReq}
                  resizing={resizing} onResizeStart={onResizeStart} onResizeEnd={onResizeEnd}
                  onFocus={onFocus} onSplit={onSplit} onClose={onClose} canClose={canClose}
                  onResize={onResize} onOpenSettings={onOpenSettings} path={path.concat(i)} />
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

/* One folder's surface. All folders stay MOUNTED (inactive ones hidden) so
   terminals are never torn down on tab switch — the behaviour we need once
   these are live ttyd sockets. */
function Surface({ folder, runtime, active, focusId, closingId, focusReq, appResizing,
                   onFocus, onSplit, onClose, onResize, onAddFirst, onOpenSettings }: {
  folder: Folder;
  runtime: Runtime;
  active: boolean;
  focusId: string | null;
  closingId: string | null;
  focusReq: FocusRequest | null;
  appResizing: boolean;
  onFocus: (paneId: string) => void;
  onSplit: (paneId: string, axis: SplitAxis, count: number) => void;
  onClose: (paneId: string) => void;
  onResize: (path: number[], sizes: number[]) => void;
  onAddFirst: () => void;
  onOpenSettings: (paneId: string) => void;
}) {
  const viewport = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [resizing, setResizing] = useState(false);

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    // contentRect is already inside the viewport's padding, so the canvas can
    // fill it exactly without the padding pushing a scrollbar into existence.
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const min = useMemo(() => nodeMin(folder.layout), [folder.layout]);
  const canClose = countPanes(folder.layout) > 1;

  return (
    <div className="surface" hidden={!active}>
      <div className="viewport" ref={viewport}>
        {folder.layout ? (
          <div className="canvas" style={{
            width: Math.max(box.w, Math.ceil(min.w)),
            height: Math.max(box.h, Math.ceil(min.h)),
          }}>
            <Node node={folder.layout} folder={folder} runtime={runtime} focusId={focusId} closingId={closingId} focusReq={focusReq}
                  resizing={resizing || appResizing}
                  onResizeStart={() => setResizing(true)} onResizeEnd={() => setResizing(false)}
                  onFocus={onFocus} onSplit={onSplit} onClose={onClose} canClose={canClose}
                  onResize={onResize} onOpenSettings={onOpenSettings} path={[]} />
          </div>
        ) : (
          <div className="empty-add">
            <button className="ico" title="Add a terminal" aria-label="Add a terminal" onClick={onAddFirst}><Ico.plus /></button>
          </div>
        )}
      </div>
    </div>
  );
}

/* =====================================================================
   9. DIALOG VIEWS

   Every one of these is now only CONTENT. The dialog element, the surface,
   the header, the close button, the body and the footer geometry all live in
   modal.tsx; a view below picks fields and actions and nothing else.
   ===================================================================== */

/* A swatch is a MINIATURE TERMINAL: the theme's own background with a few lines
   of its own accents on it. Ragged widths so it reads as output, not as a
   colour chart. */
const SWATCH_LINES: Array<[keyof Theme & ('fg'|'blue'|'green'|'dim'), string]> =
  [['fg', '78%'], ['blue', '58%'], ['green', '88%'], ['dim', '44%']];
const ThemeSwatch = ({ t }: { t: Theme }) =>
  <>{SWATCH_LINES.map(([c, w]) => <i key={c} style={{ background: t[c], width: w }} />)}</>;

/* Themes as swatches, applied ON PICK — no Save, no dropdown. The value is
   whatever is currently stored, so the control is a view of the live config and
   the surface behind it has already repainted by the time the click lands.

   `variant="term"` paints the picker in the pane's own palette (it lives inside
   the terminal); the default paints it in the system palette (it lives in a
   dialog). Either way the accent is passed in, never inherited from whichever
   theme happens to be active. */
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

  /* One tab stop, arrows inside — the keyboard contract a <select> had. */
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
    // keep focus on the option that is now checked
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

/* Folder settings. NOT a form to be submitted: every control writes straight
   through, so the rail relabels and the terminals repaint under the dialog as
   you type and click. `isNew` is the one exception — a folder that does not
   exist yet has nothing to write through to, so that path keeps Create/Cancel
   and edits a local draft. */
function FolderDialog({ folder, isNew, onChange, onCreate, onDelete, onClose, canDelete }: {
  folder: Folder;
  isNew?: boolean;
  onChange?: (patch: Partial<Folder>) => void;
  onCreate?: (folder: Folder) => void;
  onDelete?: () => void;
  onClose: () => void;
  canDelete?: boolean;
}) {
  const [draft, setDraft] = useState<Folder>(folder);
  useEffect(() => setDraft(folder), [folder]);
  // live mode writes through; draft mode (new folder) accumulates locally
  const put = (patch: Partial<Folder>) => { setDraft((d) => ({ ...d, ...patch })); if (!isNew) onChange?.(patch); };
  const nameId = useId(), cwdId = useId();
  const label = draft.name.trim() || draft.cwd.split('/').filter((s) => s && s !== '~').pop() || 'workspace';

  return (
    <ModalForm
      variant="folder-dialog"
      title={isNew ? 'New folder' : 'Folder'}
      onClose={onClose}
      closeLabel={isNew ? 'Close new folder' : 'Close folder settings'}
      actions={
        <ModalActions
          destructive={!isNew && canDelete ? <Button kind="danger" onClick={onDelete}>Delete folder</Button> : null}
          secondary={isNew ? <Button onClick={onClose}>Cancel</Button> : null}
          primary={isNew
            ? <Button kind="primary" onClick={() => onCreate?.({ ...draft, name: draft.name.trim(), cwd: draft.cwd.trim() || '~' })}>Create</Button>
            /* No Save: everything above already took effect. Close just closes. */
            : <Button kind="primary" onClick={onClose}>Done</Button>}
        />
      }
    >
      <Field label="Working directory" htmlFor={cwdId}>
        <input id={cwdId} type="text" className="mono" value={draft.cwd}
               onChange={(e) => put({ cwd: e.target.value })} spellCheck="false" autoFocus
               onBlur={() => put({ cwd: draft.cwd.trim() || '~' })} placeholder="~/work/project" />
      </Field>
      <Field label="Name — optional; falls back to the last segment of the working directory" htmlFor={nameId}>
        <input id={nameId} type="text" value={draft.name}
               onChange={(e) => put({ name: e.target.value })}
               onBlur={() => put({ name: draft.name.trim() })}
               placeholder={draft.cwd.split('/').filter((s) => s && s !== '~').pop() || 'workspace'} />
      </Field>
      <FieldGroup label={'Icon — shown when the sidebar is collapsed; without one it falls back to “' + initials(label) + '”'}>
        {(labelledBy) => (
          <div className="iconpick" role="group" aria-labelledby={labelledBy}>
            <button type="button" className={draft.icon ? '' : 'on'} title="No icon — use initials"
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

/* Pane settings. Two controls — command and tmux — on the standard modal
   surface, so it is the same object as folder and global settings rather than
   a second settings idiom that happened to live somewhere else.

   Every control writes through on change. There is no Save and no Cancel: the
   command re-runs as you type, the marker flips as you tick. Closing is only
   closing. */
function PaneSettings({ node, folder, tmux, onChange, onClose }: {
  node: PaneNode;
  folder: Folder;
  tmux: TmuxState;
  onChange: (patch: Partial<PaneNode>) => void;
  onClose: () => void;
}) {
  const cmdRef = useRef<HTMLInputElement | null>(null);
  const cmdId = useId();

  /* Focus the command box WITHOUT scrolling. `autoFocus` let the browser scroll
     the input into view, and when the canvas is wider than the viewport that
     dragged every terminal on screen sideways — the whole workspace lurched
     because a panel opened. */
  useEffect(() => {
    const id = setTimeout(() => cmdRef.current?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <ModalForm variant="panesettings" title="Pane" onClose={onClose} closeLabel="Close pane settings"
               actions={<ModalActions primary={<Button kind="primary" onClick={onClose}>Done</Button>} />}>
      <Field label="Command" htmlFor={cmdId} hint={'Runs in ' + folder.cwd}>
        <input id={cmdId} className="mono ps-input" type="text" value={node.command} spellCheck="false" ref={cmdRef}
               placeholder="bash"
               onChange={(e) => onChange({ command: e.target.value })}
               onBlur={(e) => onChange({ command: e.target.value.trim() || 'bash' })} />
      </Field>
      <CheckboxField
        label="Run in tmux"
        checked={node.persist}
        disabled={tmux.state === 'absent'}
        onChange={(persist) => onChange({ persist })}
        hintTone={tmux.state === 'absent' ? 'warn' : 'default'}
        hint={tmux.state === 'present' ? 'Survives closing the tab.'
          : tmux.state === 'probing' ? 'Checking for tmux…'
          : 'tmux not found — this pane dies with the tab.'}
      />
    </ModalForm>
  );
}

function launchCommand(settings: { port?: number; user?: string; password?: string } = {}) {
  const port=settings.port||7681,user=settings.user||'user',credential=settings.password?` -c ${shellQuote(user+':'+settings.password)}`:'';
  return `ttyd -i 127.0.0.1 -p ${port} -W -a -O${credential} -I "$HOME/ttydterm.html" -t cursorBlink=false bash -l`;
}
function SetupNotice({mode,onRetry}: {mode: Runtime['mode']; onRetry: () => void}) {
  const [copied,setCopied]=useState(false), command=launchCommand();
  return <div className="setup-notice" role="status"><strong>{mode==='file'?'Opened directly':'Demo mode'}</strong><span>{mode==='file'?'Browsers cannot start a shell. Launch this file with ttyd.':'This interactive guide is not connected to ttyd.'}</span><code>{command}</code><button onClick={()=>navigator.clipboard?.writeText(command).then(()=>setCopied(true))}>{copied?'Copied':'Copy launch command'}</button><button onClick={onRetry}>Retry ttyd</button></div>;
}

function FirstRunDialog({ capabilities, onProbe, onCreate }: {
  capabilities: Capabilities;
  onProbe: () => void;
  onCreate: (cwd: string, name: string, persist: boolean) => void;
}) {
  const [cwd,setCwd]=useState('~'),[name,setName]=useState('home'),[persist,setPersist]=useState(false);
  const cwdId = useId(), nameId = useId();
  useEffect(()=>{if(capabilities.state==='ready'){setCwd(capabilities.cwd||capabilities.home||'~');setName((capabilities.cwd||'home').split('/').filter(Boolean).pop()||'home');setPersist(!!capabilities.tmux)}},[capabilities.state]);
  return (
    /* No close button: there is nothing behind this to go back to. */
    <ModalForm variant="first-run" title="Welcome to ttydterm"
               description="ttyd is connected. Check the shell, then create your first real workspace."
               actions={
                 <ModalActions
                   destructive={<Button disabled={capabilities.state === 'probing'} onClick={onProbe}>
                     {capabilities.state === 'probing' ? 'Checking…' : 'Check environment'}
                   </Button>}
                   primary={<Button kind="primary" onClick={() => onCreate(cwd || '~', name.trim(), persist)}>Create workspace</Button>}
                 />
               }>
      <Field label="Working directory" htmlFor={cwdId}>
        <input id={cwdId} className="mono" value={cwd} onChange={(e) => setCwd(e.target.value)} />
      </Field>
      <Field label="Optional name" htmlFor={nameId}>
        <input id={nameId} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <CheckboxField
        label={'Keep panes alive with tmux ' + (capabilities.state === 'unknown' ? '(check environment first)' : capabilities.tmux ? '(installed)' : '(not found)')}
        checked={persist} disabled={!capabilities.tmux} onChange={setPersist}
        hint={capabilities.error} hintTone={capabilities.error ? 'warn' : 'default'}
      />
    </ModalForm>
  );
}

function GlobalSettings({ theme, fontSize, fontWeight, onTheme, onFontSize, onFontWeight, onClose }: {
  theme: string;
  fontSize: number;
  fontWeight: FontWeight;
  onTheme: (theme: string) => void;
  onFontSize: (size: number) => void;
  onFontWeight: (weight:FontWeight) => void;
  onClose: () => void;
}) {
  return (
    <ModalForm variant="global-settings" title="Global settings" onClose={onClose} closeLabel="Close global settings"
               actions={<ModalActions primary={<Button kind="primary" onClick={onClose}>Done</Button>} />}>
      <ThemeChoice label="Theme" value={theme} onChange={(t) => onTheme(t || 'night')} />
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
    catch { setMsg({ ok: false, text: 'Clipboard blocked — select the text and copy manually.' }); }
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
      <Field label="The entire workspace — folders, panes, splits, sizes, themes, sidebar width"
             htmlFor={taId}
             hintTone={msg && !msg.ok ? 'error' : 'default'}
             hint={msg ? msg.text : 'Paste a saved copy over this and press Restore.'}>
        <textarea id={taId} value={text} spellCheck="false"
                  onChange={(e) => { setText(e.target.value); setMsg(null); }} />
      </Field>
    </ModalForm>
  );
}

/* ---------------------------------------------------------------------
   Command palette. An overlay, so it is the one place besides a terminal
   where words are allowed — and the only way to reach a specific pane
   without hunting for it.
   --------------------------------------------------------------------- */
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
      // No query: the active workspace first, so ⌘K→Enter is a cheap "focus here".
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
                {r.kind === 'pane' && r.pane?.persist ? <span className="pal-dot" title="stays alive in the background" /> : null}
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

/* =====================================================================
   10. APP
   ===================================================================== */
const folderLabel = (f: Folder) => f.name || f.cwd.split('/').filter((s: string) => s && s !== '~').pop() || 'workspace';

function ShortcutsDialog({onClose}:{onClose:()=>void}) {
  const groups=[['Workspaces',[['Alt + 1…9','Switch workspace and restore its last terminal'],['Ctrl/⌘ + Shift + ,','Workspace settings']]],['Panes',[['Alt + Arrow keys','Move between terminals'],['Arrow keys','Navigate an open pane menu'],['Enter','Activate the selected item']]],['Application',[['Ctrl/⌘ + K or P','Find a workspace or terminal'],['Ctrl/⌘ + B','Toggle sidebar'],['Ctrl/⌘ + ,','Global settings'],['Escape','Close a menu or dialog']]]] as const;
  return <ModalForm variant="shortcuts-dialog" title="Keyboard shortcuts" onClose={onClose}>{groups.map(([title,items])=><section key={title} className="shortcut-group"><h3>{title}</h3>{items.map(([keys,label])=><div key={keys} className="shortcut-row"><kbd>{keys}</kbd><span>{label}</span></div>)}</section>)}</ModalForm>;
}

function App() {
  const testMock = new URLSearchParams(location.search).has('mock');
  const [configured, setConfigured] = useState(() => testMock || hasSavedConfig());
  const [config, setConfig] = useState<Config>(() => testMock ? loadConfig() : (hasSavedConfig() ? loadConfig() : documentationConfig(location.protocol==='file:')));
  const [runtime, setRuntime] = useState<Runtime>(() => location.protocol==='file:' ? {mode:'file',reason:'Opened directly'} : {mode:'probing'});
  const [capabilities, setCapabilities] = useState<Capabilities>({state:'unknown',tmux:false,home:'~',cwd:'~'});
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusReq, setFocusReq] = useState<FocusRequest | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null);
  const [appResizing, setAppResizing] = useState(false);
  const [lastPaneByFolder,setLastPaneByFolder]=useState<Record<string,string>>({});
  const paletteInputRef=useRef<HTMLInputElement|null>(null);
  const route = useRoute();
  const tmux = useTmux();

  const ui = config.ui;
  const railOpen = ui.railOpen;
  const setUi = useCallback((patch: Partial<UiState>) => setConfig((c) => ({ ...c, ui: { ...c.ui, ...patch } })), []);
  const setRailOpen = useCallback((v: boolean | ((previous:boolean)=>boolean)) => setUi({ railOpen: typeof v === 'function' ? v(railOpen) : v }), [railOpen, setUi]);

  useEffect(() => { detectRuntime().then(setRuntime); }, []);
  useEffect(() => { if(configured) localStorage.setItem(STORE_KEY, JSON.stringify(config)); }, [config, configured]);

  const folders = config.folders;
  const routedId = route[0] === 'f' ? route[1] : null;

  /* `#/backup`, `#/new` and `#/palette` carry no folder id, but a workspace is
     still on screen behind them. Remember the last folder actually routed to,
     so those routes render over WHERE THE USER WAS instead of snapping back to
     folders[0] — and so closing the dialog returns them there. */
  const [stickyId, setStickyId] = useState(routedId);
  const active = folders.find((f) => f.id === routedId)
              || folders.find((f) => f.id === stickyId)
              || folders[0];
  useEffect(() => { if (active) setStickyId(active.id); }, [active?.id]);

  /* Chrome follows the active workspace's theme, and the chosen background is
     remembered so the NEXT boot paints it before React runs. */
  if(!active) throw new Error('Configuration has no folders');
  const activeTheme = THEMES[active.theme] || THEMES.paper;
  useEffect(() => { document.documentElement.style.colorScheme = activeTheme.appearance; }, [activeTheme.appearance]);
  useEffect(() => {
    try { localStorage.setItem(BG_KEY, String(chromeVars(activeTheme)['--stage-bg'])); } catch {}
  }, [activeTheme]);

  /* URL is the source of truth for navigation; keep it honest on load. This
     must ONLY normalise folder routes: rewriting the hash under `#/backup`,
     `#/new` or `#/palette` stomped those routes to `#/f/<id>`, which both stole
     the user's place AND wedged the dialog shut — "Close" then wrote the hash
     that was already in the bar, firing no `hashchange`, so nothing re-rendered. */
  const ownsUrl = route[0] === 'backup' || route[0] === 'new' || route[0] === 'palette' || route[0] === 'settings' || route[0] === 'shortcuts';
  useEffect(() => {
    if (ownsUrl) return;
    if (active && routedId !== active.id) history.replaceState(null, '', '#/f/' + encodeURIComponent(active.id));
  }, [active, routedId, ownsUrl]);

  const focusFolderPane=useCallback((folder:Folder)=>{
    const panes=listPanes(folder.layout);const id=lastPaneByFolder[folder.id]&&panes.some(p=>p.id===lastPaneByFolder[folder.id])?lastPaneByFolder[folder.id]:panes[0]?.id;
    go('f',folder.id);if(id){setFocusId(id);setFocusReq({id,n:Date.now()})}
  },[lastPaneByFolder]);

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
    /* Capture before xterm/tmux can encode Alt+Arrow as terminal input. Only
       recognized application shortcuts are stopped; paste stays native. */
    addEventListener('keydown',onKey,{capture:true});
    return()=>removeEventListener('keydown',onKey,{capture:true});
  }, [setRailOpen,folders,active,focusId,focusFolderPane]);

  /* On a narrow screen a full rail leaves too little for a terminal that has
     its own 260px minimum, so the rail collapses to its icon column there. This
     fires only when the breakpoint is CROSSED, so a manual toggle survives
     until the window genuinely changes class. */
  useEffect(() => {
    const mq = matchMedia('(max-width: 720px)');
    const apply = (e: MediaQueryList | MediaQueryListEvent) => setUi({ railOpen: !e.matches });
    apply(mq);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [setUi]);

  const patchFolder = useCallback((id: string, fn: (folder:Folder)=>Folder) => {
    setConfig((c) => ({ ...c, folders: c.folders.map((f) => (f.id === id ? fn(f) : f)) }));
  }, []);

  const onSplit = useCallback((paneId: string, axis: SplitAxis, count: number) => {
    patchFolder(active.id, (f) => ({ ...f, layout: splitPane(f.layout, paneId, axis, count) }));
  }, [active, patchFolder]);

  /* Closing always asks first: a pane may own a live foreground process. */
  const commitClose = useCallback(() => {
    const paneId=confirmCloseId;if(!paneId)return;
    setConfirmCloseId(null);
    const commit=()=>{patchFolder(active.id,(f)=>({...f,layout:removePane(f.layout,paneId)}));setClosingId(null)};
    if(REDUCED())return commit();setClosingId(paneId);setTimeout(commit,160);
  },[active,patchFolder,confirmCloseId]);
  const onClose = useCallback((paneId: string) => setConfirmCloseId(paneId), []);

  const onResize = useCallback((path: number[], sizes: number[]) => {
    patchFolder(active.id, (f) => {
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
  }, [active, patchFolder]);

  const addFirstPane = useCallback(() => {
    patchFolder(active.id, (f) => ({ ...f, layout: pane('bash', false) }));
  }, [active, patchFolder]);

  const removeFolder = useCallback((id: string) => {
    setConfig((c) => {
      if (c.folders.length < 2) return c;
      const rest = c.folders.filter((f) => f.id !== id);
      if (id === active.id) go('f', rest[0].id);
      return { ...c, folders: rest };
    });
  }, [active]);

  /* ---- sidebar resize: pointer + keyboard, persisted in the config ---- */
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
    const up = () => {
      target.classList.remove('dragging');
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      setAppResizing(false);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };
  const onRailKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const step = e.shiftKey ? 48 : 16;
    const next = e.key === 'Home' ? RAIL_MIN : e.key === 'End' ? RAIL_MAX
               : ui.railWidth + (e.key === 'ArrowLeft' ? -step : step);
    setUi({ railWidth: clamp(next, RAIL_MIN, RAIL_MAX) });
  };

  /* routed overlays. The pane one is NOT a dialog any more — it renders inside
     the pane itself — but it keeps its route, so a specific pane's settings
     stay linkable and back/forward still work. */
  const routedPane = route[0] === 'f' && route[2] === 'pane' ? findPane(active?.layout, route[3]) : null;
  const showFolderDlg = route[0] === 'f' && route[2] === 'settings';
  const showNewDlg = route[0] === 'new';
  const showBackup = route[0] === 'backup';
  const showPalette = route[0] === 'palette';
  const showGlobalSettings = route[0] === 'settings';
  const showShortcuts=route[0]==='shortcuts';
  const closeDialog = () => go('f', active.id);

  const [newDraft, setNewDraft] = useState<Omit<Folder,'layout'> | null>(null);
  useEffect(() => {
    if (showNewDlg && !newDraft) setNewDraft({ id: uid('f-'), name: '', cwd: '~/', icon: null, pattern:'dots', theme:active?.theme||'paper' });
    if (!showNewDlg && newDraft) setNewDraft(null);
  }, [showNewDlg, newDraft]);

  /* Live pane edit — one patch, straight into the config. No draft, no Save. */
  const onPaneChange = useCallback((paneId: string, patch: Partial<PaneNode>) => {
    patchFolder(active.id, (f) => ({
      ...f,
      layout: mapTree(f.layout, (n) => (n.type === 'pane' && n.id === paneId ? { ...n, ...patch } : n)),
    }));
  }, [active, patchFolder]);

  const onPalettePick = (row: PaletteRow) => {
    if(row.kind==='pane'&&row.pane){go('f',row.folder.id);setFocusId(row.pane.id);setLastPaneByFolder(v=>({...v,[row.folder.id]:row.pane!.id}));setFocusReq({id:row.pane.id,n:Date.now()})}
    else focusFolderPane(row.folder);
  };

  /* A workspace row. Its settings gear lives HERE, on the row it acts on — a
     single global gear in the footer silently meant "the active folder", so
     configuring any other workspace meant switching to it first. Both actions
     reserve their box permanently and only fade, so the row's geometry (and
     the name's ellipsis point) is identical hovered or not. */
  const FolderRow = ({ f, compact, index }: {f:Folder;compact:boolean;index:number}) => {
    const label = folderLabel(f);
    const [open,setOpen]=useState(false);
    useEffect(()=>{if(!open)return;const close=()=>setOpen(false);addEventListener('pointerdown',close);return()=>removeEventListener('pointerdown',close)},[open]);
    return (
      <div className={'folder' + (f.id === active.id ? ' active' : '')}
           role="button" tabIndex={0}
           title={compact ? label : undefined}
           aria-current={f.id === active.id ? 'true' : undefined}
           aria-keyshortcuts={index<9?'Alt+'+(index+1):undefined}
           aria-label={(compact?label:'Workspace '+label)+(index<9?', Alt+'+(index+1):'')}
           onClick={() => focusFolderPane(f)}
           onDoubleClick={() => go('f', f.id, 'settings')}
           onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('f', f.id); } }}>
        <span className="folder-badge">
          {f.icon ? <WsIcon name={f.icon} /> : initials(label)}
        </span>
        {compact ? null : <span className="folder-name">{label}</span>}
        {compact||index>8?null:<span className="folder-shortcut" aria-hidden="true">Alt+{index+1}</span>}
        {compact ? null : (
          <span className="folder-actions" onPointerDown={e=>e.stopPropagation()}>
            <button className="folder-act" title={'Workspace menu — '+label} aria-label={'Workspace menu for '+label} aria-haspopup="menu" aria-expanded={open}
                    onClick={(e)=>{e.stopPropagation();setOpen(v=>!v)}}><Ico.menu /></button>
            {open?<span className="folder-menu" role="menu">
              <button role="menuitem" onClick={(e)=>{e.stopPropagation();setOpen(false);go('f',f.id,'settings')}}><Ico.gear/><span>Settings</span></button>
              {folders.length>1?<button className="danger" role="menuitem" onClick={(e)=>{e.stopPropagation();setOpen(false);removeFolder(f.id)}}><Ico.close/><span>Close</span></button>:null}
            </span>:null}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="shell" data-appearance={activeTheme.appearance} style={{...chromeVars(activeTheme),'--term-font-size':ui.fontSize+'px','--term-font-weight':FONT_WEIGHTS.find(({key})=>key===ui.fontWeight)?.value||400}}>
      {/* ONE rail in both states. Collapsing changes its WIDTH and nothing
          else: same element, same children, same order, same fixed 52px icon
          track — so no badge and no footer control moves by a pixel. (Swapping
          in a separate "stub" element is what made every glyph jump: five
          footer buttons in a row became two in a column.) */}
      <nav className={'rail' + (railOpen ? '' : ' collapsed')} aria-label="Workspaces" ref={railRef}
           style={{ flexBasis: (railOpen ? ui.railWidth : RAIL_COLLAPSED) + 'px' }}>
        {/* The product name, once, and the control that hides everything under
            it. Collapsed, the toggle takes the icon track (they cannot both own
            52px) — but nothing BELOW this row moves, which is the property the
            rail is built to hold. */}
        <div className="rail-head">
          {railOpen ? <span className="brand-name">ttydterm</span> : null}
          <button className="rail-toggle" title={(railOpen ? 'Hide' : 'Show') + ' sidebar (⌘/Ctrl+B)'}
                  aria-label={railOpen ? 'Hide sidebar' : 'Show sidebar'} aria-expanded={railOpen}
                  onClick={() => setRailOpen(!railOpen)}><Ico.panel /></button>
        </div>
        {/* `+` is the LAST ITEM OF THE LIST, not a footer button: it adds a row
            to the thing directly above it, so it belongs to that list and
            scrolls with it. In the footer it sat among app-wide actions and
            read as one of them. It keeps the same fixed 52px icon track as
            every workspace badge, so it lines up with them in both rail
            states and stays put when the rail collapses. */}
        <div className="rail-list">
          {folders.map((f,index) => <FolderRow key={f.id} f={f} index={index} compact={!railOpen} />)}
          <button className="ico add" title="New workspace" aria-label="New folder"
                  onClick={() => go('new')}><Ico.plus /></button>
        </div>
        {/* App-wide actions, one row. Hidden entirely when collapsed — see the
            note on .rail-foot: a 52px rail cannot hold a row, and stacking is
            what used to move every glyph on screen. ⌘/Ctrl+K still opens the
            palette with the rail shut. */}
        <div className="rail-foot">
          <button className="ico" title="Keyboard shortcuts" aria-label="Keyboard shortcuts" onClick={()=>go('shortcuts')}><Ico.keyboard /></button>
          <button className="ico rail-global" title="Global settings" aria-label="Global settings" onClick={() => go('settings')}><Ico.gear /></button>
          <button className="ico" title="Find a workspace or terminal (⌘/Ctrl+K)" aria-label="Command palette"
                  onClick={() => go('palette')}><Ico.search /></button>
          <button className="ico" title="Backup & restore" aria-label="Backup and restore"
                  onClick={() => go('backup')}><Ico.export /></button>
        </div>
      </nav>

      {/* The sidebar-to-stage gutter. ALWAYS rendered, so the channel is the
          same --gap whether the rail is open or shut; only its resize
          behaviour (and its separator semantics, which would be a lie without
          it) is conditional. */}
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
        {folders.map((f) => (
          <Surface key={f.id} folder={f} runtime={runtime} active={f.id === active.id} focusId={focusId} appResizing={appResizing}
                   closingId={closingId} focusReq={focusReq}
                   onFocus={(id)=>{setFocusId(id);setLastPaneByFolder(v=>({...v,[f.id]:id}))}} onSplit={onSplit} onClose={onClose} onResize={onResize}
                   onAddFirst={addFirstPane}
                   onOpenSettings={(id) => go('f', f.id, 'pane', id)} />
        ))}
      </main>

      {/* Every overlay is the SAME shell. What differs between them is the
          content and, for the palette, one body variant. */}
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
          onProbe={() => {
            setCapabilities({ state: 'probing', tmux: false, home: '~', cwd: '~' });
            probeCapabilities(runtime)
              .then(setCapabilities)
              .catch((error: unknown) => setCapabilities({ state: 'error', tmux: false, home: '~', cwd: '~', error: error instanceof Error ? error.message : String(error) }));
          }}
          onCreate={(cwd, name, persist) => {
            const folder: Folder = { id: uid('f-'), name, cwd, icon: 'terminal', pattern: 'dots', theme: 'paper', layout: pane('exec bash -l', persist) };
            setConfig({ version: CONFIG_VERSION, ui: { railWidth: RAIL_DEFAULT, railOpen: true, fontSize: 13, fontWeight:'regular' }, folders: [folder] });
            setConfigured(true);
            go('f', folder.id);
          }} />
      </ModalShell>

      <ModalShell open={showGlobalSettings} onClose={closeDialog}>
        <GlobalSettings theme={active.theme} fontSize={ui.fontSize} fontWeight={ui.fontWeight} onClose={closeDialog}
          onTheme={(theme) => patchFolder(active.id, (f) => ({ ...f, theme }))} onFontSize={(fontSize) => setUi({ fontSize })} onFontWeight={(fontWeight)=>setUi({fontWeight})} />
      </ModalShell>

      <ModalShell open={!!routedPane} onClose={closeDialog}>
        {routedPane ? <PaneSettings node={routedPane} folder={active} tmux={tmux} onChange={(patch) => onPaneChange(routedPane.id, patch)} onClose={closeDialog}/> : null}
      </ModalShell>

      <ModalShell open={showFolderDlg} onClose={closeDialog}>
        <FolderDialog folder={active} canDelete={folders.length > 1} onClose={closeDialog}
          onChange={(patch) => patchFolder(active.id, (f) => ({ ...f, ...patch }))}
          onDelete={() => removeFolder(active.id)} />
      </ModalShell>

      <ModalShell open={showNewDlg && !!newDraft} onClose={() => go('f', active.id)}>
        {newDraft ? (
          <FolderDialog folder={{...newDraft,layout:null}} isNew onClose={() => go('f', active.id)}
            onCreate={(next) => {
              const folder: Folder = { ...next, theme: next.theme || active.theme || 'paper', layout: pane('bash', false) };
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
  );
}

const root=document.getElementById('root');
if(!root) throw new Error('Missing #root');
createRoot(root).render(<App />);
