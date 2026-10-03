Casino.games.push({
  id: 'blackjack', name: 'Blackjack', tag: 'Table · 3:2', icon: '🃏', accent: '#22c55e',
  blurb: 'Beat the dealer to 21. Double, split, and blackjack pays 3 to 2.',
  rules: `<ul>
    <li>Get closer to 21 than the dealer without going over. Picture cards count 10, aces 1 or 11.</li>
    <li>Six-deck shoe. The dealer stands on all 17s and peeks for blackjack.</li>
    <li>Blackjack pays 3:2, other wins pay 1:1, ties push.</li>
    <li>Double down on any first two cards, including after a split. Split pairs up to four hands. Split aces get one card each.</li>
    <li>Pick a chip, click the circle to bet, right-click it to take chips back. Space deals.</li></ul>`,
  mount({ table, controls }) {
    table.innerHTML = `<div class="bj">
      <div class="dealer"><div class="label">Dealer<span class="tot" hidden></span></div><div class="cards"></div></div>
      <div class="arc">Blackjack pays 3 to 2 · Dealer stands on all 17s</div>
      <div class="hands"></div>
      <div class="betzone"><div class="circle"></div><div class="lbl">Place your bet</div></div>
    </div>`;
    const dealerBox = $('.dealer .cards', table), dealerTot = $('.dealer .tot', table), handsEl = $('.hands', table), zone = $('.betzone', table);
    const info = h('<div class="info-line">Bet <b>$0</b></div>');
    const B = {
      clear: button('Clear', 'ghost', () => bets.clear()),
      rebet: button('Rebet', 'ghost', () => bets.rebet()),
      deal: button('Deal', 'green', () => deal()),
      hit: button('Hit', 'green', () => act(hit)),
      stand: button('Stand', 'red', () => act(next)),
      double: button('Double', '', () => act(dbl)),
      split: button('Split', '', () => act(split)),
    };
    const btns = h('<div class="btns"></div>'); btns.append(...Object.values(B));
    controls.append(chipRack(), info, btns);

    let shoe = makeShoe(6), hands = [], dealer = { cards: [] }, hole = null, active = 0, phase = 'bet';
    const bets = new Bets(update); bets.bind('main', $('.circle', table));

    const draw = () => { if (shoe.length < 78) { shoe = makeShoe(6); toast('Shuffling a fresh shoe'); } return shoe.pop(); };
    const cv = c => c.r === 'A' ? 11 : 'JQK'.includes(c.r) && c.r.length === 1 ? 10 : +c.r;
    const val = cards => { let t = 0, a = 0; for (const c of cards) { if (c.r === 'A') a++; t += cv(c); } while (t > 21 && a) { t -= 10; a--; } return { t, soft: a > 0 }; };
    const label = cards => { const { t, soft } = val(cards); return soft && t < 21 ? `${t - 10}/${t}` : t; };
    const bj = cards => cards.length === 2 && val(cards).t === 21;
    const canSplit = hd => hd.cards.length === 2 && cv(hd.cards[0]) === cv(hd.cards[1]) && hands.length < 4 && Casino.bal >= hd.bet && !(hd.split && hd.cards[0].r === 'A');

    async function give(target, down = false) {
      const c = draw(); target.cards.push(c);
      const el = cardEl(c, down); target.box.append(el); sfx.card(); totals(); await sleep(380); return el;
    }
    function totals() {
      if (dealer.cards.length) { dealerTot.hidden = false; dealerTot.textContent = hole?.classList.contains('down') || dealer.cards.length < 2 ? label(dealer.cards.slice(0, 1)) : label(dealer.cards); }
      hands.forEach((hd, i) => { $('.tot', hd.el).textContent = label(hd.cards); hd.el.classList.toggle('active', (phase === 'play' || phase === 'busy') && hands.length > 1 && i === active); });
    }
    function newHand(bet, after) {
      const hd = { cards: [], bet };
      hd.el = h('<div class="hand"><div class="cards"></div><div class="meta"><span class="tot"></span><span class="betchip"></span></div><div class="res"></div></div>');
      hd.box = $('.cards', hd.el); setChip(hd);
      after ? after.el.after(hd.el) : handsEl.append(hd.el);
      return hd;
    }
    const setChip = hd => $('.betchip', hd.el).innerHTML = chipHTML(hd.bet);

    async function act(fn) { if (phase !== 'play') return; phase = 'busy'; update(); await fn(); }
    async function deal() {
      if (phase !== 'bet') return;
      if (!bets.total) bets.rebet();
      if (!bets.total) { toast('Place a bet first'); sfx.no(); return; }
      phase = 'busy'; bets.save(); bets.locked = true;
      const bet = bets.m.main; bets.m = {}; bets.render();
      handsEl.innerHTML = ''; dealerBox.innerHTML = ''; dealerTot.hidden = true; hole = null;
      dealer = { cards: [], box: dealerBox }; hands = [newHand(bet)]; active = 0; update();
      await give(hands[0]); await give(dealer); await give(hands[0]); hole = await give(dealer, true);
      if (bj(dealer.cards) || bj(hands[0].cards)) return finish();
      phase = 'play'; update(); totals();
    }
    async function hit() {
      const hd = hands[active]; await give(hd);
      if (val(hd.cards).t >= 21) return next();
      phase = 'play'; update();
    }
    async function dbl() {
      const hd = hands[active];
      if (!Casino.take(hd.bet)) { phase = 'play'; return update(); }
      hd.bet *= 2; setChip(hd); sfx.chip(); update();
      await give(hd); next();
    }
    async function split() {
      const hd = hands[active];
      if (!Casino.take(hd.bet)) { phase = 'play'; return update(); }
      sfx.chip();
      const nh = newHand(hd.bet, hd);
      nh.cards.push(hd.cards.pop()); nh.box.append(hd.box.lastElementChild);
      hd.split = nh.split = true; totals();
      await give(hd); await give(nh);
      if (hd.cards[0].r === 'A') { hd.done = nh.done = true; return next(); }
      if (val(hd.cards).t === 21) return next();
      phase = 'play'; update(); totals();
    }
    async function next() {
      active++;
      while (active < hands.length && hands[active].done) active++;
      if (active >= hands.length) return dealerTurn();
      phase = 'play'; update(); totals();
      if (val(hands[active].cards).t === 21) { phase = 'busy'; update(); await sleep(300); return next(); }
    }
    async function dealerTurn() {
      phase = 'busy'; update();
      reveal(hole); totals(); await sleep(500);
      if (hands.some(hd => val(hd.cards).t <= 21)) while (val(dealer.cards).t < 17) await give(dealer);
      finish();
    }
    function finish() {
      reveal(hole);
      const d = val(dealer.cards).t, dBJ = bj(dealer.cards);
      let paid = 0, staked = 0, last = '';
      for (const hd of hands) {
        const p = val(hd.cards).t, pBJ = !hd.split && bj(hd.cards);
        let res, m;
        if (p > 21) [res, m] = ['Bust', 0];
        else if (pBJ && !dBJ) [res, m] = ['Blackjack!', 2.5];
        else if (dBJ && !pBJ) [res, m] = ['Dealer blackjack', 0];
        else if (d > 21 || p > d) [res, m] = [d > 21 ? 'Dealer busts' : 'Win', 2];
        else if (p === d) [res, m] = ['Push', 1];
        else [res, m] = ['Lose', 0];
        staked += hd.bet; paid += hd.bet * m; last = res;
        const r = $('.res', hd.el); r.textContent = res; r.className = 'res ' + (m > 1 ? 'win' : m === 1 ? 'push' : 'lose');
      }
      phase = 'bet'; bets.locked = false; totals(); update();
      settle(paid, staked, hands.length === 1 ? last : '');
    }
    function update() {
      const betting = phase === 'bet', playing = phase === 'play';
      for (const k of ['clear', 'rebet', 'deal']) B[k].hidden = !betting;
      for (const k of ['hit', 'stand', 'double', 'split']) { B[k].hidden = betting; B[k].disabled = !playing; }
      const hd = hands[active];
      if (playing) { B.double.disabled = !(hd.cards.length === 2 && Casino.bal >= hd.bet); B.split.disabled = !canSplit(hd); }
      B.rebet.disabled = !bets.last;
      zone.hidden = !betting;
      $('b', info).textContent = fmt(betting ? bets.total : hands.reduce((s, x) => s + x.bet, 0));
    }
    update();
    Casino.hotkey = () => phase === 'bet' ? deal() : act(next);
    return () => bets.clear();
  },
});
