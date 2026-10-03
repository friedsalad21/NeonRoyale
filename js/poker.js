// Poker hand ranking shared by the poker tables. Scores are arrays compared left to right: [category, ...tiebreaks].
const Poker = (() => {
  const v = c => { const i = RANKS.indexOf(c.r); return i ? i + 1 : 14; }; // ace high
  const CAT = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush', 'Royal flush', 'Five aces'];
  const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };
  function eval5(cs) {
    const vals = cs.map(v).sort((a, b) => b - a), flush = cs.every(c => c.s === cs[0].s);
    let st = 0;
    if (new Set(vals).size === 5) { if (vals[0] - vals[4] === 4) st = vals[0]; else if (vals.join() === '14,5,4,3,2') st = 5; }
    const cnt = {}; vals.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
    const g = Object.entries(cnt).map(([k, n]) => [n, +k]).sort((a, b) => b[0] - a[0] || b[1] - a[1]), ord = g.map(x => x[1]);
    if (st && flush) return [st === 14 ? 9 : 8, st];
    if (g[0][0] === 4) return [7, ...ord];
    if (g[0][0] === 3 && g[1][0] === 2) return [6, ...ord];
    if (flush) return [5, ...vals];
    if (st) return [4, st];
    if (g[0][0] === 3) return [3, ...ord];
    if (g[0][0] === 2 && g[1][0] === 2) return [2, ...ord];
    if (g[0][0] === 2) return [1, ...ord];
    return [0, ...vals];
  }
  function combos(a, k, start = 0, cur = [], out = []) {
    if (cur.length === k) { out.push([...cur]); return out; }
    for (let i = start; i < a.length; i++) { cur.push(a[i]); combos(a, k, i + 1, cur, out); cur.pop(); }
    return out;
  }
  function best(cards) {
    let bs = null, bh = null;
    for (const hnd of combos(cards, 5)) { const s = eval5(hnd); if (!bs || cmp(s, bs) > 0) { bs = s; bh = hnd; } }
    return { score: bs, cards: bh, name: CAT[bs[0]] };
  }
  // three-card poker: straight beats flush
  function eval3(cs) {
    const vals = cs.map(v).sort((a, b) => b - a), flush = cs.every(c => c.s === cs[0].s);
    let st = 0; if (new Set(vals).size === 3) { if (vals[0] - vals[2] === 2) st = vals[0]; else if (vals.join() === '14,3,2') st = 3; }
    if (st && flush) return [5, st];
    if (vals[0] === vals[2]) return [4, vals[0]];
    if (st) return [3, st];
    if (flush) return [2, ...vals];
    if (vals[0] === vals[1]) return [1, vals[0], vals[2]];
    if (vals[1] === vals[2]) return [1, vals[1], vals[0]];
    return [0, ...vals];
  }
  const CAT3 = ['High card', 'Pair', 'Flush', 'Straight', 'Three of a kind', 'Straight flush'];
  // Pai Gow joker: counts as an ace, or completes a straight / flush
  const ALL = SUITS.flatMap(s => RANKS.map(r => ({ r, s })));
  function evalJ5(cs) {
    const j = cs.findIndex(c => c.r === 'JK'); if (j < 0) return eval5(cs);
    const rest = cs.filter((_, i) => i !== j);
    if (rest.filter(c => c.r === 'A').length === 4) return [10];
    let b = null;
    for (const c of ALL) {
      const s = eval5([...rest, c]);
      if (c.r !== 'A' && ![4, 5, 8, 9].includes(s[0])) continue;
      if (!b || cmp(s, b) > 0) b = s;
    }
    return b;
  }
  const eval2 = cs => { const vs = cs.map(c => c.r === 'JK' ? 14 : v(c)).sort((a, b) => b - a); return vs[0] === vs[1] ? [1, vs[0]] : [0, ...vs]; };
  return { v, eval5, eval3, best, cmp, combos, CAT, CAT3, evalJ5, eval2 };
})();
