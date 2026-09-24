// The OBS page. Reads the config from the link (#c=…) and loops the overlay forever.
// Inside the editor it is an iframe: the editor sends configs and seeks, and gets the holes back.

const stage = document.getElementById('stage');
const embedded = window.parent !== window;
let showSamples = new URLSearchParams(location.search).has('samples');
let current = null;
let paused = false;

const fontsReady = Promise.all(
  ['500 40px "GL Lineca"', '400 20px "GL Mono"'].map((f) => document.fonts.load(f)),
).then(() => document.fonts.ready);

function tell(message) {
  if (embedded) window.parent.postMessage({ source: 'gl-overlay', ...message }, '*');
}

async function show(config, atMs = 0) {
  current = config;
  await fontsReady;
  const holes = await renderOverlay(stage, config, { showSamples });
  seekAll(atMs, paused);
  stage.classList.add('is-ready');
  document.body.dataset.ready = '1';
  window.LAYOUT = holes;
  tell({ type: 'rendered', holes });
}

function loopTime() {
  const a = document.getAnimations().find((x) => x.effect && x.effect.getComputedTiming().duration === LOOP_MS);
  return a ? Number(a.currentTime) % LOOP_MS : 0;
}

async function fromHash() {
  const match = location.hash.match(/c=([^&]+)/);
  try {
    await show(match ? await decodeConfig(match[1]) : defaultConfig());
  } catch (err) {
    console.error(err);
    await show(defaultConfig());
  }
}

window.addEventListener('hashchange', fromHash);

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || msg.source !== 'gl-editor') return;
  if (msg.type === 'config') show(withDefaults(msg.config), loopTime());
  if (msg.type === 'samples') {
    showSamples = msg.on;
    if (current) show(current, loopTime());
  }
  if (msg.type === 'seek') {
    paused = true;
    seekAll(msg.ms, true);
  }
  if (msg.type === 'play') {
    paused = false;
    seekAll(loopTime(), false);
  }
  if (msg.type === 'pause') {
    paused = true;
    seekAll(loopTime(), true);
  }
});

// The editor's scrub bar follows the loop.
if (embedded) {
  setInterval(() => tell({ type: 'time', ms: loopTime(), paused }), 100);
}

// Tests and the editor wait for this.
window.glOverlay = { show, seekAll, loopTime };

if (embedded) tell({ type: 'hello' });
else fromHash();
