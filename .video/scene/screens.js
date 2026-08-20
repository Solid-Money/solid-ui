/* ------------------------------------------------------------------
   The three Figma screens, rebuilt as vector DOM so they stay crisp at
   any render scale and every element can be animated individually.
     - Cashback sheet          node 23714:4337
     - Savings / Yield boost   node 24023:1623
     - Skip the line card      node 24164:1934
   ------------------------------------------------------------------ */

export const L = (n) => `assets/logos/${n}.svg`;

/* Filenames in the repo don't all match their brand — verified by render:
   generic-1 Amazon · generic-2 YouTube · generic-3 OpenAI · generic-4 HBO Max
   generic-5 Apple · "openai" is actually Spotify */
export const BRANDS = {
  openai: { nm: 'OpenAI', src: L('logo-generic-3') },
  claude: { nm: 'Claude', src: L('logo-claude'), tint: '#d97757' },
  gemini: { nm: 'Gemini', src: L('logo-gemini') },
  netflix: { nm: 'Netflix', src: L('logo-netflix') },
  disney: { nm: 'Disney+', src: L('logo-disney-1') },
  hbo: { nm: 'HBO Max', src: L('logo-generic-4') },
  amazon: { nm: 'Amazon Prime', src: L('logo-generic-1') },
  appletv: { nm: 'Apple TV', src: L('logo-generic-5') },
  spotify: { nm: 'Spotify', src: L('logo-openai') },
  applemusic: { nm: 'Apple Music', src: L('logo-generic-5') },
  ytmusic: { nm: 'Youtube Music', src: L('logo-generic-2') },
};

export const GROUPS = [
  { label: 'AI', top: 316, h: 243, keys: ['openai', 'claude', 'gemini'] },
  { label: 'Streaming', top: 574, h: 352, keys: ['netflix', 'disney', 'hbo', 'amazon', 'appletv'] },
  { label: 'Music', top: 941, h: 243, keys: ['spotify', 'applemusic', 'ytmusic'] },
];

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const put = (parent, tag, cls, css, html) => {
  const n = el(tag, cls, html);
  Object.assign(n.style, css || {});
  parent.appendChild(n);
  return n;
};
const px = (v) => `${v}px`;

/* Solid brand mark — two rounded bars with a translucent connector */
export function solidMark(color = 'var(--brand)', op = 0.42) {
  return `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">
    <line x1="40" y1="56" x2="62" y2="47" stroke="${color}" stroke-opacity="${op}" stroke-width="21" stroke-linecap="round"/>
    <line x1="30" y1="45" x2="69" y2="32" stroke="${color}" stroke-width="21" stroke-linecap="round"/>
    <line x1="31" y1="68" x2="70" y2="55" stroke="${color}" stroke-width="21" stroke-linecap="round"/>
  </svg>`;
}

/* outlined gem used at the top of the cashback sheet */
function gemMark() {
  return `<svg viewBox="0 0 83 70" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
    <path d="M24 3 H59 L80.5 24 L41.5 66.5 L2.5 24 Z" stroke="#fff" stroke-width="2.1" stroke-linejoin="round"/>
    <path d="M45 21 C38.5 25 38.5 33 45 37" stroke="#fff" stroke-width="2.1" stroke-linecap="round"/>
  </svg>`;
}

function statusbar(dark = true) {
  return `<div class="statusbar">
    <div class="time">9:41</div>
    <div class="ind">
      <div class="bars"><i style="height:4px"></i><i style="height:6px"></i><i style="height:8.5px"></i><i style="height:11px"></i></div>
      <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M8 10.2l2.1-2.1a3 3 0 00-4.2 0L8 10.2z" fill="#fff"/><path d="M3.6 5.9a6.4 6.4 0 018.8 0" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><path d="M1.2 3.4a9.8 9.8 0 0113.6 0" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></svg>
      <div class="batt"></div>
    </div>
  </div>`;
}

