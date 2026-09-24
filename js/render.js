// Draws one overlay at 1920×1080 from a config: the white frame with its camera and screen holes,
// the GenTalks line pattern, the LIVE pill, the bottom band (show logo, ticker, sponsors) and the
// optional name tags. Everything outside the frame is transparent, so OBS feeds show through.

const W = 1920;
const H = 1080;
const M = 48; // frame
const G = 24; // gutter
const BAND_TOP = 1000; // the band runs 1000–1080; with it on, holes end at 984
const NS = 'http://www.w3.org/2000/svg';

// --- Geometry ---------------------------------------------------------------------------------

// Holes as { kind, x, y, w, h }. Camera layouts follow the July GenTalks overlays; screens are
// 16:9 with 4:3 cameras beside them. With the band on, the frame's bottom edge moves up 48 px.
function holesFor(layout, band) {
  const top = M;
  const h = band ? 936 : 984;
  const half = (h - G) / 2;
  const third = (h - 2 * G) / 3;
  const cam = (x, y, w, hh) => ({ kind: 'cam', x, y, w, h: hh });
  const screen = (x, y, w, hh) => ({ kind: 'screen', x, y, w, h: hh });
  switch (layout) {
    case 'full':
      return [cam(0, 0, W, H)];
    case 'cam':
      return [cam(48, top, 1824, h)];
    case 'cam-chat':
      return [cam(48, top, 1362, h)];
    case 'split':
      return [cam(48, top, 900, h), cam(972, top, 900, h)];
    case 'split-chat':
      return [cam(48, top, 669, h), cam(1203, top, 669, h)];
    case 'speaker-chat':
      return [cam(48, top, 1208, h), cam(1280, top, 592, half)];
    case 'trio':
      return [cam(48, top, 592, h), cam(664, top, 592, h), cam(1280, top, 592, h)];
    case 'speaker-3':
      return [cam(48, top, 1362, h), cam(1434, top, 438, half), cam(1434, top + half + G, 438, half)];
    case 'quad':
      return [cam(48, top, 900, half), cam(972, top, 900, half), cam(48, top + half + G, 900, half), cam(972, top + half + G, 900, half)];
    case 'speaker-4':
      return [cam(48, top, 1362, h), ...[0, 1, 2].map((i) => cam(1434, top + i * (third + G), 438, third))];
    case 'five':
      return [
        cam(48, top, 900, half),
        cam(972, top, 900, half),
        ...[48, 664, 1280].map((x) => cam(x, top + half + G, 592, half)),
      ];
    case 'screen-1':
    case 'screen-2':
    case 'screen-3': {
      const k = Number(layout.slice(-1));
      const [cw, ch] = band ? [392, 294] : [408, 306];
      const stack = k * ch + (k - 1) * G;
      const y0 = top + Math.floor((h - stack) / 2);
      return [
        screen(48, top + Math.floor((h - 783) / 2), 1392, 783),
        ...Array.from({ length: k }, (_, i) => cam(W - M - cw, y0 + i * (ch + G), cw, ch)),
      ];
    }
    case 'pip':
      return band
        ? [screen(192, 112, 1536, 864), cam(1232, 683, 464, 261)]
        : [screen(128, 112, 1664, 936), cam(1296, 740, 464, 261)];
    default:
      return holesFor('split', band);
  }
}

// --- Small builders ---------------------------------------------------------------------------

function el(tag, cls, opts = {}) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.style) Object.assign(node.style, opts.style);
  return node;
}

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

const px = (n) => `${n}px`;

function place(parent, node, box) {
  node.classList.add('abs');
  for (const [k, v] of Object.entries(box)) node.style[k] = typeof v === 'number' ? px(v) : v;
  parent.append(node);
  return node;
}

