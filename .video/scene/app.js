/* ==================================================================
   SOLID — Rewards launch film
   Fully deterministic timeline: every visual property is a pure
   function of t, so Playwright can step frame-by-frame and get
   identical output every run.
   ================================================================== */
import { buildCashback, buildSavings, buildTier, tierCardHTML, BRANDS, solidMark } from './screens.js';

/* ---------------- frame setup ---------------- */
const Q = new URLSearchParams(location.search);
const W = Number(Q.get('w') || 1080);
const H = Number(Q.get('h') || 1350);
const SCALE = Number(Q.get('scale') || 1);

const root = document.getElementById('root');
root.style.width = W + 'px';
root.style.height = H + 'px';
root.style.transform = `scale(${SCALE})`;

/* the storyboard is authored on a 1080x1350 canvas; scale it to fit the
   requested frame so 4:5, 9:16, 1:1 and 16:9 all come off one timeline */
const CANVAS_W = 1080, CANVAS_H = 1350;
const fit = Math.min(W / CANVAS_W, H / CANVAS_H);
document.getElementById('canvas').style.transform = `scale(${fit})`;
document.body.style.width = W * SCALE + 'px';
document.body.style.height = H * SCALE + 'px';

/* ---------------- math / easing ---------------- */
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, u) => a + (b - a) * u;
const inv = (t, a, b) => clamp((t - a) / (b - a));
const eOutExpo = (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u));
const eOutQuint = (u) => 1 - Math.pow(1 - u, 5);
const eOutCubic = (u) => 1 - Math.pow(1 - u, 3);
const eInCubic = (u) => u * u * u;
const eInOutCubic = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const eInOutQuint = (u) => (u < 0.5 ? 16 * u ** 5 : 1 - Math.pow(-2 * u + 2, 5) / 2);
const eOutBack = (u, s = 1.6) => 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2);
const eOutElastic = (u) => (u === 0 || u === 1 ? u : Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1);
/* eased segment helper */
const seg = (t, a, b, ease = eOutCubic) => ease(inv(t, a, b));
/* in-and-out envelope: 0 -> 1 -> 0 */
const env = (t, a, b, c, d, eIn = eOutCubic, eOut = eInCubic) =>
  t < c ? eIn(inv(t, a, b)) : 1 - eOut(inv(t, c, d));