/* =============================== CASHBACK =============================== */
export function buildCashback() {
  const s = el('div', 'sc screen');
  s.id = 'scCash';

  put(s, 'div', 'handle');
  put(s, 'div', 'gem', null, gemMark());
  put(s, 'h1', null, null, '<em>25%</em> Subscription<br>Cashback');
  put(s, 'div', 'sub', null, 'on AI, streaming, music');

  GROUPS.forEach((g, gi) => {
    const grp = put(s, 'div', 'grp card', { top: px(g.top), height: px(g.h) });
    grp.dataset.grp = gi;
    put(grp, 'div', 'hd sect', null, g.label);
    put(grp, 'div', 'divider');
    g.keys.forEach((k, i) => {
      const b = BRANDS[k];
      const r = put(grp, 'div', 'row', { top: px(78 + i * 55) });
      r.dataset.brand = k;
      const lg = put(r, 'div', 'lg');
      const im = put(lg, 'img', null, b.tint ? { filter: `drop-shadow(0 0 0 ${b.tint})` } : null);
      im.src = b.src;
      put(r, 'div', 'nm', null, b.nm);
      put(r, 'div', 'pill', null, '25%');
    });
  });

  put(s, 'div', 'foot', null,
    'Cashback is credited 14 days after the transaction settles and paid straight into your Savings <u>Learn more</u>');
  put(s, 'div', 'cta btn-brand', null, 'Get more cashback');
  return s;
}

/* =============================== SAVINGS =============================== */
const coinUSDC = `<svg viewBox="0 0 24 24" style="width:24px;height:24px"><circle cx="12" cy="12" r="12" fill="#2775CA"/><path d="M12 5.2v1.1c2 .3 3.3 1.5 3.3 3.1h-1.7c-.1-.9-.7-1.5-1.6-1.7v3.1c2.2.5 3.4 1.3 3.4 3 0 1.8-1.3 3-3.4 3.3v1.1h-1.1v-1.1c-2.1-.3-3.4-1.5-3.5-3.3h1.7c.1 1 .8 1.6 1.8 1.8v-3.2c-2.1-.5-3.3-1.3-3.3-3 0-1.7 1.3-2.9 3.3-3.1V5.2H12zm-1.1 2.5c-.9.2-1.5.7-1.5 1.5 0 .7.5 1.1 1.5 1.4V7.7zm1.1 5.1v3.2c1-.2 1.6-.7 1.6-1.6 0-.8-.5-1.2-1.6-1.6z" fill="#fff"/></svg>`;

