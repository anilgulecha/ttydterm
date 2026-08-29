/**
 * Smoke test for the ttyd-workspace design pass.
 *
 * Loads the single-file prototype in headless chromium, asserts the workspace
 * shell renders (folders, split tree, mock terminals), exercises split / resize /
 * dialogs / persistence, and writes screenshots to /tmp/ttyd-shots for review.
 *
 * Run:  node prototypes/ttyd-workspace/test.mjs
 * (playwright is installed GLOBALLY — see prototypes/AGENTS.md rule 2)
 */
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const gRoot = execSync('npm root -g').toString().trim();
const { chromium } = await import(`${gRoot}/playwright/index.mjs`);

const RAW_BASE = process.env.BASE ?? 'http://127.0.0.1:8791/ttyd-workspace/';
const BASE = RAW_BASE + (RAW_BASE.includes('?') ? '&mock=1' : '?mock=1');
const SHOTS = '/tmp/ttyd-shots';
mkdirSync(SHOTS, { recursive: true });

let failures = 0;
const ok = (label, cond, extra = '') => {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.log(`  FAIL ${label}${extra ? ' — ' + extra : ''}`); }
};

// Inactive folders stay mounted but hidden, so a bare `.pane` can resolve to an
// invisible node. Always wait on a pane inside the VISIBLE surface.
const LIVE_PANE = '.surface:not([hidden]) .pane';

// Geometry helpers. Several assertions below are of the form "this interaction
// changed NOTHING about where the text sits" — the only way to state that is to
// measure the same boxes before and after and compare them exactly.
const boxOf = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x:+r.x.toFixed(2), y:+r.y.toFixed(2), w:+r.width.toFixed(2), h:+r.height.toFixed(2) };
}, sel);

// The INKED extent of the terminal's text, not its padded box: a padding change
// moves the glyphs while the container's rect stays put, and it is the glyphs
// the user watches.
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
// A terminal boots through a skeleton placeholder, so "a pane exists" is not
// "its content is on screen". Assertions about output must wait for the swap.
const LIVE_TERM = '.surface:not([hidden]) .term[data-ready="1"]';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

// Record whether a skeleton was EVER in the DOM. Polling for it after load is a
// race we would lose; an observer installed before the document runs cannot be.
// Observe `document`, not `document.documentElement` — at document-start the
// latter is still null and `observe` throws.
await page.addInitScript(() => {
  window.__sawSkeleton = false;
  new MutationObserver(() => {
    if (document.querySelector('.term.skeleton')) window.__sawSkeleton = true;
  }).observe(document, { childList: true, subtree: true });
});

console.log('\nttyd-workspace smoke test');

// ---------------------------------------------------------------- boot
// Start from a clean slate: the app persists to localStorage, so without this
// a second run would assert against the FIRST run's mutated config.
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector(LIVE_TERM, { timeout: 15000 });

