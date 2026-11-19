# Voice options for reading words aloud (2026-11-19)

Jason's feedback: the default iPad voice sounds dated. Can we use a natural, AI-style voice?

## What the game does now
The game uses the Web Speech API, so it can only use voices installed on the iPad. It now ranks the installed English voices: Premium first, then Enhanced, then the rest. It skips novelty voices like Zarvox. The grown-ups screen has a voice picker, a speed slider and a Test button.

**Update (2026-11-19): this didn't work.** Jason downloaded a Premium voice, but it didn't appear in the game. iOS Safari doesn't give websites access to downloaded Premium voices (WebKit bug 237584). So the realistic way to get a natural voice is pre-generated AI audio (below).

~~**Free fix (about 5 minutes per iPad):** go to Settings → Accessibility → Spoken Content → Voices → English. Download a **Premium** voice, such as Ava (Premium) or Zoe (Premium), or an **Enhanced** one. These are Apple's newer neural voices, and they sound far better than the compact default. They work offline, and the game picks one up automatically after a restart. Apple doesn't let web apps use the Siri voices themselves.~~

## If that's still not good enough: pre-generated AI audio
How it would work:
1. You paste an API key into the grown-ups screen once. It stays on the iPad, like the rest of the progress.
2. When you add the week's words, the iPad asks the voice service for an MP3 of each word and each example sentence. It saves the audio on the device, so practice still works offline.
3. Each word plays from the saved audio. If a word has no audio yet, the game falls back to the iPad voice.

| Provider | Quality | Setup | Cost at our volume* |
|---|---|---|---|
| OpenAI TTS | Very natural, can be told to speak slowly and clearly | API key from platform.openai.com, prepaid credit | Pennies per month |
| ElevenLabs | The most natural, with lots of voices | Free account and API key | Free tier covers it |
| Google Cloud Text-to-Speech | Natural (Neural2 / Chirp voices) | Google Cloud project with billing enabled, then an API key | Free monthly tier covers it |

\*About 10 words a week, each with a sentence, is roughly 1,000 characters a week. Every provider above prices by the million characters, so this costs well under $1 a month. Check current pricing before signing up.

Trade-offs:
- **Needs a key and an account.** No service offers free AI voices without one. The key sits in the iPad's storage, so anyone using the iPad's developer tools could read it. Use a key with a low spending limit.
- **What leaves the device:** only the words and example sentences, sent to the voice service. No names and no progress. This is the first time the app would talk to any outside service. It does so only when you add words, and only if a key is set.
- **Work:** about one PR (key field, audio fetch and cache, playback with fallback).

## Recommendation
~~Download a Premium voice first.~~ That isn't possible from Safari. Use pre-generated AI audio (OpenAI or ElevenLabs).

## Decision (2026-11-19)
Jason chose **ElevenLabs**. It's built as described above: the key goes on the grown-ups screen, and audio is cached in Cache Storage with the built-in voice as fallback.
