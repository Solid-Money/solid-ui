# Solid — Rewards launch film

A ~27s announcement film for the new Solid rewards programme: **25% subscription
cashback** (the hero), **Skip the Line** tier unlocks, and **Yield Boost**
(coming soon).

Everything is generated from source in this repo — no external stock, no
licensed assets. The app screens are rebuilt as vector DOM from the Figma
designs, so they stay sharp at any output resolution and every element can be
animated individually.

## Output

| File | Format | Use |
| --- | --- | --- |
| `out/solid-rewards-4x5-final.mp4` | 1080×1350, 60fps, 11.2MB | X / Instagram feed (master) |
| `out/solid-rewards-9x16-final.mp4` | 1080×1920, 60fps, 13.8MB | Stories, Reels, TikTok |
| `out/sound.wav` | 48kHz stereo | Sound-design stem |
| `out/storyboard.png` | contact sheet | Six beats, for review without playback |

Build both with `./build.sh` (~30 min: picture is the slow part at ~0.18s/frame,
and each cut is 3240 subsampled frames).

## How it works

The film is a **deterministic timeline**: `window.__seek(t)` sets every visual
property as a pure function of `t` seconds. There are no CSS animations or
transitions anywhere (they're globally disabled in `style.css`), so stepping
frame-by-frame in a headless browser gives byte-identical output every run and
makes motion-blur subsampling possible.

```
scene/index.html   frame shell + fixed 1080x1350 design canvas
scene/style.css    design tokens (lifted from global.css / tailwind.config.js)
scene/screens.js   the three Figma screens rebuilt as vector DOM
scene/app.js       3D phone rig, camera, and the full storyboard timeline
render.mjs         Playwright/Chromium frame stepper -> ffmpeg (piped, no temp files)
audio.mjs          synthesised sound design (impacts, whooshes, ticks, drone)
mux.mjs            combines picture + sound
server.mjs         static server for the scene (Chromium won't load fonts over file://)
```

### Rendering

```bash
export CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome

# master — 4:5, 60fps, 2x subsampled for 180-degree-shutter motion blur
node render.mjs --width=1080 --height=1350 --fps=60 --sub=2 --crf=16 \
  --out=out/solid-rewards-4x5.mp4

# vertical
node render.mjs --width=1080 --height=1920 --fps=60 --sub=2 --crf=16 \
  --out=out/solid-rewards-9x16.mp4

# single frames for review
node render.mjs --still=6.4,10.4,16.5

node audio.mjs
node mux.mjs out/solid-rewards-4x5.mp4 out/sound.wav out/final-4x5.mp4
```

`--sub=N` renders at `N × fps` and averages every `N` frames in ffmpeg
(`tmix`), which produces real motion blur rather than a post-hoc smear.

### Multiple aspect ratios

The storyboard is authored on a fixed 1080×1350 canvas which is scaled to fit
whatever frame is requested (`Math.min(W/1080, H/1350)`), while the background,
grain and vignette fill the full frame. So 4:5, 9:16, 1:1 and 16:9 all come off
one timeline without re-layout.

## Design sources

| Screen | Figma node |
| --- | --- |
| Cashback sheet | `23714:4337` |
| Savings / Yield boost | `24023:1623` |
| Skip the line card | `24164:1934` |

Colours come from the app's own tokens, not eyeballed from screenshots —
`--brand: hsl(109.04 81.56% 72.35%)` → `#94f27f`, `--card: 0 0% 11%`, etc.
Type is Mona Sans (the app's font). Brand logos are the repo's own SVGs from
`assets/images/rewards-tiers/`.

> Note: several of those logo files are misnamed. Verified by render:
> `logo-generic-1` = Amazon, `-2` = YouTube, `-3` = OpenAI, `-4` = HBO Max,
> `-5` = Apple, and `logo-openai.svg` is actually **Spotify**.

## Gotchas worth keeping

- **`#face` must be `transform-style: flat`.** With `preserve-3d`, the face's
  own background plane and the `#viewport` child are coplanar and z-fight,
  tearing a hard bright wedge across the screen at any yaw.
- **No 3D extrusion for the device body.** A stacked slab rim (or even a single
  back plate) gets sorted in front of the face on one side by Chromium's 3D
  compositor. At the yaw angles used here a true extrusion would only show
  ~5px of edge anyway, so thickness comes from the chamfer highlight and drop
  shadow on `#face`.
- **No `filter: blur()` on large elements.** Blurring the background blobs cost
  ~2.5× the total render time; equivalent radial gradients are free.
- Capture goes through a raw CDP `Page.captureScreenshot` with
  `optimizeForSpeed`, which skips Playwright's stability checks.

## Sound

`audio.mjs` synthesises the whole bed from scratch — pitch-dropping sine
impacts, noise through a sweeping bandpass for whooshes, short filtered bursts
for UI ticks, and a detuned drone. Nothing sampled, so there's nothing to
clear. It's cut to the beat sheet in `app.js`; a music track can sit
underneath it.
