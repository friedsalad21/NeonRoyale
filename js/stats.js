// Play statistics: every wager (Casino.take) and payout (Casino.pay) is booked against the game on screen.
// Refunds (chips taken back, cancelled bets) are subtracted from wagers. Stored in this browser only.
const Stats = (() => {
  const blank = () => ({ since: Date.now(), games: {}, hist: [], big: [], topups: 0, topupAmt: 0 });
  let d = store.get('stats', null) || blank(), timer = 0;
  // this visit only (not saved): totals, start time, and a feed of recent money moves for the live panel
  const sess = { w: 0, p: 0, bets: 0, start: Date.now(), startBal: null, feed: [] };
  const subs = new Set(); let queued = false;
  const notify = () => { if (queued) return; queued = true; setTimeout(() => { queued = false; subs.forEach(f => f()); }, 30); };
  const save = () => { clearTimeout(timer); timer = setTimeout(() => store.set('stats', d), 300); notify(); };
  const g = id => d.games[id] ??= { w: 0, p: 0, wins: 0, best: 0, visits: 0 };
  const cur = () => Casino.cur || 'lobby';
  const feed = (n, kind) => { sess.feed.unshift({ id: cur(), n: round2(n), kind, t: Date.now() }); sess.feed.length = Math.min(sess.feed.length, 30); };
  // balance history for the chart (one point per change, last 600 kept)
  const point = () => { const b = round2(Casino.bal), h = d.hist; if (h.length && h[h.length - 1][1] === b) return; h.push([Date.now(), b]); if (h.length > 600) h.splice(0, h.length - 600); };
  // another tab (e.g. the stats page in a second window) wrote new numbers: pick them up
  addEventListener('storage', e => { if (e.key === 'neonroyale.stats' && e.newValue) { try { d = JSON.parse(e.newValue); notify(); } catch {} } });
  return {
    get data() { return d; },
    get session() { return sess; },
    on(f) { subs.add(f); return () => subs.delete(f); },
    bet(n) { sess.startBal ??= round2(Casino.bal + n); g(cur()).w += n; sess.w += n; sess.bets++; feed(n, 'bet'); point(); save(); },
    unbet(n) { g(cur()).w -= n; sess.w -= n; sess.bets--; feed(n, 'refund'); point(); save(); },
    win(n) {
      const x = g(cur()); x.p += n; x.wins++; if (n > x.best) x.best = n; sess.p += n; feed(n, 'win');
      d.big.push({ id: cur(), n: round2(n), t: Date.now() }); d.big.sort((a, b) => b.n - a.n); d.big.length = Math.min(d.big.length, 10);
      point(); save();
    },
    topup(n) { if (n <= 0) return; d.topups++; d.topupAmt += n; setTimeout(() => { point(); save(); }); },
    visit(id) { if (id !== 'lobby' && id !== 'stats') g(id).visits++; save(); },
    reset() { d = blank(); Object.assign(sess, { w: 0, p: 0, bets: 0, start: Date.now(), startBal: null, feed: [] }); point(); store.set('stats', d); notify(); },
  };
})();

