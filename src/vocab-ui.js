// Word Match screens, actions and grown-ups editor. Kept out of app.js so the
// games can grow side by side; app.js passes in its shared helpers as `ctx`.
import { ACTIVITIES, activityLabel, arenaHtml, zapText, clearedText, missText, animFor, targetsFor, randomStart } from './mine.js';
import { masteryRating, masterySummary, MAX_BOX } from './srs.js';
import { MASTERY_COINS, coinPaceNote } from './economy.js';
import { XP_PER, applyXpBoost, levelForXp } from './progress.js';
import { teamPowersFor, friendsAfterAnswer } from './friends.js';
import { teamLineHtml, friendSummaryHtml } from './friendsui.js';
import { newBattle, applyAnswer } from './battle.js';
import { sayWord, sayBuiltIn, unlockAudio } from './speech.js';
import {
  vocabOf, vocabItems, pickBoard, shuffle, recordMatch, addVocabWord, removeVocabWord, restoreStarterWords,
  vocabEntryWarnings, BOARD_SIZE, BOARDS_PER_ROUND, MAX_NEW_PER_ROUND, MIN_WORDS, VOCAB_COIN_SCALE,
  MAX_WORD_LENGTH, MAX_DEFINITION_LENGTH,
} from './vocab.js';

export const VOCAB_SCREENS = ['vocab', 'vocab-summary'];

// Only friends who know Word Match (by specialty or by learning it) give powers here.
const powersFor = (p) => teamPowersFor(p, 'vocab');

