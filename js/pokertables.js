// Poker table games: Three Card Poker, Ultimate Texas Hold'em, Let It Ride, Pai Gow Poker.
(() => {
  const P = Poker;
  const ctrl = (...els) => { const b = h('<div class="btns"></div>'); b.append(...els); return b; };
  const spot = (cls, label, sub = '') => `<div class="pk-spot ${cls}"><div class="circle"></div><div class="lbl">${label}${sub ? `<small>${sub}</small>` : ''}</div></div>`;
  async function dealTo(box, cards, down = false, gap = 220) { const els = []; for (const c of cards) { const e = cardEl(c, down); box.append(e); els.push(e); sfx.card(); await sleep(gap); } return els; }
  const flipAll = els => els.forEach(reveal);
  const setLabel = (el, t, cls = '') => { el.textContent = t; el.className = 'pk-name ' + cls; };

  // ---------- Three Card Poker ----------
  const PP = { 5: 40, 4: 30, 3: 6, 2: 4, 1: 1 }, ANTE_BONUS = { 5: 5, 4: 4, 3: 1 };
  Casino.games.push({
    id: 'threecard', section: 'Poker', name: 'Three Card Poker', tag: 'Poker · Pair Plus 40:1', icon: '🂡', accent: '#0ea5e9',
    blurb: 'Three cards each. Play or fold against the dealer, and back yourself with Pair Plus.',
    rules: `<ul><li>Place an <b>Ante</b> (and optionally <b>Pair Plus</b>). You and the dealer get 3 cards each.</li>
      <li>Fold (lose the ante) or <b>Play</b> by matching the ante. The dealer needs Queen-high to qualify. If the dealer doesn't qualify, the ante pays 1:1 and Play pushes. Otherwise the best hand wins both 1:1.</li>
      <li><b>Ante bonus</b> pays no matter what the dealer has: straight 1:1, three of a kind 4:1, straight flush 5:1.</li>
      <li><b>Pair Plus</b> pays on your hand alone: pair 1:1, flush 4:1, straight 6:1, trips 30:1, straight flush 40:1.</li>
      <li>In 3-card poker a straight beats a flush.</li></ul>`,
    mount({ table, controls }) {
      table.innerHTML = `<div class="pkt"><div class="pk-row"><div class="lbl">Dealer · Queen high qualifies</div><div class="cards d"></div><div class="pk-name dn"></div></div>
        <div class="pk-row"><div class="cards p"></div><div class="pk-name pn"></div></div>
        <div class="pk-spots">${spot('pp', 'Pair Plus', 'up to 40:1')}${spot('ante', 'Ante')}${spot('play', 'Play')}</div></div>`;
      const dBox = $('.cards.d', table), pBox = $('.cards.p', table), dn = $('.dn', table), pn = $('.pn', table);
      const info = h('<div class="info-line">Bet <b>$0</b></div>');
      const bets = new Bets(() => $('b', info).textContent = fmt(bets.total));
      bets.bind('ante', $('.ante .circle', table)); bets.bind('pp', $('.pp .circle', table));
      const playSpot = $('.play .circle', table);
      const dealBtn = button('Deal', 'green', deal), playBtn = button('Play', 'green', () => decide(true)), foldBtn = button('Fold', 'red', () => decide(false));
      controls.append(chipRack(), info, ctrl(...betButtons(bets), dealBtn, playBtn, foldBtn));
      let phase = 'bet', shoe, pc, dc, dEls;
      const ui = () => { [dealBtn, ...$$('.btns .ghost', controls)].forEach(b => b.hidden = phase !== 'bet'); playBtn.hidden = foldBtn.hidden = phase !== 'decide'; };
      ui();
      async function deal() {
        if (phase !== 'bet') return;
        if (!bets.total) bets.rebet();
        if (!bets.m.ante) { toast('Place an Ante bet'); sfx.no(); return; }
        phase = 'busy'; ui(); bets.save(); bets.locked = true;
        dBox.innerHTML = pBox.innerHTML = ''; dn.textContent = pn.textContent = ''; playSpot.innerHTML = '';
        shoe = makeShoe(1); pc = shoe.splice(0, 3); dc = shoe.splice(0, 3);
        await dealTo(pBox, pc); dEls = await dealTo(dBox, dc, true);
        setLabel(pn, P.CAT3[P.eval3(pc)[0]]);
        phase = 'decide'; ui();
      }
      async function decide(play) {
        if (phase !== 'decide') return;
        const ante = bets.m.ante, pp = bets.m.pp || 0;
        if (play) { if (!Casino.take(ante)) return; playSpot.innerHTML = `<div class="stack">${chipHTML(ante)}</div>`; sfx.chip(); }
        phase = 'busy'; ui();
        flipAll(dEls); await sleep(500);
        const ps = P.eval3(pc), ds = P.eval3(dc), qual = ds[0] > 0 || ds[1] >= 12;
        setLabel(dn, P.CAT3[ds[0]] + (qual ? '' : ' · does not qualify'));
        let paid = 0, staked = ante + pp + (play ? ante : 0);
        if (pp && PP[ps[0]]) paid += pp * (PP[ps[0]] + 1);
        if (play) {
          paid += ante * (ANTE_BONUS[ps[0]] || 0);
          const c = P.cmp(ps, ds);
          if (!qual) paid += ante * 2 + ante;
          else if (c > 0) paid += ante * 4;
          else if (c === 0) paid += ante * 2;
          setLabel(pn, P.CAT3[ps[0]] + (!qual ? ' · Dealer no qualify' : c > 0 ? ' · WIN' : c < 0 ? ' · Dealer wins' : ' · Push'), !qual || c >= 0 ? 'win' : 'lose');
        } else setLabel(pn, 'Folded', 'lose');
        bets.m = {}; bets.locked = false; bets.render(); phase = 'bet'; ui();
        settle(paid, staked, P.CAT3[ps[0]]);
      }
      Casino.hotkey = () => phase === 'bet' ? deal() : decide(true);
      return () => bets.clear();
    },
  });

  // ---------- Ultimate Texas Hold'em ----------
  const BLIND = { 9: 500, 8: 50, 7: 10, 6: 3, 5: 1.5, 4: 1 }, TRIPS = { 9: 50, 8: 40, 7: 30, 6: 8, 5: 7, 4: 4, 3: 3 };
  Casino.games.push({
    id: 'uth', section: 'Poker', name: "Ultimate Texas Hold'em", tag: 'Poker · Raise up to 4×', icon: '♠️', accent: '#16a34a',
    blurb: "Hold'em against the dealer. Raise big pre-flop, or wait and see the board.",
    rules: `<ul><li>Bet an <b>Ante</b>; an equal <b>Blind</b> is placed automatically. <b>Trips</b> is an optional side bet.</li>
      <li>Before the flop: check or raise 3× or 4× the ante. After the flop: check or raise 2×. After the river: raise 1× or fold. You can only raise once.</li>
      <li>Best 5-card hand from your 2 cards and the 5 on the board wins. Your raise pays 1:1. The ante pays 1:1 but pushes if the dealer doesn't have at least a pair.</li>
      <li>The Blind pays only when you win with a straight or better (straight 1:1, flush 3:2, full house 3:1, quads 10:1, straight flush 50:1, royal 500:1), otherwise it pushes.</li>
      <li>Trips pays on your hand alone: trips 3:1, straight 4:1, flush 7:1, full house 8:1, quads 30:1, straight flush 40:1, royal 50:1.</li></ul>`,
    mount({ table, controls }) {
      table.innerHTML = `<div class="pkt"><div class="pk-row"><div class="lbl">Dealer · needs a pair for the ante</div><div class="cards d"></div><div class="pk-name dn"></div></div>
        <div class="pk-row"><div class="cards b"></div></div>
        <div class="pk-row"><div class="cards p"></div><div class="pk-name pn"></div></div>
        <div class="pk-spots">${spot('trips', 'Trips', 'up to 50:1')}${spot('ante', 'Ante')}${spot('blind', 'Blind')}${spot('play', 'Play')}</div></div>`;
      const dBox = $('.cards.d', table), bBox = $('.cards.b', table), pBox = $('.cards.p', table), dn = $('.dn', table), pn = $('.pn', table);
      const info = h('<div class="info-line">Bet <b>$0</b></div>');
      const bets = new Bets(() => $('b', info).textContent = fmt(bets.total));
      bets.bind('ante', $('.ante .circle', table)); bets.bind('trips', $('.trips .circle', table));
      const blindSpot = $('.blind .circle', table), playSpot = $('.play .circle', table);
      const dealBtn = button('Deal', 'green', deal);
      const r4 = button('Raise 4×', 'green', () => raise(4)), r3 = button('Raise 3×', 'green', () => raise(3)), r2 = button('Raise 2×', 'green', () => raise(2)), r1 = button('Raise 1×', 'green', () => raise(1));
      const chk = button('Check', 'ghost', check), fold = button('Fold', 'red', () => showdown(false));
      controls.append(chipRack(), info, ctrl(...betButtons(bets), dealBtn, r4, r3, r2, r1, chk, fold));
      let phase = 'bet', street = 0, pc, dc, bc, dEls, bEls, raised = 0, ante = 0;
      const ui = () => {
        [dealBtn, ...$$('.btns .ghost', controls).filter(b => b !== chk)].forEach(b => b.hidden = phase !== 'bet');
        const act = phase === 'act';
        r4.hidden = r3.hidden = !(act && street === 0); r2.hidden = !(act && street === 1); r1.hidden = fold.hidden = !(act && street === 2); chk.hidden = !(act && street < 2);
      };
      ui();
      async function deal() {
        if (phase !== 'bet') return;
        if (!bets.total) bets.rebet();
        ante = bets.m.ante; if (!ante) { toast('Place an Ante bet'); sfx.no(); return; }
        if (!Casino.take(ante)) return;
        blindSpot.innerHTML = `<div class="stack">${chipHTML(ante)}</div>`; playSpot.innerHTML = '';
        phase = 'busy'; ui(); bets.save(); bets.locked = true; raised = 0; street = 0;
        [dBox, bBox, pBox].forEach(b => b.innerHTML = ''); dn.textContent = pn.textContent = '';
        const shoe = makeShoe(1); pc = shoe.splice(0, 2); dc = shoe.splice(0, 2); bc = shoe.splice(0, 5);
        await dealTo(pBox, pc); dEls = await dealTo(dBox, dc, true, 150); bEls = await dealTo(bBox, bc, true, 100);
        setLabel(pn, pc[0].r === pc[1].r ? 'Pocket pair' : ''); phase = 'act'; ui();
      }
      async function openStreet() { const n = street === 1 ? [0, 1, 2] : [3, 4]; for (const i of n) { reveal(bEls[i]); await sleep(200); } setLabel(pn, P.best([...pc, ...bc.slice(0, street === 1 ? 3 : 5)]).name); }
      async function check() { if (phase !== 'act') return; phase = 'busy'; ui(); street++; await openStreet(); phase = 'act'; ui(); }
      async function raise(x) {
        if (phase !== 'act' || !Casino.take(ante * x)) return;
        raised = ante * x; playSpot.innerHTML = `<div class="stack">${chipHTML(raised)}</div>`; sfx.chip();
        phase = 'busy'; ui();
        while (street < 2) { street++; await openStreet(); }
        showdown(true);
      }
      async function showdown(play) {
        phase = 'busy'; ui();
        while (street < 2) { street++; await openStreet(); }
        flipAll(dEls); await sleep(500);
        const pb = P.best([...pc, ...bc]), db = P.best([...dc, ...bc]), qual = db.score[0] >= 1, c = P.cmp(pb.score, db.score);
        setLabel(dn, db.name + (qual ? '' : ' · does not qualify'));
        const trips = bets.m.trips || 0;
        let paid = 0, staked = ante * 2 + trips + raised;
        if (trips && TRIPS[pb.score[0]]) paid += trips * (TRIPS[pb.score[0]] + 1);
        if (play) {
          if (c > 0) { paid += raised * 2 + (qual ? ante * 2 : ante) + ante * (1 + (BLIND[pb.score[0]] || 0)); }
          else if (c === 0) paid += raised + ante * 2;
          else if (!qual) paid += ante;
          setLabel(pn, pb.name + (c > 0 ? ' · WIN' : c < 0 ? ' · Dealer wins' : ' · Push'), c >= 0 ? 'win' : 'lose');
        } else setLabel(pn, pb.name + ' · Folded', 'lose');
        bets.m = {}; bets.locked = false; bets.render(); blindSpot.innerHTML = ''; phase = 'bet'; ui();
        settle(paid, staked, pb.name);
      }
      Casino.hotkey = () => phase === 'bet' ? deal() : phase === 'act' ? (street < 2 ? check() : raise(1)) : 0;
      return () => bets.clear();
    },
  });

  // ---------- Let It Ride ----------
  const LIR = { 9: 1000, 8: 200, 7: 50, 6: 11, 5: 8, 4: 5, 3: 3, 2: 2, 1: 1 };
  Casino.games.push({
    id: 'letitride', section: 'Poker', name: 'Let It Ride', tag: 'Poker · Royal 1000:1', icon: '🎰', accent: '#f97316',
    blurb: 'Three bets ride on your poker hand. Pull two of them back if you don\'t like it.',
    rules: `<ul><li>Your chip is placed three times (bets 1, 2 and $). You get 3 cards, and 2 community cards sit face down.</li>
      <li>After seeing your 3 cards, pull back bet 1 or let it ride. After the first community card, pull back bet 2 or let it ride. The $ bet always stays.</li>
      <li>There's no dealer hand. Every remaining bet pays on your final 5 cards: pair of 10s or better 1:1, two pair 2:1, trips 3:1, straight 5:1, flush 8:1, full house 11:1, quads 50:1, straight flush 200:1, royal 1000:1.</li></ul>`,
    mount({ table, controls }) {
      table.innerHTML = `<div class="pkt"><div class="pk-row"><div class="lbl">Community cards</div><div class="cards b"></div></div>
        <div class="pk-row"><div class="cards p"></div><div class="pk-name pn"></div></div>
        <div class="pk-spots">${spot('b1', '1')}${spot('b2', '2')}${spot('b3', '$')}</div></div>`;
      const bBox = $('.cards.b', table), pBox = $('.cards.p', table), pn = $('.pn', table);
      const info = h('<div class="info-line">Unit <b>$0</b></div>');
      const bets = new Bets(() => { $('b', info).textContent = fmt(bets.total); ['b2', 'b3'].forEach(k => $(`.${k} .circle`, table).innerHTML = bets.m.b1 ? `<div class="stack">${chipHTML(bets.m.b1)}</div>` : ''); });
      bets.bind('b1', $('.b1 .circle', table));
      const dealBtn = button('Deal', 'green', deal), ride = button('Let it ride', 'green', () => step(false)), pull = button('Pull back', 'red', () => step(true));
      controls.append(chipRack(), info, ctrl(...betButtons(bets), dealBtn, ride, pull));
      let phase = 'bet', stage = 0, unit = 0, live = 0, pc, bc, bEls;
      const ui = () => { [dealBtn, ...$$('.btns .ghost', controls)].forEach(b => b.hidden = phase !== 'bet'); ride.hidden = pull.hidden = phase !== 'act'; pull.textContent = `Pull back bet ${stage + 1}`; };
      ui();
      async function deal() {
        if (phase !== 'bet') return;
        if (!bets.total) bets.rebet();
        unit = bets.m.b1; if (!unit) { toast('Place a bet'); sfx.no(); return; }
        if (!Casino.take(unit * 2)) return;
        phase = 'busy'; ui(); bets.save(); bets.locked = true; live = 3; stage = 0;
        bBox.innerHTML = pBox.innerHTML = ''; pn.textContent = '';
        const shoe = makeShoe(1); pc = shoe.splice(0, 3); bc = shoe.splice(0, 2);
        await dealTo(pBox, pc); bEls = await dealTo(bBox, bc, true, 150);
        phase = 'act'; ui();
      }
      async function step(pullBack) {
        if (phase !== 'act') return;
        phase = 'busy'; ui();
        if (pullBack) { live--; Casino.pay(unit); $(`.b${stage + 1} .circle`, table).innerHTML = ''; sfx.chip(); }
        reveal(bEls[stage]); await sleep(400); stage++;
        if (stage < 2) { phase = 'act'; ui(); return; }
        const s = P.eval5([...pc, ...bc]), cat = s[0], ok = cat >= 2 || (cat === 1 && s[1] >= 10);
        const name = P.CAT[cat];
        setLabel(pn, ok ? `${name} · pays ${LIR[cat]}:1` : name, ok ? 'win' : 'lose');
        const paid = ok ? live * unit * (LIR[cat] + 1) : 0;
        bets.m = {}; bets.locked = false; bets.render(); phase = 'bet'; ui();
        settle(paid, live * unit, name);
      }
      Casino.hotkey = () => phase === 'bet' ? deal() : step(false);
      return () => bets.clear();
    },
  });

  // ---------- Pai Gow Poker ----------
  // pick the split that maximises a simple strength score: high-hand category plus low-hand strength
  function houseWay(cards) {
    let best = null;
    for (const low of P.combos([...cards.keys()], 2)) {
      const lo = low.map(i => cards[i]), hi = cards.filter((_, i) => !low.includes(i));
      const hs = P.evalJ5(hi), ls = P.eval2(lo);
      if (P.cmp(hs, ls) <= 0) continue;
      const score = hs[0] + (ls[0] ? 3 + ls[1] / 14 : ls[1] / 10 + ls[2] / 140);
      if (!best || score > best.score) best = { score, low };
    }
    return best.low;
  }
  Casino.games.push({
    id: 'paigow', section: 'Poker', name: 'Pai Gow Poker', tag: 'Poker · Set two hands', icon: '🀄', accent: '#dc2626',
    blurb: 'Split 7 cards into a 5-card and a 2-card hand. Beat the dealer with both.',
    rules: `<ul><li>You and the dealer get 7 cards from a 53-card deck. The <b>joker</b> is an ace, or completes a straight or flush.</li>
      <li>Set them into a 5-card <b>high hand</b> and a 2-card <b>low hand</b>. The high hand must beat the low hand. Click two cards to put them in the low hand, or press <b>House Way</b>.</li>
      <li>Win both hands: you're paid 1:1 minus 5% commission. Win one: push. Lose both: you lose. Exact ties (copies) go to the dealer.</li></ul>`,
    mount({ table, controls }) {
      table.innerHTML = `<div class="pkt"><div class="pk-row"><div class="lbl">Dealer</div><div class="pg-set"><div class="cards dh"></div><div class="cards dl"></div></div><div class="pk-name dn"></div></div>
        <div class="pk-row"><div class="lbl">Your 7 cards: click two for the low hand</div><div class="cards p pg-pick"></div><div class="pk-name pn"></div></div>
        <div class="pk-spots">${spot('main', 'Bet')}</div></div>`;
      const dh = $('.dh', table), dl = $('.dl', table), pBox = $('.cards.p', table), dn = $('.dn', table), pn = $('.pn', table);
      const info = h('<div class="info-line">Bet <b>$0</b></div>');
      const bets = new Bets(() => $('b', info).textContent = fmt(bets.total));
      bets.bind('main', $('.main .circle', table));
      const dealBtn = button('Deal', 'green', deal), hw = button('House Way', 'ghost', () => { if (phase === 'set') { sel = new Set(houseWay(pc)); showSel(); } }), go = button('Play hands', 'green', play);
      controls.append(chipRack(), info, ctrl(...betButtons(bets), dealBtn, hw, go));
      let phase = 'bet', pc, dc, sel = new Set(), els = [];
      const deck53 = () => shuffle([...makeShoe(1), { r: 'JK', s: '★' }]);
      const jokerEl = () => h('<div class="card joker"><span class="mid face">🃏</span><span class="tl">JK</span></div>');
      const ce = c => c.r === 'JK' ? jokerEl() : cardEl(c);
      const ui = () => { [dealBtn, ...$$('.btns .ghost', controls).filter(b => b !== hw)].forEach(b => b.hidden = phase !== 'bet'); hw.hidden = go.hidden = phase !== 'set'; };
      ui();
      function showSel() {
        els.forEach((e, i) => e.classList.toggle('lowpick', sel.has(i)));
        if (sel.size === 2) { const hi = pc.filter((_, i) => !sel.has(i)), hs = P.evalJ5(hi), ls = P.eval2([...sel].map(i => pc[i])); setLabel(pn, `High: ${P.CAT[hs[0]]} · Low: ${ls[0] ? 'Pair' : 'High card'}${P.cmp(hs, ls) <= 0 ? ' · high hand must beat low!' : ''}`, P.cmp(hs, ls) <= 0 ? 'lose' : ''); }
        else setLabel(pn, `Pick ${2 - sel.size} more for the low hand`);
      }
      async function deal() {
        if (phase !== 'bet') return;
        if (!bets.total) bets.rebet();
        if (!bets.total) { toast('Place a bet'); sfx.no(); return; }
        phase = 'busy'; ui(); bets.save(); bets.locked = true;
        dh.innerHTML = dl.innerHTML = pBox.innerHTML = ''; dn.textContent = '';
        const d = deck53(); pc = d.slice(0, 7); dc = d.slice(7, 14); sel = new Set();
        pc.sort((a, b) => (b.r === 'JK' ? 15 : P.v(b)) - (a.r === 'JK' ? 15 : P.v(a)));
        els = [];
        for (const [i, c] of pc.entries()) { const e = ce(c); e.onclick = () => { if (phase !== 'set') return; sel.has(i) ? sel.delete(i) : sel.size < 2 && sel.add(i); sfx.tick(); showSel(); }; pBox.append(e); els.push(e); sfx.card(); await sleep(120); }
        for (let i = 0; i < 7; i++) { dh.append(cardEl({ r: 'A', s: '♠' }, true)); await sleep(60); }
        phase = 'set'; ui(); showSel();
      }
      async function play() {
        if (phase !== 'set') return;
        if (sel.size !== 2) { toast('Pick 2 cards for the low hand (or use House Way)'); sfx.no(); return; }
        const plo = [...sel].map(i => pc[i]), phi = pc.filter((_, i) => !sel.has(i)), phs = P.evalJ5(phi), pls = P.eval2(plo);
        if (P.cmp(phs, pls) <= 0) { toast('Your 5-card hand must beat your 2-card hand'); sfx.no(); return; }
        phase = 'busy'; ui();
        const dlow = houseWay(dc), dlo = dlow.map(i => dc[i]), dhi = dc.filter((_, i) => !dlow.includes(i)), dhs = P.evalJ5(dhi), dls = P.eval2(dlo);
        dh.innerHTML = ''; dhi.forEach(c => dh.append(ce(c))); dlo.forEach(c => dl.append(ce(c))); sfx.card();
        pBox.innerHTML = ''; phi.forEach(c => pBox.append(ce(c))); pBox.append(h('<span class="pg-gap"></span>')); plo.forEach(c => pBox.append(ce(c)));
        const hiW = P.cmp(phs, dhs) > 0, loW = P.cmp(pls, dls) > 0, stake = bets.m.main;
        setLabel(dn, `High: ${P.CAT[dhs[0]]} · Low: ${dls[0] ? 'Pair' : 'High card'}`);
        setLabel(pn, `High ${hiW ? 'WINS' : 'loses'} · Low ${loW ? 'WINS' : 'loses'}`, hiW && loW ? 'win' : !hiW && !loW ? 'lose' : '');
        const paid = hiW && loW ? stake * 1.95 : hiW || loW ? stake : 0;
        bets.m = {}; bets.locked = false; bets.render(); phase = 'bet'; ui();
        settle(paid, stake, hiW && loW ? 'Won both hands' : hiW || loW ? 'One each: push' : 'Dealer wins both');
      }
      Casino.hotkey = () => phase === 'bet' ? deal() : play();
      return () => bets.clear();
    },
  });
})();