function showLogo(show, height) {
  const logo = window.GL_LOGOS[show] || window.GL_LOGOS.gentalks;
  const wrap = el('div');
  wrap.innerHTML = logo.svg;
  const svg = wrap.firstElementChild;
  svg.setAttribute('class', 'logo');
  svg.style.height = px(height);
  svg.style.width = px(height * logo.ratio);
  return svg;
}

// What the logo swaps to: "GenTalks XIV", or the GenLayer stream title.
function showWords(config, size) {
  const node = el('p', 'lineca trim show-words', { style: { fontSize: px(size) } });
  if (config.show === 'gentalks') {
    const n = parseInt(config.episode, 10);
    if (!(n > 0)) return null;
    node.append('GenTalks ', el('span', 'numeral', { text: toRoman(n) }));
  } else {
    if (!config.title.trim()) return null;
    node.textContent = config.title.trim();
  }
  return node;
}

// The logo, swapping to the words halfway through the loop when there are words to show.
function logoSlot(config, height, wordSize) {
  const slot = el('div', 'slot logo-slot', { style: { height: px(Math.round(height * 1.3)) } });
  const a = el('div', 'slot-item');
  a.append(showLogo(config.show, height));
  slot.append(a);
  const words = showWords(config, wordSize);
  if (words) {
    const b = el('div', 'slot-item');
    b.append(words);
    slot.append(b);
  }
  return slot;
}

function livePill(label, size = 22) {
  const node = el('div', 'pill mono', { style: { fontSize: px(size), padding: `${px(size * 0.5)} ${px(size * 1.2)}` } });
  const dot = el('span', 'dot', { style: { width: px(size * 0.42), height: px(size * 0.42) } });
  node.append(dot, label || 'Live');
  node.dataset.live = '1';
  return node;
}

function nameTag(person) {
  return el('p', 'card lineca trim name-tag', { text: person.name });
}

function nameCard(person) {
  const node = el('div', 'card name-card');
  node.append(el('p', 'lineca trim name', { text: person.name }));
  const lines = [person.role, person.company && `[${person.company}]`].filter(Boolean).join('\n');
  if (lines) node.append(el('p', 'mono role', { text: lines }));
  return node;
}

// --- The GenTalks line pattern ----------------------------------------------------------------

// Rebuilt from the July overlays: rounded chevrons opening to the right, centred on the right
// edge. Line k crosses the top edge at 1762 + 55.5k, runs 0.7675 px across per px down, turns with
// radius 296 − 17.5k and is (57 + 4.78k)% opaque. Every value is linear in k, so moving each line
// to k + 1 over the loop is exact: the last frame is the first frame, one line further in.
function linePath(k) {
  const m = 0.7675;
  const hyp = Math.hypot(1, m);
  const mid = H / 2;
  const t = 1762 + 55.5 * k;
  const r = 296 - 17.5 * k;
  const cx = t - mid * m + r * hyp;
  const tx = cx - r / hyp;
  const ty = r * (m / hyp);
  const n = (v) => v.toFixed(2);
  return `M ${n(t + 20 * m)} -20 L ${n(tx)} ${n(mid - ty)} A ${n(r)} ${n(r)} 0 0 0 ${n(tx)} ${n(mid + ty)} L ${n(t + 20 * m)} ${H + 20}`;
}

const lineOpacity = (k) => Math.max(0, Math.min(1, (57 + 4.78 * k) / 100));

function linePattern(motion) {
  const g = svgEl('g', { fill: 'none', stroke: '#110fff', 'stroke-width': 2 });
  for (let k = motion ? -12 : -11; k <= 9; k++) {
    const path = svgEl('path', { d: linePath(k), 'stroke-opacity': lineOpacity(k).toFixed(3) });
    g.append(path);
    if (motion) {
      loop(path, [
        { at: 0, d: `path("${linePath(k)}")`, strokeOpacity: lineOpacity(k) },
        { at: LOOP_S, d: `path("${linePath(k + 1)}")`, strokeOpacity: lineOpacity(k + 1) },
      ]);
    }
  }
  return g;
}

