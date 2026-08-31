import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { paneLaunchCommand, shellCwd, shellQuote, tmuxLaunchCommand, ttydLaunchCommand } from './commands';
import { DOC_PAGES, docPage } from './docs';
import type { DocBlock, DocPage, DocSection, DocSpan } from './docs';
import { Button, CheckboxField, Field, FieldGroup, ModalActions, ModalForm, ModalShell } from './modal';
import type {
  Capabilities, Config, Folder, FontWeight, LayoutNode, PaneNode, PatternName, Runtime,
  SplitAxis, Theme, TmuxState, TtydEndpoints, UiState, ValidationResult,
} from './types';
import { APP_VERSION } from './version';

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

const themeOf = (key: string | null | undefined): Theme => (key ? THEMES[key] : undefined) || THEMES.paper;

const _rgb = (h: string) => { h = h.replace('#',''); return [0,2,4].map((i) => parseInt(h.slice(i,i+2),16)); };
const _lin = (c: number) => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
const luminance = (h: string) => { const [r,g,b] = _rgb(h).map(_lin); return 0.2126*r + 0.7152*g + 0.0722*b; };
const contrast = (a: string, b: string) => {
  const l1 = luminance(a), l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

window.__contrastAudit = () => {
  const TEXT: Array<keyof Theme & ('fg'|'dim'|'red'|'green'|'yellow'|'blue'|'magenta'|'cyan'|'cursor')> =
    ['fg','dim','red','green','yellow','blue','magenta','cyan','cursor'];
  const out: Array<{ theme: string; key: string; kind: string; ratio: number; min: number }> = [];
  for (const [name, t] of Object.entries(THEMES)) {
    TEXT.forEach((k) => out.push({ theme:name, key:k, kind:'text', ratio:+contrast(t[k], t.bg).toFixed(2), min:4.5 }));
    out.push({ theme:name, key:'focus-ring', kind:'ui', ratio:+contrast(t.blue, t.bg).toFixed(2), min:3 });

    out.push({ theme:name, key:'terminal-selection', kind:'text', ratio:+contrast(t.bg, t.blue).toFixed(2), min:4.5 });
    out.push({ theme:name, key:'ui-text/sidebar', kind:'text', ratio:+contrast(t.ui.text, t.ui.sidebar).toFixed(2), min:4.5 });
    out.push({ theme:name, key:'ui-muted/sidebar', kind:'text', ratio:+contrast(t.ui.muted, t.ui.sidebar).toFixed(2), min:4.5 });
    out.push({ theme:name, key:'ui-text/raised', kind:'text', ratio:+contrast(t.ui.text, t.ui.raised).toFixed(2), min:4.5 });
    out.push({ theme:name, key:'ui-muted/raised', kind:'text', ratio:+contrast(t.ui.muted, t.ui.raised).toFixed(2), min:4.5 });
    out.push({ theme:name, key:'ui-focus/sidebar', kind:'ui', ratio:+contrast(t.ui.focus, t.ui.sidebar).toFixed(2), min:3 });
    out.push({ theme:name, key:'ui-focus/raised', kind:'ui', ratio:+contrast(t.ui.focus, t.ui.raised).toFixed(2), min:3 });
    out.push({ theme:name, key:'ui-danger/raised', kind:'text', ratio:+contrast(t.ui.danger, t.ui.raised).toFixed(2), min:4.5 });
    out.push({ theme:name, key:'ui-warning/raised', kind:'text', ratio:+contrast(t.ui.warning, t.ui.raised).toFixed(2), min:4.5 });
    out.push({ theme:name, key:'ui-success/raised', kind:'text', ratio:+contrast(t.ui.success, t.ui.raised).toFixed(2), min:4.5 });
    out.push({ theme:name, key:'selected-ink/selected', kind:'text', ratio:+contrast(t.bg, t.blue).toFixed(2), min:4.5 });
  }
  return out;
};

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

const sidebarAtmosphereVars = () => softHorizonBackground(0, true);

window.__terminalAtmosphere = { seededPane, softHorizonBackground, paneGridIndex, sidebarAtmosphereVars };

const themeVars = (t: Theme): React.CSSProperties => ({
  '--t-bg': t.bg, '--t-fg': t.fg, '--t-dim': t.dim, '--t-cursor': t.cursor,
  '--t-red': t.red, '--t-green': t.green, '--t-yellow': t.yellow,
  '--t-blue': t.blue, '--t-magenta': t.magenta, '--t-cyan': t.cyan,
  '--t-edge': 'color-mix(in srgb, ' + t.fg + ' 26%, ' + t.bg + ')',

  '--t-ring': t.blue,
  '--t-skel': 'color-mix(in srgb, ' + t.fg + ' 12%, ' + t.bg + ')',

  '--t-pattern': 'color-mix(in srgb, ' + t.fg + ' 5%, ' + t.bg + ')',
});

const chromeVars = (t: Theme): React.CSSProperties => ({
  ...themeVars(t),
  '--stage-bg': t.ui.canvas,
  '--stage-panel': t.ui.raised,
  '--stage-edge': t.ui.edge,
  '--stage-ink': t.ui.text,
  '--stage-accent': t.ui.focus,

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

const STORE_KEY = 'ttyd-workspace-v2';
const BG_KEY = 'ttyd-workspace-bg';
const CONFIG_VERSION = 7;
const FONT_SIZES = [11, 12, 13, 14, 16, 18];
const FONT_WEIGHTS: Array<{key:FontWeight;label:string;value:number}> = [{key:'regular',label:'Regular',value:400},{key:'semibold',label:'Semi bold',value:600},{key:'bold',label:'Bold',value:700}];
const PATTERNS: PatternName[] = ['plain','dots','grid','diagonal','cross','waves','bricks'];
const defaultPattern = (id: string): PatternName => PATTERNS[1 + (hash32(id) % (PATTERNS.length - 1))];
const MIN_W = 260;   // a pane never renders narrower than this…
const MIN_H = 140;   // …or shorter than this; the area scrolls instead.

const GAP = (() => {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
  return Number.isFinite(v) && v > 0 ? v : 8;
})();
const FLOOR = 0.08;  // smallest share a slot may be dragged to (bounds canvas growth)

const RAIL_MIN = 148, RAIL_MAX = 420, RAIL_DEFAULT = 176;

const RAIL_COLLAPSED = 52;
const COMPLETION_ATTENTION_MS = 5000;

const uid = (p: string) => p + Math.random().toString(36).slice(2, 9);
const pane = (command: string, persist = false): PaneNode => ({ type:'pane', id: uid('p-'), command, persist });
const equal = (n: number) => Array.from({ length: n }, () => 1 / n);
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function defaultConfig(): Config {
  return {
    version: CONFIG_VERSION,
    ui: { railWidth: RAIL_DEFAULT, railOpen: true, fontSize: 13, fontWeight:'regular', notifyOnCommandFinish:false },
    folders: [
      {
        id: 'f-jr', name: 'kalviumjr', cwd: '~/work/kalviumjr', icon: 'code', pattern: 'dots' as const, theme:'night',
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
        id: 'f-infra', name: 'infra', cwd: '~/work/infra', icon: 'server', pattern: 'grid' as const, theme:'ocean',
        layout: { type: 'split' as const, axis: 'rows' as const, sizes: [0.62, 0.38],
          children: [ pane('k9s', true), pane('journalctl -f', true) ] },
      },
      { id: 'f-notes', name: 'notes', cwd: '~/notes', icon: 'book', pattern: 'diagonal' as const, theme:'paper', layout: pane('ls -la', false) },
    ],
  };
}

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
      notifyOnCommandFinish: rawUi.notifyOnCommandFinish === true,
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

const normalize = (sizes: number[]): number[] => {
  const clean = sizes.map((s) => (Number.isFinite(s) && s > 0 ? s : 0.0001));
  const sum = clean.reduce((a, b) => a + b, 0);
  return clean.map((s) => s / sum);
};

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

const splitPane = (root: LayoutNode | null, paneId: string, axis: SplitAxis, count: number, persist = false) =>
  mapTree(root, (n) => {
    if (n.type !== 'pane' || n.id !== paneId) return n;
    const extra = Array.from({ length: count - 1 }, () => pane('bash', persist));
    return { type:'split', axis, sizes: equal(count), children: [n, ...extra] };
  });

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
  ui: { railWidth: RAIL_DEFAULT, railOpen: true, fontSize: 13, fontWeight: 'regular', notifyOnCommandFinish:false },
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

function RealTerminal({ folder, pane, runtime, suspended, onCommandComplete }: {
  folder: Folder;
  pane: PaneNode;
  runtime: Runtime;
  suspended: boolean;
  onCommandComplete: (event:CommandCompletion) => void;
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
    const socket=new WebSocket(runtime.endpoints.ws,['tty']);socket.binaryType='arraybuffer';let initialized=false;
    const sendInput=(data: string)=>{if(socket.readyState!==1)return;const bytes=encoder.encode(data),payload=new Uint8Array(bytes.length+1);payload[0]=48;payload.set(bytes,1);socket.send(payload)};
    socket.onopen=()=>{socket.send(encoder.encode(JSON.stringify({AuthToken:runtime.token,columns:term.cols,rows:term.rows})));setState('starting')};
    socket.onmessage=(event: MessageEvent<ArrayBuffer>)=>{const bytes=new Uint8Array(event.data),command=String.fromCharCode(bytes[0]),data=bytes.slice(1);if(command==='0'){term.write(data);if(!initialized){initialized=true;const launch=paneLaunchCommand({cwd:folder.cwd,command:pane.command,persist:pane.persist,folderLabel:folderLabel(folder),paneId:pane.id,shellIntegration:true});sendInput(`${launch}\r`);setState('ready')}}else if(command==='1')document.title=decoder.decode(data)+' · ttydterm'};
    socket.onclose=()=>setState('disconnected');socket.onerror=()=>setState('error');
    const input=term.onData(sendInput),resize=term.onResize(({cols,rows})=>socket.readyState===1&&socket.send(encoder.encode('1'+JSON.stringify({columns:cols,rows}))));
    let toastTimer:ReturnType<typeof setTimeout>;
    const showToast=(text:string)=>{setToast(text);clearTimeout(toastTimer);toastTimer=setTimeout(()=>setToast(null),1400)};
    const pasteText=(text:string)=>pasteIntoTerminal(term,text);
    const readClipboard=async()=>{try{pasteText(await navigator.clipboard.readText())}catch{showToast('Clipboard access blocked');term.focus()}};
    const nativePaste=(event:ClipboardEvent)=>{const text=event.clipboardData?.getData('text/plain');if(text){event.preventDefault();pasteText(text)}};
    const menuPaste=()=>{void readClipboard()};
    const focusTerminal=()=>term.focus();
    hostEl.addEventListener('paste',nativePaste);hostEl.addEventListener('ttydterm-paste',menuPaste);hostEl.addEventListener('ttydterm-focus',focusTerminal);
    term.attachCustomKeyEventHandler((event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='v'&&event.type==='keydown'){void readClipboard();return false}return true});
    const selection=term.onSelectionChange(async()=>{const text=term.getSelection();if(!text)return;try{await navigator.clipboard.writeText(text);showToast('Copied')}catch{}});
    const ro=new ResizeObserver(()=>{try{fit.fit()}catch{}});ro.observe(hostEl);client.current={term,fit,socket};
    return()=>{clearTimeout(toastTimer);hostEl.removeEventListener('paste',nativePaste);hostEl.removeEventListener('ttydterm-paste',menuPaste);hostEl.removeEventListener('ttydterm-focus',focusTerminal);ro.disconnect();input.dispose();resize.dispose();selection.dispose();shellEvents.dispose();socket.close(1000);term.dispose();client.current=null};
  },[folder.cwd,folder.id,pane.id,pane.command,pane.persist,runtime.mode,runtime.mode==='ttyd'?runtime.token:null,onCommandComplete]);

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

function DocTerminal({ folder, page, section }: { folder: Folder; page: DocPage; section: DocSection }) {
  const first = page.sections[0] === section;
  return (
    <div className={'term doc-term pattern-' + (folder.pattern || 'plain')} data-ready="1" data-doc={page.id}
         role="region" aria-label={page.title + ' documentation'} tabIndex={0}>
      <div className="term-body">
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

function Terminal({ folder, pane, runtime, suspended, onCommandComplete }: {
  folder: Folder;
  pane: PaneNode;
  runtime: Runtime;
  suspended: boolean;
  onCommandComplete: (event:CommandCompletion) => void;
}) {
  const page = folder.doc ? docPage(folder.doc) : null;
  const section = page ? page.sections[pane.docSection ?? 0] : null;

  if (page && section) return <DocTerminal folder={folder} page={page} section={section} />;
  if (!folder.doc && runtime.mode === 'ttyd') return <RealTerminal folder={folder} pane={pane} runtime={runtime} suspended={suspended} onCommandComplete={onCommandComplete}/>;
  return <MockTerminal folder={folder} pane={pane} suspended={suspended}/>;
}

const S = { fill:'none', stroke:'currentColor', strokeWidth:1.7, strokeLinecap:'round', strokeLinejoin:'round' };
const svg = (name: string, body: React.ReactNode) => () => <svg viewBox="0 0 24 24" data-icon={name} {...S}>{body}</svg>;

const Ico = {
  plus:  svg('plus', <path d="M12 5v14M5 12h14" />),


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

const WS_ICONS: Record<string, React.ReactElement> = {
  terminal: <><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="m7 10 2.6 2.2L7 14.4M12.8 15h4" /></>,
  code:     <path d="m9 8-4 4 4 4M15 8l4 4-4 4M13.4 5.5l-2.8 13" />,
  folder:   <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h3.2l1.6 2h8.2A1.5 1.5 0 0 1 20 9.5v8A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" />,
  server:   <><rect x="3.5" y="4.5" width="17" height="6" rx="1.6" /><rect x="3.5" y="13.5" width="17" height="6" rx="1.6" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
  database: <><ellipse cx="12" cy="6.5" rx="7" ry="2.8" /><path d="M5 6.5v11c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8v-11M5 12c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8" /></>,
  cloud:    <path d="M7.2 18.5h9.3a3.6 3.6 0 0 0 .4-7.18A5.1 5.1 0 0 0 7.4 10.2a4.1 4.1 0 0 0-.2 8.3z" />,
  globe:    <><circle cx="12" cy="12" r="8.2" /><path d="M3.8 12h16.4M12 3.8c2.1 2.3 3.2 5.2 3.2 8.2s-1.1 5.9-3.2 8.2c-2.1-2.3-3.2-5.2-3.2-8.2s1.1-5.9 3.2-8.2z" /></>,
  rocket:   <><path d="M12 3.2c2.9 2.2 4.4 5.2 4.4 8.4L12 15.6l-4.4-4c0-3.2 1.5-6.2 4.4-8.4z" /><path d="M7.6 12.6 5 14.4l1 3.2 2.6-1M16.4 12.6 19 14.4l-1 3.2-2.6-1" /><circle cx="12" cy="9.4" r="1.5" /></>,
  keyboard: <><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 9h.01M9 9h.01M12 9h.01M15 9h.01M18 9h.01M7 12h.01M10 12h.01M13 12h.01M16 12h.01M7 15h10"/></>,
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

function Pane({ node, folder, runtime, focused, completed, closing, focusReq, resizing,
               onFocus, onSplit, onClose, canClose, onOpenSettings, onCommandComplete }: {
  node: PaneNode;
  folder: Folder;
  runtime: Runtime;
  focused: boolean;
  completed: number;
  closing: boolean;
  focusReq: FocusRequest | null;
  resizing: boolean;
  onFocus: () => void;
  onSplit: (paneId: string, axis: SplitAxis, count: number) => void;
  onClose: (paneId: string) => void;
  canClose: boolean;
  onOpenSettings: (paneId: string) => void;
  onCommandComplete: (event:CommandCompletion) => void;
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
  const split = (axis: SplitAxis, n: number) => { setMenu(null); onSplit(node.id, axis, n); };

  return (
    <div
      ref={ref}
      className={'pane' + (focused ? ' focused' : '') + (closing ? ' closing' : '')}
      style={{ ...themeVars(accent), '--t-ring': accent.blue }}
      data-pane-id={node.id}
      aria-label={'Terminal' + (completed ? ', ' + completed + ' completed command' + (completed === 1 ? '' : 's') + ' needing attention' : '')}
      tabIndex={-1}
      onPointerDownCapture={onFocus}
      onFocus={onFocus}

      onContextMenu={(e) => {
        e.preventDefault(); onFocus();
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        setMenu({ source:'context', x:e.clientX-r.left, y:e.clientY-r.top });
      }}
    >
      <Terminal folder={folder} pane={node} runtime={runtime} suspended={resizing} onCommandComplete={onCommandComplete} />
      {completed ? <span className="pane-complete" aria-hidden="true" /> : null}

      {}
      <div className="pane-edge" aria-hidden="true" />

      {}
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
               else if(e.key==="Escape"){e.preventDefault();setMenu(null);focusTerminal()}
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
  completedByPane: Record<string,number>;
  resizing: boolean;
  onResizeStart: () => void;
  onResizeEnd: () => void;
  onFocus: (paneId: string) => void;
  onSplit: (paneId: string, axis: SplitAxis, count: number) => void;
  onClose: (paneId: string) => void;
  canClose: boolean;
  onResize: (path: number[], sizes: number[]) => void;
  onOpenSettings: (paneId: string) => void;
  onCommandComplete: (event:CommandCompletion) => void;
  path: number[];
}

function Node({ node, folder, runtime, focusId, closingId, focusReq, completedByPane, resizing, onResizeStart, onResizeEnd,
               onFocus, onSplit, onClose, canClose, onResize, onOpenSettings, onCommandComplete, path }: NodeProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  if (node.type === 'pane') {
    const leaf = node;
    return (
      <Pane node={leaf} folder={folder} runtime={runtime} focused={focusId === leaf.id} completed={completedByPane[leaf.id] || 0} closing={closingId === leaf.id}
            focusReq={focusReq} resizing={resizing}
            onFocus={() => onFocus(leaf.id)} onSplit={onSplit} onClose={onClose} canClose={canClose}
            onOpenSettings={onOpenSettings} onCommandComplete={onCommandComplete} />
    );
  }

  const kidMins = node.children.map(nodeMin);
  const gaps = (node.children.length - 1) * GAP;


  const clampDelta = (i: number, delta: number, avail: number) => {
    const a0 = node.sizes[i], b0 = node.sizes[i + 1];
    const minA = (node.axis === 'columns' ? kidMins[i].w : kidMins[i].h) / avail;
    const minB = (node.axis === 'columns' ? kidMins[i + 1].w : kidMins[i + 1].h) / avail;
    let lo = minA - a0, hi = b0 - minB;
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
                  completedByPane={completedByPane} resizing={resizing} onResizeStart={onResizeStart} onResizeEnd={onResizeEnd}
                  onFocus={onFocus} onSplit={onSplit} onClose={onClose} canClose={canClose}
                  onResize={onResize} onOpenSettings={onOpenSettings} onCommandComplete={onCommandComplete} path={path.concat(i)} />
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function Surface({ folder, runtime, active, focusId, closingId, focusReq, completedByPane, appResizing,
                   onFocus, onSplit, onClose, onResize, onAddFirst, onOpenSettings, onCommandComplete }: {
  folder: Folder;
  runtime: Runtime;
  active: boolean;
  focusId: string | null;
  closingId: string | null;
  focusReq: FocusRequest | null;
  completedByPane: Record<string,number>;
  appResizing: boolean;
  onFocus: (paneId: string) => void;
  onSplit: (paneId: string, axis: SplitAxis, count: number) => void;
  onClose: (paneId: string) => void;
  onResize: (path: number[], sizes: number[]) => void;
  onAddFirst: () => void;
  onOpenSettings: (paneId: string) => void;
  onCommandComplete: (event:CommandCompletion) => void;
}) {
  const viewport = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [resizing, setResizing] = useState(false);

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
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
                  completedByPane={completedByPane} resizing={resizing || appResizing}
                  onResizeStart={() => setResizing(true)} onResizeEnd={() => setResizing(false)}
                  onFocus={onFocus} onSplit={onSplit} onClose={onClose} canClose={canClose}
                  onResize={onResize} onOpenSettings={onOpenSettings} onCommandComplete={onCommandComplete} path={[]} />
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

function FolderDialog({ folder, isNew, tmux, onCheckTmux, onChange, onCreate, onDelete, onClose, canDelete }: {
  folder: Folder;
  isNew?: boolean;
  tmux?: TmuxState;
  onCheckTmux?:()=>void;
  onChange?: (patch: Partial<Folder>) => void;
  onCreate?: (folder: Folder, persist: boolean) => void;
  onDelete?: () => void;
  onClose: () => void;
  canDelete?: boolean;
}) {
  const [draft, setDraft] = useState<Folder>(folder);
  const [persist,setPersist]=useState(tmux?.state === 'present');
  const persistTouched=useRef(false);
  useEffect(() => setDraft(folder), [folder]);
  useEffect(()=>{
    if(!isNew||persistTouched.current)return;
    if(tmux?.state==='present')setPersist(true);
    else if(tmux?.state==='absent')setPersist(false);
  },[isNew,tmux?.state]);
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
            ? <Button kind="primary" onClick={() => onCreate?.({ ...draft, name: draft.name.trim(), cwd: draft.cwd.trim() || '~' }, persist)}>Create</Button>

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
      {isNew && tmux ? <CheckboxField
        label="Keep the first terminal alive with tmux"
        checked={persist}
        disabled={tmux.state !== 'present'}
        onChange={(checked)=>{persistTouched.current=true;setPersist(checked)}}
        hintTone={tmux.state === 'absent'||tmux.state === 'error' ? 'warn' : 'default'}
        hint={<TmuxStatusHint tmux={tmux} onCheck={onCheckTmux}
          present="Installed and enabled by default. Uncheck to opt out."
          absent="tmux is not in the PATH used by ttyd’s login shell. This terminal dies with the tab." />}
      /> : null}
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

function PaneSettings({ node, folder, tmux, onCheckTmux, onChange, onClose }: {
  node: PaneNode;
  folder: Folder;
  tmux: TmuxState;
  onCheckTmux?:()=>void;
  onChange: (patch: Partial<PaneNode>) => void;
  onClose: () => void;
}) {
  const cmdRef = useRef<HTMLInputElement | null>(null);
  const cmdId = useId();


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
        disabled={tmux.state !== 'present'}
        onChange={(persist) => onChange({ persist })}
        hintTone={tmux.state === 'absent'||tmux.state === 'error' ? 'warn' : 'default'}
        hint={<TmuxStatusHint tmux={tmux} onCheck={onCheckTmux}
          present="Survives closing the tab."
          absent="tmux is not in the PATH used by ttyd’s login shell. This pane dies with the tab." />}
      />
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
  onCreate: (cwd: string, name: string, persist: boolean) => void;
}) {
  const [cwd,setCwd]=useState('~'),[name,setName]=useState('home'),[persist,setPersist]=useState(false);
  const cwdId = useId(), nameId = useId();
  useEffect(()=>{if(capabilities.state==='ready'){setCwd(capabilities.cwd||capabilities.home||'~');setName((capabilities.cwd||'home').split('/').filter(Boolean).pop()||'home');setPersist(!!capabilities.tmux)}},[capabilities.state]);
  return (

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
        label={'Keep panes alive with tmux ' + (capabilities.state === 'unknown' ? '(check environment first)'
          : capabilities.state === 'probing' ? '(checking)'
          : capabilities.state === 'error' ? '(check failed)'
          : capabilities.tmux ? '(installed)' : '(not found)')}
        checked={persist} disabled={!capabilities.tmux} onChange={setPersist}
        hint={capabilities.error} hintTone={capabilities.error ? 'warn' : 'default'}
      />
    </ModalForm>
  );
}

type NotificationPermissionState = NotificationPermission | 'unsupported';
const notificationPermission = ():NotificationPermissionState =>
  typeof Notification === 'undefined' || !isSecureContext ? 'unsupported' : Notification.permission;

function GlobalSettings({ theme, fontSize, fontWeight, notifyOnCommandFinish, notificationState,
                          onTheme, onFontSize, onFontWeight, onNotifications, onClose }: {
  theme: string;
  fontSize: number;
  fontWeight: FontWeight;
  notifyOnCommandFinish:boolean;
  notificationState:NotificationPermissionState;
  onTheme: (theme: string) => void;
  onFontSize: (size: number) => void;
  onFontWeight: (weight:FontWeight) => void;
  onNotifications:(enabled:boolean)=>void;
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
      <Field label="The entire workspace: folders, panes, splits, sizes, themes, sidebar width"
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

const folderLabel = (f: Folder) => f.name || f.cwd.split('/').filter((s: string) => s && s !== '~').pop() || 'workspace';

function ShortcutsDialog({onClose}:{onClose:()=>void}) {
  const groups=[['Workspaces',[['Alt + 1…9','Switch workspace and restore its last terminal'],['Ctrl/⌘ + Shift + ,','Workspace settings']]],['Panes',[['Alt + Arrow keys','Move between terminals'],['Arrow keys','Navigate an open pane menu'],['Enter','Activate the selected item']]],['Application',[['Ctrl/⌘ + K or P','Find a workspace or terminal'],['Ctrl/⌘ + B','Toggle sidebar'],['Ctrl/⌘ + ,','Global settings'],['Escape','Close a menu or dialog']]]] as const;
  return <ModalForm variant="shortcuts-dialog" title="Keyboard shortcuts" onClose={onClose}>{groups.map(([title,items])=><section key={title} className="shortcut-group"><h3>{title}</h3>{items.map(([keys,label])=><div key={keys} className="shortcut-row"><kbd>{keys}</kbd><span>{label}</span></div>)}</section>)}</ModalForm>;
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
  const [notificationState,setNotificationState]=useState<NotificationPermissionState>(notificationPermission);
  const paletteInputRef=useRef<HTMLInputElement|null>(null);
  const route = useRoute();
  const tmux = tmuxState(capabilities,runtime);

  const ui = config.ui;
  const railOpen = ui.railOpen;
  const setUi = useCallback((patch: Partial<UiState>) => setConfig((c) => ({ ...c, ui: { ...c.ui, ...patch } })), []);
  const setRailOpen = useCallback((v: boolean | ((previous:boolean)=>boolean)) => setUi({ railOpen: typeof v === 'function' ? v(railOpen) : v }), [railOpen, setUi]);

  const checkCapabilities=useCallback(()=>{
    if(runtime.mode!=='ttyd')return;
    setCapabilities({state:'probing',tmux:false,home:'~',cwd:'~'});
    probeCapabilities(runtime).then(setCapabilities).catch((error:unknown)=>setCapabilities({state:'error',tmux:false,home:'~',cwd:'~',error:error instanceof Error?error.message:String(error)}));
  },[runtime]);
  useEffect(() => { detectRuntime().then(setRuntime); }, []);
  useEffect(()=>{if(runtime.mode==='ttyd'&&capabilities.state==='unknown')checkCapabilities()},[runtime,capabilities.state,checkCapabilities]);
  useEffect(() => { if(configured) localStorage.setItem(STORE_KEY, JSON.stringify(config)); }, [config, configured]);

  const folders = config.folders;
  const routedId = route[0] === 'f' ? route[1] : null;


  const [stickyId, setStickyId] = useState(routedId);
  const active = folders.find((f) => f.id === routedId)
              || folders.find((f) => f.id === stickyId)
              || folders[0];
  useEffect(() => { if (active) setStickyId(active.id); }, [active?.id]);


  if(!active) throw new Error('Configuration has no folders');
  const activeTheme = THEMES[active.theme] || THEMES.paper;
  const configRef=useRef(config),activeIdRef=useRef(active.id);
  configRef.current=config;activeIdRef.current=active.id;
  useEffect(() => { document.documentElement.style.colorScheme = activeTheme.appearance; }, [activeTheme.appearance]);
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
  window.__reportCommandCompletion=onCommandComplete;
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


  const setDocTheme = useCallback((folderId: string, theme: string) => {
    patchFolder(folderId, (f) => (f.doc ? { ...f, theme } : f));
  }, [patchFolder]);

  const onSplit = useCallback((paneId: string, axis: SplitAxis, count: number) => {
    patchFolder(active.id, (f) => ({ ...f, layout: splitPane(f.layout, paneId, axis, count, tmux.state === 'present') }));
  }, [active, patchFolder, tmux.state]);


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
    patchFolder(active.id, (f) => ({ ...f, layout: pane('bash', tmux.state === 'present') }));
  }, [active, patchFolder, tmux.state]);

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


  const FolderRow = ({ f, compact, index }: {f:Folder;compact:boolean;index:number}) => {
    const label = folderLabel(f),completed=listPanes(f.layout).reduce((sum,p)=>sum+(completedByPane[p.id]||0),0);
    const [open,setOpen]=useState(false);
    useEffect(()=>{if(!open)return;const close=()=>setOpen(false);addEventListener('pointerdown',close);return()=>removeEventListener('pointerdown',close)},[open]);
    return (
      <div className={'folder' + (f.id === active.id ? ' active' : '')}
           title={label + (index < 9 ? ': Alt+' + (index + 1) : '')}>
        <button type="button" className="folder-main"
                aria-current={f.id === active.id ? 'true' : undefined}
                aria-keyshortcuts={index<9?'Alt+'+(index+1):undefined}
                aria-label={(compact?label:'Workspace '+label)+(completed?', '+completed+' completed command'+(completed===1?'':'s'):'')+(index<9?', Alt+'+(index+1):'')}
                onClick={() => focusFolderPane(f)}
                onDoubleClick={() => go('f', f.id, 'settings')}>
          <span className="folder-badge">
            {f.icon ? <WsIcon name={f.icon} /> : initials(label)}
          </span>
          {compact ? null : <span className="folder-name">{label}</span>}
          {completed ? <span className="folder-complete" aria-hidden="true" /> : null}
        </button>
        {compact ? null : (

          <span className={'folder-actions' + (open ? ' open' : '')}
                onPointerDown={e=>e.stopPropagation()}
                onKeyDown={(e)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false)}}}>
            <button className="folder-act" title={'Workspace menu: '+label} aria-label={'Workspace menu for '+label} aria-haspopup="menu" aria-expanded={open}
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
    <DocThemeContext.Provider value={setDocTheme}>
    <div className="shell" data-appearance={activeTheme.appearance} data-version={APP_VERSION}
         style={{...chromeVars(activeTheme),'--term-font-size':ui.fontSize+'px','--term-font-weight':FONT_WEIGHTS.find(({key})=>key===ui.fontWeight)?.value||400}}>
      {}
      <nav className={'rail' + (railOpen ? '' : ' collapsed')} aria-label="Workspaces" ref={railRef}
           style={{ flexBasis: (railOpen ? ui.railWidth : RAIL_COLLAPSED) + 'px' }}>
        {}
        <div className="rail-head">
          {railOpen ? (

            <span className="brand-block">
              <span className="brand-name">ttydterm</span>
              <span className="brand-version" aria-label={'version ' + APP_VERSION}>{APP_VERSION}</span>
            </span>
          ) : null}
          <button className="rail-toggle" title={(railOpen ? 'Hide' : 'Show') + ' sidebar (⌘/Ctrl+B)'}
                  aria-label={railOpen ? 'Hide sidebar' : 'Show sidebar'} aria-expanded={railOpen}
                  onClick={() => setRailOpen(!railOpen)}><Ico.panel /></button>
        </div>
        {}
        <div className="rail-list">
          {folders.map((f,index) => <FolderRow key={f.id} f={f} index={index} compact={!railOpen} />)}
          <button className="ico add" title="New workspace" aria-label="New folder"
                  onClick={() => go('new')}><Ico.plus /></button>
        </div>
        {}
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
        {folders.map((f) => (
          <Surface key={f.id} folder={f} runtime={runtime} active={f.id === active.id} focusId={focusId} appResizing={appResizing}
                   closingId={closingId} focusReq={focusReq} completedByPane={completedByPane}
                   onFocus={(id)=>{clearCompleted(id);setFocusId(id);setLastPaneByFolder(v=>({...v,[f.id]:id}))}} onSplit={onSplit} onClose={onClose} onResize={onResize}
                   onAddFirst={addFirstPane}
                   onOpenSettings={(id) => go('f', f.id, 'pane', id)} onCommandComplete={onCommandComplete} />
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
          onCreate={(cwd, name, persist) => {
            const folder: Folder = { id: uid('f-'), name, cwd, icon: 'terminal', pattern: 'dots', theme: 'paper', layout: pane('exec bash -l', persist) };
            setConfig({ version: CONFIG_VERSION, ui: { railWidth: RAIL_DEFAULT, railOpen: true, fontSize: 13, fontWeight:'regular', notifyOnCommandFinish:false }, folders: [folder] });
            setConfigured(true);
            go('f', folder.id);
          }} />
      </ModalShell>

      <ModalShell open={showGlobalSettings} onClose={closeDialog}>
        <GlobalSettings theme={active.theme} fontSize={ui.fontSize} fontWeight={ui.fontWeight}
          notifyOnCommandFinish={ui.notifyOnCommandFinish} notificationState={notificationState} onNotifications={setCommandNotifications} onClose={closeDialog}
          onTheme={(theme) => patchFolder(active.id, (f) => ({ ...f, theme }))} onFontSize={(fontSize) => setUi({ fontSize })} onFontWeight={(fontWeight)=>setUi({fontWeight})} />
      </ModalShell>

      <ModalShell open={!!routedPane} onClose={closeDialog}>
        {routedPane ? <PaneSettings node={routedPane} folder={active} tmux={tmux} onCheckTmux={runtime.mode==='ttyd'?checkCapabilities:undefined} onChange={(patch) => onPaneChange(routedPane.id, patch)} onClose={closeDialog}/> : null}
      </ModalShell>

      <ModalShell open={showFolderDlg} onClose={closeDialog}>
        <FolderDialog folder={active} canDelete={folders.length > 1} onClose={closeDialog}
          onChange={(patch) => patchFolder(active.id, (f) => ({ ...f, ...patch }))}
          onDelete={() => removeFolder(active.id)} />
      </ModalShell>

      <ModalShell open={showNewDlg && !!newDraft} onClose={() => go('f', active.id)}>
        {newDraft ? (
          <FolderDialog folder={{...newDraft,layout:null}} isNew tmux={tmux} onCheckTmux={runtime.mode==='ttyd'?checkCapabilities:undefined} onClose={() => go('f', active.id)}
            onCreate={(next,persist) => {
              const folder: Folder = { ...next, theme: next.theme || active.theme || 'paper', layout: pane('bash', persist) };
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
    </DocThemeContext.Provider>
  );
}

const root=document.getElementById('root');
if(!root) throw new Error('Missing #root');
createRoot(root).render(<App />);
