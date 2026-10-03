(() => {
  const PLACE = { 4: 9 / 5, 5: 7 / 5, 6: 7 / 6, 8: 7 / 6, 9: 7 / 5, 10: 9 / 5 };
  const PLACE_TXT = { 4: '9:5', 5: '7:5', 6: '7:6', 8: '7:6', 9: '7:5', 10: '9:5' };
  const ODDS = { 4: 2, 10: 2, 5: 1.5, 9: 1.5, 6: 1.2, 8: 1.2 };
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const face = (el, v) => el.innerHTML = Array.from({ length: 9 }, (_, i) => `<i${PIPS[v].includes(i) ? ' class="on"' : ''}></i>`).join('');
  const NAMES = { 4: 'FOUR', 5: 'FIVE', 6: 'SIX', 8: 'EIGHT', 9: 'NINE', 10: 'TEN' };

  Casino.games.push({
    id: 'craps', name: 'Craps', tag: 'Dice · Hot table', icon: '🎲', accent: '#f97316',
    blurb: 'Roll the bones. Pass line, odds, place bets, the field and props.',
    rules: `<ul>
      <li><b>Pass Line</b> (come-out roll only): 7 or 11 wins, 2, 3 or 12 loses. Any other number becomes the point. Roll the point again before a 7 to win 1:1.</li>
      <li><b>Don't Pass</b>: the opposite. 2 or 3 wins, 12 pushes, 7 or 11 loses. Once a point is set, a 7 wins.</li>
      <li><b>Pass Odds</b>: once a point is on, back your pass bet (up to 5×) at true odds: 2:1 on 4/10, 3:2 on 5/9, 6:5 on 6/8. No house edge.</li>
      <li><b>Place bets</b> on 4, 5, 6, 8, 9, 10 win each time that number rolls and stay up. They lose on a 7 and are off on come-out rolls.</li>
      <li><b>Field</b> (one roll): 3, 4, 9, 10, 11 pay 1:1. 2 and 12 pay 2:1.</li>
      <li><b>Props</b> (one roll): Any 7 pays 4:1, Any Craps (2, 3, 12) pays 7:1, Yo-Eleven pays 15:1.</li>
      <li>Line bets can't be taken down once a point is on. Space rolls.</li></ul>`,
    mount({ table, controls }) {
      table.innerHTML = `<div class="cr">
        <div class="dicebox"><div class="die"></div><div class="die"></div><div class="puckstat"><span class="puck">OFF</span></div><div class="rollmsg">Coming out! Place your bets.</div></div>
        <div class="points">${[4, 5, 6, 8, 9, 10].map(n => `<div class="pt" data-n="${n}"><b>${NAMES[n]}</b><small>Place ${PLACE_TXT[n]}</small></div>`).join('')}</div>
        <div class="field">FIELD<span>2 · 3 · 4 · 9 · 10 · 11 · 12</span><small>2 and 12 pay double</small></div>
        <div class="props"><div class="p7">ANY SEVEN<small>4 to 1</small></div><div class="pc">ANY CRAPS<small>7 to 1</small></div><div class="p11">YO-ELEVEN<small>15 to 1</small></div></div>
        <div class="dp">DON'T PASS BAR<small>Bar 12 · 1 to 1</small></div>
        <div class="pass">PASS LINE<small>1 to 1</small></div>
        <div class="odds">PASS ODDS<small>True odds · up to 5×</small></div>
      </div>`;
      const dice = $$('.die', table), msg = $('.rollmsg', table), puck = $('.puckstat .puck', table);
      face(dice[0], 6); face(dice[1], 5);
      const info = h('<div class="info-line">On the table <b>$0</b></div>');
      let point = null, busy = false;
      const bets = new Bets(() => { $('b', info).textContent = fmt(bets.total); rebetBtn.disabled = !!point; });
      bets.canBet = k => {
        if ((k === 'pass' || k === 'dp') && point) { toast('Line bets go down on the come-out roll'); return false; }
        if (k === 'odds') {
          if (!point || !bets.m.pass) { toast('Odds need a Pass Line bet and a point'); return false; }
          if ((bets.m.odds || 0) + Casino.chip > bets.m.pass * 5) { toast('Max odds is 5× your Pass Line'); return false; }
        }
        return true;
      };
      bets.canRemove = k => !((k === 'pass' || k === 'dp') && point);
      bets.bind('pass', $('.pass', table)); bets.bind('dp', $('.dp', table)); bets.bind('odds', $('.odds', table));
      bets.bind('field', $('.field', table)); bets.bind('any7', $('.p7', table)); bets.bind('anycraps', $('.pc', table)); bets.bind('yo', $('.p11', table));
      $$('.pt', table).forEach(el => bets.bind('place' + el.dataset.n, el));

      const rollBtn = button('Roll', 'red', roll), rebetBtn = button('Rebet', 'ghost', () => bets.rebet());
      const btns = h('<div class="btns"></div>'); btns.append(button('Clear', 'ghost', () => bets.clear()), rebetBtn, rollBtn);
      controls.append(chipRack(), info, btns);

      function showPoint() {
        puck.textContent = point ? 'ON' : 'OFF'; puck.classList.toggle('on', !!point);
        $$('.pt', table).forEach(el => {
          $('.puck', el)?.remove();
          if (+el.dataset.n === point) el.append(h('<span class="puck on">ON</span>'));
        });
      }
      async function roll() {
        if (busy) return;
        if (!bets.total) { toast('Place a bet first'); sfx.no(); return; }
        busy = true; rollBtn.disabled = true; bets.locked = true;
        if (!point) bets.save();
        sfx.roll(); dice.forEach(d => d.classList.add('tumble'));
        for (let i = 0; i < 9; i++) { face(dice[0], 1 + rnd(6)); face(dice[1], 1 + rnd(6)); await sleep(70); }
        const a = 1 + rnd(6), b = 1 + rnd(6), s = a + b;
        face(dice[0], a); face(dice[1], b); dice.forEach(d => d.classList.remove('tumble'));

        const m = bets.m; let paid = 0, staked = 0, text;
        const settleBet = (k, ret) => { if (!m[k]) return; staked += m[k]; paid += ret; delete m[k]; };
        const win = (k, ratio) => settleBet(k, (m[k] || 0) * (1 + ratio)), lose = k => settleBet(k, 0);
        // one-roll bets
        if (m.field) { if (s === 2 || s === 12) win('field', 2); else if ([3, 4, 9, 10, 11].includes(s)) win('field', 1); else lose('field'); }
        s === 7 ? win('any7', 4) : lose('any7');
        [2, 3, 12].includes(s) ? win('anycraps', 7) : lose('anycraps');
        s === 11 ? win('yo', 15) : lose('yo');
        if (!point) {
          if (s === 7 || s === 11) { win('pass', 1); lose('dp'); text = s === 7 ? 'Seven! Front line winner' : 'Yo eleven! Winner'; }
          else if (s === 2 || s === 3 || s === 12) { lose('pass'); if (s === 12) text = "Craps twelve. Don't Pass bars"; else { win('dp', 1); text = `Craps ${s}!`; } }
          else { point = s; text = `The point is ${NAMES[s]}`; }
        } else {
          for (const n of [4, 5, 6, 8, 9, 10]) {
            const k = 'place' + n; if (!m[k]) continue;
            if (s === n) paid += round2(m[k] * PLACE[n]); // place bets win and stay up
            else if (s === 7) lose(k);
          }
          if (s === point) { win('odds', ODDS[point]); win('pass', 1); lose('dp'); text = `Winner! ${NAMES[s]} the point`; point = null; }
          else if (s === 7) { lose('pass'); lose('odds'); win('dp', 1); text = 'Seven out! Line away'; point = null; }
          else text = `${s}. No decision`;
        }
        msg.textContent = `${a} + ${b} = ${s} · ${text}`;
        showPoint();
        busy = false; rollBtn.disabled = false; bets.locked = false; bets.render();
        settle(paid, staked, text);
      }
      Casino.hotkey = roll;
      // leaving the table hands back every chip still on it, line bets included
      return () => { point = null; bets.clear(); };
    },
  });
})();
