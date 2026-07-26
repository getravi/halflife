import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('main exports boot', () => {
  it('exports boot so it can be driven directly', async () => {
    const mod = await import('../../src/main.js');
    expect(typeof mod.boot).toBe('function');
  });
});

describe('loadPath without a Cache API', () => {
  const realCaches = globalThis.caches;
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    // Safari in private browsing has historically exposed no caches. A page
    // served there would throw during boot and render nothing at all.
    delete globalThis.caches;
  });

  afterEach(() => {
    if (realCaches) globalThis.caches = realCaches;
    globalThis.fetch = realFetch;
    vi.resetModules();
  });

  it('falls back to a plain fetch rather than throwing', async () => {
    const path = { id: 'p', title: 'P', phases: [] };
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).includes('index.json')) {
        return new Response(JSON.stringify({
          paths: [{ id: 'p', title: 'P', url: '/paths/p-abc.json' }]
        }), { status: 200 });
      }
      return new Response(JSON.stringify(path), { status: 200 });
    });

    const { loadPath } = await import('../../src/content.js');
    await expect(loadPath('p')).resolves.toEqual(path);
  });
});
