// Plane games: Sky Crash (crash-style cash-out) and Sky Masters (fly through boosts and bombs, land on the carrier).
(() => {
  // little red propeller plane, nose pointing along +x
  function drawPlane(ctx, x, y, ang, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
    ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.moveTo(-26, -3); ctx.lineTo(-36, -14); ctx.lineTo(-30, -14); ctx.lineTo(-18, -3); ctx.fill();
    ctx.fillStyle = '#e11d48'; ctx.beginPath(); ctx.ellipse(0, 0, 30, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#9f1239'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(4, 0); ctx.lineTo(-4, 20); ctx.lineTo(-14, 20); ctx.fill();
    ctx.fillStyle = '#bae6fd'; ctx.beginPath(); ctx.ellipse(8, -5, 7, 4, -.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.ellipse(31, 0, 2, 12 * Math.abs(Math.sin(t * 40)) + 2, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  function cloud(ctx, x, y, s, a = .8) {
    ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath();
    [[0, 0, 22], [20, -10, 26], [44, 0, 20], [22, 6, 22]].forEach(([dx, dy, r]) => { ctx.moveTo(x + dx * s + r * s, y + dy * s); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); });
    ctx.fill();
  }
  const fitCanvas = (cv, ratio) => { const dpr = devicePixelRatio || 1, W = cv.clientWidth, H = Math.round(W * ratio); cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px'; cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0); return [W, H]; };
  const NAMES = () => `${'abcdefghjkmnprstuvwxyz'[rnd(22)]}***${rnd(10)}`;

  // ---------- Sky Crash ----------
  Casino.games.push({
    id: 'skycrash', section: 'Originals', name: 'Sky Crash', tag: 'Crash · Cash out before it flies away', icon: '✈️', accent: '#e11d48',
    blurb: 'The plane takes off and the multiplier climbs. Cash out before it flies away!',
    rules: `<ul><li>Place a bet before take-off. Once the plane is up, the multiplier rises from 1.00×.</li>
      <li>Press <b>Cash out</b> any time to win bet × the current multiplier. If the plane flies away first, the bet is lost.</li>
      <li>You have two bet panels, so you can play a safe and a risky bet in the same round. Each can auto cash out at a target.</li>
      <li>Bets placed during a flight go into the next round. Chance the plane reaches x× = 99% ÷ x.</li></ul>`,
    mount({ table, controls }) {
      table.classList.add('dark-felt');
      table.innerHTML = `<div class="sc-wrap"><div class="pills sc-hist"></div><div class="sc-main">
        <div class="sc-stage"><canvas></canvas><div class="sc-mult"></div><div class="sc-msg"></div></div>
        <div class="sc-players"><div class="sc-ph">All bets <b></b></div><div class="sc-list"></div></div></div></div>`;
      const cv = $('canvas', table), ctx = cv.getContext('2d'), multEl = $('.sc-mult', table), msgEl = $('.sc-msg', table), list = $('.sc-list', table);
      const hist = $('.sc-hist', table);
      let W, H; const resize = () => [W, H] = fitCanvas(cv, .56); resize(); addEventListener('resize', resize);
      let phase = 'waiting', crash = 1, t0 = 0, m = 1, alive = true, raf = 0, waitEnd = 0, players = [], flyOff = 0;
      const clouds = Array.from({ length: 6 }, () => ({ x: Math.random(), y: Math.random() * .6, s: .6 + Math.random() * .8, v: .02 + Math.random() * .04 }));
      const panels = [0, 1].map(i => {
        const bet = betBox('crash_bet' + i, i ? 5 : 10);
        const el = h(`<div class="sc-panel"><label class="sc-auto"><input type="checkbox"> Auto cash out <input type="number" class="numin" min="1.01" step=".01"></label></div>`);
        const [chk, at] = $$('input', el); chk.checked = store.get('crash_auto' + i, false); at.value = store.get('crash_at' + i, i ? 10 : 2);
        chk.onchange = () => store.set('crash_auto' + i, chk.checked); at.onchange = () => { at.value = Math.max(1.01, round2(+at.value || 2)); store.set('crash_at' + i, +at.value); };
        const btn = h('<button class="btn green sc-btn">Bet</button>');
        el.prepend(bet.el); el.append(btn);
        const p = { bet, el, btn, chk, at, state: 'idle', stake: 0 };
        btn.onclick = () => click(p);
        return p;
      });
      controls.append(...panels.map(p => p.el));
      function label(p) {
        const b = p.btn; b.className = 'btn sc-btn';
        if (p.state === 'idle') { b.textContent = phase === 'flying' ? 'Bet (next round)' : 'Bet'; b.classList.add('green'); }
        else if (p.state === 'placed') { b.textContent = phase === 'flying' ? 'Cancel · next round' : 'Cancel'; b.classList.add('red'); }
        else if (p.state === 'in') { b.textContent = `Cash out ${fmt(round2(p.stake * m))}`; b.classList.add('cash'); }
        else { b.textContent = p.won ? `Won ${fmt(p.won)}` : 'Lost'; b.disabled = true; return; }
        b.disabled = false; p.bet.lock(p.state !== 'idle');
      }
      function click(p) {
        if (p.state === 'idle') { p.stake = p.bet.get(); if (!Casino.take(p.stake)) return; p.state = 'placed'; sfx.chip(); }
        else if (p.state === 'placed') { Casino.refund(p.stake); p.state = 'idle'; }
        else if (p.state === 'in') cashout(p, m);
        label(p);
      }
      function cashout(p, at) {
        p.state = 'done'; p.won = round2(p.stake * at);
        settle(p.won, p.stake, `Cashed out at ${at.toFixed(2)}×`); label(p);
      }
      const newCrash = () => Math.max(1, Math.floor(99 / (100 * (1 - Math.random())) * 100) / 100);
      function seedPlayers() {
        players = Array.from({ length: 14 + rnd(10) }, () => ({ n: NAMES(), bet: [1, 2, 5, 10, 20, 25, 50, 100, 250][rnd(9)], at: Math.max(1.05, round2(1 / (1 - Math.random() * .93))), out: 0 }))
          .sort((a, b) => b.bet - a.bet);
        drawPlayers();
      }
      function drawPlayers() {
        $('.sc-ph b', table).textContent = players.length;
        list.innerHTML = players.map(p => `<div class="${p.out ? 'won' : phase === 'crashed' ? 'lost' : ''}"><span>${p.n}</span><span>$${p.bet}</span><span>${p.out ? p.at.toFixed(2) + '× $' + round2(p.bet * p.at) : ''}</span></div>`).join('');
      }

      function draw(now) {
        const g = ctx; g.clearRect(0, 0, W, H);
        // sunburst rays from the bottom-left corner
        g.save(); g.translate(0, H); const rot = now / 9000;
        for (let i = 0; i < 24; i++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, W * 1.6, rot + i * Math.PI / 12, rot + i * Math.PI / 12 + Math.PI / 24); g.fillStyle = 'rgba(255,255,255,.025)'; g.fill(); }
        g.restore();
        const fly = phase !== 'waiting';
        clouds.forEach(c => { if (fly && phase === 'flying') c.x -= c.v * .016; if (c.x < -.2) { c.x = 1.1; c.y = Math.random() * .6; } cloud(g, c.x * W, c.y * H + 20, c.s * W / 900, .12); });
        const pad = 30, w = W - pad * 2, hh = H - pad * 2, t = phase === 'waiting' ? 0 : ((phase === 'flying' ? now : flyOff) - t0) / 1000;
        const T = Math.max(8, t / .8), M = Math.max(1.8, 1 + (m - 1) / .7);
        const px = s => pad + s / T * w, py = mm => H - pad - (mm - 1) / (M - 1) * hh;
        g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.beginPath(); g.moveTo(pad, pad); g.lineTo(pad, H - pad); g.lineTo(W - pad, H - pad); g.stroke();
        if (fly) {
          g.beginPath(); g.moveTo(px(0), py(1));
          const N = 60; for (let i = 1; i <= N; i++) { const s = t * i / N; g.lineTo(px(s), py(Math.exp(.1 * s))); }
          g.lineTo(px(t), H - pad); g.lineTo(px(0), H - pad); g.closePath(); g.fillStyle = 'rgba(225,29,72,.25)'; g.fill();
          g.beginPath(); g.moveTo(px(0), py(1)); for (let i = 1; i <= N; i++) { const s = t * i / N; g.lineTo(px(s), py(Math.exp(.1 * s))); } g.strokeStyle = '#e11d48'; g.lineWidth = 4; g.stroke();
        }
        let x = px(t), y = py(m), ang = -Math.atan2(.1 * m / (M - 1) * hh, w / T) * .9;
        if (phase === 'crashed') { const k = (now - flyOff) / 700; x += k * k * W; y -= k * k * H * .8; }
        if (phase === 'waiting') { x = px(0) + 10; y = H - pad - 12; ang = 0; }
        drawPlane(g, x, y, ang, Math.max(.6, W / 900), now / 1000);
      }
      function frame(now) {
        if (!alive) return;
        if (phase === 'flying') {
          m = Math.min(crash, Math.floor(Math.exp(.1 * (now - t0) / 1000) * 100) / 100);
          multEl.textContent = m.toFixed(2) + '×';
          for (const p of panels) { if (p.state === 'in') { if (p.chk.checked && m >= +p.at.value) cashout(p, +p.at.value); else label(p); } }
          let changed = false; players.forEach(p => { if (!p.out && m >= p.at) { p.out = 1; changed = true; } }); if (changed) drawPlayers();
          if (m >= crash) crashNow(now);
        } else if (phase === 'waiting') {
          const left = Math.max(0, (waitEnd - now) / 1000); msgEl.innerHTML = `Next flight in <b>${left.toFixed(1)}s</b><i style="width:${left / 5 * 100}%"></i>`;
          if (now >= waitEnd) takeoff(now);
        }
        draw(now); raf = requestAnimationFrame(frame);
      }
      function takeoff(now) {
        phase = 'flying'; t0 = now; m = 1; msgEl.innerHTML = ''; multEl.className = 'sc-mult';
        panels.forEach(p => { if (p.state === 'placed') p.state = 'in'; label(p); });
        tone(300, .5, 'sawtooth', .03); tone(600, .6, 'sawtooth', .02, .2);
      }
      function crashNow(now) {
        phase = 'crashed'; flyOff = now; m = crash; multEl.textContent = crash.toFixed(2) + '×'; multEl.classList.add('crashed');
        msgEl.innerHTML = '<span class="sc-away">FLEW AWAY!</span>';
        panels.forEach(p => { if (p.state === 'in') { p.state = 'done'; p.won = 0; sfx.lose(); } label(p); });
        drawPlayers();
        hist.insertAdjacentHTML('afterbegin', `<span class="pill ${crash >= 10 ? 'hot' : crash >= 2 ? 'mid' : 'low'}">${crash.toFixed(2)}×</span>`);
        while (hist.children.length > 20) hist.lastChild.remove();
        setTimeout(() => {
          if (!alive) return;
          phase = 'waiting'; crash = newCrash(); waitEnd = performance.now() + 5000; m = 1; multEl.textContent = ''; seedPlayers();
          panels.forEach(p => { if (p.state === 'done') p.state = 'idle'; label(p); });
        }, 2600);
      }
      crash = newCrash(); waitEnd = performance.now() + 4000; seedPlayers(); panels.forEach(label);
      [2.4, 1.13, 7.81, 1.92, 1, 3.05, 1.4].forEach(v => hist.insertAdjacentHTML('beforeend', `<span class="pill ${v >= 10 ? 'hot' : v >= 2 ? 'mid' : 'low'}">${v.toFixed(2)}×</span>`));
      raf = requestAnimationFrame(frame);
      Casino.hotkey = () => click(panels[0]);
      return () => {
        alive = false; cancelAnimationFrame(raf); removeEventListener('resize', resize);
        panels.forEach(p => { if (p.state === 'placed') Casino.refund(p.stake); if (p.state === 'in') cashout(p, m); });
      };
    },
  });

  // ---------- Sky Masters ----------
  // Boosts add to or multiply the counter, bombs halve it. Land on the carrier to collect.
  const BOOSTS = [['+1', 40, c => c + 1], ['+2', 20, c => c + 2], ['+5', 5, c => c + 5], ['+10', 1.5, c => c + 10], ['×2', 12, c => c * 2], ['×3', 3, c => c * 3], ['×4', 1, c => c * 4], ['×5', .5, c => c * 5]];
  // events, bomb chance, landing chance (tuned so every speed returns ~97%), cruise speed px/s
  const SPEEDS = { slow: [4, .45, .2702, 230], normal: [5, .5, .2799, 290], fast: [6, .55, .3153, 360], turbo: [7, .6, .3764, 440] };
  Casino.games.push({
    id: 'skymasters', section: 'Originals', name: 'Sky Masters', tag: 'Fly · Boosts, bombs, land it', icon: '🛩️', accent: '#0ea5e9',
    blurb: 'Fly over the ocean through multipliers and bombs, then stick the landing on the carrier.',
    rules: `<ul><li>The counter starts at your bet. The plane flies through boosts (<b>+1, +2, +5, +10, ×2 to ×5</b>) that grow it, and <b>bombs</b> that halve it. Clouds are just scenery.</li>
      <li>At the end the plane tries to land on the aircraft carrier. Land it and you win the counter. Miss and it ditches in the sea and the bet is lost.</li>
      <li>Speed sets the flight: Slow = 4 objects, Normal 5, Fast 6, Turbo 7. Faster flights hit more bombs but land more often.</li>
      <li>Every speed returns about 97% over the long run.</li></ul>`,
    mount({ table, controls }) {
      table.classList.add('dark-felt');
      table.innerHTML = `<div class="sm-stage"><canvas></canvas><div class="sm-count"></div></div><div class="pills sm-hist"></div>`;
      const cv = $('canvas', table), ctx = cv.getContext('2d'), countEl = $('.sm-count', table), pill = pillRow($('.sm-hist', table));
      let W, H; const resize = () => [W, H] = fitCanvas(cv, .5); resize(); addEventListener('resize', resize);
      let speed = store.get('sm_speed', 'normal'), busy = false, alive = true, raf = 0;
      const bet = betBox('sm_bet', 10), goBtn = button('Fly', 'green', fly);
      const sp = h('<div class="btns"></div>');
      Object.keys(SPEEDS).forEach(k => { const b = button(k[0].toUpperCase() + k.slice(1), 'ghost small', () => { if (busy) return; speed = k; store.set('sm_speed', k); $$('.btn', sp).forEach(x => x.classList.toggle('on', x === b)); sfx.tick(); }); b.classList.toggle('on', k === speed); sp.append(b); });
      controls.append(bet.el, sp, h('<div class="btns"></div>').appendChild(goBtn).parentNode);
      // static scene for idle state
      const bgClouds = Array.from({ length: 9 }, (_, i) => ({ x: i * 220 + rnd(120), y: 20 + rnd(90), s: .5 + Math.random() * .6 }));
      function scene(cam, now) {
        const g = ctx, sea = H * .78;
        const sky = g.createLinearGradient(0, 0, 0, sea); sky.addColorStop(0, '#0c4a6e'); sky.addColorStop(1, '#7dd3fc'); g.fillStyle = sky; g.fillRect(0, 0, W, sea);
        g.fillStyle = '#fde68a'; g.beginPath(); g.arc(W * .82, H * .2, 26, 0, 7); g.fill();
        bgClouds.forEach(c => { const x = ((c.x - cam * .3) % 2000 + 2000) % 2000 - 100; cloud(g, x * W / 900, c.y * H / 300, c.s * W / 900); });
        const sg = g.createLinearGradient(0, sea, 0, H); sg.addColorStop(0, '#0369a1'); sg.addColorStop(1, '#082f49'); g.fillStyle = sg; g.fillRect(0, sea, W, H - sea);
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
        for (let r = 0; r < 3; r++) { g.beginPath(); for (let x = 0; x <= W; x += 10) g.lineTo(x, sea + 8 + r * 14 + Math.sin((x + cam * (1 + r * .3)) / 30 + now / 400) * 3); g.stroke(); }
        return sea;
      }
      function ship(x, sea) {
        const g = ctx, L = W * .32;
        g.fillStyle = '#475569'; g.beginPath(); g.moveTo(x - L / 2, sea - 18); g.lineTo(x + L / 2, sea - 18); g.lineTo(x + L / 2 - 20, sea + 6); g.lineTo(x - L / 2 + 14, sea + 6); g.fill();
        g.fillStyle = '#334155'; g.fillRect(x + L * .2, sea - 44, 24, 26);
        g.strokeStyle = '#fde047'; g.setLineDash([10, 8]); g.lineWidth = 2; g.beginPath(); g.moveTo(x - L / 2 + 10, sea - 20); g.lineTo(x + L * .18, sea - 20); g.stroke(); g.setLineDash([]);
        return [x - L / 2 + 10, x + L * .18];
      }
      function idle(now) { const sea = scene(0, now); ship(W * .22, sea); drawPlane(ctx, W * .12, sea - 30, 0, W / 1000, 0); }
      const idleLoop = now => { if (!alive) return; if (!busy) idle(now); raf = requestAnimationFrame(idleLoop); };
      raf = requestAnimationFrame(idleLoop);

      async function fly() {
        if (busy) return; const stake = bet.get(); if (!Casino.take(stake)) return;
        busy = true; goBtn.disabled = true; bet.lock(true);
        const [n, pBomb, pLand, v] = SPEEDS[speed], tw = BOOSTS.reduce((a, b) => a + b[1], 0);
        const D = W * .42, startShip = W * .22;
        const events = Array.from({ length: n }, (_, i) => {
          const x = W * .9 + i * D, y = H * (.2 + Math.random() * .38);
          if (Math.random() < pBomb) return { x, y, bomb: true, label: '÷2', fn: c => c / 2 };
          let r = Math.random() * tw; const b = BOOSTS.find(b => (r -= b[1]) < 0) || BOOSTS[0];
          return { x, y, label: b[0], fn: b[2] };
        });
        const deco = Array.from({ length: n * 2 }, (_, i) => ({ x: W * .7 + i * D / 2 + rnd(80), y: H * (.12 + Math.random() * .45), s: .5 + Math.random() * .5 }));
        const land = Math.random() < pLand, endShip = events.at(-1).x + D * 1.4;
        let c = 1, cam = 0, py = H * .78 - 30, last = performance.now(), doneAt = 0, splash = 0;
        const planeX = () => cam + W * .25;
        countEl.className = 'sm-count on'; countEl.textContent = fmt(stake);
        tone(260, .8, 'sawtooth', .025);
        await new Promise(res => {
          const step = now => {
            if (!alive) return res();
            const dt = Math.min(.05, (now - last) / 1000); last = now;
            const sea = H * .78, px = planeX();
            let vv = v * W / 900;
            const [deckA, deckB] = [endShip - W * .16 + 10, endShip + W * .32 * .18];
            let ty;
            const next = events.find(e => !e.hit);
            if (px < startShip + D * .6) ty = sea - 30 - (px - startShip) / (D * .6) * H * .3;
            else if (next) ty = next.x - px < D * .8 ? next.y : H * .35;
            else if (land) { ty = px < deckA - D * .5 ? H * .35 : sea - 30; if (px > deckA) { vv *= Math.max(0, 1 - (px - deckA) / (deckB - deckA)); if (vv < 8 * W / 900 && !doneAt) doneAt = now; } }
            else { ty = px < deckA - D * .9 ? H * .35 : sea + 40; }
            py += (ty - py) * Math.min(1, dt * 3.5);
            if (!doneAt && !splash) cam += vv * dt;
            for (const e of events) if (!e.hit && Math.abs(e.x - px) < 22) {
              e.hit = true; c = e.fn(c); countEl.textContent = fmt(round2(c * stake));
              countEl.classList.remove('up', 'down'); void countEl.offsetWidth; countEl.classList.add(e.bomb ? 'down' : 'up');
              if (e.bomb) { tone(90, .4, 'sawtooth', .07); py += 30; } else tone(700 + rnd(500), .15, 'triangle', .07);
            }
            if (!land && !splash && py > sea) { splash = now; tone(120, .6, 'sine', .07); }
            // draw
            const seaY = scene(cam, now);
            ship(startShip - cam, seaY); ship(endShip - cam, seaY);
            deco.forEach(d => cloud(ctx, d.x - cam, d.y, d.s * W / 900, .9));
            for (const e of events) {
              if (e.hit) continue; const ex = e.x - cam;
              ctx.beginPath(); ctx.arc(ex, e.y, 20 * W / 900 + 6, 0, 7); ctx.fillStyle = e.bomb ? '#111827' : '#16a34a'; ctx.fill();
              ctx.lineWidth = 3; ctx.strokeStyle = e.bomb ? '#ef4444' : '#fde047'; ctx.stroke();
              ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(12 + W / 90)}px Oswald, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.fillText(e.bomb ? '💣' : e.label, ex, e.y);
            }
            if (!splash) drawPlane(ctx, W * .25, py, (ty - py) / 300, W / 1000, now / 1000);
            else { const k = (now - splash) / 600; ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - k)})`; ctx.beginPath(); ctx.arc(W * .25, sea, 10 + k * 40, Math.PI, 0); ctx.fill(); }
            countEl.style.left = (W * .25) + 'px'; countEl.style.top = Math.max(10, py - 60) + 'px';
            if ((doneAt && now - doneAt > 700) || (splash && now - splash > 900)) return res();
            raf = requestAnimationFrame(step);
          };
          cancelAnimationFrame(raf); raf = requestAnimationFrame(step);
        });
        if (!alive) { if (land) Casino.pay(round2(c * stake)); return; }
        const won = land ? round2(c * stake) : 0;
        pill(land ? `${round2(c).toFixed(2)}×` : 'Splash', land);
        settle(won, stake, land ? `Landed with ${round2(c).toFixed(2)}×` : 'Missed the carrier!');
        countEl.className = 'sm-count';
        busy = false; goBtn.disabled = false; bet.lock(false);
        raf = requestAnimationFrame(idleLoop);
      }
      Casino.hotkey = fly;
      return () => { alive = false; cancelAnimationFrame(raf); removeEventListener('resize', resize); };
    },
  });
})();
