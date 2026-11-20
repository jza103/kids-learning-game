// Game types. Every game in the app is one of these. Friends specialize in
// one game type (item.specialty in content.js) and their power only works in
// game types they know (see friends.js).
//
// A new game plugs into friends by:
//   1. powers = teamPowersFor(profile, '<type>') at the start of a round
//      (hint / power / shield mean whatever fits that game; xp works with
//      applyXpBoost from progress.js)
//   2. friendsAfterAnswer(profile, '<type>', result, now, { practice }) after
//      every answer, result = 'correct' | 'assisted' | 'wrong'
export const GAME_TYPES = {
  spelling: { id: 'spelling', name: 'Spelling', emoji: '✏️' },
  math: { id: 'math', name: 'Math', emoji: '✖️' },
  vocab: { id: 'vocab', name: 'Vocabulary', emoji: '📚' },
};
export const GAME_TYPE_IDS = Object.keys(GAME_TYPES);
