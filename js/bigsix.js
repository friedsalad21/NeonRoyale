(() => {
  const TYPES = [
    { k: '1', label: '$1', n: 24, pay: 1, color: '#f7c948', fg: '#2a1600', off: 0 },
    { k: '2', label: '$2', n: 15, pay: 2, color: '#2563eb', off: 0 },
    { k: '5', label: '$5', n: 7, pay: 5, color: '#9333ea', off: 1 },
    { k: '10', label: '$10', n: 4, pay: 10, color: '#16a34a', off: 3 },
    { k: '20', label: '$20', n: 2, pay: 20, color: '#ea580c', off: 7 },
    { k: 'joker', label: '🃏', n: 1, pay: 40, color: '#111111', off: 27 },
    { k: 'logo', label: '★', n: 1, pay: 40, color: '#d4153a', off: 0 },
  ];
  // spread each type evenly round the 54 stops, rarest first
  const SEGS = Array(54).fill(null);
  for (const t of [...TYPES].reverse()) for (let j = 0; j < t.n; j++) {
    let p = Math.round((j + .5) * 54 / t.n + t.off) % 54;
    while (SEGS[p]) p = (p + 1) % 54;
    SEGS[p] = t;
  }
  function wheel(size) {
    const cv = h(`<canvas width="${size}" height="${size}"></canvas>`);
    drawWheel(cv, SEGS.map(t => ({ label: t.label, color: t.color, fg: t.fg })), { text: 20, rim: .82, hub: .28, radial: true });
    return cv;
  }

  Casino.games.push({
    id: 'bigsix', name: 'Big Six Wheel', tag: 'Wheel · 40:1', accent: '#06b6d4', art: () => wheel(264),
    blurb: 'Spin the money wheel. Land the Joker or the Star for 40 to 1.',
    rules: `<ul>
      <li>The wheel has 54 stops: 24 × $1, 15 × $2, 7 × $5, 4 × $10, 2 × $20, 1 Joker and 1 Star.</li>
      <li>Bet on any symbol. It pays its face value to 1: $1 pays 1:1, $20 pays 20:1. Joker and Star pay 40:1.</li>
      <li>Space spins.</li></ul>`,
    mount({ table, controls }) {
      table.innerHTML = `<div class="b6">
        <div class="wheelwrap"><div class="flapper"></div></div>
        <div class="b6bets">${TYPES.map(t => `<div style="--c:${t.color}">${t.label}<small>${t.pay} to 1</small></div>`).join('')}</div>
      </div>`;
      const cv = wheel(640); $('.wheelwrap', table).append(cv);
      const spin = spinner(cv, 54), boxes = $$('.b6bets>div', table);
      const info = h('<div class="info-line">Total bet <b>$0</b></div>');
      const bets = new Bets(() => $('b', info).textContent = fmt(bets.total));
      TYPES.forEach((t, i) => bets.bind(t.k, boxes[i]));
      const spinBtn = button('Spin', 'red', go);
      const btns = h('<div class="btns"></div>'); btns.append(...betButtons(bets), spinBtn);
      controls.append(chipRack(), info, btns);
      let busy = false;
      async function go() {
        if (busy) return;
        if (!bets.total) bets.rebet();
        if (!bets.total) { toast('Place a bet'); sfx.no(); return; }
        busy = true; spinBtn.disabled = true; bets.save(); bets.locked = true;
        boxes.forEach(b => b.classList.remove('hit'));
        const i = rnd(54), t = SEGS[i];
        await spin(i, 6000, 4);
        boxes[TYPES.indexOf(t)].classList.add('hit');
        const staked = bets.total, paid = (bets.m[t.k] || 0) * (t.pay + 1);
        bets.m = {}; bets.locked = false; busy = false; spinBtn.disabled = false; bets.render();
        settle(paid, staked, t.k === 'joker' ? 'Joker!' : t.k === 'logo' ? 'Star!' : t.label);
      }
      Casino.hotkey = go;
      return () => bets.clear();
    },
  });
})();
