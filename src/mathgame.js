// UI for the times tables game. app.js passes in its helpers and merges these
// screens and actions into its own.
import { ACTIVITIES, arenaHtml, zapText, clearedText, missText, animFor, targetsFor, randomStart, trialTrackHtml } from './mine.js';
import { MAX_BOX } from './srs.js';
import { newBattle, applyAnswer } from './battle.js';
import { applyXpBoost, levelForXp, XP_PER } from './progress.js';
import { teamPowersFor, friendsAfterAnswer } from './friends.js';
import { teamLineHtml, friendSummaryHtml } from './friendsui.js';
import { coinPaceNote } from './economy.js';
import {
  GAME_TYPE, OPS, MODES, ROUND_LENGTH, MAX_FACTOR, PRACTICE_MAX_BOX, PRACTICE_REWARD, SECONDS_CHOICES, UNLOCK_ORDER,
  FACT_MASTERY_COINS, FACTS_PER_SUPER_STEP, mathState, poolFor, pickFact, recordFact, maybeUnlock, unlockedTables,
  tableSummary, trickyFacts, factHint, factById, itemFor, tableFacts,
  slowestFacts, formatSeconds, formatTime, trialKey, trialFacts, finalMissionFacts, recordTrial, FINAL_KEY, FINAL_LENGTH,
  TRIAL_PENALTY_MS, TRIAL_RECORD_XP, WARMUP_MAX_BOX, trackedFacts,
} from './math.js';

// ---- Friend hooks: only friends that know math give powers here; all of them learn. ----
function mathPowers(p) {
  return teamPowersFor(p, GAME_TYPE);
}
/** Called once per answer (result: 'correct' | 'assisted' | 'wrong'); returns { profile, events }. */
function afterMathAnswer(p, result, practice) {
  return friendsAfterAnswer(p, GAME_TYPE, result, Date.now(), { practice });
}

const TABLES = Array.from({ length: MAX_FACTOR + 1 }, (_, i) => i);

