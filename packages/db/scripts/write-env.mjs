/**
 * Writes apps/web/.env.local with where the local Supabase listens and its public key, so the
 * app's dev server signs in against it. The key is the same on every machine and opens nothing
 * but the local stack. Run it once `pnpm db:start` has finished.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const out = execFileSync("pnpm", ["exec", "supabase", "status", "--output", "json"], {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});
const status = JSON.parse(out.slice(out.indexOf("{")));
const publicKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
if (!status.API_URL || !publicKey) {
  throw new Error("The local Supabase reports no address or key. Is it running?");
}

const target = join(root, "../../apps/web/.env.local");
writeFileSync(
  target,
  [
    "# Written by `pnpm db:env`: the local Supabase. Not committed.",
    `VITE_SUPABASE_URL=${status.API_URL}`,
    `VITE_SUPABASE_PUBLISHABLE_KEY=${publicKey}`,
    "",
  ].join("\n"),
);
console.log(`Wrote ${target}`);
