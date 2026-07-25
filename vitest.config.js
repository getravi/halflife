import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// Read on the Node side at config time. The tests run inside the Workers
// runtime, where node:fs cannot slurp SQL files off disk.
const migrations = await readD1Migrations('./migrations');

// vitest-pool-workers 0.18 with Vitest 4: what used to be
// test.poolOptions.workers is now the argument to a cloudflareTest() plugin.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        d1Databases: ['DB'],
        bindings: { TEST_MIGRATIONS: migrations }
      }
    })
  ],
  test: {
    include: ['test/**/*.test.js'],
    setupFiles: ['./test/apply-migrations.js']
  }
});
