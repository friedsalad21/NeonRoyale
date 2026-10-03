'use strict';
// The slot machines. Pays are raw: line/ways pays are divided by `div` (credits per bet),
// scatter/bonus/collect values are already multiples of the bet. `k` scales every win and is
// tuned per machine with tools/slotsim.js so each one returns roughly 95%.
(function (G) {
  const M = G.SlotEngine.MACHINES;
  const P5 = (p3, p4, p5, p2 = 0) => [0, 0, p2, p3, p4, p5];
  const P6 = (p3, p4, p5, p6) => [0, 0, 0, p3, p4, p5, p6];
  const L10 = [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 0, 1, 2, 1]];
  const L20 = [...L10, [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 0, 2, 0, 0], [2, 2, 0, 2, 2], [0, 2, 0, 2, 0], [2, 0, 2, 0, 2]];
  const L3 = [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]];
  const royal = (s, c, w, pay) => ({ s, cls: 'royal', c, w, pay });
  const ranks = (w, pays, cols = ['#ff5a5a', '#ffb02e', '#4ade80', '#38bdf8', '#c084fc', '#f472b6']) =>
    ['A', 'K', 'Q', 'J', '10', '9'].slice(0, pays.length).map((s, i) => royal(s, cols[i], w[i], pays[i]));
  const vals = (pairs) => pairs.map(([v, w]) => ({ v, w }));
  const clusterPay = base => [0, 0, 0, 0, 0, ...[1, 1.5, 2, 2.5, 3.5, 5, 7, 10, 15, 20, 40].map(x => +(base * x).toFixed(2))];
  const infPay = base => [0, 0, 0, ...[1, 1.5, 2, 3, 4, 6, 8, 12, 16, 25].map(x => +(base * x).toFixed(2))];
  const BAR = n => `<i class="bars">${'<b>BAR</b>'.repeat(n)}</i>`;

  M.push({
    id: 'lucky7', k: 1, name: 'Lucky 7s Deluxe', cat: 'Video', tag: '10 lines · Progressive', art: '7️⃣💎⭐',
    blurb: 'The original. Wild stars, 10 lines and the progressive jackpot.',
    theme: { bg: 'linear-gradient(#6a1238,#2a0716)', frame: '#f7c948', acc: '#ff2e88', font: 'Limelight', cell: 'linear-gradient(#bbb,#fff 18%,#fff 82%,#bbb)' },
    cols: 5, rows: 3, eval: 'lines', lines: L10, div: 10, progressive: '7',
    syms: [
      { s: '🍒', w: 22, pay: P5(7, 22, 90) }, { s: '🍋', w: 20, pay: P5(7, 30, 110) }, { s: '🍊', w: 18, pay: P5(11, 37, 150) },
      { s: '🍇', w: 14, pay: P5(18, 55, 220) }, { s: '🍉', w: 10, pay: P5(30, 90, 370) }, { s: '🔔', w: 8, pay: P5(45, 150, 550) },
      { s: '💎', w: 5, pay: P5(75, 300, 1500) }, { s: '7', cls: 'seven', w: 3, pay: P5(150, 750, 5000) },
      { s: '⭐', w: 3, wild: true, pay: P5(200, 1000, 5000) },
    ],
    rules: ['⭐ is wild and substitutes for everything.', 'Five 7s on a line at the maximum bet wins the <b>progressive jackpot</b>.', '2% of every spin feeds the jackpot.'],
  });

  M.push({
    id: 'tripled', k: 0.4877, name: 'Triple Diamond', cat: 'Classic', tag: '3 reels · 1 line', art: '💎' + '7' + '💎',
    blurb: 'Old-school stepper. Diamonds are wild and triple your win, two of them pay ×9.',
    theme: { bg: 'linear-gradient(#1b2a4a,#070b18)', frame: '#cbd5e1', acc: '#60a5fa', font: 'Limelight', cell: 'linear-gradient(#cfd8e3,#fff 25%,#fff 75%,#cfd8e3)' },
    cols: 3, rows: 3, eval: 'classic', lines: [[1, 1, 1]], div: 1, gamble: true, groups: { bar: 5 },
    syms: [
      { s: '', blank: true, w: 28 },
      { s: BAR(1), cls: 'bar', group: 'bar', w: 12, pay: [0, 0, 0, 10] },
      { s: BAR(2), cls: 'bar', group: 'bar', w: 8, pay: [0, 0, 0, 25] },
      { s: BAR(3), cls: 'bar', group: 'bar', w: 5, pay: [0, 0, 0, 40] },
      { s: '7', cls: 'seven', w: 3, pay: [0, 0, 0, 100] },
      { s: '💎', wild: true, mult: 3, w: 2.2, pay: [0, 2, 10, 1199] },
    ],
    rules: ['Only the centre line pays.', '💎 is wild and multiplies: one diamond ×3, two ×9.', 'Any mix of BARs pays 5. Three diamonds pay 1199.', 'Gamble any win on red or black.'],
  });

  M.push({
    id: 'redhot', k: 0.5989, name: 'Red Hot Multiplier', cat: 'Classic', tag: '5 lines · Multiplier reel', art: '🔥🍒7',
    blurb: 'Three reels and a fourth multiplier reel that can turn any win ×10.',
    theme: { bg: 'radial-gradient(circle at 50% 0,#ff6a00,#7a0a0a 55%,#2a0000)', frame: '#ffb300', acc: '#ff3b3b', font: 'Bungee', cell: 'linear-gradient(#ffe7c2,#fff 30%,#fff 70%,#ffe7c2)' },
    cols: 4, rows: 3, eval: 'classic', evalCols: 3, multReel: 3, lines: L3, div: 5,
    syms: [
      { s: '', blank: true, w: 14, reels: [0, 1, 2] },
      { s: '🍒', anyPos: true, w: 10, reels: [0, 1, 2], pay: [0, 0, 2, 10] },
      { s: BAR(1), cls: 'bar', w: 8, reels: [0, 1, 2], pay: [0, 0, 0, 15] },
      { s: '🔔', w: 6, reels: [0, 1, 2], pay: [0, 0, 0, 25] },
      { s: '7', cls: 'seven', w: 3, reels: [0, 1, 2], pay: [0, 0, 0, 60] },
      { s: '🔥', wild: true, w: 2, reels: [0, 1, 2], pay: [0, 0, 0, 200] },
      { s: '×1', cls: 'mult', xmult: 1, w: 50, reels: [3] }, { s: '×2', cls: 'mult', xmult: 2, w: 20, reels: [3] },
      { s: '×3', cls: 'mult', xmult: 3, w: 10, reels: [3] }, { s: '×5', cls: 'mult', xmult: 5, w: 4, reels: [3] },
      { s: '×10', cls: 'mult', xmult: 10, w: 1, reels: [3] },
    ],
    rules: ['5 lines across the three left reels. 🔥 is wild.', 'Cherries pay anywhere on a line: 1, 2 or 3 of them.', 'The 4th reel multiplies every win on the spin by the number in its middle: up to ×10.'],
  });

  M.push({
    id: 'fruitie', k: 1.7446, name: 'Pub Fruitie', cat: 'Classic', tag: 'UK fruit machine · Holds & nudges', art: '🍋🔔🍒',
    blurb: 'A British pub fruit machine. Win holds and nudges, and use them well.',
    theme: { bg: 'linear-gradient(#0d3b2e,#04140f)', frame: '#22c55e', acc: '#fde047', font: 'Press Start 2P', cell: 'linear-gradient(#e6ffe6,#fff 30%,#fff 70%,#e6ffe6)' },
    mode: 'fruit', cols: 3, rows: 3, eval: 'classic', lines: [[1, 1, 1]], div: 1, gamble: true, nudgeP: .28, maxNudges: 3, holdP: .3,
    syms: [
      { s: '🍒', n: 4, anyPos: true, pay: [0, 0, 2, 8] }, { s: '🍋', n: 4, pay: [0, 0, 0, 5] }, { s: '🍊', n: 3, pay: [0, 0, 0, 8] },
      { s: '🍑', n: 3, pay: [0, 0, 0, 10] }, { s: '🍉', n: 2, pay: [0, 0, 0, 15] }, { s: '🔔', n: 2, pay: [0, 0, 0, 20] },
      { s: BAR(1), cls: 'bar', n: 1, pay: [0, 0, 0, 40] }, { s: '7', cls: 'seven', n: 1, pay: [0, 0, 0, 100] },
    ],
    rules: ['Real reel strips: each reel has 20 stops in a fixed order.', 'After a losing spin you may be awarded <b>NUDGES</b>: nudge a reel down one stop at a time to line up a win.', 'Sometimes <b>HOLDS</b> light up: hold reels you like and only the rest spin next time.', 'Two cherries on the line pay too. Gamble any win.'],
  });

  M.push({
    id: 'cosmic', k: 0.26, name: 'Cosmic Gems', cat: 'Video', tag: 'Win both ways · Expanding wilds', art: '🌟💠🔶',
    blurb: 'Expanding star wilds fill the reel and hand you a free respin. Pays both ways.',
    theme: { bg: 'radial-gradient(circle at 50% 20%,#3b1a7a,#0b0425 70%)', frame: '#a78bfa', acc: '#22d3ee', font: 'Orbitron', cell: 'radial-gradient(circle,#2a1460,#0d0628)' },
    cols: 5, rows: 3, eval: 'lines', lines: L10, bothWays: true, div: 10, expandWild: true,
    syms: [
      { s: '🔷', w: 20, pay: P5(5, 10, 25) }, { s: '🟢', w: 18, pay: P5(5, 10, 25) }, { s: '🔶', w: 16, pay: P5(7, 15, 40) },
      { s: '💜', w: 14, pay: P5(8, 20, 50) }, { s: '💠', w: 10, pay: P5(10, 25, 60) },
      { s: BAR(1), cls: 'bar', w: 6, pay: P5(25, 50, 250) }, { s: '7', cls: 'seven', w: 4, pay: P5(50, 120, 250) },
      { s: '🌟', wild: true, w: 3, reels: [1, 2, 3] },
    ],
    rules: ['Wins pay left-to-right <b>and</b> right-to-left on 10 lines.', '🌟 lands on reels 2–4, expands to fill the reel and holds while the rest respin. New stars give another respin (up to 3).'],
  });

  M.push({
    id: 'book', k: 1.1864, name: 'Book of the Pharaoh', cat: 'Video', tag: 'Expanding symbol free spins', art: '📖👑🦅',
    blurb: 'The book is wild and scatter. Free spins pick a symbol that expands over whole reels.',
    theme: { bg: 'linear-gradient(#7a5410,#2a1a04)', frame: '#f5c518', acc: '#22d3ee', font: 'Cinzel', cell: 'linear-gradient(#3a2a10,#1a1206)' },
    cols: 5, rows: 3, eval: 'lines', lines: L10, div: 10, gamble: true, scatterPays: true,
    fs: { need: 3, spins: 10, retrigger: 10, type: 'expanding' },
    syms: [
      ...ranks([16, 16, 18, 18, 20], [P5(5, 40, 150), P5(5, 40, 150), P5(5, 25, 100), P5(5, 25, 100), P5(5, 25, 100)], ['#e3b341', '#d4a017', '#c9a227', '#b8860b', '#a67c00']),
      { s: '🐍', w: 7, pay: P5(30, 100, 750, 5) }, { s: '🏺', w: 7, pay: P5(30, 100, 750, 5) },
      { s: '🦅', w: 4, pay: P5(40, 400, 2000, 5) }, { s: '👑', w: 2, pay: P5(100, 1000, 5000, 10) },
      { s: '📖', wild: true, scatter: true, w: 3.1, spay: [0, 0, 0, 2, 20, 200] },
    ],
    rules: ['📖 is both wild and scatter: 3, 4 or 5 anywhere pay 2×, 20× or 200× your bet and start <b>10 free spins</b>.', 'Before the free spins a special symbol is chosen. When it lands on enough reels it expands to fill them and pays on all 10 lines, even if the reels aren\'t next to each other.', 'High symbols pay for two in a row. Gamble any win.'],
  });

  M.push({
    id: 'avalanche', k: 1.2016, name: 'Gold Rush Avalanche', cat: 'Video', tag: 'Avalanche · ×15 multiplier', art: '🗿❓🦜',
    blurb: 'Winning stones explode and new ones tumble in. Each avalanche raises the multiplier.',
    theme: { bg: 'linear-gradient(#1f4d2b,#0a1f10)', frame: '#d6a84b', acc: '#86efac', font: 'Bungee', cell: 'linear-gradient(#6b5a3a,#3a2f1d)' },
    cols: 5, rows: 3, eval: 'lines', lines: L20, div: 20, cascade: { ladder: [1, 2, 3, 5], fsLadder: [3, 6, 9, 15] },
    fs: { need: 3, spins: 10, retrigger: 10, type: 'cascade' },
    syms: [
      { s: '🍄', w: 20, pay: P5(3, 10, 25) }, { s: '🌽', w: 18, pay: P5(4, 15, 35) }, { s: '🐸', w: 15, pay: P5(5, 20, 50) },
      { s: '🐍', w: 12, pay: P5(8, 30, 80) }, { s: '🦜', w: 9, pay: P5(12, 50, 150) }, { s: '🐆', w: 6, pay: P5(20, 100, 300) },
      { s: '🗿', w: 4, pay: P5(50, 200, 1000) }, { s: '❓', wild: true, w: 3, reels: [1, 2, 3, 4] },
      { s: '🗺️', scatter: true, w: 3.4, reels: [0, 1, 2] },
    ],
    rules: ['20 lines. Winning symbols explode and new ones fall in: an <b>avalanche</b>.', 'Each avalanche in a row raises the multiplier: ×1, ×2, ×3, ×5.', '3 🗺️ on reels 1–3 start <b>10 free falls</b> with multipliers ×3, ×6, ×9, ×15.'],
  });

  M.push({
    id: 'candy', k: 2.557, name: 'Sugar Rush Tumble', cat: 'Tumble', tag: 'Pay anywhere · Bombs ×100', art: '🍭🍬💣',
    blurb: '8+ matching sweets anywhere pay and tumble away. Free spins drop multiplier bombs.',
    theme: { bg: 'linear-gradient(#ff9ad5,#a855f7)', frame: '#fff', acc: '#ff2e88', font: 'Fredoka', cell: 'linear-gradient(#fff0fa,#ffd6f0)' },
    cols: 6, rows: 5, eval: 'anywhere', div: 1, cascade: {}, bombs: true, buy: 71,
    fs: { need: 4, spins: 10, retrigger: 5, type: 'tumble' }, scatterPays: true,
    syms: [
      { s: '🍌', w: 22, tiers: [[12, 2], [10, .75], [8, .25]] }, { s: '🍇', w: 20, tiers: [[12, 4], [10, .9], [8, .4]] },
      { s: '🍉', w: 18, tiers: [[12, 5], [10, 1], [8, .5]] }, { s: '🍑', w: 16, tiers: [[12, 8], [10, 1.2], [8, .8]] },
      { s: '🍎', w: 14, tiers: [[12, 10], [10, 1.5], [8, 1]] }, { s: '🧁', w: 11, tiers: [[12, 12], [10, 2], [8, 1.5]] },
      { s: '🍩', w: 9, tiers: [[12, 15], [10, 5], [8, 2]] }, { s: '🍫', w: 7, tiers: [[12, 25], [10, 10], [8, 2.5]] },
      { s: '🍬', w: 5, tiers: [[12, 50], [10, 25], [8, 10]] },
      { s: '🍭', scatter: true, w: 2.7, fw: 1.6, spay: [0, 0, 0, 0, 3, 5, 100] },
      { s: '💣', bomb: true, w: 0, fw: 2.5, fval: vals([[2, 30], [3, 20], [4, 14], [5, 10], [8, 6], [10, 5], [15, 3], [25, 2], [50, .8], [100, .3]]), valFmt: 'x' },
    ],
    rules: ['No lines: <b>8 or more</b> of a symbol anywhere pays. Winners tumble away and new sweets fall in.', '4+ 🍭 start <b>10 free spins</b> (3+ retrigger 5 more).', 'In free spins 💣 bombs land with ×2 to ×100. When a tumble sequence ends with a win, every bomb on screen adds up and multiplies it.'],
  });

  M.push({
    id: 'aliens', k: 3.9378, name: 'Alien Jelly Clusters', cat: 'Cluster', tag: 'Cluster pays · Alien invasion', art: '👽🟩🟪',
    blurb: 'Connect 5+ jellies to pop them. On dead spins the aliens may invade with wilds.',
    theme: { bg: 'radial-gradient(circle at 50% 0,#0f5132,#03140c 70%)', frame: '#4ade80', acc: '#a3e635', font: 'Orbitron', cell: 'rgba(0,0,0,.35)' },
    cols: 7, rows: 7, eval: 'cluster', minCluster: 5, div: 1, cascade: {}, alienDrop: .2,
    syms: [
      { s: '🟥', w: 18, pay: clusterPay(.2) }, { s: '🟧', w: 18, pay: clusterPay(.2) }, { s: '🟨', w: 17, pay: clusterPay(.25) },
      { s: '🟩', w: 16, pay: clusterPay(.3) }, { s: '🟦', w: 15, pay: clusterPay(.4) }, { s: '🟪', w: 13, pay: clusterPay(.5) },
      { s: '👾', w: 8, pay: clusterPay(1) }, { s: '👽', w: 5, pay: clusterPay(2) }, { s: '🌀', wild: true, w: .6 },
    ],
    rules: ['7×7 grid. Groups of <b>5 or more</b> touching identical symbols (up, down, left, right) pay and explode.', 'New symbols drop in and can form new clusters.', '🌀 is wild. After a spin with no win, aliens can invade and drop 3–6 wilds.'],
  });

  M.push({
    id: 'buffalo', k: 5.5925, name: 'Buffalo Stampede', cat: 'Ways', tag: '1024 ways · Sunset wilds ×3', art: '🐃🌅🦅',
    blurb: 'Stacked stampedes across 1024 ways. Free-spin sunset wilds multiply ×2 and ×3.',
    theme: { bg: 'linear-gradient(#ff8a00,#9a3412 50%,#2b0f04)', frame: '#fbbf24', acc: '#fde68a', font: 'Rye', cell: 'linear-gradient(#3b2414,#1f1209)' },
    cols: 5, rows: 4, eval: 'ways', div: 40, stack: .35,
    fs: { need: 3, spins: 8, extra: 7, retrigger: 5, type: 'wildmult' },
    syms: [
      ...ranks([14, 14, 15, 15, 16, 16], [P5(2, 5, 10), P5(2, 5, 10), P5(2, 5, 10), P5(2, 5, 10), P5(2, 5, 10), P5(2, 5, 10)], ['#fca5a5', '#fdba74', '#fde68a', '#bbf7d0', '#bae6fd', '#ddd6fe']),
      { s: '🦌', w: 9, pay: P5(5, 10, 20) }, { s: '🐆', w: 8, pay: P5(5, 15, 25) }, { s: '🐺', w: 7, pay: P5(10, 20, 30) },
      { s: '🦅', w: 6, pay: P5(10, 30, 40) }, { s: '🐃', w: 6, pay: P5(20, 40, 60) },
      { s: '🌅', wild: true, w: 3, reels: [1, 2, 3], fval: vals([[2, 3], [3, 1]]), valFmt: 'x' },
      { s: '🪙', scatter: true, w: 3.6 },
    ],
    rules: ['1024 ways: matching symbols on adjacent reels from the left pay, in any row.', 'Symbols land in stacks. 🌅 is wild on reels 2–4.', '3, 4, 5 🪙 start <b>8, 15, 22 free spins</b>. Sunset wilds carry ×2 or ×3, and multiple wilds multiply together.'],
  });

  M.push({
    id: 'dragonmega', k: 1.228, name: 'Dragon Megaways', cat: 'Megaways', tag: '117,649 ways · Unlimited multiplier', art: '🐲🧧🏮',
    blurb: 'Every spin reshapes the reels, up to 117,649 ways. Free-spin multiplier never resets.',
    theme: { bg: 'radial-gradient(circle at 50% 0,#b91c1c,#450a0a 60%,#1a0202)', frame: '#facc15', acc: '#fde047', font: 'Ma Shan Zheng', cell: 'linear-gradient(#5a0d0d,#2a0505)' },
    cols: 6, rows: 7, megaways: [2, 7], eval: 'ways', div: 20, cascade: { inc: true }, buy: 58,
    fs: { need: 4, spins: 12, extra: 5, retrigger: 5, type: 'cascade' },
    syms: [
      ...ranks([16, 16, 15, 15, 14], [P6(.5, 1, 2, 4), P6(.5, 1, 2, 4), P6(.5, 1, 2, 4), P6(.5, 1, 2, 4), P6(.5, 1, 2, 4)], ['#fde047', '#facc15', '#fbbf24', '#f59e0b', '#fcd34d']),
      { s: '🥟', w: 9, pay: P6(1, 2, 4, 8) }, { s: '🏮', w: 8, pay: P6(1, 3, 5, 10) }, { s: '🐟', w: 7, pay: P6(2, 4, 8, 15) },
      { s: '🏯', w: 5, pay: P6(3, 6, 12, 25) }, { s: '🐲', w: 4, pay: P6(5, 10, 25, 50) },
      { s: '☯️', wild: true, w: 2, reels: [1, 2, 3, 4] }, { s: '🧧', scatter: true, w: 2.4 },
    ],
    rules: ['<b>Megaways</b>: each reel shows 2–7 symbols per spin, so there are up to 117,649 ways to win.', 'Wins cascade away. In the base game each cascade adds +1 to the multiplier.', '4+ 🧧 start <b>12 free spins</b> (+5 per extra). The multiplier starts at ×1, rises with every cascade and <b>never resets</b>.'],
  });

  M.push({
    id: 'pearl', k: 1.2392, name: 'Pearl of the Deep', cat: 'Hold & Win', tag: 'Hold & Win · 4 jackpots', art: '🦪🐢🔱',
    blurb: 'Land 6 pearls to lock them for respins. Fill the screen for the GRAND.',
    theme: { bg: 'linear-gradient(#0e7490,#083344 60%,#021014)', frame: '#67e8f9', acc: '#f0abfc', font: 'Cinzel', cell: 'linear-gradient(#0c4a6e,#082f49)' },
    cols: 5, rows: 3, eval: 'lines', lines: L10, div: 10,
    holdwin: { need: 6, p: .09, grand: 2000 }, jackpots: { MINI: 20, MINOR: 50, MAJOR: 200, GRAND: 2000 },
    syms: [
      ...ranks([16, 16, 16, 17, 17], [P5(5, 15, 50), P5(5, 15, 50), P5(4, 12, 40), P5(4, 12, 40), P5(4, 12, 40)], ['#a5f3fc', '#67e8f9', '#5eead4', '#99f6e4', '#bae6fd']),
      { s: '🐚', w: 9, pay: P5(10, 30, 100) }, { s: '🦀', w: 8, pay: P5(10, 40, 125) }, { s: '🐙', w: 6, pay: P5(15, 50, 200) },
      { s: '🐢', w: 4, pay: P5(25, 100, 500) }, { s: '🔱', wild: true, w: 2.5, reels: [1, 2, 3, 4], pay: P5(50, 200, 1000) },
      { s: '🦪', coin: true, w: 15, val: vals([[1, 30], [2, 25], [3, 15], [5, 10], [8, 6], [10, 4], [15, 2], [20, 2], [50, .7], [200, .15]]), valFmt: '$', labels: { 20: 'MINI', 50: 'MINOR', 200: 'MAJOR' } },
      { s: '', blank: true, w: 0 },
    ],
    rules: ['10 lines. 🔱 is wild.', '🦪 pearls carry cash values or the MINI, MINOR and MAJOR jackpots. Land <b>6 or more</b> to start <b>Hold & Win</b>.', 'Pearls lock in place and you get 3 respins. Each new pearl resets them to 3.', 'Fill all 15 spots to win the <b>GRAND</b> (2000× bet) on top.'],
  });

  M.push({
    id: 'bass', k: 2.6367, name: 'Big Bass Catch', cat: 'Video', tag: 'Money collect · Fisherman', art: '🐟🎣🚤',
    blurb: 'Fish carry cash. In free spins the fisherman wild reels them all in.',
    theme: { bg: 'linear-gradient(#38bdf8,#0369a1 55%,#0c2d48)', frame: '#fde047', acc: '#4ade80', font: 'Bungee', cell: 'linear-gradient(#e0f2fe,#bae6fd)' },
    cols: 5, rows: 3, eval: 'lines', lines: L10, div: 10, buy: 143,
    fs: { need: 3, spins: 10, type: 'bass', levels: [1, 2, 3, 10] },
    syms: [
      ...ranks([16, 16, 17, 17, 18], [P5(5, 10, 50), P5(5, 10, 50), P5(5, 10, 50), P5(5, 10, 50), P5(5, 10, 50)], ['#0369a1', '#0e7490', '#15803d', '#a16207', '#b91c1c']),
      { s: '🧰', w: 7, pay: P5(20, 50, 200, 2) }, { s: '🦆', w: 6, pay: P5(30, 100, 300, 2) }, { s: '🪝', w: 5, pay: P5(30, 100, 300, 2) },
      { s: '🐟', fish: true, w: 6, fw: 9, pay: P5(5, 20, 100), val: vals([[2, 30], [5, 25], [10, 15], [15, 8], [20, 6], [25, 4], [50, 2], [250, .2]]), valFmt: '$' },
      { s: '🎣', wild: true, collector: true, w: 0, fw: 2.2, reels: [1, 2, 3, 4] },
      { s: '🚤', scatter: true, w: 2.9, fw: 0 },
    ],
    rules: ['10 lines. Every 🐟 shows a cash value.', '3+ 🚤 start <b>10 free spins</b>. In free spins 🎣 is wild and <b>collects every fish value</b> on screen.', 'Every 4th fisherman collected retriggers +10 spins and raises fish values to ×2, ×3, then ×10.'],
  });

  M.push({
    id: 'wheel', k: 1.4591, name: 'Wheel of Riches', cat: 'Bonus', tag: 'Wheel bonus · 1000×', art: '🎡💰🎩',
    blurb: 'Three wheel symbols spin the big wheel for up to 1000× your bet.',
    theme: { bg: 'radial-gradient(circle at 50% 0,#7e22ce,#3b0764 60%,#14021f)', frame: '#facc15', acc: '#f472b6', font: 'Limelight', cell: 'linear-gradient(#4c1d95,#2e1065)' },
    cols: 5, rows: 3, eval: 'lines', lines: L20, div: 20,
    bonus: { type: 'wheel', name: 'Wheel', segs: [10, 25, 15, 50, 20, 100, 10, 30, 15, 250, 20, 40, 10, 75, 25, 500, 15, 50, 20, 1000] },
    syms: [
      ...ranks([16, 16, 17, 17], [P5(5, 10, 40), P5(5, 10, 40), P5(4, 8, 30), P5(4, 8, 30)], ['#fde047', '#f9a8d4', '#c4b5fd', '#93c5fd']),
      { s: '💵', w: 9, pay: P5(10, 25, 80) }, { s: '🪙', w: 8, pay: P5(10, 30, 100) }, { s: '🎩', w: 6, pay: P5(15, 50, 200) },
      { s: '💰', w: 4, pay: P5(25, 100, 500) }, { s: '🌟', wild: true, w: 2.5, reels: [1, 2, 3, 4], pay: P5(50, 200, 1000) },
      { s: '🎡', bonus: true, w: 5.6, reels: [0, 2, 4] },
    ],
    rules: ['20 lines. 🌟 is wild.', '🎡 lands on reels 1, 3 and 5. All three spin the <b>Wheel of Riches</b> for 10× to 1000× your bet.'],
  });

  M.push({
    id: 'pirate', k: 1.6801, name: "Pirate's Plunder", cat: 'Bonus', tag: 'Pick-a-chest bonus', art: '🗺️☠️🦜',
    blurb: 'Find the map, then crack open treasure chests until you hit COLLECT.',
    theme: { bg: 'linear-gradient(#5b3a1e,#2a1a0d 60%,#120a04)', frame: '#d4a373', acc: '#fbbf24', font: 'Pirata One', cell: 'linear-gradient(#f5e6c8,#e3cc9c)' },
    cols: 5, rows: 3, eval: 'lines', lines: L20, div: 20,
    bonus: { type: 'pick', name: 'Treasure', prizes: [5, 5, 10, 10, 15, 20, 25, 50, 100, 'x2', 'COLLECT', 'COLLECT'] },
    syms: [
      ...ranks([16, 16, 17, 17, 18], [P5(5, 10, 40), P5(5, 10, 40), P5(4, 8, 30), P5(4, 8, 30), P5(4, 8, 30)], ['#7c2d12', '#9a3412', '#92400e', '#78350f', '#713f12']),
      { s: '⚓', w: 9, pay: P5(10, 25, 80) }, { s: '🍺', w: 8, pay: P5(10, 30, 100) }, { s: '🦑', w: 6, pay: P5(15, 50, 200) },
      { s: '🦜', w: 4, pay: P5(25, 100, 500) }, { s: '☠️', wild: true, w: 2.5, reels: [1, 2, 3, 4], pay: P5(50, 200, 1000) },
      { s: '🗺️', bonus: true, w: 2.9 },
    ],
    rules: ['20 lines. ☠️ is wild.', '3+ 🗺️ open the <b>treasure room</b>: pick chests to reveal cash (5× to 100×) or a ×2 that doubles your haul. Keep going until you find COLLECT.'],
  });

  M.push({
    id: 'walking', k: 1.2339, name: 'Wild West Walking Wilds', cat: 'Video', tag: 'Walking wild respins', art: '🤠🐎🌵',
    blurb: 'Every cowboy wild earns a respin and moseys one reel left each time.',
    theme: { bg: 'linear-gradient(#f59e0b,#b45309 50%,#451a03)', frame: '#fde68a', acc: '#fbbf24', font: 'Rye', cell: 'linear-gradient(#fef3c7,#fde68a)' },
    cols: 5, rows: 3, eval: 'lines', lines: L20, div: 20, walking: true,
    syms: [
      ...ranks([16, 16, 17, 17, 18], [P5(5, 10, 40), P5(5, 10, 40), P5(4, 8, 30), P5(4, 8, 30), P5(4, 8, 30)], ['#7c2d12', '#991b1b', '#854d0e', '#365314', '#1e3a8a']),
      { s: '🌵', w: 9, pay: P5(10, 25, 80) }, { s: '🥃', w: 8, pay: P5(10, 30, 100) }, { s: '💰', w: 6, pay: P5(15, 50, 200) },
      { s: '🐎', w: 4, pay: P5(25, 100, 500) }, { s: '🤠', wild: true, w: 2.2, pay: P5(50, 200, 1000) },
    ],
    rules: ['20 lines. 🤠 is wild.', 'Any wild triggers a <b>respin</b>: the wild walks one reel to the left and stays wild. Respins continue until every wild has walked off the reels.'],
  });

  M.push({
    id: 'masque', k: 6.8332, name: 'Midnight Masquerade', cat: 'Ways', tag: '243 ways · Mystery masks', art: '🎭🌹💍',
    blurb: 'Stacked masks unmask into the same symbol and can fill the screen.',
    theme: { bg: 'radial-gradient(circle at 50% 0,#6d28d9,#2e1065 55%,#0f0420)', frame: '#e9d5ff', acc: '#f0abfc', font: 'Cinzel', cell: 'linear-gradient(#1e0b3a,#0f0420)' },
    cols: 5, rows: 3, eval: 'ways', div: 25, stack: .25,
    syms: [
      ...ranks([16, 16, 17, 17, 18], [P5(2, 5, 15), P5(2, 5, 15), P5(1, 4, 12), P5(1, 4, 12), P5(1, 4, 12)], ['#f0abfc', '#e9d5ff', '#c4b5fd', '#a5b4fc', '#fbcfe8']),
      { s: '🕯️', w: 9, pay: P5(4, 10, 30) }, { s: '🍷', w: 8, pay: P5(5, 12, 40) }, { s: '🎻', w: 6, pay: P5(8, 20, 60) },
      { s: '🌹', w: 5, pay: P5(10, 30, 100) }, { s: '💍', w: 3, pay: P5(20, 60, 250) },
      { s: '🦚', wild: true, w: 2, reels: [1, 2, 3] }, { s: '🎭', mystery: true, w: 7 },
    ],
    rules: ['243 ways: matching symbols on adjacent reels from the left, any row.', '🎭 masks land stacked. After each spin <b>every mask reveals the same random symbol</b>.', '🦚 is wild on reels 2–4.'],
  });

  M.push({
    id: 'viking', k: 6.7587, name: 'Valhalla Sticky Wilds', cat: 'Video', tag: 'Sticky wild free spins', art: '🪓🛡️⚔️',
    blurb: 'In free spins every axe wild sticks until the very end.',
    theme: { bg: 'linear-gradient(#64748b,#1e293b 55%,#0b1120)', frame: '#cbd5e1', acc: '#7dd3fc', font: 'Uncial Antiqua', cell: 'linear-gradient(#334155,#1e293b)' },
    cols: 5, rows: 3, eval: 'lines', lines: L20, div: 20,
    fs: { need: 3, spins: 10, retrigger: 5, type: 'sticky' },
    syms: [
      ...ranks([16, 16, 17, 17, 18], [P5(5, 10, 40), P5(5, 10, 40), P5(4, 8, 30), P5(4, 8, 30), P5(4, 8, 30)], ['#e2e8f0', '#cbd5e1', '#bae6fd', '#7dd3fc', '#93c5fd']),
      { s: '🍺', w: 9, pay: P5(10, 25, 80) }, { s: '⛵', w: 8, pay: P5(10, 30, 100) }, { s: '🐺', w: 6, pay: P5(15, 50, 200) },
      { s: '⚔️', w: 4, pay: P5(25, 100, 500) }, { s: '🪓', wild: true, w: 2, fw: 1.3, reels: [1, 2, 3], pay: P5(50, 200, 1000) },
      { s: '🛡️', scatter: true, w: 3.0 },
    ],
    rules: ['20 lines. 🪓 is wild on reels 2–4.', '3+ 🛡️ start <b>10 free spins</b>. Every wild that lands <b>sticks</b> for the rest of the feature. 3 more shields add 5 spins.'],
  });

  M.push({
    id: 'neon', k: 0.4141, name: 'Neon Nights 1024', cat: 'Ways', tag: '1024 ways · Wild reel surges', art: '⚡🕶️🌴',
    blurb: 'Synthwave surges can flip whole reels wild at random.',
    theme: { bg: 'linear-gradient(#1e0533,#3b0764 40%,#831843)', frame: '#f0abfc', acc: '#22d3ee', font: 'Monoton', cell: 'linear-gradient(#170425,#2a0845)' },
    cols: 5, rows: 4, eval: 'ways', div: 50, wildReels: .07, surgeName: 'NEON SURGE',
    fs: { need: 3, spins: 8, retrigger: 4, type: 'surge' },
    syms: [
      { s: '🎹', w: 16, pay: P5(2, 4, 10) }, { s: '🛼', w: 15, pay: P5(2, 4, 10) }, { s: '🎧', w: 14, pay: P5(3, 6, 15) },
      { s: '🌴', w: 12, pay: P5(3, 8, 20) }, { s: '🏎️', w: 9, pay: P5(5, 12, 30) }, { s: '🕶️', w: 6, pay: P5(8, 20, 50) },
      { s: '🌆', w: 4, pay: P5(12, 30, 100) }, { s: '⚡', wild: true, w: 1, reels: [1, 2, 3, 4] }, { s: '📼', scatter: true, w: 1.8 },
    ],
    rules: ['1024 ways to win. ⚡ is wild.', '<b>Neon Surge</b>: any spin can turn 1–3 whole reels wild.', '3+ 📼 start <b>8 free spins</b> with a guaranteed surge on every spin.'],
  });

  M.push({
    id: 'leprechaun', k: 5.5936, name: "Leprechaun's Gold", cat: 'Video', tag: 'Climbing free-spin multiplier', art: '🌈🍀🎩',
    blurb: 'Chase the rainbow: every free spin adds +1 to the multiplier.',
    theme: { bg: 'linear-gradient(#15803d,#14532d 55%,#052e16)', frame: '#fde047', acc: '#86efac', font: 'Uncial Antiqua', cell: 'linear-gradient(#ecfccb,#d9f99d)' },
    cols: 5, rows: 3, eval: 'lines', lines: L20, div: 20,
    fs: { need: 3, spins: 10, retrigger: 5, type: 'mult+', mult: 1 },
    syms: [
      ...ranks([16, 16, 17, 17, 18], [P5(5, 10, 40), P5(5, 10, 40), P5(4, 8, 30), P5(4, 8, 30), P5(4, 8, 30)], ['#166534', '#15803d', '#a16207', '#854d0e', '#047857']),
      { s: '🍺', w: 9, pay: P5(10, 25, 80) }, { s: '🎻', w: 8, pay: P5(10, 30, 100) }, { s: '🎩', w: 6, pay: P5(15, 50, 200) },
      { s: '🪙', w: 4, pay: P5(25, 100, 500) }, { s: '🍀', wild: true, w: 2.3, reels: [1, 2, 3, 4], pay: P5(50, 200, 1000) },
      { s: '🌈', scatter: true, w: 3.0 },
    ],
    rules: ['20 lines. 🍀 is wild.', '3+ 🌈 start <b>10 free spins</b>. Spin 1 pays ×1, spin 2 ×2, spin 3 ×3 and so on. Retriggers keep climbing.'],
  });

  M.push({
    id: 'gummy', k: 5.1977, name: 'Gummy Galaxy', cat: 'Cluster', tag: 'Multiplier spots ×128', art: '🐻🍓🐛',
    blurb: 'Where clusters explode, spots light up and double, all the way to ×128.',
    theme: { bg: 'radial-gradient(circle at 50% 0,#f472b6,#7c3aed 55%,#1e1b4b)', frame: '#fbcfe8', acc: '#fde047', font: 'Fredoka', cell: 'rgba(255,255,255,.12)' },
    cols: 7, rows: 7, eval: 'cluster', minCluster: 5, div: 1, cascade: {}, spots: true, buy: 17,
    fs: { need: 3, spins: 10, retrigger: 5, type: 'spots' },
    syms: [
      { s: '🍋', w: 18, pay: clusterPay(.2) }, { s: '🫐', w: 18, pay: clusterPay(.2) }, { s: '🍑', w: 17, pay: clusterPay(.25) },
      { s: '🍓', w: 16, pay: clusterPay(.3) }, { s: '🍒', w: 14, pay: clusterPay(.4) }, { s: '🐛', w: 11, pay: clusterPay(.6) },
      { s: '🐻', w: 7, pay: clusterPay(1.5) }, { s: '🌠', scatter: true, w: .75 },
    ],
    rules: ['Clusters of 5+ touching symbols pay and explode.', 'Each spot that explodes is marked. Explode it again for ×2, then ×4, ×8, up to ×128. Spot multipliers in a cluster add up and multiply its win.', 'Spots reset after each spin. 3+ 🌠 start <b>10 free spins</b> where spots <b>stay for the whole feature</b>.'],
  });

  M.push({
    id: 'pachinko', k: 4.9494, name: 'Pachinko Panic', cat: 'Bonus', tag: 'Pachinko drop bonus', art: '⚪🏮🍣',
    blurb: 'Land the balls, then drop them through the pins into 100× pockets.',
    theme: { bg: 'linear-gradient(#e11d48,#7f1d1d 55%,#1c0508)', frame: '#fef08a', acc: '#38bdf8', font: 'Press Start 2P', cell: 'linear-gradient(#fff1f2,#ffe4e6)' },
    cols: 5, rows: 3, eval: 'lines', lines: L10, div: 10,
    bonus: { type: 'pachinko', name: 'Pachinko', balls: 3, slots: [100, 25, 10, 5, 3, 2, 3, 5, 10, 25, 100] },
    syms: [
      ...ranks([16, 16, 17, 17, 18], [P5(5, 10, 40), P5(5, 10, 40), P5(4, 8, 30), P5(4, 8, 30), P5(4, 8, 30)], ['#be123c', '#c2410c', '#0369a1', '#7e22ce', '#15803d']),
      { s: '🍙', w: 9, pay: P5(10, 25, 80) }, { s: '🍣', w: 8, pay: P5(10, 30, 100) }, { s: '🎏', w: 6, pay: P5(15, 50, 200) },
      { s: '👺', w: 4, pay: P5(25, 100, 500) }, { s: '🌸', wild: true, w: 2.5, reels: [1, 2, 3, 4], pay: P5(50, 200, 1000) },
      { s: '⚪', bonus: true, w: 3.0 },
    ],
    rules: ['10 lines. 🌸 is wild.', '3+ ⚪ start the <b>Pachinko</b> bonus: drop 3 balls (+1 per extra ⚪) through 10 rows of pins. Each pocket pays 2× to 100× your bet.'],
  });

  M.push({
    id: 'temple', k: 12.5515, name: 'Endless Temple', cat: 'Specialty', tag: 'Infinity reels', art: '🐒🪷🏺',
    blurb: 'Starts with 3 reels. Every win that reaches the end adds another reel, up to 12.',
    theme: { bg: 'linear-gradient(#365314,#1a2e05 60%,#0a1402)', frame: '#d9f99d', acc: '#fbbf24', font: 'Cinzel', cell: 'linear-gradient(#3f3f2a,#22220f)' },
    mode: 'infinity', cols: 3, rows: 3, maxCols: 12, eval: 'ways', div: 10,
    syms: [
      ...ranks([16, 16, 17, 17], [infPay(.3), infPay(.3), infPay(.25), infPay(.25)], ['#fde047', '#fbbf24', '#a3e635', '#4ade80']),
      { s: '🪷', w: 9, pay: infPay(.5) }, { s: '🏺', w: 7, pay: infPay(.8) }, { s: '🐘', w: 5, pay: infPay(1.2) },
      { s: '🐒', w: 3, pay: infPay(2) }, { s: '🔆', wild: true, w: 2.2, reels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    ],
    rules: ['<b>Infinity reels</b>: the game starts with 3 reels and pays ways from the left.', 'Whenever a win reaches the last reel, a new reel is added. Keep winning to grow to 12 reels.', 'Pays rise with every extra reel a symbol reaches. 🔆 is wild.'],
  });

  M.push({
    id: 'slingo', k: 1.1078, name: 'Slingo Royale', cat: 'Specialty', tag: 'Slots meets bingo', art: '🃏⭐🎯',
    blurb: 'Spin to mark numbers on a bingo card. Every completed line climbs the ladder.',
    theme: { bg: 'linear-gradient(#1d4ed8,#1e3a8a 55%,#0b1a45)', frame: '#facc15', acc: '#f472b6', font: 'Bungee', cell: '#fff' },
    mode: 'slingo', syms: [], spins: 10, pJoker: .07, pSuper: .02, pFree: .02, div: 1,
    ladder: [0, 0, 0, .5, 1, 2, 5, 10, 25, 50, 100, 250, 1000],
    rules: ['One bet buys a game of <b>10 spins</b> on a 5×5 bingo card.', 'Each spin shows 5 numbers, one for each column. Matching numbers are marked.', '🃏 Joker marks the best number in its column. ⭐ Super Joker marks the best number anywhere. +1 adds a spin.', 'Complete rows, columns and diagonals (12 Slingos) to climb the prize ladder, up to 1000× for a full house.'],
  });

  M.push({
    id: 'pachislo', k: 1.6017, name: 'Ninja Pachislo', cat: 'Specialty', tag: 'Stop the reels yourself', art: '7🔔🍉',
    blurb: 'Japanese pachislot: hit STOP on each reel. Line up 7-7-7 for the BIG BONUS.',
    theme: { bg: 'linear-gradient(#111827,#030712)', frame: '#ef4444', acc: '#facc15', font: 'Bungee', cell: 'linear-gradient(#fafafa,#e5e7eb)' },
    cols: 3, rows: 3, eval: 'lines', lines: L3, div: 5, manual: true,
    fs: { trigger: 'line', sym: '7', spins: 15, type: 'bigbonus' },
    syms: [
      { s: '🍒', w: 16, fw: 16, pay: [0, 0, 1, 3] }, { s: '🍉', w: 12, fw: 20, pay: [0, 0, 0, 10] }, { s: '🔔', w: 12, fw: 24, pay: [0, 0, 0, 12] },
      { s: '🍇', w: 10, fw: 12, pay: [0, 0, 0, 15] }, { s: BAR(1), cls: 'bar', w: 4, fw: 4, pay: [0, 0, 0, 40] },
      { s: '7', cls: 'seven', w: 3, fw: 2, pay: [0, 0, 0, 100] }, { s: '🥷', wild: true, w: 1.5, fw: 3 },
    ],
    rules: ['5 lines: three rows and two diagonals. 🥷 is wild.', 'Press <b>STOP</b> under each reel (or let them stop on their own).', 'Line up 7-7-7 for the <b>BIG BONUS</b>: 15 games with bells and melons everywhere.', 'Two cherries pay too.'],
  });

  M.forEach(G.SlotEngine.prep);
})(typeof window !== 'undefined' ? window : globalThis);
