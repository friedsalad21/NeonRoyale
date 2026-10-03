'use strict';
// Slot Hall and machine cabinets: the DOM "board" the slot engine drives.
(() => {
  const E = SlotEngine, BETS = [1, 2, 5, 10, 20, 50, 100, 250, 500, 1000];
  const CATS = ['All', 'Classic', 'Video', 'Ways', 'Megaways', 'Tumble', 'Cluster', 'Hold & Win', 'Bonus', 'Specialty'];
  const num = x => String(+x.toFixed(2));
  const themeVars = t => `--bg:${t.bg};--frame:${t.frame};--acc:${t.acc};--cell:${t.cell};--mf:'${t.font}',Oswald,sans-serif`;
  const symPlain = d => d.cls ? `<span class="${d.cls}">${d.s}</span>` : d.s;

  // ---------- reel board ----------
  class Reels {
    constructor(m, ui) {
      this.m = m; this.ui = ui; this.el = h('<div class="reels"></div>');
      this.g = null; this.v = null; this.spots = null; this.sticky = null; this.locked = null;
      this.pool = c => m.syms.map((d, i) => [i, (d.reels && !d.reels.includes(c)) ? 0 : d.w || d.fw || d.n || 0]).filter(x => x[1] > 0);
    }
    wait(ms) { return sleep(this.ui.turbo ? ms * .35 : ms); }
    randSym(c) { const p = this.pool(c); let r = Math.random() * p.reduce((a, x) => a + x[1], 0); for (const [i, w] of p) if ((r -= w) < 0) return i; return p[0][0]; }
    initial() {
      const m = this.m, rows = m.megaways ? 5 : m.rows;
      this.render(Array.from({ length: m.cols }, (_, c) => Array.from({ length: rows }, () => this.randSym(c))), null);
    }
    height(g) {
      const cols = g.length, W = this.el.clientWidth || Math.min(innerWidth - 64, 900), gap = 6;
      const cs = this.cs = Math.min(cols > 5 ? 86 : 118, Math.floor((W - gap * (cols - 1)) / cols));
      return Math.round(this.m.megaways ? cs * 4.4 : cs * Math.max(...g.map(c => c.length)));
    }
    q(k) { return this.el.querySelector(`.cell[data-k="${k}"]`); }
    cellHTML(c, r, s, v, hgt) {
      const d = this.m.syms[s], k = E.key(c, r), spot = r >= 0 && this.spots?.get(k);
      const cls = ['cell', d.cls || '', d.wild ? 'wild' : '', d.scatter || d.bonus || d.coin ? 'scat' : '', r >= 0 && this.sticky?.has(k) ? 'sticky' : '', r >= 0 && this.locked?.has(k) ? 'locked' : ''].join(' ');
      return `<div class="${cls}" data-k="${r >= 0 ? k : ''}" style="height:${hgt}px;font-size:${Math.round(Math.min(hgt, this.cs || hgt) * .56)}px;${d.c ? `color:${d.c}` : ''}">${symPlain(d)}${v ? `<b class="val">${this.ui.valLabel(d, v)}</b>` : ''}${spot ? `<i class="spotm ${spot > 1 ? 'hot' : ''}">${spot > 1 ? '×' + spot : ''}</i>` : ''}</div>`;
    }
    build(n) {
      this.el.innerHTML = ''; this.el.style.gridTemplateColumns = `repeat(${n},1fr)`;
      this.reels = Array.from({ length: n }, () => { const r = h('<div class="reel"><div class="strip"></div></div>'); this.el.append(r); return r; });
    }
    render(g, v) {
      if (!this.reels || this.reels.length !== g.length) this.build(g.length);
      const H = this.height(g);
      this.g = g.map(c => [...c]); this.v = v ? v.map(c => [...c]) : null;
      g.forEach((col, c) => {
        const st = this.reels[c].firstChild; this.reels[c].style.height = H + 'px';
        st.style.transition = 'none'; st.style.transform = '';
        st.innerHTML = col.map((s, r) => this.cellHTML(c, r, s, this.v?.[c]?.[r], H / col.length)).join('');
      });
    }
    clearHits() { this.el.querySelectorAll('.hit').forEach(e => e.classList.remove('hit')); }
    async spin(g, o = {}) {
      this.clearHits();
      if (!this.ui.inFs) { this.spots = null; this.sticky = null; }
      if (o.sticky) this.sticky = o.sticky;
      if (o.holdCells) return this.respinCells(g, o.vals, o.holdCells);
      if (!this.reels || this.reels.length !== g.length) this.render(g.map((col, c) => col.map(() => this.randSym(c))), null);
      if (o.manual) return this.manualSpin(g, o.vals);
      const m = this.m, H = this.height(g), trig = m.scatterIdx >= 0 ? m.scatterIdx : m.bonusIdx, need = m.fs?.need || 3, t = this.ui.turbo;
      let seen = 0, ants = 0;
      const plan = g.map(col => { const ant = trig >= 0 && seen >= need - 1; seen += col.filter(s => s === trig).length; if (ant) ants++; return { ant, ants }; });
      this.ui.ways(g);
      await Promise.all(g.map(async (col, c) => {
        if (o.hold?.includes(c)) return;
        const reel = this.reels[c], st = reel.firstChild, hN = H / col.length, old = this.g[c] || col, hO = H / old.length;
        const filler = Array.from({ length: 8 + c * 3 + plan[c].ants * 6 }, () => this.randSym(c));
        st.style.transition = 'none';
        st.innerHTML = col.map((s, r) => this.cellHTML(c, r, s, o.vals?.[c]?.[r], hN)).join('') + filler.map(s => this.cellHTML(c, -1, s, 0, hN)).join('') +
          old.map((s, r) => this.cellHTML(c, -1, s, this.v?.[c]?.[r], hO)).join('');
        reel.style.height = H + 'px';
        st.style.transform = `translateY(${-(st.scrollHeight - H)}px)`; void st.offsetWidth;
        const ms = (t ? 300 : 750) + c * (t ? 80 : 210) + plan[c].ants * (t ? 300 : 900);
        reel.classList.add('spinning'); if (plan[c].ant) setTimeout(() => reel.classList.add('ant'), ms - (t ? 300 : 900));
        st.style.transition = `transform ${ms}ms cubic-bezier(.3,.05,.25,1)`; st.style.transform = 'translateY(0)';
        await sleep(ms); reel.classList.remove('spinning', 'ant'); sfx.card();
      }));
      this.render(g, o.vals);
    }
    async respinCells(g, vals, held) {
      this.locked = held;
      const cells = []; g.forEach((col, c) => col.forEach((_, r) => { if (!held.has(E.key(c, r))) cells.push([c, r]); }));
      const coin = this.m.syms.findIndex(d => d.coin);
      // open spots shimmer while the locked pearls stay put, then new pearls drop in
      cells.forEach(([c, r]) => this.q(E.key(c, r))?.classList.add('reroll'));
      for (let i = 0; i < 5; i++) { sfx.tick(); await this.wait(130); }
      this.render(g, vals);
      cells.forEach(([c, r]) => { if (g[c][r] === coin) this.q(E.key(c, r))?.classList.add('land'); });
      if (cells.some(([c, r]) => g[c][r] === coin)) sfx.win();
      await this.wait(500);
    }
    manualSpin(g, vals) {
      const H = this.height(g), btns = this.ui.stops;
      return Promise.all(g.map((col, c) => new Promise(res => {
        const reel = this.reels[c], st = reel.firstChild, hgt = H / col.length, btn = btns[c];
        reel.classList.add('spinning');
        const iv = setInterval(() => { st.innerHTML = col.map((_, r) => this.cellHTML(c, -1, this.randSym(c), 0, hgt)).join(''); }, 60);
        const stop = () => {
          clearInterval(iv); clearTimeout(to); btn.disabled = true; btn.onclick = null; reel.classList.remove('spinning');
          st.innerHTML = col.map((s, r) => this.cellHTML(c, r, s, 0, hgt)).join(''); st.classList.remove('bounce'); void st.offsetWidth; st.classList.add('bounce'); sfx.card(); res();
        };
        btn.disabled = false; btn.onclick = stop;
        const to = setTimeout(stop, (this.ui.turbo || this.ui.auto ? 700 : 2600) + c * 650);
      }))).then(() => this.render(g, vals));
    }
    async show(cells, u, notes = [], mult) {
      this.clearHits();
      cells.forEach(k => this.q(k)?.classList.add('hit'));
      if (u > 0) { this.ui.addWin(u, notes, mult); await this.wait(cells.size ? 1000 : 700); }
      else if (cells.size) await this.wait(400);
    }
    async cascade(old, removed, g, v, spots) {
      if (spots) this.spots = spots;
      removed.forEach(k => this.q(k)?.classList.add('pop'));
      await this.wait(320);
      const H = this.height(g);
      g.forEach((col, c) => {
        const hgt = H / col.length, st = this.reels[c].firstChild;
        const kept = old[c].map((_, r) => r).filter(r => !removed.has(E.key(c, r))), nNew = col.length - kept.length;
        st.style.transition = 'none'; st.style.transform = '';
        st.innerHTML = col.map((s, r) => this.cellHTML(c, r, s, v?.[c]?.[r], hgt)).join('');
        const kids = [...st.children];
        kids.forEach((el, r) => { const from = r < nNew ? r - nNew : kept[r - nNew]; if (from !== r) el.style.transform = `translateY(${(from - r) * hgt}px)`; });
        void st.offsetWidth;
        kids.forEach(el => { if (el.style.transform) { el.style.transition = `transform ${this.ui.turbo ? 160 : 380}ms cubic-bezier(.55,0,.75,1.25)`; el.style.transform = ''; } });
      });
      this.g = g.map(c => [...c]); this.v = v.map(c => [...c]);
      await this.wait(430); sfx.card();
    }
    async set(cells, s, msg) {
      if (msg) this.ui.status(msg, true);
      for (const k of cells) { const [c, r] = E.kc(k); this.g[c][r] = s; if (this.v) this.v[c][r] = 0; }
      this.render(this.g, this.v);
      cells.forEach(k => this.q(k)?.classList.add('morph'));
      tone(880, .25, 'triangle', .06); tone(1320, .3, 'triangle', .05, .12);
      await this.wait(750);
    }
    async msg(t) { this.ui.status(t, true); await this.wait(600); }
    async banner(t, sub) { banner(t, sub || ''); sfx.big(); await this.wait(1700); }
    async fsStart(n, F, special) {
      this.ui.inFs = true; this.ui.el.classList.add('infs');
      const extra = special >= 0 ? `Expanding symbol: ${this.m.syms[special].s}` : '';
      this.ui.special = special >= 0 ? this.m.syms[special].s : '';
      banner(`${n} FREE SPINS`, extra || this.m.name); sfx.big(); coinShower(25);
      await this.wait(2200);
    }
    async fsHud(i, n, mult) { this.ui.hud(`FREE SPIN ${i} / ${n}${mult > 1 ? ` · ×${mult}` : ''}${this.ui.special ? ` · ${this.ui.special}` : ''}`); }
    async fsEnd(total) {
      this.ui.inFs = false; this.ui.el.classList.remove('infs'); this.ui.special = '';
      banner(this.ui.money(total), 'Free spins total'); sfx.big();
      await this.wait(2200); this.ui.hud(null); this.sticky = null; this.spots = null; this.render(this.g, this.v);
    }
    async hw(locked, respins) {
      this.locked = locked ? new Set(locked.keys()) : null;
      if (!locked) { this.ui.hud(null); this.render(this.g, this.v); return; }
      this.g.forEach((col, c) => col.forEach((_, r) => { if (!locked.has(E.key(c, r))) { col[r] = this.m.holdwin.blank; if (this.v) this.v[c][r] = 0; } }));
      let sum = 0; locked.forEach(v => sum += v);
      this.ui.hud(`RESPINS ${'●'.repeat(respins)}${'○'.repeat(3 - respins)} · ${this.ui.money(sum * this.m.k)}`);
      this.render(this.g, this.v);
    }
    async addReel(g) {
      this.render(g, null); const r = this.reels.at(-1); r.classList.add('newreel');
      this.ui.status(`${g.length} REELS!`, true); tone(660 + g.length * 40, .3, 'triangle', .07);
      await this.wait(800);
    }
    async askNudge(n) { return this.ui.nudgeBar(n); }
    async nudge(c, g) {
      this.render(g, null); const st = this.reels[c].firstChild;
      st.classList.remove('nudged'); void st.offsetWidth; st.classList.add('nudged'); sfx.chip();
      await this.wait(350);
    }
    async offerHolds() { this.ui.enableHolds(); }
    wheel(segs, idx) { return this.ui.wheel(segs, idx); }
    pick(prizes) { return this.ui.pick(prizes); }
    pachinko(slots, paths) { return this.ui.pachinko(slots, paths); }
  }

  // ---------- slingo board ----------
  class Slingo {
    constructor(m, ui) {
      this.m = m; this.ui = ui;
      this.el = h(`<div class="slingo-board"><div class="sl-main"><div class="sl-reel">${'<div>?</div>'.repeat(5)}</div><div class="sl-card"></div><div class="sl-spins"></div></div><div class="sl-ladder"></div></div>`);
      this.renderLadder(0);
    }
    initial() { $('.sl-card', this.el).innerHTML = Array.from({ length: 25 }, () => '<div class="sl-c">·</div>').join(''); }
    renderLadder(n) {
      $('.sl-ladder', this.el).innerHTML = this.m.ladder.map((v, i) => i < 3 ? '' : `<div class="${i === n ? 'on' : i < n ? 'past' : ''}"><span>${i === 12 ? 'FULL HOUSE' : i + ' Slingos'}</span><b>${this.ui.money(v * this.m.k)}</b></div>`).reverse().join('');
    }
    async slingoStart(card) {
      this.card = card; this.renderLadder(0);
      const el = $('.sl-card', this.el);
      el.innerHTML = Array.from({ length: 25 }, (_, i) => { const c = i % 5, r = Math.floor(i / 5); return `<div class="sl-c" data-k="${E.key(c, r)}">${card[c][r]}</div>`; }).join('');
      $$('.sl-reel div', this.el).forEach(d => { d.textContent = '?'; d.className = ''; });
    }
    async slingoSpin(outs, i, n) {
      $('.sl-spins', this.el).textContent = `Spin ${i} of ${n}`;
      const cells = $$('.sl-reel div', this.el);
      for (let f = 0; f < (this.ui.turbo ? 4 : 10); f++) { cells.forEach((d, c) => { d.textContent = c * 15 + 1 + rnd(15); d.className = 'roll'; }); sfx.tick(); await sleep(55); }
      outs.forEach((o, c) => {
        const d = cells[c]; d.className = typeof o === 'number' ? '' : 'special';
        d.textContent = o === 'J' ? '🃏' : o === 'SJ' ? '⭐' : o === 'FS' ? '+1' : o;
        const hit = typeof o === 'number' && this.card[c].includes(o); if (hit) d.classList.add('match');
      });
      sfx.card(); await sleep(this.ui.turbo ? 150 : 450);
    }
    async slingoMark(hits, sl, value, spins) {
      for (const k of hits) { const el = $(`.sl-c[data-k="${k}"]`, this.el); el?.classList.add('marked'); tone(700 + rnd(300), .1, 'triangle', .05); await sleep(this.ui.turbo ? 60 : 160); }
      if (sl !== this.last && sl) { this.ui.status(`${sl} SLINGO${sl > 1 ? 'S' : ''}!`, true); if (sl > (this.last || 0)) sfx.win(); }
      this.last = sl; this.renderLadder(sl);
      $('.sl-spins', this.el).textContent = `${spins} spins · ${this.ui.money(value)}`;
      await sleep(this.ui.turbo ? 100 : 350);
    }
    async show(_, u, notes) { this.last = 0; if (u > 0) this.ui.addWin(u, notes); }
  }

  // ---------- machine cabinet ----------
  function mountMachine(m, { el, table }) {
    const key = 'slot_' + m.id;
    let bi = Math.max(0, BETS.indexOf(store.get(key + '_bet', 1))), spinning = false, alive = true;
    const st = {}, ui = { auto: false, turbo: store.get('slot_turbo', false), inFs: false, special: '', holds: [false, false, false], spinWin: 0 };
    el.classList.add('machine');
    table.innerHTML = `<div class="cab" style="${themeVars(m.theme)}">
      <div class="cab-head"><div><div class="cab-title">${m.name}</div><div class="cab-sub">${m.tag}</div></div><div class="cab-jp"></div></div>
      <div class="cab-hud"></div>
      <div class="cab-screen"></div>
      <div class="cab-extra"></div>
      <div class="cab-status">Good luck!</div>
      <div class="cab-ctrl">
        <button class="btn ghost small minus" aria-label="Lower bet">−</button>
        <div class="meter"><small>BET</small><b class="bet"></b></div>
        <button class="btn ghost small plus" aria-label="Raise bet">+</button>
        <div class="meter"><small>WIN</small><b class="win">$0</b></div>
        <button class="btn ghost small info">Paytable</button>
        <button class="btn ghost small turbo">Turbo</button>
        <button class="btn ghost small auto">Auto</button>
        ${m.buy ? '<button class="btn small buy">Buy bonus</button>' : ''}
        ${m.gamble ? '<button class="btn small red gamble" hidden>Gamble</button>' : ''}
        <button class="btn red spinbtn">${m.mode === 'slingo' ? 'Play' : 'Spin'}</button>
      </div></div>`;
    const cab = $('.cab', table), statusEl = $('.cab-status', table), hudEl = $('.cab-hud', table), extra = $('.cab-extra', table);
    const spinBtn = $('.spinbtn', table), autoBtn = $('.auto', table), turboBtn = $('.turbo', table), buyBtn = $('.buy', table), gambleBtn = $('.gamble', table);
    Object.assign(ui, {
      el: cab,
      get bet() { return BETS[bi]; },
      money: u => fmt(round2(u * BETS[bi])),
      valLabel: (d, v) => d.labels?.[v] || (d.valFmt === 'x' ? '×' + v : '$' + short(round2(v * m.k * BETS[bi]))),
      status(t, flash) { statusEl.innerHTML = t; if (flash) { statusEl.classList.remove('flash'); void statusEl.offsetWidth; statusEl.classList.add('flash'); } },
      hud(t) { hudEl.innerHTML = t || ''; },
      ways(g) { if (m.megaways) ui.hud(ui.inFs ? hudEl.innerHTML : `${g.reduce((a, c) => a * c.length, 1).toLocaleString()} WAYS`); },
      addWin(u, notes, mult) {
        ui.spinWin += u; $('.win', table).textContent = ui.money(ui.spinWin);
        const txt = notes.slice(0, 3).map(n => n.text || `${n.n}× ${symPlain(m.syms[n.sym])}${n.ways > 1 ? ` · ${n.ways} ways` : ''}`).join(' · ');
        ui.status(`WIN ${ui.money(u)}${mult ? ` <span class="xm">×${mult}</span>` : ''}${txt ? ' · ' + txt : ''}`, true);
        tone(880, .12, 'triangle', .05); tone(1175, .15, 'triangle', .05, .08);
      },
    });
    const board = m.mode === 'slingo' ? new Slingo(m, ui) : new Reels(m, ui);
    $('.cab-screen', table).append(board.el);

    // per-reel extra buttons: STOP (pachislo), HOLD + NUDGE (fruit machine)
    if (m.manual) {
      extra.style.gridTemplateColumns = `repeat(${m.cols},1fr)`;
      ui.stops = Array.from({ length: m.cols }, () => { const b = h('<button class="btn small red" disabled>Stop</button>'); extra.append(b); return b; });
    }
    if (m.mode === 'fruit') {
      extra.style.gridTemplateColumns = 'repeat(3,1fr)';
      const holdBtns = [0, 1, 2].map(c => { const b = h('<button class="btn small ghost hold" disabled>Hold</button>'); b.onclick = () => { ui.holds[c] = !ui.holds[c]; b.classList.toggle('on', ui.holds[c]); sfx.tick(); }; extra.append(b); return b; });
      const nudgeRow = h('<div class="nudgerow" hidden></div>');
      const nudgeBtns = [0, 1, 2].map(() => { const b = h('<button class="btn small green">Nudge ▼</button>'); nudgeRow.append(b); return b; });
      const nudgeDone = h('<button class="btn small ghost">Done</button>'), nudgeCount = h('<span class="ncount"></span>');
      nudgeRow.append(nudgeCount, nudgeDone);
      extra.after(nudgeRow);
      ui.enableHolds = () => { ui.holds = [false, false, false]; holdBtns.forEach(b => { b.disabled = false; b.classList.remove('on'); b.classList.add('flashy'); }); ui.status('HOLDS available: pick reels to keep, then Spin', true); };
      ui.disableHolds = () => holdBtns.forEach(b => { b.disabled = true; b.classList.remove('on', 'flashy'); });
      ui.nudgeBar = n => new Promise(res => {
        if (!n) { nudgeRow.hidden = true; return res(-1); }
        nudgeRow.hidden = false; nudgeCount.textContent = `${n} nudge${n > 1 ? 's' : ''} left`;
        const done = v => { nudgeBtns.forEach(b => b.onclick = null); nudgeDone.onclick = null; res(v); };
        nudgeBtns.forEach((b, c) => b.onclick = () => done(c)); nudgeDone.onclick = () => done(-1);
        if (ui.auto) setTimeout(() => done(rnd(3)), 400);
      });
    }

    // jackpot header
    const jp = $('.cab-jp', table);
    const showJp = () => {
      if (m.jackpots) jp.innerHTML = Object.entries(m.jackpots).map(([n, v]) => `<div class="jpill"><small>${n}</small><b>${fmt(round2(v * m.k * BETS[bi]))}</b></div>`).join('');
    };
    showJp();
    $('.cab-head', table).after(jackpotMeters('slim'));

    const showBet = () => {
      $('.bet', table).textContent = fmt(BETS[bi]); store.set(key + '_bet', BETS[bi]); showJp();
      if (buyBtn) buyBtn.textContent = `Buy ${fmt(BETS[bi] * m.buy)}`;
      if (m.mode === 'slingo') board.renderLadder(0);
      else if (board.g) board.render(board.g, board.v);
    };
    showBet();
    turboBtn.classList.toggle('on', ui.turbo);
    $('.minus', table).onclick = () => { if (!spinning && bi > 0) { bi--; showBet(); sfx.chip(); } };
    $('.plus', table).onclick = () => { if (!spinning && bi < BETS.length - 1) { bi++; showBet(); sfx.chip(); } };
    $('.info', table).onclick = () => modal(m.name, rulesHTML(m));
    turboBtn.onclick = () => { ui.turbo = !ui.turbo; store.set('slot_turbo', ui.turbo); turboBtn.classList.toggle('on', ui.turbo); };
    autoBtn.onclick = async () => {
      ui.auto = !ui.auto; autoBtn.classList.toggle('on', ui.auto);
      while (ui.auto && alive) { const r = await spin(false); if (r === null) break; await sleep(r ? 900 : 250); }
      ui.auto = false; autoBtn.classList.remove('on');
    };
    if (buyBtn) buyBtn.onclick = () => {
      if (spinning) return;
      const mm = modal('Buy bonus', `<p>Jump straight into the free spins for <b class="gold">${fmt(BETS[bi] * m.buy)}</b> (${m.buy}× your bet)?</p><button class="btn green">Buy it</button>`);
      $('.btn', mm).onclick = () => { mm.remove(); spin(true); };
    };
    spinBtn.onclick = () => spin(false);
    if (gambleBtn) gambleBtn.onclick = () => gamble(ui.lastPaid);

    async function spin(buy) {
      if (spinning) return 0;
      const bet = BETS[bi], cost = round2(buy ? bet * m.buy : bet);
      if (!Casino.take(cost)) { ui.auto = false; return null; }
      spinning = true; spinBtn.disabled = true; if (buyBtn) buyBtn.disabled = true; if (gambleBtn) gambleBtn.hidden = true;
      ui.spinWin = 0; $('.win', table).textContent = '$0'; ui.status(buy ? 'Bonus bought. Good luck!' : 'Good luck!');
      const ctx = { bet, maxBet: BETS.at(-1), st, buy, holds: ui.holds };
      ui.disableHolds?.();
      let units = 0;
      try { units = await E.play(m, board, ctx); } catch (e) { console.error(e); }
      ui.holds = [false, false, false];
      let paid = round2(units * bet);
      // every real spin (not a bought bonus) feeds the shared jackpots and may win one
      const jw = buy ? [] : Jackpots.spin(bet);
      if (ctx.jackpot) jw.push(Jackpots.claimGrand());
      Casino.pay(paid);
      for (const w of jw) { Casino.pay(w.amount); paid = round2(paid + w.amount); }
      $('.win', table).textContent = fmt(paid);
      const x = paid / bet;
      if (jw.length) { const w = jw.at(-1); banner(`${w.t.name} JACKPOT`, fmt(w.amount)); sfx.big(); coinShower(w.t.k === 'grand' ? 200 : 90); ui.status(`${jw.map(w => w.t.name).join(' + ')} JACKPOT! ${fmt(paid)}`, true); }
      else if (x >= 15) { banner(x >= 100 ? 'EPIC WIN' : x >= 50 ? 'MEGA WIN' : 'BIG WIN', fmt(paid)); sfx.big(); coinShower(x >= 100 ? 120 : x >= 50 ? 70 : 35); }
      else if (paid > 0) { sfx.win(); if (!buy) ui.status(`WIN ${fmt(paid)}`, true); }
      else if (m.holdwin && board.g) {
        const n = board.g.flat().filter(s => m.syms[s].coin).length;
        ui.status(n >= 3 ? `${n} pearls · land ${m.holdwin.need} for Hold & Win!` : 'No win. Spin again!');
      }
      else if (!st.holdNext) ui.status(m.mode === 'slingo' ? 'No prize this time. Play again!' : 'No win. Spin again!');
      ui.lastPaid = paid;
      if (gambleBtn && paid > 0 && !ui.auto) gambleBtn.hidden = false;
      spinning = false; spinBtn.disabled = false; if (buyBtn) buyBtn.disabled = false;
      showJp();
      return paid;
    }

    // ---------- overlays: gamble, wheel, pick, pachinko ----------
    const overlay = html => { const o = h(`<div class="sovl" style="${themeVars(m.theme)}"><div class="sbox">${html}</div></div>`); document.body.append(o); return o; };
    function gamble(amount) {
      gambleBtn.hidden = true;
      if (!amount) return;
      let stake = amount, rounds = 0;
      const o = overlay(`<h2>Gamble</h2><p>Guess the colour to double <b class="gstake"></b></p><div class="gmb-card">?</div>
        <div class="btns" style="justify-content:center"><button class="btn red gr">Red</button><button class="btn gb" style="background:#111;color:#fff">Black</button><button class="btn ghost gc">Collect</button></div><div class="ghist"></div>`);
      const card = $('.gmb-card', o), upd = () => $('.gstake', o).textContent = fmt(stake);
      upd();
      const guess = red => {
        if (!Casino.take(stake)) return;
        const s = SUITS[rnd(4)], isRed = s === '♥' || s === '♦';
        card.textContent = s + '︎'; card.className = 'gmb-card ' + (isRed ? 'red' : 'black');
        $('.ghist', o).insertAdjacentHTML('afterbegin', `<span class="${isRed ? 'red' : ''}">${s}︎</span>`);
        if (isRed === red) { stake = round2(stake * 2); Casino.pay(stake); rounds++; sfx.win(); upd(); if (rounds >= 5) setTimeout(() => o.remove(), 900); }
        else { sfx.lose(); $('.gstake', o).textContent = '$0'; setTimeout(() => o.remove(), 900); $$('.btns .btn', o).forEach(b => b.disabled = true); }
        $('.win', table).textContent = fmt(isRed === red ? stake : 0);
      };
      $('.gr', o).onclick = () => guess(true); $('.gb', o).onclick = () => guess(false); $('.gc', o).onclick = () => o.remove();
    }
    ui.wheel = (segs, idx) => new Promise(res => {
      const o = overlay(`<h2>${m.bonus.name} Bonus</h2><div class="wheelwrap big"><div class="flapper"></div></div><button class="btn red">Spin the wheel</button>`);
      const cv = h('<canvas width="640" height="640"></canvas>'); $('.wheelwrap', o).append(cv);
      const pal = ['#7c3aed', '#db2777', '#2563eb', '#059669', '#ea580c'];
      drawWheel(cv, segs.map((v, i) => ({ label: '$' + short(round2(v * m.k * BETS[bi])), color: v >= 500 ? '#facc15' : pal[i % pal.length], fg: v >= 500 ? '#111' : '#fff' })), { text: 24, rim: .74, hub: .2, radial: true });
      const sp = spinner(cv, segs.length), btn = $('.btn', o);
      const go = async () => {
        btn.disabled = true; await sp(idx, ui.turbo ? 2500 : 5500, 5);
        btn.textContent = 'You win ' + fmt(round2(segs[idx] * m.k * BETS[bi])); sfx.big(); coinShower(30);
        await sleep(1600); o.remove(); res();
      };
      btn.onclick = go; if (ui.auto) setTimeout(go, 600);
    });
    ui.pick = prizes => new Promise(res => {
      const o = overlay(`<h2>Treasure Room</h2><p class="pk">Pick chests until you find COLLECT</p><div class="chests">${prizes.map(() => '<button class="chest">🧰</button>').join('')}</div>`);
      const chests = $$('.chest', o), got = [];
      let tot = 0, x = 1, over = false;
      const lab = p => p === 'COLLECT' ? 'COLLECT' : p === 'x2' ? '×2' : '$' + short(round2(p * m.k * BETS[bi]));
      const open = async i => {
        if (over || chests[i].classList.contains('open')) return;
        if (!got.length && prizes[i] === 'COLLECT') { const j = prizes.findIndex(x => x !== 'COLLECT'); [prizes[i], prizes[j]] = [prizes[j], prizes[i]]; }
        const p = prizes[i]; got.push(p);
        chests[i].textContent = lab(p); chests[i].classList.add('open'); if (p === 'COLLECT') chests[i].classList.add('col');
        if (p === 'x2') x *= 2; else if (typeof p === 'number') tot += p;
        $('.pk', o).textContent = `Treasure: ${fmt(round2(tot * x * m.k * BETS[bi]))}${x > 1 ? ` (×${x})` : ''}`;
        p === 'COLLECT' ? sfx.lose() : sfx.win();
        if (p !== 'COLLECT') { if (ui.auto) setTimeout(() => open(chests.findIndex(c => !c.classList.contains('open'))), 450); return; }
        over = true;
        chests.forEach((c, j) => { if (!c.classList.contains('open')) { c.textContent = lab(prizes[j]); c.classList.add('open', 'rest'); } });
        await sleep(1800); o.remove(); res(got);
      };
      chests.forEach((c, i) => c.onclick = () => open(i));
      if (ui.auto) setTimeout(() => open(0), 600);
    });
    ui.pachinko = (slots, paths) => new Promise(async res => {
      const o = overlay(`<h2>Pachinko!</h2><p class="pk">${paths.length} balls</p><canvas width="440" height="480"></canvas>`);
      const cv = $('canvas', o), ctx = cv.getContext('2d'), rows = slots.length - 1, dx = 36, dy = 36, cx = 220, top = 40;
      let total = 0; const done = [];
      const draw = ball => {
        ctx.clearRect(0, 0, 440, 480);
        for (let r = 1; r <= rows; r++) for (let j = 0; j <= r; j++) { ctx.beginPath(); ctx.arc(cx + (j - r / 2) * dx, top + r * dy, 4, 0, 7); ctx.fillStyle = '#e5e7eb'; ctx.fill(); }
        slots.forEach((v, j) => {
          const x = cx + (j - rows / 2) * dx, y = top + (rows + 1) * dy + 6;
          ctx.fillStyle = done.includes(j) ? '#facc15' : v >= 25 ? '#be123c' : '#1e3a8a'; ctx.fillRect(x - 16, y - 14, 32, 40);
          ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Oswald, sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('$' + short(Math.round(v * m.k * BETS[bi])), x, y + 10);
        });
        if (ball) { ctx.beginPath(); ctx.arc(ball[0], ball[1], 8, 0, 7); ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0; }
      };
      draw();
      for (const p of paths) {
        let x = cx;
        for (let r = 0; r <= rows; r++) {
          const nx = r < rows ? x + (p[r] ? dx / 2 : -dx / 2) : x, steps = ui.turbo ? 3 : 7;
          for (let s = 1; s <= steps; s++) { const t = s / steps; draw([x + (nx - x) * t, top + r * dy + dy * t - Math.sin(t * Math.PI) * 10]); await sleep(16); }
          x = nx; if (r < rows) tone(900 + rnd(400), .03, 'square', .015);
        }
        const j = p.reduce((a, b) => a + b, 0); done.push(j); total += slots[j];
        $('.pk', o).textContent = `Won ${fmt(round2(total * m.k * BETS[bi]))}`; sfx.win(); draw();
        await sleep(ui.turbo ? 150 : 450);
      }
      await sleep(1400); o.remove(); res();
    });

    board.initial();
    const onResize = () => { if (board.g && !spinning) board.render(board.g, board.v); };
    addEventListener('resize', onResize);
    Casino.hotkey = () => spin(false);
    return () => { alive = false; ui.auto = false; removeEventListener('resize', onResize); };
  }

  // ---------- paytable ----------
  function rulesHTML(m) {
    const k = m.k, d = m.div, x = v => num(v) + '×';
    const rows = m.syms.map(s => {
      let pays = [];
      if (s.pay && m.eval === 'cluster') pays = [5, 8, 10, 12, 15].map(n => `${n}${n === 15 ? '+' : ''}: ${x(E.payClamp(s.pay, n) / d * k)}`);
      else if (s.pay) pays = s.pay.map((p, n) => p ? `${n}: ${x(p / d * k)}` : '').filter(Boolean);
      if (s.tiers) pays = [...s.tiers].reverse().map(([n, p]) => `${n}${n === 12 ? '+' : '–' + (n + 1)}: ${x(p * k)}`);
      if (s.spay) pays.push(...s.spay.map((p, n) => p ? `${n} scatter: ${x(p * k)}` : '').filter(Boolean));
      const tags = [s.wild && 'WILD', s.scatter && 'SCATTER', s.bonus && 'BONUS', s.mystery && 'MYSTERY', s.coin && 'COIN', s.bomb && 'BOMB', s.collector && 'COLLECTOR', s.xmult && `×${s.xmult}`].filter(Boolean);
      if (!pays.length && !tags.length) return '';
      return `<div class="prow"><span class="psym">${symPlain(s) || '▢'}</span><span>${tags.length ? `<b>${tags.join(' · ')}</b> ` : ''}${pays.join(' · ')}</span></div>`;
    }).join('');
    const groups = m.groups ? Object.entries(m.groups).map(([g, p]) => `<div class="prow"><span class="psym">ANY</span><span>Any 3 ${g.toUpperCase()}s: ${x(p / d * k)}</span></div>`).join('') : '';
    const ladder = m.ladder ? m.ladder.map((v, i) => v ? `<div class="prow"><span class="psym">${i}</span><span>${i === 12 ? 'Full house' : 'Slingos'}: ${x(v * k)}</span></div>` : '').join('') : '';
    return `<ul>${m.rules.map(r => `<li>${r}</li>`).join('')}</ul><h3 class="gold">Paytable</h3><p class="muted">Counts are symbols in a row (or in a cluster / anywhere), and pays are multiples of your total bet.</p><div class="ptab">${rows}${groups}${ladder}</div>`;
  }

  // ---------- hall ----------
  Casino.games.push({
    id: 'slots', section: 'Slots', name: 'Slot Hall', tag: `Slots · ${E.MACHINES.length} machines`, icon: '🎰', accent: '#ec4899',
    blurb: `${E.MACHINES.length} machines: classics, Megaways, clusters, Hold & Win, bonus wheels and more.`,
    rules: `<ul><li>Every machine is a different type of slot with its own features. Open one and press <b>Paytable</b> for its rules.</li><li>Every machine returns about 95% over the long run, like a real Vegas floor: about 91% from the reels plus 4% that feeds the shared MINI, MINOR, MAJOR and GRAND jackpots.</li><li>Space spins on any machine. Turbo speeds up the animations, and Auto spins until you stop it.</li></ul>`,
    mount({ table }) {
      table.innerHTML = `<div class="hall"><div class="hall-filters">${CATS.map(c => `<button class="btn ghost small${c === 'All' ? ' on' : ''}">${c}</button>`).join('')}</div><div class="hall-grid"></div></div>`;
      const grid = $('.hall-grid', table);
      const show = cat => {
        grid.innerHTML = '';
        for (const m of E.MACHINES) {
          if (cat !== 'All' && m.cat !== cat) continue;
          const art = [...new Intl.Segmenter().segment(m.art)].map(s => `<span>${s.segment === '7' ? '<i class="seven">7</i>' : s.segment}</span>`).join('');
          grid.append(h(`<a class="mcard" href="#${m.id}" style="${themeVars(m.theme)}"><div class="mart">${art}</div><h3>${m.name}</h3><div class="mtag">${m.cat} · ${m.tag}</div><p>${m.blurb}</p></a>`));
        }
      };
      $$('.hall-filters .btn', table).forEach(b => b.onclick = () => { $$('.hall-filters .btn', table).forEach(x => x.classList.toggle('on', x === b)); show(b.textContent); sfx.tick(); });
      show('All');
    },
  });
  // 4% of every slot bet feeds the shared jackpots, so line wins are scaled down by the same amount
  for (const m of E.MACHINES) m.k = +(m.k * (1 - Jackpots.SHARE)).toFixed(4);
  for (const m of E.MACHINES) Casino.games.push({ id: m.id, hall: true, back: 'slots', name: m.name, rules: rulesHTML(m), mount: s => mountMachine(m, s) });
})();
