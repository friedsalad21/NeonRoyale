// Quick card tables (Casino War, Dragon Tiger, Red Dog) and Sic Bo.
(() => {
  const ctrl = (...els) => { const b = h('<div class="btns"></div>'); b.append(...els); return b; };
  const hi = c => { const i = RANKS.indexOf(c.r); return i ? i + 1 : 14; }; // ace high
  const lo = c => RANKS.indexOf(c.r) + 1; // ace low
  const put = async (box, c, down) => { box.innerHTML = ''; const e = cardEl(c, down); box.append(e); sfx.card(); await sleep(350); return e; };

  // ---------- Casino War ----------
  Casino.games.push({
    id: 'war', name: 'Casino War', tag: 'Cards · Tie pays 10:1', icon: '⚔️', accent: '#ef4444',
    blurb: 'One card each, high card wins. On a tie, go to war!',
    rules: `<ul><li>You and the dealer get one card. Higher card wins 1:1 (aces high).</li>
      <li>On a tie you can <b>surrender</b> (get half your bet back) or <b>go to war</b> by matching your bet. Three cards are burned and one more card is dealt each. If yours is equal or higher, your raise pays 1:1 and the original bet pushes. Otherwise both are lost.</li>
      <li>The optional <b>Tie</b> bet pays 10:1 if the first two cards tie.</li></ul>`,
    mount({ table, controls }) {
      table.innerHTML = `<div class="duel"><div class="duel-side"><div class="lbl">Dealer</div><div class="cards d"></div></div><div class="duel-vs">VS</div><div class="duel-side"><div class="lbl">You</div><div class="cards p"></div></div></div>
        <div class="duel-msg"></div><div class="pk-spots"><div class="pk-spot tie"><div class="circle"></div><div class="lbl">Tie<small>10:1</small></div></div><div class="pk-spot main"><div class="circle"></div><div class="lbl">Bet</div></div></div>`;
      const dB = $('.cards.d', table), pB = $('.cards.p', table), msg = $('.duel-msg', table);
      const info = h('<div class="info-line">Bet <b>$0</b></div>');
      const bets = new Bets(() => $('b', info).textContent = fmt(bets.total));
      bets.bind('main', $('.main .circle', table)); bets.bind('tie', $('.tie .circle', table));
      const dealBtn = button('Deal', 'green', deal), warBtn = button('Go to war', 'red', () => war(true)), surBtn = button('Surrender', 'ghost', () => war(false));
      controls.append(chipRack(), info, ctrl(...betButtons(bets), dealBtn, warBtn, surBtn));
      let phase = 'bet', shoe = makeShoe(6);
      const draw = () => { if (shoe.length < 30) shoe = makeShoe(6); return shoe.pop(); };
      const ui = () => { [dealBtn, ...$$('.btns .ghost', controls).filter(b => b !== surBtn)].forEach(b => b.hidden = phase !== 'bet'); warBtn.hidden = surBtn.hidden = phase !== 'war'; };
      ui();
      let main = 0, tieBet = 0, tiePaid = 0;
      async function deal() {
        if (phase !== 'bet') return;
        if (!bets.total) bets.rebet();
        main = bets.m.main || 0; tieBet = bets.m.tie || 0; if (!main) { toast('Place a bet'); sfx.no(); return; }
        phase = 'busy'; ui(); bets.save(); bets.locked = true; msg.textContent = '';
        const p = draw(), d = draw(); await put(pB, p); await put(dB, d);
        tiePaid = hi(p) === hi(d) ? tieBet * 11 : 0;
        if (hi(p) === hi(d)) { msg.textContent = `TIE! Go to war or surrender?${tieBet ? ` Tie bet wins ${fmt(tieBet * 10)}` : ''}`; phase = 'war'; ui(); return; }
        const win = hi(p) > hi(d); msg.textContent = win ? 'You win!' : 'Dealer wins';
        end(win ? main * 2 : 0, main + tieBet);
      }
      async function war(go) {
        if (phase !== 'war') return;
        if (!go) { msg.textContent = 'Surrendered: half your bet returned'; return end(main / 2, main + tieBet); }
        if (!Casino.take(main)) return;
        phase = 'busy'; ui(); msg.textContent = '⚔️ WAR! Burning three cards…'; sfx.big();
        draw(); draw(); draw(); await sleep(900);
        const p = draw(), d = draw(); await put(pB, p); await put(dB, d);
        const win = hi(p) >= hi(d); msg.textContent = win ? 'You win the war!' : 'Dealer wins the war';
        end(win ? main * 3 : 0, main * 2 + tieBet);
      }
      // the tie side bet is settled together with the main bet
      function end(paid, staked) { bets.m = {}; bets.locked = false; bets.render(); phase = 'bet'; ui(); settle(paid + tiePaid, staked); }
      Casino.hotkey = () => phase === 'bet' ? deal() : war(true);
      return () => bets.clear();
    },
  });

  // ---------- Dragon Tiger ----------
  Casino.games.push({
    id: 'dragontiger', name: 'Dragon Tiger', tag: 'Cards · Tie 8:1', icon: '🐉', accent: '#f59e0b',
    blurb: 'The fastest game in the casino: one card for Dragon, one for Tiger. Pick the higher.',
    rules: `<ul><li>One card is dealt to <b>Dragon</b> and one to <b>Tiger</b>. Kings are high and aces low.</li>
      <li>Bet on the side with the higher card: pays 1:1. <b>Tie</b> pays 8:1. On a tie, Dragon and Tiger bets lose half.</li>
      <li>8-deck shoe. The road shows recent results.</li></ul>`,
    mount({ table, controls }) {
      table.innerHTML = `<div class="duel"><div class="duel-side"><div class="lbl dt-d">DRAGON 🐉</div><div class="cards d"></div></div><div class="duel-vs">VS</div><div class="duel-side"><div class="lbl dt-t">TIGER 🐯</div><div class="cards t"></div></div></div>
        <div class="duel-msg"></div><div class="dt-bets"><div class="dtb d">DRAGON<small>1:1</small></div><div class="dtb x">TIE<small>8:1</small></div><div class="dtb t">TIGER<small>1:1</small></div></div><div class="road"></div>`;
      const dB = $('.cards.d', table), tB = $('.cards.t', table), msg = $('.duel-msg', table);
      const info = h('<div class="info-line">Bet <b>$0</b></div>');
      const bets = new Bets(() => $('b', info).textContent = fmt(bets.total));
      bets.bind('dragon', $('.dtb.d', table)); bets.bind('tie', $('.dtb.x', table)); bets.bind('tiger', $('.dtb.t', table));
      const dealBtn = button('Deal', 'green', deal);
      controls.append(chipRack(), info, ctrl(...betButtons(bets), dealBtn));
      let busy = false, shoe = makeShoe(8), road = store.get('dt_road', []);
      const showRoad = () => $('.road', table).innerHTML = road.map(r => `<i class="${{ D: 'B', T: 'P', X: 'T' }[r]}">${r === 'X' ? '=' : r}</i>`).join('');
      showRoad();
      async function deal() {
        if (busy) return;
        if (!bets.total) bets.rebet();
        if (!bets.total) { toast('Place a bet'); sfx.no(); return; }
        busy = true; dealBtn.disabled = true; bets.save(); bets.locked = true; msg.textContent = '';
        if (shoe.length < 20) shoe = makeShoe(8);
        const d = shoe.pop(), t = shoe.pop(); await put(dB, d); await put(tB, t);
        const w = lo(d) > lo(t) ? 'D' : lo(t) > lo(d) ? 'T' : 'X', m = bets.m;
        let paid = 0;
        if (w === 'X') paid = (m.tie || 0) * 9 + ((m.dragon || 0) + (m.tiger || 0)) / 2;
        else paid = (w === 'D' ? m.dragon || 0 : m.tiger || 0) * 2;
        msg.textContent = w === 'X' ? 'TIE!' : w === 'D' ? 'Dragon wins' : 'Tiger wins';
        road = [...road, w].slice(-72); store.set('dt_road', road); showRoad();
        const staked = bets.total; bets.m = {}; bets.locked = false; busy = false; dealBtn.disabled = false; bets.render();
        settle(paid, staked, msg.textContent);
      }
      Casino.hotkey = deal;
      return () => bets.clear();
    },
  });

  // ---------- Red Dog ----------
  const SPREAD = { 1: 5, 2: 4, 3: 2 };
  Casino.games.push({
    id: 'reddog', name: 'Red Dog', tag: 'Cards · In-between', icon: '🐕', accent: '#b91c1c',
    blurb: 'Will the third card land between the first two? The tighter the gap, the bigger the pay.',
    rules: `<ul><li>Two cards are dealt (aces high). The <b>spread</b> is the number of ranks between them.</li>
      <li>Consecutive cards: push. A pair: a third card is dealt, and three of a kind pays 11:1, anything else pushes.</li>
      <li>Otherwise you may <b>raise</b> (double your bet) or call, then the third card is dealt. If it falls strictly between: spread 1 pays 5:1, 2 pays 4:1, 3 pays 2:1, 4+ pays 1:1. Otherwise you lose.</li></ul>`,
    mount({ table, controls }) {
      table.innerHTML = `<div class="rd"><div class="cards a"></div><div class="cards m"></div><div class="cards b"></div></div><div class="duel-msg"></div>
        <div class="pk-spots"><div class="pk-spot main"><div class="circle"></div><div class="lbl">Bet</div></div><div class="pk-spot raise"><div class="circle"></div><div class="lbl">Raise</div></div></div>`;
      const [aB, mB, bB] = ['a', 'm', 'b'].map(k => $(`.cards.${k}`, table)), msg = $('.duel-msg', table), raiseSpot = $('.raise .circle', table);
      const info = h('<div class="info-line">Bet <b>$0</b></div>');
      const bets = new Bets(() => $('b', info).textContent = fmt(bets.total)); bets.bind('main', $('.main .circle', table));
      const dealBtn = button('Deal', 'green', deal), raiseBtn = button('Raise', 'green', () => third(true)), callBtn = button('Call', 'ghost', () => third(false));
      controls.append(chipRack(), info, ctrl(...betButtons(bets), dealBtn, raiseBtn, callBtn));
      let phase = 'bet', c1, c2, stake = 0, sp = 0, shoe = makeShoe(6);
      const draw = () => { if (shoe.length < 20) shoe = makeShoe(6); return shoe.pop(); };
      const ui = () => { [dealBtn, ...$$('.btns .ghost', controls).filter(b => b !== callBtn)].forEach(b => b.hidden = phase !== 'bet'); raiseBtn.hidden = callBtn.hidden = phase !== 'act'; };
      ui();
      async function deal() {
        if (phase !== 'bet') return;
        if (!bets.total) bets.rebet();
        stake = bets.m.main; if (!stake) { toast('Place a bet'); sfx.no(); return; }
        phase = 'busy'; ui(); bets.save(); bets.locked = true; msg.textContent = ''; raiseSpot.innerHTML = ''; mB.innerHTML = '';
        [c1, c2] = [draw(), draw()].sort((x, y) => hi(x) - hi(y));
        await put(aB, c1); await put(bB, c2);
        const gap = hi(c2) - hi(c1);
        if (gap === 1) { msg.textContent = 'Consecutive: push'; return end(stake, stake); }
        if (gap === 0) {
          msg.textContent = 'A pair! Third card for trips…'; await sleep(600);
          const c3 = draw(); await put(mB, c3);
          const trips = hi(c3) === hi(c1); msg.textContent = trips ? 'THREE OF A KIND! 11:1' : 'Push';
          return end(trips ? stake * 12 : stake, stake);
        }
        sp = gap - 1; msg.textContent = `Spread ${sp}: pays ${SPREAD[sp] || 1}:1. Raise or call?`;
        phase = 'act'; ui();
      }
      async function third(raise) {
        if (phase !== 'act') return;
        if (raise) { if (!Casino.take(stake)) return; raiseSpot.innerHTML = `<div class="stack">${chipHTML(stake)}</div>`; sfx.chip(); }
        phase = 'busy'; ui();
        const total = raise ? stake * 2 : stake, c3 = draw(); await put(mB, c3);
        const win = hi(c3) > hi(c1) && hi(c3) < hi(c2);
        msg.textContent = win ? `In between! ${SPREAD[sp] || 1}:1` : 'Outside: dealer wins';
        end(win ? total * ((SPREAD[sp] || 1) + 1) : 0, total);
      }
      function end(paid, staked) { bets.m = {}; bets.locked = false; bets.render(); phase = 'bet'; ui(); settle(paid, staked); }
      Casino.hotkey = () => phase === 'bet' ? deal() : third(false);
      return () => bets.clear();
    },
  });

  // ---------- Sic Bo ----------
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const face = v => Array.from({ length: 9 }, (_, i) => `<i${PIPS[v].includes(i) ? ' class="on"' : ''}></i>`).join('');
  const TOTALS = { 4: 60, 5: 30, 6: 17, 7: 12, 8: 8, 9: 6, 10: 6, 11: 6, 12: 6, 13: 8, 14: 12, 15: 17, 16: 30, 17: 60 };
  Casino.games.push({
    id: 'sicbo', section: 'Dice', name: 'Sic Bo', tag: 'Dice · Triples 180:1', icon: '🎲', accent: '#dc2626',
    blurb: 'The ancient three-dice game. Big, small, totals, doubles and triples.',
    rules: `<ul><li>Three dice are shaken. Bet on what they show.</li>
      <li><b>Small</b> (4–10) and <b>Big</b> (11–17) pay 1:1 but lose to any triple. <b>Odd</b>/<b>Even</b> also pay 1:1 and lose to triples.</li>
      <li><b>Totals</b> pay 6:1 to 60:1. <b>Specific double</b> pays 10:1, <b>any triple</b> 30:1, <b>specific triple</b> 180:1.</li>
      <li><b>Single numbers</b> (1–6) pay 1:1 per die showing it (up to 3:1). <b>Two-dice combos</b> pay 5:1.</li></ul>`,
    mount({ table, controls }) {
      const combos = []; for (let a = 1; a <= 6; a++) for (let b = a + 1; b <= 6; b++) combos.push([a, b]);
      table.innerHTML = `<div class="sb-dice">${'<div class="die"></div>'.repeat(3)}<div class="sb-msg"></div></div>
        <div class="sb">
          <div class="sb-top"><div data-k="small">SMALL<small>4–10 · 1:1</small></div><div data-k="odd">ODD<small>1:1</small></div>
            ${[1, 2, 3, 4, 5, 6].map(n => `<div data-k="d${n}" class="sb-dbl"><span>${n}${n}</span><small>10:1</small></div>`).join('')}
            <div data-k="anytriple">ANY TRIPLE<small>30:1</small></div>
            ${[1, 2, 3, 4, 5, 6].map(n => `<div data-k="t${n}" class="sb-dbl"><span>${n}${n}${n}</span><small>180:1</small></div>`).join('')}
            <div data-k="even">EVEN<small>1:1</small></div><div data-k="big">BIG<small>11–17 · 1:1</small></div></div>
          <div class="sb-totals">${Object.entries(TOTALS).map(([t, p]) => `<div data-k="s${t}"><b>${t}</b><small>${p}:1</small></div>`).join('')}</div>
          <div class="sb-combos">${combos.map(([a, b]) => `<div data-k="c${a}${b}"><span>${a}·${b}</span><small>5:1</small></div>`).join('')}</div>
          <div class="sb-singles">${[1, 2, 3, 4, 5, 6].map(n => `<div data-k="n${n}"><div class="die sm">${face(n)}</div></div>`).join('')}</div>
        </div>`;
      const dice = $$('.sb-dice .die', table), msg = $('.sb-msg', table);
      dice.forEach((d, i) => d.innerHTML = face([4, 2, 6][i]));
      const info = h('<div class="info-line">Total bet <b>$0</b></div>');
      const bets = new Bets(() => $('b', info).textContent = fmt(bets.total));
      $$('[data-k]', table).forEach(el => bets.bind(el.dataset.k, el));
      const rollBtn = button('Roll', 'red', roll);
      controls.append(chipRack(), info, ctrl(...betButtons(bets), rollBtn));
      let busy = false;
      function mult(k, d) {
        const s = d[0] + d[1] + d[2], triple = d[0] === d[1] && d[1] === d[2], cnt = n => d.filter(x => x === n).length;
        if (k === 'small') return !triple && s <= 10 ? 2 : 0;
        if (k === 'big') return !triple && s >= 11 ? 2 : 0;
        if (k === 'odd') return !triple && s % 2 ? 2 : 0;
        if (k === 'even') return !triple && !(s % 2) ? 2 : 0;
        if (k === 'anytriple') return triple ? 31 : 0;
        const n = +k.slice(1);
        if (k[0] === 'd') return cnt(n) >= 2 ? 11 : 0;
        if (k[0] === 't') return cnt(n) === 3 ? 181 : 0;
        if (k[0] === 's') return s === n ? TOTALS[n] + 1 : 0;
        if (k[0] === 'n') return cnt(n) ? cnt(n) + 1 : 0;
        if (k[0] === 'c') return cnt(+k[1]) && cnt(+k[2]) ? 6 : 0;
        return 0;
      }
      async function roll() {
        if (busy) return;
        if (!bets.total) bets.rebet();
        if (!bets.total) { toast('Place a bet'); sfx.no(); return; }
        busy = true; rollBtn.disabled = true; bets.save(); bets.locked = true; msg.textContent = '';
        $$('.hit', table).forEach(e => e.classList.remove('hit'));
        sfx.roll(); dice.forEach(d => d.classList.add('tumble'));
        for (let i = 0; i < 10; i++) { dice.forEach(d => d.innerHTML = face(1 + rnd(6))); await sleep(70); }
        const d = [1 + rnd(6), 1 + rnd(6), 1 + rnd(6)];
        dice.forEach((el, i) => { el.classList.remove('tumble'); el.innerHTML = face(d[i]); });
        const s = d[0] + d[1] + d[2];
        msg.textContent = `${d.join(' · ')} = ${s}${d[0] === d[1] && d[1] === d[2] ? ' · TRIPLE!' : s <= 10 ? ' · Small' : ' · Big'}`;
        $$('[data-k]', table).forEach(el => { if (mult(el.dataset.k, d)) el.classList.add('hit'); });
        let paid = 0; const staked = bets.total;
        for (const [k, v] of Object.entries(bets.m)) paid += v * mult(k, d);
        bets.m = {}; bets.locked = false; busy = false; rollBtn.disabled = false; bets.render();
        settle(paid, staked, msg.textContent);
      }
      Casino.hotkey = roll;
      return () => bets.clear();
    },
  });
})();