export function createVocab(ctx) {
  const { app, ui, esc } = ctx;
  const g = () => ui.vocab;

  // ---------- game flow ----------
  function start() {
    const p = ctx.profile();
    if (vocabItems(p).length < MIN_WORDS) return;
    unlockAudio();
    const powers = powersFor(p);
    ui.vocab = {
      powers,
      battle: newBattle(powers, randomStart('vocab'), targetsFor('vocab')),
      boardNo: 0,
      newLeft: MAX_NEW_PER_ROUND,
      recent: [],
      missed: new Set(),
      mastered: [],
      earned: { coins: 0, xp: 0, sun: 0, matches: 0, firstTry: 0 },
      startLevel: levelForXp(p.xp),
      friendsBefore: p,
      friendEvents: [],
    };
    nextBoard();
  }

  function nextBoard() {
    const s = g();
    if (s.boardNo >= BOARDS_PER_ROUND) return finish();
    const p = ctx.profile();
    const { words, decoy } = pickBoard(p, Date.now(), Math.random, { recent: s.recent, newLeft: s.newLeft });
    if (words.length < MIN_WORDS) return finish();
    const fresh = words.filter((w) => vocabOf(p).srs[w.id]?.seen === 0);
    s.newLeft = Math.max(0, s.newLeft - fresh.length);
    s.boardNo++;
    s.recent = words.map((w) => w.id);
    s.board = {
      words: shuffle(words),
      defs: shuffle([...words, ...(decoy ? [decoy] : [])].map((w) => ({ id: w.id, definition: w.definition }))),
      matched: [], // word ids matched
      tried: [], // word ids whose first try has been scored
      hidden: [], // meanings taken away by a hint
      pickWord: null,
      pickDef: null,
      wrong: null,
    };
    s.intro = fresh;
    s.phase = fresh.length ? 'intro' : 'match';
    s.feedback = '';
    s.feedbackClass = '';
    s.zap = '';
    s.anim = '';
    s.from = null;
    s.shownMonster = s.battle.monster;
    s.shownHp = s.battle.hp;
    ui.screen = 'vocab';
    ctx.render();
    window.scrollTo(0, 0);
  }

  function finish() {
    const s = g();
    s.levelUp = levelForXp(ctx.profile().xp) > s.startLevel;
    ctx.go('vocab-summary');
  }

  function tryMatch() {
    const s = g();
    const b = s.board;
    if (!b.pickWord || !b.pickDef) return;
    const wordId = b.pickWord;
    const defId = b.pickDef;
    b.pickWord = b.pickDef = null;
    const correct = wordId === defId;
    const firstTry = !b.tried.includes(wordId);
    s.zap = '';
    s.anim = '';
    s.from = null;
    b.wrong = null;
    let rec = null;
    let events = [];
    if (firstTry) {
      b.tried.push(wordId);
      const result = correct ? 'correct' : 'wrong';
      const now = Date.now();
      rec = recordMatch(ctx.profile(), wordId, result, now, s.powers);
      const grown = friendsAfterAnswer(rec.profile, 'vocab', result, now);
      s.friendEvents.push(...grown.events);
      let p = grown.profile;
      s.earned.coins += rec.coins;
      s.earned.sun += rec.sun || 0;
      s.earned.xp += rec.xp;
      const out = applyAnswer(s.battle, result, s.powers);
      events = out.events;
      const defeated = events.find((e) => e.type === 'defeated');
      s.from = (s.shownMonster.hp - s.shownHp) / s.shownMonster.hp;
      s.anim = animFor(events);
      s.shownMonster = defeated ? s.battle.monster : out.battle.monster;
      s.shownHp = defeated ? 0 : out.battle.hp;
      s.battle = out.battle;
      if (defeated) {
        const bonus = applyXpBoost(XP_PER.monster, s.powers);
        p = { ...p, xp: p.xp + bonus };
        s.earned.xp += bonus;
      }
      ctx.update(p);
    }
    if (correct) {
      b.matched.push(wordId);
      s.earned.matches++;
      if (firstTry) s.earned.firstTry++;
      const word = b.words.find((w) => w.id === wordId);
      const defeated = events.find((e) => e.type === 'defeated');
      const hit = events.find((e) => e.type === 'hit');
      if (hit) s.zap = zapText('vocab', hit.damage);
      s.feedback = defeated
        ? clearedText('vocab', defeated.monster)
        : firstTry
        ? ['Match!', 'Yes!', 'You got it!', 'Nice one!'][Math.floor(Math.random() * 4)]
        : `That's it: ${word.word}.`;
      s.feedbackClass = 'good';
      if (rec?.shards && !defeated) s.feedback = `✨ Polished back to shiny! +${rec.shards} 💎`;
      if (rec?.mastered) {
        s.mastered.push(wordId);
        s.earned.coins += MASTERY_COINS;
        s.feedback = `🌟 You mastered “${word.word}”! +${MASTERY_COINS} 🟡`;
      }
      if (b.matched.length === b.words.length) {
        s.phase = 'cleared';
        ctx.render();
        if (rec?.coins) ctx.floatText(`+${rec.coins} 🟡`);
        const here = s;
        setTimeout(() => ui.vocab === here && ui.screen === 'vocab' && nextBoard(), rec?.mastered ? 2200 : 1300);
        return;
      }
      ctx.render();
      if (rec?.coins) ctx.floatText(`+${rec.coins} 🟡`);
    } else {
      if (firstTry) s.missed.add(wordId);
      b.wrong = { wordId, defId };
      s.feedback = missText('vocab', events);
      s.feedbackClass = 'bad';
      ctx.render();
    }
  }

  // ---------- screens ----------
  function topHtml() {
    const s = g();
    const p = ctx.profile();
    const b = s.battle;
    return `<div class="topbar">
        <button class="secondary" data-action="vocab-end">Done</button>
        <span class="pill">Board ${s.boardNo} of ${BOARDS_PER_ROUND}</span>
        <span class="pill">🟡 ${p.coins}</span>
      </div>
      ${arenaHtml('vocab', { hero: ctx.heroHtml(p), combo: b.combo, zap: s.zap, anim: s.anim, target: s.shownMonster, hp: s.shownHp, from: s.from })}`;
  }

  function introHtml() {
    const s = g();
    return `<div class="card vocab-intro">
      <h3>${s.intro.length === 1 ? 'A new word!' : 'New words!'}</h3>
      <p class="small muted">Read these, then sort them into the right crates.</p>
      ${s.intro
        .map(
          (w) => `<div class="intro-word"><button type="button" class="ghost" data-action="vocab-say" data-id="${esc(w.id)}" aria-label="Hear ${esc(w.word)}">🔊</button>
            <div><strong>${esc(w.word)}</strong><div>${esc(w.definition)}</div></div></div>`,
        )
        .join('')}
      <button class="big" style="width:100%;margin-top:12px" data-action="vocab-go">Let's sort! 🪣</button>
    </div>`;
  }

  function boardHtml() {
    const s = g();
    const b = s.board;
    const wordOf = (id) => b.words.find((w) => w.id === id);
    const wordTiles = b.words
      .map((w) => {
        const done = b.matched.includes(w.id);
        const cls = ['tile', 'word', done && 'done', b.pickWord === w.id && 'picked', b.wrong?.wordId === w.id && 'shake'].filter(Boolean).join(' ');
        return `<button type="button" class="${cls}" data-action="vocab-word" data-id="${esc(w.id)}" ${done ? 'disabled' : ''}>${done ? '✓ ' : ''}${esc(w.word)}</button>`;
      })
      .join('');
    const defTiles = b.defs
      .filter((d) => !b.hidden.includes(d.id))
      .map((d) => {
        const done = b.matched.includes(d.id);
        const cls = ['tile', 'def', done && 'done', b.pickDef === d.id && 'picked', b.wrong?.defId === d.id && 'shake'].filter(Boolean).join(' ');
        return `<button type="button" class="${cls}" data-action="vocab-def" data-id="${esc(d.id)}" ${done ? 'disabled' : ''}>
          ${done ? `<span class="tag">✓ ${esc(wordOf(d.id).word)}</span> ` : ''}${esc(d.definition)}</button>`;
      })
      .join('');
    const canHint = s.phase === 'match' && s.battle.hintsLeft > 0 && b.words.length - b.matched.length >= 2;
    return `<div class="card">
      <p class="small muted" style="text-align:center;margin-top:0">${s.phase === 'cleared' ? 'All sorted! ✨' : 'Tap a word chunk, then the crate with what it means.'}</p>
      <div class="match">
        <div class="match-words">${wordTiles}</div>
        <div class="match-defs">${defTiles}</div>
      </div>
      <div class="feedback ${s.feedbackClass || ''}">${esc(s.feedback || '')}</div>
      <div class="row" style="justify-content:center">
        ${canHint ? `<button type="button" class="secondary" data-action="vocab-hint">💡 Hint (${s.battle.hintsLeft})</button>` : ''}
        <button type="button" class="ghost" data-action="vocab-read">🔊 Read the meanings</button>
      </div>
    </div>`;
  }

  /** A hint takes away one meaning that doesn't belong to any word left. */
  function hintTarget() {
    const b = g().board;
    const left = new Set(b.words.filter((w) => !b.matched.includes(w.id)).map((w) => w.id));
    return b.defs.find((d) => !left.has(d.id) && !b.matched.includes(d.id) && !b.hidden.includes(d.id)) ||
      // No spare meaning: take away a wrong one for the picked word instead.
      (b.pickWord && b.defs.find((d) => left.has(d.id) && d.id !== b.pickWord && !b.hidden.includes(d.id) && left.size > 2)) ||
      null;
  }

  const screens = {
    vocab() {
      const s = g();
      const p = ctx.profile();
      return `${topHtml()}
        ${s.phase === 'intro' ? introHtml() : boardHtml()}
        <p class="small muted" style="text-align:center">${teamLineHtml(p, 'vocab')}</p>`;
    },
    'vocab-summary'() {
      const s = g();
      const p = ctx.profile();
      const v = vocabOf(p);
      const byId = Object.fromEntries(v.words.map((w) => [w.id, w]));
      const missed = [...s.missed].map((id) => byId[id]).filter(Boolean);
      const mastered = s.mastered.map((id) => byId[id]).filter(Boolean);
      return `<h1>Sorting done! 🪣</h1>
        <div class="card">
          <div class="row" style="font-size:1.3rem;gap:24px">
            <span>🟡 +${s.earned.coins}</span><span>⭐ +${s.earned.xp} XP</span>${s.earned.sun ? `<span>☀️ +${s.earned.sun}</span>` : ''}<span>🎯 ${s.earned.firstTry}/${s.battle.asked} first try</span><span>${ACTIVITIES.vocab.count(s.battle.defeated)}</span>
          </div>
          ${mastered.length ? `<p style="font-size:1.3rem">🌟 <strong>You mastered ${mastered.map((w) => `“${esc(w.word)}”`).join(', ')}!</strong> +${MASTERY_COINS * mastered.length} 🟡</p>` : ''}
          ${ctx.superProgressHtml(p)}
          ${coinPaceNote(p, Date.now()) ? `<p class="small muted">${coinPaceNote(p, Date.now())}</p>` : ''}
          ${s.levelUp ? `<p style="font-size:1.3rem"><strong>Level up! You're level ${levelForXp(p.xp)}.</strong> Check the Locker for new stuff.</p>` : ''}
        </div>
        ${friendSummaryHtml(s.friendsBefore, p, s.friendEvents)}
        ${
          missed.length
            ? `<div class="card"><h3>Words to keep learning</h3>
               ${missed.map((w) => `<p><strong>${esc(w.word)}</strong>: ${esc(w.definition)}</p>`).join('')}
               <p class="small muted">These come back more often, and pay extra nuggets when you match them.</p></div>`
            : ''
        }
        <div class="row">
          <button class="big" data-action="vocab-play">Play again</button>
          <button class="big secondary" data-action="go" data-to="packs">🎁 Packs</button>
          <button class="big secondary" data-action="go" data-to="hub">Home</button>
        </div>`;
    },
  };

  // ---------- actions ----------
  const actions = {
    'vocab-play': () => start(),
    'vocab-end': () => (g().battle.asked ? finish() : ctx.go('hub')),
    'vocab-go': () => {
      g().phase = 'match';
      ctx.render();
    },
    'vocab-say': (d) => {
      unlockAudio();
      const w = vocabOf(ctx.profile()).words.find((x) => x.id === d.id);
      if (w) sayBuiltIn(w.word, w.definition);
    },
    'vocab-word': (d) => {
      const s = g();
      if (s.phase !== 'match') return;
      unlockAudio();
      const b = s.board;
      b.pickWord = b.pickWord === d.id ? null : d.id;
      b.wrong = null;
      if (b.pickWord) sayWord(b.words.find((w) => w.id === d.id).word);
      if (b.pickWord && b.pickDef) return tryMatch();
      ctx.render();
    },
    'vocab-def': (d) => {
      const s = g();
      if (s.phase !== 'match') return;
      const b = s.board;
      b.pickDef = b.pickDef === d.id ? null : d.id;
      b.wrong = null;
      if (b.pickWord && b.pickDef) return tryMatch();
      ctx.render();
    },
    'vocab-hint': () => {
      const s = g();
      if (s.battle.hintsLeft <= 0) return;
      const target = hintTarget();
      if (!target) {
        s.feedback = '💡 Tap a word first, then use the hint.';
        s.feedbackClass = '';
        return ctx.render();
      }
      s.battle = { ...s.battle, hintsLeft: s.battle.hintsLeft - 1 };
      s.board.hidden.push(target.id);
      if (s.board.pickDef === target.id) s.board.pickDef = null;
      s.feedback = '💡 One meaning taken away.';
      s.feedbackClass = '';
      ctx.render();
    },
    'vocab-read': () => {
      unlockAudio();
      const b = g().board;
      sayBuiltIn(...b.defs.filter((d) => !b.matched.includes(d.id) && !b.hidden.includes(d.id)).map((d) => d.definition));
    },
    // Grown-ups editor
    'vocab-edit': (d) => {
      const kid = ctx.parentKid();
      const w = kid && vocabOf(kid).words.find((x) => x.id === d.id);
      const form = app.querySelector('[data-form="vocab-add"]');
      if (!w || !form) return;
      form.word.value = w.word;
      form.definition.value = w.definition;
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      form.definition.focus();
      showTips(form);
    },
    'vocab-remove': (d) => {
      const kid = ctx.parentKid();
      const w = kid && vocabOf(kid).words.find((x) => x.id === d.id);
      if (!w || !confirm(`Delete “${w.word}” from ${kid.name}'s Word Match words? Its stars are erased. Nuggets and friends already earned stay.`)) return;
      ctx.update(removeVocabWord(kid, d.id));
      ctx.render();
    },
    'vocab-hear': (d) => {
      const w = vocabOf(ctx.parentKid()).words.find((x) => x.id === d.id);
      if (w) {
        unlockAudio();
        sayBuiltIn(w.word, w.definition);
      }
    },
    'vocab-restore': () => {
      const kid = ctx.parentKid();
      const r = restoreStarterWords(kid, Date.now());
      ctx.update(r.profile);
      ui.flash = r.restored ? `Put back ${r.restored} starter word${r.restored === 1 ? '' : 's'} for ${kid.name}.` : 'All the starter words are already there.';
      ctx.render();
    },
    'vocab-toggle-list': () => {
      ui.vocabListOpen = !ui.vocabListOpen;
      ctx.render();
    },
  };

  function showTips(form) {
    const tips = vocabEntryWarnings({ word: form.word.value, definition: form.definition.value });
    const el = form.querySelector('.vocab-tips');
    if (el) el.innerHTML = tips.map((t) => `<div class="warn">⚠️ ${esc(t)}</div>`).join('');
  }

  app.addEventListener('input', (e) => {
    const form = e.target.closest?.('[data-form="vocab-add"]');
    if (form) showTips(form);
  });

  app.addEventListener('submit', (e) => {
    const form = e.target;
    if (form.dataset.form !== 'vocab-add') return;
    e.preventDefault();
    const kid = ctx.parentKid();
    if (!kid) return;
    try {
      const r = addVocabWord(kid, { word: form.word.value, definition: form.definition.value }, Date.now());
      ctx.update(r.profile);
      const word = form.word.value.trim();
      ui.vocabFlash = r.added ? `Added “${word}” for ${kid.name}.` : `Updated the meaning of “${word}”. Its stars are kept.`;
      ctx.render();
      const again = app.querySelector('[data-form="vocab-add"]');
      again?.word.focus();
    } catch (err) {
      const el = form.querySelector('.vocab-tips');
      if (el) el.innerHTML = `<div class="warn">⚠️ ${esc(err.message)}</div>`;
    }
  });

  /** The Word Match card on the grown-ups screen. */
  function parentHtml(kid) {
    const v = vocabOf(kid);
    const items = vocabItems(kid);
    const sum = masterySummary(items);
    const stats = kid.vocabStats || { answered: 0, correct: 0 };
    const flash = ui.vocabFlash;
    ui.vocabFlash = '';
    const sorted = [...v.words].sort((a, b) => (b.starter ? 0 : 1) - (a.starter ? 0 : 1) || (b.addedAt - a.addedAt) || ((a.order ?? 0) - (b.order ?? 0)));
    const open = ui.vocabListOpen || v.words.length <= 12;
    return `<div class="card" id="vocab-parent">
      <h3>🧩 Word Match words for ${esc(kid.name)}</h3>
      <p class="small muted">Kids match each word to its meaning by tapping, with no typing. It comes with ${v.words.filter((w) => w.starter).length ? 'third-grade starter words' : 'no starter words left'}; add your own below.
        New words come in a few at a time, and each word earns 0–${MAX_BOX} stars like spelling words. Mastered words count toward Super Packs too.</p>
      ${flash ? `<p class="good-note">${esc(flash)}</p>` : ''}
      <form data-form="vocab-add" class="vocab-form" autocomplete="off">
        <label>Word<input type="text" name="word" maxlength="${MAX_WORD_LENGTH}" placeholder="e.g. brave" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
        <label>What it means<input type="text" name="definition" maxlength="${MAX_DEFINITION_LENGTH}" placeholder="e.g. not afraid to do hard things" enterkeyhint="done"></label>
        <button type="submit">Add word</button>
        <div class="vocab-tips"></div>
      </form>
      <p class="small muted">Tip: write the meaning the way you'd explain it to your kid, and don't use the word itself. Adding a word that's already there changes its meaning and keeps its stars. ✎ edits a word.</p>
      <p>${v.words.length} words · ${sum.mastered} mastered · ${sum.learning} learning · ${sum.new} not tried yet${stats.answered ? ` · ${stats.correct}/${stats.answered} matched first try` : ''}</p>
      ${
        open
          ? `<table class="vocab-table"><tr><th>Word</th><th>Meaning</th><th>Stars</th><th></th></tr>
            ${sorted
              .map((w) => {
                const i = v.srs[w.id];
                return `<tr><td><strong>${esc(w.word)}</strong></td><td class="small">${esc(w.definition)}</td>
                  <td>${ctx.starsHtml(i)}<div class="small muted">${masteryRating(i).label}</div></td>
                  <td class="nowrap"><button class="ghost" data-action="vocab-hear" data-id="${esc(w.id)}" aria-label="Hear ${esc(w.word)}">🔊</button><button class="ghost" data-action="vocab-edit" data-id="${esc(w.id)}" aria-label="Edit ${esc(w.word)}">✎</button><button class="ghost" data-action="vocab-remove" data-id="${esc(w.id)}" aria-label="Delete ${esc(w.word)}">✕</button></td></tr>`;
              })
              .join('')}</table>
            ${v.words.length > 12 ? '<button class="ghost" data-action="vocab-toggle-list">Hide the list</button>' : ''}`
          : `<button class="secondary" data-action="vocab-toggle-list">Show all ${v.words.length} words</button>`
      }
      <div class="row" style="margin-top:8px"><button class="ghost" data-action="vocab-restore">Put back deleted starter words</button></div>
      <p class="small muted">Nuggets: a first-try match pays ${Math.round(VOCAB_COIN_SCALE * 100)}% of what a spelled word pays (shaky words pay more, mastered words less). A board has ${BOARD_SIZE} words plus one extra meaning, so the last match isn't a free guess.</p>
    </div>`;
  }

  /** The Word Match button on the hub. */
  function hubButton(p) {
    const n = vocabItems(p).length;
    return `<button class="big secondary" style="width:100%;margin-bottom:16px" data-action="vocab-play" ${n >= MIN_WORDS ? '' : 'disabled'}>${activityLabel('vocab')}</button>`;
  }

  return { screens, actions, parentHtml, hubButton };
}