export function buildSavings() {
  const s = el('div', 'sc screen');
  s.id = 'scSav';
  s.innerHTML = statusbar();

  put(s, 'div', 'circ', { left: '18px', top: '59px' },
    `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="7.4" r="3.6" stroke="#cfcfcf" stroke-width="1.7"/><path d="M4 18.6c0-3 3.1-4.8 7-4.8s7 1.8 7 4.8" stroke="#cfcfcf" stroke-width="1.7" stroke-linecap="round"/></svg>`);
  put(s, 'div', 'circ', { left: '357px', top: '59px', fontSize: '18px', fontWeight: 600 }, '?');

  put(s, 'div', 'balLabel', null, 'Savings Balance');
  const bal = put(s, 'div', 'bal', null, '$8,420.65');
  bal.id = 'savBal';

  const rates = put(s, 'div', 'rates');
  const mk = (icon, txt, id) => {
    const r = put(rates, 'div', 'rate');
    r.id = id;
    r.innerHTML = `${icon}<span>${txt}</span>`;
    return r;
  };
  mk(coinUSDC, '4.5%', 'rateA');
  mk(`<i style="background:var(--brand)"></i>`, '15%', 'rateB');
  mk(`<i style="background:var(--points)"></i>`, '2.5%', 'rateC');

  put(s, 'div', 'act', { left: '18px', background: '#fff', color: '#0d0d0d' }, 'Deposit');
  put(s, 'div', 'act', { left: '217px', background: 'var(--card)', color: '#fff' }, 'Withdraw');

  /* --- USDC savings breakdown --- */
  const c1 = put(s, 'div', 'card', { position: 'absolute', left: '16px', top: '411px', width: '385px', height: '263px' });
  c1.id = 'cardUsdc';
  put(c1, 'div', null, { position: 'absolute', left: '20px', top: '19px' }, coinUSDC);
  put(c1, 'div', null, { position: 'absolute', left: '52px', top: '21px', fontSize: '17px', fontWeight: 600 }, 'USDC savings');
  const apy = put(c1, 'div', null, { position: 'absolute', right: '20px', top: '22px', fontSize: '15px', fontWeight: 600, color: 'var(--brand)' }, '4.5% APY');
  apy.id = 'savApy';
  put(c1, 'div', 'divider', { position: 'absolute', left: 0, top: '64px', width: '385px' });
  const cell = (l, v, x, y, green) => {
    put(c1, 'div', 'kl', { position: 'absolute', left: px(x), top: px(y) }, l);
    const n = put(c1, 'div', 'kv', { position: 'absolute', left: px(x), top: px(y + 19), color: green ? 'var(--brand)' : '#fff' }, v);
    return n;
  };
  cell('Deposited', '$8,000.00', 20, 84);
  cell('Earnings', '$420.65', 205, 84).id = 'savEarn';
  cell('This month', '+$32.10', 20, 153, true);
  cell('Next 30 days (est.)', '+$31.60', 205, 153, true);
  put(c1, 'div', 'divider', { position: 'absolute', left: 0, top: '215px', width: '385px' });
  put(c1, 'div', 'kl', { position: 'absolute', left: '20px', top: '232px' }, 'Available to withdraw');
  put(c1, 'div', null, { position: 'absolute', right: '20px', top: '230px', fontSize: '15px', fontWeight: 600 }, '$8,420.65');

  /* --- Yield boost --- */
  const c2 = put(s, 'div', 'card', { position: 'absolute', left: '16px', top: '696px', width: '387px', height: '137px' });
  c2.id = 'cardBoost';
  put(c2, 'div', null, { position: 'absolute', left: '20px', top: '18px', fontSize: '16px', fontWeight: 600 }, 'Yield boost');
  put(c2, 'div', 'divider', { position: 'absolute', left: 0, top: '54px', width: '385px' });
  put(c2, 'div', 'kl', { position: 'absolute', left: '20px', top: '73px' }, 'Boost amount');
  const boostChip = put(c2, 'div', null, {
    position: 'absolute', left: '20px', top: '94px', height: '23px', padding: '0 11px', borderRadius: '12px',
    background: '#fff', color: '#0d0d0d', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center',
  }, '+2% Boost');
  boostChip.id = 'boostChip';
  put(c2, 'div', 'kl', { position: 'absolute', left: '160px', top: '73px' }, 'Total Earned');
  put(c2, 'div', null, { position: 'absolute', left: '160px', top: '92px', fontSize: '22px', fontWeight: 600 }, '$420.65');
  const claim = put(c2, 'div', 'btn-brand', { position: 'absolute', left: '286px', top: '75px', width: '81px', height: '40px', borderRadius: '20px', fontSize: '15px' }, 'Claim');
  claim.id = 'claimBtn';

  /* --- recent activity --- */
  put(s, 'div', 'sect', { position: 'absolute', left: '16px', top: '875px' }, 'Recent activity');
  put(s, 'div', 'sect', { position: 'absolute', right: '18px', top: '875px', fontSize: '14px' }, 'See all');
  const c3 = put(s, 'div', 'card', { position: 'absolute', left: '16px', top: '905px', width: '387px', height: '149px' });
  const act = (t, d, v, y, green) => {
    put(c3, 'div', null, { position: 'absolute', left: '20px', top: px(y), fontSize: '16px', fontWeight: 500 }, t);
    put(c3, 'div', 'kl', { position: 'absolute', left: '20px', top: px(y + 22) }, d);
    put(c3, 'div', null, { position: 'absolute', right: '22px', top: px(y + 6), fontSize: '16px', fontWeight: 600, color: green ? 'var(--brand)' : '#fff' }, v);
  };
  act('Interest earned', 'Today', '+$1.04', 18, true);
  put(c3, 'div', 'divider', { position: 'absolute', left: 0, top: '74px', width: '387px' });
  act('Added funds', 'Jul 12', '$8,000.00', 92, false);

  /* --- tab bar --- */
  const tb = put(s, 'div', 'tabbar');
  const tab = (icon, label, on) => {
    const t = put(tb, 'div', 'tab' + (on ? ' on' : ''));
    t.innerHTML = `<div class="ic">${icon}</div><div>${label}</div>`;
  };
  tab(`<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`, 'Wallet', false);
  tab(`<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor"/></svg>`, 'Savings', true);
  tab(`<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2.5l2.6 6 6.4.5-4.9 4.2 1.5 6.3L12 16.1 6.4 19.5l1.5-6.3L3 9l6.4-.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`, 'Tier', false);

  return s;
}

