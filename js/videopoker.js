(() => {
  const PAY = [['Royal Flush', 250], ['Straight Flush', 50], ['Four of a Kind', 25], ['Full House', 9], ['Flush', 6], ['Straight', 4], ['Three of a Kind', 3], ['Two Pair', 2], ['Jacks or Better', 1]];
  const payFor = (row, coins) => row === 0 && coins === 5 ? 4000 : PAY[row][1] * coins;
  // index into PAY, or -1 for no win
  function evalHand(cards) {
    const vals = cards.map(c => { const i = RANKS.indexOf(c.r); return i ? i + 1 : 14; }).sort((a, b) => a - b);
    const flush = cards.every(c => c.s === cards[0].s);
    const straight = new Set(vals).size === 5 && (vals[4] - vals[0] === 4 || vals.join() === '2,3,4,5,14');
    const cnt = {}; vals.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
    const g = Object.values(cnt).sort((a, b) => b - a);
    if (straight && flush) return vals[0] === 10 ? 0 : 1;
    if (g[0] === 4) return 2;
    if (g[0] === 3 && g[1] === 2) return 3;
    if (flush) return 4;
    if (straight) return 5;
    if (g[0] === 3) return 6;
    if (g[0] === 2 && g[1] === 2) return 7;
    if (g[0] === 2 && Object.entries(cnt).some(([v, n]) => n === 2 && +v >= 11)) return 8;
    return -1;
  }
  const DENOMS = [1, 5, 25, 100];

  Casino.games.push({
    id: 'videopoker', name: 'Video Poker', tag: 'Machine · 9/6', icon: '👑', accent: '#3b82f6',
    blurb: 'Full-pay 9/6 Jacks or Better. Hold, draw, chase the royal.',
    rules: `<ul>
      <li>Full-pay 9/6 Jacks or Better (about 99.5% return with perfect play).</li>
      <li>Choose a coin value and 1–5 coins, then Deal. Click cards to hold them, then Draw.</li>
      <li>A pair of Jacks or better at least gets your bet back.</li>
      <li>A royal flush at 5 coins pays 4000 coins instead of 1250. Always bet max!</li>
      <li>Space deals or draws.</li></ul>`,
    mount({ table }) {
      let coins = store.get('vp_coins', 5), denom = store.get('vp_denom', 5), phase = 'idle', hand = [], held = [], deck = [], staked = 0;
      table.innerHTML = `<div class="vp">
        <div class="paytable"></div>
        <div class="hand5">${'<div class="slotc"><div class="held">HELD</div><div class="cardslot"></div></div>'.repeat(5)}</div>
        <div class="msg">Jacks or Better</div>
        <div class="row">
          <div class="denoms">${DENOMS.map(d => `<button class="btn ghost small" data-d="${d}">${fmt(d)}</button>`).join('')}</div>
          <div class="meter"><small>COINS</small><b class="coins"></b></div>
          <div class="meter"><small>BET</small><b class="bet"></b></div>
          <div class="meter"><small>WIN</small><b class="win">$0</b></div>
        </div>
        <div class="row"><button class="btn ghost one">Bet one</button><button class="btn max">Bet max</button><button class="btn red go">Deal</button></div>
      </div>`;
      const pt = $('.paytable', table), slots = $$('.slotc', table), msg = $('.msg', table), goBtn = $('.go', table);
      const back = { r: 'A', s: '♠' };
      slots.forEach((s, i) => { $('.cardslot', s).append(cardEl(back, true)); s.onclick = () => toggle(i); });

      function renderPay(winRow = -1) {
        pt.innerHTML = PAY.map(([n], r) => `<div class="nm ${r === winRow ? 'row-win' : ''}">${n}</div>` +
          [1, 2, 3, 4, 5].map(c => `<div class="${c === coins ? 'on' : ''} ${r === winRow ? 'row-win' : ''}">${payFor(r, c)}</div>`).join('')).join('');
      }
      function renderMeters() {
        $('.coins', table).textContent = coins; $('.bet', table).textContent = fmt(coins * denom);
        $$('.denoms .btn', table).forEach(b => b.classList.toggle('on', +b.dataset.d === denom));
        store.set('vp_coins', coins); store.set('vp_denom', denom);
      }
      $$('.denoms .btn', table).forEach(b => b.onclick = () => { if (phase !== 'idle') return; denom = +b.dataset.d; sfx.chip(); renderMeters(); });
      $('.one', table).onclick = () => { if (phase !== 'idle') return; coins = coins % 5 + 1; sfx.chip(); renderMeters(); renderPay(); };
      $('.max', table).onclick = () => { if (phase !== 'idle') return; coins = 5; renderMeters(); renderPay(); go(); };
      goBtn.onclick = go;
      renderPay(); renderMeters();

      function toggle(i) {
        if (phase !== 'hold') return;
        held[i] = !held[i]; $('.held', slots[i]).classList.toggle('on', held[i]); sfx.tick();
      }
      async function show(i, c) {
        const slot = $('.cardslot', slots[i]); slot.innerHTML = '';
        slot.append(cardEl(c)); sfx.card(); await sleep(110);
      }
      async function go() {
        if (phase === 'idle') {
          if (!Casino.take(coins * denom)) return;
          staked = coins * denom; phase = 'busy'; goBtn.disabled = true;
          deck = makeShoe(1); hand = deck.splice(0, 5); held = [false, false, false, false, false];
          $$('.held', table).forEach(e => e.classList.remove('on')); $('.win', table).textContent = '$0';
          renderPay();
          for (let i = 0; i < 5; i++) await show(i, hand[i]);
          const r = evalHand(hand);
          msg.textContent = r >= 0 ? PAY[r][0] + '!' : 'Click cards to hold, then Draw';
          renderPay(r);
          phase = 'hold'; goBtn.textContent = 'Draw'; goBtn.disabled = false;
        } else if (phase === 'hold') {
          phase = 'busy'; goBtn.disabled = true;
          for (let i = 0; i < 5; i++) if (!held[i]) { hand[i] = deck.pop(); $('.cardslot', slots[i]).firstChild.classList.add('down'); }
          await sleep(200);
          for (let i = 0; i < 5; i++) if (!held[i]) await show(i, hand[i]);
          const r = evalHand(hand), paid = r >= 0 ? payFor(r, coins) * denom : 0;
          renderPay(r); msg.textContent = r >= 0 ? PAY[r][0] : 'Game over';
          $('.win', table).textContent = fmt(paid);
          settle(paid, staked, r >= 0 ? PAY[r][0] : '');
          if (r === 0) coinShower(100);
          phase = 'idle'; goBtn.textContent = 'Deal'; goBtn.disabled = false;
        }
      }
      Casino.hotkey = go;
    },
  });
})();
