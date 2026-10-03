(() => {
  // pays X for 1 (stake included), by numbers picked → numbers caught
  const PAY = {
    1: { 1: 3 }, 2: { 2: 12 }, 3: { 2: 1, 3: 42 }, 4: { 2: 1, 3: 4, 4: 100 }, 5: { 3: 2, 4: 20, 5: 450 },
    6: { 3: 1, 4: 6, 5: 75, 6: 1500 }, 7: { 3: 1, 4: 2, 5: 20, 6: 350, 7: 5000 },
    8: { 4: 2, 5: 12, 6: 100, 7: 1500, 8: 20000 }, 9: { 4: 1, 5: 5, 6: 40, 7: 300, 8: 4000, 9: 25000 },
    10: { 5: 2, 6: 20, 7: 130, 8: 1000, 9: 5000, 10: 100000 },
  };

  Casino.games.push({
    id: 'keno', name: 'Keno', tag: 'Lottery · 100,000:1', icon: '🎱', accent: '#eab308',
    blurb: 'Pick up to 10 numbers. 20 balls are drawn. Catch them all for 100,000×.',
    rules: `<ul>
      <li>Pick 1 to 10 numbers from 1–80 (or hit Quick Pick).</li>
      <li>Place a bet on the ticket circle and press Draw. 20 numbers are drawn.</li>
      <li>The paytable shows what each catch pays for your number of picks, as "X for 1" (your bet included).</li>
      <li>Your picks stay for the next draw. Space draws.</li></ul>`,
    mount({ table, controls }) {
      table.innerHTML = `<div class="keno-board">
        <div class="kboard">${Array.from({ length: 80 }, (_, i) => `<button data-n="${i + 1}">${i + 1}</button>`).join('')}</div>
        <div class="kside">
          <div class="kstat">Picked <span class="np">0</span>/10 · Caught <span class="nc">0</span></div>
          <div class="circle"></div><div class="lbl">Ticket bet</div>
          <div class="kpay"></div>
        </div></div>`;
      const balls = $$('.kboard button', table), picks = new Set(store.get('keno_picks', []));
      const info = h('<div class="info-line">Bet <b>$0</b></div>');
      const bets = new Bets(() => $('b', info).textContent = fmt(bets.total));
      bets.bind('k', $('.circle', table));
      const drawBtn = button('Draw', 'red', draw);
      const btns = h('<div class="btns"></div>');
      btns.append(button('Quick pick', 'ghost', quick), button('Clear picks', 'ghost', () => { if (!busy) { picks.clear(); render(); } }), button('Clear bet', 'ghost', () => bets.clear()), drawBtn);
      controls.append(chipRack(), info, btns);
      let busy = false, caught = -1;

      function render() {
        balls.forEach(b => b.classList.toggle('pick', picks.has(+b.dataset.n)));
        $('.np', table).textContent = picks.size; store.set('keno_picks', [...picks]);
        const pt = PAY[picks.size];
        $('.kpay', table).innerHTML = `<h4>Pick ${picks.size || '–'} pays</h4>` + (pt
          ? Object.entries(pt).reverse().map(([c, x]) => `<div class="${+c === caught ? 'won' : ''}"><span>Catch ${c}</span><b>${x.toLocaleString()} for 1</b></div>`).join('')
          : '<div><span>Pick some numbers</span></div>');
      }
      balls.forEach(b => b.onclick = () => {
        if (busy) return;
        const n = +b.dataset.n; clearDraw();
        if (picks.has(n)) picks.delete(n); else if (picks.size < 10) picks.add(n); else { toast('Maximum 10 picks'); return; }
        sfx.tick(); render();
      });
      function quick() {
        if (busy) return; clearDraw(); picks.clear();
        while (picks.size < 10) picks.add(1 + rnd(80));
        sfx.chip(); render();
      }
      function clearDraw() { caught = -1; balls.forEach(b => b.classList.remove('drawn')); $('.nc', table).textContent = 0; }
      async function draw() {
        if (busy) return;
        if (!picks.size) { toast('Pick at least one number'); sfx.no(); return; }
        if (!bets.total) bets.rebet();
        if (!bets.total) { toast('Place a bet on the ticket'); sfx.no(); return; }
        busy = true; drawBtn.disabled = true; bets.save(); bets.locked = true; clearDraw(); render();
        const pool = shuffle(Array.from({ length: 80 }, (_, i) => i + 1)).slice(0, 20);
        let hits = 0;
        for (const n of pool) {
          balls[n - 1].classList.add('drawn');
          if (picks.has(n)) { hits++; $('.nc', table).textContent = hits; tone(660 + hits * 60, .12, 'triangle', .06); } else sfx.tick();
          await sleep(140);
        }
        caught = hits; render();
        const staked = bets.total, paid = staked * (PAY[picks.size][hits] || 0);
        bets.m = {}; bets.locked = false; busy = false; drawBtn.disabled = false; bets.render();
        settle(paid, staked, `Caught ${hits} of ${picks.size}`);
      }
      render();
      Casino.hotkey = draw;
      return () => bets.clear();
    },
  });
})();
