import { defineConfig } from "vitest/config";

/** Tests that need the local Supabase running (`pnpm db:start`), kept apart from the unit tests. */
export default defineConfig({
  test: {
    include: ["src/local/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
