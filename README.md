# GenLayer Live Overlays

Animated OBS overlays for GenLayer livestreams (GenTalks and GenLayer shows): the white frame with the GenTalks line pattern, a LIVE pill, a bottom band with the show logo, a ticker and sponsor logos, and optional name tags, all on one seamless 15 second loop.

It is a static page. Nothing is uploaded: the whole overlay, logos included, lives in the link you paste into OBS.

## Make an overlay

Open `index.html` (or the hosted page).

1. **Show**: GenTalks (with the episode number) or GenLayer (with the stream title). The band's logo swaps to "GenTalks XIV" or the title halfway through the loop.
2. **Layout**: pick how many cameras, then the arrangement. Screen layouts put a 16:9 screen share next to 4:3 cameras.
3. **Look**: white or ink frame, line pattern on or off, moving or still.
4. **Live**: the blue LIVE pill wipes in, blinks, and wipes out once per loop.
5. **Bottom band**: ticker lines (up to five, they take turns) and sponsor logos (up to five, they take turns, optionally all black).
6. **Name tags** (optional, off by default): one per camera, in order. Pick someone from the list or type a name. Full screen shows name, role and company; the other layouts show the name only.
7. **Presets**: save the setup under a name; presets stay in this browser.

**Copy OBS link** and paste it into OBS.

## OBS

1. Add a **Browser** source, width **1920**, height **1080**, URL = the copied link.
2. Keep it at the **top** of the scene; cameras and screen capture go below it.
3. Position each source using the spots listed under the preview (x, y, width × height). Use **Edit Transform → Bounding box type: Scale to outer bounds** so each feed fills its spot.

To change an overlay later, load its preset, or open its link with `overlay.html` replaced by `index.html`. Change it, copy the new link, and paste it over the old one in OBS.

## Change the design

| What | Where |
|---|---|
| Timing of every animation | `TIMELINE` in `js/timeline.js` |
| Hole positions per layout | `holesFor()` in `js/render.js` |
| The line pattern | `linePath()` / `linePattern()` in `js/render.js` |
| Colours, band, pills, tags | `overlay.css` |
| Layout list and defaults | `LAYOUT_GROUPS` and `defaultConfig()` in `js/config.js` |
| Names in the picker | `js/people.js` (copied from the Livestream Builder) |
| The editor itself | `index.html`, `editor.css`, `js/editor.js` |

Everything loops on 15 s (`LOOP_MS`). Keep every keyframe inside that loop and the overlay stays seamless.

Fonts: F37 Lineca and Suisse Int'l / Suisse Int'l Mono in `fonts/` (licensed, same files as the Livestream Builder).

## Deploy

Vercel, connected to this repo: pushing to `main` deploys. No build step.
