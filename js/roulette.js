(() => {
  // 37 stands for the American 00 pocket
  const US_ORDER = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 37, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];
  const EU_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const col = n => n === 0 || n === 37 ? 'green' : REDS.has(n) ? 'red' : 'black';
  const HEX = { red: '#c8102e', black: '#151515', green: '#0a8a3a' };
  const lab = n => n === 37 ? '00' : n;
  function wheel(size, ORDER) {
    const cv = h(`<canvas width="${size}" height="${size}"></canvas>`);
    drawWheel(cv, ORDER.map(n => ({ label: lab(n), color: HEX[col(n)] })), { text: ORDER.length > 37 ? 22 : 24, rim: .86, hub: .55 });
    return cv;
  }
  // total returned per unit staked (stake included)
  function mult(k, n) {
    const [t, v] = k.split(':');
    if (t === 'n') return +v === n ? 36 : 0;
    if (n === 0 || n === 37) return 0;
    switch (t) {
      case 'dozen': return Math.ceil(n / 12) === +v ? 3 : 0;
      case 'col': return (n - 1) % 3 + 1 === +v ? 3 : 0;
      case 'red': case 'black': return col(n) === t ? 2 : 0;
      case 'odd': return n % 2 ? 2 : 0;
      case 'even': return n % 2 ? 0 : 2;
      case 'low': return n <= 18 ? 2 : 0;
      case 'high': return n > 18 ? 2 : 0;
    }
    return 0;
  }

  const rouletteGame = o => ({
    ...o, art: () => wheel(264, o.us ? US_ORDER : EU_ORDER),
    rules: `<ul>
      <li>${o.us ? 'American wheel with 0 and 00 (38 pockets, 5.26% house edge).' : 'European wheel with a single zero (37 pockets, 2.7% house edge).'}</li>
      <li>Straight up on a number pays 35:1. Dozens and columns (2 to 1) pay 2:1.</li>
      <li>Red/Black, Odd/Even, 1–18/19–36 pay 1:1. Zero${o.us ? ' and double zero lose' : ' loses'} all outside bets.</li>
      <li>Pick a chip and click the layout to bet. Right-click a spot to take chips back. Space spins.</li></ul>`,
    mount({ table, controls }) {
      const ORDER = o.us ? US_ORDER : EU_ORDER;
      table.innerHTML = `<div class="rl">
        <div><div class="wheelwrap"><div class="ballring"><div class="ball"></div></div><div class="rnum"></div></div>
          <div class="last"><span>Last numbers</span><div class="hist"></div></div></div>
        <div class="rtable-scroll"><div class="rtable"></div></div>
      </div>`;
      const grid = $('.rtable', table), cells = {}, info = h('<div class="info-line">Total bet <b>$0</b></div>');
      const bets = new Bets(() => { $('b', info).textContent = fmt(bets.total); });
      const cell = (key, html, cls, style) => { const d = h(`<div class="${cls}" style="${style}">${html}</div>`); grid.append(d); bets.bind(key, d); cells[key] = d; };
      if (o.us) {
        const z = h('<div class="zeros" style="grid-row:1/4;grid-column:1"></div>'); grid.append(z);
        [[0, '0'], [37, '00']].forEach(([n, t]) => { const d = h(`<div class="zero"><span>${t}</span></div>`); z.append(d); bets.bind('n:' + n, d); cells['n:' + n] = d; });
      } else cell('n:0', '<span>0</span>', 'zero', 'grid-row:1/4;grid-column:1');
      for (let c = 0; c < 12; c++) for (let r = 0; r < 3; r++) {
        const n = 3 * c + 3 - r; cell('n:' + n, `<span>${n}</span>`, 'num ' + col(n), `grid-row:${r + 1};grid-column:${c + 2}`);
      }
      for (let r = 0; r < 3; r++) cell('col:' + (3 - r), '2 to 1', 'out', `grid-row:${r + 1};grid-column:14`);
      ['1st 12', '2nd 12', '3rd 12'].forEach((t, i) => cell('dozen:' + (i + 1), t, 'out', `grid-row:4;grid-column:${2 + i * 4}/span 4`));
      [['low', '1–18'], ['even', 'EVEN'], ['red', '<i class="dia red-bg"></i>'], ['black', '<i class="dia black-bg"></i>'], ['odd', 'ODD'], ['high', '19–36']]
        .forEach(([k, t], i) => cell(k, t, 'out', `grid-row:5;grid-column:${2 + i * 2}/span 2`));

      const cv = wheel(560, ORDER), wrap = $('.wheelwrap', table), ballring = $('.ballring', table), rnum = $('.rnum', table);
      wrap.prepend(cv);
      const spin = spinner(cv, ORDER.length), spinBtn = button('Spin', 'red', go);
      const btns = h('<div class="btns"></div>'); btns.append(...betButtons(bets), spinBtn);
      controls.append(chipRack(), info, btns);

      const hk = o.us ? 'rlus_hist' : 'rl_hist'; let busy = false, hist = store.get(hk, []);
      const showHist = () => $('.hist', table).innerHTML = hist.map(n => `<i class="${col(n)}-bg">${lab(n)}</i>`).join('');
      showHist();

      async function go() {
        if (busy) return;
        if (!bets.total) bets.rebet();
        if (!bets.total) { toast('Place your bets'); sfx.no(); return; }
        busy = true; spinBtn.disabled = true; bets.save(); bets.locked = true;
        $$('.hit', grid).forEach(e => e.classList.remove('hit')); rnum.textContent = ''; rnum.className = 'rnum';
        const n = ORDER[rnd(ORDER.length)], ms = 5200;
        // the ball orbits the other way and settles at the top, where pocket n stops
        ballring.style.transition = 'none'; ballring.style.transform = 'rotate(0deg)'; void ballring.offsetWidth;
        ballring.style.transition = `transform ${ms}ms cubic-bezier(.2,.7,.25,1)`; ballring.style.transform = 'rotate(-1440deg)';
        await spin(ORDER.indexOf(n), ms, 6);
        sfx.card();
        rnum.textContent = lab(n); rnum.classList.add(col(n) + '-bg');
        cells['n:' + n].classList.add('hit');
        hist = [n, ...hist].slice(0, 14); store.set(hk, hist); showHist();
        const staked = bets.total; let paid = 0;
        for (const [k, v] of Object.entries(bets.m)) paid += v * mult(k, n);
        bets.m = {}; bets.locked = false; busy = false; spinBtn.disabled = false; bets.render();
        settle(paid, staked, `${lab(n)} ${col(n)}`);
      }
      Casino.hotkey = go;
      return () => bets.clear();
    },
  });
  Casino.games.push(rouletteGame({ id: 'roulette', name: 'Roulette', tag: 'Table · Single zero', accent: '#ef4444', blurb: 'European single-zero wheel. Straight up pays 35 to 1.' }));
  Casino.games.push(rouletteGame({ id: 'usroulette', name: 'American Roulette', tag: 'Table · 0 and 00', accent: '#b91c1c', us: true, blurb: 'The classic Vegas double-zero wheel with 38 pockets.' }));
})();
