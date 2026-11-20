// UI for the times tables game. app.js passes in its helpers and merges these
// screens and actions into its own.
import { MONSTERS } from './content.js';
import { MAX_BOX } from './srs.js';
import { newBattle, applyAnswer } from './battle.js';
import { applyXpBoost, levelForXp, XP_PER } from './progress.js';
import { teamPowersFor, friendsAfterAnswer } from './friends.js';
import { teamLineHtml, friendSummaryHtml } from './friendsui.js';
import {
  GAME_TYPE, OPS, MODES, ROUND_LENGTH, MAX_FACTOR, PRACTICE_MAX_BOX, PRACTICE_REWARD, SECONDS_CHOICES, UNLOCK_ORDER,
  FACT_MASTERY_COINS, FACTS_PER_SUPER_STEP, mathState, poolFor, pickFact, recordFact, maybeUnlock, unlockedTables,
  tableSummary, trickyFacts, factHint, factById, itemFor, tableFacts,
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
  ui.math = { op: 'mul', table: null, game: null };
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

  const screens = {
    math() {
      const p = profile();
      const state = mathState(p);
      return `${topbar('Times tables')}
        <div class="card"><h3>Pick a game</h3>${opPicker()}</div>
        <div class="card"><h3>Which tables?</h3>${tablePicker(state)}</div>
        <div class="mode-pick">
          <button class="big secondary" data-action="math-start" data-mode="practice">${MODES.practice.emoji} Practice
            <div class="small muted">No timer · half coins · up to ${PRACTICE_MAX_BOX} ★</div></button>
          <button class="big" data-action="math-start" data-mode="speed">${MODES.speed.emoji} Speed
            <div class="small">${state.seconds} seconds each · full coins · master facts</div></button>
        </div>
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
          <span class="pill">🪙 ${p.coins}</span>
        </div>
        <div class="arena">
          <div>${heroHtml(p, 'sm')}<div class="small muted" style="margin-top:6px">${b.combo >= 2 ? `🔥 ${b.combo} in a row` : '&nbsp;'}</div></div>
          <div class="zap">${game.zap || ''}</div>
          <div>
            <span class="monster ${game.anim || ''}">${game.shownMonster.emoji}</span>
            <div class="small"><strong>${esc(game.shownMonster.name)}</strong></div>
            <div class="hp"><div style="width:${(100 * game.shownHp) / game.shownMonster.hp}%"></div></div>
          </div>
        </div>
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
          <div class="keypad">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="secondary" data-action="math-key" data-k="${n}">${n}</button>`).join('')}
            <button class="secondary" data-action="math-key" data-k="del" aria-label="Delete">⌫</button>
            <button class="secondary" data-action="math-key" data-k="0">0</button>
            <button data-action="math-key" data-k="go" aria-label="Enter">${copy ? '🔒' : '⚡'}</button>
          </div>
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
            <span>🪙 +${game.earned.coins}</span><span>⭐ +${game.earned.xp} XP</span><span>👾 ${game.battle.defeated} defeated</span>
          </div>
          <p>${game.right} of ${game.battle.asked} right${game.mode === 'speed' ? ` · ${game.fast} in time` : ''}.</p>
          ${mastered.length ? `<p style="font-size:1.3rem">🌟 <strong>You mastered ${mastered.map((f) => `${esc(f.text)} = ${f.answer}`).join(', ')}!</strong> +${FACT_MASTERY_COINS * mastered.length} 🪙</p>` : ''}
          ${game.unlocked.map((u) => `<p style="font-size:1.2rem">🔓 <strong>The ${u.table}s ${OPS[u.op].symbol} are open in Smart mix!</strong></p>`).join('')}
          ${superProgressHtml(p)}
          ${game.levelUp ? `<p style="font-size:1.3rem"><strong>Level up! You're level ${levelForXp(p.xp)}.</strong> Check the Locker for new stuff.</p>` : ''}
          ${game.mode === 'practice' ? `<p class="small muted">Practice pays half coins. Try ⚡ Speed for full coins and to master facts.</p>` : ''}
        </div>
        ${friendSummaryHtml(game.friendsBefore, p, game.friendEvents)}
        ${
          missed.length
            ? `<div class="card"><h3>Facts to keep practicing</h3><p style="font-size:1.4rem">${missed.map((f) => `${esc(f.text)} = ${f.answer}`).join(' · ')}</p>
               <p class="small muted">These will come back more often, and pay extra coins when you get them right.</p></div>`
            : ''
        }
        <div class="row">
          <button class="big" data-action="math-start" data-mode="${game.mode}">Play again</button>
          <button class="big secondary" data-action="go" data-to="math">🔢 Tables</button>
          <button class="big secondary" data-action="go" data-to="packs">🎁 Packs</button>
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
        <div class="card"><h3>× Multiply</h3><p class="small muted">Row × column. The number is the answer.</p>${mulGrid}</div>
        <div class="card"><h3>÷ Divide</h3><p class="small muted">The number in the box ÷ the row = the column.</p>${divGrid}</div>`;
    },
  };

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
      battle: newBattle(powers, Math.floor(Math.random() * MONSTERS.length)),
      recent: [],
      newUsed: 0,
      missed: new Set(),
      mastered: [],
      unlocked: [],
      right: 0,
      fast: 0,
      earned: { coins: 0, xp: 0 },
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
    Object.assign(game, { fact: f, phase: 'ask', typed: '', usedHint: false, late: false, feedback: '', feedbackClass: '', zap: '', anim: '' });
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

  function showTyped() {
    const el = document.getElementById('math-answer');
    if (el) el.textContent = g().typed || '?';
  }

  function press(k) {
    const game = g();
    if (!game || ui.screen !== 'math-play' || game.phase === 'wait') return;
    if (k === 'go') return submit();
    if (k === 'del') game.typed = game.typed.slice(0, -1);
    else if (game.typed.length < 3) game.typed = game.typed === '0' ? String(k) : game.typed + k;
    showTyped();
  }

  function submit() {
    const game = g();
    if (!game.typed) return;
    const f = game.fact;
    const value = Number(game.typed);
    if (game.phase === 'copy') {
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
    const rec = recordFact(profile(), f.id, result, { mode: game.mode, now: Date.now(), powers: game.powers });
    const grown = afterMathAnswer(rec.profile, rec.battleResult, game.mode === 'practice');
    game.friendEvents.push(...grown.events);
    let p = grown.profile;
    game.earned.coins += rec.coins;
    game.earned.xp += rec.xp;

    // In practice there's no clock, so a right answer is always a full hit.
    const battleResult = game.mode === 'practice' && result !== 'hinted' && right ? 'correct' : rec.battleResult;
    const { battle, events } = applyAnswer(game.battle, battleResult, game.powers);
    const defeated = events.find((e) => e.type === 'defeated');
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
      game.zap = `💥${hit.damage > 1 ? ` ×${hit.damage}` : ''}`;
      game.anim = defeated ? 'down' : 'hit';
      game.feedback = defeated
        ? `You beat ${defeated.monster.name}! ${defeated.monster.emoji}`
        : result === 'slow'
        ? `Right! ${f.text} = ${f.answer}. Faster next time for full coins.`
        : game.mode === 'speed'
        ? `⚡ ${seconds.toFixed(1)}s!`
        : ['Nice!', 'Yes!', 'Great!', 'Boom!'][Math.floor(Math.random() * 4)];
      if (rec.mastered) {
        game.mastered.push(f.id);
        game.earned.coins += FACT_MASTERY_COINS;
        game.feedback = `🌟 You mastered ${f.text} = ${f.answer}! +${FACT_MASTERY_COINS} 🪙`;
      }
      game.feedbackClass = 'good';
      render();
      if (rec.coins) floatText(`+${rec.coins} 🪙`);
      advanceLater(rec.mastered ? 2000 : defeated ? 1200 : result === 'slow' ? 1500 : 650);
    } else {
      game.missed.add(f.id);
      Object.assign(game, {
        phase: 'copy',
        wrongAnswer: game.typed,
        typed: '',
        zap: '',
        feedback: events.some((e) => e.type === 'shielded') ? '🛡️ Your shield stopped the monster from healing.' : '',
        feedbackClass: '',
      });
      render();
    }
  }

  // Number keys on a computer keyboard.
  document.addEventListener('keydown', (e) => {
    if (ui.screen !== 'math-play' || e.metaKey || e.ctrlKey || e.altKey) return;
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
    const row = (t) => {
      const m = tableSummary(s, 'mul', t);
      const dv = t ? tableSummary(s, 'div', t) : null;
      const open = (op) => unlockedTables(s, op).includes(t);
      return `<tr><td><strong>${t}s</strong></td>
        <td>${m.mastered}/${m.total} <span class="small muted">${m.seen ? `${m.seen} tried` : open('mul') ? 'open' : ''}</span></td>
        <td>${dv ? `${dv.mastered}/${dv.total} <span class="small muted">${dv.seen ? `${dv.seen} tried` : open('div') ? 'open' : ''}</span>` : '—'}</td></tr>`;
    };
    return `<div class="card">
      <h3>Times tables for ${esc(kid.name)}</h3>
      <p>${s.mastered} facts mastered · ${s.stats.correct}/${s.stats.answered} right overall</p>
      <div class="row"><span class="small">Speed mode time per question:</span>
        ${SECONDS_CHOICES.map((n) => `<button class="chip ${s.seconds === n ? 'selected' : ''}" data-action="math-seconds" data-id="${kid.id}" data-s="${n}">${n}s</button>`).join('')}</div>
      ${tricky.length ? `<p><strong>Tricky facts:</strong> ${tricky.map((f) => `${esc(f.text)} = ${f.answer} <span class="small muted">(missed ${f.item.misses}×)</span>`).join(' · ')}</p>` : ''}
      <table><tr><th>Table</th><th>× mastered</th><th>÷ mastered</th></tr>${TABLES.map(row).join('')}</table>
      <p class="small muted">Facts 0–12, each with its own 0–${MAX_BOX} star rating like spelling words. Smart mix starts with the easy tables
        (${UNLOCK_ORDER.mul.slice(0, 5).join(', ')}) and opens the next one when most open facts have 2 stars; kids can also pick any single table.
        Practice has no timer, pays half and stops at ${PRACTICE_MAX_BOX} stars. Speed mode pays full, and a right answer only adds a star when it's in time,
        so mastered means fast recall. Each mastered fact pays ${FACT_MASTERY_COINS} coins once, and every ${FACTS_PER_SUPER_STEP} mastered facts fill one Super Pack dot.</p>
    </div>`;
  }

  return { screens, actions, parentHtml, isPlaying: () => ui.screen === 'math-play' };
}
