import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipUrl, clipSpecs, wordClip, sentenceClip, clipRequest, staleClipUrls, charCount, normalizeText, explainError, PAUSE } from '../src/aivoice.js';

test('clip keys are stable and differ by voice', () => {
  assert.equal(clipUrl('v1', wordClip(' because  ').id), clipUrl('v1', wordClip('because').id));
  assert.notEqual(clipUrl('v1', 'x'), clipUrl('v2', 'x'));
});

test('a word is read with spelling-test context; a sentence is one word-sentence-word clip', () => {
  const w = wordClip('because.');
  assert.equal(w.text, 'because.');
  assert.match(w.previous, /spelling/i);
  const s = sentenceClip('because', 'I stayed inside because it rained');
  assert.equal(s.text, `because. ${PAUSE} I stayed inside because it rained. ${PAUSE} because.`);
  const body = clipRequest(s);
  assert.equal(body.previous_text, s.previous);
  assert.ok(body.voice_settings.stability >= 0.7);
});

test('clipSpecs collects every clip once, across players', () => {
  const a = { words: [{ word: 'because', sentence: 'I stayed in because it rained.' }, { word: 'said', sentence: '' }] };
  const b = { words: [{ word: 'because', sentence: 'I stayed in because it rained.' }, { word: 'friend', sentence: '' }] };
  const specs = clipSpecs([a, b]);
  assert.equal(specs.length, 4);
  assert.equal(charCount([wordClip('ab')]), 3);
  assert.equal(normalizeText(null), '');
});

test('saved audio for deleted words and old clip styles is found for clean-up', () => {
  const keep = [wordClip('cat'), sentenceClip('cat', 'The cat sat.')];
  const saved = [clipUrl('v1', keep[0].id), clipUrl('v2', keep[1].id), clipUrl('v1', wordClip('becuase').id), clipUrl('v1', 'cat')];
  assert.deepEqual(staleClipUrls(saved, keep), [saved[2], saved[3]]);
});

test('API errors become plain-language messages', () => {
  assert.match(explainError(401), /key/);
  assert.match(explainError(401, 'missing_permissions: needs text_to_speech'), /permission/);
  assert.match(explainError(402), /used up/);
  assert.match(explainError(400, 'quota_exceeded'), /used up/);
  assert.match(explainError(0), /internet/);
});

test('a key without voices permission falls back to the standard voices', async () => {
  const { listVoicesOrDefaults, DEFAULT_VOICES } = await import('../src/aivoice.js');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ detail: { status: 'missing_permissions', message: 'The API key you used is missing the permission voices_read' } }), { status: 401 });
  try {
    const r = await listVoicesOrDefaults('k');
    assert.equal(r.limited, true);
    assert.deepEqual(r.voices, DEFAULT_VOICES);
    assert.match(r.reason, /missing_permissions/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('TTS errors keep ElevenLabs reason in the message', async () => {
  const { generateClip } = await import('../src/aivoice.js');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: { status: 'invalid_api_key', message: 'Invalid API key' } }), { status: 401 });
  try {
    await assert.rejects(generateClip('k', 'v', 'hi'), (err) => /rejected/.test(err.message) && /Invalid API key/.test(err.message) && err.status === 401);
  } finally {
    globalThis.fetch = realFetch;
  }
});
