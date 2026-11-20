/**
 * The local Supabase the CLI runs (`pnpm db:start`): where it listens and the keys it was started
 * with, read from the CLI so nothing is written down here.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface Stack {
  readonly url: string;
  /** For a visitor or a signed-in account: row-level security applies */
  readonly publicKey: string;
  /** For the tests' own setup only: it passes row-level security */
  readonly secretKey: string;
}

const PACKAGE = join(import.meta.dirname, "../..");

/** The first of these names the CLI's status has, as its names for the keys have changed between versions. */
function pick(status: Record<string, unknown>, names: readonly string[]): string {
  for (const name of names) {
    const value = status[name];
    if (typeof value === "string" && value !== "") return value;
  }
  throw new Error(`The local Supabase reports none of ${names.join(", ")}. Is it running?`);
}

export function localStack(): Stack {
  const out = execFileSync("pnpm", ["exec", "supabase", "status", "--output", "json"], {
    cwd: PACKAGE,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const status = JSON.parse(out.slice(out.indexOf("{"))) as Record<string, unknown>;
  return {
    url: pick(status, ["API_URL"]),
    publicKey: pick(status, ["PUBLISHABLE_KEY", "ANON_KEY"]),
    secretKey: pick(status, ["SECRET_KEY", "SERVICE_ROLE_KEY"]),
  };
}

const quiet = { auth: { persistSession: false, autoRefreshToken: false } };

/** A client as the app has one: with the public key, signed in or not. */
export const appClient = ({ url, publicKey }: Stack): SupabaseClient =>
  createClient(url, publicKey, quiet);

/** A client for setting tests up and clearing them away. Never for what is under test. */
export const adminClient = ({ url, secretKey }: Stack): SupabaseClient =>
  createClient(url, secretKey, quiet);
