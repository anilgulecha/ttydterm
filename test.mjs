
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

const gRoot = execSync('npm root -g').toString().trim();
const { chromium } = await import(`${gRoot}/playwright/index.mjs`);

const RAW_BASE = process.env.BASE ?? 'http://127.0.0.1:8791/ttyd-workspace/';
const BASE = RAW_BASE + (RAW_BASE.includes('?') ? '&mock=1' : '?mock=1');
const SHOTS = '/tmp/ttyd-shots';
mkdirSync(SHOTS, { recursive: true });

const trackedText = execSync('git ls-files -z').toString().split('\0').filter(Boolean).flatMap((path) => {
  try { return [[path, readFileSync(path, 'utf8')]]; }
  catch { return []; }
});
const words = (...parts) => parts.join(' ');
const bannedCopy = [
  String.fromCodePoint(0x2014), String.fromCodePoint(0x2013),
  words('the','honest','answer'), words('to','be','honest'), words('let','me','be','honest'),
  words('the','honest','truth'), words('in','all','honesty'), words('excited','to','share'),
  words('thrilled','to','announce'), words('in',"today's",'rapidly','evolving'),
  words("let's",'dive','into'), words('comment','if','you','agree'), words('tag','a','parent','who'),
  words('great','post'), words('thanks','for','sharing'), words('so','true'),
  words("couldn't",'agree','more'), words('is','the','real','difference'),
  words('is','what','every','child','deserves'), words('is','where','learning','lives'),
  words('word','count') + ':', words('a','few','notes','on','the','choices','made'),
];
const copyTellHits = trackedText.flatMap(([path, text]) => bannedCopy
  .filter((phrase) => text.toLowerCase().includes(phrase.toLowerCase()))
  .map((phrase) => `${path}: ${JSON.stringify(phrase)}`));

let failures = 0;
const ok = (label, cond, extra = '') => {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.log(`  FAIL ${label}${extra ? ': ' + extra : ''}`); }
};

const LIVE_PANE = '.surface:not([hidden]) .pane';

const boxOf = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x:+r.x.toFixed(2), y:+r.y.toFixed(2), w:+r.width.toFixed(2), h:+r.height.toFixed(2) };
}, sel);

const inkOf = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const range = document.createRange();
  range.selectNodeContents(el);
  const r = range.getBoundingClientRect();
  return { x:+r.x.toFixed(2), y:+r.y.toFixed(2), w:+r.width.toFixed(2), h:+r.height.toFixed(2) };
}, sel);

const sameBox = (a, b, tol = 0.5) =>
  !!a && !!b && ['x','y','w','h'].every((k) => Math.abs(a[k] - b[k]) <= tol);
const LIVE_TERM = '.surface:not([hidden]) .term[data-ready="1"]';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.addInitScript(() => {
  window.__sawSkeleton = false;
  new MutationObserver(() => {
    if (document.querySelector('.term.skeleton')) window.__sawSkeleton = true;
  }).observe(document, { childList: true, subtree: true });
});

console.log('\nttyd-workspace smoke test');
ok('tracked files contain no hard copy tells', copyTellHits.length === 0, copyTellHits.join(' | '));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector(LIVE_TERM, { timeout: 15000 });

console.log('\nboot');
ok('no console/page errors', errors.length === 0, errors.join(' | '));
ok('hash route settled on a folder', /#\/f\//.test(page.url()), page.url());
ok('release 1.1 is shown beneath the wordmark and exposed on the shell', await page.evaluate(() =>
  document.querySelector('.brand-version')?.textContent === 'v1.1' &&
  document.querySelector('.shell')?.getAttribute('data-version') === '1.1'));
ok('fresh sidebar uses the compact 176px default', Math.abs((await page.locator('.rail').evaluate((el) => el.getBoundingClientRect().width)) - 176) < 1);

const folderNames = await page.$$eval('.folder-name', (n) => n.map((e) => e.textContent));
ok('sidebar lists 3 seeded folders', folderNames.length === 3, folderNames.join(','));

const paneCount = await page.locator('.surface:not([hidden]) .pane').count();
ok('active folder mounted all 3 panes', paneCount === 3, String(paneCount));

const totalPanes = await page.locator('.pane').count();
ok('every folder stays mounted (6 panes total)', totalPanes === 6, String(totalPanes));

ok('terminals boot through a skeleton placeholder', await page.evaluate(() => window.__sawSkeleton));
ok('skeletons all resolved to content',
  (await page.locator('.term.skeleton').count()) === 0);

const stray = await page.evaluate(() => {
  const out = [];
  const walk = (el) => {
    for (const node of el.childNodes) {
      if (node.nodeType === 1 && /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(node.tagName)) continue;
      if (node.nodeType === 3 && node.textContent.trim()) {
        const host = node.parentElement;
        if (host.closest('.term')) continue;          // terminal content is allowed
        if (host.closest('.folder')) continue;        // folder names are allowed
        if (host.closest('.brand-block')) continue;   // product name + release, once
        if (host.closest('dialog')) continue;         // overlays are allowed
        if (host.closest('.panesettings')) continue;  // ...including the pane popover
        out.push(host.className + ': ' + node.textContent.trim().slice(0, 40));
      } else if (node.nodeType === 1) walk(node);
    }
  };
  walk(document.body);
  return out;
});
console.log('\ndesign law');
ok('only text outside terminals is the brand + folder names', stray.length === 0, stray.join(' | '));

const brand = await page.locator('.rail-head .brand-name').textContent().catch(() => null);
ok('the rail is headed by the product name', brand === 'ttydterm', String(brand));
ok('the brand sits above the workspace list', await page.evaluate(() => {
  const b = document.querySelector('.brand-name');
  const l = document.querySelector('.rail-list');
  return !!b && !!l && b.getBoundingClientRect().bottom <= l.getBoundingClientRect().top + 1;
}));
ok('the collapse control sits to the right of the brand', await page.evaluate(() => {
  const b = document.querySelector('.brand-name');
  const t = document.querySelector('.rail-head .rail-toggle');
  return !!b && !!t && t.getBoundingClientRect().left >= b.getBoundingClientRect().right - 1;
}));

ok('each workspace row uses one triple-dot menu control', await page.evaluate(() =>
  [...document.querySelectorAll('.folder')].every((row)=>row.querySelectorAll('.folder-act').length===1 && !!row.querySelector('.folder-act svg[data-icon="menu"]'))));
ok('workspace shortcuts are tooltip and accessibility metadata, never a width-reserving label', await page.evaluate(() =>
  document.querySelectorAll('.folder-shortcut').length === 0 &&
  [...document.querySelectorAll('.folder')].every((row, index) => {
    const main = row.querySelector('.folder-main');
    return index > 8 || row.getAttribute('title')?.includes('Alt+' + (index + 1)) &&
      main?.getAttribute('aria-keyshortcuts') === 'Alt+' + (index + 1);
  })));
ok('workspace rows do not nest the menu button inside another interactive control', await page.evaluate(() =>
  [...document.querySelectorAll('.folder')].every((row) =>
    !row.matches('button,[role="button"]') && row.querySelectorAll('.folder-main > button').length === 0)));
ok('workspace menu action is an out-of-flow overlay', await page.evaluate(() =>
  [...document.querySelectorAll('.folder-actions')].every((action) => getComputedStyle(action).position === 'absolute')));

const cursorAnim = await page.locator('.surface:not([hidden]) .cursor').first()
  .evaluate((el) => getComputedStyle(el).animationName);
ok('terminal cursor does not blink', cursorAnim === 'none', cursorAnim);

const palette = await page.$$eval('.surface:not([hidden]) .term span', (spans) => {
  const set = new Set();
  spans.forEach((s) => { const c = getComputedStyle(s).color; if (c) set.add(c); });
  return [...set];
});
ok('mock terminal renders a multi-colour palette', palette.length >= 5, palette.length + ' colours');
const xtermPalette = await page.evaluate(() => {
  const el=document.querySelector('.surface:not([hidden]) .term[data-ready="1"]');
  const values=window.__xtermAppearance(el).theme, css=getComputedStyle(el), get=(name)=>css.getPropertyValue(name).trim();
  return {values,expected:{foreground:get('--t-fg'),red:get('--t-red'),green:get('--t-green'),yellow:get('--t-yellow'),blue:get('--t-blue'),magenta:get('--t-magenta'),cyan:get('--t-cyan')},background:get('--t-bg')};
});
ok('real xterm glyph palette is derived completely from the selected app theme',
  xtermPalette.values.background === 'rgba(0,0,0,0)' && Object.entries(xtermPalette.expected).every(([key,value])=>xtermPalette.values[key]===value), JSON.stringify(xtermPalette));
ok('xterm selection uses solid themed blue with guaranteed contrasting ink',
  xtermPalette.values.selectionBackground===xtermPalette.expected.blue && xtermPalette.values.selectionForeground===xtermPalette.background,JSON.stringify(xtermPalette.values));
const cwdCommands=await page.evaluate(()=>['~','~/','~/work/project','/tmp/a b'].map(window.__shellCwd));
ok('terminal cwd setup expands home shorthand before shell quoting',
  cwdCommands[0]==='"$HOME"' && cwdCommands[1]==='"$HOME"' && cwdCommands[2]==='"$HOME"/\'work/project\'' && cwdCommands[3]==="'/tmp/a b'",cwdCommands.join(' | '));
const tmuxCommand=await page.evaluate(()=>window.__tmuxLaunchCommand('"$HOME"', 'ttydterm-test'));
ok('tmux launch enables mouse, disables status, and attaches after configuration',
  tmuxCommand.includes('mouse on') && tmuxCommand.includes('status off') && tmuxCommand.includes('unbind-key -n MouseDown3Pane') && tmuxCommand.includes('exec tmux attach-session'),tmuxCommand);
const links = await page.locator('.surface:not([hidden]) a.term-link').count();
ok('terminal URLs render as clickable links', links >= 2, String(links));
const lsCells = await page.locator('.surface:not([hidden]) .ls > span').count();
ok('mock `ls` output present', lsCells > 5, String(lsCells));

console.log('\nhover never moves terminal content');
const TERM1 = '.surface:not([hidden]) .pane .term';
const FIRSTLINE = '.surface:not([hidden]) .pane .term > * > *:first-child';
await page.mouse.move(0, 0);
await page.waitForTimeout(220);
const inkRest = await inkOf(page, FIRSTLINE);
const termRest = await boxOf(page, TERM1);

const firstPaneEl = page.locator('.surface:not([hidden]) .pane').first();
await firstPaneEl.hover();
await page.waitForTimeout(260);
const inkHover = await inkOf(page, FIRSTLINE);
const termHover = await boxOf(page, TERM1);

ok('hovering does not move the terminal box', sameBox(termRest, termHover),
  JSON.stringify(termRest) + ' -> ' + JSON.stringify(termHover));
ok('hovering does not reflow the first line of output', sameBox(inkRest, inkHover),
  JSON.stringify(inkRest) + ' -> ' + JSON.stringify(inkHover));

const hoverPads = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.surface:not([hidden]) .pane .term, .surface:not([hidden]) .pane .term *')
    .forEach((el) => {
      const cs = getComputedStyle(el);
      if (el.classList.contains('term')) return;   // the terminal's own padding is constant
      const pad = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft];
      if (pad.some((p) => p !== '0px')) out.push(el.className + ' ' + pad.join(','));
    });
  return out;
});
ok('no terminal descendant carries hover padding while hovered', hoverPads.length === 0, hoverPads.slice(0, 3).join(' | '));
await page.screenshot({ path: `${SHOTS}/16-hover-no-shift.png` });

