import { applyD1Migrations, env } from 'cloudflare:test';
import { beforeAll } from 'vitest';

// Applies migrations/*.sql to each test file's D1 before anything runs, so the
// tests exercise the same schema the deployed Worker gets rather than a
// hand-maintained copy that can drift from it.
beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
