// Grown-ups card for the Word lists library: load a list from a file or by
// pasting, pick a built-in list, give a list to a kid, and make or share the
// AI voice audio for lists so other devices don't have to make it again.
import { addWords, cleanEntries } from './profile.js';
import { addVocabWord } from './vocab.js';
import { clipsForList, countReady, prepareClips, getClip, putClip, charCount } from './aivoice.js';
import { allLists, findList, saveLists, deleteList, markUsed, makeListFile, parseListText } from './wordlists.js';
import { ordinal } from './word-lists-builtin.js';

// ---------- audio <-> text, for list files ----------
export async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function base64ToBlob(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'audio/mpeg' });
}

function download(obj, filename) {
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * ctx: { app, ui, esc, data(), save(), update(p), render(), parentKid(),
 *        mainVoice() -> { voiceId, voiceName, key } , listVoices(), addListVoice(v), afterWordsAdded() }
 */
export function createWordLists(ctx) {
  const { app, ui, esc } = ctx;
  let busy = false;
  // Remember which grade is open, so it stays open when the screen redraws.
  app.addEventListener('toggle', (e) => {
    const g = e.target.dataset?.group;
    if (g && e.target.tagName === 'DETAILS') ui.wlGroup = e.target.open ? g : ui.wlGroup === g ? null : ui.wlGroup;
  }, true);

  function groups() {
    const lists = allLists(ctx.data());
    const out = [];
    for (const g of [3, 4, 5, 6]) out.push({ key: `g${g}`, title: `${ordinal(g)} grade (built in)`, lists: lists.filter((l) => l.builtIn && l.grade === g) });
    out.push({ key: 'mine', title: 'Your lists', lists: lists.filter((l) => !l.builtIn) });
    return out.filter((g) => g.lists.length);
  }

  function voiceToUse() {
    const main = ctx.mainVoice();
    if (main.voiceId && main.key) return { ...main, canMake: true };
    const lv = ctx.listVoices()[0];
    return lv ? { voiceId: lv.id, voiceName: lv.name, canMake: false } : { voiceId: main.voiceId, voiceName: main.voiceName, canMake: false };
  }

  function listRow(l, kid) {
    const used = kid?.listsUsed?.[l.id] || {};
    const when = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const open = ui.wlOpen === l.id;
    return `<div class="wl-row" data-list="${esc(l.id)}">
      <div class="wl-head"><strong>${esc(l.name)}</strong>${l.topic ? ` <span class="small muted">${esc(l.topic)}</span>` : ''}
        <div class="small muted">${l.spelling.length} spelling · ${l.vocab.length} Word Match · <span class="wl-voice" data-list="${esc(l.id)}">🔊 …</span>
        ${used.spelling ? ` · ✓ spelling ${when(used.spelling)}` : ''}${used.vocab ? ` · ✓ Word Match ${when(used.vocab)}` : ''}</div></div>
      ${kid ? `<div class="row wl-buttons">
        ${l.spelling.length ? `<button class="secondary" data-action="wl-spelling" data-id="${esc(l.id)}">Spelling words for ${esc(kid.name)}</button>` : ''}
        ${l.vocab.length ? `<button class="secondary" data-action="wl-vocab" data-id="${esc(l.id)}">Add to ${esc(kid.name)}'s Word Match</button>` : ''}
        <button class="ghost" data-action="wl-open" data-id="${esc(l.id)}">${open ? 'Hide words' : 'See words'}</button>
        ${l.builtIn ? '' : `<button class="ghost" data-action="wl-delete" data-id="${esc(l.id)}" aria-label="Delete ${esc(l.name)}">✕</button>`}
      </div>` : ''}
      ${open ? wordsHtml(l) : ''}
    </div>`;
  }

  function wordsHtml(l) {
    return `<div class="wl-words small">
      ${l.tip ? `<p class="muted">💡 ${esc(l.tip)}</p>` : ''}
      ${l.spelling.length ? `<p><strong>Spelling:</strong> ${l.spelling.map((w) => `${esc(w.word)}${w.sentence ? '' : '<sup title="no sentence">*</sup>'}`).join(', ')}</p>` : ''}
      ${l.vocab.length ? `<p><strong>Word Match:</strong> ${l.vocab.map((w) => `${esc(w.word)} <span class="muted">(${esc(w.definition)})</span>`).join('; ')}</p>` : ''}
    </div>`;
  }

  function previewHtml() {
    const pv = ui.wlPreview;
    if (!pv) return '';
    if (pv.error) return `<p class="warn">⚠️ ${esc(pv.error)}</p>`;
    const n = pv.audio ? Object.keys(pv.audio.clips).length : 0;
    return `<div class="wl-preview">
      <h4>Found ${pv.lists.length} list${pv.lists.length === 1 ? '' : 's'}${pv.ourFile ? ' in a word list file' : ''}</h4>
      ${pv.lists.map((l) => `<div class="wl-row"><strong>${esc(l.name)}</strong>${l.grade != null ? ` <span class="small muted">${ordinal(l.grade)} grade</span>` : ''}
        <div class="small muted">${l.spelling.length} spelling · ${l.vocab.length} Word Match</div>${wordsHtml(l)}</div>`).join('')}
      ${n ? `<p class="small">🔊 Includes ${n} voice clip${n === 1 ? '' : 's'} (${esc(pv.audio.voiceName || 'AI voice')}). They'll be saved on this device, so no ElevenLabs key is needed here.</p>` : ''}
      ${pv.skipped.length ? `<p class="small muted">Skipped (didn't look like a word): ${pv.skipped.slice(0, 8).map(esc).join(' · ')}${pv.skipped.length > 8 ? ` and ${pv.skipped.length - 8} more` : ''}</p>` : ''}
      <p class="small muted">Not right? Change “What's in it?” above, or fix the words after you give them to a kid. Loading a list with the same name again replaces it.</p>
      <div class="row"><button data-action="wl-save" ${pv.lists.length || n ? '' : 'disabled'}>Save to the library</button><button class="ghost" data-action="wl-cancel">Cancel</button></div>
    </div>`;
  }

  function parentHtml(kid) {
    const v = voiceToUse();
    const flash = ui.wlFlash;
    ui.wlFlash = '';
    return `<div class="card" id="wordlists">
      <h3>📚 Word lists</h3>
      <p class="small muted">Ready-made lists for grades 3 to 6 (3 weeks each), plus any list you load. Each list has spelling words with sentences and Word Match words with meanings.
        ${kid ? `Tap a button to give a list to ${esc(kid.name)}: spelling words become this week's words, and Word Match words join their matching game.` : 'Add a player to give them a list.'}</p>
      ${flash ? `<p class="good-note">${esc(flash)}</p>` : ''}
      ${groups()
        .map((g) => `<details ${ui.wlGroup === g.key ? 'open' : ''} data-group="${g.key}"><summary><strong>${esc(g.title)}</strong> <span class="small muted">${g.lists.length} list${g.lists.length === 1 ? '' : 's'}</span></summary>
          ${g.lists.map((l) => listRow(l, kid)).join('')}
          <div class="row wl-group-actions">
            ${v.canMake ? `<button class="ghost" data-action="wl-make" data-group="${g.key}">🔊 Make voices (about ${charCount(specsFor(g.lists)).toLocaleString()} characters)</button>` : ''}
            <button class="ghost" data-action="wl-share" data-group="${g.key}">💾 Save as a file${v.voiceId ? ' with voices' : ''}</button>
          </div></details>`)
        .join('')}
      <p class="small muted wl-status"></p>
      <h4 style="margin-top:16px">Load a list</h4>
      <p class="small muted">From a teacher's email, a spreadsheet saved as CSV, a text file, or a word list file saved from this app on another device (with its voices).
        One word per line works. To add a sentence or a meaning, put it after the word with a dash, a colon or in the next column, e.g. “brave - not afraid”. Headings like “Week 2” or “Vocabulary” start a new list or section.</p>
      <form data-form="wl-load" class="wl-load" autocomplete="off">
        <label class="pill" style="cursor:pointer">Choose a file<input type="file" accept=".json,.csv,.tsv,.txt,text/plain,text/csv,application/json" data-action-change="wl-file" hidden></label>
        <textarea name="text" rows="5" placeholder="…or paste the list here">${esc(ui.wlSource?.pasted ? ui.wlSource.text : '')}</textarea>
        <div class="row">
          <label class="small">What's in it?
            <select name="kind" data-action-change="wl-kind">
              ${[['auto', 'Let the app tell'], ['spelling', 'Spelling words'], ['vocab', 'Word Match words (with meanings)']].map(([k, t]) => `<option value="${k}" ${ui.wlKind === k ? 'selected' : ''}>${t}</option>`).join('')}
            </select></label>
          <label class="small">List name <input type="text" name="name" maxlength="60" placeholder="e.g. Ms. Lee, Week 4" value="${esc(ui.wlName || '')}"></label>
          <button type="submit" class="secondary">Read the list</button>
        </div>
      </form>
      ${previewHtml()}
      <p class="small muted">🔊 Voices: ${v.voiceId ? `${v.canMake ? 'Make voices uses this device\'s ElevenLabs key, once per list.' : 'This device has no ElevenLabs key; it plays voices that came in list files.'} “Save as a file” puts the lists and their voice audio in one file. Send it to another iPad (AirDrop, email or Files) and load it here: the voices come with it.` : 'Set up the AI voice above to make voices for lists, or load a list file that has them.'}</p>
    </div>`;
  }

  function specsFor(lists) {
    const m = new Map();
    for (const l of lists) for (const c of clipsForList(l)) m.set(c.id, c);
    return [...m.values()];
  }

  /** Fill in how many voice clips each list has on this device. */
  async function refreshVoiceCounts() {
    const els = app.querySelectorAll('.wl-voice');
    if (!els.length) return;
    const voices = [...new Set([ctx.mainVoice().voiceId, ...ctx.listVoices().map((v) => v.id)].filter(Boolean))];
    for (const el of els) {
      const l = findList(ctx.data(), el.dataset.list);
      if (!l) continue;
      const specs = clipsForList(l);
      let best = 0;
      for (const v of voices) best = Math.max(best, await countReady(v, specs).catch(() => 0));
      el.textContent = !voices.length || !best ? '🔊 device voice for now' : best >= specs.length ? '🔊 AI voice ready' : `🔊 ${best} of ${specs.length} AI voice clips`;
    }
  }

  function setStatus(text) {
    const el = app.querySelector('.wl-status');
    if (el) el.textContent = text;
  }

  function readSource() {
    const form = app.querySelector('[data-form="wl-load"]');
    const src = ui.wlSource;
    if (!src?.text) return;
    try {
      const name = ui.wlName || (src.filename ? src.filename.replace(/\.[^.]+$/, '') : '');
      ui.wlPreview = { ...parseListText(src.text, { kind: ui.wlKind || 'auto', name }) };
      if (!ui.wlPreview.lists.length && !ui.wlPreview.audio) ui.wlPreview = { error: "Couldn't find any words in that. Try pasting it, one word per line." };
    } catch (err) {
      ui.wlPreview = { error: `Couldn't read that: ${err.message}` };
    }
    if (form) ui.wlName = form.name.value.trim();
    rerender();
  }

  function rerender() {
    ctx.render();
    app.querySelector('#wordlists')?.scrollIntoView({ block: 'start' });
  }

  async function saveAudio(audio) {
    let n = 0;
    for (const [id, b64] of Object.entries(audio.clips || {})) {
      try {
        await putClip(audio.voiceId, id, base64ToBlob(b64));
        n++;
      } catch {}
    }
    if (n) ctx.addListVoice({ id: audio.voiceId, name: audio.voiceName || 'AI voice' });
    return n;
  }

  async function makeVoices(lists, voice) {
    const res = await prepareClips(voice.key, voice.voiceId, specsFor(lists), (done, total) => setStatus(`Making voices… ${done} of ${total}`));
    return res;
  }

  const actions = {
    'wl-open': (d) => {
      ui.wlOpen = ui.wlOpen === d.id ? null : d.id;
      ui.wlGroup = groups().find((g) => g.lists.some((l) => l.id === d.id))?.key;
      ctx.render();
      app.querySelector(`.wl-row[data-list="${CSS.escape(d.id)}"]`)?.scrollIntoView({ block: 'nearest' });
    },
    'wl-spelling': (d) => {
      const kid = ctx.parentKid();
      const l = findList(ctx.data(), d.id);
      if (!kid || !l) return;
      const entries = cleanEntries(l.spelling);
      const r = addWords(kid, entries, Date.now());
      ctx.update(markUsed(r.profile, l.id, 'spelling', Date.now()));
      ui.wlFlash = `${kid.name}'s words this week: ${l.name}, ${entries.length} words (${r.added} new${r.returning ? `, ${r.returning} from before` : ''}).`;
      ui.wlGroup = groups().find((g) => g.lists.some((x) => x.id === l.id))?.key;
      ctx.afterWordsAdded();
      rerender();
    },
    'wl-vocab': (d) => {
      const kid = ctx.parentKid();
      const l = findList(ctx.data(), d.id);
      if (!kid || !l) return;
      let p = kid;
      let added = 0;
      for (const w of l.vocab) {
        try {
          const r = addVocabWord(p, w, Date.now());
          p = r.profile;
          if (r.added) added++;
        } catch {}
      }
      ctx.update(markUsed(p, l.id, 'vocab', Date.now()));
      ui.wlFlash = `Added ${added} new Word Match word${added === 1 ? '' : 's'} for ${kid.name} from ${l.name}${added < l.vocab.length ? ` (${l.vocab.length - added} were already there)` : ''}.`;
      ui.wlGroup = groups().find((g) => g.lists.some((x) => x.id === l.id))?.key;
      ctx.afterWordsAdded();
      rerender();
    },
    'wl-delete': (d) => {
      const l = findList(ctx.data(), d.id);
      if (!l || l.builtIn || !confirm(`Delete the list “${l.name}” from the library? Words already given to a kid stay with them.`)) return;
      ctx.data().library = deleteList(ctx.data(), d.id).library;
      ctx.save();
      ctx.render();
    },
    'wl-cancel': () => {
      ui.wlPreview = null;
      ui.wlSource = null;
      ctx.render();
    },
    'wl-save': async () => {
      const pv = ui.wlPreview;
      if (!pv || busy) return;
      busy = true;
      try {
        const r = saveLists(ctx.data(), pv.lists.filter((l) => !l.builtIn), Date.now());
        ctx.data().library = r.data.library;
        ctx.save();
        const clips = pv.audio ? await saveAudio(pv.audio) : 0;
        const builtIns = pv.lists.filter((l) => l.builtIn).length;
        ui.wlFlash = [
          r.added || r.replaced ? `Saved ${r.added + r.replaced} list${r.added + r.replaced === 1 ? '' : 's'}${r.replaced ? ` (${r.replaced} replaced an older copy)` : ''}.` : '',
          builtIns ? `${builtIns} built-in list${builtIns === 1 ? ' was' : 's were'} already here.` : '',
          clips ? `Saved ${clips} voice clip${clips === 1 ? '' : 's'} on this device.` : '',
        ].filter(Boolean).join(' ');
        ui.wlPreview = null;
        ui.wlSource = null;
        ui.wlName = '';
        ui.wlGroup = r.added || r.replaced ? 'mine' : ui.wlGroup;
      } finally {
        busy = false;
      }
      rerender();
    },
    'wl-make': async (d) => {
      const g = groups().find((x) => x.key === d.group);
      const v = voiceToUse();
      if (!g || !v.canMake || busy) return;
      busy = true;
      try {
        const res = await makeVoices(g.lists, v);
        setStatus(res.error || (res.missing ? `Made ${res.made} voice clips for ${g.title}.` : `All the voices for ${g.title} were already made.`));
      } finally {
        busy = false;
      }
      refreshVoiceCounts();
    },
    'wl-share': async (d) => {
      const g = groups().find((x) => x.key === d.group);
      if (!g || busy) return;
      busy = true;
      try {
        const v = voiceToUse();
        let audio = null;
        let missing = 0;
        if (v.voiceId) {
          if (v.canMake) {
            const res = await makeVoices(g.lists, v);
            if (res.error) setStatus(`${res.error} The file will have the voices made so far.`);
          }
          setStatus('Putting the file together…');
          const clips = {};
          for (const c of specsFor(g.lists)) {
            const blob = await getClip(v.voiceId, c.id);
            if (blob) clips[c.id] = await blobToBase64(blob);
            else missing++;
          }
          audio = { voiceId: v.voiceId, voiceName: v.voiceName || 'AI voice', clips };
        }
        const file = makeListFile(g.lists, audio);
        download(file, `word-lists-${slug(g.title.replace(' (built in)', ''))}${audio ? '-with-voices' : ''}.json`);
        const n = audio ? Object.keys(audio.clips).length : 0;
        setStatus(`Saved ${g.lists.length} list${g.lists.length === 1 ? '' : 's'}${n ? ` with ${n} voice clips` : ''}${missing ? ` (${missing} clips had no voice yet)` : ''}. Load the file on the other device under Word lists → Choose a file.`);
      } catch (err) {
        setStatus(`Couldn't save the file: ${err.message}`);
      } finally {
        busy = false;
      }
    },
  };

  /** Handles the card's form. Returns true when it was ours. */
  function onSubmit(kind, form) {
    if (kind !== 'wl-load') return false;
    ui.wlKind = form.kind.value;
    ui.wlName = form.name.value.trim();
    const text = form.text.value;
    if (text.trim()) ui.wlSource = { text, pasted: true };
    readSource();
    return true;
  }

  /** Handles the card's file picker and "What's in it?" menu. Returns true when it was ours. */
  function onChange(kind, e) {
    if (kind === 'wl-kind') {
      ui.wlKind = e.target.value;
      if (ui.wlSource) readSource();
      return true;
    }
    if (kind !== 'wl-file') return false;
    const file = e.target.files[0];
    if (!file) return true;
    const form = e.target.closest('form');
    ui.wlKind = form?.kind.value || 'auto';
    ui.wlName = form?.name.value.trim() || '';
    file.text().then((text) => {
      ui.wlSource = { text, filename: file.name };
      readSource();
    }, (err) => {
      ui.wlPreview = { error: `Couldn't open that file: ${err.message}` };
      rerender();
    });
    return true;
  }

  /** Every clip the library's lists use, so saved list voices aren't cleaned away. */
  function librarySpecs() {
    return specsFor(allLists(ctx.data()));
  }

  return { parentHtml, actions, onSubmit, onChange, refreshVoiceCounts, librarySpecs };
}