export function initMath(ctx) {
  const { ui, profile, update, go, render, esc, heroHtml, topbar, floatText, superProgressHtml } = ctx;
  ui.math = { op: 'mul', table: null, game: null, trial: null };
  const g = () => ui.math.game;

  // ---------- screens ----------
  function opPicker() {
    return `<div class="op-pick">${Object.entries(OPS)
      .map(
        ([id, o]) => `<button class="theme-pick ${ui.math.op === id ? 'selected' : ''}" data-action="math-op" data-id="${id}">
          <span class="icon">${o.symbol}</span>${o.label}${id === 'mix' ? '<div class="small muted">Advanced</div>' : ''}</button>`,
      )
      .join('')}</div>`;
  }

  function tablePicker(state) {
    const op = ui.math.op;
    const open = op === 'mix' ? [...new Set([...unlockedTables(state, 'mul'), ...unlockedTables(state, 'div')])] : unlockedTables(state, op);
    const chip = (t) => {
      if (op === 'div' && t === 0) return '';
      return `<button class="chip ${ui.math.table === t ? 'selected' : ''}" data-action="math-table" data-t="${t}">${t}</button>`;
    };
    return `<div class="row chips">
        <button class="chip wide ${ui.math.table == null ? 'selected' : ''}" data-action="math-table" data-t="">🧠 Smart mix</button>
        ${TABLES.map(chip).join('')}
      </div>
      <p class="small muted">${
        ui.math.table == null
          ? `Smart mix uses the ${open.sort((a, b) => a - b).join(', ')} tables. More open up as you learn them.`
          : `Just the ${ui.math.table}s.`
      }</p>`;
  }

  const trialName = (op, table) => (op === 'mix' ? `×÷${table} tables` : `${OPS[op].symbol}${table} table`);
  const bestOf = (state, key) => state.records[key]?.best;

  function trialCard(state) {
    const { op, table } = ui.math;
    const tables = TABLES.filter((t) => !(op !== 'mul' && t === 0));
    const best = table != null ? bestOf(state, trialKey(op, table)) : null;
    const fin = bestOf(state, FINAL_KEY);
    return `<div class="card">
        <h3>🛤️ Cart races</h3>
        <p class="small muted">Race your cart through every fact in a table (tap a table below to race it). A miss adds ${TRIAL_PENALTY_MS / 1000} seconds. Try to beat your own best time!</p>
        ${
          table != null
            ? `<button class="big" style="width:100%" data-action="math-trial" data-key="${trialKey(op, table)}">🛒 ${trialName(op, table)}${best ? ` · best ${formatTime(best)}` : ''}</button>`
            : '<p><strong>Pick a table above to race it.</strong></p>'
        }
        <div class="records">${tables
          .map((t) => {
            const b = bestOf(state, trialKey(op, t));
            return `<button class="record ${b ? '' : 'none'}" data-action="math-trial" data-key="${trialKey(op, t)}"><strong>${op === 'mix' ? '×÷' : OPS[op].symbol}${t}</strong><span>${b ? formatTime(b) : '—'}</span></button>`;
          })
          .join('')}</div>
      </div>
      <div class="card final-card">
        <h3>🚂 Mother Lode Express</h3>
        <p class="small">${FINAL_LENGTH} facts from every table, × and ÷, all the way down to the Mother Lode. ${fin ? `Your best: <strong>${formatTime(fin)}</strong>` : 'No record yet.'}</p>
        <button class="big super" style="width:100%" data-action="math-trial" data-key="${FINAL_KEY}">🚂 Ride the Mother Lode Express</button>
      </div>`;
  }

  function trialTitle(key) {
    if (key === FINAL_KEY) return '🚂 Mother Lode Express';
    const [op, t] = key.split(':');
    return `🛒 ${trialName(op, Number(t))}`;
  }

  const screens = {
    math() {
      const p = profile();
      const state = mathState(p);
      return `${topbar('🛒 Mine Cart Run')}
        <div class="card"><h3>Pick a game</h3>${opPicker()}</div>
        <div class="card"><h3>Which tables?</h3>${tablePicker(state)}</div>
        <div class="mode-pick">
          <button class="big secondary" data-action="math-start" data-mode="practice">${MODES.practice.emoji} Practice
            <div class="small muted">No timer · half nuggets · up to ${PRACTICE_MAX_BOX} ★</div></button>
          <button class="big" data-action="math-start" data-mode="speed">${MODES.speed.emoji} Speed
            <div class="small">${state.seconds} seconds each · full nuggets · master facts</div></button>
        </div>
        ${trialCard(state)}
        <div class="card">${superProgressHtml(p)}
          <p class="small muted">Answer a fact fast in Speed mode on ${MAX_BOX} different days to master it. Every ${FACTS_PER_SUPER_STEP} facts you master fill one Super Pack dot.</p></div>
        <button class="secondary" style="width:100%" data-action="go" data-to="math-facts">📊 My facts (${state.mastered} mastered)</button>`;
    },

    'math-play'() {
      const game = g();
      const p = profile();
      const b = game.battle;
      const f = game.fact;
      const copy = game.phase === 'copy';
      return `<div class="topbar">
          <button class="secondary" data-action="math-end">Done</button>
          <span class="pill">${MODES[game.mode].emoji} ${Math.min(b.asked + (game.phase === 'ask' ? 1 : 0), ROUND_LENGTH)} of ${ROUND_LENGTH}</span>
          <span class="pill">🟡 ${p.coins}</span>
        </div>
        ${arenaHtml('math', { hero: heroHtml(p, 'sm'), combo: b.combo, zap: game.zap, anim: game.anim, target: game.shownMonster, hp: game.shownHp, from: game.from })}
        <div class="card math-card">
          ${
            game.mode === 'speed' && game.phase === 'ask'
              ? `<div class="timer ${game.late ? 'late' : ''}"><div style="animation-duration:${game.seconds}s"></div></div>`
              : '<div class="timer off"></div>'
          }
          ${
            copy
              ? `<div class="correct-fact">${esc(f.text)} = ${f.answer}</div>
                 <div class="your-answer">You said ${esc(game.wrongAnswer)}</div>
                 <p class="muted" style="text-align:center;margin:4px 0">Type ${f.answer} to lock it in.</p>`
              : ''
          }
          <div class="fact ${copy ? 'small-fact' : ''}">${esc(f.text)} = <span class="slot" id="math-answer">${esc(game.typed) || '?'}</span></div>
          ${game.usedHint && game.phase === 'ask' ? `<div class="math-hint">${esc(factHint(f))}</div>` : ''}
          <div class="feedback ${game.feedbackClass || ''}" id="math-feedback">${esc(game.feedback || '')}</div>
          ${keypadHtml(copy)}
          ${
            game.phase === 'ask' && b.hintsLeft > 0 && !game.usedHint
              ? `<div style="text-align:center;margin-top:12px"><button class="secondary" data-action="math-hint">💡 Hint (${b.hintsLeft})</button></div>`
              : ''
          }
        </div>
        <p class="small muted" style="text-align:center">${teamLineHtml(p, GAME_TYPE)}</p>`;
    },

    'math-summary'() {
      const game = g();
      const p = profile();
      const missed = [...game.missed].map(factById).filter(Boolean);
      const mastered = game.mastered.map(factById).filter(Boolean);
      return `<h1>Round done! 🎉</h1>
        <div class="card">
          <div class="row" style="font-size:1.3rem;gap:24px">
            <span>🟡 +${game.earned.coins}</span><span>⭐ +${game.earned.xp} XP</span>${game.earned.sun ? `<span>☀️ +${game.earned.sun}</span>` : ''}<span>${ACTIVITIES.math.count(game.battle.defeated)}</span>
          </div>
          <p>${game.right} of ${game.battle.asked} right${game.mode === 'speed' ? ` · ${game.fast} in time` : ''}.</p>
          ${mastered.length ? `<p style="font-size:1.3rem">🌟 <strong>You mastered ${mastered.map((f) => `${esc(f.text)} = ${f.answer}`).join(', ')}!</strong> +${FACT_MASTERY_COINS * mastered.length} 🟡</p>` : ''}
          ${game.unlocked.map((u) => `<p style="font-size:1.2rem">🔓 <strong>The ${u.table}s ${OPS[u.op].symbol} are open in Smart mix!</strong></p>`).join('')}
          ${superProgressHtml(p)}
          ${coinPaceNote(p, Date.now()) ? `<p class="small muted">${coinPaceNote(p, Date.now())}</p>` : ''}
          ${game.levelUp ? `<p style="font-size:1.3rem"><strong>Level up! You're level ${levelForXp(p.xp)}.</strong> Check the Locker for new stuff.</p>` : ''}
          ${game.mode === 'practice' ? `<p class="small muted">Practice pays half nuggets. Try ⚡ Speed for full nuggets and to master facts.</p>` : ''}
        </div>
        ${friendSummaryHtml(game.friendsBefore, p, game.friendEvents)}
        ${
          missed.length
            ? `<div class="card"><h3>Facts to keep practicing</h3><p style="font-size:1.4rem">${missed.map((f) => `${esc(f.text)} = ${f.answer}`).join(' · ')}</p>
               <p class="small muted">These will come back more often, and pay extra nuggets when you get them right.</p></div>`
            : ''
        }
        <div class="row">
          <button class="big" data-action="math-start" data-mode="${game.mode}">Play again</button>
          <button class="big secondary" data-action="go" data-to="math">🔢 Tables</button>
          <button class="big secondary" data-action="go" data-to="packs">🎁 Packs</button>
          <button class="big secondary" data-action="go" data-to="hub">Home</button>
        </div>`;
    },

    'math-trial'() {
      const t = ui.math.trial;
      const f = t.facts[t.i];
      const state = mathState(profile());
      const best = bestOf(state, t.key);
      return `<div class="topbar">
          <button class="secondary" data-action="math-trial-quit">Stop</button>
          <span class="pill">${esc(trialTitle(t.key))}</span>
          <span class="pill">${best ? `🏆 ${formatTime(best)}` : '🏆 —'}</span>
        </div>
        <div class="card math-card">
          <div class="clock" id="trial-clock">${formatTime(trialElapsed(t))}</div>
          ${trialTrackHtml(heroHtml(profile(), 'sm'), t.from ?? t.i / t.facts.length, t.i / t.facts.length)}
          <div class="small muted" style="text-align:center;margin-bottom:8px">${t.i + 1} of ${t.facts.length}${t.penalty ? ` · +${t.penalty / 1000}s for misses` : ''}</div>
          ${t.fix ? `<div class="your-answer" style="text-decoration:none">It's ${f.answer}. Type it to keep going.</div>` : ''}
          <div class="fact">${esc(f.text)} = <span class="slot" id="math-answer">${esc(t.typed) || '?'}</span></div>
          <div class="feedback ${t.feedbackClass || ''}" id="math-feedback">${esc(t.feedback || '')}</div>
          ${keypadHtml(false)}
        </div>`;
    },

    'math-trial-done'() {
      const t = ui.math.trial;
      const r = t.result;
      const slowest = [...t.times].sort((a, b) => b.ms - a.ms).slice(0, 3);
      return `<h1>${r.newBest ? '🎉 New record!' : '🚉 Made it!'}</h1>
        <div class="card">
          <div class="clock">${formatTime(r.ms)}</div>
          <p style="text-align:center">${esc(trialTitle(t.key))} · ${t.facts.length} facts${t.misses ? ` · ${t.misses} miss${t.misses > 1 ? 'es' : ''} (+${t.penalty / 1000}s)` : ' · no misses!'}</p>
          ${
            r.newBest
              ? `<p style="text-align:center;font-size:1.2rem"><strong>${r.prevBest ? `${formatSeconds(r.prevBest - r.ms)} faster than your old best (${formatTime(r.prevBest)})!` : 'Your first time. Now try to beat it!'}</strong> +${TRIAL_RECORD_XP} XP</p>`
              : `<p style="text-align:center">Your best is <strong>${formatTime(r.prevBest)}</strong>. ${formatSeconds(r.ms - r.prevBest)} to go!</p>`
          }
          <div class="row" style="justify-content:center;gap:24px"><span>🟡 +${t.earned.coins}</span><span>⭐ +${t.earned.xp + r.xp} XP</span>${t.earned.sun ? `<span>☀️ +${t.earned.sun}</span>` : ''}</div>
        </div>
        ${friendSummaryHtml(t.friendsBefore, profile(), t.friendEvents)}
        ${
          slowest.length
            ? `<div class="card"><h3>Slowest this time</h3><p>${slowest.map((x) => `${esc(x.fact.text)} = ${x.fact.answer} <span class="muted">(${formatSeconds(x.ms)})</span>`).join(' · ')}</p></div>`
            : ''
        }
        <div class="row">
          <button class="big" data-action="math-trial" data-key="${t.key}">Try again</button>
          <button class="big secondary" data-action="go" data-to="math">🔢 Tables</button>
          <button class="big secondary" data-action="go" data-to="hub">Home</button>
        </div>`;
    },

    'math-facts'() {
      const state = mathState(profile());
      const cell = (f, label) => {
        const i = state.srs[f.id];
        const lvl = !i || !i.seen ? 'new' : `b${i.box}`;
        return `<div class="fc ${lvl}" title="${esc(f.text)} = ${f.answer}">${label}</div>`;
      };
      const head = (t) => `<div class="fc head">${t}</div>`;
      const mulGrid = `<div class="fact-grid">${head('×')}${TABLES.map(head).join('')}
        ${TABLES.map((t) => head(t) + tableFacts('mul', t).map((f) => cell(f, f.answer)).join('')).join('')}</div>`;
      const divGrid = `<div class="fact-grid">${head('÷')}${TABLES.map((n) => head(`=${n}`)).join('')}
        ${TABLES.slice(1).map((t) => head(t) + tableFacts('div', t).map((f) => cell(f, f.a)).join('')).join('')}</div>`;
      return `${topbar('My facts')}
        <div class="card"><p class="small">${state.mastered} facts mastered. Colors show stars:
          <span class="fc-key new">new</span><span class="fc-key b0">0</span><span class="fc-key b1">1</span><span class="fc-key b2">2</span>
          <span class="fc-key b3">3</span><span class="fc-key b4">4</span><span class="fc-key b5">5 ★</span></p></div>
        ${slowestHtml(state)}
        <div class="card"><h3>× Multiply</h3><p class="small muted">Row × column. The number is the answer.</p>${mulGrid}</div>
        <div class="card"><h3>÷ Divide</h3><p class="small muted">The number in the box ÷ the row = the column.</p>${divGrid}</div>`;
    },
  };

  function keypadHtml(copy) {
    return `<div class="keypad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="secondary" data-action="math-key" data-k="${n}">${n}</button>`).join('')}
      <button class="secondary" data-action="math-key" data-k="del" aria-label="Delete">⌫</button>
      <button class="secondary" data-action="math-key" data-k="0">0</button>
      <button data-action="math-key" data-k="go" aria-label="Enter">${copy ? '🔒' : '⚡'}</button>
    </div>`;
  }

  function slowestHtml(state) {
    const slow = slowestFacts(state, 8);
    if (!slow.length) return '';
    return `<div class="card"><h3>🐢 Slowest facts</h3>
      <p class="small muted">Average time for a right answer (recent tries count most). Practice these to speed them up!</p>
      <div class="slow-list">${slow
        .map((f) => `<div class="record"><strong>${esc(f.text)} = ${f.answer}</strong><span>${formatSeconds(f.item.avgMs)}</span></div>`)
        .join('')}</div></div>`;
  }

  // ---------- time trials ----------
  const trialElapsed = (t) => (t.endedAt ?? performance.now()) - t.startedAt + t.penalty;
  let clockTimer = null;

  function startTrial(key) {
    const p = profile();
    const facts = key === FINAL_KEY ? finalMissionFacts() : trialFacts(...key.split(':').map((x, i) => (i ? Number(x) : x)));
    ui.math.trial = {
      key,
      facts,
      i: 0,
      typed: '',
      penalty: 0,
      misses: 0,
      fix: false,
      times: [],
      earned: { coins: 0, xp: 0, sun: 0 },
      powers: mathPowers(p),
      friendsBefore: p,
      friendEvents: [],
      seconds: mathState(p).seconds,
    };
    ui.screen = 'math-trial';
    render();
    const t = ui.math.trial;
    t.startedAt = t.factStart = performance.now();
    clearInterval(clockTimer);
    clockTimer = setInterval(() => {
      const el = document.getElementById('trial-clock');
      if (ui.screen !== 'math-trial' || ui.math.trial !== t || t.endedAt) return clearInterval(clockTimer);
      if (el) el.textContent = formatTime(trialElapsed(t));
    }, 100);
  }

  function trialSubmit() {
    const t = ui.math.trial;
    if (!t.typed) return;
    const f = t.facts[t.i];
    const now = performance.now();
    const ms = now - t.factStart;
    const right = Number(t.typed) === f.answer;
    // Only the first try at each fact counts toward stars, coins and solve times.
    if (!t.fix) {
      const result = !right ? 'wrong' : ms > t.seconds * 1000 ? 'slow' : 'correct';
      const rec = recordFact(profile(), f.id, result, { mode: 'speed', now: Date.now(), powers: t.powers, ms });
      const grown = afterMathAnswer(rec.profile, rec.battleResult, rec.warmup);
      t.friendEvents.push(...grown.events);
      update(grown.profile);
      t.earned.coins += rec.coins + (rec.mastered ? FACT_MASTERY_COINS : 0);
      t.earned.sun += rec.sun || 0;
      t.earned.xp += rec.xp;
      if (right) t.times.push({ fact: f, ms });
      if (rec.mastered) floatText(`🌟 ${f.text} mastered!`);
    }
    if (!right) {
      t.penalty += TRIAL_PENALTY_MS;
      t.misses += t.fix ? 0 : 1;
      Object.assign(t, { fix: true, from: null, typed: '', feedback: `+${TRIAL_PENALTY_MS / 1000}s`, feedbackClass: 'bad' });
      render();
      return;
    }
    t.from = t.i / t.facts.length;
    t.i++;
    Object.assign(t, { fix: false, typed: '', feedback: '', feedbackClass: '' });
    if (t.i >= t.facts.length) {
      t.endedAt = now;
      const total = Math.round(trialElapsed(t));
      const r = recordTrial(profile(), t.key, total);
      update(r.profile);
      t.result = { ...r, ms: total, prevBest: r.prevBest };
      clearInterval(clockTimer);
      return go('math-trial-done');
    }
    t.factStart = now;
    render();
  }

  // ---------- game flow ----------
  function startRound(mode) {
    const p = profile();
    const state = mathState(p);
    const powers = mathPowers(p);
    const op = ui.math.op;
    ui.math.game = {
      mode,
      op,
      table: ui.math.table,
      seconds: state.seconds,
      powers,
      battle: newBattle(powers, randomStart('math'), targetsFor('math')),
      recent: [],
      newUsed: 0,
      missed: new Set(),
      mastered: [],
      unlocked: [],
      right: 0,
      fast: 0,
      earned: { coins: 0, xp: 0, sun: 0 },
      startLevel: levelForXp(p.xp),
      friendsBefore: p,
      friendEvents: [],
      token: 0,
    };
    nextFact();
  }

  function nextFact() {
    const game = g();
    if (game.battle.asked >= ROUND_LENGTH) return finishRound();
    const state = mathState(profile());
    const pool = poolFor(state, game.op, game.table);
    const now = Date.now();
    const f = pickFact(state, pool, now, Math.random, game.recent, game.newUsed);
    if (!f) return finishRound();
    if (!itemFor(state, f.id, now).seen) game.newUsed++;
    game.recent = [f.id, ...game.recent].slice(0, Math.min(4, pool.length - 1));
    Object.assign(game, { fact: f, phase: 'ask', typed: '', usedHint: false, late: false, feedback: '', feedbackClass: '', zap: '', anim: '', from: null });
    game.shownMonster = game.battle.monster;
    game.shownHp = game.battle.hp;
    game.token++;
    ui.screen = 'math-play';
    render();
    game.startedAt = performance.now();
    if (game.mode === 'speed') {
      const token = game.token;
      setTimeout(() => {
        if (g() !== game || game.token !== token || game.phase !== 'ask' || ui.screen !== 'math-play') return;
        game.late = true;
        document.querySelector('.timer')?.classList.add('late');
        const fb = document.getElementById('math-feedback');
        if (fb && !fb.textContent) fb.textContent = '⏰ Take your time, you can still answer.';
      }, game.seconds * 1000);
    }
  }

  function advanceLater(ms) {
    const game = g();
    const token = game.token;
    setTimeout(() => {
      if (g() === game && game.token === token && ui.screen === 'math-play') nextFact();
    }, ms);
  }

  function finishRound() {
    const game = g();
    let p = profile();
    const ops = game.op === 'mix' ? ['mul', 'div'] : [game.op];
    let state = mathState(p);
    for (const op of ops) {
      const r = maybeUnlock(state, op);
      state = r.state;
      if (r.table != null) game.unlocked.push({ op, table: r.table });
    }
    if (game.unlocked.length) update({ ...p, math: state });
    game.levelUp = levelForXp(profile().xp) > game.startLevel;
    go('math-summary');
  }

  function showTyped(text = g().typed) {
    const el = document.getElementById('math-answer');
    if (el) el.textContent = text || '?';
  }

  function press(k) {
    if (ui.screen === 'math-trial') return trialPress(k);
    const game = g();
    if (!game || ui.screen !== 'math-play' || game.phase === 'wait') return;
    if (k === 'go') return submit();
    if (k === 'del') game.typed = game.typed.slice(0, -1);
    else if (game.typed.length < 3) game.typed = game.typed === '0' ? String(k) : game.typed + k;
    showTyped();
  }

  function trialPress(k) {
    const t = ui.math.trial;
    if (!t || t.endedAt) return;
    if (k === 'go') return trialSubmit();
    if (k === 'del') t.typed = t.typed.slice(0, -1);
    else if (t.typed.length < 3) t.typed = t.typed === '0' ? String(k) : t.typed + k;
    showTyped(t.typed);
  }

  function submit() {
    const game = g();
    if (!game.typed) return;
    const f = game.fact;
    const value = Number(game.typed);
    if (game.phase === 'copy') {
      Object.assign(game, { anim: '', from: null });
      if (value === f.answer) {
        Object.assign(game, { phase: 'wait', feedback: 'Locked in! 🔒', feedbackClass: 'good' });
        render();
        advanceLater(700);
      } else {
        Object.assign(game, { typed: '', feedback: `Type ${f.answer}.`, feedbackClass: 'bad' });
        render();
      }
      return;
    }

    const seconds = (performance.now() - game.startedAt) / 1000;
    const right = value === f.answer;
    const result = !right ? 'wrong' : game.usedHint ? 'hinted' : game.mode === 'speed' && seconds > game.seconds ? 'slow' : 'correct';
    const rec = recordFact(profile(), f.id, result, { mode: game.mode, now: Date.now(), powers: game.powers, ms: seconds * 1000 });
    const grown = afterMathAnswer(rec.profile, rec.battleResult, game.mode === 'practice' || rec.warmup);
    game.friendEvents.push(...grown.events);
    let p = grown.profile;
    game.earned.coins += rec.coins;
    game.earned.sun += rec.sun || 0;
    game.earned.xp += rec.xp;

    // In practice there's no clock, so a right answer is always a full hit.
    const battleResult = game.mode === 'practice' && result !== 'hinted' && right ? 'correct' : rec.battleResult;
    const { battle, events } = applyAnswer(game.battle, battleResult, game.powers);
    const defeated = events.find((e) => e.type === 'defeated');
    game.from = (game.shownMonster.hp - game.shownHp) / game.shownMonster.hp;
    game.anim = animFor(events);
    game.shownMonster = defeated ? game.battle.monster : battle.monster;
    game.shownHp = defeated ? 0 : battle.hp;
    game.battle = battle;
    if (defeated) {
      const bonus = Math.floor(applyXpBoost(XP_PER.monster, game.powers) * (game.mode === 'practice' ? PRACTICE_REWARD : 1));
      p = { ...p, xp: p.xp + bonus };
      game.earned.xp += bonus;
    }
    update(p);

    if (right) {
      game.right++;
      if (result === 'correct') game.fast++;
      const hit = events.find((e) => e.type === 'hit');
      game.phase = 'wait';
      game.zap = zapText('math', hit.damage);
      game.feedback = defeated
        ? clearedText('math', defeated.monster)
        : result === 'slow'
        ? `Right! ${f.text} = ${f.answer}. Faster next time for full nuggets.`
        : game.mode === 'speed'
        ? `⚡ ${seconds.toFixed(1)}s!`
        : ['Nice!', 'Yes!', 'Great!', 'Zoom!'][Math.floor(Math.random() * 4)];
      if (rec.shards && !defeated) game.feedback = `✨ Polished back to shiny! +${rec.shards} 💎`;
      if (rec.mastered) {
        game.mastered.push(f.id);
        game.earned.coins += FACT_MASTERY_COINS;
        game.feedback = `🌟 You mastered ${f.text} = ${f.answer}! +${FACT_MASTERY_COINS} 🟡`;
      }
      game.feedbackClass = 'good';
      render();
      if (rec.coins) floatText(`+${rec.coins} 🟡`);
      advanceLater(rec.mastered ? 2000 : defeated ? 1200 : result === 'slow' ? 1500 : 650);
    } else {
      game.missed.add(f.id);
      Object.assign(game, {
        phase: 'copy',
        wrongAnswer: game.typed,
        typed: '',
        zap: '',
        feedback: missText('math', events),
        feedbackClass: '',
      });
      render();
    }
  }

  // Number keys on a computer keyboard.
  document.addEventListener('keydown', (e) => {
    if ((ui.screen !== 'math-play' && ui.screen !== 'math-trial') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Enter') press('go');
    else return;
    e.preventDefault();
  });

  // ---------- actions ----------
  const actions = {
    'math-op': (d) => {
      ui.math.op = d.id;
      if (d.id === 'div' && ui.math.table === 0) ui.math.table = null;
      render();
    },
    'math-table': (d) => {
      ui.math.table = d.t === '' ? null : Number(d.t);
      render();
    },
    'math-start': (d) => startRound(d.mode),
    'math-trial': (d) => startTrial(d.key),
    'math-trial-quit': () => {
      clearInterval(clockTimer);
      ui.math.trial = null;
      go('math');
    },
    'math-key': (d) => press(d.k),
    'math-hint': () => {
      const game = g();
      game.battle = { ...game.battle, hintsLeft: game.battle.hintsLeft - 1 };
      game.usedHint = true;
      render();
    },
    'math-end': () => (g().battle.asked ? finishRound() : go('math')),
    'math-seconds': (d) => {
      const kid = ctx.data().profiles[d.id];
      if (!kid) return;
      update({ ...kid, math: { ...mathState(kid), seconds: Number(d.s) } });
      render();
    },
  };

  /** Times tables section for the grown-ups screen. */
  function parentHtml(kid) {
    if (!kid) return '';
    const s = mathState(kid);
    const tricky = trickyFacts(s);
    const slow = slowestFacts(s, 8);
    const records = Object.entries(s.records)
      .sort(([a], [b]) => (a === FINAL_KEY) - (b === FINAL_KEY) || a.localeCompare(b, undefined, { numeric: true }))
      .map(([k, r]) => `${esc(trialTitle(k).replace(/^\S+ /, ''))}: ${formatTime(r.best)} <span class="small muted">(${r.runs} run${r.runs > 1 ? 's' : ''})</span>`);
    const row = (t) => {
      const m = tableSummary(s, 'mul', t);
      const dv = t ? tableSummary(s, 'div', t) : null;
      const open = (op) => unlockedTables(s, op).includes(t);
      return `<tr><td><strong>${t}s</strong></td>
        <td>${m.total ? `${m.mastered}/${m.total}` : 'warm-up'} <span class="small muted">${m.seen ? `${m.seen} tried` : open('mul') ? 'open' : ''}</span></td>
        <td>${dv ? `${dv.total ? `${dv.mastered}/${dv.total}` : 'warm-up'} <span class="small muted">${dv.seen ? `${dv.seen} tried` : open('div') ? 'open' : ''}</span>` : '—'}</td></tr>`;
    };
    return `<div class="card">
      <h3>Times tables for ${esc(kid.name)}</h3>
      <p>${s.mastered} facts mastered · ${s.stats.correct}/${s.stats.answered} right overall</p>
      <div class="row"><span class="small">Speed mode time per question:</span>
        ${SECONDS_CHOICES.map((n) => `<button class="chip ${s.seconds === n ? 'selected' : ''}" data-action="math-seconds" data-id="${kid.id}" data-s="${n}">${n}s</button>`).join('')}</div>
      ${slow.length ? `<p><strong>Slowest facts</strong> <span class="small muted">(average time for a right answer)</span>: ${slow.map((f) => `${esc(f.text)} ${formatSeconds(f.item.avgMs)}`).join(' · ')}</p>` : ''}
      ${records.length ? `<p><strong>Time trial records:</strong> ${records.join(' · ')}</p>` : ''}
      ${tricky.length ? `<p><strong>Tricky facts:</strong> ${tricky.map((f) => `${esc(f.text)} = ${f.answer} <span class="small muted">(missed ${f.item.misses}×)</span>`).join(' · ')}</p>` : ''}
      <table><tr><th>Table</th><th>× mastered</th><th>÷ mastered</th></tr>${TABLES.map(row).join('')}</table>
      <p class="small muted">Facts 0–12, each with its own 0–${MAX_BOX} star rating like spelling words. Smart mix starts with the easy tables
        (${UNLOCK_ORDER.mul.slice(0, 5).join(', ')}) and opens the next one when most open facts have 2 stars; kids can also pick any single table.
        Practice has no timer, pays half and stops at ${PRACTICE_MAX_BOX} stars. Speed mode pays full, and a right answer only adds a star when it's in time,
        so mastered means fast recall. Facts with a 0, 1 or 2 in them (like 5 × 0 or 14 ÷ 2) are warm-ups: they pay no nuggets, stop at ${WARMUP_MAX_BOX} stars and don't count toward mastery, so the ${trackedFacts('mul').length + trackedFacts('div').length} facts that count use only 3–12. Each mastered fact pays ${FACT_MASTERY_COINS} nuggets once, and every ${FACTS_PER_SUPER_STEP} mastered facts fill one Super Pack dot.</p>
    </div>`;
  }

  return { screens, actions, parentHtml, isPlaying: () => ui.screen === 'math-play' || ui.screen === 'math-trial' };
}
