(() => {
  // weights and line pays (x line bet for 3/4/5 in a row), tuned by simulation to ~94% + progressive
  const SYMS = [
    { s: '🍒', w: 22, pay: [0, 0, 0, 7, 22, 90] },
    { s: '🍋', w: 20, pay: [0, 0, 0, 7, 30, 110] },
    { s: '🍊', w: 18, pay: [0, 0, 0, 11, 37, 150] },
    { s: '🍇', w: 14, pay: [0, 0, 0, 18, 55, 220] },
    { s: '🍉', w: 10, pay: [0, 0, 0, 30, 90, 370] },
    { s: '🔔', w: 8, pay: [0, 0, 0, 45, 150, 550] },
    { s: '💎', w: 5, pay: [0, 0, 0, 75, 300, 1500] },
    { s: '7', w: 3, pay: [0, 0, 0, 150, 750, 5000], cls: 'seven' },
    { s: '⭐', w: 3, pay: [0, 0, 0, 200, 1000, 5000] },
  ];
  const WILD = 8, SEVEN = 7, TOTALW = SYMS.reduce((a, s) => a + s.w, 0);
  const LINES = [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 0, 1, 2, 1]];
  const LINE_BETS = [1, 2, 5, 10, 25, 50, 100];
  const pick = () => { let r = Math.random() * TOTALW; for (let i = 0; i < SYMS.length; i++) if ((r -= SYMS[i].w) < 0) return i; return 0; };
  const cellHTML = i => `<div class="cell ${SYMS[i].cls || ''}">${SYMS[i].s}</div>`;
  function evalLine(syms) {
    let best = { win: 0 }, w = 0;
    while (w < 5 && syms[w] === WILD) w++;
    if (w >= 3) best = { win: SYMS[WILD].pay[w], n: w, sym: WILD };
    for (let s = 0; s < WILD; s++) {
      let n = 0; while (n < 5 && (syms[n] === s || syms[n] === WILD)) n++;
      if (n >= 3 && SYMS[s].pay[n] > best.win) best = { win: SYMS[s].pay[n], n, sym: s };
    }
    return best;
  }

  Casino.games.push({
    id: 'slots', name: 'Lucky 7s Slots', tag: 'Slots · Jackpot', icon: '🎰', accent: '#ec4899',
    blurb: '5 reels, 10 paylines, wild stars and a progressive jackpot.',
    rules: `<ul>
      <li>5 reels, 3 rows, 10 fixed paylines. Total bet = line bet × 10.</li>
      <li>Wins pay left to right on a line for 3, 4 or 5 matching symbols.</li>
      <li>⭐ is wild and stands in for any symbol. A line of wilds pays on its own.</li>
      <li>Five <b>7</b>s on a line at the max line bet ($100) wins the <b>progressive jackpot</b>. At lower bets it pays 5000× the line bet.</li>
      <li>2% of every spin feeds the jackpot. Space spins.</li></ul>`,
    mount({ table }) {
      table.innerHTML = `<div class="slot"><div class="cabinet">
        <div class="slot-top"><div class="slot-title">Lucky 7s Deluxe</div><div class="jackpot mini"><span>Progressive</span><b class="sjp"></b></div></div>
        <div class="reels">${'<div class="reel"><div class="strip"></div></div>'.repeat(5)}</div>
        <div class="winline">10 lines · Good luck!</div>
        <div class="slot-ctrl">
          <button class="btn ghost small minus">−</button>
          <div class="meter"><small>LINE BET</small><b class="lb"></b></div>
          <button class="btn ghost small plus">+</button>
          <div class="meter"><small>TOTAL BET</small><b class="tb"></b></div>
          <div class="meter"><small>WIN</small><b class="lw">$0</b></div>
          <button class="btn ghost auto">Auto</button>
          <button class="btn max">Max bet</button>
          <button class="btn red spinbtn">Spin</button>
        </div></div>
        <div class="paytable-s">${SYMS.map((s, i) => `<div><span class="ic ${s.cls ? 'cell seven' : ''}" style="${s.cls ? 'height:auto;font-size:30px' : ''}">${s.s}</span><span>${i === WILD ? 'WILD · ' : ''}3× ${s.pay[3]} · 4× ${s.pay[4]}<br>5× ${i === SEVEN ? 'JACKPOT' : s.pay[5]}</span></div>`).join('')}</div>
      </div>`;
      const reels = $$('.reel', table), strips = reels.map(r => $('.strip', r));
      const winline = $('.winline', table), sjp = $('.sjp', table), autoBtn = $('.auto', table), spinBtn = $('.spinbtn', table);
      let grid = Array.from({ length: 5 }, () => [pick(), pick(), pick()]);
      let li = Math.max(0, LINE_BETS.indexOf(store.get('slot_lb', 1))), spinning = false, auto = false, alive = true;
      strips.forEach((s, r) => s.innerHTML = grid[r].map(cellHTML).join(''));
      const showBet = () => { $('.lb', table).textContent = fmt(LINE_BETS[li]); $('.tb', table).textContent = fmt(LINE_BETS[li] * 10); store.set('slot_lb', LINE_BETS[li]); };
      const showJp = () => sjp.textContent = fmt2(Jackpot.v);
      showBet(); showJp();
      const jpTimer = setInterval(() => { Jackpot.add(Math.random() * .5); showJp(); }, 150);
      $('.minus', table).onclick = () => { if (!spinning && li > 0) { li--; showBet(); sfx.chip(); } };
      $('.plus', table).onclick = () => { if (!spinning && li < LINE_BETS.length - 1) { li++; showBet(); sfx.chip(); } };
      $('.max', table).onclick = () => { if (spinning) return; li = LINE_BETS.length - 1; showBet(); spin(); };
      spinBtn.onclick = () => spin();
      autoBtn.onclick = async () => {
        auto = !auto; autoBtn.classList.toggle('on', auto);
        while (auto && alive) { const won = await spin(); if (won === null) break; await sleep(won ? 1400 : 350); }
        auto = false; autoBtn.classList.remove('on');
      };

      async function spin() {
        if (spinning) return 0;
        const lineBet = LINE_BETS[li], total = lineBet * 10;
        if (!Casino.take(total)) { auto = false; return null; }
        spinning = true; spinBtn.disabled = true; Jackpot.add(total * .02); showJp();
        $$('.cell.hit', table).forEach(c => c.classList.remove('hit'));
        winline.textContent = 'Good luck!'; $('.lw', table).textContent = '$0';
        const next = Array.from({ length: 5 }, () => [pick(), pick(), pick()]);
        const cell = reels[0].clientHeight / 3;
        await Promise.all(strips.map(async (strip, r) => {
          // strip = new symbols on top, filler, then what's showing now; slide it down to land
          const seq = [...next[r], ...Array.from({ length: 16 + r * 5 }, pick), ...grid[r]];
          strip.style.transition = 'none'; strip.innerHTML = seq.map(cellHTML).join('');
          strip.style.transform = `translateY(${-(seq.length - 3) * cell}px)`; void strip.offsetWidth;
          const ms = 900 + r * 300;
          reels[r].classList.add('spinning');
          strip.style.transition = `transform ${ms}ms cubic-bezier(.25,.1,.2,1)`; strip.style.transform = 'translateY(0)';
          await sleep(ms - 120); reels[r].classList.remove('spinning'); await sleep(120);
          sfx.card(); strip.style.transition = 'none'; strip.innerHTML = next[r].map(cellHTML).join('');
        }));
        grid = next;
        let paid = 0, jackpot = false; const notes = [];
        LINES.forEach((L, i) => {
          const res = evalLine(L.map((row, c) => grid[c][row]));
          if (!res.win) return;
          let win = res.win * lineBet;
          if (res.sym === SEVEN && res.n === 5 && lineBet === LINE_BETS.at(-1)) { win = Jackpot.v; jackpot = true; Jackpot.reset(); }
          paid += win; notes.push(`Line ${i + 1}: ${res.n}× ${SYMS[res.sym].s} ${fmt(win)}`);
          for (let c = 0; c < res.n; c++) strips[c].children[L[c]].classList.add('hit');
        });
        spinning = false; spinBtn.disabled = false; showJp();
        $('.lw', table).textContent = fmt(round2(paid));
        winline.textContent = jackpot ? '★ PROGRESSIVE JACKPOT ★' : notes.length ? notes.slice(0, 3).join(' · ') + (notes.length > 3 ? ` +${notes.length - 3} more` : '') : 'No win. Spin again!';
        settle(paid, total, jackpot ? 'Progressive jackpot' : '');
        if (jackpot) coinShower(120);
        return paid;
      }
      Casino.hotkey = () => spin();
      return () => { alive = false; auto = false; clearInterval(jpTimer); };
    },
  });
})();
