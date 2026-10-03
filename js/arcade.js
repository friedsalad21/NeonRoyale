// Arcade & lottery: Coin Pusher, Scratch Cards, Bingo.
(() => {
  const ctrl = (...els) => { const b = h('<div class="btns"></div>'); b.append(...els); return b; };

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
