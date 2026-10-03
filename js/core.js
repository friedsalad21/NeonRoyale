'use strict';
// Neon Royale shared core: wallet, chips, bets, cards, sound, wheels, lobby and router.
// Each game file pushes {id, name, ..., mount(shell)} onto Casino.games; mount may return a cleanup fn.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// importNode so elements (canvases especially) belong to the live document; template-owned canvases can't draw text
const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return document.importNode(t.content, true).firstElementChild; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = n => Math.floor(Math.random() * n);
const round2 = n => Math.round(n * 100) / 100;
const fmt = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const fmt2 = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const store = {
  get(k, d) { try { const v = localStorage.getItem('neonroyale.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('neonroyale.' + k, JSON.stringify(v)); } catch {} },
};

// ---------- sound (tiny WebAudio blips, no files) ----------
let actx = null, muted = store.get('mute', false);
function tone(freq, dur, type = 'sine', vol = 0.06, delay = 0) {
  if (muted) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch {}
}
const sfx = {
  chip: () => { tone(2400, .04, 'square', .02); tone(1700, .05, 'square', .02, .03); },
  card: () => tone(300, .06, 'triangle', .07),
  tick: () => tone(1100, .02, 'square', .015),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .18, 'triangle', .07, i * .08)),
  big: () => [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, .22, 'square', .04, i * .1)),
  lose: () => { tone(220, .2, 'sawtooth', .03); tone(165, .3, 'sawtooth', .03, .15); },
  no: () => tone(130, .15, 'square', .04),
  roll: () => { for (let i = 0; i < 10; i++) tone(180 + rnd(500), .03, 'square', .02, i * .05); },
};

// ---------- wallet ----------
const START = 1000;
const Casino = {
  games: [],
  hotkey: null,
  bal: store.get('bal', START),
  chip: store.get('chip', 25),
  setBal(v) {
    this.bal = round2(v); store.set('bal', this.bal);
    const el = $('#bal'); el.textContent = fmt(this.bal);
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  },
  take(n) {
    n = round2(n);
    if (n > this.bal + 1e-9) { toast('Not enough chips. Visit the Cashier.', 'bad'); sfx.no(); return false; }
    this.setBal(this.bal - n); return true;
  },
  pay(n) { if (n > 0) this.setBal(this.bal + n); },
};

const JP_SEED = 250000;
const Jackpot = {
  get v() { return store.get('jp', JP_SEED); },
  add(n) { store.set('jp', round2(this.v + n)); },
  reset() { store.set('jp', JP_SEED); },
};

// ---------- feedback ----------
function toast(msg, kind = '') {
  const t = h(`<div class="toast ${kind}"></div>`); t.textContent = msg;
  $('#toast').append(t); setTimeout(() => t.remove(), 2600);
}
function banner(text, sub = '') {
  const b = h(`<div class="banner">${text}${sub ? `<small>${sub}</small>` : ''}</div>`);
  document.body.append(b); setTimeout(() => b.remove(), 2200);
}
function coinShower(n = 40) {
  for (let i = 0; i < n; i++) {
    const c = h(`<div class="coin">${Math.random() < .5 ? '🪙' : '💰'}</div>`);
    c.style.left = Math.random() * 100 + 'vw';
    c.style.animationDuration = 1.5 + Math.random() * 2 + 's';
    c.style.animationDelay = Math.random() * .8 + 's';
    document.body.append(c); setTimeout(() => c.remove(), 4500);
  }
}
// Pays out `paid` (stake included) against `staked` and shows the result.
function settle(paid, staked, label = '') {
  paid = round2(paid);
  Casino.pay(paid);
  const net = round2(paid - staked);
  if (net > 0) {
    const big = net >= staked * 10;
    banner('WIN ' + fmt(net), label); (big ? sfx.big : sfx.win)();
    if (big) coinShower();
  } else if (net === 0 && paid > 0) { banner('PUSH', label); sfx.tick(); }
  else if (paid > 0) sfx.tick();
  else if (staked > 0) sfx.lose();
  return net;
}
function modal(title, html) {
  const m = h(`<div class="modal"><div class="box"><button class="x" aria-label="Close">×</button><h2>${title}</h2><div class="body">${html}</div></div></div>`);
  m.onclick = e => { if (e.target === m || e.target.classList.contains('x')) m.remove(); };
  document.body.append(m); return m;
}
function button(label, cls, fn) { const b = h(`<button class="btn ${cls}">${label}</button>`); b.onclick = fn; return b; }

