import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Those need the local Supabase running: `pnpm test:local`
    exclude: ["src/local/**"],
    // An in-process Postgres takes a moment to start
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
