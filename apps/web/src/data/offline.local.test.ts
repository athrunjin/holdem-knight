/**
 * An account's books written on the device with no network and sent once it is back, against the
 * local Supabase (`pnpm db:start`, then `pnpm test:local`): the grants and keys the sender relies
 * on are the database's own (ADR 0054).
 */
import "fake-indexeddb/auto";

import {
  cents,
  type Game,
  type GameSummary,
  type LedgerEvent,
  ORGANIZER_PLAYER_ID,
  type Player,
} from "@holdem-knight/core";
import { createClient } from "@supabase/supabase-js";
import Dexie from "dexie";
import { afterAll, describe, expect, it } from "vitest";

import { TERMS_VERSION } from "@/lib/terms";
import { createAccountDatabase } from "./account-database";
import { createAccountRepository } from "./account-repository";
import { createSupabaseRemote } from "./supabase-remote";
import { StorageError } from "./supabase-repository";
import { classify, createSync, memoryLock } from "./sync";

const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: publicKey } = import.meta.env;
const quiet = { auth: { persistSession: false, autoRefreshToken: false } };
/** For making accounts, reading past the app and clearing them away. Never for what is under test. */
const admin = createClient(url, import.meta.env.SUPABASE_SECRET_KEY, quiet);
const password = `pw-${crypto.randomUUID()}`;
const made: string[] = [];
const opened: Dexie[] = [];

/** How the network behaves for one account's client, as the test sets it. */
interface Network {
  /** No request gets through */
  offline: boolean;
  /** Requests matching this get through, and their answers are lost */
  loseAnswer?: ((url: string, method: string) => boolean) | undefined;
}

