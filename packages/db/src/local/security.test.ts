/**
 * The same rules as `security.test.ts`, through the real sign-in and the real API of a local
 * Supabase. Those tests prove the policies in a bare Postgres; these prove that a Supabase project
 * with the migrations applied behaves the same from where the app stands.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient, appClient, localStack } from "./stack";

const stack = localStack();
const admin = adminClient(stack);
const run = crypto.randomUUID().slice(0, 8);
const password = `pw-${crypto.randomUUID()}`;

interface Account {
  readonly id: string;
  readonly client: SupabaseClient;
  readonly space: string;
}

const made: string[] = [];

/** An account with its address confirmed, signed in as the app would be. */
async function account(name: string): Promise<Account> {
  const email = `${name}-${run}@example.com`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (created.error) throw created.error;
  const id = created.data.user.id;
  made.push(id);
  const client = appClient(stack);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  const spaces = await client.from("organizers").select("id");
  if (spaces.error) throw spaces.error;
  const space = spaces.data[0]?.id as string | undefined;
  if (!space) throw new Error("No space was made for the account");
  return { id, client, space };
}

const game = (space: string, id = "g1") => ({
  organizer_id: space,
  id,
  data: { id, organizerId: space, status: "open", createdAt: 1 },
});
const event = (space: string, id: string) => ({
  organizer_id: space,
  id,
  data: {
    id,
    organizerId: space,
    gameId: "g1",
    occurredAt: 5,
    type: "buy_in",
    playerId: "p1",
    chips: 1000,
  },
});

let host: Account;
let other: Account;

beforeAll(async () => {
  host = await account("host");
  other = await account("other");
  expect((await host.client.from("games").insert(game(host.space))).error).toBeNull();
  expect(
    (await host.client.from("ledger_events").insert(event(host.space, "e1"))).error,
  ).toBeNull();
});

afterAll(async () => {
  for (const id of made) await admin.auth.admin.deleteUser(id);
});

describe("an account made through sign-in", () => {
  it("has its profile, with the name it gave and a code, and one space of its own", async () => {
    const profile = await host.client.from("profiles").select("display_name, code");
    expect(profile.error).toBeNull();
    expect(profile.data).toHaveLength(1);
    expect(profile.data?.[0]?.display_name).toBe("host");
    expect(profile.data?.[0]?.code).toMatch(/^[0-9A-F]{8}$/);
    const members = await host.client.from("organizer_members").select("role");
    expect(members.data).toEqual([{ role: "owner" }]);
  });

  it("reads its own books through the API, with the columns worked out from each document", async () => {
    const games = await host.client.from("games").select("id, status, created_at");
    expect(games.data).toEqual([{ id: "g1", status: "open", created_at: 1 }]);
    const events = await host.client.from("ledger_events").select("id, game_id, type, player_id");
    expect(events.data).toEqual([{ id: "e1", game_id: "g1", type: "buy_in", player_id: "p1" }]);
  });
});

describe("another account", () => {
  it("reads none of the space's books and cannot write into it", async () => {
    expect((await other.client.from("games").select("id")).data).toEqual([]);
    expect((await other.client.from("ledger_events").select("id")).data).toEqual([]);
    expect((await other.client.from("organizers").select("id")).data).toEqual([
      { id: other.space },
    ]);
    const written = await other.client.from("games").insert(game(host.space, "g2"));
    expect(written.error?.code).toBe("42501");
  });
});

describe("a visitor who has not signed in", () => {
  it("reads nothing", async () => {
    const visitor = appClient(stack);
    for (const table of ["profiles", "organizers", "games", "players", "ledger_events"]) {
      const read = await visitor.from(table).select("*");
      expect(read.data ?? [], table).toEqual([]);
      expect(read.error?.code, table).toBe("42501");
    }
  });
});

describe("the ledger", () => {
  it("is never changed or deleted, even by the owner", async () => {
    const changed = await host.client
      .from("ledger_events")
      .update({ data: event(host.space, "e1").data })
      .eq("id", "e1");
    expect(changed.error?.code).toBe("42501");
    const deleted = await host.client.from("ledger_events").delete().eq("id", "e1");
    expect(deleted.error?.code).toBe("42501");
    expect((await host.client.from("ledger_events").select("id")).data).toHaveLength(1);
  });
});

describe("deleting an account", () => {
  it("takes its space and its books with it", async () => {
    const gone = await account("gone");
    await gone.client.from("games").insert(game(gone.space));
    await admin.auth.admin.deleteUser(gone.id);
    const left = await admin.from("games").select("id").eq("organizer_id", gone.space);
    expect(left.data).toEqual([]);
  });
});
