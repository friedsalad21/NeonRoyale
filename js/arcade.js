// Arcade & lottery: Coin Pusher, Scratch Cards, Bingo.
(() => {
  const ctrl = (...els) => { const b = h('<div class="btns"></div>'); b.append(...els); return b; };

  // ---------- Coin Pusher ----------
  // Top-down tray: a pusher sweeps back and forth; coins push each other, and coins shoved over the front lip pay out.
  // Coins dropping into the small gutters at the front corners go to the house, which is where the house edge comes from.
  Casino.games.push({
    id: 'pusher', section: 'Arcade & Lottery', name: 'Coin Pusher', tag: 'Arcade · Shove coins over the edge', icon: '🪙', accent: '#eab308',
    blurb: 'Drop coins onto the shelf and let the pusher shove the pile over the edge.',
    rules: `<ul><li>Click (or tap) above the tray to drop a coin worth your selected chip.</li>
      <li>The pusher sweeps forward and back. Every coin pushed off the <b>front edge</b> pays its value to you.</li>
      <li>The tray has walls, but the front corners have <b>gutters</b>: coins that drop in there go to the house. Look out for 💎 gem coins: they pay 10×.</li>
      <li>The tray is saved, so the pile is still there when you come back.</li></ul>`,
    mount({ table, controls }) {
      table.classList.add('dark-felt');
      table.innerHTML = `<div class="cp"><canvas></canvas><div class="pills cp-log"></div></div>`;
      const cv = $('canvas', table), ctx = cv.getContext('2d'), log = pillRow($('.cp-log', table), 10);
      const info = h('<div class="info-line">Coins on tray <b>0</b> · won <b>$0</b></div>');
      controls.append(chipRack(), info, ctrl(button('Drop 5 coins', 'green', () => { for (let i = 0; i < 5; i++) setTimeout(() => drop(.2 + Math.random() * .6), i * 180); })));
      const TW = 300, TH = 420, R = 15, SHELF = 70, GUT = 24; // tray units; GUT = width of each front-corner gutter
      let coins = store.get('pusher_coins', null), pushY = 0, t = 0, raf = 0, alive = true, won = 0, W = 0, H = 0, s = 1;
      if (!coins) { coins = []; for (let i = 0; i < 70; i++) coins.push({ x: R + Math.random() * (TW - 2 * R), y: SHELF + 40 + Math.random() * (TH - SHELF - 140), v: 1, g: Math.random() < .04 }); }
      const resize = () => { const dpr = devicePixelRatio || 1; W = Math.min(cv.parentElement.clientWidth, 420); s = W / TW; H = TH * s; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0); };
      resize(); addEventListener('resize', resize);
      function drop(fx) {
        if (!Casino.take(Casino.chip)) return;
        coins.push({ x: Math.max(R, Math.min(TW - R, fx * TW)), y: pushY + R + 2, v: Casino.chip, g: Math.random() < .005, fresh: 12 }); sfx.chip();
      }
      cv.onclick = e => { const r = cv.getBoundingClientRect(); drop((e.clientX - r.left) / r.width); };
      function physics() {
        t += .016; pushY = SHELF * (.5 + .5 * Math.sin(t * 1.4)) + 10;
        for (const c of coins) if (c.y - R < pushY) c.y = pushY + R;
        for (let it = 0; it < 4; it++) for (let i = 0; i < coins.length; i++) for (let j = i + 1; j < coins.length; j++) {
          const a = coins[i], b = coins[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
          if (d2 >= 4 * R * R || d2 === 0) continue;
          const d = Math.sqrt(d2), o = (2 * R - d) / 2, nx = dx / d, ny = dy / d;
          // whoever is nearer the pusher can't move back into it
          const aBlocked = a.y - R <= pushY + .5, bBlocked = b.y - R <= pushY + .5;
          const ka = aBlocked ? 0 : bBlocked ? 2 : 1, kb = bBlocked ? 0 : aBlocked ? 2 : 1;
          a.x -= nx * o * ka; a.y -= ny * o * ka; b.x += nx * o * kb; b.y += ny * o * kb;
        }
        for (let i = coins.length - 1; i >= 0; i--) {
          const c = coins[i];
          c.x = Math.max(R, Math.min(TW - R, c.x)); // side walls
          if (c.fresh) c.fresh--;
          if (c.y - R * .3 > TH && (c.x < GUT || c.x > TW - GUT)) { coins.splice(i, 1); log(`gutter ${fmt(c.v)}`, false); tone(160, .08, 'sine', .03); }
          else if (c.y - R * .3 > TH) { coins.splice(i, 1); const pay = c.v * (c.g ? 10 : 1); won += pay; Casino.pay(pay); log(c.g ? `💎 ${fmt(pay)}` : fmt(pay), true); tone(c.g ? 1300 : 900, .12, 'triangle', .06); if (c.g) sfx.win(); }
        }
      }
      function draw() {
        const g = ctx; g.clearRect(0, 0, TW, TH);
        const bg = g.createLinearGradient(0, 0, 0, TH); bg.addColorStop(0, '#3a2a12'); bg.addColorStop(1, '#1d1408'); g.fillStyle = bg; g.fillRect(0, 0, TW, TH);
        g.fillStyle = 'rgba(255,215,0,.08)'; g.fillRect(0, TH - 18, TW, 18);
        g.fillStyle = '#9ca3af'; g.fillRect(0, 0, TW, pushY); g.fillStyle = '#d1d5db'; g.fillRect(0, pushY - 6, TW, 6);
        g.fillStyle = '#111'; g.font = '700 14px Oswald, sans-serif'; g.textAlign = 'center'; g.fillText('▼  CLICK TO DROP  ▼', TW / 2, Math.max(18, pushY / 2 + 5));
        for (const c of coins) {
          const grd = g.createRadialGradient(c.x - 4, c.y - 4, 2, c.x, c.y, R); grd.addColorStop(0, c.g ? '#e0f2fe' : '#fff3b0'); grd.addColorStop(1, c.g ? '#0ea5e9' : '#b8860b');
          g.beginPath(); g.arc(c.x, c.y, R, 0, 7); g.fillStyle = grd; g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5; g.stroke();
          g.fillStyle = c.g ? '#0c4a6e' : '#5c3d00'; g.font = '700 11px Oswald, sans-serif'; g.textBaseline = 'middle'; g.fillText(c.g ? '💎' : short(c.v), c.x, c.y + 1);
        }
        g.fillStyle = '#6b7280'; g.fillRect(0, 0, 3, TH); g.fillRect(TW - 3, 0, 3, TH);
        g.fillStyle = 'rgba(220,38,38,.55)'; g.fillRect(0, TH - 10, GUT, 10); g.fillRect(TW - GUT, TH - 10, GUT, 10);
      }
      function frame() { if (!alive) return; physics(); draw(); $$('b', info)[0].textContent = coins.length; $$('b', info)[1].textContent = fmt(round2(won)); raf = requestAnimationFrame(frame); }
      raf = requestAnimationFrame(frame);
      Casino.hotkey = () => drop(.3 + Math.random() * .4);
      return () => { alive = false; cancelAnimationFrame(raf); removeEventListener('resize', resize); store.set('pusher_coins', coins.map(c => ({ x: round2(c.x), y: round2(c.y), v: c.v, g: c.g }))); };
    },
  });

  // ---------- Scratch Cards ----------
  // prize ladder per ticket: × price and probability (returns about 93%)
  const PRIZES = [[500, .0002], [100, .001], [20, .006], [10, .015], [5, .04], [2, .08], [1, .1]];
  const TICKETS = [1, 5, 20];
  Casino.games.push({
    id: 'scratch', section: 'Arcade & Lottery', name: 'Scratch Cards', tag: 'Instant win · 500×', icon: '🎟️', accent: '#a3e635',
    blurb: 'Scratch off the silver to reveal 9 prizes. Match three to win that amount.',
    rules: `<ul><li>Buy a $1, $5 or $20 ticket. Scratch the silver panel with your mouse or finger (or press Reveal).</li>
      <li>Match <b>three identical amounts</b> to win that amount. Top prize is 500× the ticket price.</li>
      <li>About 1 in 4 tickets wins something.</li></ul>`,
    mount({ table, controls }) {
      table.innerHTML = `<div class="sc-card"><div class="sc-head">LUCKY <b>MATCH 3</b></div><div class="sc-area"><div class="sc-grid"></div><canvas></canvas></div><div class="duel-msg sc-res">Buy a ticket</div></div>`;
      const grid = $('.sc-grid', table), cv = $('.sc-area canvas', table), ctx = cv.getContext('2d'), res = $('.sc-res', table);
      let price = store.get('scratch_p', 5), live = false, prize = 0, scratched = 0, cells = 0;
      const tk = h('<div class="btns"></div>');
      TICKETS.forEach(p => { const b = button(`$${p} ticket`, 'ghost', () => { if (live) return; price = p; store.set('scratch_p', p); $$('.btn', tk).forEach(x => x.classList.toggle('on', x === b)); sfx.tick(); }); b.classList.toggle('on', p === price); tk.append(b); });
      const buyBtn = button('Buy ticket', 'green', buy), revBtn = button('Reveal all', 'ghost', () => finish());
      controls.append(tk, ctrl(revBtn, buyBtn));
      const coverAll = () => {
        const r = cv.getBoundingClientRect(), dpr = devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const g = ctx.createLinearGradient(0, 0, r.width, r.height); g.addColorStop(0, '#d1d5db'); g.addColorStop(.5, '#f3f4f6'); g.addColorStop(1, '#9ca3af');
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = g; ctx.fillRect(0, 0, r.width, r.height);
        ctx.fillStyle = '#6b7280'; ctx.font = '700 22px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SCRATCH HERE', r.width / 2, r.height / 2 + 8);
        cv.style.opacity = 1; cells = r.width * r.height; scratched = 0;
      };
      function layout(win) {
        const ladder = PRIZES.map(p => p[0]);
        const amounts = [];
        if (win) amounts.push(win, win, win);
        const counts = {}; amounts.forEach(a => counts[a] = (counts[a] || 0) + 1);
        while (amounts.length < 9) { const a = ladder[rnd(ladder.length)]; if ((counts[a] || 0) >= 2 || a === win) continue; counts[a] = (counts[a] || 0) + 1; amounts.push(a); }
        return shuffle(amounts);
      }
      function buy() {
        if (live) return; if (!Casino.take(price)) return;
        let r = Math.random(); prize = 0;
        for (const [x, p] of PRIZES) { if ((r -= p) < 0) { prize = x; break; } }
        grid.innerHTML = layout(prize).map(a => `<div class="${prize && a === prize ? 'm' : ''}">${fmt(a * price)}</div>`).join('');
        live = true; buyBtn.disabled = true; res.textContent = 'Scratch to reveal…'; coverAll(); sfx.chip();
      }
      function finish() {
        if (!live) return; live = false; buyBtn.disabled = false; cv.style.opacity = 0;
        $$('.m', grid).forEach(e => e.classList.add('hit'));
        res.textContent = prize ? `MATCH 3! You win ${fmt(prize * price)}` : 'No match this time';
        settle(prize * price, price, prize ? 'Scratch card winner' : '');
      }
      let down = false;
      const scratch = e => {
        if (!live || !down) return; e.preventDefault();
        const r = cv.getBoundingClientRect(), p = e.touches ? e.touches[0] : e, x = p.clientX - r.left, y = p.clientY - r.top;
        ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(x, y, 18, 0, 7); ctx.fill();
        scratched += 400; if (Math.random() < .15) tone(2000 + rnd(1500), .02, 'sawtooth', .01);
        if (scratched > cells * .55) finish();
      };
      cv.addEventListener('pointerdown', e => { down = true; scratch(e); }); addEventListener('pointerup', () => down = false); cv.addEventListener('pointermove', scratch);
      cv.addEventListener('touchmove', e => { down = true; scratch(e); }, { passive: false });
      grid.innerHTML = Array(9).fill('<div>?</div>').join(''); requestAnimationFrame(coverAll);
      Casino.hotkey = () => live ? finish() : buy();
      return () => { if (live) finish(); };
    },
  });

  // ---------- Bingo ----------
  // 40 balls, up to 4 cards; each card pays its best pattern (returns ~94%)
  const PATTERNS = [['Frame', 2000], ['X', 10], ['Two lines', 2.5], ['Four corners', 3], ['Line', 1.5]];
  const LINES = []; for (let r = 0; r < 5; r++) LINES.push([0, 1, 2, 3, 4].map(c => r * 5 + c)); for (let c = 0; c < 5; c++) LINES.push([0, 1, 2, 3, 4].map(r => r * 5 + c)); LINES.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  const CORNERS = [0, 4, 20, 24], XS = [0, 6, 12, 18, 24, 4, 8, 16, 20], FRAME = [0, 1, 2, 3, 4, 5, 9, 10, 14, 15, 19, 20, 21, 22, 23, 24];
  function best(m) {
    const all = a => a.every(i => m[i]), nl = LINES.filter(all).length;
    if (all(FRAME)) return 0; if (all(XS)) return 1; if (nl >= 2) return 2; if (all(CORNERS)) return 3; if (nl) return 4; return -1;
  }
  Casino.games.push({
    id: 'bingo', section: 'Arcade & Lottery', name: 'Bingo Bonanza', tag: 'Video bingo · 2000×', icon: '🅱️', accent: '#3b82f6',
    blurb: 'Play up to four cards. 40 balls are called, and the best pattern on each card pays.',
    rules: `<ul><li>Choose 1–4 cards. Each card costs your selected chip.</li><li>40 of the 75 balls are drawn. The free centre square is always marked.</li>
      <li>Each card pays its best pattern: Line 1.5×, Two lines 2.5×, Four corners 3×, X 10×, Frame (the whole border) <b>2000×</b>.</li></ul>`,
    mount({ table, controls }) {
      table.innerHTML = `<div class="bg-top"><div class="bg-ball">—</div><div class="bg-called"></div></div><div class="bg-cards"></div><div class="bg-pay">${PATTERNS.map(([n, x]) => `<span>${n} <b>${x}×</b></span>`).join('')}</div>`;
      const ballEl = $('.bg-ball', table), called = $('.bg-called', table), cardsEl = $('.bg-cards', table);
      let n = store.get('bingo_n', 2), cards = [], busy = false;
      const nb = h('<div class="btns"></div>');
      [1, 2, 3, 4].forEach(k => { const b = button(`${k} card${k > 1 ? 's' : ''}`, 'ghost', () => { if (busy) return; n = k; store.set('bingo_n', k); $$('.btn', nb).forEach(x => x.classList.toggle('on', x === b)); newCards(); }); b.classList.toggle('on', k === n); nb.append(b); });
      const info = h('<div class="info-line">Cost <b>$0</b></div>');
      const playBtn = button('Play', 'green', play), newBtn = button('New cards', 'ghost', () => !busy && newCards());
      controls.append(chipRack(), nb, info, ctrl(newBtn, playBtn));
      const colOf = v => 'BINGO'[Math.floor((v - 1) / 15)];
      function newCards() {
        cards = Array.from({ length: n }, () => { const c = []; for (let col = 0; col < 5; col++) shuffle(Array.from({ length: 15 }, (_, i) => col * 15 + i + 1)).slice(0, 5).forEach((v, r) => c[r * 5 + col] = v); c[12] = 0; return c; });
        cardsEl.innerHTML = cards.map(c => `<div class="bg-card"><div class="bg-h">${[...'BINGO'].map(l => `<span>${l}</span>`).join('')}</div><div class="bg-g">${c.map(v => `<div class="${v ? '' : 'free on'}">${v || '★'}</div>`).join('')}</div><div class="bg-win"></div></div>`).join('');
        upd();
      }
      const upd = () => $('b', info).textContent = fmt(Casino.chip * n);
      controls.addEventListener('click', upd);
      async function play() {
        if (busy) return; const each = Casino.chip, cost = each * n; if (!Casino.take(cost)) return;
        busy = true; playBtn.disabled = true; called.innerHTML = '';
        $$('.bg-g div', cardsEl).forEach(d => { if (!d.classList.contains('free')) d.className = ''; });
        $$('.bg-win', cardsEl).forEach(d => d.textContent = '');
        const balls = shuffle(Array.from({ length: 75 }, (_, i) => i + 1)).slice(0, 40), drawn = new Set([0]);
        for (const b of balls) {
          drawn.add(b); ballEl.textContent = `${colOf(b)}${b}`; ballEl.className = 'bg-ball c' + colOf(b);
          called.insertAdjacentHTML('afterbegin', `<span class="c${colOf(b)}">${b}</span>`);
          let hit = false;
          cards.forEach((c, ci) => { const i = c.indexOf(b); if (i >= 0) { $$('.bg-card', cardsEl)[ci].querySelectorAll('.bg-g div')[i].classList.add('on'); hit = true; } });
          hit ? tone(880, .08, 'triangle', .05) : sfx.tick();
          await sleep(110);
        }
        let paid = 0, top = -1;
        cards.forEach((c, ci) => {
          const k = best(c.map(v => drawn.has(v))), el = $$('.bg-win', cardsEl)[ci];
          if (k >= 0) { paid += each * PATTERNS[k][1]; el.textContent = `${PATTERNS[k][0]} · ${fmt(each * PATTERNS[k][1])}`; if (top < 0 || k < top) top = k; } else el.textContent = 'No pattern';
        });
        busy = false; playBtn.disabled = false;
        settle(round2(paid), cost, top >= 0 ? PATTERNS[top][0] : '');
      }
      newCards();
      Casino.hotkey = play;
    },
  });
})();
