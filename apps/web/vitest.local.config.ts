import { fileURLToPath, URL } from "node:url";
import { localStack } from "@holdem-knight/db/local";
import { defineConfig } from "vitest/config";

const stack = localStack();

/**
 * Tests that need the local Supabase running (`pnpm db:start`), told where it is and its keys.
 * They test the data layer alone, so none of the app's build plugins are loaded.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.local.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: {
      SUPABASE_URL: stack.url,
      SUPABASE_PUBLISHABLE_KEY: stack.publicKey,
      SUPABASE_SECRET_KEY: stack.secretKey,
    },
  },
});
