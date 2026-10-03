// Shared slot jackpots. Every slot spin puts 4% of the bet into four progressive pots.
// MINI, MINOR and MAJOR are "must drop by" jackpots: each hides a random drop point between its seed and its cap,
// and whichever contribution pushes the pot past that point wins it. GRAND has no cap: five 7s on Lucky 7s at
// max bet wins it, and any slot spin has a tiny chance (scaled by the bet) to hit it.
// A simulated network of other players also feeds the pots, and sometimes wins them, while the casino is open.
const Jackpots = (() => {
  const TIERS = [
    { k: 'mini', name: 'MINI', seed: 20, cap: 50, share: .015, color: '#22c55e' },
    { k: 'minor', name: 'MINOR', seed: 100, cap: 250, share: .01, color: '#38bdf8' },
    { k: 'major', name: 'MAJOR', seed: 1000, cap: 2500, share: .01, color: '#c084fc' },
    { k: 'grand', name: 'GRAND', seed: 25000, cap: 0, share: .005, color: '#fbbf24' },
  ];
  const NETWORK = 3; // simulated other players' slot wagers, $ per second
  const r4 = n => Math.round(n * 1e4) / 1e4;
  const fresh = t => ({ v: t.seed, hit: t.cap ? r4(t.seed + Math.random() * (t.cap - t.seed)) : 0 });
  let s = store.get('jackpots', null);
  if (!s || TIERS.some(t => !s[t.k])) { s = {}; TIERS.forEach(t => s[t.k] = fresh(t)); }
  const save = () => store.set('jackpots', s);
  function feed(amount) {
    const won = [];
    for (const t of TIERS) {
      const p = s[t.k]; p.v = r4(p.v + amount * t.share);
      if (t.cap && p.v >= p.hit) { won.push({ t, amount: round2(p.v) }); s[t.k] = fresh(t); }
    }
    save(); return won;
  }
  const take = t => { const a = round2(s[t.k].v); s[t.k] = fresh(t); save(); return a; };
  setInterval(() => {
    for (const w of feed(NETWORK * (.4 + Math.random() * 1.2))) toast(`🎰 ${w.t.name} jackpot ${fmt(w.amount)} won by ${'abcdefghjkmnprstuvwxyz'[rnd(22)]}***${rnd(10)}`);
  }, 1000);
  return {
    TIERS,
    SHARE: TIERS.reduce((a, t) => a + t.share, 0),
    value: k => s[k].v,
    // a slot spin of `bet`: feeds the pots and returns any jackpots it won
    spin(bet) {
      const won = feed(bet);
      if (Math.random() < bet * 2e-7) won.push({ t: TIERS[3], amount: take(TIERS[3]) });
      return won;
    },
    claimGrand() { return { t: TIERS[3], amount: take(TIERS[3]) }; },
  };
})();

// Live jackpot meters: returns an element that keeps itself up to date while it's on the page.
function jackpotMeters(cls = '') {
  const el = h(`<div class="jpm ${cls}">${Jackpots.TIERS.map(t => `<div class="jpm-t ${t.k}" style="--jc:${t.color}"><small>${t.name}</small><b></b>${t.cap ? `<i>Must drop by ${fmt(t.cap)}</i>` : '<i>Progressive</i>'}</div>`).join('')}</div>`);
  const upd = () => { if (!el.isConnected && el.dataset.on) return clearInterval(iv); el.dataset.on = 1; Jackpots.TIERS.forEach(t => $(`.${t.k} b`, el).textContent = fmt2(Jackpots.value(t.k))); };
  const iv = setInterval(upd, 250); upd();
  return el;
}