/* ====================== SKIP THE LINE (tier screen) ====================== */
export function tierCardHTML() {
  return `<div class="hdr">
      <div class="ic">${solidMark('#94f27f', 0.42)}</div>
      <div class="t1">Unlock a tier with FUSE</div>
      <div class="t2">Deposit FUSE in savings to upgrade your tier</div>
      <div class="new">New</div>
    </div>
    <div class="divider"></div>
    <div class="tier" style="height:76px">
      <div class="nm">Prime</div>
      <div class="sb">50,000 FUSE</div>
      <div class="badge" id="badgePrime">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 6.2l3 3 6-6.4" stroke="#94f27f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>Unlocked</span>
      </div>
    </div>
    <div class="divider"></div>
    <div class="tier" style="height:99px">
      <div class="nm">Ultra</div>
      <div class="sb"><b id="tierNum">128,000</b> / 400,000 · <span id="tierNeed">272,000</span> needed to upgrade</div>
      <div class="badge" id="badgeUltra" style="background:rgba(148,242,127,.16);opacity:0">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 6.2l3 3 6-6.4" stroke="#94f27f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>Unlocked</span>
      </div>
      <div class="track" style="top:75px"><div class="fill" id="tierFill"></div></div>
    </div>`;
}

export function buildTier() {
  const s = el('div', 'sc screen');
  s.id = 'scTier';
  s.style.height = '908px';
  s.innerHTML = statusbar();

  put(s, 'div', null, { position: 'absolute', left: '20px', top: '76px', fontSize: '34px', fontWeight: 700, letterSpacing: '-1px' }, 'Rewards');
  put(s, 'div', 'sect', { position: 'absolute', left: '20px', top: '124px' }, 'Your tier progress');

  const holder = put(s, 'div', null, { position: 'absolute', left: '16px', top: '166px' });
  holder.id = 'tierCardSlot';
  const c = put(holder, 'div', 'tierCard');
  c.id = 'tierCardInline';
  c.innerHTML = tierCardHTML();

  /* supporting rows kept deliberately quiet — the card is the subject */
  const ghosts = put(s, 'div', null, { position: 'absolute', left: '16px', top: '460px', width: '387px', opacity: '.85' });
  [['Save', 'Earn points on every deposit'], ['Spend', 'Points on every card payment'], ['Invite', 'Points for every friend']].forEach((r, i) => {
    const g = put(ghosts, 'div', 'card', { position: 'relative', height: '84px', marginBottom: '14px' });
    put(g, 'div', null, { position: 'absolute', left: '20px', top: '22px', width: '40px', height: '40px', borderRadius: '12px', background: '#262626' });
    put(g, 'div', null, { position: 'absolute', left: '76px', top: '24px', fontSize: '16px', fontWeight: 600 }, r[0]);
    put(g, 'div', 'sect', { position: 'absolute', left: '76px', top: '46px', fontSize: '14px' }, r[1]);
  });

  return s;
}
