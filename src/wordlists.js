// Word lists library: built-in lists plus lists a grown-up loads from a file
// or pastes in (a teacher's list can come in almost any shape). A list holds
// spelling words (with optional sentences) and Word Match words (with
// meanings). A list file can also carry ready-made AI voice audio, so a parent
// makes the voices once and loads the same file on every device.
import { cleanEntries, wordKey } from './profile.js';
import { BUILTIN_LISTS, BUILTIN_BY_ID } from './word-lists-builtin.js';

export const FILE_TYPE = 'klg-word-lists';
export const FILE_VERSION = 1;
export const MAX_WORDS_PER_LIST = 200;
export const MAX_WORD = 40;
export const MAX_TEXT = 160;

// ---------- library ----------
export function libraryOf(data) {
  return { lists: [], ...(data.library || {}) };
}

/** Built-in lists first (by grade and week), then the grown-up's own lists. */
export function allLists(data) {
  return [...BUILTIN_LISTS, ...libraryOf(data).lists];
}

export function findList(data, id) {
  return BUILTIN_BY_ID[id] || libraryOf(data).lists.find((l) => l.id === id) || null;
}

/** A stable id for an imported list, from its name. */
export function listIdFor(name) {
  return `my-${wordKey(name || 'list').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'list'}`;
}

/**
 * Save lists to the library. A list with the same name as one already there
 * replaces it (so a teacher's updated list just loads over the old one).
 * Built-in lists in a file are skipped: they're already in the app.
 */
export function saveLists(data, lists, now) {
  const lib = libraryOf(data);
  const out = [...lib.lists];
  let added = 0;
  let replaced = 0;
  for (const l of lists) {
    if (BUILTIN_BY_ID[l.id]) continue;
    const clean = tidyList(l);
    if (!clean.spelling.length && !clean.vocab.length) continue;
    const id = listIdFor(clean.name);
    const i = out.findIndex((x) => x.id === id);
    const entry = { ...clean, id, addedAt: now };
    if (i >= 0) {
      out[i] = entry;
      replaced++;
    } else {
      out.push(entry);
      added++;
    }
  }
  return { data: { ...data, library: { ...lib, lists: out } }, added, replaced };
}

export function deleteList(data, id) {
  const lib = libraryOf(data);
  return { ...data, library: { ...lib, lists: lib.lists.filter((l) => l.id !== id) } };
}

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Trim fields, drop blanks and repeats, cap sizes. */
export function tidyList(l) {
  const spelling = cleanEntries((l.spelling || []).map((e) => ({ word: clip(e.word, MAX_WORD), sentence: clip(e.sentence, MAX_TEXT) }))).slice(0, MAX_WORDS_PER_LIST);
  const seen = new Set();
  const vocab = [];
  for (const e of l.vocab || []) {
    const word = clip(e.word, MAX_WORD);
    const definition = clip(e.definition, MAX_TEXT);
    if (!word || !definition || seen.has(wordKey(word))) continue;
    seen.add(wordKey(word));
    vocab.push({ word, definition });
  }
  const grade = Number.parseInt(l.grade, 10);
  return {
    name: clip(l.name, 60) || 'My list',
    ...(grade >= 0 && grade <= 12 ? { grade } : {}),
    ...(l.topic ? { topic: clip(l.topic, 60) } : {}),
    spelling,
    vocab: vocab.slice(0, MAX_WORDS_PER_LIST),
  };
}

/** Remember that a kid was given a list, so the library can show it. */
export function markUsed(profile, listId, part, now) {
  const used = { ...(profile.listsUsed || {}) };
  used[listId] = { ...(used[listId] || {}), [part]: now };
  return { ...profile, listsUsed: used };
}

// ---------- list files (export) ----------
/**
 * A list file: { type, version, lists, audio? }. audio is
 * { voiceId, voiceName, clips: { clipId: base64 mp3 } }.
 */
export function makeListFile(lists, audio = null) {
  const file = {
    type: FILE_TYPE,
    version: FILE_VERSION,
    lists: lists.map((l) => ({ ...tidyList(l), ...(l.builtIn ? { id: l.id } : {}) })),
  };
  if (audio && Object.keys(audio.clips || {}).length) file.audio = audio;
  return file;
}

