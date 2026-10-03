(() => {
  // Pocket multipliers per rows/risk (classic online tables, each returns ~99%).
  const PAY = {
    8: { low: [5.6, 2.1, 1.1, 1, .5, 1, 1.1, 2.1, 5.6], medium: [13, 3, 1.3, .7, .4, .7, 1.3, 3, 13], high: [29, 4, 1.5, .3, .2, .3, 1.5, 4, 29] },
    12: { low: [10, 3, 1.6, 1.4, 1.1, 1, .5, 1, 1.1, 1.4, 1.6, 3, 10], medium: [33, 11, 4, 2, 1.1, .6, .3, .6, 1.1, 2, 4, 11, 33], high: [170, 24, 8.1, 2, .7, .2, .2, .2, .7, 2, 8.1, 24, 170] },
    16: { low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, .5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16], medium: [110, 41, 10, 5, 3, 1.5, 1, .5, .3, .5, 1, 1.5, 3, 5, 10, 41, 110], high: [1000, 130, 26, 9, 4, 2, .2, .2, .2, .2, .2, 2, 4, 9, 26, 130, 1000] },
  };
  // pocket colour: gold in the middle, hot red at the edges
  const pocketColor = (k, n) => { const t = Math.abs(k - n / 2) / (n / 2); return `hsl(${48 - t * 48},95%,${55 - t * 8}%)`; };

  Casino.games.push({
    id: 'plinko', section: 'Originals', name: 'Plinko', tag: 'Drop · 1000×', icon: '🔻', accent: '#f43f5e',
    blurb: 'Drop balls through the pins. Pick your risk and chase the 1000× edge pockets.',
    rules: `<ul>
      <li>Each ball costs one chip of the selected value. It bounces left or right off every row of pins and lands in a pocket that multiplies its bet.</li>
      <li><b>Rows</b> (8, 12, 16) and <b>risk</b> (low, medium, high) change the pockets. High risk on 16 rows pays up to 1000× at the edges but 0.2× in the middle.</li>
      <li>Every setting returns about 99% over the long run.</li>
      <li>Drop as many balls at once as you like. Space drops a ball, and Auto keeps dropping.</li></ul>`,
    mount({ table, controls }) {
      let rows = store.get('plinko_rows', 12), risk = store.get('plinko_risk', 'medium'), raf = 0, auto = false, alive = true;
      const balls = [], hits = new Map(), flashes = new Map();
      table.innerHTML = `<div class="plk"><canvas></canvas><div class="plk-hist"></div></div>`;
      const cv = $('canvas', table), ctx = cv.getContext('2d'), hist = $('.plk-hist', table);
      const info = h('<div class="info-line">In play <b>0</b></div>');
      const opt = (label, vals, cur, set) => {
        const g = h(`<div class="plk-opt"><small>${label}</small></div>`);
        vals.forEach(v => { const b = h(`<button class="btn ghost small">${v}</button>`); b.classList.toggle('on', v == cur); b.onclick = () => { if (balls.length) return toast('Wait for the balls to land'); set(v); layout(); draw(performance.now()); $$('.btn', g).forEach(x => x.classList.toggle('on', x === b)); sfx.tick(); }; g.append(b); });
        return g;
      };
      const dropBtn = button('Drop', 'red', drop), autoBtn = button('Auto', 'ghost', () => { auto = !auto; autoBtn.classList.toggle('on', auto); autoLoop(); });
      const btns = h('<div class="btns"></div>');
      btns.append(opt('Rows', [8, 12, 16], rows, v => { rows = +v; store.set('plinko_rows', rows); }), opt('Risk', ['low', 'medium', 'high'], risk, v => { risk = v; store.set('plinko_risk', risk); }), autoBtn, dropBtn);
      controls.append(chipRack(), info, btns);

      // geometry, recomputed for the current size and rows
      let W = 0, H = 0, dx = 0, dy = 0, top = 0, cx = 0, dpr = 1;
      function layout() {
        dpr = devicePixelRatio || 1; W = cv.clientWidth; H = Math.round(W * .82);
        cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        dx = W / (rows + 3); dy = (H - 70) / (rows + 1); top = 30; cx = W / 2;
      }
      const pinX = (i, j) => cx + (j - (i + 2) / 2) * dx, rowY = i => top + i * dy;
      const pocketX = k => cx + (k - rows / 2) * dx, pocketY = () => rowY(rows) + 12;

      function draw(now) {
        ctx.clearRect(0, 0, W, H);
        for (let i = 0; i < rows; i++) for (let j = 0; j < i + 3; j++) {
          const lit = now - (hits.get(i * 100 + j) || -1e9) < 180;
          ctx.beginPath(); ctx.arc(pinX(i, j), rowY(i), lit ? 4.5 : 3, 0, 7);
          ctx.fillStyle = lit ? '#fff' : 'rgba(255,255,255,.75)'; ctx.shadowColor = '#fff'; ctx.shadowBlur = lit ? 12 : 0; ctx.fill(); ctx.shadowBlur = 0;
        }
        const pays = PAY[rows][risk], pw = dx - 4, ph = 30, py = pocketY();
        pays.forEach((m, k) => {
          const x = pocketX(k) - pw / 2, f = Math.max(0, 1 - (now - (flashes.get(k) || -1e9)) / 400), y = py + f * 6;
          ctx.fillStyle = pocketColor(k, rows); ctx.beginPath(); ctx.roundRect(x, y, pw, ph, 6); ctx.fill();
          if (f) { ctx.fillStyle = `rgba(255,255,255,${f * .6})`; ctx.fill(); }
          ctx.fillStyle = '#1a0610'; ctx.font = `700 ${Math.max(8, Math.min(13, dx * .34))}px Oswald, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(m >= 100 ? m : m + '×', pocketX(k), y + ph / 2);
        });
        for (const b of balls) {
          ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(4, dx * .17), 0, 7);
          ctx.fillStyle = '#ff2e88'; ctx.shadowColor = '#ff2e88'; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
        }
      }
      // a ball hops pin to pin along a pre-rolled path of left/right bounces
      function tick(now) {
        for (let i = balls.length - 1; i >= 0; i--) {
          const b = balls[i], seg = Math.floor(b.t), f = b.t - seg;
          const p = k => k === 0 ? [cx, top - dy * .8] : k <= rows ? [cx + (b.path.slice(0, k - 1).reduce((a, x) => a + x, 0) - (k - 1) / 2) * dx, rowY(k - 1) - 7] : [pocketX(b.k), pocketY() + 8];
          const [ax, ay] = p(seg), [bx, by] = p(seg + 1);
          b.x = ax + (bx - ax) * f; b.y = ay + (by - ay) * f - Math.sin(f * Math.PI) * dy * .35;
          b.t += b.speed;
          if (Math.floor(b.t) !== seg && seg < rows) { const r = seg, j = b.path.slice(0, r).reduce((a, x) => a + x, 0) + 1; hits.set(r * 100 + j, now); tone(1200 + rnd(600), .02, 'square', .01); }
          if (b.t >= rows + 1) { balls.splice(i, 1); land(b); }
        }
        draw(now);
        $('b', info).textContent = balls.length;
        if (alive && balls.length) raf = requestAnimationFrame(tick); else { raf = 0; draw(now); }
      }
      function land(b) {
        const m = PAY[b.rows][b.risk][b.k], won = round2(b.bet * m);
        flashes.set(b.k, performance.now());
        Casino.pay(won);
        hist.insertAdjacentHTML('afterbegin', `<span style="background:${pocketColor(b.k, b.rows)}">${m}×</span>`);
        while (hist.children.length > 12) hist.lastChild.remove();
        if (m >= 10) { banner(`${m}×`, `Won ${fmt(won)}`); (m >= 100 ? sfx.big : sfx.win)(); if (m >= 100) coinShower(60); }
        else if (m >= 1) tone(500 + m * 120, .12, 'triangle', .05); else tone(220, .1, 'sine', .04);
      }
      function drop() {
        if (balls.length >= 60) return;
        if (!Casino.take(Casino.chip)) { auto = false; autoBtn.classList.remove('on'); return; }
        const path = Array.from({ length: rows }, () => rnd(2));
        balls.push({ path, k: path.reduce((a, x) => a + x, 0), rows, risk, bet: Casino.chip, t: 0, speed: .055 + Math.random() * .01, x: cx, y: 0 });
        sfx.chip();
        if (!raf) raf = requestAnimationFrame(tick);
      }
      async function autoLoop() { while (auto && alive) { drop(); await sleep(350); } }

      const onResize = () => { layout(); draw(performance.now()); };
      addEventListener('resize', onResize);
      layout(); draw(0);
      Casino.hotkey = drop;
      // leaving mid-drop: every ball still falling lands (and pays) instantly
      return () => { alive = false; auto = false; cancelAnimationFrame(raf); removeEventListener('resize', onResize); balls.splice(0).forEach(land); };
    },
  });
})();