(() => {
  const gameOf = id => Casino.games.find(x => x.id === id);
  const nameOf = id => gameOf(id)?.name || id;
  const sectionOf = id => { const gm = gameOf(id); return gm?.back === 'slots' ? 'Slots' : gm?.section || 'Table Games'; };
  const money = n => (n < 0 ? '−' : '') + fmt(Math.abs(round2(n)));
  const pct = (p, w) => w > 0 ? (p / w * 100).toFixed(1) + '%' : '—';
  const cls = n => n > 0.004 ? 'pos' : n < -0.004 ? 'neg' : '';

  function chart(hist) {
    if (hist.length < 2) return '<p class="muted">Play a few games and your bankroll history will appear here.</p>';
    const W = 800, H = 220, P = 30, ys = hist.map(p => p[1]), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
    const x = i => P + i / (hist.length - 1) * (W - 2 * P), y = v => H - P - (v - lo) / span * (H - 2 * P);
    const pts = hist.map((p, i) => `${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ');
    const up = ys.at(-1) >= ys[0];
    return `<svg viewBox="0 0 ${W} ${H}" class="st-chart" role="img" aria-label="Bankroll over time">
      <defs><linearGradient id="stg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${up ? '#22c55e' : '#ef4444'}" stop-opacity=".35"/><stop offset="1" stop-color="${up ? '#22c55e' : '#ef4444'}" stop-opacity="0"/></linearGradient></defs>
      ${[0, .5, 1].map(f => `<line x1="${P}" x2="${W - P}" y1="${y(lo + span * f)}" y2="${y(lo + span * f)}" class="st-grid"/><text x="${P - 4}" y="${y(lo + span * f) + 4}" text-anchor="end" class="st-ax">$${Math.round(lo + span * f).toLocaleString()}</text>`).join('')}
      <polygon points="${P},${H - P} ${pts} ${W - P},${H - P}" fill="url(#stg)"/>
      <polyline points="${pts}" fill="none" stroke="${up ? '#4ade80' : '#f87171'}" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="${x(hist.length - 1)}" cy="${y(ys.at(-1))}" r="5" fill="${up ? '#4ade80' : '#f87171'}"/>
    </svg>`;
  }

  Casino.games.push({
    id: 'stats', hall: true, name: 'Statistics',
    rules: `<ul><li>Every chip you bet and every payout is tracked per game, in this browser only.</li>
      <li><b>Wagered</b> counts bets that were actually played. Chips you took back before a round don't count.</li>
      <li><b>Return</b> is won ÷ wagered. Over thousands of bets it drifts toward each game's house edge.</li>
      <li>Cashier top-ups are shown separately; they're free chips, not winnings.</li></ul>`,
    mount({ el, table }) {
      el.classList.add('statspage');
      let sortKey = store.get('stats_sort', 'w');
      function render() {
        const D = Stats.data, rows = Object.entries(D.games).filter(([, v]) => v.w > .004 || v.p > .004);
        const W = rows.reduce((a, [, v]) => a + v.w, 0), P = rows.reduce((a, [, v]) => a + v.p, 0), net = P - W;
        const by = { w: v => v.w, p: v => v.p, net: v => v.p - v.w, rtp: v => v.w ? v.p / v.w : 0, best: v => v.best, visits: v => v.visits, name: () => 0 };
        rows.sort(sortKey === 'name' ? (a, b) => nameOf(a[0]).localeCompare(nameOf(b[0])) : (a, b) => by[sortKey](b[1]) - by[sortKey](a[1]));
        const secs = {};
        rows.forEach(([id, v]) => { const s = sectionOf(id); secs[s] ??= { w: 0, p: 0 }; secs[s].w += v.w; secs[s].p += v.p; });
        const secMax = Math.max(1, ...Object.values(secs).map(s => Math.abs(s.p - s.w)));
        const best = rows.length ? rows.reduce((a, b) => (b[1].p - b[1].w) > (a[1].p - a[1].w) ? b : a) : null;
        const worst = rows.length ? rows.reduce((a, b) => (b[1].p - b[1].w) < (a[1].p - a[1].w) ? b : a) : null;
        const fav = rows.length ? rows.reduce((a, b) => b[1].w > a[1].w ? b : a) : null;
        const th = (k, t) => `<th data-k="${k}" class="${sortKey === k ? 'on' : ''}">${t}</th>`;
        table.innerHTML = `<div class="st">
          <div class="st-cards">
            <div class="st-card"><small>Total wagered</small><b>${money(W)}</b></div>
            <div class="st-card"><small>Total won</small><b>${money(P)}</b></div>
            <div class="st-card big ${cls(net)}"><small>Profit / loss</small><b>${net > 0 ? '+' : ''}${money(net)}</b></div>
            <div class="st-card"><small>Return</small><b>${pct(P, W)}</b></div>
            <div class="st-card"><small>Balance</small><b>${fmt(Casino.bal)}</b></div>
            <div class="st-card"><small>Biggest win</small><b>${D.big[0] ? fmt(D.big[0].n) : '—'}</b><i>${D.big[0] ? nameOf(D.big[0].id) : ''}</i></div>
            <div class="st-card"><small>Favourite game</small><b class="sm">${fav ? nameOf(fav[0]) : '—'}</b><i>${fav ? money(fav[1].w) + ' wagered' : ''}</i></div>
            <div class="st-card"><small>Luckiest game</small><b class="sm">${best && best[1].p - best[1].w > 0 ? nameOf(best[0]) : '—'}</b><i>${best && best[1].p - best[1].w > 0 ? '+' + money(best[1].p - best[1].w) : ''}</i></div>
            <div class="st-card"><small>Unluckiest game</small><b class="sm">${worst && worst[1].p - worst[1].w < 0 ? nameOf(worst[0]) : '—'}</b><i>${worst && worst[1].p - worst[1].w < 0 ? money(worst[1].p - worst[1].w) : ''}</i></div>
            <div class="st-card"><small>Cashier top-ups</small><b>${D.topups}</b><i>${D.topups ? fmt(round2(D.topupAmt)) + ' free chips' : ''}</i></div>
          </div>
          <h2 class="st-h">Bankroll</h2>${chart(D.hist)}
          ${Object.keys(secs).length ? `<h2 class="st-h">Profit / loss by section</h2><div class="st-secs">${Object.entries(secs).sort((a, b) => b[1].w - a[1].w).map(([s, v]) => { const n = v.p - v.w; return `<div class="st-sec"><span>${s}</span><div class="st-bar"><i class="${cls(n)}" style="width:${Math.abs(n) / secMax * 50}%;${n < 0 ? 'right:50%' : 'left:50%'}"></i></div><b class="${cls(n)}">${n > 0 ? '+' : ''}${money(n)}</b></div>`; }).join('')}</div>` : ''}
          <h2 class="st-h">By game</h2>
          ${rows.length ? `<div class="st-scroll"><table class="st-t"><thead><tr>${th('name', 'Game')}${th('visits', 'Visits')}${th('w', 'Wagered')}${th('p', 'Won')}${th('net', 'Profit')}${th('rtp', 'Return')}${th('best', 'Best win')}</tr></thead><tbody>
            ${rows.map(([id, v]) => `<tr><td><a href="#${id}">${nameOf(id)}</a></td><td>${v.visits}</td><td>${money(v.w)}</td><td>${money(v.p)}</td><td class="${cls(v.p - v.w)}">${v.p - v.w > 0 ? '+' : ''}${money(v.p - v.w)}</td><td>${pct(v.p, v.w)}</td><td>${v.best ? fmt(round2(v.best)) : '—'}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="muted">No bets yet. Go play something!</p>'}
          ${D.big.length ? `<h2 class="st-h">Biggest wins</h2><ol class="st-big">${D.big.map(b => `<li><b>${fmt(b.n)}</b> on ${nameOf(b.id)} <span>${new Date(b.t).toLocaleString()}</span></li>`).join('')}</ol>` : ''}
          <div class="st-foot"><span>Tracking since ${new Date(D.since).toLocaleDateString()}</span><button class="btn ghost small st-reset">Reset statistics</button></div>
        </div>`;
        $$('.st-t th', table).forEach(h => h.onclick = () => { sortKey = h.dataset.k; store.set('stats_sort', sortKey); render(); sfx.tick(); });
        $('.st-reset', table).onclick = () => {
          const m = modal('Reset statistics?', '<p>This clears every number on this page. Your balance stays the same.</p><button class="btn red">Reset</button>');
          $('.btn', m).onclick = () => { Stats.reset(); m.remove(); render(); toast('Statistics reset'); };
        };
      }
      render();
      // re-draw as bets land (or when another tab updates the numbers), at most twice a second
      let tmr = 0;
      const off = Stats.on(() => { if (!tmr) tmr = setTimeout(() => { tmr = 0; if (!$('.modal')) render(); }, 500); });
      return () => { off(); clearTimeout(tmr); };
    },
  });

  // ---------- live stats drawer: opens from the header on any page and updates as you play ----------
  const el = h('<aside id="ls" aria-label="Live statistics"><div class="ls-head"><b>📊 Live stats</b><a href="#stats" class="ls-full">Full stats →</a><button class="ls-x" aria-label="Close live stats">×</button></div><div class="ls-body"></div></aside>');
  document.body.append(el);
  const body = $('.ls-body', el);
  let open = false, tmr = 0;
  const row = (k, v, c = '') => `<div class="ls-row"><span>${k}</span><b class="${c}">${v}</b></div>`;
  const block = (w, p) => row('Wagered', money(w)) + row('Won', money(p)) + row('Profit / loss', (p - w > 0 ? '+' : '') + money(p - w), cls(p - w)) + row('Return', pct(p, w));
  const clock = ms => { const m = Math.floor(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${Math.floor(ms / 1000) % 60}s`; };
  function spark(points) {
    if (points.length < 2) return '';
    const ys = points.map(p => p[1]), lo = Math.min(...ys), sp = Math.max(...ys) - lo || 1, up = ys.at(-1) >= ys[0];
    const pts = points.map((p, i) => `${(i / (points.length - 1) * 270).toFixed(1)},${(54 - (p[1] - lo) / sp * 50).toFixed(1)}`).join(' ');
    return `<svg class="ls-spark" viewBox="0 0 270 58" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${up ? '#4ade80' : '#f87171'}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  }
  function render() {
    if (!open) return;
    const S = Stats.session, D = Stats.data, gid = Casino.cur, gs = D.games[gid], net = S.p - S.w;
    const pts = D.hist.filter(p => p[0] >= S.start - 1000), all = Object.values(D.games);
    const W = all.reduce((a, v) => a + v.w, 0), P = all.reduce((a, v) => a + v.p, 0);
    const feed = S.feed.slice(0, 12).map(f => `<div class="${f.kind}"><span>${nameOf(f.id)}</span><b>${f.kind === 'win' ? '+' : f.kind === 'bet' ? '−' : '↩ '}${fmt(f.n)}</b></div>`).join('');
    body.innerHTML = `<div class="ls-sec"><h4>This session <span class="ls-time">${clock(Date.now() - S.start)}</span></h4>
        <div class="ls-big ${cls(net)}">${net > 0 ? '+' : ''}${money(net)}</div>${spark(pts.length > 1 ? pts : D.hist.slice(-60))}
        ${row('Wagered', money(S.w))}${row('Won', money(S.p))}${row('Return', pct(S.p, S.w))}${row('Bets placed', S.bets)}</div>
      ${gs && gid !== 'stats' ? `<div class="ls-sec"><h4>${nameOf(gid)} <span>all time</span></h4>${block(gs.w, gs.p)}${row('Best win', gs.best ? fmt(round2(gs.best)) : '—')}</div>` : ''}
      <div class="ls-sec"><h4>All games <span>all time</span></h4>${block(W, P)}</div>
      <div class="ls-sec"><h4>Recent</h4><div class="ls-feed">${feed || '<p class="muted">Your bets and wins will appear here as you play.</p>'}</div></div>`;
  }
  const setOpen = v => { open = v; store.set('ls_open', v); document.body.classList.toggle('ls-open', v); $('#statsbtn')?.classList.toggle('on', v); render(); };
  $('.ls-x', el).onclick = () => setOpen(false);
  $('.ls-full', el).onclick = () => { if (innerWidth < 760) setOpen(false); };
  Stats.on(() => { if (open && !tmr) tmr = setTimeout(() => { tmr = 0; render(); }, 120); });
  setInterval(() => { const t = open && $('.ls-time', el); if (t) t.textContent = clock(Date.now() - Stats.session.start); }, 1000);
  // header 📊 toggles the drawer (the drawer links to the full page)
  $('#statsbtn').addEventListener('click', e => { e.preventDefault(); setOpen(!open); sfx.tick(); });
  setOpen(store.get('ls_open', false));
})();
