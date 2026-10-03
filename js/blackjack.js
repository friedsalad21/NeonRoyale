// Blackjack, plus Spanish 21 (no tens in the deck, player 21 always wins, bonus 21s, late surrender) from the same table.
const BJ_RULES = `<ul>
    <li>Get closer to 21 than the dealer without going over. Picture cards count 10, aces 1 or 11.</li>
    <li>Six-deck shoe. The dealer stands on all 17s and peeks for blackjack.</li>
    <li>Blackjack pays 3:2, other wins pay 1:1, ties push.</li>
    <li>Double down on any first two cards, including after a split. Split pairs up to four hands. Split aces get one card each.</li>
    <li>Pick a chip, click the circle to bet, right-click it to take chips back. Space deals.</li></ul>`;
const SP_RULES = `<ul>
    <li>Spanish 21 is played with 6 Spanish decks: all the <b>10s are removed</b> (jacks, queens and kings stay).</li>
    <li>Your 21 <b>always wins</b>, and your blackjack beats a dealer blackjack (3:2). The dealer hits soft 17.</li>
    <li>21 bonuses (not after doubling): 5 cards pays 3:2, 6 cards 2:1, 7+ cards 3:1. 6-7-8 or 7-7-7 pays 3:2 mixed suits, 2:1 suited, 3:1 in spades.</li>
    <li>Double on <b>any number of cards</b>, split up to 4 hands, and <b>surrender</b> your first two cards for half your bet back.</li></ul>`;
function bjGame(o) { return {
  ...o, rules: o.spanish ? SP_RULES : BJ_RULES,
  mount({ table, controls }) {
    const SP = o.spanish, DECKS = 6;
    table.innerHTML = `<div class="bj">
      <div class="dealer"><div class="label">Dealer<span class="tot" hidden></span></div><div class="cards"></div></div>
      <div class="arc">${SP ? 'Player 21 always wins · Bonus 21s · Dealer hits soft 17' : 'Blackjack pays 3 to 2 · Dealer stands on all 17s'}</div>
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
      surrender: button('Surrender', 'ghost', () => act(surrender)),
    };
    if (!SP) B.surrender.remove();
    const btns = h('<div class="btns"></div>'); btns.append(...Object.values(B));
    controls.append(chipRack(), info, btns);

    const freshShoe = () => SP ? makeShoe(DECKS).filter(c => c.r !== '10') : makeShoe(DECKS);
    let shoe = freshShoe(), hands = [], dealer = { cards: [] }, hole = null, active = 0, phase = 'bet';
    const bets = new Bets(update); bets.bind('main', $('.circle', table));

    const draw = () => { if (shoe.length < 72) { shoe = freshShoe(); toast('Shuffling a fresh shoe'); } return shoe.pop(); };
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
      hd.bet *= 2; hd.doubled = true; setChip(hd); sfx.chip(); update();
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
    async function surrender() { const hd = hands[active]; hd.surrendered = true; hd.done = true; next(); }
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
      if (hands.some(hd => val(hd.cards).t <= 21 && !hd.surrendered && !(SP && val(hd.cards).t === 21))) while (val(dealer.cards).t < 17 || (SP && val(dealer.cards).t === 17 && val(dealer.cards).soft)) await give(dealer);
      finish();
    }
    function finish() {
      reveal(hole);
      const d = val(dealer.cards).t, dBJ = bj(dealer.cards);
      let paid = 0, staked = 0, last = '';
      for (const hd of hands) {
        const p = val(hd.cards).t, pBJ = !hd.split && bj(hd.cards);
        let res, m;
        if (hd.surrendered) [res, m] = ['Surrendered', .5];
        else if (p > 21) [res, m] = ['Bust', 0];
        else if (pBJ && (!dBJ || SP)) [res, m] = ['Blackjack!', 2.5];
        else if (SP && p === 21) { const b = hd.doubled ? 0 : bonus21(hd.cards); [res, m] = [b ? `Bonus 21 · ${b}:1` : '21 wins!', 2 + b]; }
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
      B.surrender.hidden = betting;
      if (playing) { B.double.disabled = !((SP ? !hd.doubled && val(hd.cards).t < 21 : hd.cards.length === 2) && Casino.bal >= hd.bet); B.split.disabled = !canSplit(hd); B.surrender.disabled = !(SP && hands.length === 1 && hd.cards.length === 2); }
      B.rebet.disabled = !bets.last;
      zone.hidden = !betting;
      $('b', info).textContent = fmt(betting ? bets.total : hands.reduce((s, x) => s + x.bet, 0));
    }
    update();
    Casino.hotkey = () => phase === 'bet' ? deal() : act(next);
    return () => bets.clear();
  },
}; }
// Spanish 21 bonus for a winning 21 (extra on top of even money)
function bonus21(cs) {
  const rs = cs.map(c => c.r).sort().join();
  if (cs.length === 3 && (rs === '6,7,8' || rs === '7,7,7')) return cs.every(c => c.s === '♠') ? 2 : cs.every(c => c.s === cs[0].s) ? 1 : .5;
  return cs.length >= 7 ? 2 : cs.length === 6 ? 1 : cs.length === 5 ? .5 : 0;
}
Casino.games.push(bjGame({ id: 'blackjack', name: 'Blackjack', tag: 'Table · 3:2', icon: '🃏', accent: '#22c55e', blurb: 'Beat the dealer to 21. Double, split, and blackjack pays 3 to 2.' }));
Casino.games.push(bjGame({ id: 'spanish21', name: 'Spanish 21', tag: 'Table · Bonus 21s', icon: '🇪🇸', accent: '#eab308', spanish: true, blurb: 'Blackjack without the tens. Your 21 always wins, plus bonus payouts and surrender.' }));
