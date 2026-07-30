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

/**
 * Which path this page-load renders. The URL wins so a link or bookmark
 * always shows what it says; an unknown id falls through silently because
 * a stale bookmark should degrade to the person's own path, not an error.
 */
export function resolvePathId(search, catalogue, enrollments) {
  const wanted = new URLSearchParams(search).get('path');
  if (wanted && catalogue.paths.some(p => p.id === wanted)) return wanted;
  return enrollments?.[0]?.pathId ?? 'frontier-lab';
}

export async function loadPath(pathId) {
  const catalogue = await loadCatalogue();
  const entry = catalogue.paths.find(p => p.id === pathId);
  if (!entry) throw new Error(`unknown path "${pathId}"`);

  // The filename carries a content hash, so a cache hit is always the right
  // content and a stale copy is impossible rather than merely unlikely.
  //
  // Guarded because the Cache API is not universal: Safari in private browsing
  // has historically exposed no `caches`, and an unguarded call would throw
  // during boot and render nothing at all. Losing the cache is a slower load;
  // losing the page is the whole app.
  const cache = typeof caches !== 'undefined' ? await caches.open(CACHE) : null;

  if (cache) {
    const hit = await cache.match(entry.url);
    if (hit) return hit.json();
  }

  const res = await fetch(entry.url);
  if (!res.ok) throw new Error(`${entry.url} — ${res.status}`);
  if (cache) await cache.put(entry.url, res.clone());
  return res.json();
}