const railTransform = await page.locator('.surface:not([hidden]) .pane .rail-pane').first()
  .evaluate((el) => getComputedStyle(el).transform);
ok('pane control fades in place, never slides', railTransform === 'none', railTransform);

await page.mouse.move(0, 0);
await page.waitForTimeout(220);
const inkAfter = await inkOf(page, FIRSTLINE);
ok('leaving the pane restores the exact original position', sameBox(inkRest, inkAfter),
  JSON.stringify(inkRest) + ' -> ' + JSON.stringify(inkAfter));

console.log('\nborderless at rest');
const restEdge = await page.evaluate(() => {
  const p = document.querySelector('.surface:not([hidden]) .pane:not(.focused)');
  const e = p?.querySelector('.pane-edge');
  return e ? getComputedStyle(e).boxShadow : null;
});
ok('a resting pane paints no border at all', restEdge === 'none', String(restEdge));
const atmosphere = await page.evaluate(() => {
  const terms = [...document.querySelectorAll('.surface:not([hidden]) .term[data-ready="1"]')];
  const pure = window.__terminalAtmosphere;
  const railBackground = getComputedStyle(document.querySelector('.rail')).backgroundImage;
  return {
    functions: Object.keys(pure || {}).sort(),
    terminalsStayPlain: terms.every((el) => getComputedStyle(el).backgroundImage === 'none'),
    railGradientCount: (railBackground.match(/linear-gradient/g) || []).length,
    deterministic: pure.sidebarAtmosphereVars() === pure.sidebarAtmosphereVars(),
    railUsesActiveVersion: railBackground !== 'none' &&
      pure.sidebarAtmosphereVars() === pure.softHorizonBackground(0, true),
  };
});
ok('sidebar atmosphere is exposed as pure deterministic functions',
  atmosphere.functions.join(',') === 'paneGridIndex,seededPane,sidebarAtmosphereVars,softHorizonBackground' && atmosphere.deterministic);
ok('terminal panes retain their original plain or pattern-only backgrounds', atmosphere.terminalsStayPlain);
ok('only the sidebar receives the four-gradient active atmosphere',
  atmosphere.railGradientCount === 4 && atmosphere.railUsesActiveVersion, JSON.stringify(atmosphere));

const readSurfaces = () => page.evaluate(() => {
  const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
  const lum = (rgb) => { const [r,g,b] = rgb.slice(0,3).map(lin); return 0.2126*r + 0.7152*g + 0.0722*b; };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi,lo] = l1>l2?[l1,l2]:[l2,l1]; return (hi+0.05)/(lo+0.05); };
  const term = document.querySelector('.surface:not([hidden]) .term');
  const shell = document.querySelector('.shell');
  const rail = document.querySelector('.rail');
  if (!term || !shell || !rail) return null;
  const raw = getComputedStyle(shell).backgroundColor;
  const nums = parse(raw);
  const stage = /^color\(/.test(raw) ? nums.slice(0, 3).map((v) => v * 255) : nums.slice(0, 3);
  const termBg = parse(getComputedStyle(term).backgroundColor);
  const railBg = parse(getComputedStyle(rail).backgroundColor);
  return {
    name: document.querySelector('.folder.active')?.textContent.trim().slice(0, 12) || '?',
    stage: stage.map(Math.round).join(','),
    termVsStage: +ratio(termBg, stage).toFixed(3),
    railVsStage: +ratio(railBg, stage).toFixed(3),
    gutterVsRail: +ratio(stage, railBg).toFixed(3),
    gutterVsTerm: +ratio(stage, termBg).toFixed(3),
  };
});

const surfaceSteps = [];
const themedRows = await page.locator('.rail-list .folder').count();
for (let i = 0; i < themedRows; i++) {
  await page.locator('.rail-list .folder').nth(i).click();
  await page.waitForTimeout(320);
  const s = await readSurfaces();
  if (s) surfaceSteps.push(s);
}
ok('workspaces retain distinct configured themes',
  new Set(surfaceSteps.map((s) => s.stage)).size === surfaceSteps.length,
  surfaceSteps.map((s) => `${s.name}:[${s.stage}]`).join(' '));
const weakTerm = surfaceSteps.filter((s) => s.termVsStage < 1.12);
ok('the gap colour separates every terminal from the stage without a border',
  surfaceSteps.length >= 3 && weakTerm.length === 0,
  surfaceSteps.map((s) => `${s.name}:${s.termVsStage}`).join(' '));
const weakRail = surfaceSteps.filter((s) => s.railVsStage < 1.12);
ok('the borderless sidebar still separates from the stage in every theme',
  weakRail.length === 0, surfaceSteps.map((s) => `${s.name}:${s.railVsStage}`).join(' '));

const weakSurfaceSteps = surfaceSteps.filter((s) => s.gutterVsRail < 1.12 || s.gutterVsTerm < 1.12);
ok('the gutter separates the sidebar from the terminal in every theme',
  weakSurfaceSteps.length === 0,
  surfaceSteps.map((s) => `${s.name}:rail=${s.gutterVsRail}/term=${s.gutterVsTerm}`).join(' '));
ok('the sidebar carries no perimeter border', await page.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('.rail'));
  return cs.boxShadow === 'none' && parseFloat(cs.borderTopWidth) === 0;
}));
ok('the sidebar head carries no hairline', await page.evaluate(() =>
  getComputedStyle(document.querySelector('.rail-head')).boxShadow === 'none'));
ok('the sidebar footer carries no hairline', await page.evaluate(() =>
  getComputedStyle(document.querySelector('.rail-foot')).boxShadow === 'none'));

await page.locator('.rail-list .folder').first().click();
await page.waitForTimeout(120);

console.log('\nfocused border');
await firstPaneEl.click();
await page.waitForTimeout(220);
const edge = await page.evaluate(() => {
  const p = document.querySelector('.surface:not([hidden]) .pane.focused');
  const e = p?.querySelector('.pane-edge');
  if (!e) return null;
  const cs = getComputedStyle(e);
  const pr = p.getBoundingClientRect(), er = e.getBoundingClientRect();
  return {
    shadow: cs.boxShadow,
    zIndex: cs.zIndex,
    covers: Math.abs(pr.x - er.x) < 0.6 && Math.abs(pr.y - er.y) < 0.6 &&
            Math.abs(pr.width - er.width) < 0.6 && Math.abs(pr.height - er.height) < 0.6,
    aboveTerm: +cs.zIndex > 0,
    radius: cs.borderRadius,
  };
});
ok('focused pane draws a full-perimeter edge overlay', !!edge && edge.covers, JSON.stringify(edge));
ok('the edge sits ABOVE the terminal background', !!edge && edge.aboveTerm, edge && edge.zIndex);
ok('the edge is an inset ring, so nothing can clip it',
  !!edge && /inset/.test(edge.shadow), edge && edge.shadow);
ok('focus ring is 3px and visible', !!edge && /3px/.test(edge.shadow), edge && edge.shadow);

const edgeGeom = await page.evaluate(() => {
  const panes = [...document.querySelectorAll('.surface:not([hidden]) .pane')];
  const f = panes.find((p) => p.classList.contains('focused'));
  const u = panes.find((p) => !p.classList.contains('focused'));
  const g = (p) => {
    const t = p.querySelector('.term').getBoundingClientRect();
    const b = p.getBoundingClientRect();
    return { inset:+(t.x - b.x).toFixed(2), w:+(b.width - t.width).toFixed(2), h:+(b.height - t.height).toFixed(2) };
  };
  const cs = (p) => getComputedStyle(p.querySelector('.pane-edge')).boxShadow;
  return { fShadow: cs(f), uShadow: cs(u), fg: g(f), ug: g(u) };
});
ok('exactly one pane is ringed: the focused one',
  edgeGeom.fShadow !== 'none' && edgeGeom.uShadow === 'none',
  edgeGeom.fShadow + '  vs  ' + edgeGeom.uShadow);
ok('the ring costs the terminal no geometry',
  JSON.stringify(edgeGeom.fg) === JSON.stringify(edgeGeom.ug),
  JSON.stringify(edgeGeom.fg) + ' vs ' + JSON.stringify(edgeGeom.ug));

const ringContrast = await page.evaluate(() => {
  const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
  const lum = (rgb) => { const [r,g,b] = rgb.slice(0,3).map(lin); return 0.2126*r + 0.7152*g + 0.0722*b; };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi,lo] = l1>l2?[l1,l2]:[l2,l1]; return (hi+0.05)/(lo+0.05); };
  const p = document.querySelector('.surface:not([hidden]) .pane.focused');
  const ring = parse(getComputedStyle(p.querySelector('.pane-edge')).boxShadow);
  return {
    vsTerm: +ratio(ring, parse(getComputedStyle(p.querySelector('.term')).backgroundColor)).toFixed(2),
    vsStage: +ratio(ring, parse(getComputedStyle(document.querySelector('.shell')).backgroundColor)).toFixed(2),
  };
});
ok('the focus ring clears 3:1 against the terminal it rings',
  ringContrast.vsTerm >= 3, String(ringContrast.vsTerm));