// The frame: a white (or ink) plate with the holes cut out, the pattern on it.
function plate(holes, config) {
  const svg = svgEl('svg', { class: 'plate', width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  const defs = svgEl('defs');
  const mask = svgEl('mask', { id: 'holes', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H });
  mask.append(svgEl('rect', { width: W, height: H, fill: '#fff' }));
  for (const h of holes) mask.append(svgEl('rect', { x: h.x, y: h.y, width: h.w, height: h.h, fill: '#000' }));
  defs.append(mask);
  const art = svgEl('g', { mask: 'url(#holes)' });
  art.append(svgEl('rect', { class: 'fill', width: W, height: H }));
  if (config.pattern) {
    const pattern = linePattern(config.motion);
    if (config.band.on) {
      // The lines fade out above the band so the sponsors and ticker sit on a clean strip.
      const grad = svgEl('linearGradient', { id: 'fade-grad', x1: 0, y1: 0, x2: 0, y2: 1 });
      grad.append(svgEl('stop', { offset: 0.88, 'stop-color': '#fff' }), svgEl('stop', { offset: 0.925, 'stop-color': '#000' }));
      const fade = svgEl('mask', { id: 'fade', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H });
      fade.append(svgEl('rect', { width: W, height: H, fill: 'url(#fade-grad)' }));
      defs.append(grad, fade);
      pattern.setAttribute('mask', 'url(#fade)');
    }
    art.append(pattern);
  }
  svg.append(defs, art);
  // A hairline so white screen shares keep an edge on the white frame.
  for (const h of holes) {
    if (h.kind === 'screen') svg.append(svgEl('rect', { class: 'hairline', x: h.x - 0.5, y: h.y - 0.5, width: h.w + 1, height: h.h + 1, fill: 'none' }));
  }
  return svg;
}

// Sample cameras and screen under the holes, for the editor preview only.
function samples(holes) {
  const layer = el('div', 'samples');
  let cam = 0;
  for (const h of holes) {
    const feed = el('div', 'feed', { style: { left: px(h.x), top: px(h.y), width: px(h.w), height: px(h.h) } });
    const img = el('img', h.kind === 'screen' ? 'is-screen' : '');
    img.src = h.kind === 'screen' ? 'assets/samples/screen.jpg' : `assets/samples/cam-${(cam++ % 5) + 1}.jpg`;
    feed.append(img);
    layer.append(feed);
  }
  return layer;
}

// --- The bottom band --------------------------------------------------------------------------

function band(config, { withLogo, floating }) {
  const node = el('div', `band${floating ? ' is-floating' : ''}`);
  const left = el('div', 'band-left');
  if (withLogo) left.append(logoSlot(config, 40, 34));
  if (withLogo && config.live.on) left.append(livePill(config.live.label, 20));
  node.append(left);

  const items = config.band.ticker.map((s) => s.trim()).filter(Boolean).slice(0, MAX_TICKER);
  const ticker = el('div', 'slot ticker');
  for (const text of items) {
    const item = el('div', 'slot-item');
    item.append(el('p', 'mono', { text }));
    ticker.append(item);
  }
  node.append(ticker);

  const sponsors = config.band.sponsors.filter((s) => s && s.src).slice(0, MAX_SPONSORS);
  if (sponsors.length) {
    const right = el('div', 'band-sponsors');
    if (config.band.sponsorLabel.trim()) right.append(el('p', 'mono sponsor-label', { text: config.band.sponsorLabel.trim() }));
    const slot = el('div', `slot sponsor-slot${config.band.black ? ' is-black' : ''}`);
    for (const s of sponsors) {
      const item = el('div', 'slot-item');
      const img = el('img');
      img.src = s.src;
      img.alt = s.name || '';
      item.append(img);
      slot.append(item);
    }
    right.append(slot);
    node.append(right);
  }
  return node;
}

// --- The scene --------------------------------------------------------------------------------

async function renderOverlay(stage, config, { showSamples = false } = {}) {
  for (const a of document.getAnimations()) a.cancel();
  stage.replaceChildren();
  document.documentElement.dataset.theme = config.theme;

  const layout = config.layout;
  const bandOn = config.band.on;
  const holes = holesFor(layout, bandOn);
  const isFull = layout === 'full';
  const isPip = layout === 'pip';

  if (showSamples) stage.append(samples(holes));
  if (!isFull) stage.append(plate(holes, config));

  // Header pieces that only exist without the band (or in the PiP header).
  if (isPip) {
    const screenHole = holes[0];
    place(stage, logoSlot(config, 44, 36), { left: screenHole.x, top: 34 });
    if (config.live.on) place(stage, livePill(config.live.label, 20), { right: W - screenHole.x - screenHole.w, top: 36 });
  } else if (!bandOn) {
    if (isFull) {
      const logo = el('div', 'full-logo');
      logo.append(showLogo(config.show, 76));
      place(stage, logo, { left: 56, top: 52 });
    }
    // Without the band, LIVE sits in the top-left corner of the first camera (the big one).
    const first = holes.find((h) => h.kind === 'cam');
    if (config.live.on) place(stage, livePill(config.live.label, 22), isFull ? { right: 56, top: 56 } : { left: first.x + 24, top: first.y + 24 });
  }

  // Optional name tags, cameras only, in order.
  if (config.names.on) {
    const cams = holes.filter((h) => h.kind === 'cam');
    cams.forEach((h, i) => {
      const person = config.names.list[i];
      if (!person || !person.name.trim()) return;
      if (isFull) {
        place(stage, nameCard(person), { left: 56, bottom: bandOn ? H - BAND_TOP + 32 : 56 });
      } else {
        place(stage, nameTag(person), { left: h.x + 20, bottom: H - (h.y + h.h) + 20 });
      }
    });
  }

  if (bandOn) stage.append(band(config, { withLogo: !isPip, floating: isFull }));

  await Promise.all([...stage.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));
  sizeSlots(stage);
  animate(stage, config);
  return holes;
}

// Slots stack their items; each slot is as wide as its widest item. The logo slot instead takes
// the width of whatever it shows (animated in animate()), so LIVE sits right next to it.
function sizeSlots(stage) {
  for (const slot of stage.querySelectorAll('.slot:not(.ticker)')) {
    const widths = [...slot.children].map((item) => Math.ceil(item.scrollWidth));
    slot.dataset.widths = widths.join(',');
    slot.style.width = px(Math.max(0, ...widths));
  }
}

function animate(stage, config) {
  const t = TIMELINE;
  for (const pill of stage.querySelectorAll('[data-live]')) {
    wipe(pill, t.live);
    blink(pill.querySelector('.dot'));
  }
  for (const slot of stage.querySelectorAll('.logo-slot')) {
    const items = [...slot.children];
    if (items.length < 2) continue;
    rotate(items, [0, t.swap.at], t.swap.move);
    const [wa, wb] = slot.dataset.widths.split(',').map(Number);
    const { at, move } = t.swap;
    loop(slot, [
      { at: 0, width: px(wa) },
      { at: at - move, width: px(wa), easing: EASE_MOVE },
      { at, width: px(wb) },
      { at: LOOP_S - move, width: px(wb), easing: EASE_MOVE },
      { at: LOOP_S, width: px(wa) },
    ]);
  }
  const ticker = stage.querySelector('.ticker');
  if (ticker) rotate([...ticker.children], evenStarts(ticker.children.length), t.ticker.move);
  const sponsors = stage.querySelector('.sponsor-slot');
  if (sponsors) rotate([...sponsors.children], evenStarts(sponsors.children.length), t.sponsors.fade, FADE);
  if (!config.names.stay) for (const tag of stage.querySelectorAll('.name-tag, .name-card')) wipe(tag, t.names);
}