// ---------- chips & bets ----------
const CHIPS = [1, 5, 25, 100, 500, 1000, 5000];
const CHIP_STYLE = { 1: '--c:#f4f4f4;--t:#222;--s:#1f5fd6', 5: '--c:#d32f2f', 25: '--c:#1b9e4b', 100: '--c:#1a1a1a', 500: '--c:#7b3fd1', 1000: '--c:#f2b705;--t:#222;--s:#1a1a1a', 5000: '--c:#e05297' };
const short = n => n >= 1e6 ? +(n / 1e6).toFixed(1) + 'M' : n >= 1000 ? +(n / 1000).toFixed(1) + 'K' : String(+n.toFixed(2));
function chipHTML(amount, cls = '') {
  let c = CHIPS[0]; for (const v of CHIPS) if (amount >= v) c = v;
  return `<div class="chip ${cls}" style="${CHIP_STYLE[c]}"><span>${short(amount)}</span></div>`;
}
function chipRack() {
  const el = h('<div class="rack" title="Pick a chip, then click the table"></div>');
  for (const v of CHIPS) {
    const c = h(chipHTML(v, 'pick')); if (v === Casino.chip) c.classList.add('sel');
    c.onclick = () => { Casino.chip = v; store.set('chip', v); $$('.chip', el).forEach(x => x.classList.toggle('sel', x === c)); sfx.chip(); };
    el.append(c);
  }
  return el;
}
// Chips leave the wallet when placed; the round pays back stake + winnings.
class Bets {
  constructor(onChange = () => {}) { this.m = {}; this.spots = {}; this.locked = false; this.last = null; this.onChange = onChange; }
  canBet() { return true; }
  canRemove() { return true; }
  bind(key, el) {
    this.spots[key] = el; el.classList.add('spot');
    el.addEventListener('click', e => { e.preventDefault(); this.add(key); });
    el.addEventListener('contextmenu', e => { e.preventDefault(); this.remove(key); });
  }
  get total() { return round2(Object.values(this.m).reduce((a, b) => a + b, 0)); }
  add(key, amt = Casino.chip) {
    if (this.locked || !this.canBet(key)) { sfx.no(); return false; }
    if (!Casino.take(amt)) return false;
    this.m[key] = (this.m[key] || 0) + amt; sfx.chip(); this.render(); return true;
  }
  remove(key) {
    if (this.locked || !this.m[key] || !this.canRemove(key)) return;
    Casino.pay(this.m[key]); delete this.m[key]; sfx.chip(); this.render();
  }
  clear() {
    if (this.locked) return;
    for (const k of Object.keys(this.m)) if (this.canRemove(k)) { Casino.pay(this.m[k]); delete this.m[k]; }
    this.render();
  }
  save() { if (this.total) this.last = { ...this.m }; }
  rebet() {
    if (this.locked || !this.last) return;
    this.clear();
    const t = Object.values(this.last).reduce((a, b) => a + b, 0);
    if (!Casino.take(t)) return;
    this.m = { ...this.last }; sfx.chip(); this.render();
  }
  double() {
    const t = this.total; if (this.locked || !t || !Casino.take(t)) return;
    for (const k in this.m) this.m[k] *= 2; sfx.chip(); this.render();
  }
  render() {
    for (const [k, el] of Object.entries(this.spots)) {
      const old = el.querySelector(':scope > .stack'), v = this.m[k];
      if (old && old.dataset.v == v) continue;
      old?.remove();
      if (v) { const s = h(`<div class="stack">${chipHTML(v)}</div>`); s.dataset.v = v; el.append(s); }
    }
    this.onChange();
  }
}
// Standard betting buttons used by most table games.
function betButtons(bets) {
  return [button('Clear', 'ghost', () => bets.clear()), button('Rebet', 'ghost', () => bets.rebet()), button('×2', 'ghost', () => bets.double())];
}