ok('the focus ring clears 3:1 against the gap around it',
  ringContrast.vsStage >= 3, String(ringContrast.vsStage));

const ringClear = await page.evaluate(() => {
  const p = document.querySelector('.surface:not([hidden]) .pane.focused');
  const edge = p.querySelector('.pane-edge');
  const pr = p.getBoundingClientRect();
  const z = (el) => +getComputedStyle(el).zIndex || 0;
  const chrome = [...p.querySelectorAll('.rail-pane, .panepop, .panesettings')];
  return chrome.map((c) => {
    const r = c.getBoundingClientRect();
    return {
      cls: c.className.split(' ')[0],
      inset: Math.round(Math.min(r.top - pr.top, pr.right - r.right, pr.bottom - r.bottom, r.left - pr.left)),
      underEdge: z(c) < z(edge),
    };
  });
});
ok('pane chrome sits inside the border, never on it',
  ringClear.length > 0 && ringClear.filter((c) => c.cls !== 'panesettings').every((c) => c.inset >= 3), JSON.stringify(ringClear));
ok('the border paints above every piece of pane chrome',
  ringClear.every((c) => c.underEdge), JSON.stringify(ringClear));
await page.screenshot({ path: `${SHOTS}/17-focus-ring.png` });

await page.screenshot({ path: `${SHOTS}/01-boot.png` });

console.log('\nsplit');
const firstPane = page.locator('.surface:not([hidden]) .pane').first();
await firstPane.hover();

const restingPicos = await firstPane.locator('.pico').count();
ok('pane rests behind a single control', restingPicos === 1, String(restingPicos));

await firstPane.locator('.pico[aria-label="Pane menu"]').click();
await page.waitForSelector('.panepop');
await page.locator('.panepop').evaluate((el) =>
  Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))));
const popLabels = await page.$$eval('.panepop .pico', (n) => n.map((e) => e.getAttribute('aria-label')));
ok('menu carries settings, close and both split axes',
  popLabels.includes('Pane settings') && popLabels.includes('Close pane') &&
  [2, 3, 4].every((n) => popLabels.includes(`Split into ${n} columns`)) &&
  [2, 3, 4].every((n) => popLabels.includes(`Split into ${n} rows`)),
  popLabels.join(', '));
await page.screenshot({ path: `${SHOTS}/12-pane-menu.png` });

