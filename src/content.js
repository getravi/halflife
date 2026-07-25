/**
 * Path loading. The catalogue is revalidated on every load and maps an id to
 * a content-hashed URL; the path file itself is immutable, so it is cached
 * forever and a content edit simply produces a different filename.
 */
const CACHE = 'flp-paths-v1';

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${url} — ${res.status}`);
  return res.json();
}

export async function loadCatalogue() {
  return fetchJSON('/paths/index.json', { cache: 'no-cache' });
}

export async function loadPath(pathId) {
  const catalogue = await loadCatalogue();
  const entry = catalogue.paths.find(p => p.id === pathId);
  if (!entry) throw new Error(`unknown path "${pathId}"`);

  // The filename carries a content hash, so a cache hit is always the right
  // content and a stale copy is impossible rather than merely unlikely.
  const cache = await caches.open(CACHE);
  const hit = await cache.match(entry.url);
  if (hit) return hit.json();

  const res = await fetch(entry.url);
  if (!res.ok) throw new Error(`${entry.url} — ${res.status}`);
  await cache.put(entry.url, res.clone());
  return res.json();
}
