import { defineConfig } from "@playwright/test";

import dotenv from 'dotenv';
import path from 'path';

/**
 * Read from default .env file.
 * To use a specific file, provide the path:
 */
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  workers: 1,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    trace: "on-first-retry",
  },
});
