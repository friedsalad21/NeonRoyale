// Coin Pusher. Top-down tray: a pusher sweeps back and forth, coins shove each other, and coins pushed over the
// front lip drop into the win tray. Coins falling into the gutters at the front corners go to the house.
// Bonus coins: 💎 pays 10×, 🎁 pays 2–25×, ⭐ rains 12 free coins onto the tray, 🧱 closes the gutters for 15 seconds.
(() => {
  const PW = { TW: 300, TH: 440, R: 15, SHELF: 70, GUT: 36 };
  const KINDS = {
    gem: { p: .006, icon: '💎', c1: '#e0f2fe', c2: '#0ea5e9' },
    gift: { p: .005, icon: '🎁', c1: '#f5d0fe', c2: '#c026d3' },
    star: { p: .0045, icon: '⭐', c1: '#fef9c3', c2: '#ca8a04' },
    wall: { p: .003, icon: '🧱', c1: '#fecaca', c2: '#dc2626' },
  };
  const pickKind = () => { let r = Math.random(); for (const [k, o] of Object.entries(KINDS)) if ((r -= o.p) < 0) return k; return undefined; };
  // a packed tray, so the first coins already shove some over the edge
  function newWorld(v = 1) {
    const { TW, TH, R, SHELF } = PW, coins = [];
    for (let row = 0, y = SHELF + 14 + R; y < TH - R * 1.2; row++, y += R * 1.74)
      for (let x = R + (row % 2) * R; x <= TW - R; x += R * 2.02) coins.push({ x: x + Math.random() * 2, y, v });
    const w = { coins, t: 0, pushY: 10, walls: 0 };
    // shake it down with free coins until the pile sits right at the edge, so play starts at the brink
    for (let n = 0; n < 150; n++) { coins.push({ x: R + Math.random() * (TW - 2 * R), y: w.pushY + R + 2, v }); for (let st = 0; st < 27; st++) step(w, 1 / 60, () => {}); }
    ['gem', 'gift', 'star', 'gem'].forEach(k => w.coins[rnd(w.coins.length)].k = k);
    return w;
  }
  function step(w, dt, onFall) {
    const { TW, TH, R, SHELF, GUT } = PW, cs = w.coins;
    w.t += dt; w.pushY = SHELF * (.5 + .5 * Math.sin(w.t * 2.2)) + 10;
    if (w.walls > 0) w.walls = Math.max(0, w.walls - dt);
    for (const c of cs) if (c.y - R < w.pushY) c.y = w.pushY + R;
    for (let it = 0; it < 4; it++) for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 >= 4 * R * R || d2 === 0) continue;
      const d = Math.sqrt(d2), o = (2 * R - d) / 2, nx = dx / d, ny = dy / d;
      // whoever is against the pusher can't be shoved back into it
      const aB = a.y - R <= w.pushY + .5, bB = b.y - R <= w.pushY + .5, ka = aB ? 0 : bB ? 2 : 1, kb = bB ? 0 : aB ? 2 : 1;
      a.x -= nx * o * ka; a.y -= ny * o * ka; b.x += nx * o * kb; b.y += ny * o * kb;
    }
    for (let i = cs.length - 1; i >= 0; i--) {
      const c = cs[i]; c.x = Math.max(R, Math.min(TW - R, c.x));
      if (c.y - R * .3 > TH) { cs.splice(i, 1); onFall(c, w.walls <= 0 && (c.x < GUT || c.x > TW - GUT)); }
    }
  }
  // what a coin pays when it lands in the win tray, plus any side effect on the tray
  function collect(w, c, drop) {
    if (c.k === 'gem') return c.v * 10;
    if (c.k === 'gift') return c.v * [2, 3, 5, 5, 10, 10, 15, 25][rnd(8)];
    if (c.k === 'star') { for (let i = 0; i < 12; i++) drop(.1 + Math.random() * .8, c.v, true, i * 120); return c.v; }
    if (c.k === 'wall') w.walls = 15;
    return c.v;
  }
  // headless run for tuning: average return per coin dropped once the tray has settled (one drop every ~0.45s)
  function simulate(drops = 1500, warm = 300) {
    const w = newWorld(); let paid = 0, cost = 0, n = 0;
    const drop = (fx, v, free) => w.coins.push({ x: Math.max(PW.R, Math.min(PW.TW - PW.R, fx * PW.TW)), y: w.pushY + PW.R + 2, v, k: free ? undefined : pickKind() });
    const fall = (c, gut) => { if (gut) return; const p = collect(w, c, drop); if (n >= warm) paid += p; };
    for (; n < warm + drops; n++) {
      if (n >= warm) cost++;
      drop(Math.random(), 1, false);
      for (let s = 0; s < 27; s++) step(w, 1 / 60, fall);
    }
    return paid / cost;
  }

  Casino.games.push({
    id: 'pusher', section: 'Arcade & Lottery', name: 'Coin Pusher', tag: 'Arcade · Bonus coins', icon: '🪙', accent: '#eab308', simulate,
    blurb: 'Drop coins, shove the pile over the edge, and chase the gem, mystery, shower and wall coins.',
    rules: `<ul><li>Tap the tray (or press Drop / Auto) to drop a coin worth your selected chip.</li>
      <li>The pusher sweeps forward and back. Every coin shoved off the <b>front edge</b> pays its value.</li>
      <li>Coins that fall into the red <b>gutters</b> in the front corners go to the house.</li>
      <li>Bonus coins: 💎 pays 10×, 🎁 pays a mystery 2–25×, ⭐ rains 12 free coins onto the tray, 🧱 raises walls over the gutters for 15 seconds.</li>
      <li>The tray is saved, so your pile is waiting when you come back.</li></ul>`,
    mount({ table, controls }) {
      const ctrl = (...els) => { const b = h('<div class="btns"></div>'); b.append(...els); return b; };
      table.classList.add('dark-felt');
      table.innerHTML = '<div class="cp"><canvas></canvas><div class="pills cp-log"></div></div>';
      const cv = $('canvas', table), ctx = cv.getContext('2d'), log = pillRow($('.cp-log', table), 10);
      const info = h('<div class="info-line">On tray <b>0</b> · won here <b>$0</b></div>');
      let auto = false;
      const autoBtn = button('Auto', 'ghost', () => { auto = !auto; autoBtn.classList.toggle('on', auto); });
      controls.append(chipRack(), info, ctrl(button('Drop 5', 'ghost', () => { for (let i = 0; i < 5; i++) drop(.15 + Math.random() * .7, Casino.chip, false, i * 160); }), autoBtn, button('Drop', 'green', () => drop(.25 + Math.random() * .5))));
      const { TW, TH, R, GUT } = PW, TRAY = 60;
      const saved = store.get('pusher_world', null);
      let w = saved && saved.coins?.length > 60 ? saved : newWorld(), raf = 0, alive = true, won = 0, s = 1, last = performance.now(), lastAuto = 0;
      const fx = []; // coins tumbling into the win tray or gutters, with floating text
      const resize = () => {
        const dpr = devicePixelRatio || 1, Wd = Math.min(cv.parentElement.clientWidth, 420); s = Wd / TW;
        cv.width = Wd * dpr; cv.height = (TH + TRAY) * s * dpr; cv.style.width = Wd + 'px'; cv.style.height = (TH + TRAY) * s + 'px'; ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
      };
      resize(); addEventListener('resize', resize);
      function drop(fx0, v = Casino.chip, free = false, delay = 0) {
        if (delay) return setTimeout(() => alive && drop(fx0, v, free), delay);
        if (!free && !Casino.take(v)) { auto = false; autoBtn.classList.remove('on'); return; }
        w.coins.push({ x: Math.max(R, Math.min(TW - R, fx0 * TW)), y: w.pushY + R + 2, v, k: free ? undefined : pickKind() });
        free ? tone(1500, .05, 'triangle', .03) : sfx.chip();
      }
      cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); if ((e.clientY - r.top) / s < TH) drop((e.clientX - r.left) / r.width); });
      function onFall(c, gutter) {
        const f = { x: c.x, t: performance.now(), k: c.k, v: c.v, gutter };
        if (gutter) { f.text = 'gutter'; log(`gutter ${fmt(c.v)}`, false); tone(150, .1, 'sine', .03); }
        else {
          const pay = round2(collect(w, c, drop)); f.text = '+' + fmt(pay); won += pay; Casino.pay(pay);
          log(`${c.k ? KINDS[c.k].icon + ' ' : ''}${fmt(pay)}`, true);
          if (c.k === 'star') { banner('COIN SHOWER!', '12 free coins'); sfx.big(); }
          else if (c.k === 'wall') { banner('WALLS UP!', 'Gutters closed for 15s'); sfx.big(); }
          else if (c.k) { banner(`${KINDS[c.k].icon} ${fmt(pay)}`, c.k === 'gem' ? 'Gem coin ×10' : 'Mystery prize'); sfx.win(); }
          else tone(900 + rnd(300), .1, 'triangle', .05);
        }
        fx.push(f);
      }
      function coin(g, x, y, c, a = 1) {
        const k = c.k && KINDS[c.k];
        g.globalAlpha = a;
        const grd = g.createRadialGradient(x - 5, y - 5, 2, x, y, R); grd.addColorStop(0, k ? k.c1 : '#fff6c2'); grd.addColorStop(1, k ? k.c2 : '#b8860b');
        g.beginPath(); g.arc(x, y, R, 0, 7); g.fillStyle = grd; g.fill();
        g.lineWidth = 2; g.strokeStyle = k ? '#fff' : 'rgba(92,61,0,.7)'; g.stroke();
        g.beginPath(); g.arc(x, y, R - 4, 0, 7); g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.35)'; g.stroke();
        g.fillStyle = '#4a3000'; g.font = `700 ${k ? 15 : 11}px Oswald, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(k ? k.icon : short(c.v), x, y + 1); g.globalAlpha = 1;
      }
      function draw(now) {
        const g = ctx; g.clearRect(0, 0, TW, TH + TRAY);
        const bg = g.createLinearGradient(0, 0, 0, TH); bg.addColorStop(0, '#5b1020'); bg.addColorStop(1, '#2a0610'); g.fillStyle = bg; g.fillRect(0, 0, TW, TH);
        g.strokeStyle = 'rgba(255,255,255,.04)'; for (let x = 15; x < TW; x += 30) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, TH); g.stroke(); }
        // pusher block with hazard stripes
        const pg = g.createLinearGradient(0, 0, 0, w.pushY); pg.addColorStop(0, '#6b7280'); pg.addColorStop(1, '#e5e7eb'); g.fillStyle = pg; g.fillRect(0, 0, TW, w.pushY);
        g.fillStyle = 'rgba(0,0,0,.16)'; for (let x = -40; x < TW; x += 28) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 14, 0); g.lineTo(x + 14 + w.pushY * .4, w.pushY); g.lineTo(x + w.pushY * .4, w.pushY); g.fill(); }
        g.fillStyle = '#facc15'; g.fillRect(0, w.pushY - 5, TW, 5);
        g.fillStyle = '#111'; g.font = '700 13px Oswald, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('TAP TO DROP ▼', TW / 2, Math.max(16, w.pushY / 2 + 5));
        for (const c of w.coins) coin(g, c.x, c.y, c);
        g.fillStyle = '#b8860b'; g.fillRect(0, 0, 4, TH); g.fillRect(TW - 4, 0, 4, TH);
        g.textBaseline = 'alphabetic';
        if (w.walls > 0) {
          g.fillStyle = `rgba(239,68,68,${.6 + .3 * Math.sin(now / 120)})`; g.fillRect(0, TH - 6, GUT, 6); g.fillRect(TW - GUT, TH - 6, GUT, 6);
          g.fillStyle = '#fff'; g.font = '700 12px Oswald, sans-serif'; g.fillText(`🧱 WALLS ${Math.ceil(w.walls)}s`, TW / 2, TH - 12);
        }
        for (let i = 0; i < 15; i++) { const on = (Math.floor(now / 160) + i) % 3 === 0; g.beginPath(); g.arc(10 + i * 20, TH + 4, 3, 0, 7); g.fillStyle = on ? '#fde68a' : '#78350f'; g.fill(); }
        // win tray, with the house gutters in the corners
        g.fillStyle = '#120a04'; g.fillRect(0, TH + 10, TW, TRAY - 10);
        g.fillStyle = '#7f1d1d'; g.fillRect(0, TH + 10, GUT, TRAY - 10); g.fillRect(TW - GUT, TH + 10, GUT, TRAY - 10);
        g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '700 10px Oswald, sans-serif'; g.fillText('HOUSE', GUT / 2, TH + 38); g.fillText('HOUSE', TW - GUT / 2, TH + 38);
        g.fillStyle = 'rgba(253,230,138,.6)'; g.fillText('WIN TRAY', TW / 2, TH + TRAY - 6);
        for (let i = fx.length - 1; i >= 0; i--) {
          const f = fx[i], k = (now - f.t) / 900; if (k > 1) { fx.splice(i, 1); continue; }
          coin(g, f.x, TH + 6 + Math.min(1, k * 2.5) * 30, f, 1 - k * .7);
          g.textBaseline = 'alphabetic'; g.fillStyle = f.gutter ? '#fca5a5' : '#86efac'; g.font = '700 14px Oswald, sans-serif';
          g.fillText(f.text, Math.max(30, Math.min(TW - 30, f.x)), TH - 10 - k * 40);
        }
      }
      function frame(now) {
        if (!alive) return;
        const dt = Math.min(.05, (now - last) / 1000); last = now;
        if (auto && now - lastAuto > 450) { lastAuto = now; drop(.2 + Math.random() * .6); }
        step(w, dt, onFall); draw(now);
        $$('b', info)[0].textContent = w.coins.length; $$('b', info)[1].textContent = fmt(round2(won));
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
      Casino.hotkey = () => drop(.25 + Math.random() * .5);
      const persist = () => store.set('pusher_world', { t: w.t, pushY: w.pushY, walls: w.walls, coins: w.coins.map(c => ({ x: round2(c.x), y: round2(c.y), v: c.v, ...(c.k ? { k: c.k } : {}) })) });
      return () => { alive = false; auto = false; cancelAnimationFrame(raf); removeEventListener('resize', resize); persist(); };
    },
  });
})();