const rnd = (i) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const st = (n, o) => { if (n) Object.assign(n.style, o); };
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const money = (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intfmt = (v) => Math.round(v).toLocaleString('en-US');

/* ================= beat sheet (seconds) ================= */
const B = {
  hook: [0.0, 4.0],
  title: [4.0, 5.4],
  cash: [5.4, 12.6],
  skip: [12.6, 18.2],
  boost: [18.2, 22.8],
  outro: [22.8, 27.0],
};
const DUR = 27.0;

/* ================= build the phone ================= */
const PW = 447, PH = 936, DEPTH = 24;
/* No 3D extrusion for the body. Chromium's preserve-3d compositor sorts an
   extra slab in front of the face on one side and tears a wedge across the
   screen; at the yaw angles used here a real extrusion would contribute only
   ~5px of visible edge anyway, so the body reads from the chamfer highlight
   and drop shadow on #face instead. */

const screensHost = document.getElementById('screens');
const scCash = buildCashback();
const scSav = buildSavings();
const scTier = buildTier();
screensHost.append(scCash, scSav, scTier);

/* ================= floating 3D layer ================= */
const float3d = document.getElementById('float3d');

/* brand chips that fly out of the cashback screen */
const CHIP_KEYS = ['netflix', 'spotify', 'claude', 'openai', 'disney', 'gemini', 'ytmusic', 'hbo'];
/* fixed [x, y, z] slots — hand-placed so nothing overlaps or leaves frame */
const CHIP_SLOTS = [
  [-286, -280, 150], [292, -338, 120], [-306, -58, 130], [300, -116, 155],
  [-280, 158, 110], [298,  98, 140], [-268, 292,  95], [288, 258, 105],
];
const chips = CHIP_KEYS.map((k, i) => {
  const b = BRANDS[k];
  const c = document.createElement('div');
  c.className = 'chip3d';
  c.innerHTML = `<img src="${b.src}"><span>${b.nm}</span><span class="pc">25%</span>`;
  float3d.appendChild(c);
  return c;
});

/* the skip-the-line card, lifted out of the screen in 3D */
const tierFloat = document.createElement('div');
tierFloat.className = 'tierCard';
tierFloat.id = 'tierFloat';
tierFloat.style.position = 'absolute';
tierFloat.style.left = '50%';
tierFloat.style.top = '50%';
tierFloat.style.willChange = 'transform, opacity';
tierFloat.style.boxShadow = '0 60px 120px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.09)';
tierFloat.innerHTML = tierCardHTML();
/* the floating clone owns the animated ids; neutralise the inline copy's */
scTier.querySelectorAll('#tierFill,#tierNum,#tierNeed,#badgeUltra,#badgePrime').forEach((n) => (n.id = 'x' + n.id));
float3d.appendChild(tierFloat);

/* depth particles */
const PARTS = 34;
const parts = [];
for (let i = 0; i < PARTS; i++) {
  const p = document.createElement('div');
  const sz = 3 + rnd(i) * 6;
  st(p, {
    position: 'absolute', left: '50%', top: '50%', width: sz + 'px', height: sz + 'px',
    borderRadius: '50%', background: rnd(i + 99) > 0.72 ? 'rgba(215,156,253,.85)' : 'rgba(148,242,127,.85)',
    willChange: 'transform, opacity', pointerEvents: 'none',
  });
  float3d.appendChild(p);
  parts.push(p);
}

/* ================= type layers ================= */
const typeLayer = document.getElementById('typeLayer');
const mkType = (cls, css, html) => {
  const n = document.createElement('div');
  n.className = 'type ' + cls;
  Object.assign(n.style, css);
  n.innerHTML = html;
  typeLayer.appendChild(n);
  return n;
};

const hookKicker = mkType('kicker', { top: '520px' }, 'You already pay for');
const hookBrandWrap = mkType('', { top: '590px' }, '');
const HOOK_BRANDS = ['netflix', 'spotify', 'claude'];
const hookBrands = HOOK_BRANDS.map((k) => {
  const d = document.createElement('div');
  d.style.position = 'absolute';
  d.style.left = '0';
  d.style.width = '100%';
  d.style.willChange = 'transform, opacity';
  d.innerHTML = `<img src="${BRANDS[k].src}" style="width:96px;height:96px;object-fit:contain;display:block;margin:0 auto 26px">
                 <div class="head" style="font-size:86px">${BRANDS[k].nm.toUpperCase()}</div>`;
  hookBrandWrap.appendChild(d);
  return d;
});

const hookPay = mkType('head', { top: '520px', fontSize: '96px' },
  `<span class="word">NOW</span> <span class="word">THEY</span><br><em><span class="word">PAY</span> <span class="word">YOU</span> <span class="word">BACK</span></em><span class="word">.</span>`);
const hookPayWords = Array.from(hookPay.querySelectorAll('.word'));

const titleMark = mkType('', { top: '446px' }, `<div style="width:186px;height:186px;margin:0 auto">${solidMark('#94f27f', 0.42)}</div>`);
const titleWm = mkType('', { top: '650px' }, `<img src="assets/logos/solid-4x.png" style="width:330px;display:block;margin:0 auto">`);
const titleKick = mkType('kicker', { top: '790px', color: '#fff', letterSpacing: '14px' }, 'REWARDS');

/* ================= outro ================= */
const ICON = {
  pct: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><circle cx="7.5" cy="7.5" r="3" stroke="#94f27f" stroke-width="2"/><circle cx="16.5" cy="16.5" r="3" stroke="#94f27f" stroke-width="2"/><path d="M19 5 5 19" stroke="#94f27f" stroke-width="2" stroke-linecap="round"/></svg>`,
  bolt: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="#94f27f"/></svg>`,
  rise: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M3 17l5.5-5.5 3.5 3.5L21 6" stroke="#94f27f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 6h6v6" stroke="#94f27f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
const FEATS = [
  { t: '25% Subscription Cashback', s: 'AI, streaming & music — paid to Savings', ic: ICON.pct, soon: false },
  { t: 'Skip the Line', s: 'Hold FUSE, unlock Prime & Ultra instantly', ic: ICON.bolt, soon: false },
  { t: 'Yield Boost', s: 'Up to +2% on your Savings balance', ic: ICON.rise, soon: true },
];
const featsHost = document.getElementById('feats');
const featEls = FEATS.map((f, i) => {
  const d = document.createElement('div');
  d.className = 'feat';
  d.innerHTML = `<div class="fi">${f.ic}</div>
    <div><div class="ft">${f.t}</div><div class="fs">${f.s}</div></div>
    ${f.soon ? '<div class="soon">Soon</div>' : ''}`;
  featsHost.appendChild(d);
  return d;
});
document.getElementById('lockMark').innerHTML = solidMark('#94f27f', 0.42);
$('#lockup .tag').textContent = 'Rewards. Live now.';

/* ================= grain ================= */
const grainCv = document.getElementById('grain');
{
  const tile = document.createElement('canvas');
  tile.width = tile.height = 220;
  const c = tile.getContext('2d');
  const img = c.createImageData(220, 220);
  for (let i = 0; i < 220 * 220; i++) {
    const v = 90 + Math.floor(rnd(i * 1.37) * 76);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  const url = tile.toDataURL();
  const g = document.createElement('div');
  g.id = 'grain';
  st(g, { position: 'absolute', inset: '0', backgroundImage: `url(${url})`, backgroundRepeat: 'repeat', opacity: '.06', mixBlendMode: 'overlay', pointerEvents: 'none' });
  grainCv.replaceWith(g);
}
const grain = document.getElementById('grain');

/* cached nodes */
const N = {
  phoneWrap: $('#phoneWrap'), phone: $('#phone'), face: $('#face'), shadow: $('#shadow'),
  glare: $('#glare'), sheen: $('#sheen'), sweep: $('#sweep'), flash: $('#flash'), fade: $('#fade'),
  blobA: $('#blobA'), blobB: $('#blobB'), blobC: $('#blobC'), floorGlow: $('#floorGlow'),
  pctWrap: $('#pctWrap'), pct: $('#pct'), pctSub: $('#pctSub'),
  capWrap: $('#capWrap'), capTitle: $('#capTitle'), capSub: $('#capSub'),
  stamp: $('#stamp'), outro: $('#outro'), lockup: $('#lockup'), feats: featsHost,
  savBal: $('#savBal'), savApy: $('#savApy'), savEarn: $('#savEarn'),
  cardBoost: $('#cardBoost'), boostChip: $('#boostChip'), claimBtn: $('#claimBtn'),
  tierFill: $('#tierFill'), tierNum: $('#tierNum'), tierNeed: $('#tierNeed'),
  badgeUltra: $('#badgeUltra'), tierInline: $('#tierCardInline'),
  cashGroups: $$('#scCash .grp'), cashRows: $$('#scCash .row'),
  cashH1: $('#scCash h1'), cashSub: $('#scCash .sub'), cashGem: $('#scCash .gem'),
  cashCta: $('#scCash .cta'), cashFoot: $('#scCash .foot'),
};

/* ---------------- caption helper ---------------- */
function caption(t, a, b, c, d, title, sub) {
  const on = env(t, a, b, c, d, eOutQuint, eInCubic);
  const upIn = 1 - seg(t, a, b, eOutQuint);
  const upOut = seg(t, c, d, eInCubic);
  st(N.capWrap, {
    opacity: String(on),
    top: '1092px',
    transform: `translateY(${upIn * 46 - upOut * 30}px)`,
  });
  if (on > 0.001) {
    if (N.capTitle.innerHTML !== title) N.capTitle.innerHTML = title;
    if (N.capSub.innerHTML !== sub) N.capSub.innerHTML = sub;
  }
}
function hideCaption() { st(N.capWrap, { opacity: '0' }); }

/* ---------------- screen switching ---------------- */
function showScreen(which, scrollY = 0) {
  [['cash', scCash], ['sav', scSav], ['tier', scTier]].forEach(([k, el]) => {
    const on = k === which;
    st(el, { opacity: on ? '1' : '0', transform: `translateY(${on ? -scrollY : 0}px)` });
  });
}

/* ================================================================
   MAIN SEEK
   ================================================================ */
function seek(t) {
  t = clamp(t, 0, DUR);

  /* Text counters must advance on the OUTPUT frame grid, not the subsampled
     render grid: with motion-blur subsampling two subframes carrying different
     digits average into unreadable ghosting. Moving elements still use `t` and
     blur normally. */
  /* +0.5 phase so the groups line up with tmix's (i-1, i) pairing at 2x
     subsampling — otherwise every averaged pair straddles a value change. */
  const tq = Math.floor(t * 60 + 0.5 + 1e-6) / 60;

  /* ---------- ambient ---------- */
  const drift = t * 0.35;
  st(N.blobA, { transform: `translate3d(${Math.sin(drift) * 70}px, ${Math.cos(drift * 0.8) * 50}px, 0)`, opacity: '1' });
  st(N.blobB, { transform: `translate3d(${Math.cos(drift * 0.9) * 60}px, ${Math.sin(drift) * 60}px, 0)` });
  st(N.blobC, { transform: `translate3d(${Math.sin(drift * 1.2) * 55}px, ${Math.cos(drift) * 40}px, 0)` });
  const fi = Math.floor(t * 24);
  st(grain, { backgroundPosition: `${Math.floor(rnd(fi) * 220)}px ${Math.floor(rnd(fi + 7) * 220)}px` });

  /* ---------- defaults for this frame ---------- */
  let ph = { x: 0, y: 0, z: -2600, rx: 0, ry: -55, rz: 0, s: 1, op: 0, blur: 0 };
  let phoneVisible = false;
  hideCaption();
  st(N.pctWrap, { opacity: '0' });
  st(N.stamp, { opacity: '0' });
  st(N.outro, { opacity: '0' });
  st(N.sweep, { opacity: '0' });
  st(N.flash, { opacity: '0' });
  chips.forEach((c) => st(c, { opacity: '0' }));
  st(tierFloat, { opacity: '0' });
  [hookKicker, hookBrandWrap, hookPay, titleMark, titleWm, titleKick].forEach((n) => st(n, { opacity: '0' }));
  st(N.floorGlow, { opacity: '0' });

  /* particles: always drifting, faded by act */
  const partOn = clamp(inv(t, B.cash[0], B.cash[0] + 1.2) - inv(t, B.outro[0], B.outro[0] + 1.0));
  parts.forEach((p, i) => {
    const a = rnd(i) * Math.PI * 2;
    const rad = 420 + rnd(i + 3) * 560;
    const zz = -900 + rnd(i + 11) * 1500;
    const sp = 0.10 + rnd(i + 5) * 0.16;
    const x = Math.cos(a + t * sp) * rad;
    const y = Math.sin(a * 1.7 + t * sp * 0.8) * (rad * 0.62) - t * 12;
    st(p, {
      transform: `translate3d(${x}px, ${y}px, ${zz}px) translate(-50%,-50%)`,
      opacity: String(partOn * (0.22 + rnd(i + 21) * 0.55)),
    });
  });

  /* ================= ACT 0 — HOOK ================= */
  if (t < B.title[0]) {
    const k = env(t, 0.15, 0.85, 1.45, 1.85, eOutQuint, eInCubic);
    st(hookKicker, { opacity: String(k), transform: `translateY(${(1 - seg(t, 0.15, 0.9, eOutQuint)) * 26}px)`, top: '512px' });

    /* three brand words, hard cuts */
    const starts = [0.55, 1.12, 1.69];
    const HOLD = 0.5;
    st(hookBrandWrap, { opacity: '1' });
    hookBrands.forEach((d, i) => {
      const s0 = starts[i], s1 = s0 + HOLD;
      const on = t >= s0 && t < s1 + 0.14 ? 1 : 0;
      const u = seg(t, s0, s0 + 0.26, eOutExpo);
      const out = seg(t, s1, s1 + 0.14, eInCubic);
      st(d, {
        opacity: String(on * (1 - out)),
        transform: `translateY(${(1 - u) * 40 - out * 26}px) scale(${lerp(0.86, 1, u) * (1 - out * 0.06)})`,
        filter: `blur(${(1 - u) * 14}px)`,
      });
    });

    /* payoff line */
    const pOn = t >= 2.28;
    if (pOn) {
      st(hookPay, { opacity: '1', top: '500px' });
      hookPayWords.forEach((w, i) => {
        const s0 = 2.32 + i * 0.075;
        const u = seg(t, s0, s0 + 0.5, eOutExpo);
        const out = seg(t, 3.66, 3.98, eInCubic);
        st(w, {
          opacity: String(u * (1 - out)),
          transform: `translateY(${(1 - u) * 74 - out * 40}px) scale(${lerp(1.12, 1, u)})`,
          filter: `blur(${(1 - u) * 18}px)`,
        });
      });
      st(N.flash, { opacity: String(seg(t, 2.28, 2.34, eOutCubic) * (1 - seg(t, 2.34, 2.58, eOutCubic)) * 0.16) });
    }
    /* whip out */
    const wp = inv(t, 3.62, 4.0);
    if (wp > 0) st(N.sweep, { opacity: String(Math.sin(wp * Math.PI) * 0.85), transform: `translateX(${lerp(-60, 130, wp)}%) skewX(-14deg)` });
  }

  /* ================= ACT 1 — TITLE ================= */
  else if (t < B.cash[0]) {
    const a = B.title[0];
    const mu = seg(t, a + 0.02, a + 0.62, eOutExpo);
    const out = seg(t, a + 1.06, a + 1.4, eInCubic);
    st(titleMark, {
      opacity: String(mu * (1 - out)), top: '458px',
      transform: `translateY(${(1 - mu) * 40 - out * 24}px) scale(${lerp(0.62, 1, eOutBack(clamp(mu), 1.5)) * (1 - out * 0.08)}) rotate(${lerp(-22, 0, mu)}deg)`,
    });
    const wu = seg(t, a + 0.22, a + 0.82, eOutExpo);
    st(titleWm, { opacity: String(wu * (1 - out)), top: '648px', transform: `translateY(${(1 - wu) * 30 - out * 20}px)` });
    const ku = seg(t, a + 0.4, a + 1.0, eOutExpo);
    st(titleKick, { opacity: String(ku * 0.95 * (1 - out)), top: '788px', transform: `translateY(${(1 - ku) * 22}px)`, letterSpacing: `${lerp(30, 14, ku)}px` });
    const wp = inv(t, a + 1.04, a + 1.4);
    if (wp > 0) st(N.sweep, { opacity: String(Math.sin(wp * Math.PI) * 0.9), transform: `translateX(${lerp(-60, 130, wp)}%) skewX(-14deg)` });
  }

  /* ================= ACT 2 — CASHBACK ================= */
  else if (t < B.skip[0]) {
    phoneVisible = true;
    const a = B.cash[0];
    const fly = seg(t, a, a + 1.35, eOutQuint);
    const settle = seg(t, a + 0.5, a + 2.0, eOutCubic);

    /* screen scroll: drift down the sheet while the groups reveal */
    const scroll = lerp(0, 470, eInOutCubic(inv(t, a + 1.5, a + 4.6)));
    showScreen('cash', scroll);

    /* screen element reveals */
    const gemU = seg(t, a + 0.75, a + 1.25, eOutBack);
    st(N.cashGem, { opacity: String(gemU), transform: `scale(${lerp(0.5, 1, gemU)})` });
    const h1U = seg(t, a + 0.92, a + 1.5, eOutExpo);
    st(N.cashH1, { opacity: String(h1U), transform: `translateY(${(1 - h1U) * 26}px)` });
    st(N.cashSub, { opacity: String(seg(t, a + 1.05, a + 1.6, eOutExpo)) });
    N.cashGroups.forEach((g, i) => {
      const u = seg(t, a + 1.18 + i * 0.16, a + 1.78 + i * 0.16, eOutQuint);
      st(g, { opacity: String(u), transform: `translateY(${(1 - u) * 40}px)` });
    });
    N.cashRows.forEach((r, i) => {
      const u = seg(t, a + 1.32 + i * 0.055, a + 1.86 + i * 0.055, eOutQuint);
      st(r, { opacity: String(u), transform: `translateX(${(1 - u) * 26}px)` });
    });
    st(N.cashCta, { opacity: String(seg(t, a + 2.9, a + 3.5, eOutExpo)) });
    st(N.cashFoot, { opacity: String(seg(t, a + 2.8, a + 3.4, eOutExpo)) });

    /* ---- the 25% hero overlay ---- */
    const pOn = env(t, a + 2.55, a + 3.15, a + 4.15, a + 4.6, eOutQuint, eInCubic);
    const cU = clamp(inv(tq, a + 2.55, a + 3.9));
    const val = Math.round(lerp(0, 25, eOutExpo(cU)));
    if (pOn > 0.001) {
      N.pct.textContent = val + '%';
      const pu = seg(t, a + 2.55, a + 3.2, eOutQuint);
      st(N.pctWrap, {
        opacity: String(pOn), top: '408px',
        transform: `translateY(${(1 - pu) * 40}px) scale(${lerp(1.35, 1, pu)})`,
      });
      st(N.pctSub, { opacity: String(seg(t, a + 3.2, a + 3.7, eOutExpo)) });
    }

    /* ---- brand chips flying out ---- */
    chips.forEach((c, i) => {
      const slot = CHIP_SLOTS[i];
      const s0 = a + 3.9 + i * 0.075;
      const u = seg(t, s0, s0 + 1.1, eOutQuint);
      const out = seg(t, a + 6.55, a + 7.1, eInCubic);
      if (u <= 0.001 || out >= 1) { st(c, { opacity: '0' }); return; }
      const side = Math.sign(slot[0]);
      const bobX = Math.sin(t * 0.6 + i * 1.3) * 9;
      const bobY = Math.cos(t * 0.5 + i * 1.7) * 11;
      const x = slot[0] * lerp(0.16, 1, u) + bobX;
      const y = slot[1] * lerp(0.16, 1, u) + bobY;
      const z = lerp(-160, slot[2], u);
      st(c, {
        opacity: String(u * (1 - out)),
        transform: `translate3d(${x}px, ${y}px, ${z}px) rotateY(${-side * lerp(34, 11, u)}deg) rotateZ(${lerp(side * 7, side * 1.8, u)}deg) scale(${lerp(0.55, 1, u)}) translate(-50%,-50%)`,
      });
    });

    /* phone motion: fly in, then ease back while 25% takes over */
    const push = seg(t, a + 2.5, a + 3.4, eInOutCubic) * (1 - seg(t, a + 6.4, a + 7.2, eInOutCubic));
    ph = {
      x: lerp(0, -18, settle) + lerp(0, 6, push),
      y: lerp(60, 0, fly) + lerp(0, 168, push),
      z: lerp(-2600, 0, fly) + lerp(0, -430, push),
      rx: lerp(14, 4.5, fly) + lerp(0, 1.5, push),
      ry: lerp(-58, -14, fly) + lerp(0, 3, push) + Math.sin(t * 0.5) * 1.1,
      rz: lerp(-7, -1.2, fly),
      s: lerp(0.9, 1.0, fly),
      op: seg(t, a, a + 0.4, eOutCubic),
      blur: push * 5,
    };
    st(N.floorGlow, { opacity: String(seg(t, a + 0.6, a + 1.6) * 0.75) });
    caption(t, a + 5.3, a + 5.9, a + 6.9, a + 7.2,
      '<em>25%</em> back on subscriptions', 'Netflix · Spotify · Claude · OpenAI · and more');
    const wp = inv(t, a + 6.95, a + 7.2);
    if (wp > 0) st(N.sweep, { opacity: String(Math.sin(wp * Math.PI) * 0.9), transform: `translateX(${lerp(-60, 130, wp)}%) skewX(-14deg)` });
  }

  /* ================= ACT 3 — SKIP THE LINE ================= */
  else if (t < B.boost[0]) {
    phoneVisible = true;
    const a = B.skip[0];
    showScreen('tier', lerp(0, 150, eInOutCubic(inv(t, a + 1.0, a + 2.6))));

    const inU = seg(t, a, a + 0.9, eOutQuint);
    const lift = seg(t, a + 1.0, a + 2.0, eOutQuint);
    const outU = seg(t, a + 5.1, a + 5.6, eInCubic);

    /* inline card fades as the floating clone takes over */
    st(N.tierInline, { opacity: String(1 - seg(t, a + 1.0, a + 1.45, eOutCubic) * 0.82) });

    /* the floating card */
    if (lift > 0.001) {
      const fl = lift;
      const scl = lerp(1.0, 1.30, fl) * (1 - outU * 0.1);
      st(tierFloat, {
        opacity: String(fl * (1 - outU)),
        transform: `translate3d(${lerp(-30, 4, fl)}px, ${lerp(-150, -298, fl) - outU * 40}px, ${lerp(60, 300, fl)}px)
                    rotateY(${lerp(-16, -7, fl) + Math.sin(t * 0.55) * 1.6}deg) rotateX(${lerp(9, 3.4, fl)}deg)
                    scale(${scl}) translate(-50%,-50%)`,
      });
    }

    /* progress fill + counter */
    const gU = eInOutQuint(inv(tq, a + 2.15, a + 3.85));
    const cur = lerp(128000, 400000, gU);
    if (N.tierFill) st(N.tierFill, { width: `${lerp(32, 100, gU)}%` });
    if (N.tierNum) N.tierNum.textContent = intfmt(cur);
    if (N.tierNeed) N.tierNeed.textContent = intfmt(Math.max(0, 400000 - cur));
    /* unlocked badge pops the moment it tops out */
    const bU = seg(t, a + 3.8, a + 4.25, eOutElastic);
    if (N.badgeUltra) st(N.badgeUltra, { opacity: String(clamp(inv(t, a + 3.8, a + 3.95))), transform: `scale(${lerp(0.4, 1, clamp(bU))})` });
    st(N.flash, { opacity: String(seg(t, a + 3.8, a + 3.86, eOutCubic) * (1 - seg(t, a + 3.86, a + 4.12, eOutCubic)) * 0.13) });

    ph = {
      x: lerp(40, 22, inU), y: lerp(40, 26, inU) + lift * 226,
      z: lerp(-900, -240, inU) - lift * 210,
      rx: lerp(9, 5, inU), ry: lerp(30, 17, inU) + Math.sin(t * 0.45) * 1.2, rz: lerp(5, 1.6, inU),
      s: lerp(0.94, 1, inU), op: seg(t, a, a + 0.35, eOutCubic) * (1 - outU * 0.75),
      blur: lift * 1.1,
    };
    st(N.floorGlow, { opacity: '0.55' });
    caption(t, a + 4.15, a + 4.7, a + 5.35, a + 5.6,
      'Skip the <em>line</em>', 'Hold FUSE in Savings — unlock Prime &amp; Ultra');
    const wp = inv(t, a + 5.35, a + 5.6);
    if (wp > 0) st(N.sweep, { opacity: String(Math.sin(wp * Math.PI) * 0.9), transform: `translateX(${lerp(-60, 130, wp)}%) skewX(-14deg)` });
  }

  /* ================= ACT 4 — YIELD BOOST ================= */
  else if (t < B.outro[0]) {
    phoneVisible = true;
    const a = B.boost[0];
    const inU = seg(t, a, a + 0.95, eOutQuint);
    const scroll = lerp(0, 250, eInOutCubic(inv(t, a + 0.9, a + 2.1)));
    showScreen('sav', scroll);

    /* balance counts up */
    const cU = eOutExpo(inv(tq, a + 0.35, a + 1.7));
    N.savBal.textContent = money(lerp(8000, 8420.65, cU));
    N.savEarn.textContent = money(lerp(0, 420.65, cU));

    /* APY ticks up as the boost lands */
    const apU = inv(t, a + 2.35, a + 3.0);
    N.savApy.textContent = (lerp(4.5, 6.5, eOutExpo(inv(tq, a + 2.35, a + 3.0)))).toFixed(1) + '% APY';
    st(N.savApy, { transform: `scale(${1 + Math.sin(clamp(apU) * Math.PI) * 0.16})` });

    /* the yield-boost card highlights */
    const hl = env(t, a + 1.95, a + 2.4, a + 4.0, a + 4.4);
    st(N.cardBoost, {
      boxShadow: `0 0 ${hl * 70}px rgba(148,242,127,${hl * 0.5}), inset 0 0 0 ${hl * 2}px rgba(148,242,127,${hl * 0.85})`,
      transform: `scale(${1 + hl * 0.035})`,
    });
    const chU = seg(t, a + 2.25, a + 2.7, eOutElastic);
    st(N.boostChip, { transform: `scale(${lerp(0.5, 1, clamp(chU))})` });
    st(N.claimBtn, { transform: `scale(${1 + Math.sin(clamp(inv(t, a + 2.6, a + 3.4)) * Math.PI) * 0.09})` });

    /* coming-soon stamp */
    const sU = seg(t, a + 2.9, a + 3.5, eOutBack);
    const sOut = seg(t, a + 4.25, a + 4.6, eInCubic);
    if (sU > 0.001) {
      st(N.stamp, {
        opacity: String(clamp(sU) * (1 - sOut)),
        transform: `translate(-50%,-50%) translate(0px, 268px) rotate(${lerp(-13, -5.5, clamp(sU))}deg) scale(${lerp(1.5, 1, clamp(sU))})`,
        filter: `blur(${(1 - clamp(sU)) * 10}px)`,
      });
    }

    ph = {
      x: lerp(-40, -14, inU), y: lerp(30, 10, inU), z: lerp(-820, -170, inU),
      rx: lerp(10, 4, inU), ry: lerp(-32, -13, inU) + Math.sin(t * 0.5) * 1.1, rz: lerp(-5, -1.4, inU),
      s: lerp(0.94, 1, inU), op: seg(t, a, a + 0.35, eOutCubic),
      blur: 0,
    };
    st(N.floorGlow, { opacity: '0.5' });
    caption(t, a + 3.25, a + 3.8, a + 4.35, a + 4.6,
      '<em>Yield boost</em>', 'Earn more on the same balance — coming soon');
    const wp = inv(t, a + 4.35, a + 4.6);
    if (wp > 0) st(N.sweep, { opacity: String(Math.sin(wp * Math.PI) * 0.9), transform: `translateX(${lerp(-60, 130, wp)}%) skewX(-14deg)` });
  }

  /* ================= ACT 5 — OUTRO ================= */
  else {
    const a = B.outro[0];
    showScreen('cash', 470);
    const away = seg(t, a, a + 0.95, eInOutCubic);
    phoneVisible = away < 0.995;
    ph = {
      x: -14, y: lerp(10, 40, away), z: lerp(-170, -2100, away),
      rx: lerp(4, 12, away), ry: lerp(-13, -34, away), rz: -1.4,
      s: 1, op: 1 - away, blur: away * 6,
    };

    st(N.outro, { opacity: '1' });
    /* feature list flies in */
    const fOut = seg(t, a + 2.5, a + 2.95, eInCubic);
    st(N.feats, { top: '50%', transform: `translateY(-50%)`, opacity: String((1 - fOut)) });
    featEls.forEach((f, i) => {
      const s0 = a + 0.55 + i * 0.17;
      const u = seg(t, s0, s0 + 0.75, eOutQuint);
      st(f, {
        opacity: String(u * (1 - fOut)),
        transform: `translateX(${(1 - u) * 90}px) translateY(${-fOut * 24}px) scale(${lerp(0.94, 1, u)})`,
      });
    });

    /* lockup */
    const lu = seg(t, a + 2.75, a + 3.5, eOutQuint);
    st(N.lockup, {
      opacity: String(lu),
      transform: `translate(-50%,-50%) translateY(${(1 - lu) * 34}px) scale(${lerp(0.9, 1, lu)})`,
    });
    st(N.floorGlow, { opacity: String(0.5 * (1 - away) + lu * 0.35) });
    st(N.fade, { opacity: String(seg(t, DUR - 0.55, DUR, eInCubic)) });
  }

  /* ---------- commit phone transform ---------- */
  st(N.phoneWrap, {
    opacity: String(phoneVisible ? ph.op : 0),
    transform: `translate3d(${ph.x}px, ${ph.y}px, ${ph.z}px) rotateX(${ph.rx}deg) rotateY(${ph.ry}deg) rotateZ(${ph.rz}deg) scale(${ph.s}) translate(${-PW / 2}px, ${-PH / 2}px)`,
    filter: ph.blur > 0.01 ? `blur(${ph.blur}px)` : 'none',
  });
  /* glare tracks the phone's yaw so the glass reads as a real surface */
  st(N.glare, { opacity: String(clamp(0.2 + Math.abs(ph.ry) / 150, 0, 0.5)), transform: `translateX(${ph.ry * 1.6}px)` });
  /* contact shadow */
  const shOn = phoneVisible ? ph.op : 0;
  st(N.shadow, {
    opacity: String(shOn * 0.75),
    transform: `translate(-50%,-50%) translate3d(${ph.x * 0.6}px, ${ph.y * 0.5 + 480 * ph.s}px, ${ph.z}px) scaleX(${lerp(0.8, 1.15, clamp(1 - Math.abs(ph.ry) / 60))}) scale(${ph.s})`,
  });
  /* fade-out tail is handled in the outro branch; make sure it's cleared elsewhere */
  if (t < B.outro[0]) st(N.fade, { opacity: String(1 - seg(t, 0, 0.35, eOutCubic)) });
}

window.__seek = seek;
window.__duration = DUR;

/* wait for fonts + images before declaring ready */
Promise.all([
  document.fonts.ready,
  ...Array.from(document.images).map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = im.onerror = r; }))),
]).then(() => {
  seek(0);
  requestAnimationFrame(() => { window.__ready = true; });
});
