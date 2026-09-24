// The overlay config: defaults, the layout catalogue, and the link encoding.
// Shared by the editor (index.html) and the OBS page (overlay.html).

const LOOP_MS = 15000;
const MAX_TICKER = 5;
const MAX_SPONSORS = 5;
const MAX_CAMS = 5;

// Grouped the way the editor shows them: by how many cameras are on screen.
const LAYOUT_GROUPS = [
  { name: '1', layouts: [['full', 'Full screen'], ['cam', 'In frame'], ['cam-chat', 'With chat']] },
  { name: '2', layouts: [['split', 'Split'], ['split-chat', 'Split + chat'], ['speaker-chat', 'Speaker + chat']] },
  { name: '3', layouts: [['trio', 'Row of 3'], ['speaker-3', 'Speaker + 2']] },
  { name: '4', layouts: [['quad', '2 × 2'], ['speaker-4', 'Speaker + 3']] },
  { name: '5', layouts: [['five', '2 + 3']] },
  { name: 'Screen', layouts: [['screen-1', 'Screen + 1'], ['screen-2', 'Screen + 2'], ['screen-3', 'Screen + 3'], ['pip', 'Picture in picture']] },
];

// How many cameras a layout has (the name-tag rows follow this).
function camsFor(layout) {
  const n = { split: 2, 'split-chat': 2, 'speaker-chat': 2, trio: 3, 'speaker-3': 3, quad: 4, 'speaker-4': 4, five: 5 }[layout];
  if (n) return n;
  if (layout.startsWith('screen-')) return Number(layout.slice(-1));
  return 1;
}

function layoutGroup(id) {
  return LAYOUT_GROUPS.find((g) => g.layouts.some(([l]) => l === id));
}

function defaultConfig() {
  return {
    v: 1,
    show: 'gentalks', // 'gentalks' | 'genlayer'
    episode: '', // GenTalks episode number, shown as a roman numeral
    title: '', // GenLayer stream title, e.g. "AMA"
    layout: 'split',
    theme: 'light', // 'light' | 'ink'
    pattern: true,
    motion: true,
    live: { on: true, label: 'Live' },
    band: {
      on: true,
      ticker: ['Intelligent contracts in production', 'Live on X · @GenLayer', 'genlayer.com'],
      sponsorLabel: 'Supported by',
      sponsors: [], // { name, src (data URL), w, h }
      black: true,
    },
    names: {
      on: false,
      stay: false,
      list: Array.from({ length: MAX_CAMS }, () => ({ name: '', role: '', company: '' })),
    },
  };
}

// Fill anything missing from an older or hand-edited config with the defaults.
function withDefaults(config) {
  const merge = (base, over) => {
    if (Array.isArray(base)) return Array.isArray(over) ? over : base;
    if (base && typeof base === 'object') {
      const out = { ...base };
      for (const k of Object.keys(base)) if (over && k in over) out[k] = merge(base[k], over[k]);
      return out;
    }
    return over === undefined ? base : over;
  };
  const merged = merge(defaultConfig(), config || {});
  while (merged.names.list.length < MAX_CAMS) merged.names.list.push({ name: '', role: '', company: '' });
  return merged;
}

// --- Link encoding: JSON → deflate-raw → base64url, carried in the URL hash (#c=…) ----------

function toBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function encodeConfig(config) {
  const stream = new Blob([JSON.stringify(config)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return toBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()));
}

async function decodeConfig(text) {
  const stream = new Blob([fromBase64Url(text)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return withDefaults(JSON.parse(await new Response(stream).text()));
}

function toRoman(n) {
  const table = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [v, s] of table) while (n >= v) (out += s), (n -= v);
  return out;
}
