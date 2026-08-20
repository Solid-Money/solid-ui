# Solid — app promo video

A self-contained generator for the Solid app promo video. The whole film is one
HTML document animated by code; frames are captured deterministically with
Playwright and encoded to MP4 with ffmpeg.

Output: **37.6s**, 30fps, in two formats.

| Format     | Size        | Use                                        |
| ---------- | ----------- | ------------------------------------------ |
| `vertical` | 1080 × 1920 | Reels / TikTok / Stories / X vertical       |
| `wide`     | 1920 × 1080 | X and LinkedIn feed, site hero, YouTube     |

## Build

```bash
npm install                 # in the repo root — supplies playwright-core + Mona Sans
cd marketing/promo-video
./build.sh                  # vertical
./build.sh wide             # 16:9
```

Artifacts land in `build/out/` (gitignored). Each format is encoded twice: silent,
and with the generated audio bed.

Requirements: `ffmpeg` on `PATH` (or set `$FFMPEG`), a Chromium for Playwright
(set `$CHROME_PATH` to point at a specific binary), and `python3` + `numpy` for
the audio bed. If numpy is missing the build skips audio and still produces the
silent master.

## How it works

`video.html` exposes a single entry point:

```js
window.__render(t); // t = seconds; sets every animated property from scratch
window.__dur; // 37.6
```

Nothing animates on a wall clock — no CSS transitions, no `requestAnimationFrame`,
no `Date.now()`. Every transform, opacity, counter and SVG attribute is a pure
function of `t`. That makes rendering reproducible and resolution-independent:
`render.js` sets the viewport, walks `t` in `1/fps` steps, and screenshots.

The same document serves both formats. `?wide` adds a `.w` class to the root and
a block of override CSS repositions the layout (text left, phone right); the
timeline itself is shared, so edits apply to both formats at once.

### Layout

Phone screens are built at **419 × 1132**, matching the Figma frames 1:1, then
scaled as a unit — so spacing, type sizes and radii can be read straight off the
design without conversion. Design tokens are lifted from `global.css`
(`--background`, `--card`, `--brand`, `--points`, `--rewards`, `--muted-foreground`)
and typography is real Mona Sans, copied out of the repo's own
`@expo-google-fonts/mona-sans` dependency. Brand marks are referenced directly
from `assets/images/`, so the video tracks the app.

The card face is drawn in CSS (layered radial gradient, `repeating-radial-gradient`
rings, sheen, SVG-turbulence grain) rather than bitmapped, which keeps it crisp at
any scale and lets it be lit and tilted in 3D.

### Timeline

| Time          | Scene         | Screen / content                                                     |
| ------------- | ------------- | -------------------------------------------------------------------- |
| 0.0 – 3.2     | Logo intro    | Mark bloom, wordmark, `SAVE · SPEND · EARN`                           |
| 3.2 – 7.8     | Hook          | Wallet — balance counts up, card sheen                                |
| 7.8 – 13.4    | Savings vault | Savings — APY chip, growth curve draws, 10-year projection            |
| 13.4 – 16.4   | Card hero     | Card flies in 3D with a shine sweep                                   |
| 16.4 – 21.3   | Card          | Card screen — cashback progress fills to $38 / $150                   |
| 21.3 – 24.2   | Benefits      | 5% cashback, 1% FX, global acceptance, instant setup                  |
| 24.2 – 27.5   | Rewards       | Points count to 10.5M, Core → Prime → Ultra tiers                     |
| 27.5 – 29.4   | Points        | "How do you earn points?" sheet — Save / Spend / Card / Swap          |
| 29.4 – 34.0   | Referrals     | Invite orbit, referral link, 1% cashback on friends' purchases        |
| 34.0 – 37.6   | Outro         | Logo, `Save. Spend. Earn.`, store badges, solid.xyz                   |

Scene boundaries live in one place — the `SC` array and the `tb()` calls in
`video.html` — so retiming means editing numbers, not markup.

### Audio

`audio.py` synthesises a 37.6s bed whose accents line up with the cut list above:
an Am–F–C–G pad, sub-bass pulse, noise whooshes on each cut, a riser into the
outro and a low impact on the logo landing.

It is a **scratch bed for timing, not a finished mix** — swap in a licensed track
for anything public-facing. The silent master exists for exactly that: drop it on
a timeline and lay music over it. The cut list above doubles as the hit-point sheet.

## Editing

- **Copy, numbers, screens** — edit the markup in `video.html` directly.
- **Timing** — the `SC` array (screen windows) and `tb()` calls (text blocks).
- **Retime the whole film** — change `DUR` and the scene constants.
- **Colours** — the `:root` block, kept in sync with `global.css`.
- **Length/fps** — `./build.sh vertical 60` renders at 60fps (2× the frames).

After any edit, probe a few frames before committing to a full render:

```js
// in render.js, or a scratch script
await page.evaluate((t) => window.__render(t), 15.2);
await page.screenshot({ path: 'probe.png' });
```