const popBleed = await page.evaluate(() => {
  const pop = document.querySelector('.panepop');
  const cs = getComputedStyle(pop);
  return { op: cs.opacity, bg: cs.backgroundColor };
});
ok('pane menu is fully opaque over the terminal',
  popBleed.op === '1' && /^rgb\(/.test(popBleed.bg), JSON.stringify(popBleed));

await page.keyboard.press('Escape');
const paneBoxForMenu = await firstPane.boundingBox();
await firstPane.click({ button: 'right', position: { x: 80, y: 100 } });
ok('right-click opens the pane menu', (await page.locator('.panepop').count()) === 1);
const menuAtClick = await page.locator('.panepop').boundingBox();
ok('context menu opens at the right-click coordinate and remains pane-clamped',
  Math.abs(menuAtClick.x - (paneBoxForMenu.x + 80)) < 8 && Math.abs(menuAtClick.y - (paneBoxForMenu.y + 100)) < 8 &&
  menuAtClick.x >= paneBoxForMenu.x && menuAtClick.y >= paneBoxForMenu.y && menuAtClick.x + menuAtClick.width <= paneBoxForMenu.x + paneBoxForMenu.width + 1,
  JSON.stringify({pane:paneBoxForMenu,menu:menuAtClick}));
await page.keyboard.press('ArrowRight');
ok('context menu supports arrow-key focus navigation',
  await page.evaluate(() => document.activeElement?.closest('.panepop') !== null));
await page.locator('.panepop .pico[aria-label="Split into 3 columns"]').click();
await page.waitForTimeout(160);
const afterSplit = await page.locator('.surface:not([hidden]) .pane').count();
ok('splitting into 3 columns adds 2 panes', afterSplit === 5, String(afterSplit));
await page.waitForSelector('.surface:not([hidden]) .term.skeleton', { state: 'detached' });

const splitCmds = await page.evaluate(() => {
  const panes = [...document.querySelectorAll('.surface:not([hidden]) .pane')];
  panes.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  return panes.map((p) => p.querySelector('.term').textContent);
});
ok('existing pane took the leftmost slot', splitCmds[0].includes('pi'), splitCmds[0].slice(0, 40));

const clones = splitCmds.slice(1, 3).filter((t) => t.includes('session ready')).length;
ok('split panes do not clone the source command', clones === 0, `${clones} clone(s)`);
const freshAreBash = splitCmds.slice(1, 3).every((t) => /\$ bash/.test(t));
ok('fresh split panes default to bash', freshAreBash, splitCmds.slice(1, 3).map((t) => t.slice(0, 60)).join(' | '));
await page.screenshot({ path: `${SHOTS}/02-split-3-columns.png` });

console.log('\nresize');
const divider = page.locator('.surface:not([hidden]) .divider').first();
const widthOfLeftNeighbour = () =>
  divider.evaluate((el) => el.previousElementSibling.getBoundingClientRect().width);
const before = await widthOfLeftNeighbour();
const box = await divider.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(150);
const after = await widthOfLeftNeighbour();
ok('dragging a divider resizes its own column', after > before + 80, `${Math.round(before)} -> ${Math.round(after)}`);

const dragBox = await divider.boundingBox();
await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
await page.mouse.down();
await page.mouse.move(dragBox.x + 40, dragBox.y + dragBox.height / 2);
ok('pane contents become resize placeholders during drag',
  (await page.locator('.surface:not([hidden]) .resize-placeholder').count()) === afterSplit);
await page.mouse.up();
await page.waitForTimeout(60);
ok('terminal contents return after resize release',
  (await page.locator('.surface:not([hidden]) .resize-placeholder').count()) === 0);

await divider.focus();
ok('divider is focusable', await divider.evaluate((el) => el === document.activeElement));
ok('divider exposes separator semantics', await divider.evaluate((el) =>
  el.getAttribute('role') === 'separator' &&
  el.hasAttribute('aria-orientation') &&
  el.hasAttribute('aria-valuenow') &&
  el.hasAttribute('aria-label')));
const kbBefore = await widthOfLeftNeighbour();
for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(150);
const kbAfter = await widthOfLeftNeighbour();
ok('arrow keys resize the divider', kbAfter < kbBefore - 40, `${Math.round(kbBefore)} -> ${Math.round(kbAfter)}`);
await page.screenshot({ path: `${SHOTS}/03-after-resize.png` });

console.log('\none gutter size everywhere');
const gutters = await page.evaluate(() => {
  const R = (el) => el.getBoundingClientRect();
  const shell = document.querySelector('.shell');
  const rail = document.querySelector('.rail');
  const stage = document.querySelector('.stage');
  const sr = R(shell), rr = R(rail), gr = R(stage);
  const out = [];

  out.push({ what:'page-left',   px:+(rr.left - sr.left).toFixed(1) });
  out.push({ what:'page-top',    px:+(rr.top - sr.top).toFixed(1) });
  out.push({ what:'page-bottom', px:+(sr.bottom - rr.bottom).toFixed(1) });
  out.push({ what:'page-right',  px:+(sr.right - gr.right).toFixed(1) });

  out.push({ what:'rail-stage', px:+(gr.left - rr.right).toFixed(1) });

  const panes = [...document.querySelectorAll('.surface:not([hidden]) .pane')].map((p) => ({ p, r: R(p) }));
  for (let i = 0; i < panes.length; i++) {
    for (let j = 0; j < panes.length; j++) {
      if (i === j) continue;
      const a = panes[i].r, b = panes[j].r;
      const vOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      const hOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      if (b.left >= a.right - 0.5 && vOverlap > 20 && b.left - a.right < 40) {
        out.push({ what:'pane-cols', px:+(b.left - a.right).toFixed(1) });
      }
      if (b.top >= a.bottom - 0.5 && hOverlap > 20 && b.top - a.bottom < 40) {
        out.push({ what:'pane-rows', px:+(b.top - a.bottom).toFixed(1) });
      }
    }
  }

  const token = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
  return { token, out };
});
const kinds = new Set(gutters.out.map((g) => g.what));
ok('measured the page edge, the sidebar channel and both pane axes',
  ['page-left','page-top','page-bottom','page-right','rail-stage','pane-cols','pane-rows']
    .every((k) => kinds.has(k)), [...kinds].join(','));
const offToken = gutters.out.filter((g) => Math.abs(g.px - gutters.token) > 1);
ok('every visible gutter equals the spacing token',
  offToken.length === 0,
  `token=${gutters.token}; off: ` + offToken.map((g) => `${g.what}=${g.px}`).join(', '));
const distinct = [...new Set(gutters.out.map((g) => Math.round(g.px)))];
ok('there is exactly ONE gutter size on screen', distinct.length === 1,
  'sizes seen: ' + distinct.join(', '));
const railStage = gutters.out.find((g) => g.what === 'rail-stage');
const paneGap = gutters.out.find((g) => g.what === 'pane-cols');
ok('the sidebar sits as close to the stage as two panes sit to each other',
  Math.abs(railStage.px - paneGap.px) <= 1, `${railStage.px} vs ${paneGap.px}`);
ok('the resize handle fills its channel rather than widening it',
  await page.evaluate(() => {
    const g = document.querySelector('.rail-gutter');
    const token = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
    return Math.abs(g.getBoundingClientRect().width - token) <= 1;
  }));

console.log('\nminimums');
await page.setViewportSize({ width: 620, height: 460 });
await page.waitForTimeout(250);
const scrolls = await page.evaluate(() => {
  const v = document.querySelector('.surface:not([hidden]) .viewport');
  return { sw: v.scrollWidth, cw: v.clientWidth };
});
ok('narrow viewport overflows into a scroll instead of crushing panes', scrolls.sw > scrolls.cw, JSON.stringify(scrolls));
const minPaneW = await page.$$eval('.surface:not([hidden]) .pane', (p) => Math.min(...p.map((e) => e.getBoundingClientRect().width)));
ok('no pane rendered under the 260px minimum', minPaneW >= 259, String(Math.round(minPaneW)));
await page.screenshot({ path: `${SHOTS}/04-min-scroll.png` });
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(200);

console.log('\nsidebar');
const railW = () => page.locator('.rail').evaluate((el) => el.getBoundingClientRect().width);
const railBefore = await railW();
const rz = page.locator('.rail-gutter.resizable');
const rzBox = await rz.boundingBox();
await page.mouse.move(rzBox.x + rzBox.width / 2, rzBox.y + 200);
await page.mouse.down();
await page.mouse.move(rzBox.x + rzBox.width / 2 + 90, rzBox.y + 200, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(150);
const railAfter = await railW();
ok('dragging widens the sidebar', railAfter > railBefore + 50, `${Math.round(railBefore)} -> ${Math.round(railAfter)}`);

await rz.focus();
ok('rail resizer exposes separator semantics', await rz.evaluate((el) =>
  el.getAttribute('role') === 'separator' && el.hasAttribute('aria-valuenow') && el.hasAttribute('aria-label')));
for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(150);
const railKb = await railW();
ok('arrow keys resize the sidebar', railKb < railAfter - 40, `${Math.round(railAfter)} -> ${Math.round(railKb)}`);

ok('sidebar width persists into the config JSON', await page.evaluate(() => {
  const c = JSON.parse(localStorage.getItem('ttyd-workspace-v2'));
  return c && c.ui && Math.abs(c.ui.railWidth - document.querySelector('.rail').getBoundingClientRect().width) < 2;
}));

console.log('\ncollapsed rail: stable geometry');

const railGeom = () => page.evaluate(() => {
  const centre = (e) => {
    const r = e.getBoundingClientRect();
    return { cx:+(r.x + r.width / 2).toFixed(1), cy:+(r.y + r.height / 2).toFixed(1) };
  };
  const add = document.querySelector('.rail-list .ico.add');
  return {
    railWidth: document.querySelector('.rail').getBoundingClientRect().width,
    badges: [...document.querySelectorAll('.rail .folder-badge')].map(centre),
    add: add ? centre(add) : null,
    foot: [...document.querySelectorAll('.rail-foot .ico')]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .map((e) => ({ label:e.getAttribute('aria-label'), ...centre(e) })),
  };
});

const openGeom = await railGeom();
await page.locator('.rail-toggle[aria-label="Hide sidebar"]').click();
await page.waitForTimeout(360);
const shutGeom = await railGeom();

const badgeDrift = openGeom.badges.map((b, i) => {
  const c = shutGeom.badges[i];
  return c ? Math.max(Math.abs(b.cx - c.cx), Math.abs(b.cy - c.cy)) : 999;
});
ok('workspace icons do not move when the sidebar collapses',
  badgeDrift.every((d) => d <= 1), 'max drift ' + Math.max(...badgeDrift).toFixed(1) + 'px');

ok('the add-workspace button is the last row of the list, not a footer button',
  await page.evaluate(() => {
    const add = document.querySelector('.rail-list .ico.add');
    const rows = [...document.querySelectorAll('.rail-list .folder')];
    return !!add && !document.querySelector('.rail-foot .ico.add') && rows.length > 0 &&
           add.getBoundingClientRect().top >= rows[rows.length - 1].getBoundingClientRect().bottom - 1;
  }));
ok('the add button is centred below the workspace list',
  Math.abs(openGeom.add.cx - (8 + openGeom.railWidth / 2)) <= 2,
  `${openGeom.add.cx} vs ${8 + openGeom.railWidth / 2}`);
ok('the add button recentres when the sidebar collapses',
  !!shutGeom.add && Math.abs(shutGeom.add.cx - (8 + shutGeom.railWidth / 2)) <= 2,
  JSON.stringify([openGeom.add, shutGeom.add]));

const footLabels = openGeom.foot.map((f) => f.label).join(',');
ok('shortcuts, global settings, search and backup share a single footer row',
  openGeom.foot.length === 4 &&
  openGeom.foot.every((f) => Math.abs(f.cy - openGeom.foot[0].cy) <= 1) &&
  new Set(openGeom.foot.map((f) => f.cx)).size === 4,
  footLabels + ' @ ' + JSON.stringify(openGeom.foot.map((f) => [f.cx, f.cy])));
ok('there is no vertical footer stack', await page.evaluate(() => {
  const f = document.querySelector('.rail-foot');
  return !!f && getComputedStyle(f).flexDirection === 'row';
}));
ok('a collapsed rail hides the footer row entirely',
  shutGeom.foot.length === 0 &&
  (await page.evaluate(() => getComputedStyle(document.querySelector('.rail-foot')).display)) === 'none',
  shutGeom.foot.map((f) => f.label).join(',') || 'none painted');

const overlap = await page.evaluate(() => {
  const btn = document.querySelector('.rail-toggle[aria-label="Show sidebar"]');
  const term = document.querySelector('.surface:not([hidden]) .term');
  if (!btn || !term) return null;
  const b = btn.getBoundingClientRect(), t = term.getBoundingClientRect();
  return !(b.right <= t.left || b.left >= t.right || b.bottom <= t.top || b.top >= t.bottom);
});
ok('restore button does not cover terminal content', overlap === false, String(overlap));
ok('collapsed rail keeps the toggle and drops the wordmark', await page.evaluate(() => {
  const t = document.querySelector('.rail.collapsed .rail-toggle');
  const n = document.querySelector('.rail.collapsed .brand-name');
  return !!t && t.getBoundingClientRect().width > 0 && !n;
}));
ok('collapsed rail still lists every workspace',
  (await page.locator('.rail.collapsed .folder').count()) === 3);
const badges = await page.$$eval('.rail.collapsed .folder-badge', (n) =>
  n.map((e) => (e.querySelector('svg') ? 'icon:' + e.querySelector('svg').dataset.icon : 'text:' + e.textContent.trim())));
ok('each collapsed workspace shows an icon or its initials',
  badges.length === 3 && badges.every((b) => /^icon:\w+$/.test(b) || /^text:.{1,2}$/.test(b)), badges.join(', '));
await page.screenshot({ path: `${SHOTS}/10-collapsed-rail.png` });
await page.locator('.rail-toggle[aria-label="Show sidebar"]').click();
await page.waitForTimeout(360);

const preResize = await railGeom();
const rz2 = page.locator('.rail-gutter.resizable');
const rzb = await rz2.boundingBox();
await page.mouse.move(rzb.x + rzb.width / 2, rzb.y + 200);
await page.mouse.down();
await page.mouse.move(rzb.x + rzb.width / 2 + 70, rzb.y + 200, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(220);
const postResize = await railGeom();
const resizeDrift = preResize.badges.map((b, i) =>
  Math.max(Math.abs(b.cx - postResize.badges[i].cx), Math.abs(b.cy - postResize.badges[i].cy)));
ok('widening the sidebar does not move the icon column',
  resizeDrift.every((d) => d <= 1), 'max drift ' + Math.max(...resizeDrift).toFixed(1) + 'px');

await page.setViewportSize({ width: 600, height: 720 });
await page.waitForTimeout(340);
ok('sidebar auto-collapses on a narrow screen',
  (await page.locator('.rail.collapsed').count()) === 1);
await page.screenshot({ path: `${SHOTS}/11-narrow.png` });
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(340);

console.log('\ndialogs + routes');
ok('no global folder-settings button remains',
  (await page.locator('.rail-foot .ico[aria-label="Folder settings"]').count()) === 0);
await page.locator('.rail-global[aria-label="Global settings"]').click();
await page.waitForSelector('dialog[open] .global-settings');
ok('global settings use their own hash route and the same dialog presentation as folder settings',
  /#\/settings$/.test(page.url()) && (await page.locator('dialog[open] .dlg.global-settings').count()) === 1);
ok('global settings contain theme, font-size, and font-weight controls',
  (await page.locator('dialog[open] .global-settings .theme-opt').count()) === 9 &&
  (await page.locator('dialog[open] .global-settings .font-groups button').count()) === 6 &&
  (await page.locator('dialog[open] .global-settings .weight-groups button').count()) === 3);
await page.screenshot({ path: `${SHOTS}/18-global-settings.png` });
const fsBefore = await page.locator(LIVE_TERM).first().evaluate(e=>getComputedStyle(e).fontSize);
await page.locator('dialog[open] .global-settings .font-groups button', {hasText:'16'}).click();
const fsAfter = await page.locator(LIVE_TERM).first().evaluate(e=>getComputedStyle(e).fontSize);
ok('font-size grouped buttons apply immediately', fsBefore !== fsAfter && fsAfter === '16px', `${fsBefore} -> ${fsAfter}`);
await page.locator('dialog[open] .global-settings .font-groups button', {hasText:'13'}).click();
const fwBefore=await page.locator(LIVE_TERM).first().evaluate(e=>getComputedStyle(e).fontWeight);
await page.locator('dialog[open] .global-settings .weight-groups button',{hasText:'Semi bold'}).click();
const fwAfter=await page.locator(LIVE_TERM).first().evaluate(e=>getComputedStyle(e).fontWeight);
ok('font-weight buttons apply immediately',fwBefore!==fwAfter&&fwAfter==='600',`${fwBefore} -> ${fwAfter}`);
await page.locator('dialog[open] .global-settings .weight-groups button',{hasText:'Regular'}).click();
await page.locator('dialog[open] .global-settings button[aria-label="Close global settings"]').click();
await page.waitForTimeout(80);

const rowRest = await boxOf(page, '.folder.active .folder-name');
await page.locator('.folder.active').hover();
await page.waitForTimeout(220);
const rowHover = await boxOf(page, '.folder.active .folder-name');
ok('revealing row actions does not resize the workspace name', sameBox(rowRest, rowHover),
  JSON.stringify(rowRest) + ' -> ' + JSON.stringify(rowHover));
await page.screenshot({ path: `${SHOTS}/18-folder-row-hover.png` });

const folderMenuSel = '.folder.active .folder-act[aria-label^="Workspace menu"]';
ok('every workspace row carries one triple-dot menu',
  (await page.locator('.folder .folder-act[aria-label^="Workspace menu"]').count()) === 3);
await page.locator(folderMenuSel).focus();
await page.keyboard.press('Enter');
ok('workspace menu opens from its keyboard trigger',
  (await page.locator('.folder.active .folder-menu').count()) === 1);
await page.keyboard.press('Escape');
ok('Escape closes the workspace menu and returns to its trigger',
  (await page.locator('.folder.active .folder-menu').count()) === 0 && await page.evaluate(() => document.activeElement?.classList.contains('folder-act')));
await page.keyboard.press('Space');
const rowOpen = await boxOf(page, '.folder.active .folder-name');
ok('opening the overlaid workspace menu does not resize the workspace name', sameBox(rowRest, rowOpen),
  JSON.stringify(rowRest) + ' -> ' + JSON.stringify(rowOpen));
ok('workspace menu offers settings and close',
  (await page.locator('.folder.active .folder-menu [role="menuitem"]').count()) === 2);
await page.locator('.folder.active .folder-menu [role="menuitem"]', {hasText:'Settings'}).click();
await page.waitForSelector('dialog[open]');
ok('folder dialog is route-driven', /\/settings$/.test(page.url()), page.url());
await page.screenshot({ path: `${SHOTS}/05-folder-dialog.png` });

ok('folder settings offer no Save button', await page.evaluate(() =>
  ![...document.querySelectorAll('dialog[open] .btn')].some((b) => /^(Save|Cancel)$/.test(b.textContent.trim()))));
await page.fill('dialog[open] input[type=text]:not(.mono)', 'renamed-live');
await page.waitForTimeout(160);
ok('typing a folder name reaches the sidebar with no Save',
  (await page.locator('.folder.active .folder-name').textContent()) === 'renamed-live',
  await page.locator('.folder.active .folder-name').textContent());

const folderThemeOpts = await page.locator('dialog[open] .themes .theme-opt').count();
ok('folder settings offer all nine per-folder themes', folderThemeOpts === 9, folderThemeOpts + ' theme swatches');
const patternOpts = await page.locator('dialog[open] .pattern-chip').count();
ok('folder settings offer seven non-colour terminal identities', patternOpts === 7, patternOpts + ' patterns');
await page.locator('dialog[open] .pattern-chip[aria-label="Pattern waves"]').click();
await page.waitForTimeout(80);
ok('folder pattern applies immediately to terminals',
  (await page.locator(LIVE_TERM).first().getAttribute('class')).includes('pattern-waves'));
await page.screenshot({ path: `${SHOTS}/19-folder-pattern-live.png` });
await page.fill('dialog[open] input[type=text]:not(.mono)', 'kalviumjr');
await page.waitForTimeout(120);
await page.locator('dialog[open] .btn.primary').click();
await page.waitForTimeout(150);

console.log('\npane settings dialog');
const pane2 = page.locator('.surface:not([hidden]) .pane').nth(1);
await page.mouse.move(0, 0);
await page.waitForTimeout(200);
const psInkBefore = await inkOf(page, FIRSTLINE);
const psScrollBefore = await page.evaluate(() =>
  Math.round(document.querySelector('.surface:not([hidden]) .viewport').scrollLeft));

await pane2.hover();
await page.evaluate(() => {
  document.querySelectorAll('.surface:not([hidden]) .pane')[1]
    .querySelector('.pico[aria-label="Pane menu"]').click();
});
await page.waitForSelector('.panepop');
await page.evaluate(() => document.querySelector('.panepop .pico[aria-label="Pane settings"]').click());
await page.waitForSelector('.panesettings');
await page.locator('.panesettings').evaluate((el) =>
  Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))));
ok('pane settings keep their route', /\/pane\//.test(page.url()), page.url());
ok('pane settings use the standard modal dialog', (await page.locator('dialog[open] .panesettings').count()) === 1);

const psOpaque = await page.evaluate(() => {
  const ps = document.querySelector('.panesettings');
  const cs = getComputedStyle(ps);
  return { op: cs.opacity, bg: cs.backgroundColor, running: ps.getAnimations().filter((a) => a.playState === 'running').length };
});
ok('settled pane settings are fully opaque',
  psOpaque.op === '1' && /^rgb\(/.test(psOpaque.bg) && psOpaque.running === 0, JSON.stringify(psOpaque));

const psBox = await boxOf(page, '.panesettings');
ok('pane settings stay a compact form', psBox.w <= 440, JSON.stringify(psBox));

const psControls = await page.evaluate(() => ({
  text: document.querySelectorAll('.panesettings input[type=text]').length,
  check: document.querySelectorAll('.panesettings input[type=checkbox]').length,
  themes: document.querySelectorAll('.panesettings .themes .theme-opt').length,
  selects: document.querySelectorAll('.panesettings select').length,
}));
ok('pane settings hold exactly command + tmux',
  psControls.text === 1 && psControls.check === 1 && psControls.themes === 0 && psControls.selects === 0,
  JSON.stringify(psControls));
ok('pane settings offer no Save or Cancel', await page.evaluate(() =>
  !/(Save|Cancel)/.test(document.querySelector('.panesettings').textContent)));

const tmuxRow = await page.evaluate(() => {
  const box = document.querySelector('.panesettings input[type=checkbox]');
  const lab = box.closest('label');
  const cs = getComputedStyle(lab);
  const txt = [...lab.childNodes].find((n) => n.textContent.trim() && n !== box);
  const r = box.getBoundingClientRect();
  const t = txt ? (txt.nodeType === 1 ? txt.getBoundingClientRect() : null) : null;
  return {
    display: cs.display,
    transform: cs.textTransform,
    gap: t ? +(t.left - r.right).toFixed(1) : null,
    sameLine: t ? Math.abs((t.top + t.height / 2) - (r.top + r.height / 2)) < 6 : null,
    boxW: +r.width.toFixed(0),
  };
});
ok('the tmux control is a checkbox row, not a caption',
  tmuxRow.display === 'flex' && tmuxRow.transform === 'none', JSON.stringify(tmuxRow));
ok('its label clears the box and shares its line',
  tmuxRow.gap >= 4 && tmuxRow.sameLine === true, JSON.stringify(tmuxRow));
ok('the checkbox is not collapsed', tmuxRow.boxW >= 12, tmuxRow.boxW + 'px');

const psInkAfter = await inkOf(page, FIRSTLINE);
const psScrollAfter = await page.evaluate(() =>
  Math.round(document.querySelector('.surface:not([hidden]) .viewport').scrollLeft));
ok('opening pane settings does not move terminal text', sameBox(psInkBefore, psInkAfter),
  JSON.stringify(psInkBefore) + ' -> ' + JSON.stringify(psInkAfter));
ok('opening pane settings does not scroll the workspace', psScrollBefore === psScrollAfter,
  `${psScrollBefore} -> ${psScrollAfter}`);
ok('the command box is focused for typing', await page.evaluate(() =>
  document.activeElement?.classList.contains('ps-input')));

const unlabelled = await page.evaluate(() => {
  const out = [];
  const scope = ':is(.panesettings, dialog[open])';
  document.querySelectorAll(`${scope} input, ${scope} select, ${scope} textarea`).forEach((el) => {
    if (el.type === 'checkbox' && el.closest('label')) return;   // wrapped = implicitly labelled
    const byFor = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (!byFor && !el.closest('label') && !el.getAttribute('aria-label')) out.push(el.tagName + '#' + (el.id || '(no id)'));
  });
  return out;
});
ok('every settings control has an associated label', unlabelled.length === 0, unlabelled.join(', '));

await page.fill('.panesettings input[type=text]', 'htop');
await page.waitForTimeout(320);
const hasHtop = await page.locator(LIVE_TERM, { hasText: 'htop' }).count();
ok('pane command autosaves straight to the terminal', hasHtop > 0, String(hasHtop));

const persistBefore = await page.evaluate(() => document.querySelector('.panesettings input[type=checkbox]').checked);
await page.locator('.panesettings input[type=checkbox]').click();
await page.waitForTimeout(200);
const persistStored = await page.evaluate(() => {
  const c = JSON.parse(localStorage.getItem('ttyd-workspace-v2'));
  const flat = [];
  const walk = (n) => { if (!n) return; n.type === 'pane' ? flat.push(n) : n.children.forEach(walk); };
  c.folders.forEach((f) => walk(f.layout));
  return flat.find((p) => p.command === 'htop')?.persist;
});
ok('the tmux checkbox autosaves into the config', persistStored === !persistBefore,
  `${persistBefore} -> ${persistStored}`);

await page.screenshot({ path: `${SHOTS}/20-pane-settings.png` });
await page.locator('.panesettings .btn.primary').click();
await page.waitForTimeout(200);
ok('Done closes pane settings', (await page.locator('.panesettings').count()) === 0);

console.log('\nworkspace icon');
await page.locator('.folder.active').hover();
await page.locator('.folder.active .folder-act[aria-label^="Workspace menu"]').click();
await page.locator('.folder.active .folder-menu [role="menuitem"]', {hasText:'Settings'}).click();
await page.waitForSelector('dialog[open] .iconpick');
const iconCount = await page.locator('dialog[open] .iconpick button').count();
ok('icon picker offers a real set to choose from', iconCount >= 32, String(iconCount));
await page.locator('dialog[open] .iconpick button[aria-label="Icon rocket"]').click();
await page.waitForTimeout(180);
ok('chosen icon reaches the sidebar with no Save', await page.evaluate(() =>
  !!document.querySelector('.folder.active .folder-badge svg[data-icon="rocket"]')));
await page.screenshot({ path: `${SHOTS}/13-folder-icon.png` });
await page.locator('dialog[open] .btn.primary').click();
await page.waitForTimeout(200);

await page.locator('.ico[aria-label="Backup and restore"]').click();
await page.waitForSelector('dialog[open] textarea');
const backupText = await page.locator('dialog[open] textarea').inputValue();
let parsed = null;
try { parsed = JSON.parse(backupText); } catch {}
ok('backup dialog exposes valid round-trippable JSON', !!parsed && Array.isArray(parsed.folders), 'unparseable');
ok('opening backup does not stomp the hash', /#\/backup/.test(page.url()), page.url());
await page.screenshot({ path: `${SHOTS}/07-backup.png` });

await page.fill('dialog[open] textarea', '{"folders":[{"layout":{"type":"pane"}}]}');
await page.locator('dialog[open] .btn.primary').click();
await page.waitForTimeout(150);
const stillOpen = await page.locator('dialog[open]').count();
ok('invalid restore is rejected with an error', stillOpen === 1);
const errText = await page.locator('dialog[open] .hint.err').textContent().catch(() => '');
ok('restore error is explained', !!errText, errText || 'no message');
await page.locator('dialog[open] .btn', { hasText: 'Close' }).click();
await page.waitForTimeout(150);
ok('backup dialog closes', (await page.locator('dialog[open]').count()) === 0);

console.log('\nregression: dialogs reopen and reclose');
for (const pass of [1, 2]) {
  await page.locator('.ico[aria-label="Backup and restore"]').click();
  await page.waitForTimeout(180);
  ok(`backup opens on pass ${pass}`, (await page.locator('dialog[open]').count()) === 1);
  await page.locator('dialog[open] .btn', { hasText: 'Close' }).click();
  await page.waitForTimeout(180);
  ok(`backup closes on pass ${pass}`, (await page.locator('dialog[open]').count()) === 0);
}

await page.locator('.folder').nth(1).click();
await page.waitForTimeout(180);
const beforeDialogs = await page.locator('.folder.active .folder-name').textContent();
await page.locator('.ico[aria-label="Backup and restore"]').click();
await page.waitForTimeout(180);
const duringBackup = await page.locator('.folder.active .folder-name').textContent();
ok('active folder survives behind #/backup', duringBackup === beforeDialogs, `${beforeDialogs} -> ${duringBackup}`);
await page.locator('dialog[open] .btn', { hasText: 'Close' }).click();
await page.waitForTimeout(180);
ok('closing backup returns to the same folder',
  (await page.locator('.folder.active .folder-name').textContent()) === beforeDialogs);

const folderCountBefore = await page.locator('.folder').count();
await page.locator('.ico[aria-label="New folder"]').click();
await page.waitForSelector('dialog[open]');
ok('new-folder route is not stomped', /#\/new/.test(page.url()), page.url());
const duringNew = await page.locator('.folder.active .folder-name').textContent();
ok('active folder survives behind #/new', duringNew === beforeDialogs, `${beforeDialogs} -> ${duringNew}`);
await page.locator('dialog[open] .btn', { hasText: 'Cancel' }).click();
await page.waitForTimeout(180);
ok('new-folder dialog closes on cancel', (await page.locator('dialog[open]').count()) === 0);
ok('cancel created no folder', (await page.locator('.folder').count()) === folderCountBefore);
ok('cancel kept the active folder',
  (await page.locator('.folder.active .folder-name').textContent()) === beforeDialogs);

await page.locator('.folder').first().click();
await page.waitForTimeout(180);

console.log('\ncommand palette');
await page.keyboard.press('Control+k');
await page.waitForSelector('dialog[open] .pal-input');
ok('palette opens on its own route', /#\/palette/.test(page.url()), page.url());
await page.fill('dialog[open] .pal-input', 'journal');
await page.waitForTimeout(150);
const palTitles = await page.$$eval('dialog[open] .pal-row .pal-title', (n) => n.map((e) => e.textContent));
ok('palette searches pane commands across workspaces',
  palTitles.some((t) => t.includes('journalctl')), palTitles.join(' | '));
await page.screenshot({ path: `${SHOTS}/14-palette.png` });
await page.keyboard.press('Enter');
await page.waitForTimeout(320);
ok('palette closes on pick', (await page.locator('dialog[open]').count()) === 0);
ok('picking a terminal switches workspace', /#\/f\/f-infra/.test(page.url()), page.url());
const focusedCmd = await page.locator('.surface:not([hidden]) .pane.focused .term').textContent();
ok('picked terminal is the focused one', /journalctl/.test(focusedCmd), focusedCmd.slice(0, 60));
ok('picked terminal holds DOM focus', await page.evaluate(() =>
  document.activeElement?.classList.contains('pane')));

await page.locator('.folder').first().click();
await page.waitForTimeout(180);

console.log('\ncontrast (WCAG AA)');
const audit = await page.evaluate(() => window.__contrastAudit());
const themeCount = new Set(audit.map((r) => r.theme)).size;
ok('every built-in theme is audited', themeCount === 9, themeCount + ' themes');
ok('audit covers every text-bearing colour per theme', audit.length >= 60, audit.length + ' pairs');

const textFails = audit.filter((r) => r.kind === 'text' && r.ratio < r.min);
ok('every theme colour that carries text clears AA (4.5:1)', textFails.length === 0,
  textFails.map((f) => `${f.theme}.${f.key}=${f.ratio}`).join(', '));
const uiFails = audit.filter((r) => r.kind === 'ui' && r.ratio < r.min);
ok('every focus ring clears the 3:1 non-text minimum', uiFails.length === 0,
  uiFails.map((f) => `${f.theme}.${f.key}=${f.ratio}`).join(', '));
const dimWorst = Math.min(...audit.filter((r) => r.key === 'dim').map((r) => r.ratio));
ok('the dimmest text in any theme still clears AA', dimWorst >= 4.5, 'worst dim = ' + dimWorst);

const rendered = await page.evaluate(() => {
  const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
  const lum = (rgb) => { const [r,g,b] = rgb.slice(0,3).map(lin); return 0.2126*r + 0.7152*g + 0.0722*b; };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi,lo] = l1>l2?[l1,l2]:[l2,l1]; return (hi+0.05)/(lo+0.05); };


  const effectiveBg = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c.length >= 3 && (c.length < 4 || c[3] > 0)) return c.slice(0, 3);
    }
    return [255, 255, 255];
  };

  const out = [];
  const term = document.querySelector('.surface:not([hidden]) .term');
  const bg = effectiveBg(term);
  term.querySelectorAll('span').forEach((s) => {
    const txt = s.textContent.trim();
    if (!txt) return;
    out.push({ txt: txt.slice(0, 16), r: +ratio(parse(getComputedStyle(s).color), bg).toFixed(2) });
  });
  document.querySelectorAll('.folder-name').forEach((n) => {
    out.push({ txt: 'rail:' + n.textContent.trim().slice(0, 10),
               r: +ratio(parse(getComputedStyle(n).color), effectiveBg(n)).toFixed(2) });
  });
  document.querySelectorAll('.rail .ico').forEach((b) => {
    out.push({ txt: 'ico:' + b.getAttribute('aria-label'), min: 3,
               r: +ratio(parse(getComputedStyle(b).color), effectiveBg(b)).toFixed(2) });
  });
  return out;
});
const renderedFails = rendered.filter((r) => r.r < (r.min ?? 4.5));
ok('every painted glyph clears its minimum', renderedFails.length === 0,
  renderedFails.slice(0, 5).map((f) => `"${f.txt}"=${f.r}`).join(', '));
ok('rendered audit inspected real text', rendered.length > 20, rendered.length + ' spans');

console.log('\nper-workspace terminal themes');
const railLook = () => page.evaluate(() => {
  const g = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : null; };
  return {
    panel:    g('.rail', 'backgroundColor'),
    activeFg: g('.folder.active .folder-name', 'color'),
    activeBg: g('.folder.active', 'backgroundColor'),
    restFg:   g('.folder:not(.active) .folder-name', 'color'),
    marker:   getComputedStyle(document.querySelector('.folder.active'), '::before').backgroundColor,
    icoFg:    g('.rail .ico', 'color'),
  };
});
const railNight = await railLook();
const stageNight = await page.locator('.shell').evaluate((el) => getComputedStyle(el).backgroundColor);

await page.locator('.folder').nth(2).click();   // notes = paper (light)
await page.waitForTimeout(260);
const railPaper = await railLook();
const stagePaper = await page.locator('.shell').evaluate((el) => getComputedStyle(el).backgroundColor);

const railDiff = Object.keys(railNight).filter((k) => railNight[k] !== railPaper[k]);
ok('the sidebar repaints from the active workspace theme', railDiff.length >= 4,
  railDiff.map((k) => `${k}: ${railNight[k]} vs ${railPaper[k]}`).join(' | '));
ok('the stage repaints from the active workspace theme', stageNight !== stagePaper,
  `${stageNight} vs ${stagePaper}`);
const paperRing = await page.locator('.surface:not([hidden]) .pane').first()
  .evaluate((el) => getComputedStyle(el).getPropertyValue('--t-ring').trim());
await page.locator('.folder').first().click();
await page.waitForTimeout(260);
const nightRing = await page.locator('.surface:not([hidden]) .pane').first()
  .evaluate((el) => getComputedStyle(el).getPropertyValue('--t-ring').trim());
ok('pane border colour follows each workspace theme', nightRing !== paperRing && !!nightRing && !!paperRing,
  `${nightRing} vs ${paperRing}`);
await page.screenshot({ path: `${SHOTS}/15-per-workspace-theme.png` });

console.log('\ninstant workspace switch');
const surfaceAnim = await page.locator('.surface:not([hidden])').evaluate((el) => {
  const cs = getComputedStyle(el);
  return { anim: cs.animationName, trans: cs.transitionProperty, dur: cs.transitionDuration };
});
ok('the active surface has no entrance animation', surfaceAnim.anim === 'none', surfaceAnim.anim);
ok('the active surface has no transition', /none/.test(surfaceAnim.trans) || surfaceAnim.dur === '0s',
  JSON.stringify(surfaceAnim));
const shellTrans = await page.locator('.shell').evaluate((el) => getComputedStyle(el).transitionDuration);
ok('the shell background does not cross-fade', shellTrans === '0s', shellTrans);
const rowTrans = await page.locator('.folder.active').evaluate((el) => getComputedStyle(el).transitionDuration);
ok('the selected workspace row does not cross-fade', rowTrans === '0s', rowTrans);

const hiddenStyle = await page.locator('.surface[hidden]').first().evaluate((el) => {
  const cs = getComputedStyle(el);
  return { display: cs.display, visibility: cs.visibility };
});
ok('inactive surfaces keep their box (never display:none)',
  hiddenStyle.display !== 'none' && hiddenStyle.visibility === 'hidden', JSON.stringify(hiddenStyle));

await page.evaluate(() => {
  window.__sawSkeleton = false;
  const target = document.querySelectorAll('.folder-main')[1];
  const current = document.querySelector('.surface:not([hidden])');
  const root = document.documentElement;
  delete root.dataset.switchStarted;
  delete root.dataset.switchFinished;
  target?.addEventListener('click', () => { root.dataset.switchStarted = String(performance.now()); }, { capture:true, once:true });
  const observer = new MutationObserver(() => {
    if (document.querySelector('.surface:not([hidden])') !== current && root.dataset.switchStarted) {
      root.dataset.switchFinished = String(performance.now());
      observer.disconnect();
    }
  });
  const stage = document.querySelector('.stage');
  if (stage) observer.observe(stage, { attributes:true, subtree:true, attributeFilter:['hidden'] });
});
await page.locator('.folder').nth(1).click();
await page.waitForSelector('.surface:not([hidden]) .term[data-ready="1"]', { timeout: 3000 });
const switchMs = await page.evaluate(() =>
  Number(document.documentElement.dataset.switchFinished) - Number(document.documentElement.dataset.switchStarted));
const replayed = await page.evaluate(() =>
  [...document.querySelectorAll('.surface:not([hidden]) .pane')]
    .flatMap((p) => p.getAnimations({ subtree: true }))
    .filter((a) => ['pane-in','shimmer'].includes(a.animationName) && a.playState === 'running' && (a.currentTime ?? 0) < 120)
    .map((a) => a.animationName || 'anim'));
ok('switching replays no animation on the arriving panes', replayed.length === 0, replayed.join(', '));
ok('switching does not replay the boot skeleton',
  (await page.evaluate(() => window.__sawSkeleton)) === false);
ok('the target surface is on screen in the switching render', Number.isFinite(switchMs) && switchMs < 100, switchMs + 'ms');
ok('the previous folder is still mounted behind it',
  (await page.locator('.pane').count()) > (await page.locator('.surface:not([hidden]) .pane').count()));

const backReplayed = await (async () => {
  await page.locator('.folder').first().click();
  return page.evaluate(() =>
    [...document.querySelectorAll('.surface:not([hidden]) .pane')]
      .flatMap((p) => p.getAnimations({ subtree: true }))
      .filter((a) => ['pane-in','shimmer'].includes(a.animationName) && a.playState === 'running' && (a.currentTime ?? 0) < 120)
      .map((a) => a.animationName || 'anim'));
})();
ok('switching back replays nothing either', backReplayed.length === 0, backReplayed.join(', '));
await page.waitForTimeout(200);

console.log('\npersistence');
const beforeReload = await page.locator(LIVE_PANE).count();
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector(LIVE_PANE);
const afterReload = await page.locator('.surface:not([hidden]) .pane').count();
ok('layout survives reload via localStorage', afterReload === beforeReload, `${beforeReload} -> ${afterReload}`);

const second = page.locator('.folder').nth(1);
await second.click();
await page.waitForTimeout(200);
ok('switching folder updates the hash', /#\/f\/f-infra/.test(page.url()), page.url());
const infraPanes = await page.locator('.surface:not([hidden]) .pane').count();
ok('second folder renders its own panes', infraPanes === 2, String(infraPanes));
await page.screenshot({ path: `${SHOTS}/08-second-folder.png` });

await page.goto('about:blank');
await page.goto(BASE + '#/f/f-notes', { waitUntil: 'networkidle' });
await page.waitForSelector(LIVE_TERM);
const notesTheme = await page.locator(LIVE_TERM).first().evaluate((e) => getComputedStyle(e).backgroundColor);
ok('deep link preserves the folder theme', notesTheme === 'rgb(251, 250, 246)', notesTheme);
await page.screenshot({ path: `${SHOTS}/09-deeplink-paper.png` });

console.log('\nstatic documentation + demo banner');
const demoContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const demo = await demoContext.newPage();

await demo.route('**/token', (route) => route.fulfill({ status:200, contentType:'application/json', body:'{}' }));
const demoErrors = [];
demo.on('console', (m) => { if (m.type() === 'error') demoErrors.push(m.text()); });
demo.on('pageerror', (e) => demoErrors.push(String(e)));
await demo.goto(RAW_BASE, { waitUntil: 'networkidle' });
await demo.evaluate(() => localStorage.clear());
await demo.goto(RAW_BASE, { waitUntil: 'networkidle' });
await demo.waitForSelector('.setup-notice');
await demo.waitForSelector('.surface:not([hidden]) .doc-term[data-doc="readme"]');
ok('static documentation has no console/page errors', demoErrors.length === 0, demoErrors.join(' | '));

const docNames = await demo.$$eval('.folder-name', (nodes) => nodes.map((node) => node.textContent));
ok('documentation has the seven requested pages in reading order',
  docNames.join('|') === 'README|Using it|Keyboard|Themes|Customizations|Security|Contributing', docNames.join('|'));
ok('Installation and Setup are replaced by Using it', !docNames.includes('Installation') && !docNames.includes('Setup') && docNames.includes('Using it'));
const docPatterns = await demo.$$eval('.doc-term', (terms) => terms.map((term) =>
  [...term.classList].find((name) => name.startsWith('pattern-'))));
ok('every documentation page has a distinct background pattern',
  new Set(docPatterns).size === 7, docPatterns.join(','));
ok('Keyboard page has a pictogram rather than initials', await demo.evaluate(() => {
  const row = [...document.querySelectorAll('.folder')].find((folder) => folder.querySelector('.folder-name')?.textContent === 'Keyboard');
  return !!row?.querySelector('.folder-badge svg[data-icon="keyboard"]');
}));

const lead = await demo.locator('.surface:not([hidden]) .doc-lead').textContent();
ok('README opens with the exact plain statement', lead ===
  'ttydterm puts a terminal workspace in your browser. ttyd serves one custom index.html file with the full interface.', lead);
const docTypography = await demo.evaluate(() => {
  const term = document.querySelector('.surface:not([hidden]) .doc-term');
  const body = term?.querySelector('.doc-body');
  const lead = term?.querySelector('.doc-lead');
  const command = term?.querySelector('.doc-command code');
  if (!term || !body || !lead || !command) return null;
  const termStyle = getComputedStyle(term), bodyStyle = getComputedStyle(body), leadStyle = getComputedStyle(lead), commandStyle = getComputedStyle(command);
  return {
    termFamily:termStyle.fontFamily, bodyFamily:bodyStyle.fontFamily,
    termSize:termStyle.fontSize, bodySize:bodyStyle.fontSize,
    leadBackground:leadStyle.backgroundColor, commandBackground:commandStyle.backgroundColor,
    leadRadius:leadStyle.borderRadius, commandShadow:commandStyle.boxShadow,
  };
});
ok('documentation renders as plain monospace terminal file output', !!docTypography &&
  docTypography.bodyFamily === docTypography.termFamily && docTypography.bodySize === docTypography.termSize &&
  docTypography.leadBackground === 'rgba(0, 0, 0, 0)' && docTypography.commandBackground === 'rgba(0, 0, 0, 0)' &&
  docTypography.leadRadius === '0px' && docTypography.commandShadow === 'none', JSON.stringify(docTypography));
ok('README link and MIT license are separate readable content', await demo.evaluate(() => {
  const body = document.querySelector('.surface:not([hidden]) .doc-body');
  const link = body?.querySelector('a[href="https://github.com/anilgulecha/ttydterm"]');
  return !!link && link.textContent === 'https://github.com/anilgulecha/ttydterm' && body?.textContent.includes('(MIT licensed)');
}));
ok('README sends the reader to Using it', (await demo.locator('.surface:not([hidden]) .doc-body').textContent()).includes('Open Using it'));

const bannerCommand = (await demo.locator('.setup-notice code').textContent()) || '';
ok('one authenticated loopback command carries the required ttyd flags',
  bannerCommand.startsWith('ttyd ') && bannerCommand.includes('-i 127.0.0.1') && bannerCommand.includes('-p 7681') &&
  bannerCommand.includes(' -W ') && bannerCommand.includes(' -O ') && bannerCommand.includes('-c user:password') &&
  bannerCommand.includes('-I "$HOME/ttydterm.html"') && bannerCommand.includes('-t cursorBlink=false') && bannerCommand.endsWith('bash -l'));
ok('canonical launch command stays direct and blocks URL child arguments',
  !bannerCommand.includes('bash -c') && !bannerCommand.includes(' -a '));
ok('README renders the exact banner launch command',
  (await demo.locator('.surface:not([hidden]) .doc-command code').first().textContent()) === bannerCommand);

await demo.locator('.folder', { hasText: 'Using it' }).click();
const usingText = await demo.locator('.surface:not([hidden]) .doc-body').textContent();
ok('Using it includes four scoped package managers, download, localhost auth and tmux limits',
  ['brew install ttyd tmux','sudo apt install ttyd tmux','sudo dnf install ttyd tmux','sudo pacman -S ttyd tmux',
   'curl -fL https://raw.githubusercontent.com/anilgulecha/ttydterm/main/index.html','http://localhost:7681',
   'Replace user:password with credentials you choose','while the tmux server and session run'].every((text) => usingText.includes(text)));

await demo.locator('.folder', { hasText: 'Keyboard' }).click();
await demo.waitForSelector('.surface:not([hidden]) .doc-term[data-doc="keyboard"]');
const keyboardText = await demo.locator('.surface:not([hidden]) .doc-body').textContent();
ok('Keyboard page points to the sidebar-footer keyboard icon',
  keyboardText.includes('keyboard icon in the sidebar footer') && keyboardText.includes('collapsed sidebar'));

await demo.locator('.folder', { hasText: 'Customizations' }).click();
await demo.waitForSelector('.surface:not([hidden]) .doc-term[data-doc="customizations"]');
await demo.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const customPanes = demo.locator('.surface:not([hidden]) .pane');
ok('Customizations demonstrates one left pane plus a stacked right pair',
  await customPanes.count() === 3 && await demo.evaluate(() => {
    const surface = document.querySelector('.surface:not([hidden])');
    const outer = surface?.querySelector('.canvas > .split.columns');
    if (!outer) return false;
    const slots = [...outer.children].filter((node) => node.classList?.contains('slot'));
    const nested = slots[1]?.querySelector(':scope > .split.rows');
    if (!nested) return false;
    const rows = [...nested.children].filter((node) => node.classList?.contains('slot'));
    if (slots.length !== 2 || rows.length !== 2) return false;
    const widths = slots.map((node) => node.getBoundingClientRect().width);
    const heights = rows.map((node) => node.getBoundingClientRect().height);
    return Math.abs(widths[0] - widths[1]) <= 2 && Math.abs(heights[0] - heights[1]) <= 2;
  }));
const customText = await customPanes.allTextContents();
ok('Customizations explains right-click splits and per-pane command/tmux settings',
  customText.some((text) => text.includes('Right-click a pane')) &&
  customText.some((text) => text.includes('own command')) && customText.some((text) => text.includes('own tmux setting')));
await demo.screenshot({ path: `${SHOTS}/30-customizations-doc.png` });

await demo.locator('.folder', { hasText: 'Themes' }).click();
await demo.waitForSelector('.surface:not([hidden]) .doc-themes .theme-opt');
ok('Themes opens on the first built-in theme', await demo.evaluate(() =>
  document.querySelector('.surface:not([hidden]) .theme-opt[aria-checked="true"]')?.getAttribute('aria-label') === 'Theme night'));
const themeBefore = await demo.locator('.shell').evaluate((el) => getComputedStyle(el).backgroundColor);
await demo.locator('.surface:not([hidden]) .theme-opt[aria-label="Theme paper"]').click();
const themeAfter = await demo.locator('.shell').evaluate((el) => getComputedStyle(el).backgroundColor);
ok('theme choice immediately repaints this documentation workspace', themeBefore !== themeAfter, `${themeBefore} -> ${themeAfter}`);
ok('documentation theme interaction never creates a saved real-workspace config',
  await demo.evaluate(() => localStorage.getItem('ttyd-workspace-v2') === null));
await demo.locator('.folder', { hasText: 'README' }).click();
await demo.waitForSelector('.surface:not([hidden]) .doc-term[data-doc="readme"]');
await demo.locator('.folder', { hasText: 'Themes' }).click();
await demo.waitForSelector('.surface:not([hidden]) .doc-term[data-doc="themes"]');
ok('Themes workspace remembers its own live choice while mounted', await demo.evaluate(() =>
  document.querySelector('.surface:not([hidden]) .theme-opt[aria-checked="true"]')?.getAttribute('aria-label') === 'Theme paper'));

const bannerContrast = [];
for (const option of await demo.locator('.surface:not([hidden]) .theme-opt').all()) {
  const label = await option.getAttribute('aria-label');
  await option.click();
  await demo.waitForFunction((expected) =>
    document.querySelector('.surface:not([hidden]) .theme-opt[aria-checked="true"]')?.getAttribute('aria-label') === expected, label);
  await demo.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  bannerContrast.push(await demo.evaluate(() => {
    const parse = (value) => (value.match(/[\d.]+/g) || []).map(Number).slice(0, 3);
    const lin = (c) => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
    const lum = (rgb) => { const [r,g,b] = rgb.map(lin); return .2126*r + .7152*g + .0722*b; };
    const ratio = (a,b) => { const [hi,lo] = lum(a)>lum(b)?[lum(a),lum(b)]:[lum(b),lum(a)]; return (hi+.05)/(lo+.05); };
    const notice = document.querySelector('.setup-notice');
    const button = notice?.querySelector('button');
    const message = notice?.querySelector(':scope > span');
    if (!notice || !button || !message) return { text:0, focus:0, message:0 };
    button.focus({ focusVisible:true });
    const buttonStyle = getComputedStyle(button), noticeStyle = getComputedStyle(notice);
    return {
      text: ratio(parse(buttonStyle.color), parse(buttonStyle.backgroundColor)),
      focus: ratio(parse(buttonStyle.outlineColor), parse(noticeStyle.backgroundColor)),
      message: ratio(parse(getComputedStyle(message).color), parse(noticeStyle.backgroundColor)),
    };
  }));
}
ok('demo banner text, buttons, and focus colors clear their minimums in every theme',
  bannerContrast.every(({text,focus,message}) => text >= 4.5 && focus >= 3 && message >= 4.5), JSON.stringify(bannerContrast));
await demo.screenshot({ path: `${SHOTS}/31-themes-live-doc.png` });
await demo.locator('.folder', { hasText: 'README' }).click();
await demo.waitForSelector('.surface:not([hidden]) .doc-term[data-doc="readme"]');
await demo.screenshot({ path: `${SHOTS}/32-readme-demo-banner.png` });

await demo.locator('.folder', { hasText: 'Security' }).click();
await demo.waitForSelector('.surface:not([hidden]) .doc-term[data-doc="security"]');
const securityDoc = demo.locator('.surface:not([hidden]) .doc-term[data-doc="security"]');
ok('long documentation is a labelled keyboard-scrollable region', await securityDoc.evaluate((element) =>
  element.tabIndex === 0 && element.getAttribute('role') === 'region' && !!element.getAttribute('aria-label') && element.scrollHeight > element.clientHeight));

await demo.waitForTimeout(50);
await securityDoc.evaluate((element) => { element.scrollTop = 0; });
await securityDoc.focus();
ok('the documentation scroll region accepts keyboard focus', await securityDoc.evaluate((element) => document.activeElement === element));
await demo.keyboard.press('End');
await demo.waitForFunction(() => {
  const element = document.querySelector('.surface:not([hidden]) .doc-term[data-doc="security"]');
  return !!element && Math.abs(element.scrollTop - (element.scrollHeight - element.clientHeight)) < 2;
});
ok('keyboard users can scroll long documentation to its end', await securityDoc.evaluate((element) =>
  Math.abs(element.scrollTop - (element.scrollHeight - element.clientHeight)) < 2));
ok('the demo banner does not cover the last documentation line at maximum scroll', await demo.evaluate(() => {
  const doc = document.querySelector('.surface:not([hidden]) .doc-term[data-doc="security"]');
  const banner = document.querySelector('.setup-notice');
  if (!doc || !banner) return false;
  doc.scrollTop = doc.scrollHeight;
  const prompt = doc.querySelector('.term-body > .term-row:last-child');
  return !!prompt && prompt.getBoundingClientRect().bottom <= banner.getBoundingClientRect().top;
}));
const securityText = await demo.locator('.surface:not([hidden]) .doc-body').textContent();
ok('Security explains origin checks, authentication, trusted shell input, TLS, and tmux continuity',
  ['rejects a WebSocket request','Basic Auth checks a username and password','every command from a restored configuration',
   'add TLS','tmux keeps a process alive'].every((text) => securityText.includes(text)));
await demo.locator('.folder', { hasText: 'Contributing' }).click();
await demo.waitForSelector('.surface:not([hidden]) .doc-term[data-doc="contributing"]');
const contributingText = await demo.locator('.surface:not([hidden]) .doc-body').textContent();
ok('Contributing sends changes through issues with a reason and implementation prompt',
  contributingText.includes('accepts issues instead of pull requests') && contributingText.includes('what should change and why') &&
  contributingText.includes('implementation prompt') && contributingText.includes('when time allows'));

await demo.setViewportSize({ width:600, height:720 });
await demo.goto(RAW_BASE + '#/f/doc-using', { waitUntil:'networkidle' });
await demo.waitForSelector('.surface:not([hidden]) .doc-term[data-doc="using"]');
ok('the stacked narrow demo banner leaves the final documentation line unobscured', await demo.evaluate(() => {
  const doc = document.querySelector('.surface:not([hidden]) .doc-term[data-doc="using"]');
  const banner = document.querySelector('.setup-notice');
  if (!doc || !banner) return false;
  doc.scrollTop = doc.scrollHeight;
  const prompt = doc.querySelector('.term-body > .term-row:last-child');
  return !!prompt && prompt.getBoundingClientRect().bottom <= banner.getBoundingClientRect().top;
}));

const savedContext = await browser.newContext();
const saved = await savedContext.newPage();
await saved.route('**/token', (route) => route.fulfill({ status:200, contentType:'application/json', body:'{}' }));
await saved.goto(RAW_BASE, { waitUntil: 'networkidle' });
const savedConfig = {version:6,ui:{railWidth:176,railOpen:true,fontSize:13,fontWeight:'regular'},folders:[{
  id:'saved-real',name:'saved-real',cwd:'~',theme:'forest',icon:null,pattern:'dots',
  layout:{type:'pane',id:'saved-pane',command:'echo kept',persist:false}
}]};
await saved.evaluate((config) => localStorage.setItem('ttyd-workspace-v2', JSON.stringify(config)), savedConfig);
await saved.reload({ waitUntil: 'networkidle' });
await saved.waitForSelector('.folder-name');
ok('static hosting does not replace a saved real-workspace configuration',
  await saved.locator('.folder-name').textContent() === 'saved-real' &&
  await saved.evaluate(() => JSON.parse(localStorage.getItem('ttyd-workspace-v2')).folders[0].id === 'saved-real'));
await savedContext.close();
await demoContext.close();

const transitionContext = await browser.newContext();
await transitionContext.addInitScript((config) =>
  localStorage.setItem('ttyd-workspace-v2', JSON.stringify(config)), savedConfig);
const transitionPage = await transitionContext.newPage();
const transitionMessages = [];
transitionPage.on('console', (message) => transitionMessages.push(message.text()));
transitionPage.on('pageerror', (error) => transitionMessages.push(String(error)));
await transitionPage.route('**/token', (route) => route.fulfill({
  status:200, contentType:'application/json', body:JSON.stringify({token:'test-token'}),
}));
await transitionPage.goto(RAW_BASE, { waitUntil:'domcontentloaded' });
await transitionPage.waitForSelector('.surface:not([hidden]) .xterm-term');
ok('probing to real ttyd changes renderer without violating React hook order',
  !transitionMessages.some((message) => /Rendered (fewer|more) hooks|order of Hooks/i.test(message)),
  transitionMessages.filter((message) => /hook/i.test(message)).join(' | '));
await transitionContext.close();

console.log('\nreduced motion');
const rmPage = await browser.newPage({ viewport: { width: 1200, height: 800 }, reducedMotion: 'reduce' });
await rmPage.goto(BASE, { waitUntil: 'networkidle' });
await rmPage.waitForSelector(LIVE_TERM, { timeout: 15000 });
ok('reduced motion skips the skeleton', (await rmPage.locator('.term.skeleton').count()) === 0);
const rmAnim = await rmPage.locator('.surface:not([hidden]) .pane').first()
  .evaluate((el) => getComputedStyle(el).animationName);
ok('reduced motion disables pane entrance animation', rmAnim === 'none', rmAnim);
await rmPage.close();

console.log('\nerrors seen: ' + (errors.length ? errors.join(' | ') : 'none'));
await browser.close();

console.log(`\n${failures ? 'FAILED ' + failures + ' assertion(s)' : 'all assertions passed'}`);
console.log(`screenshots -> ${SHOTS}`);
process.exit(failures ? 1 : 0);
