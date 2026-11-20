// Offline support: precache the app shell, then serve from cache and refresh
// the cache in the background (stale-while-revalidate), so updates show up on
// the next launch. Bump VERSION when adding or removing files.
const VERSION = 'v28';
const CACHE = `spelling-${VERSION}`;
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './src/app.js',
  './src/battle.js',
  './src/content.js',
  './src/economy.js',
  './src/legend.js',
  './src/profile.js',
  './src/progress.js',
  './src/rng.js',
  './src/speech.js',
  './src/srs.js',
  './src/storage.js',
  './src/voices.js',
  './src/aivoice.js',
  './src/vocab.js',
  './src/vocab-ui.js',
  './src/vocab-words.js',
  './src/games.js',
  './src/friends.js',
  './src/friendsui.js',
  './src/math.js',
  './src/mathgame.js',
  './src/tricky.js',
  './src/tricky-words.js',
  './src/wordlists.js',
  './src/wordlists-ui.js',
  './src/word-lists-builtin.js',
  './src/farm.js',
  './src/farm-content.js',
  './src/farmui.js',
  './src/sunshine.js',
  './src/mine.js',
  './src/grant.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      // Keep saved voice clips (spelling-audio) across app updates.
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== 'spelling-audio').map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const key = req.mode === 'navigate' ? './index.html' : req;
      const cached = await cache.match(key, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(key, res.clone());
          return res;
        })
        .catch(() => cached);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return network;
    }),
  );
});