// ---------- reading what a grown-up loads ----------
const WORD_KEYS = ['word', 'words', 'spelling', 'spelling word', 'term', 'vocab', 'vocabulary', 'vocabulary word', 'name'];
const SENTENCE_KEYS = ['sentence', 'example', 'example sentence', 'sentences', 'usage', 'context'];
const DEF_KEYS = ['definition', 'meaning', 'def', 'means', 'definitions', 'meanings', 'what it means'];
const GROUP_KEYS = ['week', 'list', 'unit', 'lesson', 'set', 'group'];
const GRADE_KEYS = ['grade', 'grade level'];
const KIND_KEYS = ['type', 'kind', 'category'];

const lc = (s) => String(s ?? '').trim().toLowerCase();

/** True when `text` uses `word` (or a form like word+s/ed/ing), so it's a sentence, not a meaning. */
export function usesWord(text, word) {
  const w = lc(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!w) return false;
  return new RegExp(`(^|[^\\p{L}'])${w}`, 'u').test(lc(text));
}

/** Split a list line that has a word and something after it. */
function splitLine(line) {
  for (const sep of ['\t', '|', ' – ', ' — ', ' - ', ' = ', ': ', ' : ']) {
    const i = line.indexOf(sep);
    if (i > 0) {
      const left = line.slice(0, i).trim();
      if (left.split(/\s+/).length <= 3) return [left, line.slice(i + sep.length).trim()];
    }
  }
  const dash = line.match(/^(\S+(?:\s\S+)?)\s*[-–—]\s*(.+)$/);
  if (dash) return [dash[1], dash[2]];
  return null;
}