console.log('\nboot');
ok('no console/page errors', errors.length === 0, errors.join(' | '));
ok('hash route settled on a folder', /#\/f\//.test(page.url()), page.url());

const folderNames = await page.$$eval('.folder-name', (n) => n.map((e) => e.textContent));
ok('sidebar lists 3 seeded folders', folderNames.length === 3, folderNames.join(','));

// every configured pane is mounted at once
const paneCount = await page.locator('.surface:not([hidden]) .pane').count();
ok('active folder mounted all 3 panes', paneCount === 3, String(paneCount));

// all folders stay mounted (terminals never torn down on tab switch)
const totalPanes = await page.locator('.pane').count();
ok('every folder stays mounted (6 panes total)', totalPanes === 6, String(totalPanes));

// a refresh shows placeholders that become content — never a blank pane
ok('terminals boot through a skeleton placeholder', await page.evaluate(() => window.__sawSkeleton));
ok('skeletons all resolved to content',
  (await page.locator('.term.skeleton').count()) === 0);

// ------------------------------------------ only-text-is-brand-or-folder-name
const stray = await page.evaluate(() => {
  const out = [];
  const walk = (el) => {
    for (const node of el.childNodes) {
      if (node.nodeType === 1 && /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(node.tagName)) continue;
      if (node.nodeType === 3 && node.textContent.trim()) {
        const host = node.parentElement;
        if (host.closest('.term')) continue;          // terminal content is allowed
        if (host.closest('.folder')) continue;        // folder names are allowed
        if (host.closest('.brand-name')) continue;    // the product name, once
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

// the product name, once, at the top of the rail
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

// A dozen panes each blinking on their own phase was the most distracting
// thing on screen. Real ttyd gets `-t cursorBlink=false` for the same reason.
const cursorAnim = await page.locator('.surface:not([hidden]) .cursor').first()
  .evaluate((el) => getComputedStyle(el).animationName);
ok('terminal cursor does not blink', cursorAnim === 'none', cursorAnim);

// ------------------------------------------------------------- mock terminal
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

// ------------------------------------------------- hover must not move a pixel
// THE rule for a terminal: a real PTY's glyph grid does not move because a
// pointer crossed it. An earlier pass reserved a right-hand gutter while the
// pane chrome was up (so output could not be struck through) — which reflowed
// the text under the cursor, and in a 3-pane window meant text jumping every
// time the mouse travelled. Measure the INK, hover, measure again: identical.
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

// no padding may react to hover, anywhere in the terminal subtree
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

// and the chrome that appeared must not translate either — a control sliding in
// reads as the terminal moving under it
const railTransform = await page.locator('.surface:not([hidden]) .pane .rail-pane').first()
  .evaluate((el) => getComputedStyle(el).transform);
ok('pane control fades in place, never slides', railTransform === 'none', railTransform);

await page.mouse.move(0, 0);
await page.waitForTimeout(220);
const inkAfter = await inkOf(page, FIRSTLINE);
ok('leaving the pane restores the exact original position', sameBox(inkRest, inkAfter),
  JSON.stringify(inkRest) + ' -> ' + JSON.stringify(inkAfter));

// ---------------------------------------------- borderless at rest, ringed on focus
// A terminal is a filled rectangle in its own theme colour and the stage behind
// it is that colour shifted, so the boundary is already drawn by two surfaces
// meeting across a gutter. A hairline on top described an edge that was
// already there — and it cost `focused` its vocabulary: the ring could only say
// "a slightly different grey", which is why it read as partial and unclear.
// Rest = no ring; focus = a 2px ring. Present vs absent.
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

// ...and the separation it relies on instead is REAL: measure the rendered
// stage against the rendered terminal, in every theme, against a floor. This is
// the assertion that stops "borderless" from silently becoming "invisible".
//
// The workspace is switched by PLAYWRIGHT, one theme per iteration, not by an
// in-page `el.click()` loop: the row's handler routes through `location.hash`,
// and a synthetic click inside a single `page.evaluate` never lets React commit
// before the next measurement. That version read the SAME (night) colours three
// times and passed this whole section vacuously — it never once looked at the
// light theme, which is the only one where these steps are tight.
const readSurfaces = () => page.evaluate(() => {
  const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
  const lum = (rgb) => { const [r,g,b] = rgb.slice(0,3).map(lin); return 0.2126*r + 0.7152*g + 0.0722*b; };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi,lo] = l1>l2?[l1,l2]:[l2,l1]; return (hi+0.05)/(lo+0.05); };
  const term = document.querySelector('.surface:not([hidden]) .term');
  const shell = document.querySelector('.shell');
  const rail = document.querySelector('.rail');
  if (!term || !shell || !rail) return null;
  // getComputedStyle hands back `color(srgb ...)` for a color-mix, whose
  // channels are 0..1 floats, not 0..255 — scale those or every stage
  // measurement silently reads as near-black and every ratio is fiction.
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
    // the gutter IS the stage showing through between rail and terminal
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
// Theme is now intentionally GLOBAL: switching workspace must preserve paint.
ok('all workspaces share the configured global theme',
  new Set(surfaceSteps.map((s) => s.stage)).size === 1,
  surfaceSteps.map((s) => `${s.name}:[${s.stage}]`).join(' '));
// 1.12 is roughly where a large-area step stops being visible on a decent
// panel; every theme should clear it comfortably in both directions.
const weakTerm = surfaceSteps.filter((s) => s.termVsStage < 1.12);
ok('the gap colour separates every terminal from the stage without a border',
  surfaceSteps.length >= 3 && weakTerm.length === 0,
  surfaceSteps.map((s) => `${s.name}:${s.termVsStage}`).join(' '));
const weakRail = surfaceSteps.filter((s) => s.railVsStage < 1.12);
ok('the borderless sidebar still separates from the stage in every theme',
  weakRail.length === 0, surfaceSteps.map((s) => `${s.name}:${s.railVsStage}`).join(' '));

// The one that nearly slipped through. Under `paper` the rail (#f7f8fb) and the
// terminal (#fbfaf6) are the same white to within 1.02:1 — with a border they
// were two panels, without one they would be a single sheet. What actually
// separates them is the GUTTER, so the gutter is what has to be asserted: it
// must step away from BOTH surfaces it runs between, in every theme. Checking
// only rail-vs-stage would have passed this while the screenshot showed the
// sidebar dissolving into the terminal.
const seam = surfaceSteps.filter((s) => s.gutterVsRail < 1.12 || s.gutterVsTerm < 1.12);
ok('the gutter separates the sidebar from the terminal in every theme',
  seam.length === 0,
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

// ------------------------------------------------------- focus ring integrity
// The focused border must be CONTINUOUS on all four sides. Two earlier attempts
// failed invisibly: an outer box-shadow was clipped by the slot/canvas/viewport
// chain (ring on two sides only for panes at the canvas edge), and an inset one
// on .pane was painted UNDER .term's own background. It is now an overlay.
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
    // covers the pane exactly on all four sides
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

// Only the FOCUSED pane is ringed — and because the ring is an inset overlay
// on a sibling, the terminal underneath keeps its exact box. Same-sized panes
// must measure identically focused and not.
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
ok('exactly one pane is ringed — the focused one',
  edgeGeom.fShadow !== 'none' && edgeGeom.uShadow === 'none',
  edgeGeom.fShadow + '  vs  ' + edgeGeom.uShadow);
ok('the ring costs the terminal no geometry',
  JSON.stringify(edgeGeom.fg) === JSON.stringify(edgeGeom.ug),
  JSON.stringify(edgeGeom.fg) + ' vs ' + JSON.stringify(edgeGeom.ug));

// The ring is a state indicator, so WCAG 1.4.11 applies: 3:1 against BOTH what
// it sits on (the terminal) and what it sits against (the stage gutter).
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

// ...and NOTHING may break that perimeter. The corner control used to carry a
// radial scrim bleeding the pane background out to 56px, which painted straight
// over the top-right arc of the ring: a focused pane had a visible notch in its
// border exactly where the chrome sat. The chrome is now inset inside the ring,
// and the ring is painted above all of it.
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
      // clear of the 2px ring on every side it can reach
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

// ------------------------------------------------------------------- splits
console.log('\nsplit');
const firstPane = page.locator('.surface:not([hidden]) .pane').first();
await firstPane.hover();

// ONE resting control per pane. The four-glyph rail was four decisions asked
// of the eye before the eye had asked a question.
const restingPicos = await firstPane.locator('.pico').count();
ok('pane rests behind a single control', restingPicos === 1, String(restingPicos));

await firstPane.locator('.pico[aria-label="Pane menu"]').click();
await page.waitForSelector('.panepop');
// let the 130ms open animation land before measuring anything about it
await page.locator('.panepop').evaluate((el) =>
  Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))));
const popLabels = await page.$$eval('.panepop .pico', (n) => n.map((e) => e.getAttribute('aria-label')));
ok('menu carries settings, close and both split axes',
  popLabels.includes('Pane settings') && popLabels.includes('Close pane') &&
  [2, 3, 4].every((n) => popLabels.includes(`Split into ${n} columns`)) &&
  [2, 3, 4].every((n) => popLabels.includes(`Split into ${n} rows`)),
  popLabels.join(', '));
await page.screenshot({ path: `${SHOTS}/12-pane-menu.png` });

// The popup is opaque and sits OVER output. Nested inside the button rail it
// inherited that rail's 0->1 hover fade and rendered see-through, with terminal
// text legible straight through the menu.
const popBleed = await page.evaluate(() => {
  const pop = document.querySelector('.panepop');
  const cs = getComputedStyle(pop);
  return { op: cs.opacity, bg: cs.backgroundColor };
});
ok('pane menu is fully opaque over the terminal',
  popBleed.op === '1' && /^rgb\(/.test(popBleed.bg), JSON.stringify(popBleed));

// Right click opens the same menu, without the pointer visiting the hotspot.
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

// existing pane keeps the leftmost slot
const splitCmds = await page.evaluate(() => {
  const panes = [...document.querySelectorAll('.surface:not([hidden]) .pane')];
  panes.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  return panes.map((p) => p.querySelector('.term').textContent);
});
ok('existing pane took the leftmost slot', splitCmds[0].includes('pi'), splitCmds[0].slice(0, 40));

// A fresh slot is a NEW SHELL, not a clone: cloning `npm run dev` into three
// panes would boot three dev servers on the same port. ttyd is started with
// bash, so a split yields bash.
const clones = splitCmds.slice(1, 3).filter((t) => t.includes('session ready')).length;
ok('split panes do not clone the source command', clones === 0, `${clones} clone(s)`);
const freshAreBash = splitCmds.slice(1, 3).every((t) => /\$ bash/.test(t));
ok('fresh split panes default to bash', freshAreBash, splitCmds.slice(1, 3).map((t) => t.slice(0, 60)).join(' | '));
await page.screenshot({ path: `${SHOTS}/02-split-3-columns.png` });

// ------------------------------------------------------------------- resize
console.log('\nresize');
// Measure the slot ADJACENT to the divider being dragged — document order puts
// nested dividers before their parent's, so `.slot` first is not necessarily
// the one this divider moves.
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

// Live xterm fit/repaint work is intentionally suspended for the entire drag.
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

// a divider is a real control: reachable and operable without a pointer
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

// ------------------------------------------------------------ ONE gutter size
// Every primary channel on screen must be the SAME number of pixels: the page's
// outer margin, the sidebar-to-stage channel, and the gap between any two
// panes. They used to disagree — .shell had `padding: 8px` AND `gap: 8px` with
// the resizer collapsed to zero width between them, so the sidebar sat 16px
// from the stage while panes sat 8px from each other, and the rail read as
// detached from the workspace it belongs to.
//
// Measured off RENDERED BOXES, edge to edge, not off the stylesheet: a token
// can be correct while the boxes that consume it still stack two channels into
// one, which is exactly the bug this is here to catch. The divider's HIT AREA
// may be as wide as it likes; what is measured is the painted channel between
// the two panes it separates.
console.log('\none gutter size everywhere');
const gutters = await page.evaluate(() => {
  const R = (el) => el.getBoundingClientRect();
  const shell = document.querySelector('.shell');
  const rail = document.querySelector('.rail');
  const stage = document.querySelector('.stage');
  const sr = R(shell), rr = R(rail), gr = R(stage);
  const out = [];

  // page edge -> first thing inside it, on all four sides
  out.push({ what:'page-left',   px:+(rr.left - sr.left).toFixed(1) });
  out.push({ what:'page-top',    px:+(rr.top - sr.top).toFixed(1) });
  out.push({ what:'page-bottom', px:+(sr.bottom - rr.bottom).toFixed(1) });
  out.push({ what:'page-right',  px:+(sr.right - gr.right).toFixed(1) });

  // sidebar -> stage: the channel the resizer lives in
  out.push({ what:'rail-stage', px:+(gr.left - rr.right).toFixed(1) });

  // every adjacent pane pair in the active surface, both axes. Panes are
  // absolutely positioned inside slots, so compare the PANES themselves.
  const panes = [...document.querySelectorAll('.surface:not([hidden]) .pane')].map((p) => ({ p, r: R(p) }));
  for (let i = 0; i < panes.length; i++) {
    for (let j = 0; j < panes.length; j++) {
      if (i === j) continue;
      const a = panes[i].r, b = panes[j].r;
      const vOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      const hOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      // side by side, sharing a vertical band -> a column channel
      if (b.left >= a.right - 0.5 && vOverlap > 20 && b.left - a.right < 40) {
        out.push({ what:'pane-cols', px:+(b.left - a.right).toFixed(1) });
      }
      // stacked, sharing a horizontal band -> a row channel
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
// ...and the sidebar channel specifically, since that is the one that was wrong
const railStage = gutters.out.find((g) => g.what === 'rail-stage');
const paneGap = gutters.out.find((g) => g.what === 'pane-cols');
ok('the sidebar sits as close to the stage as two panes sit to each other',
  Math.abs(railStage.px - paneGap.px) <= 1, `${railStage.px} vs ${paneGap.px}`);
// the hit area is allowed to be generous; the PAINTED channel is not
ok('the resize handle fills its channel rather than widening it',
  await page.evaluate(() => {
    const g = document.querySelector('.rail-gutter');
    const token = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
    return Math.abs(g.getBoundingClientRect().width - token) <= 1;
  }));

// -------------------------------------------------------------- min + scroll
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

// ------------------------------------------------------------- rail resizing
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

// the width is part of the ONE config object, so it round-trips like everything else
ok('sidebar width persists into the config JSON', await page.evaluate(() => {
  const c = JSON.parse(localStorage.getItem('ttyd-workspace-v2'));
  return c && c.ui && Math.abs(c.ui.railWidth - document.querySelector('.rail').getBoundingClientRect().width) < 2;
}));

// ---------------------------------------------- collapsed rail: NOTHING MOVES
// The rail used to be two elements swapped at the breakpoint, and collapsing
// turned a row of five footer buttons into a column of two — every glyph on
// screen jumped. It is now ONE element whose WIDTH changes, over a fixed 52px
// icon track, so every badge and control keeps its exact coordinates.
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
    // PAINTED footer controls only. `display:none` leaves the nodes in the DOM,
    // so a bare querySelectorAll would report a "hidden" footer as still
    // present — filter on a real box, which is what the eye answers to.
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

// `+` is the last row of the workspace LIST, so it lives on the same fixed
// icon track as the badges above it and must hold its coordinates too.
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

// Shortcuts, global settings, search and backup share ONE row when open, and
// a collapsed rail drops them rather than stacking them into a column.
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
// the brand steps aside when there is no room for it; the toggle stays reachable
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

// ...and the same must hold while RESIZING: only the label column may grow.
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

// --------------------------------------------------------- narrow auto-collapse
await page.setViewportSize({ width: 600, height: 720 });
await page.waitForTimeout(340);
ok('sidebar auto-collapses on a narrow screen',
  (await page.locator('.rail.collapsed').count()) === 1);
await page.screenshot({ path: `${SHOTS}/11-narrow.png` });
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(340);

// ------------------------------------------------------------------ dialogs
// The settings gear now lives ON the workspace row it acts on. A single global
// gear in the footer silently meant "the active folder", so configuring any
// other workspace meant switching to it first.
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

// the row's geometry must be IDENTICAL with the actions revealed
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
await page.locator(folderMenuSel).click();
ok('workspace menu offers settings and close',
  (await page.locator('.folder.active .folder-menu [role="menuitem"]').count()) === 2);
await page.locator('.folder.active .folder-menu [role="menuitem"]', {hasText:'Settings'}).click();
await page.waitForSelector('dialog[open]');
ok('folder dialog is route-driven', /\/settings$/.test(page.url()), page.url());
await page.screenshot({ path: `${SHOTS}/05-folder-dialog.png` });

// ------------------------------------------- folder settings save themselves
// No Save button: a folder that exists is edited in place, so the rail relabels
// and the terminals repaint while the dialog is still open.
ok('folder settings offer no Save button', await page.evaluate(() =>
  ![...document.querySelectorAll('dialog[open] .btn')].some((b) => /^(Save|Cancel)$/.test(b.textContent.trim()))));
await page.fill('dialog[open] input[type=text]:not(.mono)', 'renamed-live');
await page.waitForTimeout(160);
ok('typing a folder name reaches the sidebar with no Save',
  (await page.locator('.folder.active .folder-name').textContent()) === 'renamed-live',
  await page.locator('.folder.active .folder-name').textContent());

// Theme is now a per-folder setting and applies live.
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

// ------------------------------------------- pane settings: standardized modal
console.log('\npane settings dialog');
const pane2 = page.locator('.surface:not([hidden]) .pane').nth(1);
// Measure the terminal BEFORE opening, so "it did not move" is a comparison
// rather than a truism. The selector is the FIRST pane on the surface, not the
// one being configured: opening a popover must not move ANY of them.
//
// The clicks below are dispatched IN PAGE rather than through `locator.click()`.
// Playwright scrolls a scroll-container to its "ideal" position as part of
// actionability — even when the target is already fully visible — so when the
// canvas overflows (it does here, after the 3-way split) the harness itself
// shifts the viewport ~230px and the assertion measures Playwright, not the app.
// Verified: driven in-page the scrollLeft never leaves 0. Real clicks are still
// used everywhere the harness scroll is harmless.
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
// let the entrance animation finish before measuring anything about it: mid-flight
// the panel is genuinely part-transparent and terminal text shows through it
await page.locator('.panesettings').evaluate((el) =>
  Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))));
ok('pane settings keep their route', /\/pane\//.test(page.url()), page.url());
ok('pane settings use the standard modal dialog', (await page.locator('dialog[open] .panesettings').count()) === 1);

// Once settled it must be OPAQUE. A part-transparent panel over a terminal is
// unreadable in both directions — the sibling `.panepop` shipped exactly that
// bug by inheriting its parent's hover fade.
const psOpaque = await page.evaluate(() => {
  const ps = document.querySelector('.panesettings');
  const cs = getComputedStyle(ps);
  return { op: cs.opacity, bg: cs.backgroundColor, running: ps.getAnimations().filter((a) => a.playState === 'running').length };
});
ok('settled pane settings are fully opaque',
  psOpaque.op === '1' && /^rgb\(/.test(psOpaque.bg) && psOpaque.running === 0, JSON.stringify(psOpaque));

const psBox = await boxOf(page, '.panesettings');
ok('pane settings stay a compact form', psBox.w <= 440, JSON.stringify(psBox));

// exactly two controls: command and tmux; active-border colour was removed.
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

// The tmux row must render as a CHECKBOX ROW, not as a caption. `.ps-row > label`
// (0,1,1) outranked `.ps-check` (0,1,0), so it inherited the caption's
// uppercase, its dim colour and display:block — the box lost its flex row and
// its gap, and the control read as a disabled heading. Every assertion passed;
// only the screenshot showed it.
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
    // the label text must sit clear of the box, on the same line
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

// opening it must not move the terminal underneath — measured against the
// reading taken before it opened. The popover autofocuses its command box, and
// a plain `.focus()` would scroll that box into view, dragging every terminal
// on screen sideways; it focuses with `preventScroll` for exactly this reason.
const psInkAfter = await inkOf(page, FIRSTLINE);
const psScrollAfter = await page.evaluate(() =>
  Math.round(document.querySelector('.surface:not([hidden]) .viewport').scrollLeft));
ok('opening pane settings does not move terminal text', sameBox(psInkBefore, psInkAfter),
  JSON.stringify(psInkBefore) + ' -> ' + JSON.stringify(psInkAfter));
ok('opening pane settings does not scroll the workspace', psScrollBefore === psScrollAfter,
  `${psScrollBefore} -> ${psScrollAfter}`);
ok('the command box is focused for typing', await page.evaluate(() =>
  document.activeElement?.classList.contains('ps-input')));

// every control programmatically labelled
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

// AUTOSAVE: typing a command reaches the terminal with no Save button pressed
await page.fill('.panesettings input[type=text]', 'htop');
await page.waitForTimeout(320);
const hasHtop = await page.locator(LIVE_TERM, { hasText: 'htop' }).count();
ok('pane command autosaves straight to the terminal', hasHtop > 0, String(hasHtop));

// AUTOSAVE: the tmux tick lands in the persisted config immediately
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

// ------------------------------------------------------------ workspace icon
console.log('\nworkspace icon');
await page.locator('.folder.active').hover();
await page.locator('.folder.active .folder-act[aria-label^="Workspace menu"]').click();
await page.locator('.folder.active .folder-menu [role="menuitem"]', {hasText:'Settings'}).click();
await page.waitForSelector('dialog[open] .iconpick');
const iconCount = await page.locator('dialog[open] .iconpick button').count();
ok('icon picker offers a real set to choose from', iconCount >= 32, String(iconCount));
await page.locator('dialog[open] .iconpick button[aria-label="Icon rocket"]').click();
await page.waitForTimeout(180);
// autosave again: the badge changes while the dialog is still open
ok('chosen icon reaches the sidebar with no Save', await page.evaluate(() =>
  !!document.querySelector('.folder.active .folder-badge svg[data-icon="rocket"]')));
await page.screenshot({ path: `${SHOTS}/13-folder-icon.png` });
await page.locator('dialog[open] .btn.primary').click();
await page.waitForTimeout(200);

// ------------------------------------------------------------------- backup
await page.locator('.ico[aria-label="Backup and restore"]').click();
await page.waitForSelector('dialog[open] textarea');
const backupText = await page.locator('dialog[open] textarea').inputValue();
let parsed = null;
try { parsed = JSON.parse(backupText); } catch {}
ok('backup dialog exposes valid round-trippable JSON', !!parsed && Array.isArray(parsed.folders), 'unparseable');
ok('opening backup does not stomp the hash', /#\/backup/.test(page.url()), page.url());
await page.screenshot({ path: `${SHOTS}/07-backup.png` });

// restore validation rejects junk
await page.fill('dialog[open] textarea', '{"folders":[{"layout":{"type":"pane"}}]}');
await page.locator('dialog[open] .btn.primary').click();
await page.waitForTimeout(150);
const stillOpen = await page.locator('dialog[open]').count();
ok('invalid restore is rejected with an error', stillOpen === 1);
const errText = await page.locator('dialog[open] .hint.err').textContent().catch(() => '');
ok('restore error is explained', !!errText, errText || 'no message');
await page.locator('dialog[open] .btn', { hasText: 'Close' }).click();
await page.waitForTimeout(150);
ok('backup dialog actually closes', (await page.locator('dialog[open]').count()) === 0);

// REGRESSION (P0). The route effect rewrote the hash under #/backup, so "Close"
// wrote a hash that was ALREADY in the bar -> no `hashchange` -> the dialog was
// wedged open forever. It only ever reproduced on the SECOND open, because the
// first close left the URL pre-stomped. Assert the full open/close cycle twice.
console.log('\nregression: dialogs reopen and reclose');
for (const pass of [1, 2]) {
  await page.locator('.ico[aria-label="Backup and restore"]').click();
  await page.waitForTimeout(180);
  ok(`backup opens on pass ${pass}`, (await page.locator('dialog[open]').count()) === 1);
  await page.locator('dialog[open] .btn', { hasText: 'Close' }).click();
  await page.waitForTimeout(180);
  ok(`backup closes on pass ${pass}`, (await page.locator('dialog[open]').count()) === 0);
}

// REGRESSION. #/backup and #/new carry no folder id; the workspace behind them
// must stay on the folder the user was actually on, not snap to folders[0].
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

// REGRESSION. Cancelling "new folder" must not create anything, must close, and
// must leave the user on the folder they started from.
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

// go back to the first folder so later assertions read the seeded layout
await page.locator('.folder').first().click();
await page.waitForTimeout(180);

// ---------------------------------------------------------- command palette
// The one way to reach a named terminal without hunting for it. It is an
// overlay, which is why it is allowed to show words at all.
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

// back to the seeded first folder
await page.locator('.folder').first().click();
await page.waitForTimeout(180);

// ============================================================== ACCESSIBILITY
// Contrast is measured from the page's OWN theme table, so the assertion can
// never drift from what actually ships. AA: 4.5:1 for text, 3:1 for controls,
// borders and focus rings. `dim` shipped at 3.1-4.2:1 in all six themes — and
// `dim` is what a terminal spends on timestamps, byte counts and `ls -la` mode
// bits, i.e. precisely the text people squint at.
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

// ...and the same maths against what the browser ACTUALLY painted, so a CSS
// mistake (a stray opacity, a bad color-mix) cannot pass a green source audit.
const rendered = await page.evaluate(() => {
  const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
  const lum = (rgb) => { const [r,g,b] = rgb.slice(0,3).map(lin); return 0.2126*r + 0.7152*g + 0.0722*b; };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi,lo] = l1>l2?[l1,l2]:[l2,l1]; return (hi+0.05)/(lo+0.05); };

  /* A resting row is `background: transparent`, i.e. `rgba(0,0,0,0)` — reading
     that as a colour makes every unselected label look like light-on-BLACK and
     invents failures that are not on screen. Composite up the ancestor chain to
     the first opaque paint instead, which is what the eye actually sees. */
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
  // sidebar labels, each against whatever is actually painted behind that row
  document.querySelectorAll('.folder-name').forEach((n) => {
    out.push({ txt: 'rail:' + n.textContent.trim().slice(0, 10),
               r: +ratio(parse(getComputedStyle(n).color), effectiveBg(n)).toFixed(2) });
  });
  // and the pictogram controls, which are non-text and answer to 3:1
  document.querySelectorAll('.rail .ico').forEach((b) => {
    out.push({ txt: 'ico:' + b.getAttribute('aria-label'), min: 3,
               r: +ratio(parse(getComputedStyle(b).color), effectiveBg(b)).toFixed(2) });
  });
  return out;
});
const renderedFails = rendered.filter((r) => r.r < (r.min ?? 4.5));
ok('every glyph actually painted on screen clears its minimum', renderedFails.length === 0,
  renderedFails.slice(0, 5).map((f) => `"${f.txt}"=${f.r}`).join(', '));
ok('rendered audit inspected real text', rendered.length > 20, rendered.length + ' spans');

// ---------------------------------------------------- global terminal theme
// The rail, stage and terminals all derive from one configured accessible
// palette; switching workspaces does not repaint them.
console.log('\nglobal terminal theme');
// Sample by ROW STATE, not by position: the active row moves when the workspace
// changes, so `.folder-name` first would compare an active label in one theme
// against an inactive one in the other and "prove" a difference that is only
// the selection moving.
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
ok('the sidebar does not repaint when switching workspaces', railDiff.length === 0,
  railDiff.map((k) => `${k}: ${railNight[k]} vs ${railPaper[k]}`).join(' | '));
ok('the stage keeps the global theme when switching workspaces', stageNight === stagePaper,
  `${stageNight} vs ${stagePaper}`);
// The FOCUS RING is the pane's only border now, and it is still mixed from the
// pane's own palette rather than a fixed app blue — so a paper pane rings in
// its own ink and a night pane in its own. (Read off the custom property: at
// rest there is deliberately no box-shadow to compare.)
const paperRing = await page.locator('.surface:not([hidden]) .pane').first()
  .evaluate((el) => getComputedStyle(el).getPropertyValue('--t-ring').trim());
await page.locator('.folder').first().click();
await page.waitForTimeout(260);
const nightRing = await page.locator('.surface:not([hidden]) .pane').first()
  .evaluate((el) => getComputedStyle(el).getPropertyValue('--t-ring').trim());
ok('pane border colour is independent of workspace switching', nightRing === paperRing && !!nightRing,
  `${nightRing} vs ${paperRing}`);
// NB: taken after switching BACK to the dark folder, so this frame shows the
// dark stage under the fixed system rail. The light half of the comparison is
// `09-deeplink-paper.png`.
await page.screenshot({ path: `${SHOTS}/15-system-rail-vs-theme.png` });

// ------------------------------------------------- switching is instantaneous
// Every folder is already mounted, so showing one is a PAINT, not a transition.
// A 260ms surface fade made switching feel slower than the terminals it was
// decorating — and replayed a "boot" for sessions that had been alive all along.
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
// selecting a row must not cross-fade either — the eye blames the slowest thing
// that moved, so a 120ms row fade reads as the whole switch being slow
const rowTrans = await page.locator('.folder.active').evaluate((el) => getComputedStyle(el).transitionDuration);
ok('the selected workspace row does not cross-fade', rowTrans === '0s', rowTrans);

// THE bug: inactive surfaces were `display:none`, and restoring a display
// property RESTARTS every CSS animation in the subtree. Every switch therefore
// replayed the panes' entrance animation — the "it still feels animated" report,
// invisible to a test that only looked at the surface's own computed style.
const hiddenStyle = await page.locator('.surface[hidden]').first().evaluate((el) => {
  const cs = getComputedStyle(el);
  return { display: cs.display, visibility: cs.visibility };
});
ok('inactive surfaces keep their box (never display:none)',
  hiddenStyle.display !== 'none' && hiddenStyle.visibility === 'hidden', JSON.stringify(hiddenStyle));

// measured, not inferred: no animation may be RUNNING on the panes just after
// a switch. `currentTime` near zero means it started with the switch.
await page.evaluate(() => { window.__sawSkeleton = false; });
const t0 = Date.now();
await page.locator('.folder').nth(1).click();
await page.waitForSelector('.surface:not([hidden]) .term[data-ready="1"]', { timeout: 3000 });
const switchMs = Date.now() - t0;
const replayed = await page.evaluate(() =>
  [...document.querySelectorAll('.surface:not([hidden]) .pane')]
    .flatMap((p) => p.getAnimations({ subtree: true }))
    .filter((a) => ['pane-in','shimmer'].includes(a.animationName) && a.playState === 'running' && (a.currentTime ?? 0) < 120)
    .map((a) => a.animationName || 'anim'));
ok('switching replays no animation on the arriving panes', replayed.length === 0, replayed.join(', '));
ok('switching does not replay the boot skeleton',
  (await page.evaluate(() => window.__sawSkeleton)) === false);
ok('the target surface is on screen in one frame', switchMs < 250, switchMs + 'ms');
ok('the previous folder is still mounted behind it',
  (await page.locator('.pane').count()) > (await page.locator('.surface:not([hidden]) .pane').count()));

// and back again — the return trip is where a restarted animation shows up most
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

// -------------------------------------------------------------- persistence
console.log('\npersistence');
const beforeReload = await page.locator(LIVE_PANE).count();
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector(LIVE_PANE);
const afterReload = await page.locator('.surface:not([hidden]) .pane').count();
ok('layout survives reload via localStorage', afterReload === beforeReload, `${beforeReload} -> ${afterReload}`);

// ----------------------------------------------------------- folder switching
const second = page.locator('.folder').nth(1);
await second.click();
await page.waitForTimeout(200);
ok('switching folder updates the hash', /#\/f\/f-infra/.test(page.url()), page.url());
const infraPanes = await page.locator('.surface:not([hidden]) .pane').count();
ok('second folder renders its own panes', infraPanes === 2, String(infraPanes));
await page.screenshot({ path: `${SHOTS}/08-second-folder.png` });

// deep link straight into a folder. Going via about:blank forces a real
// document load — a hash-only goto is a same-document nav and never settles.
await page.goto('about:blank');
await page.goto(BASE + '#/f/f-notes', { waitUntil: 'networkidle' });
await page.waitForSelector(LIVE_TERM);
const notesTheme = await page.locator(LIVE_TERM).first().evaluate((e) => getComputedStyle(e).backgroundColor);
ok('deep link preserves the folder theme', notesTheme === 'rgb(251, 250, 246)', notesTheme);
await page.screenshot({ path: `${SHOTS}/09-deeplink-paper.png` });

// ---------------------------------------------------------- reduced motion
// Every animation is a preference away from being off — and with motion off
// the skeleton is skipped entirely rather than flashing past.
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