/** A new account that has agreed, on a device whose network the test controls. */
async function device() {
  const email = `offline-${crypto.randomUUID()}@example.com`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "离线测试", terms_version: TERMS_VERSION },
  });
  if (created.error) throw created.error;
  made.push(created.data.user.id);
  const network: Network = { offline: false };
  const client = createClient(url, publicKey, {
    ...quiet,
    db: { retry: false, timeout: 20_000 },
    global: {
      fetch: async (input, init) => {
        const address = input instanceof Request ? input.url : String(input);
        if (network.offline) throw new TypeError("Failed to fetch");
        const answer = await fetch(input, init);
        if (network.loseAnswer?.(address, init?.method ?? "GET")) {
          throw new TypeError("Failed to fetch");
        }
        return answer;
      },
    },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  const spaces = await client.from("organizers").select("id");
  const space = spaces.data?.[0]?.id as string;

  const db = createAccountDatabase(space, `test-offline-${crypto.randomUUID()}`);
  opened.push(db);
  const remote = createSupabaseRemote(client, space);
  const sync = createSync({
    db,
    remote,
    lock: memoryLock(),
    lockName: db.name,
    online: () => !network.offline,
    reauth: async () => !(await client.auth.refreshSession()).error,
    later: () => () => {},
  });
  const repository = createAccountRepository(db, space, {
    changed: () => void sync.flush(),
    restore: (data) => sync.online(() => remote.restore(data)),
  });
  sync.start();
  await sync.pull();
  return { client, network, space, db, remote, sync, repository };
}

/** A list of the space, read past the app. */
async function inTheSpace(table: string, space: string) {
  const { data, error } = await admin
    .from(table)
    .select("id, data")
    .eq("organizer_id", space)
    .order("id");
  if (error) throw error;
  return (data ?? []).map((row) => row.data as { id: string });
}

const game = (space: string, more: Partial<Game> = {}): Game => ({
  id: "g1",
  organizerId: space,
  currency: "CNY",
  smallBlindChips: 5,
  bigBlindChips: 10,
  chipRatio: { chips: 1, amount: cents(100) },
  status: "open",
  createdAt: Date.UTC(2026, 10, 28, 12),
  timeZone: "Asia/Shanghai",
  ...more,
});

const buyIn = (space: string, id: string, chips: number): LedgerEvent => ({
  id,
  organizerId: space,
  gameId: "g1",
  occurredAt: Date.UTC(2026, 10, 28, 12, 5),
  type: "buy_in",
  playerId: "p1",
  chips,
});

const player = (space: string, id: string, name: string): Player => ({
  id,
  organizerId: space,
  name,
  initials: name,
  createdAt: 1,
});

const summary = (space: string): GameSummary => ({
  id: "g1",
  organizerId: space,
  basis: "[]",
  startedAt: Date.UTC(2026, 10, 28, 12),
  day: "2026-11-28",
  settledAt: Date.UTC(2026, 10, 28, 16),
  currency: "CNY",
  chipRatio: { chips: 1, amount: cents(100) },
  smallBlindChips: 5,
  bigBlindChips: 10,
  playerCount: 1,
  income: { rake: cents(0), insurance: cents(0), wage: cents(0), tableFee: cents(0) },
  difference: cents(0),
  absorbed: cents(0),
  players: [],
  transfers: [],
});

afterAll(async () => {
  for (const db of opened) {
    db.close();
    await Dexie.delete(db.name);
  }
  await Promise.all(made.map((id) => admin.auth.admin.deleteUser(id)));
});

describe("an account's books with no network", () => {
  it("are recorded on the device, and reach the account in order once it is back", async () => {
    const { network, space, sync, repository } = await device();
    network.offline = true;

    await repository.players.ensure(player(space, ORGANIZER_PLAYER_ID, "离线测试"));
    await repository.players.save(player(space, "p1", "老王"));
    await repository.games.save(game(space));
    await repository.ledger.append(buyIn(space, "e1", 1000));
    await repository.ledger.appendAll([buyIn(space, "e2", 500), buyIn(space, "e3", 500)]);
    await repository.games.save(game(space, { status: "settled", settledAt: 2 }));
    await repository.gameSummaries.save(summary(space));
    await sync.flush();

    expect(await sync.count()).toBe(7);
    expect(await inTheSpace("games", space)).toEqual([]);
    expect((await repository.ledger.listByGame("g1")).map(({ id }) => id)).toEqual([
      "e1",
      "e2",
      "e3",
    ]);

    network.offline = false;
    expect(await sync.flush()).toBe("sent");
    expect(await sync.count()).toBe(0);
    expect(await inTheSpace("games", space)).toEqual([
      game(space, { status: "settled", settledAt: 2 }),
    ]);
    expect((await inTheSpace("ledger_events", space)).map(({ id }) => id)).toEqual([
      "e1",
      "e2",
      "e3",
    ]);
    expect(await inTheSpace("game_summaries", space)).toEqual([summary(space)]);
    expect((await inTheSpace("players", space)).map(({ id }) => id)).toEqual([
      ORGANIZER_PLAYER_ID,
      "p1",
    ]);
  });

  it("are sent again where the answer was lost, with nothing doubled", async () => {
    const { network, space, sync, repository, remote } = await device();
    await repository.games.save(game(space));
    expect(await sync.flush()).toBe("sent");

    // The events reach the account, and the answer never comes back
    network.loseAnswer = (address, method) =>
      address.includes("/rest/v1/ledger_events") && method === "POST";
    await repository.ledger.appendAll([buyIn(space, "e1", 1000), buyIn(space, "e2", 500)]);
    expect(await sync.flush()).toBe("waiting");
    expect((await inTheSpace("ledger_events", space)).map(({ id }) => id)).toEqual(["e1", "e2"]);

    network.loseAnswer = undefined;
    expect(await sync.flush()).toBe("sent");
    expect((await inTheSpace("ledger_events", space)).map(({ id }) => id)).toEqual(["e1", "e2"]);

    // Each kind of change sent twice leaves the account as once did, through its own grants
    const own = player(space, ORGANIZER_PLAYER_ID, "离线测试");
    for (let i = 0; i < 2; i++) {
      await remote.send({ kind: "append", events: [buyIn(space, "e3", 200)] });
      await remote.send({ kind: "ensure", record: own });
      await remote.send({ kind: "save", list: "games", record: game(space) });
      await remote.send({ kind: "remove", list: "insuranceHands", id: "none" });
    }
    expect((await inTheSpace("ledger_events", space)).map(({ id }) => id)).toEqual([
      "e1",
      "e2",
      "e3",
    ]);
    // An event sent again with other content is the one the account has
    await remote.send({ kind: "append", events: [buyIn(space, "e3", 999)] });
    const events = await inTheSpace("ledger_events", space);
    expect(events.find(({ id }) => id === "e3")).toEqual(buyIn(space, "e3", 200));
  });

  it("stop at a change the account turns down, and keep it and everything after it", async () => {
    const { space, db, sync, repository, remote } = await device();
    // Events for a game the account has never had: the database turns them down
    const orphan = { ...buyIn(space, "lost", 100), gameId: "nowhere" };
    await db.outbox.add({
      keys: ["ledgerEvents:lost"],
      change: { kind: "append", events: [orphan] },
    });
    await repository.players.save(player(space, "p1", "老王"));

    const answer = await remote.send({ kind: "append", events: [orphan] }).catch((e) => e);
    expect(answer).toBeInstanceOf(StorageError);
    expect(classify(answer)).toBe("refused");

    expect(await sync.flush()).toBe("refused");
    expect(await sync.count()).toBe(2);
    const [first] = await db.outbox.orderBy("seq").toArray();
    expect(first?.refused?.status).toBe(409);
    expect(await inTheSpace("players", space)).toEqual([]);
    expect((await repository.backup.exportAll()).players).toEqual([player(space, "p1", "老王")]);

    // Once the account has the game, the queue goes on
    await admin
      .from("games")
      .insert({ organizer_id: space, id: "nowhere", data: game(space, { id: "nowhere" }) });
    expect(await sync.flush()).toBe("sent");
    expect((await inTheSpace("players", space)).map(({ id }) => id)).toEqual(["p1"]);
  });

  it("ask for the session again when the account does not take it", async () => {
    const { client, space, remote } = await device();
    await client.auth.signOut({ scope: "local" });

    const answer = await remote
      .send({ kind: "save", list: "games", record: game(space) })
      .catch((e) => e);
    expect(classify(answer)).toBe("reauth");
  });

  it("refuse a restore offline, and with records unsent, writing nothing", async () => {
    const { network, space, sync, repository } = await device();
    network.offline = true;
    await repository.games.save(game(space));
    const backup = await repository.backup.exportAll();

    await expect(repository.backup.restore(backup)).rejects.toMatchObject({ reason: "offline" });
    network.offline = false;
    network.loseAnswer = () => true;
    await expect(repository.backup.restore(backup)).rejects.toMatchObject({
      reason: "unsent",
      unsent: 1,
    });
    network.loseAnswer = undefined;
    // The game arrived with its answer lost; sent again, it is there once, and the restore runs
    expect(await repository.backup.restore(backup)).toEqual({ added: 0, skipped: 1 });
    expect(await sync.count()).toBe(0);
  });
});
