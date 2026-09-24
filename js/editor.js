// The editor: a form on the left, the live overlay (overlay.html in an iframe) on the right.
// The config is the single source of truth; it is remembered in this browser, saved as presets,
// and packed into the OBS link.

const form = document.getElementById('form');
const iframe = document.getElementById('preview');
const frame = document.getElementById('frame');
const scrub = document.getElementById('scrub');
const timeLabel = document.getElementById('time');
const playButton = document.getElementById('play');
const holesList = document.getElementById('holes');
const linkSize = document.getElementById('link-size');

let state = defaultConfig();
let presets = [];
let holes = [];
let paused = false;
let scrubbing = false;
let link = '';

// --- Config <-> form --------------------------------------------------------------------------

const getPath = (obj, path) => path.split('.').reduce((o, k) => o[k], obj);
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], obj)[last] = value;
}

function update(mutate) {
  mutate(state);
  changed();
}

let saveTimer;
function changed() {
  syncForm();
  post({ type: 'config', config: state });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    store.set('current', state);
    refreshLink();
  }, 250);
}

function syncForm() {
  for (const input of form.querySelectorAll('input[name], textarea[name]')) {
    const value = getPath(state, input.name);
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else if (document.activeElement !== input) input.value = Array.isArray(value) ? value.join('\n') : value;
  }
  for (const group of form.querySelectorAll('[data-bind]')) {
    const value = state[group.dataset.bind];
    for (const b of group.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.value === value));
  }
  form.querySelector('[data-when="gentalks"]').hidden = state.show !== 'gentalks';
  form.querySelector('[data-when="genlayer"]').hidden = state.show !== 'genlayer';
  form.querySelector('[data-when="band"]').hidden = !state.band.on;
  form.querySelector('[data-when="names"]').hidden = !state.names.on;
  form.querySelector('[name="motion"]').disabled = !state.pattern;
  renderLayoutPicker();
  renderSponsors();
  renderNames();
}

form.addEventListener('input', (event) => {
  const t = event.target;
  if (t.name) {
    let value = t.type === 'checkbox' ? t.checked : t.value;
    if (t.name === 'band.ticker') value = t.value.split('\n').slice(0, MAX_TICKER);
    update((s) => setPath(s, t.name, value));
  }
  const row = t.closest('.name-row');
  if (row && t.dataset.key) {
    const i = Number(row.dataset.index);
    update((s) => {
      s.names.list[i][t.dataset.key] = t.value;
      // Picking someone from the list fills in their role and company.
      const person = t.dataset.key === 'name' && window.GL_PEOPLE.find((p) => p.name === t.value);
      if (person) Object.assign(s.names.list[i], { role: person.role, company: person.company });
    });
  }
});

form.addEventListener('submit', (event) => event.preventDefault());

form.addEventListener('click', (event) => {
  const button = event.target.closest('[data-bind] button');
  if (button) update((s) => (s[button.closest('[data-bind]').dataset.bind] = button.dataset.value));
});

// --- Layout picker: camera count, then the layouts for it ------------------------------------

const groupsRoot = document.getElementById('groups');
const layoutsRoot = document.getElementById('layouts');

for (const group of LAYOUT_GROUPS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('role', 'radio');
  b.textContent = group.name;
  b.addEventListener('click', () => update((s) => (s.layout = group.layouts[0][0])));
  groupsRoot.append(b);
}

function renderLayoutPicker() {
  const current = layoutGroup(state.layout);
  [...groupsRoot.children].forEach((b, i) => b.setAttribute('aria-checked', String(LAYOUT_GROUPS[i] === current)));
  layoutsRoot.replaceChildren(
    ...current.layouts.map(([id, name]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(id === state.layout));
      b.textContent = name;
      b.addEventListener('click', () => update((s) => (s.layout = id)));
      return b;
    }),
  );
}

// --- Sponsors ---------------------------------------------------------------------------------

const sponsorsRoot = document.getElementById('sponsors');
const sponsorTemplate = document.getElementById('sponsor-template');
const sponsorFile = document.getElementById('sponsor-file');
const addSponsor = document.getElementById('add-sponsor');

