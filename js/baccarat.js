(() => {
  const bv = c => { const i = RANKS.indexOf(c.r); return i >= 9 ? 0 : i + 1; };
  const score = cs => cs.reduce((s, c) => s + bv(c), 0) % 10;

  Casino.games.push({
    id: 'baccarat', name: 'Baccarat', tag: 'Table · High limit', icon: '💎', accent: '#a855f7',
    blurb: 'The high-roller favourite. Back the Player, the Banker, or a Tie.',
    rules: `<ul>
      <li>Two hands are dealt: Player and Banker. Closest to 9 wins. Picture cards and tens count 0, aces 1, and only the last digit counts.</li>
      <li>Player pays 1:1. Banker pays 0.95:1 (5% commission). Tie pays 8:1, and Player/Banker bets push on a tie.</li>
      <li>Player Pair and Banker Pair pay 11:1 if that hand's first two cards are the same rank.</li>
      <li>Third cards follow the standard tableau automatically. 8-deck shoe. Space deals.</li></ul>`,
    mount({ table, controls }) {
      table.innerHTML = `<div class="bac">
          <div class="side p"><h3>PLAYER <span class="tot">0</span></h3><div class="cards"></div></div>
          <div class="side b"><h3>BANKER <span class="tot">0</span></h3><div class="cards"></div></div>
        </div>
        <div class="bacbets">
          <div class="bp pp">P PAIR<small>11 to 1</small></div>
          <div class="bp">PLAYER<small>1 to 1</small></div>
          <div class="bt">TIE<small>8 to 1</small></div>
          <div class="bb">BANKER<small>0.95 to 1</small></div>
          <div class="bb bpair">B PAIR<small>11 to 1</small></div>
        </div>
        <div class="road"></div>`;
      const [pp, p, t, b, bp] = $$('.bacbets>div', table);
      const info = h('<div class="info-line">Total bet <b>$0</b></div>');
      const bets = new Bets(() => $('b', info).textContent = fmt(bets.total));
      bets.bind('ppair', pp); bets.bind('player', p); bets.bind('tie', t); bets.bind('banker', b); bets.bind('bpair', bp);
      const dealBtn = button('Deal', 'green', deal);
      const btns = h('<div class="btns"></div>'); btns.append(...betButtons(bets), dealBtn);
      controls.append(chipRack(), info, btns);

      const side = { P: $('.side.p', table), B: $('.side.b', table) };
      let shoe = makeShoe(8), road = store.get('bac_road', []), busy = false;
      const showRoad = () => $('.road', table).innerHTML = road.map(r => `<i class="${r}">${r}</i>`).join('');
      showRoad();

      async function give(hand, key, third = false) {
        if (shoe.length < 20) { shoe = makeShoe(8); toast('New 8-deck shoe'); }
        const c = shoe.pop(); hand.push(c);
        const el = cardEl(c); if (third) el.classList.add('third');
        $('.cards', side[key]).append(el); $('.tot', side[key]).textContent = score(hand);
        sfx.card(); await sleep(450); return c;
      }
      async function deal() {
        if (busy) return;
        if (!bets.total) bets.rebet();
        if (!bets.total) { toast('Place a bet'); sfx.no(); return; }
        busy = true; dealBtn.disabled = true; bets.save(); bets.locked = true;
        for (const k of 'PB') { $('.cards', side[k]).innerHTML = ''; $('.tot', side[k]).textContent = '0'; side[k].classList.remove('won'); }
        const P = [], B = [];
        await give(P, 'P'); await give(B, 'B'); await give(P, 'P'); await give(B, 'B');
        if (score(P) < 8 && score(B) < 8) {
          let p3 = null;
          if (score(P) <= 5) p3 = bv(await give(P, 'P', true));
          const bs = score(B);
          const bankerDraws = p3 === null ? bs <= 5
            : bs <= 2 || (bs === 3 && p3 !== 8) || (bs === 4 && p3 >= 2 && p3 <= 7) || (bs === 5 && p3 >= 4 && p3 <= 7) || (bs === 6 && p3 >= 6 && p3 <= 7);
          if (bankerDraws) await give(B, 'B', true);
        }
        const ps = score(P), bs = score(B), w = ps > bs ? 'P' : bs > ps ? 'B' : 'T';
        if (w !== 'T') side[w].classList.add('won');
        const m = bets.m, staked = bets.total;
        let paid = 0;
        if (m.player) paid += m.player * (w === 'P' ? 2 : w === 'T' ? 1 : 0);
        if (m.banker) paid += m.banker * (w === 'B' ? 1.95 : w === 'T' ? 1 : 0);
        if (m.tie) paid += w === 'T' ? m.tie * 9 : 0;
        if (m.ppair && P[0].r === P[1].r) paid += m.ppair * 12;
        if (m.bpair && B[0].r === B[1].r) paid += m.bpair * 12;
        road = [...road, w].slice(-72); store.set('bac_road', road); showRoad();
        bets.m = {}; bets.locked = false; busy = false; dealBtn.disabled = false; bets.render();
        settle(paid, staked, w === 'T' ? `Tie ${ps}–${bs}` : `${w === 'P' ? 'Player' : 'Banker'} wins ${Math.max(ps, bs)} over ${Math.min(ps, bs)}`);
      }
      Casino.hotkey = deal;
      return () => bets.clear();
    },
  });
})();
