// All progress stays on this device, in localStorage.
const KEY = 'klg-save-v1';

export function emptySave() {
  return { version: 1, profiles: {}, order: [], activeId: null };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptySave();
    const data = JSON.parse(raw);
    return data && data.version === 1 ? data : emptySave();
  } catch {
    return emptySave();
  }
}

export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Ask the browser not to evict our storage (iOS can clear PWA data). */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch {}
  return false;
}

export function exportBackup(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spelling-game-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseBackup(text) {
  const data = JSON.parse(text);
  if (!data || data.version !== 1 || typeof data.profiles !== 'object') throw new Error('Not a backup file');
  return data;
}