// ---------- cards ----------
const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function makeShoe(decks) {
  const a = [];
  for (let d = 0; d < decks; d++) for (const s of SUITS) for (const r of RANKS) a.push({ r, s });
  return shuffle(a);
}
function cardEl(c, down = false) {
  const red = c.s === '♥' || c.s === '♦', s = c.s + '︎', face = 'JQK'.includes(c.r) && c.r.length === 1;
  return h(`<div class="card ${red ? 'red' : ''} ${down ? 'down' : ''}">
    <span class="tl">${c.r}<br>${s}</span><span class="mid ${face ? 'face' : ''}">${face ? c.r + s : s}</span><span class="br">${c.r}<br>${s}</span><div class="back"></div></div>`);
}
function reveal(el) { if (!el || !el.classList.contains('down')) return; el.classList.remove('down'); el.classList.add('flip'); sfx.card(); }

// ---------- wheels (roulette, big six) ----------
// Segment i is centred at i * 360/n degrees clockwise from the top.
function drawWheel(cv, segs, { text = 22, rim = .84, hub = .35, radial = false } = {}) {
  const ctx = cv.getContext('2d'), s = cv.width, r = s / 2, n = segs.length, step = Math.PI * 2 / n;
  ctx.clearRect(0, 0, s, s); ctx.save(); ctx.translate(r, r);
  segs.forEach((g, i) => {
    const a0 = -Math.PI / 2 + i * step - step / 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r * .99, a0, a0 + step); ctx.closePath();
    ctx.fillStyle = g.color; ctx.fill(); ctx.strokeStyle = '#d4af37'; ctx.lineWidth = s / 300; ctx.stroke();
    ctx.save(); ctx.rotate(a0 + step / 2 + Math.PI / 2); ctx.translate(0, -r * rim);
    if (radial) ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = g.fg || '#fff'; ctx.font = `bold ${text * s / 560}px Oswald, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(g.label, 0, 0); ctx.restore();
  });
  const grd = ctx.createRadialGradient(-r * .08, -r * .08, r * .02, 0, 0, r * hub);
  grd.addColorStop(0, '#fff3b0'); grd.addColorStop(.5, '#d4af37'); grd.addColorStop(1, '#6b4a0a');
  ctx.beginPath(); ctx.arc(0, 0, r * hub, 0, Math.PI * 2); ctx.fillStyle = grd; ctx.fill();
  ctx.lineWidth = s / 120; ctx.strokeStyle = '#3a1d0c'; ctx.stroke();
  ctx.restore();
}
function spinner(el, n) {
  let rot = 0;
  return async (i, ms = 5000, spins = 5) => {
    const step = 360 / n, jitter = (Math.random() - .5) * step * .6;
    rot += spins * 360 + ((((-i * step + jitter - rot) % 360) + 360) % 360);
    el.style.transition = `transform ${ms}ms cubic-bezier(.12,.7,.2,1)`;
    el.style.transform = `rotate(${rot}deg)`;
    ticker(ms); await sleep(ms);
  };
}
async function ticker(ms) { let t = 0, d = 35; while (t < ms - 150) { sfx.tick(); await sleep(d); t += d; d *= 1.06; } }

// ---------- lobby ----------
function home(view) {
  const el = h(`<section class="home">
    <div class="marquee"><div class="bulbs"></div>
      <p class="welcome">Welcome to fabulous</p>
      <h1 class="title">NEON <em>ROYALE</em></h1>
      <p class="sub">Casino · Las Vegas · Open 24/7</p>
      <div class="jackpot"><span>Progressive Jackpot</span><b class="jp"></b></div>
      <div class="perks"><span>🎁 Free chips at the Cashier</span><span>🎰 Jackpot grows with every spin</span><span>🃏 ${Casino.games.filter(g => !g.hall).length - 1} table games + ${SlotEngine.MACHINES.length} slots</span></div>
    </div>
    <h2 class="section">Choose your game</h2>
    <div class="grid"></div>
  </section>`);
  // marquee bulbs around the frame, alternating odd/even blink
  const bulbs = $('.bulbs', el), N = 24, M = 7, pts = [];
  for (let i = 0; i < N; i++) pts.push([i / N * 100, 0]);
  for (let i = 0; i < M; i++) pts.push([100, i / M * 100]);
  for (let i = 0; i < N; i++) pts.push([100 - i / N * 100, 100]);
  for (let i = 0; i < M; i++) pts.push([0, 100 - i / M * 100]);
  for (const [x, y] of pts) { const b = h('<i class="bulb"></i>'); b.style.left = x + '%'; b.style.top = y + '%'; bulbs.append(b); }

  const grid = $('.grid', el);
  for (const g of Casino.games.filter(g => !g.hall)) {
    const c = h(`<a class="gcard" href="#${g.id}" style="--a:${g.accent}"><span class="tag">${g.tag}</span><div class="art"></div><span class="play">Play</span><div class="info"><h3>${g.name}</h3><p>${g.blurb}</p></div></a>`);
    const art = $('.art', c); g.art ? art.append(g.art()) : art.append(h(`<span>${g.icon}</span>`));
    grid.append(c);
  }
  view.append(el);
  const jp = $('.jp', el), tick = () => { Jackpot.add(Math.random() * .9); jp.textContent = fmt2(Jackpot.v); };
  tick(); const iv = setInterval(tick, 120);
  return () => clearInterval(iv);
}

function cashier() {
  const m = modal('Cashier', `<p>Your balance: <b class="gold">${fmt(Casino.bal)}</b></p>
    <p>Running low? The house will top you back up to <b class="gold">${fmt(START)}</b>, on us. Every chip here is play money.</p>
    <button class="btn green">Top up to ${fmt(START)}</button>`);
  const b = $('.btn', m); b.disabled = Casino.bal >= START;
  b.onclick = () => { Casino.setBal(START); sfx.win(); m.remove(); toast('Chips topped up. Good luck!'); };
}

// ---------- router ----------
let cleanup = null;
function route() {
  cleanup?.(); cleanup = null; Casino.hotkey = null;
  const view = $('#view'); view.innerHTML = ''; scrollTo(0, 0);
  const g = Casino.games.find(g => g.id === location.hash.slice(1));
  document.title = g ? `${g.name} · Neon Royale` : 'Neon Royale Casino';
  if (!g) { cleanup = home(view); return; }
  const el = h(`<section class="game ${g.id}">
    <div class="gbar"><a href="#${g.back || ''}" class="back">← ${g.back ? 'Slot Hall' : 'Lobby'}</a><h1>${g.name}</h1><button class="btn ghost small">Rules</button></div>
    <div class="table"></div><div class="controls"></div></section>`);
  $('.gbar .btn', el).onclick = () => modal(g.name, g.rules);
  view.append(el);
  cleanup = g.mount({ el, table: $('.table', el), controls: $('.controls', el) }) || null;
}

Casino.start = () => {
  Casino.setBal(Casino.bal);
  $('#cashier').onclick = cashier;
  const mb = $('#mute'), sync = () => mb.textContent = muted ? '🔇' : '🔊';
  sync(); mb.onclick = () => { muted = !muted; store.set('mute', muted); sync(); };
  addEventListener('keydown', e => {
    if ((e.code === 'Space' || e.code === 'Enter') && Casino.hotkey && !e.target.closest('button,input,a,select')) { e.preventDefault(); Casino.hotkey(); }
  });
  addEventListener('hashchange', route);
  addEventListener('pagehide', () => cleanup?.());
  route();
};
