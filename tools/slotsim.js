// RTP simulator for the slot machines. Runs each machine headless and prints its return,
// hit rate and the k that would bring it to the target. Usage:
//   node tools/slotsim.js [spins=200000] [machineId] [--buy]
const path = require('path');
require(path.join(__dirname, '../js/slots/engine.js'));
require(path.join(__dirname, '../js/slots/machines.js'));
const { SlotEngine } = globalThis;

const N = +process.argv[2] || 200000, only = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : null;
const buy = process.argv.includes('--buy'), TARGET = .955;

(async () => {
  for (const m of SlotEngine.MACHINES) {
    if (only && m.id !== only) continue;
    if (buy && !m.buy) continue;
    const t0 = Date.now(); let tot = 0, hits = 0, max = 0, feats = 0;
    const st = {};
    // count feature entries (free spins, bonus games, hold & win) to check how often they land
    let inHw = false;
    const B = new Proxy({}, { get: (_, p) => ['fsStart', 'wheel', 'pick', 'pachinko', 'hw'].includes(p) ? async (...a) => { if (p !== 'hw') feats++; else { if (a[0] && !inHw) feats++; inHw = !!a[0]; } return SlotEngine.stub[p](...a); } : SlotEngine.stub[p] });
    for (let i = 0; i < N; i++) {
      const w = await SlotEngine.play(m, B, { bet: 1, maxBet: 1, st, buy });
      tot += w; if (w > 0) hits++; if (w > max) max = w;
    }
    const rtp = tot / N / (buy ? m.buy : 1);
    console.log(`${m.id.padEnd(12)} rtp ${(rtp * 100).toFixed(2).padStart(7)}%  hit ${(hits / N * 100).toFixed(1).padStart(5)}%  feature 1/${feats ? Math.round(N / feats) : '-'}  max ${max.toFixed(0).padStart(6)}x  k=${m.k} -> ${(m.k * TARGET / rtp).toFixed(4)}  ${Date.now() - t0}ms`);
  }
})();