/** A tiny CSV row reader that understands "quoted, fields". */
export function csvRow(line, delim = ',') {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"' && !cur.trim()) q = true;
    else if (c === delim) {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const stripMarker = (s) => s.replace(/^\s*(\(?\d+[.)]|[-*•●▪◦]|\[\s?\]|[a-z][.)](?=\s))\s*/i, '').trim();

/** A line that starts a new list or section, like "Week 2", "Spelling words:" or "Unit 3 Lesson 1". */
function headingOf(line) {
  const s = line.replace(/[:\-–—]+\s*$/, '').trim();
  if (!s || s.split(/\s+/).filter((t) => /\w/.test(t)).length > 9) return null;
  const l = s.toLowerCase();
  const section = /\bvocab|vocabulary|definitions|meanings\b/.test(l) ? 'vocab' : /\bspelling\b/.test(l) ? 'spelling' : null;
  const group = /^(week|list|unit|lesson|set|grade|chapter|module)\b\s*[\w#.-]*/i.test(s) || /\b(week|list|unit|lesson)\s*#?\d+/i.test(s);
  const gradeMatch = l.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*grade\b|\bgrade\s*(\d{1,2})\b/);
  if (!section && !group && !/[:]$/.test(line.trim())) return null;
  if (!section && !group && !gradeMatch) return null;
  return { section, group: group ? s : null, grade: gradeMatch ? Number(gradeMatch[1] || gradeMatch[2]) : null };
}

function newGroup(name, grade = null) {
  return { name, grade, rows: [] };
}

/**
 * Read a list from almost any shape of text: our own list file, other JSON,
 * CSV or TSV (with or without a header row), or plain lines like
 * "because", "1. because - We stayed in because it rained." or
 * "brave: not afraid". Headings like "Week 2" start a new list, and
 * "Spelling words" / "Vocabulary" headings say what follows.
 *
 * kind: 'auto' | 'spelling' | 'vocab'. In auto, the text after a word is a
 * sentence if it uses the word, otherwise a meaning.
 * Returns { lists, audio, skipped, builtIn } (builtIn: true for our own file).
 */
export function parseListText(text, { kind = 'auto', name = '', grade = null } = {}) {
  const raw = String(text || '').replace(/^﻿/, '').trim();
  if (!raw) return { lists: [], audio: null, skipped: [] };
  if (/^[[{]/.test(raw)) {
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      json = undefined;
    }
    if (json !== undefined) return fromJson(json, { kind, name, grade });
  }
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
  const tabs = lines.filter((l) => l.includes('\t')).length;
  const delim = tabs >= lines.length / 2 ? '\t' : lines.filter((l) => l.includes(',')).length >= lines.length / 2 ? ',' : lines.filter((l) => l.includes(';')).length >= lines.length / 2 ? ';' : null;
  const header = delim ? csvRow(lines[0], delim).map(lc) : [];
  const hasHeader = header.some((h) => WORD_KEYS.includes(h)) && header.some((h) => [...SENTENCE_KEYS, ...DEF_KEYS, ...GROUP_KEYS, ...GRADE_KEYS, ...WORD_KEYS].includes(h));
  if (delim && hasHeader) return fromTable(lines.slice(1).map((l) => csvRow(l, delim)), header, { kind, name, grade });

  // One line of comma-separated words: "cat, hat, bat".
  if (lines.length === 1 && lines[0].includes(',')) {
    const parts = csvRow(lines[0]).filter(Boolean);
    if (parts.every((p) => p.split(/\s+/).length <= 3)) return finish([{ ...newGroup(name, grade), rows: parts.map((w) => ({ word: w, extra: '' })) }], kind, name, grade);
  }

  const groups = [newGroup(name, grade)];
  let section = kind === 'auto' ? null : kind;
  const skipped = [];
  for (const rawLine of lines) {
    const line = stripMarker(rawLine);
    if (!line) continue;
    const head = headingOf(line);
    const g = groups[groups.length - 1];
    if (head && !(delim && csvRow(line, delim).length > 1 && !head.group)) {
      if (head.group) {
        if (g.rows.length || g.name) groups.push(newGroup(head.group, head.grade ?? g.grade));
        else Object.assign(g, { name: head.group, grade: head.grade ?? g.grade });
      } else if (head.grade != null) g.grade = head.grade;
      if (head.section && kind === 'auto') section = head.section;
      continue;
    }
    let pair = delim ? csvRow(line, delim) : null;
    if (pair && pair.length > 1) pair = [pair[0], pair.slice(1).filter(Boolean).join(delim === ',' ? ', ' : ' ')];
    else pair = splitLine(line) || [line, ''];
    let [word, extra] = pair;
    word = word.replace(/^["']|["']$/g, '').trim();
    // Several words on one line: "cat, hat, bat".
    if (!extra && word.includes(',') && word.split(',').every((p) => p.trim() && p.trim().split(/\s+/).length <= 2)) {
      for (const w of word.split(',')) g.rows.push({ word: w.trim(), extra: '', section });
      continue;
    }
    // A long line with no word in front: the sentence or meaning for the word above.
    if (!extra && word.split(/\s+/).length > 3) {
      const prev = g.rows[g.rows.length - 1];
      if (prev && !prev.extra) prev.extra = word;
      else skipped.push(rawLine.trim());
      continue;
    }
    g.rows.push({ word, extra, section });
  }
  const out = finish(groups, kind, name, grade);
  return { ...out, skipped: [...skipped, ...out.skipped] };
}

/** Turn rows of { word, extra, section, sentence, definition } into lists. */
function finish(groups, kind, name, grade) {
  const lists = [];
  const skipped = [];
  groups.forEach((g, i) => {
    const spelling = [];
    const vocab = [];
    for (const r of g.rows) {
      const word = String(r.word || '').trim();
      if (!word) continue;
      if (word.split(/\s+/).length > 3 || word.length > MAX_WORD) {
        skipped.push(word);
        continue;
      }
      let sentence = r.sentence || '';
      let definition = r.definition || '';
      const as = kind !== 'auto' ? kind : r.kind || r.section || null;
      if (r.extra) {
        if (as === 'spelling') sentence = r.extra;
        else if (as === 'vocab') definition = r.extra;
        else if (usesWord(r.extra, word)) sentence = r.extra;
        else definition = r.extra;
      }
      if (kind === 'spelling') spelling.push({ word, sentence });
      else if (kind === 'vocab' || as === 'vocab') {
        if (definition) vocab.push({ word, definition });
        else skipped.push(`${word} (no meaning)`);
      } else {
        if (definition) vocab.push({ word, definition });
        if (sentence || !definition) spelling.push({ word, sentence });
      }
    }
    if (!spelling.length && !vocab.length) return;
    const base = name || g.name || 'My list';
    const listName = g.name && name && g.name !== name ? `${name} · ${g.name}` : groups.length > 1 && !g.name ? `${base} ${i + 1}` : base;
    lists.push(tidyList({ name: listName, grade: g.grade ?? grade, spelling, vocab }));
  });
  return { lists, audio: null, skipped };
}

function pick(obj, keys) {
  for (const k of Object.keys(obj)) if (keys.includes(lc(k))) return obj[k];
  return undefined;
}

function fromTable(rows, header, { kind, name, grade }) {
  const col = (keys) => header.findIndex((h) => keys.includes(h));
  const iw = col(WORD_KEYS);
  const is = col(SENTENCE_KEYS);
  const id = col(DEF_KEYS);
  const ig = col(GROUP_KEYS);
  const igr = col(GRADE_KEYS);
  const ik = col(KIND_KEYS);
  const groups = new Map();
  for (const r of rows) {
    const gname = ig >= 0 && r[ig] ? `${/^\d+$/.test(r[ig]) ? `${header[ig][0].toUpperCase()}${header[ig].slice(1)} ` : ''}${r[ig]}` : '';
    if (!groups.has(gname)) groups.set(gname, newGroup(gname, igr >= 0 ? Number.parseInt(r[igr], 10) || grade : grade));
    const k = ik >= 0 ? lc(r[ik]) : '';
    groups.get(gname).rows.push({
      word: r[iw],
      sentence: is >= 0 ? r[is] : '',
      definition: id >= 0 ? r[id] : '',
      kind: /vocab|meaning|def/.test(k) ? 'vocab' : /spell/.test(k) ? 'spelling' : null,
    });
  }
  return { ...finish([...groups.values()], kind, name, grade), audio: null };
}

function rowFromJson(e) {
  if (typeof e === 'string') return { word: e };
  if (Array.isArray(e)) return { word: e[0], extra: e.slice(1).join(' ') };
  if (e && typeof e === 'object') return { word: pick(e, WORD_KEYS), sentence: pick(e, SENTENCE_KEYS) || '', definition: pick(e, DEF_KEYS) || '' };
  return { word: '' };
}

function fromJson(json, { kind, name, grade }) {
  // Our own list file.
  if (json && json.type === FILE_TYPE && Array.isArray(json.lists)) {
    const audio = json.audio && typeof json.audio === 'object' && json.audio.voiceId && json.audio.clips ? json.audio : null;
    return { lists: json.lists.map((l) => ({ ...tidyList(l), ...(l.id && BUILTIN_BY_ID[l.id] ? { id: l.id, builtIn: true } : {}) })), audio, skipped: [], ourFile: true };
  }
  const objLists = Array.isArray(json?.lists) ? json.lists : Array.isArray(json?.weeks) ? json.weeks : null;
  if (objLists) {
    const all = objLists.map((l, i) => fromJson(l, { kind, name: l.name || l.title || (l.week ? `Week ${l.week}` : `${name || 'List'} ${i + 1}`), grade: l.grade ?? json.grade ?? grade }));
    return { lists: all.flatMap((r) => r.lists), audio: null, skipped: all.flatMap((r) => r.skipped) };
  }
  if (Array.isArray(json)) return finish([{ ...newGroup(name, grade), rows: json.map(rowFromJson) }], kind, name, grade);
  if (json && typeof json === 'object') {
    const listName = json.name || json.title || name;
    const g = json.grade ?? grade;
    const spellRows = (pick(json, ['spelling', 'spelling words', 'words']) || []).map((e) => ({ ...rowFromJson(e), section: 'spelling' }));
    const vocabRows = (pick(json, ['vocab', 'vocabulary', 'vocabulary words', 'definitions']) || []).map((e) => ({ ...rowFromJson(e), section: 'vocab' }));
    if (Array.isArray(spellRows) && Array.isArray(vocabRows)) {
      // An object of { word: meaning } pairs also works.
      const rows = spellRows.length || vocabRows.length ? [...spellRows, ...vocabRows] : Object.entries(json).filter(([, v]) => typeof v === 'string').map(([k, v]) => ({ word: k, extra: v }));
      return finish([{ ...newGroup(listName, g), rows }], kind, listName, g);
    }
  }
  return { lists: [], audio: null, skipped: [] };
}
