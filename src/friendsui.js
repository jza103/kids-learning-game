// HTML snippets for friend growth, shared by every game's screens.
// Spelling uses them in app.js; math and vocab can reuse them:
//   teamLineHtml(profile, gameType)          - under the play area
//   friendSummaryHtml(before, after, events) - on the round summary
import { POWER_INFO } from './content.js';
import { GAME_TYPES } from './games.js';
import {
  friendInfo, teamStatus, friendGains, STAGES, DAILY_FRIEND_XP, DAILY_TRAINING, TRAINING_TO_LEARN,
  LEARNING_XP_BONUS, MAX_BUDDY_BOOST, PRACTICE_SCALE,
} from './friends.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const gt = (id) => GAME_TYPES[id] || { name: id, emoji: '❔' };

/** Specialty, level, evolution and learning progress for an owned friend's card. */
export function friendDetailsHtml(profile, id) {
  const f = friendInfo(profile, id);
  const knows = f.knows.map((g) => `<span class="gt" title="${gt(g).name}">${gt(g).emoji} ${gt(g).name}</span>`).join(' ');
  const training = Object.entries(f.train)
    .filter(([g]) => !f.knows.includes(g))
    .map(([g, n]) => `<div class="small">Learning ${gt(g).emoji} ${gt(g).name}: ${n}/${TRAINING_TO_LEARN}</div>`)
    .join('');
  return `<div class="friend-meta">
    <div class="small"><strong>${f.stage.badge} ${f.stage.name}</strong> · Lv ${f.level}</div>
    <div class="xpbar sm"><div style="width:${f.maxed ? 100 : (100 * f.into) / f.needed}%"></div></div>
    <div class="small muted">${POWER_INFO[f.item.power].label}: ${POWER_INFO[f.item.power].describe(f.strength)}</div>
    <div class="small">Helps in: ${knows}</div>
    ${training}
    ${f.tiredToday ? '<div class="small muted">😴 Sleepy: more XP tomorrow</div>' : ''}
  </div>`;
}

/** One line per team friend: helping in this game, or learning it. */
export function teamLineHtml(profile, gameType) {
  const status = teamStatus(profile, gameType);
  if (!status.length) return 'Team: none yet. Add friends from your collection for powers!';
  const parts = status.map((s) =>
    s.helps
      ? `${s.item.emoji} helping`
      : s.canLearn
      ? `${s.item.emoji} learning ${gt(gameType).emoji} ${s.training}/${TRAINING_TO_LEARN}`
      : `${s.item.emoji} along for fun`,
  );
  return `Team: ${parts.join(' · ')}`;
}

/** Friend XP, level ups, evolutions and new skills from one round. */
export function friendSummaryHtml(before, after, events = []) {
  const gains = friendGains(before, after);
  if (!gains.length) return '';
  const big = events
    .map((e) => {
      const f = friendInfo(after, e.id);
      if (e.type === 'evolve') return `<p class="friend-event">${f.stage.badge} <strong>${esc(f.item.name)} became a ${e.stage}!</strong> ${f.item.emoji} Its power got stronger.</p>`;
      if (e.type === 'learned') return `<p class="friend-event">🎓 <strong>${esc(f.item.name)} learned ${gt(e.gameType).name}!</strong> Its power now works there too.</p>`;
      return '';
    })
    .join('');
  const rows = gains
    .map(({ id, xp }) => {
      const f = friendInfo(after, id);
      const up = events.some((e) => e.type === 'level' && e.id === id);
      return `<span class="pill">${f.item.emoji} +${xp} XP · Lv ${f.level}${up ? ' ⬆️' : ''}${f.tiredToday ? ' 😴' : ''}</span>`;
    })
    .join(' ');
  return `<div class="card"><h3>Your friends</h3>${big}<div class="row">${rows}</div></div>`;
}

/** How friends grow, for the Collection screen. Numbers come from friends.js. */
export function friendsHelpHtml() {
  return `<div class="card small">
    <h3>How friends grow</h3>
    <p>Every friend is best at one game: ✏️ Spelling, ✖️ Math or 📚 Vocabulary. Its power only works in the games it knows.</p>
    <p>Bring a friend to a game it doesn't know and it <strong>learns</strong>: it gets ${Math.round((LEARNING_XP_BONUS - 1) * 100)}% more XP, and after ${TRAINING_TO_LEARN} correct answers there (up to ${DAILY_TRAINING} a day) its power works in that game too.</p>
    <p>Friends on your team get XP from your answers and level up. At level ${STAGES[1].level} they become <strong>✨ Super Friends</strong> and at level ${STAGES[2].level} <strong>💖 Best Friends</strong>. Each step makes their power stronger, and Best Friends can learn every game.</p>
    <p class="muted">Each friend can get ${DAILY_FRIEND_XP} XP a day, then it's 😴 sleepy until tomorrow. Friend boost adds up to +${MAX_BUDDY_BOOST * 100}%. Practice modes give ${PRACTICE_SCALE * 100}% XP.</p>
  </div>`;
}
