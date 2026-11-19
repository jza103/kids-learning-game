import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipUrl, clipTexts, charCount, normalizeText, explainError } from '../src/aivoice.js';

test('clip keys are stable for the same text and differ by voice', () => {
  assert.equal(clipUrl('v1', ' because  '), clipUrl('v1', 'because'));
  assert.notEqual(clipUrl('v1', 'because'), clipUrl('v2', 'because'));
  assert.ok(clipUrl('v1', "don't stop").includes(encodeURIComponent("don't stop")));
});

test('clipTexts collects every word and sentence once, across players', () => {
  const a = { words: [{ word: 'because', sentence: 'I stayed in because it rained.' }, { word: 'said', sentence: '' }] };
  const b = { words: [{ word: 'because', sentence: '' }, { word: 'friend', sentence: 'My  friend  is here.' }] };
  assert.deepEqual(clipTexts([a, b]), ['because', 'I stayed in because it rained.', 'said', 'friend', 'My friend is here.']);
  assert.equal(charCount(['ab', 'cde']), 5);
  assert.equal(normalizeText(null), '');
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
