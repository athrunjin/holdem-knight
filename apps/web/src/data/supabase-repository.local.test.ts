/**
 * The repository contract against an account's storage. It needs the local Supabase running
 * (`pnpm db:start`), so it runs under `pnpm test:local` and not with the unit tests.
 */

import { cents } from "@holdem-knight/core";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

import { describeRepository } from "./repository-contract";
import { createSupabaseRepository } from "./supabase-repository";

// Set by vitest.local.config.ts from the running stack
const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: publicKey } = import.meta.env;
const secretKey: string = import.meta.env.SUPABASE_SECRET_KEY;

const quiet = { auth: { persistSession: false, autoRefreshToken: false } };
/** For making accounts and clearing them away. Never for what is under test. */
const admin = createClient(url, secretKey, quiet);
const password = `pw-${crypto.randomUUID()}`;
const made: string[] = [];

/** A new account, signed in as the app would be, with the repository of its space. */
async function books() {
  const email = `repo-${crypto.randomUUID()}@example.com`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  made.push(created.data.user.id);
  const client = createClient(url, publicKey, quiet);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  const spaces = await client.from("organizers").select("id");
  const organizerId = spaces.data?.[0]?.id as string | undefined;
  if (!organizerId) throw new Error("No space was made for the account");
  return { repository: createSupabaseRepository(client, organizerId), organizerId };
}

describeRepository("Supabase", async () => {
  const [me, other, elsewhere] = await Promise.all([books(), books(), books()]);
  // Each test has accounts of its own, so there is nothing to clear between them
  return { me, other, elsewhere, dispose: async () => {} };
});

describe("Supabase: what an account's storage adds", () => {
  it("keeps the same ID apart in two spaces", async () => {
    const [me, other] = await Promise.all([books(), books()]);
    const game = (organizerId: string, createdAt: number) => ({
      id: "g",
      organizerId,
      currency: "CNY" as const,
      smallBlindChips: 5,
      bigBlindChips: 10,
      chipRatio: { chips: 1, amount: cents(100) },
      status: "open" as const,
      createdAt,
    });
    await other.repository.games.save(game(other.organizerId, 1));
    await me.repository.games.save(game(me.organizerId, 5));

    expect((await other.repository.games.get("g"))?.createdAt).toBe(1);
    expect((await me.repository.games.get("g"))?.createdAt).toBe(5);
  });

  it("refuses a record that the app's own rules would not read back", async () => {
    const { repository, organizerId } = await books();
    const broken = { id: "p", organizerId, name: "", initials: "", createdAt: 1 };
    await expect(repository.players.save(broken)).rejects.toThrow(/not valid/);
    expect(await repository.players.list()).toEqual([]);
  });
});

afterAll(async () => {
  await Promise.all(made.map((id) => admin.auth.admin.deleteUser(id)));
});
