'use strict';
// Slot engine: pure game logic, shared by the browser and the node RTP simulator (tools/slotsim.js).
// play(machine, board, ctx) drives a "board" (DOM in the browser, a no-op stub in the sim)
// and resolves to the total win in multiples of the bet.
(function (G) {
  const rand = () => Math.random();
  const ri = n => Math.floor(Math.random() * n);
  const key = (c, r) => c * 16 + r;
  const kc = k => [k >> 4, k & 15];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function wpick(arr, f) {
    let t = 0; arr.forEach((a, i) => t += f(a, i));
    let r = rand() * t;
    for (let i = 0; i < arr.length; i++) if ((r -= f(arr[i], i)) < 0) return i;
    return arr.length - 1;
  }
  const payAt = (a, n) => a && n < a.length ? a[n] || 0 : 0;
  const payClamp = (a, n) => a[Math.min(n, a.length - 1)] || 0;
  const U = (m, p) => p / m.div * m.k;
  const isSpecial = d => d.scatter || d.bonus;
  const newRes = () => ({ pay: 0, cells: new Set(), notes: [], syms: new Set() });
  const cellsOf = (g, pred) => { const out = []; g.forEach((col, c) => col.forEach((s, r) => { if (pred(s, c, r)) out.push(key(c, r)); })); return out; };

  // ---------- reels ----------
  const symW = (d, c, fs) => d.reels && !d.reels.includes(c) ? 0 : fs && d.fw != null ? d.fw : d.w || 0;
  const pickSym = (m, c, fs, noSpecial) => wpick(m.syms, d => noSpecial && isSpecial(d) ? 0 : symW(d, c, fs));
  function genCol(m, c, rows, fs) {
    const col = []; let sp = false;
    for (let r = 0; r < rows; r++) {
      const above = col[r - 1];
      const s = r && m.stack && rand() < m.stack && !isSpecial(m.syms[above]) ? above : pickSym(m, c, fs, sp);
      if (isSpecial(m.syms[s])) sp = true;
      col.push(s);
    }
    return col;
  }
  const rowsFor = m => m.megaways ? Array.from({ length: m.cols }, () => m.megaways[0] + ri(m.megaways[1] - m.megaways[0] + 1)) : null;
  const genGrid = (m, fs, rows) => Array.from({ length: m.cols }, (_, c) => genCol(m, c, rows ? rows[c] : m.rows, fs));
  const valFor = (m, s, fs) => { const d = m.syms[s], t = fs && d.fval || d.val; return t ? t[wpick(t, x => x.w)].v : 0; };
  const genVals = (m, g, fs) => g.map(col => col.map(s => valFor(m, s, fs)));
  function force(m, g, sym, n) { // bonus buy: drop n copies of sym on distinct reels
    shuffle([...g.keys()]).slice(0, n).forEach(c => { g[c][ri(g[c].length)] = sym; });
  }

  // ---------- evaluators (raw pays, before div/k) ----------
  function lineWin(m, g, vals, L, order) {
    const S = m.syms; let sym = -1, n = 0, wm = 1, wn = 0, lead = true;
    for (const c of order) {
      const s = g[c][L[c]], d = S[s];
      if (d.wild) { n++; wm *= vals?.[c]?.[L[c]] || d.mult || 1; if (lead) wn++; continue; }
      lead = false;
      if (!d.pay) break;
      if (sym < 0) sym = s; else if (s !== sym) break;
      n++;
    }
    let best = null;
    if (sym >= 0) { const p = payAt(S[sym].pay, n); if (p) best = { p: p * wm, n, sym }; }
    if (wn && m.wildIdx >= 0) { const p = payAt(S[m.wildIdx].pay, wn); if (p && (!best || p > best.p)) best = { p, n: wn, sym: m.wildIdx }; }
    return best;
  }
  function evalLines(m, g, vals) {
    const res = newRes(), C = m.evalCols || g.length, fwd = [...Array(C).keys()], back = [...fwd].reverse();
    m.lines.forEach((L, i) => {
      for (const order of m.bothWays ? [fwd, back] : [fwd]) {
        const w = lineWin(m, g, vals, L, order);
        if (!w || (order === back && w.n === C)) continue;
        res.pay += w.p; res.syms.add(w.sym);
        res.notes.push({ line: i + 1, sym: w.sym, n: w.n, p: w.p });
        for (let j = 0; j < w.n; j++) res.cells.add(key(order[j], L[order[j]]));
      }
    });
    return res;
  }
  function evalWays(m, g, vals) {
    const S = m.syms, res = newRes(), C = m.evalCols || g.length;
    S.forEach((d, s) => {
      if (d.wild || !d.pay || isSpecial(d)) return;
      let ways = 1, n = 0; const cells = [];
      for (let c = 0; c < C; c++) {
        let cnt = 0;
        g[c].forEach((x, r) => { const e = S[x]; if (x === s || e.wild) { cnt += e.wild ? vals?.[c]?.[r] || e.mult || 1 : 1; cells.push(key(c, r)); } });
        if (!cnt) break;
        ways *= cnt; n++;
      }
      const p = payAt(d.pay, n);
      if (p) { res.pay += p * ways; res.syms.add(s); res.notes.push({ sym: s, n, ways, p: p * ways }); cells.forEach(k => res.cells.add(k)); }
    });
    return res;
  }
  function evalClusters(m, g, spots) {
    const S = m.syms, res = newRes(), C = g.length, R = g[0].length, done = new Set();
    for (let c = 0; c < C; c++) for (let r = 0; r < R; r++) {
      const s = g[c][r], d = S[s];
      if (d.wild || !d.pay || done.has(key(c, r))) continue;
      const seen = new Set([key(c, r)]), q = [[c, r]];
      while (q.length) {
        const [x, y] = q.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, k = key(nx, ny);
          if (nx < 0 || ny < 0 || nx >= C || ny >= R || seen.has(k)) continue;
          const t = g[nx][ny];
          if (t === s || S[t].wild) { seen.add(k); q.push([nx, ny]); }
        }
      }
      seen.forEach(k => { const [x, y] = kc(k); if (g[x][y] === s) done.add(k); });
      if (seen.size < m.minCluster) continue;
      let mult = 0;
      if (spots) seen.forEach(k => { if (spots.get(k) > 1) mult += spots.get(k); });
      const p = payClamp(d.pay, seen.size) * (mult || 1);
      res.pay += p; res.syms.add(s); res.notes.push({ sym: s, n: seen.size, p, mult });
      seen.forEach(k => res.cells.add(k));
    }
    return res;
  }
  function evalAnywhere(m, g) {
    const S = m.syms, res = newRes(), at = new Map();
    g.forEach((col, c) => col.forEach((s, r) => { if (!at.has(s)) at.set(s, []); at.get(s).push(key(c, r)); }));
    for (const [s, cells] of at) {
      const t = S[s].tiers?.find(([min]) => cells.length >= min);
      if (!t) continue;
      res.pay += t[1]; res.syms.add(s); res.notes.push({ sym: s, n: cells.length, p: t[1] });
      cells.forEach(k => res.cells.add(k));
    }
    return res;
  }
  // 3-reel steppers: blanks, any-bar groups, cherries anywhere, multiplying wilds, optional multiplier reel
  function evalClassic(m, g) {
    const S = m.syms, res = newRes(), C = m.evalCols || g.length, W = m.wildIdx;
    m.lines.forEach((L, i) => {
      const ids = []; for (let c = 0; c < C; c++) ids.push(g[c][L[c]]);
      const non = ids.filter(s => !S[s].wild), nW = C - non.length;
      const wm = ids.reduce((a, s) => a * (S[s].wild ? S[s].mult || 1 : 1), 1);
      let best = 0, sym = -1;
      const take = (p, s) => { if (p > best) { best = p; sym = s; } };
      if (W >= 0 && nW) take(payAt(S[W].pay, nW), W);
      if (non.length && !S[non[0]].blank && non.every(s => s === non[0])) take(payAt(S[non[0]].pay, C) * wm, non[0]);
      const grp = non.length && S[non[0]].group;
      if (grp && non.every(s => S[s].group === grp)) take(m.groups[grp] * wm, non[0]);
      for (const s of new Set(non)) if (S[s].anyPos) take(payAt(S[s].pay, non.filter(x => x === s).length), s);
      if (!best) return;
      res.pay += best; res.syms.add(sym); res.notes.push({ line: i + 1, sym, n: C, p: best });
      for (let c = 0; c < C; c++) res.cells.add(key(c, L[c]));
    });
    if (m.multReel != null && res.pay) {
      const x = S[g[m.multReel][1]].xmult || 1;
      res.pay *= x; res.notes.push({ text: `Multiplier ×${x}` }); res.cells.add(key(m.multReel, 1));
    }
    return res;
  }
  function evaluate(m, g, vals, spots) {
    switch (m.eval) {
      case 'ways': return evalWays(m, g, vals);
      case 'cluster': return evalClusters(m, g, spots);
      case 'anywhere': return evalAnywhere(m, g);
      case 'classic': return evalClassic(m, g);
      default: return evalLines(m, g, vals);
    }
  }
  function tumble(m, g, vals, removed, fs) {
    g.forEach((col, c) => {
      const keep = col.map((s, r) => [s, vals[c][r]]).filter((_, r) => !removed.has(key(c, r)));
      const add = genCol(m, c, col.length - keep.length, fs).map(s => [s, valFor(m, s, fs)]);
      const all = [...add, ...keep];
      g[c] = all.map(x => x[0]); vals[c] = all.map(x => x[1]);
    });
  }
  const setCols = (g, ng) => ng.forEach((col, c) => { g[c] = col; });

  // ---------- one spin's wins, with per-spin features ----------
  async function settleSpin(m, B, g, vals, o) {
    const S = m.syms, W = m.wildIdx, st = o.state || {}, xm = o.mult || 1;
    let total = 0;
    if (m.mysteryIdx >= 0) {
      const cells = cellsOf(g, s => s === m.mysteryIdx);
      if (cells.length) {
        const t = wpick(S, (d, i) => i === m.mysteryIdx || isSpecial(d) || d.wild ? 0 : d.w || 0);
        cells.forEach(k => { const [c, r] = kc(k); g[c][r] = t; });
        await B.set(cells, t, 'Mystery reveal!');
      }
    }
    if (m.wildReels && ((o.fs && m.fs.type === 'surge') || rand() < m.wildReels)) {
      const reels = shuffle([...Array(g.length - 1).keys()].map(c => c + 1)).slice(0, [1, 1, 1, 2, 2, 3][ri(6)]);
      const cells = [];
      reels.forEach(c => g[c].forEach((_, r) => { g[c][r] = W; cells.push(key(c, r)); }));
      await B.set(cells, W, `${m.surgeName || 'WILD REELS'}!`);
    }
    if (m.expandWild) {
      const held = new Set();
      for (;;) {
        const fresh = []; g.forEach((col, c) => { if (!held.has(c) && col.includes(W)) fresh.push(c); });
        if (fresh.length) {
          const cells = [];
          fresh.forEach(c => { held.add(c); g[c] = g[c].map((_, r) => (cells.push(key(c, r)), W)); });
          await B.set(cells, W, 'Expanding wild!');
        }
        const res = evaluate(m, g, vals); o.last = res;
        const u = U(m, res.pay) * xm; total += u; await B.show(res.cells, u, res.notes);
        if (!fresh.length) break;
        await B.msg('WILD RESPIN!');
        g.forEach((_, c) => { if (!held.has(c)) { g[c] = genCol(m, c, m.rows, o.fs); vals[c] = g[c].map(s => valFor(m, s, o.fs)); } });
        await B.spin(g, { vals, hold: [...held] });
      }
      return total;
    }
    if (m.walking) {
      for (let i = 0; i < 25; i++) {
        const res = evaluate(m, g, vals); o.last = res;
        const u = U(m, res.pay) * xm; total += u; await B.show(res.cells, u, res.notes);
        const wilds = cellsOf(g, s => s === W).map(kc).map(([c, r]) => [c - 1, r]).filter(([c]) => c >= 0);
        if (!cellsOf(g, s => s === W).length) break;
        await B.msg(wilds.length ? 'Walking wild respin!' : 'Wild walks off the reels…');
        if (!wilds.length) break;
        setCols(g, genGrid(m, o.fs)); setCols(vals, genVals(m, g, o.fs));
        wilds.forEach(([c, r]) => { g[c][r] = W; });
        await B.spin(g, { vals });
      }
      return total;
    }
    if (m.cascade) {
      const cf = m.cascade, ladder = o.fs ? cf.fsLadder : cf.ladder;
      const spots = m.spots ? (o.fs ? (st.spots ??= new Map()) : new Map()) : null;
      const run = async () => {
        let seq = 0;
        for (let step = 0; step < 60; step++) {
          const res = evaluate(m, g, vals, spots); o.last = res;
          if (!res.pay) break;
          const mult = ladder ? ladder[Math.min(step, ladder.length - 1)] : cf.inc ? (o.fs ? st.mult : 1 + step) : 1;
          const u = U(m, res.pay) * mult * xm; seq += u;
          await B.show(res.cells, u, res.notes, mult > 1 ? mult : 0);
          if (spots) { res.cells.forEach(k => spots.set(k, spots.has(k) ? Math.min(spots.get(k) * 2, 128) : 1)); }
          const old = g.map(col => [...col]);
          tumble(m, g, vals, res.cells, o.fs);
          await B.cascade(old, res.cells, g, vals, spots);
          if (cf.inc && o.fs) st.mult++;
        }
        return seq;
      };
      let seq = await run();
      if (!seq && m.alienDrop && rand() < m.alienDrop) {
        const cells = shuffle(cellsOf(g, () => true)).slice(0, 3 + ri(4));
        cells.forEach(k => { const [c, r] = kc(k); g[c][r] = W; });
        await B.set(cells, W, 'ALIEN INVASION!');
        seq = await run();
      }
      if (seq && m.bombs && o.fs) {
        const b = cellsOf(g, s => S[s].bomb).reduce((a, k) => { const [c, r] = kc(k); return a + vals[c][r]; }, 0);
        if (b) { const add = seq * (b - 1); await B.show(new Set(cellsOf(g, s => S[s].bomb)), add, [{ text: `Bombs ×${b}` }]); seq *= b; }
      }
      return seq;
    }
    const res = evaluate(m, g, vals); o.last = res;
    if (m.progressive != null && o.ctx && o.ctx.bet >= o.ctx.maxBet && res.notes.some(n => n.sym === m.progressive && n.n === m.cols)) o.ctx.jackpot = true;
    const u = U(m, res.pay) * xm; total += u;
    await B.show(res.cells, u, res.notes, xm > 1 ? xm : 0);
    return total;
  }

  async function scatterPay(m, B, g) {
    const sc = cellsOf(g, s => s === m.scatterIdx), p = payAt(m.syms[m.scatterIdx].spay, sc.length);
    if (!p) return 0;
    const u = p * m.k; await B.show(new Set(sc), u, [{ sym: m.scatterIdx, n: sc.length, p, text: 'Scatter win' }]);
    return u;
  }

  // ---------- free spins ----------
  async function freeSpins(m, B, ctx, nSc) {
    const F = m.fs, S = m.syms, st = { mult: F.mult || 1, sticky: new Set(), spots: null, fish: 0, lvl: 0 };
    let left = F.spins + Math.max(0, nSc - F.need) * (F.extra || 0), done = 0, total = 0;
    const special = F.type === 'expanding' ? wpick(S, d => d.wild || isSpecial(d) || !d.pay ? 0 : 1) : -1;
    await B.fsStart(left, F, special);
    while (left > 0 && done < 300) {
      left--; done++;
      if (F.type === 'mult+') st.mult = (F.mult || 1) + done - 1;
      await B.fsHud(done, done + left, F.type === 'bass' ? F.levels[st.lvl] : st.mult);
      const g = genGrid(m, true, rowsFor(m)), vals = genVals(m, g, true);
      if (F.type === 'sticky') st.sticky.forEach(k => { const [c, r] = kc(k); g[c][r] = m.wildIdx; });
      await B.spin(g, { vals, manual: m.manual, sticky: st.sticky });
      if (F.type === 'sticky') cellsOf(g, s => s === m.wildIdx).forEach(k => st.sticky.add(k));
      const o = { fs: true, state: st, ctx, mult: F.type === 'mult+' ? st.mult : 1 };
      let w = await settleSpin(m, B, g, vals, o);
      if (m.scatterPays) w += await scatterPay(m, B, g);
      if (special >= 0) w += await expandSpecial(m, B, g, special);
      if (F.type === 'bass') {
        const col = cellsOf(g, s => S[s].collector), fish = cellsOf(g, s => S[s].fish);
        if (col.length && fish.length) {
          const sum = fish.reduce((a, k) => { const [c, r] = kc(k); return a + vals[c][r]; }, 0);
          const u = sum * col.length * F.levels[st.lvl] * m.k; w += u;
          await B.show(new Set([...col, ...fish]), u, [{ text: `Fisherman reels in ${col.length > 1 ? `×${col.length} ` : ''}the catch!` }]);
        }
        st.fish += col.length;
        while (st.fish >= 4 && st.lvl < F.levels.length - 1) {
          st.fish -= 4; st.lvl++; left += 10;
          await B.banner('+10 FREE SPINS', `Fish values ×${F.levels[st.lvl]}`);
        }
      }
      total += w;
      if (F.retrigger && cellsOf(g, s => s === m.scatterIdx).length >= F.need) { left += F.retrigger; await B.banner(`+${F.retrigger} FREE SPINS`); }
    }
    await B.fsEnd(total);
    return total;
  }
  async function expandSpecial(m, B, g, sp) {
    const reels = []; g.forEach((col, c) => { if (col.includes(sp)) reels.push(c); });
    const p = payAt(m.syms[sp].pay, reels.length);
    if (!p) return 0;
    const cells = []; reels.forEach(c => g[c].forEach((_, r) => { g[c][r] = sp; cells.push(key(c, r)); }));
    await B.set(cells, sp, 'Symbol expands!');
    const u = U(m, p * m.lines.length);
    await B.show(new Set(cells), u, [{ sym: sp, n: reels.length, p: p * m.lines.length, text: 'Expanded on every line' }]);
    return u;
  }

  // ---------- bonus games ----------
  async function holdAndWin(m, B, g, vals) {
    const H = m.holdwin, S = m.syms, C = g.length, R = g[0].length, coin = S.findIndex(d => d.coin);
    const locked = new Map();
    cellsOf(g, s => S[s].coin).forEach(k => { const [c, r] = kc(k); locked.set(k, vals[c][r]); });
    cellsOf(g, s => !S[s].coin).forEach(k => { const [c, r] = kc(k); g[c][r] = H.blank; vals[c][r] = 0; }); // clear the board around the pearls
    let respins = 3;
    await B.banner('HOLD & WIN', `${locked.size} locked · 3 respins`);
    await B.hw(locked, respins);
    while (respins > 0 && locked.size < C * R) {
      respins--;
      let got = false;
      for (let c = 0; c < C; c++) for (let r = 0; r < R; r++) {
        if (locked.has(key(c, r))) continue;
        if (rand() < H.p) { g[c][r] = coin; vals[c][r] = valFor(m, coin, true); got = true; } else { g[c][r] = H.blank; vals[c][r] = 0; }
      }
      await B.spin(g, { vals, holdCells: new Set(locked.keys()) });
      cellsOf(g, s => s === coin).forEach(k => { if (!locked.has(k)) { const [c, r] = kc(k); locked.set(k, vals[c][r]); } });
      if (got) respins = 3;
      await B.hw(locked, respins);
    }
    let sum = 0; locked.forEach(v => sum += v);
    if (locked.size === C * R) { sum += H.grand; await B.banner('GRAND JACKPOT!', 'Every spot filled'); }
    const u = sum * m.k;
    await B.show(new Set(locked.keys()), u, [{ text: 'Hold & Win total' }]);
    await B.hw(null, 0);
    return u;
  }
  async function bonusGame(m, B, n) {
    const b = m.bonus; let u = 0;
    if (b.type === 'wheel') {
      const i = ri(b.segs.length); await B.wheel(b.segs, i); u = b.segs[i] * m.k;
    } else if (b.type === 'pick') {
      const got = await B.pick(shuffle([...b.prizes])); // the first chest is never COLLECT
      let t = 0, x = 1; for (const p of got) { if (p === 'x2') x *= 2; else if (typeof p === 'number') t += p; }
      u = t * x * m.k;
    } else if (b.type === 'pachinko') {
      const paths = Array.from({ length: b.balls + n - 3 }, () => Array.from({ length: b.slots.length - 1 }, () => ri(2)));
      await B.pachinko(b.slots, paths);
      u = paths.reduce((a, p) => a + b.slots[p.reduce((x, y) => x + y, 0)], 0) * m.k;
    }
    await B.show(new Set(), u, [{ text: `${b.name} bonus` }]);
    return u;
  }

  // ---------- modes ----------
  async function afterSpin(m, B, ctx, g, vals, o) {
    let t = 0;
    const nSc = m.scatterIdx >= 0 ? cellsOf(g, s => s === m.scatterIdx).length : 0;
    if (m.scatterPays) t += await scatterPay(m, B, g);
    if (m.fs && (m.fs.trigger === 'line' ? o.last?.syms.has(m.fs.sym) : nSc >= m.fs.need)) t += await freeSpins(m, B, ctx, nSc);
    if (m.bonus) { const n = cellsOf(g, s => s === m.bonusIdx).length; if (n >= 3) t += await bonusGame(m, B, n); }
    if (m.holdwin && cellsOf(g, s => m.syms[s].coin).length >= m.holdwin.need) t += await holdAndWin(m, B, g, vals);
    return t;
  }
  async function video(m, B, ctx) {
    const g = genGrid(m, false, rowsFor(m)), vals = genVals(m, g, false);
    if (ctx.buy) force(m, g, m.scatterIdx, m.fs.need);
    await B.spin(g, { vals, manual: m.manual });
    const o = { ctx };
    const w = await settleSpin(m, B, g, vals, o);
    return w + await afterSpin(m, B, ctx, g, vals, o);
  }
  async function infinity(m, B) {
    const g = genGrid(m, false);
    await B.spin(g, {});
    let res;
    for (;;) {
      res = evalWays(m, g);
      if (!res.notes.some(n => n.n === g.length) || g.length >= m.maxCols) break;
      g.push(genCol(m, g.length, m.rows, false));
      await B.addReel(g);
    }
    const u = U(m, res.pay); await B.show(res.cells, u, res.notes);
    return u;
  }
  // UK fruit machine: real reel strips, holds and nudges
  async function fruit(m, B, ctx) {
    const st = ctx.st, len = c => m.strips[c].length;
    st.pos ??= m.strips.map((_, c) => ri(len(c)));
    const holds = st.holdNext && ctx.holds ? ctx.holds : [false, false, false];
    st.holdNext = false;
    st.pos = st.pos.map((p, c) => holds[c] ? p : ri(len(c)));
    const view = () => st.pos.map((p, c) => [-1, 0, 1].map(d => m.strips[c][(p + d + len(c)) % len(c)]));
    let g = view();
    await B.spin(g, { hold: holds.flatMap((h, c) => h ? [c] : []) });
    let res = evalClassic(m, g);
    if (!res.pay && rand() < m.nudgeP) {
      let n = 1 + ri(m.maxNudges);
      await B.msg(`${n} NUDGE${n > 1 ? 'S' : ''}!`);
      while (n > 0) {
        const c = await B.askNudge(n, g);
        if (c < 0) break;
        st.pos[c] = (st.pos[c] - 1 + len(c)) % len(c); n--;
        g = view(); await B.nudge(c, g);
        res = evalClassic(m, g);
        if (res.pay) break;
      }
      await B.askNudge(0, g);
    }
    const u = U(m, res.pay);
    await B.show(res.cells, u, res.notes);
    if (!res.pay && rand() < m.holdP) { st.holdNext = true; await B.offerHolds(); }
    return u;
  }
  // Slingo: 5x5 bingo card, 5 number reels, jokers
  async function slingo(m, B) {
    const card = Array.from({ length: 5 }, (_, c) => shuffle(Array.from({ length: 15 }, (_, i) => c * 15 + i + 1)).slice(0, 5));
    const marked = new Set(), LINES = [];
    for (let i = 0; i < 5; i++) { LINES.push([0, 1, 2, 3, 4].map(j => key(i, j)), [0, 1, 2, 3, 4].map(j => key(j, i))); }
    LINES.push([0, 1, 2, 3, 4].map(j => key(j, j)), [0, 1, 2, 3, 4].map(j => key(j, 4 - j)));
    const count = () => LINES.filter(L => L.every(k => marked.has(k))).length;
    const best = cands => { let bk = -1, bs = -1; for (const k of cands) { if (marked.has(k)) continue; const s = LINES.reduce((a, L) => L.includes(k) ? a + L.filter(x => marked.has(x)).length ** 2 + 1 : a, 0); if (s > bs) { bs = s; bk = k; } } return bk; };
    let spins = m.spins, sl = 0;
    await B.slingoStart(card);
    for (let i = 0; i < spins && marked.size < 25; i++) {
      const outs = Array.from({ length: 5 }, (_, c) => { const r = rand(); return r < m.pSuper ? 'SJ' : r < m.pSuper + m.pJoker ? 'J' : r < m.pSuper + m.pJoker + m.pFree ? 'FS' : c * 15 + 1 + ri(15); });
      await B.slingoSpin(outs, i + 1, spins);
      const hits = [];
      outs.forEach((o, c) => {
        if (typeof o === 'number') { const r = card[c].indexOf(o); if (r >= 0 && !marked.has(key(c, r))) { marked.add(key(c, r)); hits.push(key(c, r)); } }
      });
      for (const [c, o] of outs.entries()) {
        if (o === 'FS') spins++;
        const k = o === 'J' ? best([0, 1, 2, 3, 4].map(r => key(c, r))) : o === 'SJ' ? best([...Array(25).keys()].map(i => key(i % 5, Math.floor(i / 5)))) : -1;
        if (k >= 0) { marked.add(k); hits.push(k); }
      }
      sl = count();
      await B.slingoMark(hits, sl, m.ladder[sl] * m.k, spins);
    }
    const u = m.ladder[sl] * m.k;
    await B.show(new Set(), u, [{ text: `${sl} Slingo${sl === 1 ? '' : 's'}` }]);
    return u;
  }

  const MODES = { video, infinity, fruit, slingo };
  const play = (m, B, ctx) => MODES[m.mode || 'video'](m, B, ctx);

  function prep(m) {
    m.div ??= 1; m.k ??= 1;
    const find = f => m.syms.findIndex(f);
    m.wildIdx = find(d => d.wild); m.scatterIdx = find(d => d.scatter); m.bonusIdx = find(d => d.bonus); m.mysteryIdx = find(d => d.mystery);
    if (m.fs?.trigger === 'line' && typeof m.fs.sym === 'string') m.fs.sym = find(d => d.s === m.fs.sym);
    if (typeof m.progressive === 'string') m.progressive = find(d => d.s === m.progressive);
    if (m.mode === 'fruit') m.strips = [0, 1, 2].map(() => shuffle(m.syms.flatMap((d, i) => Array(d.n || 0).fill(i))));
    if (m.holdwin) m.holdwin.blank = find(d => d.blank);
    return m;
  }

  // Board stand-in for the simulator: every animation resolves instantly; choices are random.
  const stub = new Proxy({}, {
    get: (_, p) => p === 'pick' ? async prizes => { const out = []; if (prizes[0] === 'COLLECT') { const j = prizes.findIndex(x => x !== 'COLLECT'); [prizes[0], prizes[j]] = [prizes[j], prizes[0]]; } for (const x of prizes) { out.push(x); if (x === 'COLLECT') break; } return out; }
      : p === 'askNudge' ? async n => n ? ri(3) : -1
      : async () => {},
  });

  G.SlotEngine = { play, prep, stub, payAt, payClamp, key, kc, shuffle, MACHINES: [] };
})(typeof window !== 'undefined' ? window : globalThis);
