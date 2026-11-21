/**
 * Writes apps/web/.env.local with where the local Supabase listens and its public key, so the
 * app's dev server signs in against it. The key is the same on every machine and opens nothing
 * but the local stack. Run it once `pnpm db:start` has finished.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { root, status } from "./status.mjs";

const { url, publicKey } = status();

const target = join(root, "../../apps/web/.env.local");
writeFileSync(
  target,
  [
    "# Written by `pnpm db:env`: the local Supabase. Not committed.",
    `VITE_SUPABASE_URL=${url}`,
    `VITE_SUPABASE_PUBLISHABLE_KEY=${publicKey}`,
    "",
  ].join("\n"),
);
console.log(`Wrote ${target}`);