function renderSponsors() {
  const list = state.band.sponsors;
  sponsorsRoot.replaceChildren(
    ...list.map((s, i) => {
      const node = sponsorTemplate.content.firstElementChild.cloneNode(true);
      node.dataset.index = i;
      node.querySelector('.thumb').style.backgroundImage = `url("${s.src}")`;
      node.querySelector('.logo-name').textContent = s.name;
      node.querySelector('[data-action="up"]').disabled = i === 0;
      node.querySelector('[data-action="down"]').disabled = i === list.length - 1;
      return node;
    }),
  );
  addSponsor.disabled = list.length >= MAX_SPONSORS;
}

sponsorsRoot.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const i = Number(button.closest('.logo-row').dataset.index);
  update((s) => {
    const list = s.band.sponsors;
    if (button.dataset.action === 'remove') list.splice(i, 1);
    const j = button.dataset.action === 'up' ? i - 1 : button.dataset.action === 'down' ? i + 1 : -1;
    if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
  });
});

addSponsor.addEventListener('click', () => sponsorFile.click());
sponsorFile.addEventListener('change', async () => {
  const files = [...sponsorFile.files].slice(0, MAX_SPONSORS - state.band.sponsors.length);
  sponsorFile.value = '';
  const logos = await Promise.all(files.map(processLogo));
  update((s) => s.band.sponsors.push(...logos.filter(Boolean)));
});

// Logos travel inside the link, so they are kept small: SVGs as they are, anything else
// redrawn at 240 px high as WebP.
async function processLogo(file) {
  const name = file.name.replace(/\.[^.]+$/, '');
  if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
    const svg = (await file.text()).replace(/<\?xml[\s\S]*?\?>|<!--[\s\S]*?-->|<metadata[\s\S]*?<\/metadata>/g, '').replace(/>\s+</g, '><').trim();
    return { name, src: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}` };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 240 / img.naturalHeight, 960 / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return { name, src: canvas.toDataURL('image/webp', 0.9) };
  } catch {
    alert(`Could not read ${file.name}.`);
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// --- Name tags --------------------------------------------------------------------------------

const namesRoot = document.getElementById('names');
const nameTemplate = document.getElementById('name-template');
document.getElementById('people').append(
  ...window.GL_PEOPLE.map((p) => Object.assign(document.createElement('option'), { value: p.name, label: `${p.role}, ${p.company}` })),
);

function renderNames() {
  const n = camsFor(state.layout);
  while (namesRoot.children.length < n) {
    const node = nameTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.index = namesRoot.children.length;
    node.querySelector('legend').textContent = `Camera ${namesRoot.children.length + 1}`;
    namesRoot.append(node);
  }
  [...namesRoot.children].forEach((node, i) => {
    node.hidden = i >= n;
    for (const input of node.querySelectorAll('[data-key]')) {
      if (document.activeElement !== input) input.value = state.names.list[i][input.dataset.key] || '';
    }
  });
}

// --- Presets ----------------------------------------------------------------------------------

const presetsRoot = document.getElementById('presets');
const presetName = document.getElementById('preset-name');

function renderPresets() {
  presetsRoot.replaceChildren(
    ...presets.map((p, i) => {
      const row = document.createElement('div');
      row.className = 'preset';
      row.innerHTML = '<span></span><button type="button" class="link" data-action="load">Load</button><button type="button" class="link" data-action="delete">Delete</button>';
      row.querySelector('span').textContent = p.name;
      row.dataset.index = i;
      return row;
    }),
  );
}

document.getElementById('preset-save').addEventListener('click', () => {
  const name = presetName.value.trim() || `Overlay ${presets.length + 1}`;
  presets = [{ name, config: structuredClone(state), saved: Date.now() }, ...presets.filter((p) => p.name !== name)];
  store.set('presets', presets);
  presetName.value = '';
  renderPresets();
});

presetsRoot.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const i = Number(button.closest('.preset').dataset.index);
  if (button.dataset.action === 'load') {
    state = withDefaults(structuredClone(presets[i].config));
    presetName.value = presets[i].name;
    changed();
  } else if (confirm(`Delete “${presets[i].name}”?`)) {
    presets.splice(i, 1);
    store.set('presets', presets);
    renderPresets();
  }
});

// --- Link -------------------------------------------------------------------------------------

async function refreshLink() {
  link = `${new URL('overlay.html', location.href).href}#c=${await encodeConfig(state)}`;
  const kb = link.length / 1024;
  linkSize.textContent = `Link length ${kb < 1 ? '< 1' : Math.round(kb)} KB. Everything, logos included, lives in the link: nothing is uploaded.`;
  return link;
}

