import { defineConfig } from 'vite';

/**
 * The API lives in a separate Node process (server/index.js), so the dev
 * server proxies /api to it rather than trying to host it. Run both:
 *
 *   pnpm serve   # the API and the store, on 8000
 *   pnpm dev     # this, on 5173, with hot reload
 *
 * `pnpm build` emits dist/, and `pnpm serve` picks dist/ up automatically
 * once it exists — so production is one process again, not two.
 */
export default defineConfig({
  root: '.',
  // public/ holds the validator's output — the hashed path files and the
  // catalogue — which Vite copies into dist verbatim.
  publicDir: 'public',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: false
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // The plan content is big and generated; a source map of it helps nobody.
    sourcemap: false
  }
});
