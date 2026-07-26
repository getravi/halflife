import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// Read on the Node side at config time. Worker tests run inside the Workers
// runtime, where node:fs cannot slurp SQL files off disk.
const migrations = await readD1Migrations('./migrations');

export default defineConfig({
  test: {
    projects: [
      {
        // Routes and D1, against a real local database.
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
          name: 'worker',
          include: ['test/worker/**/*.test.js'],
          setupFiles: ['./test/apply-migrations.js']
        }
      },
      {
        // Everything else: the pure modules, and the DOM wiring above them.
        test: {
          name: 'dom',
          include: ['test/*.test.js', 'test/dom/**/*.test.js'],
          environment: 'happy-dom'
        }
      }
    ]
  }
});
