// Every motion in the overlay runs on one 15 s loop (LOOP_MS), built with the Web Animations API.
// Keyframes are written in seconds on that loop, so everything stays in sync, second 15 equals
// second 0, and the editor can scrub the whole overlay with document.getAnimations().
//
// Tune the timing here.
const TIMELINE = {
  live: { in: 0.6, out: 11.0, wipe: 0.5 }, // LIVE pill wipes in, holds, wipes out
  blink: 1.0, // LIVE dot on/off period (divides the loop)
  swap: { at: 7.7, move: 0.5 }, // band logo swaps to "GenTalks XIV" / the title, back at 15
  ticker: { move: 0.5 }, // ticker items share the loop equally
  sponsors: { fade: 0.6 }, // sponsor logos share the loop equally
  names: { in: 1.0, out: 10.0, wipe: 0.5 }, // optional name tags
};

const LOOP_S = LOOP_MS / 1000;
const EASE_MOVE = 'cubic-bezier(0.65, 0, 0.35, 1)'; // things moving on screen
const EASE_WIPE = 'cubic-bezier(0.77, 0, 0.175, 1)';

// Keyframes as { at: seconds, ...props }; `easing` on a keyframe applies until the next one.
function loop(el, frames, duration = LOOP_MS) {
  const keyframes = frames.map(({ at, ...props }) => ({ ...props, offset: Math.min(1, Math.max(0, (at * 1000) / duration)) }));
  return el.animate(keyframes, { duration, iterations: Infinity, fill: 'both' });
}

const CLIP_HIDDEN_LEFT = 'inset(0 100% 0 0)';
const CLIP_SHOWN = 'inset(0 0% 0 0)';
const CLIP_HIDDEN_RIGHT = 'inset(0 0 0 100%)';

// Wipes in from the left, holds, wipes out to the right. Blue elements only ever move this way:
// the brand never fades the blue.
function wipe(el, { in: tIn, out: tOut, wipe: d }) {
  return loop(el, [
    { at: 0, clipPath: CLIP_HIDDEN_LEFT },
    { at: tIn, clipPath: CLIP_HIDDEN_LEFT, easing: EASE_WIPE },
    { at: tIn + d, clipPath: CLIP_SHOWN },
    { at: tOut, clipPath: CLIP_SHOWN, easing: EASE_WIPE },
    { at: tOut + d, clipPath: CLIP_HIDDEN_RIGHT },
    { at: LOOP_S, clipPath: CLIP_HIDDEN_RIGHT },
  ]);
}

// Hard on/off, never a fade.
function blink(el, period = TIMELINE.blink) {
  return loop(
    el,
    [
      { at: 0, visibility: 'visible' },
      { at: period / 2, visibility: 'visible' },
      { at: period / 2, visibility: 'hidden' },
      { at: period, visibility: 'hidden' },
    ],
    period * 1000,
  );
}

const SLIDE = { below: { transform: 'translateY(110%)' }, shown: { transform: 'translateY(0)' }, above: { transform: 'translateY(-110%)' } };
const FADE = { below: { opacity: 0 }, shown: { opacity: 1 }, above: { opacity: 0 } };

// Items take turns. starts[i] is when item i is fully in (starts[0] must be 0); it leaves as the
// next one arrives, over `move` seconds. Item 0 comes back in over the last `move` seconds.
function rotate(els, starts, move, states = SLIDE) {
  if (els.length < 2) return;
  els.forEach((el, i) => {
    const s = starts[i];
    const e = i + 1 < els.length ? starts[i + 1] : LOOP_S;
    const f = (at, state, easing) => ({ at, ...states[state], ...(easing ? { easing } : {}) });
    const frames =
      i === 0
        ? [f(0, 'shown'), f(e - move, 'shown', EASE_MOVE), f(e, 'above'), f(e, 'below'), f(LOOP_S - move, 'below', EASE_MOVE), f(LOOP_S, 'shown')]
        : [f(0, 'below'), f(s - move, 'below', EASE_MOVE), f(s, 'shown'), f(e - move, 'shown', EASE_MOVE), f(e, 'above')];
    if (i > 0 && e < LOOP_S) frames.push(f(e, 'below'), f(LOOP_S, 'below'));
    loop(el, frames);
  });
}

function evenStarts(n) {
  return Array.from({ length: n }, (_, i) => (i * LOOP_S) / n);
}

// Scrubbing (editor, tests): every animation to the same point of the loop.
function seekAll(ms, paused) {
  for (const a of document.getAnimations()) {
    a.currentTime = ms;
    if (paused) a.pause();
    else a.play();
  }
}