const copyButton = document.getElementById('copy-link');
copyButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(await refreshLink());
  copyButton.textContent = 'Copied';
  setTimeout(() => (copyButton.textContent = 'Copy OBS link'), 1400);
});

document.getElementById('open-link').addEventListener('click', async () => window.open(await refreshLink(), '_blank'));

document.getElementById('reset').addEventListener('click', () => {
  if (!confirm('Start again from the default overlay? Saved presets stay.')) return;
  state = defaultConfig();
  presetName.value = '';
  changed();
});

// --- Preview ----------------------------------------------------------------------------------

function post(message) {
  iframe.contentWindow.postMessage({ source: 'gl-editor', ...message }, '*');
}

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || msg.source !== 'gl-overlay') return;
  if (msg.type === 'hello') {
    post({ type: 'config', config: state });
    if (paused) post({ type: 'pause' });
  }
  if (msg.type === 'rendered') renderHoles(msg.holes);
  if (msg.type === 'time' && !scrubbing) {
    scrub.value = msg.ms;
    timeLabel.textContent = `${(msg.ms / 1000).toFixed(1)} s`;
  }
});

function renderHoles(list) {
  holes = list;
  let cam = 0;
  holesList.replaceChildren(
    ...list.map((h) => {
      const li = document.createElement('li');
      const label = h.kind === 'screen' ? 'Screen' : `Camera ${++cam}`;
      li.innerHTML = `<b></b> x ${h.x} · y ${h.y} · ${h.w} × ${h.h}`;
      li.querySelector('b').textContent = label;
      return li;
    }),
  );
}

document.getElementById('copy-holes').addEventListener('click', () => {
  navigator.clipboard.writeText([...holesList.children].map((li) => li.textContent).join('\n'));
});

playButton.addEventListener('click', () => {
  paused = !paused;
  post({ type: paused ? 'pause' : 'play' });
  playButton.classList.toggle('is-paused', paused);
  playButton.setAttribute('aria-label', paused ? 'Play' : 'Pause');
});

scrub.addEventListener('input', () => {
  scrubbing = true;
  paused = true;
  playButton.classList.add('is-paused');
  playButton.setAttribute('aria-label', 'Play');
  timeLabel.textContent = `${(scrub.value / 1000).toFixed(1)} s`;
  post({ type: 'seek', ms: Number(scrub.value) });
});
scrub.addEventListener('change', () => (scrubbing = false));

document.getElementById('samples').addEventListener('change', (event) => post({ type: 'samples', on: event.target.checked }));

// The 1920×1080 overlay is scaled to fit the stage.
new ResizeObserver(() => {
  iframe.style.transform = `scale(${frame.clientWidth / 1920})`;
}).observe(frame);

// --- Start ------------------------------------------------------------------------------------

(async () => {
  await store.open();
  // index.html#c=… opens an overlay link for editing; otherwise pick up where this browser left off.
  const shared = location.hash.match(/c=([^&]+)/);
  const saved = await store.get('current');
  if (shared) state = await decodeConfig(shared[1]).catch(() => withDefaults(saved));
  else if (saved) state = withDefaults(saved);
  if (shared) history.replaceState(null, '', location.pathname);
  presets = (await store.get('presets')) || [];
  renderPresets();
  changed();
  await document.fonts.ready;
  document.body.classList.add('is-ready');
})();
