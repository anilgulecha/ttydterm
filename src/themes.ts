import type React from 'react';
import type { LayoutNode, Theme } from './types';

export const THEMES: Record<string, Theme> = {
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

export const THEME_KEYS = Object.keys(THEMES);
export const themeOf = (key: string | null | undefined): Theme => (key ? THEMES[key] : undefined) || THEMES.paper;

const rgb = (hex: string) => { const h=hex.replace('#',''); return [0,2,4].map((i)=>parseInt(h.slice(i,i+2),16)); };
const linear = (value: number) => { const c=value/255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); };
const luminance = (hex: string) => { const [r,g,b]=rgb(hex).map(linear); return 0.2126*r+0.7152*g+0.0722*b; };
const contrast = (a: string, b: string) => { const x=luminance(a),y=luminance(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };

export const contrastAudit = () => {
  const text: Array<keyof Theme & ('fg'|'dim'|'red'|'green'|'yellow'|'blue'|'magenta'|'cyan'|'cursor')> = ['fg','dim','red','green','yellow','blue','magenta','cyan','cursor'];
  const out: Array<{theme:string;key:string;kind:string;ratio:number;min:number}>=[];
  for(const [name,t] of Object.entries(THEMES)){
    text.forEach((key)=>out.push({theme:name,key,kind:'text',ratio:+contrast(t[key],t.bg).toFixed(2),min:4.5}));
    out.push({theme:name,key:'focus-ring',kind:'ui',ratio:+contrast(t.blue,t.bg).toFixed(2),min:3});
    out.push({theme:name,key:'terminal-selection',kind:'text',ratio:+contrast(t.bg,t.blue).toFixed(2),min:4.5});
    out.push({theme:name,key:'ui-text/sidebar',kind:'text',ratio:+contrast(t.ui.text,t.ui.sidebar).toFixed(2),min:4.5});
    out.push({theme:name,key:'ui-muted/sidebar',kind:'text',ratio:+contrast(t.ui.muted,t.ui.sidebar).toFixed(2),min:4.5});
    out.push({theme:name,key:'ui-text/raised',kind:'text',ratio:+contrast(t.ui.text,t.ui.raised).toFixed(2),min:4.5});
    out.push({theme:name,key:'ui-muted/raised',kind:'text',ratio:+contrast(t.ui.muted,t.ui.raised).toFixed(2),min:4.5});
    out.push({theme:name,key:'ui-focus/sidebar',kind:'ui',ratio:+contrast(t.ui.focus,t.ui.sidebar).toFixed(2),min:3});
    out.push({theme:name,key:'ui-focus/raised',kind:'ui',ratio:+contrast(t.ui.focus,t.ui.raised).toFixed(2),min:3});
    out.push({theme:name,key:'ui-danger/raised',kind:'text',ratio:+contrast(t.ui.danger,t.ui.raised).toFixed(2),min:4.5});
    out.push({theme:name,key:'ui-warning/raised',kind:'text',ratio:+contrast(t.ui.warning,t.ui.raised).toFixed(2),min:4.5});
    out.push({theme:name,key:'ui-success/raised',kind:'text',ratio:+contrast(t.ui.success,t.ui.raised).toFixed(2),min:4.5});
    out.push({theme:name,key:'selected-ink/selected',kind:'text',ratio:+contrast(t.bg,t.blue).toFixed(2),min:4.5});
  }
  return out;
};

export const seededPane = (index:number,salt=3) => { let x=(index+1)*2654435761+salt*1013904223;x^=x>>>16;return x>>>0; };
const hsla = (h:number,s:number,l:number,a:number) => `hsla(${((h%360)+360)%360} ${s}% ${l}% / ${a})`;
export const softHorizonBackground = (index:number,active=false) => {
  const amount=0.04*(active?2:1),seed=seededPane(index),rotation=seed%360;
  return [
    `linear-gradient(${175+seed%12}deg,${hsla(rotation+215,72,52,amount*.8)} 0%,transparent 42%)`,
    `linear-gradient(${5+seed%15}deg,transparent 52%,${hsla(rotation+165,68,51,amount*.72)} 100%)`,
    `linear-gradient(90deg,${hsla(rotation+28,75,53,amount*.55)} 0%,transparent 35%)`,
    `linear-gradient(270deg,${hsla(rotation+300,70,53,amount*.45)} 0%,transparent 30%)`,
  ].join(',');
};
export const paneGridIndex = (layout:LayoutNode|null,paneId:string):number => {
  let index=0;
  const visit=(node:LayoutNode|null):number=>{if(!node)return -1;if(node.type==='pane')return node.id===paneId?index:(index++,-1);for(const child of node.children){const found=visit(child);if(found>=0)return found}return -1};
  return Math.max(0,visit(layout));
};
const SIDEBAR_ATMOSPHERE=softHorizonBackground(0,true);
export const sidebarAtmosphereVars=()=>SIDEBAR_ATMOSPHERE;

export const themeVars = (t:Theme):React.CSSProperties => ({
  '--t-bg':t.bg,'--t-fg':t.fg,'--t-dim':t.dim,'--t-cursor':t.cursor,
  '--t-red':t.red,'--t-green':t.green,'--t-yellow':t.yellow,'--t-blue':t.blue,'--t-magenta':t.magenta,'--t-cyan':t.cyan,
  '--t-edge':'color-mix(in srgb, '+t.fg+' 26%, '+t.bg+')','--t-ring':t.blue,
  '--t-skel':'color-mix(in srgb, '+t.fg+' 12%, '+t.bg+')','--t-pattern':'color-mix(in srgb, '+t.fg+' 5%, '+t.bg+')',
});

export const chromeVars = (t:Theme):React.CSSProperties => ({
  ...themeVars(t),'--stage-bg':t.ui.canvas,'--stage-panel':t.ui.raised,'--stage-edge':t.ui.edge,'--stage-ink':t.ui.text,'--stage-accent':t.ui.focus,
  '--ui-panel':t.bg,'--ui-panel-atmosphere':SIDEBAR_ATMOSPHERE,'--ui-raised':t.ui.raised,'--ui-field':t.ui.field,
  '--ui-hover':'color-mix(in srgb, '+t.fg+' 14%, '+t.bg+')','--ui-active':t.blue,'--ui-active-ink':t.bg,'--ui-edge':t.ui.edge,
  '--ui-ink':t.fg,'--ui-muted':t.dim,'--ui-accent':t.ui.focus,'--ui-danger':t.ui.danger,'--ui-warn':t.ui.warning,'--ui-success':t.ui.success,
  '--ui-selected-ink':t.bg,'--ui-shadow':'color-mix(in srgb, '+t.bg+' 62%, transparent)','--ui-scrim':'color-mix(in srgb, '+t.bg+' 62%, transparent)',
  '--panel':t.ui.raised,'--ink':t.ui.text,'--muted':t.ui.muted,'--line':t.ui.edge,'--accent':t.ui.focus,'--danger':t.ui.danger,
});
