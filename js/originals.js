// "Originals": quick provably-simple games in the style of online casinos. Each carries a 1–2% house edge.
(() => {
  const dark = table => table.classList.add('dark-felt');
  const ctrlRow = (...els) => { const b = h('<div class="btns"></div>'); b.append(...els); return b; };
  const numBox = (label, html) => h(`<div class="numbox"><small>${label}</small>${html}</div>`);

  // ---------- Mines ----------
  Casino.games.push({
    id: 'mines', section: 'Originals', name: 'Mines', tag: 'Originals · Up to 24 mines', icon: '💣', accent: '#22c55e',
    blurb: 'Uncover gems on a 5×5 grid and cash out before you hit a mine.',
    rules: `<ul><li>Choose how many mines (1–24) hide in the 25 tiles, place your bet and start revealing tiles.</li>
      <li>Every gem raises your multiplier. More mines means bigger jumps.</li><li>Hit a mine and the bet is lost. Cash out any time after your first gem.</li>
      <li>Multiplier = 0.99 × the true odds of surviving that many picks.</li></ul>`,
    mount({ table, controls }) {
      dark(table);
      table.innerHTML = `<div class="mn-wrap"><div class="mn-grid">${'<button class="mn-t"></button>'.repeat(25)}</div>
        <div class="mn-side"><div class="mn-mult">1.00×</div><div class="mn-next"></div><div class="pills"></div></div></div>`;
      const tiles = $$('.mn-t', table), multEl = $('.mn-mult', table), nextEl = $('.mn-next', table), pill = pillRow($('.pills', table));
      const bet = betBox('mines_bet', 10);
      const sel = numBox('Mines', `<select>${Array.from({ length: 24 }, (_, i) => `<option${i + 1 === store.get('mines_n', 3) ? ' selected' : ''}>${i + 1}</option>`).join('')}</select>`);
      const goBtn = button('Bet', 'green', () => playing ? cashout() : start()), rndBtn = button('Random tile', 'ghost', () => { const free = tiles.map((_, i) => i).filter(i => !open.has(i)); if (playing && free.length) pickTile(free[rnd(free.length)]); });
      controls.append(bet.el, sel, ctrlRow(rndBtn, goBtn));
      let playing = false, bombs = new Set(), open = new Set(), stake = 0;
      const nMines = () => +$('select', sel).value;
      const mult = k => { let m = .99; for (let i = 0; i < k; i++) m *= (25 - i) / (25 - nMines() - i); return m; };
      const show = () => {
        multEl.textContent = mult(open.size).toFixed(2) + '×';
        nextEl.textContent = playing ? `Next gem: ${mult(open.size + 1).toFixed(2)}× · Cash out ${fmt(round2(stake * mult(open.size)))}` : `${nMines()} mines hidden`;
        goBtn.textContent = playing ? 'Cash out' : 'Bet'; goBtn.disabled = playing && !open.size; rndBtn.disabled = !playing;
      };
      $('select', sel).onchange = () => { store.set('mines_n', nMines()); show(); };
      function start() {
        stake = bet.get(); if (!Casino.take(stake)) return;
        playing = true; open = new Set(); bombs = new Set(shuffle([...Array(25).keys()]).slice(0, nMines()));
        tiles.forEach(t => { t.className = 'mn-t'; t.textContent = ''; t.disabled = false; });
        bet.lock(true); $('select', sel).disabled = true; sfx.chip(); show();
      }
      function reveal(all) {
        tiles.forEach((t, i) => { if (open.has(i)) return; t.textContent = bombs.has(i) ? '💣' : '💎'; t.classList.add('dim'); t.disabled = true; });
        if (all) tiles.forEach(t => t.disabled = true);
      }
      function end() { playing = false; bet.lock(false); $('select', sel).disabled = false; show(); }
      function pickTile(i) {
        if (!playing || open.has(i)) return;
        const t = tiles[i];
        if (bombs.has(i)) {
          t.textContent = '💥'; t.classList.add('boom'); sfx.lose(); tone(80, .4, 'sawtooth', .06);
          reveal(true); pill('0.00×', false); end(); return;
        }
        open.add(i); t.textContent = '💎'; t.classList.add('gem'); t.disabled = true; tone(600 + open.size * 70, .12, 'triangle', .06);
        show();
        if (open.size === 25 - nMines()) cashout();
      }
      function cashout() {
        if (!playing || !open.size) return;
        const m = mult(open.size); reveal(true); end();
        settle(round2(stake * m), stake, `${m.toFixed(2)}× · ${open.size} gems`); pill(m.toFixed(2) + '×', true);
      }
      tiles.forEach((t, i) => t.onclick = () => pickTile(i));
      show();
      Casino.hotkey = () => playing ? cashout() : start();
      return () => { if (playing && open.size) cashout(); };
    },
  });

  // ---------- Limbo ----------
  Casino.games.push({
    id: 'limbo', section: 'Originals', name: 'Limbo', tag: 'Originals · Up to 1,000,000×', icon: '🎯', accent: '#a855f7',
    blurb: 'Pick a target multiplier. If the roll lands at or above it, you win.',
    rules: `<ul><li>Set a target multiplier from 1.01× to 1,000,000× and bet.</li><li>A random multiplier is rolled. If it's at or above your target you win bet × target.</li>
      <li>Chance to win = 99% ÷ target, so a 2× target wins 49.5% of the time.</li></ul>`,
    mount({ table, controls }) {
      dark(table);
      table.innerHTML = `<div class="lb-wrap"><div class="lb-num">1.00×</div><div class="lb-info"></div><div class="pills"></div></div>`;
      const num = $('.lb-num', table), infoEl = $('.lb-info', table), pill = pillRow($('.pills', table));
      const bet = betBox('limbo_bet', 10);
      const tgt = numBox('Target', `<input class="numin" type="number" min="1.01" max="1000000" step=".01" value="${store.get('limbo_t', 2)}">`);
      const tIn = $('input', tgt), goBtn = button('Bet', 'green', go);
      const target = () => Math.max(1.01, Math.min(1e6, round2(+tIn.value || 2)));
      const upd = () => { tIn.value = target(); store.set('limbo_t', target()); infoEl.textContent = `Win chance ${(99 / target()).toFixed(target() > 1000 ? 4 : 2)}% · Pays ${fmt(round2(bet.get() * target()))}`; };
      tIn.onchange = upd; bet.el.addEventListener('change', upd); bet.el.addEventListener('click', upd);
      controls.append(bet.el, tgt, ctrlRow(goBtn)); upd();
      let busy = false;
      async function go() {
        if (busy) return; const stake = bet.get(), t = target();
        if (!Casino.take(stake)) return;
        busy = true; goBtn.disabled = true; num.className = 'lb-num';
        const res = Math.max(1, Math.floor(99 / (100 * (1 - Math.random())) * 100) / 100);
        const steps = 22;
        for (let i = 1; i <= steps; i++) { num.textContent = (1 + (res - 1) * (1 - (1 - i / steps) ** 3)).toFixed(2) + '×'; await sleep(18); }
        num.textContent = res.toFixed(2) + '×';
        const win = res >= t; num.classList.add(win ? 'win' : 'lose');
        pill(res.toFixed(2) + '×', win);
        settle(win ? round2(stake * t) : 0, stake, `Rolled ${res.toFixed(2)}×`);
        busy = false; goBtn.disabled = false;
      }
      Casino.hotkey = go;
    },
  });

  // ---------- Dice ----------
  Casino.games.push({
    id: 'dice', section: 'Originals', name: 'Dice', tag: 'Originals · Roll over/under', icon: '🎲', accent: '#38bdf8',
    blurb: 'Slide to set your odds, then roll 0–100. Over or under, you choose the risk.',
    rules: `<ul><li>Drag the slider to set a number and choose Roll Over or Roll Under.</li><li>A number from 0.00 to 99.99 is rolled.</li>
      <li>Payout = 99 ÷ win chance. 50% pays 1.98×, 10% pays 9.9×.</li></ul>`,
    mount({ table, controls }) {
      dark(table);
      table.innerHTML = `<div class="dc-wrap"><div class="dc-roll">50.00</div>
        <div class="dc-track"><div class="dc-fill"></div><div class="dc-mark"></div><input type="range" min="2" max="98" step="1" aria-label="Target"></div>
        <div class="dc-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
        <div class="dc-stats"><div class="numbox"><small>Multiplier</small><b class="dc-x"></b></div><div class="numbox"><small>Win chance</small><b class="dc-c"></b></div><button class="btn ghost small dc-mode"></button></div>
        <div class="pills"></div></div>`;
      const rng = $('input', table), fill = $('.dc-fill', table), mark = $('.dc-mark', table), rollEl = $('.dc-roll', table), modeBtn = $('.dc-mode', table), pill = pillRow($('.pills', table));
      let over = store.get('dice_over', true), busy = false;
      rng.value = store.get('dice_t', 50);
      const chance = () => over ? 100 - +rng.value : +rng.value, x = () => 99 / chance();
      const upd = () => {
        const v = +rng.value; store.set('dice_t', v); store.set('dice_over', over);
        fill.style.left = over ? v + '%' : '0'; fill.style.width = (over ? 100 - v : v) + '%';
        $('.dc-x', table).textContent = x().toFixed(4) + '×'; $('.dc-c', table).textContent = chance().toFixed(0) + '%';
        modeBtn.textContent = over ? `Roll over ${v}` : `Roll under ${v}`;
      };
      rng.oninput = upd; modeBtn.onclick = () => { over = !over; upd(); sfx.tick(); };
      const bet = betBox('dice_bet', 10), goBtn = button('Roll', 'green', go);
      controls.append(bet.el, ctrlRow(goBtn)); upd();
      async function go() {
        if (busy) return; const stake = bet.get(); if (!Casino.take(stake)) return;
        busy = true; goBtn.disabled = true; rng.disabled = true; sfx.roll();
        const r = rnd(10000) / 100;
        mark.style.opacity = 1; mark.style.left = r + '%'; rollEl.className = 'dc-roll';
        for (let i = 0; i < 10; i++) { rollEl.textContent = (rnd(10000) / 100).toFixed(2); await sleep(30); }
        rollEl.textContent = r.toFixed(2);
        const win = over ? r > +rng.value : r < +rng.value;
        rollEl.classList.add(win ? 'win' : 'lose'); pill(r.toFixed(2), win);
        settle(win ? round2(stake * x()) : 0, stake, `Rolled ${r.toFixed(2)}`);
        busy = false; goBtn.disabled = false; rng.disabled = false;
      }
      Casino.hotkey = go;
    },
  });

  // ---------- Hi-Lo ----------
  Casino.games.push({
    id: 'hilo', section: 'Originals', name: 'Hi-Lo', tag: 'Originals · Card streaks', icon: '🔼', accent: '#f59e0b',
    blurb: 'Higher or lower? Chain correct guesses to grow your multiplier.',
    rules: `<ul><li>Bet to draw a card (aces low, kings high). Guess whether the next card is higher-or-same or lower-or-same.</li>
      <li>Each correct guess multiplies your winnings by 0.99 ÷ its chance. Long shots pay more.</li><li>Skip a card for free, or cash out after any correct guess. A wrong guess loses the bet.</li></ul>`,
    mount({ table, controls }) {
      table.innerHTML = `<div class="hl-wrap"><div class="hl-card"></div><div class="hl-mult">1.00×</div><div class="hl-trail cards"></div></div>`;
      const cardBox = $('.hl-card', table), multEl = $('.hl-mult', table), trail = $('.hl-trail', table);
      const bet = betBox('hilo_bet', 10);
      const hiBtn = button('Higher', 'green', () => guess(true)), loBtn = button('Lower', 'red', () => guess(false));
      const skipBtn = button('Skip', 'ghost', () => { if (playing) { cur = draw(); showCard(); } }), goBtn = button('Bet', '', () => playing ? cashout() : start());
      controls.append(bet.el, ctrlRow(hiBtn, loBtn, skipBtn, goBtn));
      let playing = false, cur = null, m = 1, stake = 0, steps = 0;
      const draw = () => ({ r: RANKS[rnd(13)], s: SUITS[rnd(4)] }), rv = c => RANKS.indexOf(c.r) + 1;
      const pHi = () => (14 - rv(cur)) / 13, pLo = () => rv(cur) / 13;
      function showCard() {
        cardBox.innerHTML = ''; cardBox.append(cardEl(cur)); sfx.card();
        hiBtn.textContent = `Higher or same · ${(.99 / pHi()).toFixed(2)}×`; loBtn.textContent = `Lower or same · ${(.99 / pLo()).toFixed(2)}×`;
      }
      const ui = () => { [hiBtn, loBtn, skipBtn].forEach(b => b.disabled = !playing); goBtn.textContent = playing ? `Cash out ${fmt(round2(stake * m))}` : 'Bet'; goBtn.disabled = playing && !steps; multEl.textContent = m.toFixed(2) + '×'; bet.lock(playing); };
      function start() {
        stake = bet.get(); if (!Casino.take(stake)) return;
        playing = true; m = 1; steps = 0; trail.innerHTML = ''; cur = draw(); showCard(); ui();
      }
      function guess(hi) {
        if (!playing) return;
        const p = hi ? pHi() : pLo(), nxt = draw(), ok = hi ? rv(nxt) >= rv(cur) : rv(nxt) <= rv(cur);
        trail.append(cardEl(cur)); while (trail.children.length > 8) trail.firstChild.remove();
        cur = nxt; showCard();
        if (!ok) { playing = false; multEl.classList.add('lose'); setTimeout(() => multEl.classList.remove('lose'), 600); ui(); settle(0, stake); return; }
        m *= .99 / p; steps++; tone(500 + steps * 60, .12, 'triangle', .06); ui();
      }
      function cashout() { if (!playing || !steps) return; playing = false; ui(); settle(round2(stake * m), stake, `${m.toFixed(2)}× · ${steps} in a row`); }
      ui(); cur = draw(); showCard();
      Casino.hotkey = () => playing ? cashout() : start();
      return () => { if (playing && steps) cashout(); };
    },
  });

  // ---------- Tower ----------
  const LEVELS = { easy: [4, 1], medium: [3, 1], hard: [2, 1], expert: [3, 2], master: [4, 3] };
  Casino.games.push({
    id: 'tower', section: 'Originals', name: 'Tower', tag: 'Originals · Climb 8 floors', icon: '🗼', accent: '#ef4444',
    blurb: 'Climb the tower one floor at a time. Pick the safe tile, avoid the skulls.',
    rules: `<ul><li>Each of the 8 floors hides skulls among its tiles. Pick a safe tile to climb.</li>
      <li>Easy: 4 tiles, 1 skull · Medium: 3 tiles, 1 skull · Hard: 2 tiles, 1 skull · Expert: 3 tiles, 2 skulls · Master: 4 tiles, 3 skulls.</li>
      <li>Your multiplier is 0.98 ÷ the chance of reaching that floor. Cash out any time, or hit a skull and lose the bet.</li></ul>`,
    mount({ table, controls }) {
      dark(table);
      let lvl = store.get('tower_lvl', 'medium'), playing = false, floor = 0, stake = 0, skulls = [];
      table.innerHTML = `<div class="tw-wrap"><div class="tw"></div></div>`;
      const tw = $('.tw', table);
      const bet = betBox('tower_bet', 10);
      const sel = numBox('Difficulty', `<select>${Object.keys(LEVELS).map(k => `<option${k === lvl ? ' selected' : ''}>${k}</option>`).join('')}</select>`);
      const goBtn = button('Bet', 'green', () => playing ? cashout() : start());
      controls.append(bet.el, sel, ctrlRow(goBtn));
      const [n, b] = [() => LEVELS[lvl][0], () => LEVELS[lvl][1]];
      const mult = f => f ? .98 / ((n() - b()) / n()) ** f : 1;
      function build() {
        tw.innerHTML = '';
        for (let f = 7; f >= 0; f--) {
          const row = h(`<div class="tw-row" data-f="${f}"><span class="tw-x">${mult(f + 1).toFixed(2)}×</span>${'<button class="tw-t"></button>'.repeat(n())}</div>`);
          $$('.tw-t', row).forEach((t, i) => t.onclick = () => pick(f, i));
          tw.append(row);
        }
        mark();
      }
      const row = f => $(`.tw-row[data-f="${f}"]`, tw);
      function mark() {
        $$('.tw-row', tw).forEach(r => { const f = +r.dataset.f; r.classList.toggle('cur', playing && f === floor); $$('.tw-t', r).forEach(t => t.disabled = !(playing && f === floor)); });
        goBtn.textContent = playing ? `Cash out ${fmt(round2(stake * mult(floor)))}` : 'Bet'; goBtn.disabled = playing && !floor;
      }
      $('select', sel).onchange = () => { if (playing) return; lvl = $('select', sel).value; store.set('tower_lvl', lvl); build(); };
      function start() {
        stake = bet.get(); if (!Casino.take(stake)) return;
        playing = true; floor = 0; skulls = Array.from({ length: 8 }, () => new Set(shuffle([...Array(n()).keys()]).slice(0, b())));
        bet.lock(true); $('select', sel).disabled = true; build(); sfx.chip();
      }
      function revealRow(f, picked) { $$('.tw-t', row(f)).forEach((t, i) => { t.textContent = skulls[f].has(i) ? '💀' : '💎'; t.classList.add(i === picked ? (skulls[f].has(i) ? 'boom' : 'gem') : 'dim'); }); }
      function finish() { playing = false; bet.lock(false); $('select', sel).disabled = false; for (let f = floor; f < 8; f++) revealRow(f, -1); mark(); }
      function pick(f, i) {
        if (!playing || f !== floor) return;
        revealRow(f, i);
        if (skulls[f].has(i)) { sfx.lose(); finish(); settle(0, stake); return; }
        floor++; tone(500 + floor * 80, .12, 'triangle', .06);
        if (floor === 8) return cashout();
        mark();
      }
      function cashout() { if (!playing || !floor) return; const m = mult(floor); finish(); settle(round2(stake * m), stake, `${m.toFixed(2)}× · floor ${floor}`); }
      build();
      Casino.hotkey = () => playing ? cashout() : start();
      return () => { if (playing && floor) cashout(); };
    },
  });
})();
