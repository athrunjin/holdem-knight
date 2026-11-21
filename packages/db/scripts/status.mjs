/** What the CLI reports of the local Supabase: where it listens and the keys it was started with. */
import { execFileSync } from "node:child_process";
import { join } from "node:path";

export const root = join(import.meta.dirname, "..");

export function status() {
  const out = execFileSync("pnpm", ["exec", "supabase", "status", "--output", "json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const found = JSON.parse(out.slice(out.indexOf("{")));
  const stack = {
    url: found.API_URL,
    publicKey: found.PUBLISHABLE_KEY ?? found.ANON_KEY,
    secretKey: found.SECRET_KEY ?? found.SERVICE_ROLE_KEY,
    mailUrl: found.MAILPIT_URL ?? found.INBUCKET_URL,
  };
  if (!stack.url || !stack.publicKey || !stack.secretKey || !stack.mailUrl) {
    throw new Error("The local Supabase reports no address or key. Is it running?");
  }
  return stack;
}
