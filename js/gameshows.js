// Game shows: Carnival Time (money wheel with four bonus rounds), Briefcase Banker (deal or no deal), Derby Dash (horse racing).
(() => {
  const ctrl = (...els) => { const b = h('<div class="btns"></div>'); b.append(...els); return b; };
  const overlay = (html, vars = '--bg:#1a0b2e;--frame:#facc15;--acc:#f472b6;--mf:Limelight') => { const o = h(`<div class="sovl" style="${vars}"><div class="sbox">${html}</div></div>`); document.body.append(o); return o; };
  const spread = (types, n) => { // place each type evenly round the wheel, rarest first
    const out = Array(n).fill(null);
    for (const t of [...types].sort((a, b) => a.n - b.n)) for (let j = 0; j < t.n; j++) { let p = Math.round((j + .5) * n / t.n + (t.off || 0)) % n; while (out[p]) p = (p + 1) % n; out[p] = t; }
    return out;
  };

  // ---------- Carnival Time ----------
  // Number spots pay their number to 1. Each spin the top slot boosts one spot. Spot RTPs are ~94–96% (see notes in commit).
  const SPOTS = [
    { k: '1', label: '1', n: 21, color: '#2563eb', pay: 1, top: [2, 3, 4, 5, 7, 6] },
    { k: '2', label: '2', n: 13, color: '#eab308', pay: 2, top: [2, 3, 5, 7, 7] },
    { k: '5', label: '5', n: 7, color: '#db2777', pay: 5, top: [2, 3, 3, 3, 4] },
    { k: '10', label: '10', n: 4, color: '#7c3aed', pay: 10, top: [2, 2, 3, 3] },
    { k: 'flip', label: 'COIN FLIP', short: 'FLIP', n: 4, color: '#0891b2', off: 1, bonus: [2, 3, 3, 4, 5, 6, 8, 10, 10, 15, 20] },
    { k: 'hunt', label: 'CASH HUNT', short: 'HUNT', n: 2, color: '#16a34a', off: 5, bonus: [2, 3, 3, 4, 5, 5, 6, 7, 8, 10, 10, 10, 12, 15, 15, 20, 20, 25, 25, 30, 25, 40, 30, 50] },
    { k: 'pach', label: 'PACHINKO', short: 'PACH', n: 2, color: '#c026d3', off: 19, bonus: [5, 10, 7, 25, 10, 35, 7, 15, 10, 50, 5, 20, 7, 15, 10, 25] },
    { k: 'crazy', label: 'CARNIVAL', short: 'CRAZY', n: 1, color: '#dc2626', off: 40, bonus: [10, 15, 20, 20, 40, 10, 15, 20, 20, 75, 10, 15, 20, 20, 40, 100, 10, 15, 20, 20, 40, 10, 15, 20, 20, 75, 10, 15, 20, 20, 40, 250] },
  ];
  const BONUS_TOP = [2, 3, 5, 7, 10];
  const SEGS = spread(SPOTS, 54);
  const wheelCv = size => { const cv = h(`<canvas width="${size}" height="${size}"></canvas>`); drawWheel(cv, SEGS.map(s => ({ label: s.short || s.label, color: s.color })), { text: 17, rim: .8, hub: .24, radial: true }); return cv; };
  Casino.games.push({
    id: 'carnival', section: 'Game Shows', name: 'Carnival Time', tag: 'Game show · 4 bonus rounds', accent: '#f43f5e', art: () => wheelCv(264),
    blurb: 'The big money wheel with a top-slot booster and four bonus games: Coin Flip, Cash Hunt, Pachinko and the Carnival wheel.',
    rules: `<ul><li>Bet on where the 54-segment wheel stops. Numbers pay their value to 1 (1 pays 1:1, 10 pays 10:1).</li>
      <li>Before each spin the <b>top slot</b> picks one bet spot and a multiplier. If the wheel lands there, that win is multiplied.</li>
      <li>Land a bonus you bet on and you play it: <b>Coin Flip</b> (red or blue multiplier), <b>Cash Hunt</b> (pick a hidden multiplier), <b>Pachinko</b> (drop a puck), <b>Carnival</b> (spin the giant wheel, up to 250×).</li>
      <li>Every spot returns about 94–96% over the long run.</li></ul>`,
    mount({ table, controls }) {
      table.innerHTML = `<div class="ct"><div class="ct-top"><span>TOP SLOT</span><b class="ct-ts">—</b></div>
        <div class="wheelwrap ct-wheel"><div class="flapper"></div></div><div class="duel-msg ct-msg"></div>
        <div class="ct-bets">${SPOTS.map(s => `<div style="--c:${s.color}" data-k="${s.k}">${s.label}<small>${s.pay ? s.pay + ':1' : 'BONUS'}</small></div>`).join('')}</div></div>`;
      const cv = wheelCv(640); $('.ct-wheel', table).append(cv);
      const spin = spinner(cv, 54), ts = $('.ct-ts', table), msg = $('.ct-msg', table);
      const info = h('<div class="info-line">Total bet <b>$0</b></div>');
      const bets = new Bets(() => $('b', info).textContent = fmt(bets.total));
      $$('.ct-bets [data-k]', table).forEach(el => bets.bind(el.dataset.k, el));
      const spinBtn = button('Spin', 'red', go);
      controls.append(chipRack(), info, ctrl(...betButtons(bets), spinBtn));
      let busy = false;
      async function go() {
        if (busy) return;
        if (!bets.total) bets.rebet();
        if (!bets.total) { toast('Place a bet'); sfx.no(); return; }
        busy = true; spinBtn.disabled = true; bets.save(); bets.locked = true; msg.textContent = '';
        $$('.ct-bets .hit', table).forEach(e => e.classList.remove('hit'));
        const topSpot = SPOTS[rnd(SPOTS.length)], tl = topSpot.top || BONUS_TOP, topM = tl[rnd(tl.length)];
        for (let i = 0; i < 12; i++) { const s = SPOTS[rnd(8)]; ts.textContent = `${s.label} ×${(s.top || BONUS_TOP)[rnd(5) % (s.top || BONUS_TOP).length]}`; sfx.tick(); await sleep(70); }
        ts.textContent = `${topSpot.label} ×${topM}`; ts.classList.add('lit'); tone(1200, .2, 'triangle', .06);
        const i = rnd(54), seg = SEGS[i];
        await spin(i, 5200, 5);
        ts.classList.remove('lit');
        $(`.ct-bets [data-k="${seg.k}"]`, table).classList.add('hit');
        const stake = bets.m[seg.k] || 0, boost = topSpot === seg ? topM : 1;
        let paid = 0, label = seg.label;
        if (seg.pay) paid = stake * (seg.pay * boost + 1);
        else if (stake) { const x = await BONUS[seg.k](seg) * boost; paid = stake * (x + 1); label = `${seg.label} · ${x}×`; }
        else msg.textContent = `${seg.label}! You didn't bet on this bonus.`;
        if (boost > 1 && stake) label += ` (top slot ×${boost})`;
        const staked = bets.total; bets.m = {}; bets.locked = false; busy = false; spinBtn.disabled = false; bets.render();
        if (paid) msg.textContent = label;
        settle(paid, staked, label);
      }
      Casino.hotkey = go;
      return () => bets.clear();
    },
  });
  const BONUS = {
    flip: seg => new Promise(res => {
      const a = seg.bonus[rnd(seg.bonus.length)], b = seg.bonus[rnd(seg.bonus.length)], red = Math.random() < .5;
      const o = overlay(`<h2>Coin Flip</h2><div class="cf"><div class="cf-side red">${a}×</div><div class="cf-coin">🪙</div><div class="cf-side blue">${b}×</div></div><p class="pk">Flipping…</p>`);
      tone(500, .3, 'triangle', .05);
      setTimeout(() => { $('.cf-coin', o).classList.add('flip'); }, 400);
      setTimeout(() => { $('.cf-coin', o).textContent = red ? '🔴' : '🔵'; $(red ? '.cf-side.red' : '.cf-side.blue', o).classList.add('won'); $('.pk', o).textContent = `${red ? 'RED' : 'BLUE'} wins: ${red ? a : b}×`; sfx.win(); }, 2400);
      setTimeout(() => { o.remove(); res(red ? a : b); }, 4200);
    }),
    hunt: seg => new Promise(res => {
      const vals = shuffle([...seg.bonus]);
      const o = overlay(`<h2>Cash Hunt</h2><p class="pk">Pick a target!</p><div class="chests ch">${vals.map(() => '<button class="chest">🎯</button>').join('')}</div>`);
      const bs = $$('.chest', o);
      bs.forEach((b, i) => b.onclick = () => {
        bs.forEach((x, j) => { x.textContent = vals[j] + '×'; x.classList.add('open'); if (j !== i) x.classList.add('rest'); x.onclick = null; });
        bs[i].classList.add('pickd'); $('.pk', o).textContent = `You found ${vals[i]}×!`; sfx.win();
        setTimeout(() => { o.remove(); res(vals[i]); }, 2200);
      });
    }),
    pach: seg => new Promise(async res => {
      const o = overlay(`<h2>Pachinko</h2><div class="pc-row">${seg.bonus.map(v => `<div>${v}×</div>`).join('')}</div><p class="pk">Dropping the puck…</p>`);
      const cells = $$('.pc-row div', o), end = rnd(cells.length);
      let pos = 7 + rnd(2);
      for (let step = 0; step < 18; step++) { cells.forEach(c => c.classList.remove('on')); pos = Math.max(0, Math.min(cells.length - 1, pos + (Math.random() < .5 ? -1 : 1))); cells[pos].classList.add('on'); tone(900 + rnd(300), .03, 'square', .02); await sleep(90 + step * 8); }
      while (pos !== end) { cells.forEach(c => c.classList.remove('on')); pos += pos < end ? 1 : -1; cells[pos].classList.add('on'); tone(900, .03, 'square', .02); await sleep(160); }
      cells[end].classList.add('won'); $('.pk', o).textContent = `${seg.bonus[end]}×!`; sfx.win();
      setTimeout(() => { o.remove(); res(seg.bonus[end]); }, 1800);
    }),
    crazy: seg => new Promise(async res => {
      const o = overlay(`<h2>Carnival Wheel</h2><div class="wheelwrap big"><div class="flapper"></div></div><p class="pk">Spinning the giant wheel…</p>`);
      const pal = ['#dc2626', '#f59e0b', '#16a34a', '#2563eb', '#7c3aed', '#db2777'];
      const cv = h('<canvas width="640" height="640"></canvas>'); $('.wheelwrap', o).append(cv);
      drawWheel(cv, seg.bonus.map((v, i) => ({ label: v + '×', color: v >= 100 ? '#facc15' : pal[i % 6], fg: v >= 100 ? '#111' : '#fff' })), { text: 26, rim: .78, hub: .2, radial: true });
      const idx = rnd(seg.bonus.length);
      await spinner(cv, seg.bonus.length)(idx, 6000, 6);
      $('.pk', o).textContent = `${seg.bonus[idx]}×!`; sfx.big(); coinShower(30);
      setTimeout(() => { o.remove(); res(seg.bonus[idx]); }, 2000);
    }),
  };

  // ---------- Briefcase Banker ----------
  const CASES = [.01, .02, .03, .05, .08, .1, .15, .2, .25, .3, .4, .5, .75, 1, 1.5, 10]; // × the ticket price, average 0.96
  const ROUNDS = [5, 4, 3, 2, 1], OFFER = [.62, .72, .82, .9, .95];
  Casino.games.push({
    id: 'briefcase', section: 'Game Shows', name: 'Briefcase Banker', tag: 'Game show · Deal or no deal', icon: '💼', accent: '#facc15',
    blurb: 'Pick a case, open the rest, and decide whether to take the Banker\'s offer.',
    rules: `<ul><li>Your bet buys a game. 16 cases hide prizes from 0.01× to <b>10×</b> your bet.</li>
      <li>Pick your case, then open cases in rounds of 5, 4, 3, 2 and 1. After each round the <b>Banker</b> makes an offer for your case.</li>
      <li>Take the <b>Deal</b> and the offer is yours. Say <b>No Deal</b> to keep going. At the end you can swap your case for the last one left.</li></ul>`,
    mount({ table, controls }) {
      table.innerHTML = `<div class="bc"><div class="bc-board l"></div><div class="bc-mid"><div class="duel-msg bc-msg"></div><div class="bc-cases"></div><div class="bc-mine"></div></div><div class="bc-board r"></div></div>`;
      const msg = $('.bc-msg', table), casesEl = $('.bc-cases', table), mine = $('.bc-mine', table);
      const bet = betBox('bc_bet', 10), startBtn = button('Buy game', 'green', start);
      controls.append(bet.el, ctrl(startBtn));
      let phase = 'idle', vals, my = -1, opened, round = 0, toOpen = 0, stake = 0;
      const money = v => fmt(round2(v * (stake || bet.get())));
      function boards() {
        const sorted = [...CASES], gone = new Set(opened ? [...opened].map(i => vals[i]) : []);
        $('.bc-board.l', table).innerHTML = sorted.slice(0, 8).map(v => `<div class="${gone.has(v) ? 'gone' : ''}">${money(v)}</div>`).join('');
        $('.bc-board.r', table).innerHTML = sorted.slice(8).map(v => `<div class="${gone.has(v) ? 'gone' : ''} hi">${money(v)}</div>`).join('');
      }
      function drawCases() {
        casesEl.innerHTML = '';
        vals.forEach((v, i) => {
          const b = h(`<button class="bc-case ${opened.has(i) ? 'open' : ''} ${i === my ? 'mine' : ''}">${opened.has(i) ? money(v) : i + 1}</button>`);
          b.disabled = opened.has(i) || i === my || !(phase === 'pick' || phase === 'open');
          b.onclick = () => clickCase(i); casesEl.append(b);
        });
        mine.innerHTML = my >= 0 ? `Your case: <b>#${my + 1}</b>` : '';
      }
      function start() {
        if (phase !== 'idle') return; stake = bet.get(); if (!Casino.take(stake)) return;
        vals = shuffle([...CASES]); opened = new Set(); my = -1; round = 0; phase = 'pick'; bet.lock(true); startBtn.disabled = true;
        msg.textContent = 'Pick your case'; boards(); drawCases(); sfx.chip();
      }
      function clickCase(i) {
        if (phase === 'pick') { my = i; phase = 'open'; toOpen = ROUNDS[0]; msg.textContent = `Open ${toOpen} cases`; drawCases(); sfx.tick(); return; }
        if (phase !== 'open') return;
        opened.add(i); toOpen--; tone(vals[i] >= 1 ? 200 : 900, .2, 'triangle', .06);
        boards(); drawCases();
        if (toOpen > 0) { msg.textContent = `Open ${toOpen} more`; return; }
        offer();
      }
      function remaining() { return vals.filter((_, i) => !opened.has(i)); }
      function offer() {
        phase = 'offer'; drawCases();
        const rem = remaining(), ev = rem.reduce((a, b) => a + b, 0) / rem.length, off = round2(ev * OFFER[round] * stake);
        tone(330, .6, 'sine', .06);
        const last = round === ROUNDS.length - 1;
        const o = overlay(`<h2>📞 The Banker</h2><p>The Banker offers</p><div class="bc-offer">${fmt(off)}</div><div class="btns" style="justify-content:center"><button class="btn green">Deal</button><button class="btn red">No Deal</button></div>`);
        const [d, nd] = $$('.btn', o);
        d.onclick = () => { o.remove(); finish(off, `Deal! Your case had ${money(vals[my])}`); };
        nd.onclick = () => {
          o.remove(); round++;
          if (!last) { phase = 'open'; toOpen = ROUNDS[round]; msg.textContent = `No deal! Open ${toOpen} cases`; drawCases(); return; }
          const other = vals.findIndex((_, i) => !opened.has(i) && i !== my);
          const o2 = overlay(`<h2>Final decision</h2><p>Keep case #${my + 1} or swap for case #${other + 1}?</p><div class="btns" style="justify-content:center"><button class="btn green">Keep</button><button class="btn ghost">Swap</button></div>`);
          const [k, s] = $$('.btn', o2);
          k.onclick = () => { o2.remove(); finish(round2(vals[my] * stake), `Case #${my + 1}: ${money(vals[my])}`); };
          s.onclick = () => { o2.remove(); const was = my; my = other; finish(round2(vals[other] * stake), `Swapped! Case #${other + 1}: ${money(vals[other])} (yours had ${money(vals[was])})`); };
        };
      }
      function finish(paid, text) {
        phase = 'idle'; opened = new Set(vals.keys()); boards(); drawCases(); msg.textContent = text;
        bet.lock(false); startBtn.disabled = false;
        settle(paid, stake, text);
      }
      vals = [...CASES]; opened = new Set(); boards(); drawCases(); msg.textContent = 'Buy a game to start';
      Casino.hotkey = start;
    },
  });

  // ---------- Derby Dash ----------
  const HORSES = [['Thunder Bolt', '#ef4444'], ['Lucky Star', '#f59e0b'], ['Midnight Run', '#6366f1'], ['Golden Gale', '#eab308'], ['Neon Dream', '#ec4899'], ['Desert Wind', '#14b8a6']];
  Casino.games.push({
    id: 'derby', section: 'Arcade & Lottery', name: 'Derby Dash', tag: 'Racing · Fixed odds', icon: '🏇', accent: '#84cc16',
    blurb: 'Six horses, fresh odds every race. Back a winner and watch them run.',
    rules: `<ul><li>Every race has six runners with new form and odds. The favourite wins most often but pays least.</li>
      <li>Bet on any horse to <b>win</b>. If it crosses the line first you're paid at its odds (decimal, stake included).</li>
      <li>Odds include an 8% bookmaker margin.</li></ul>`,
    mount({ table, controls }) {
      table.innerHTML = `<div class="dd-track"></div><div class="duel-msg dd-msg"></div><div class="dd-bets"></div>`;
      const track = $('.dd-track', table), msg = $('.dd-msg', table), betsEl = $('.dd-bets', table);
      const info = h('<div class="info-line">Total bet <b>$0</b></div>');
      const bets = new Bets(() => $('b', info).textContent = fmt(bets.total));
      const raceBtn = button('Race!', 'red', race);
      controls.append(chipRack(), info, ctrl(...betButtons(bets), raceBtn));
      let p = [], odds = [], busy = false;
      function card() {
        const s = HORSES.map(() => .4 + Math.random() ** 2 * 2.2), t = s.reduce((a, b) => a + b, 0);
        p = s.map(x => x / t); odds = p.map(x => Math.max(1.1, Math.floor(.92 / x * 10) / 10));
        track.innerHTML = HORSES.map(([n, c], i) => `<div class="dd-lane"><span class="dd-no" style="background:${c}">${i + 1}</span><div class="dd-run"><span class="dd-h">🏇</span></div><span class="dd-fin"></span></div>`).join('');
        betsEl.innerHTML = HORSES.map(([n, c], i) => `<div class="dd-b" data-k="h${i}" style="--c:${c}"><b>${i + 1}. ${n}</b><small>${odds[i].toFixed(1)}</small></div>`).join('');
        bets.spots = {}; $$('.dd-b', betsEl).forEach(el => bets.bind(el.dataset.k, el));
        msg.textContent = 'Place your bets';
      }
      async function race() {
        if (busy) return;
        if (!bets.total) { toast('Back a horse first'); sfx.no(); return; }
        busy = true; raceBtn.disabled = true; bets.locked = true; msg.textContent = 'And they\'re off!'; sfx.big();
        // finishing order: winner drawn by win probability, then the rest the same way
        const left = [...p.keys()], order = [];
        while (left.length) { let r = Math.random() * left.reduce((a, i) => a + p[i], 0); const k = left.findIndex(i => (r -= p[i]) < 0); order.push(left.splice(k < 0 ? 0 : k, 1)[0]); }
        const fin = []; order.forEach((hIdx, rank) => fin[hIdx] = 5200 + rank * (180 + rnd(260)));
        const hs = $$('.dd-h', track), W = $('.dd-run', track).clientWidth - 40, t0 = performance.now();
        const wob = HORSES.map(() => [Math.random() * 6, .6 + Math.random() * .8]);
        await new Promise(res => {
          const step = now => {
            const t = now - t0; let doneAll = true;
            hs.forEach((el, i) => { const f = Math.min(1, t / fin[i]); if (f < 1) doneAll = false; const x = (f + Math.sin(f * 9 + wob[i][0]) * .025 * wob[i][1] * (1 - f)) * W; el.style.transform = `translateX(${Math.max(0, x)}px) scaleX(-1)`; });
            if (Math.floor(t / 400) !== Math.floor((t - 16) / 400)) tone(120 + rnd(60), .05, 'square', .015);
            if (doneAll) return res();
            requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
        order.forEach((hIdx, rank) => $$('.dd-fin', track)[hIdx].textContent = ['🥇', '🥈', '🥉', '4th', '5th', '6th'][rank]);
        const w = order[0], stake = bets.m['h' + w] || 0, staked = bets.total;
        msg.textContent = `${w + 1}. ${HORSES[w][0]} wins at ${odds[w].toFixed(1)}!`;
        bets.m = {}; bets.locked = false; bets.render();
        settle(round2(stake * odds[w]), staked, msg.textContent);
        await sleep(2500); busy = false; raceBtn.disabled = false; card();
      }
      card();
      Casino.hotkey = race;
      return () => { if (!busy) bets.clear(); };
    },
  });
})();
