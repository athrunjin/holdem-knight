import "fake-indexeddb/auto";

import {
  cents,
  type Game,
  type GameSummary,
  type InsuranceHand,
  type LedgerEvent,
  type Player,
  type Repository,
  RULE_30,
  type SavedInsuranceRule,
} from "@holdem-knight/core";
import Dexie from "dexie";
import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type Change, createAccountDatabase } from "./account-database";
import { createAccountRepository } from "./account-repository";
import { type Call, createFakeServer, type FakeServer, type Fate } from "./fake-remote";
import { StorageError } from "./supabase-repository";
import {
  classify,
  createSync,
  type Lock,
  memoryLock,
  OnlineOnlyError,
  type SyncStatus,
  stoppedAtOf,
  watchOnline,
} from "./sync";

const SPACE = "space";
const opened: Dexie[] = [];

afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await Dexie.delete(db.name);
  }
});

interface Setup {
  readonly name?: string;
  readonly server?: FakeServer;
  readonly lock?: Lock;
  readonly online?: () => boolean;
  readonly reauth?: () => Promise<boolean>;
  readonly userId?: string;
  readonly signedInAs?: () => string | undefined;
}

/** A device with the space's books, sending to a space in memory. Waits are run by hand. */
function device({
  name,
  server = createFakeServer(SPACE),
  lock = memoryLock(),
  ...rest
}: Setup = {}) {
  const db = createAccountDatabase(SPACE, name ?? `test-sync-${crypto.randomUUID()}`);
  opened.push(db);
  const waits: (() => void)[] = [];
  const onPulled = vi.fn();
  const sync = createSync({
    db,
    remote: server,
    lock,
    lockName: db.name,
    onPulled,
    later: (run) => {
      waits.push(run);
      return () => waits.splice(waits.indexOf(run), 1);
    },
    ...rest,
  });
  const repository = createAccountRepository(db, SPACE, {
    changed: () => void sync.flush(),
    restore: (data) => sync.online(() => server.restore(data)),
  });
  sync.start();
  return { db, server, sync, repository, waits, onPulled };
}

const game = (id: string, more: Partial<Game> = {}): Game => ({
  id,
  organizerId: SPACE,
  currency: "CNY",
  smallBlindChips: 5,
  bigBlindChips: 10,
  chipRatio: { chips: 1, amount: cents(100) },
  status: "open",
  createdAt: 1,
  ...more,
});

const player = (id: string, name: string): Player => ({
  id,
  organizerId: SPACE,
  name,
  initials: name.toLowerCase(),
  createdAt: 1,
});

const buyIn = (id: string, gameId: string, chips = 100): LedgerEvent => ({
  id,
  organizerId: SPACE,
  gameId,
  occurredAt: 1,
  type: "buy_in",
  playerId: "p",
  chips,
});

const hand = (id: string, gameId: string): InsuranceHand => ({
  id,
  organizerId: SPACE,
  gameId,
  status: "open",
  step: "players",
  players: [],
  pools: [0],
  board: [],
  purchases: [],
  declined: [],
  createdAt: 1,
});

const rule = (id: string, name: string): SavedInsuranceRule => ({
  id,
  organizerId: SPACE,
  name,
  createdAt: 1,
  rule: RULE_30,
});

const summary = (gameId: string, rake = 0): GameSummary => ({
  id: gameId,
  organizerId: SPACE,
  basis: "[]",
  startedAt: 1,
  day: "2026-11-28",
  settledAt: 2,
  currency: "CNY",
  chipRatio: { chips: 1, amount: cents(100) },
  smallBlindChips: 5,
  bigBlindChips: 10,
  playerCount: 0,
  income: { rake: cents(rake), insurance: cents(0), wage: cents(0), tableFee: cents(0) },
  difference: cents(0),
  absorbed: cents(0),
  players: [],
  transfers: [],
});

const byId = (list: readonly { readonly id: string }[]) =>
  [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** The device's books and the account's, side by side: ledger events as sets, the rest by ID. */
async function bothSides(repository: Repository, server: FakeServer) {
  const { books, summaries } = server.snapshot();
  const local = await repository.backup.exportAll();
  const lists = Object.keys(books) as (keyof typeof books)[];
  return {
    device: {
      ...Object.fromEntries(lists.map((list) => [list, byId(local[list])])),
      summaries: byId(await repository.gameSummaries.list()),
    },
    account: {
      ...Object.fromEntries(lists.map((list) => [list, byId(books[list])])),
      summaries: byId(summaries),
    },
  };
}

const sends = (server: FakeServer) => server.arrived.map((change) => change.kind);

/** A promise and the way to settle it, for holding a call until the test lets it through. */
function held() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe("what failed, sorted", () => {
  it("tries again where no answer came or the answer said nothing of the change", () => {
    for (const status of [0, 408, 429, 500, 502, 503, 504]) {
      expect(classify(new StorageError("x", status))).toBe("retry");
    }
    expect(classify(new TypeError("fetch failed"))).toBe("retry");
  });

  it("renews the session for a 401", () => {
    expect(classify(new StorageError("JWT expired", 401))).toBe("reauth");
  });

  it("stops at any other answer that turns the change down", () => {
    for (const status of [400, 403, 404, 409, 413, 422]) {
      expect(classify(new StorageError("x", status))).toBe("refused");
    }
    // Turned down before it was sent
    expect(classify(new StorageError("not valid"))).toBe("refused");
  });
});

describe("the outbox", () => {
  it("keeps what is written with no network, readable on the device, and sends it once back", async () => {
    const { server, sync, repository, waits } = device();
    server.fate = () => "unanswered";

    await repository.games.save(game("g"));
    await repository.ledger.append(buyIn("e1", "g"));
    await repository.ledger.appendAll([buyIn("e2", "g"), buyIn("e3", "g")]);
    await sync.flush();

    expect(await sync.count()).toBe(3);
    expect((await repository.ledger.listByGame("g")).map(({ id }) => id)).toEqual([
      "e1",
      "e2",
      "e3",
    ]);
    expect(server.snapshot().books.games).toEqual([]);
    // It waits to try again, and not before
    expect(waits).toHaveLength(1);

    server.fate = () => "ok";
    waits.shift()?.();
    await vi.waitFor(async () => expect(await sync.count()).toBe(0));
    const { device: mine, account } = await bothSides(repository, server);
    expect(account).toEqual(mine);
    expect(server.snapshot().books.ledgerEvents).toHaveLength(3);
  });

  it("waits longer each time a try fails, and starts over once one goes through", async () => {
    const server = createFakeServer(SPACE);
    const db = createAccountDatabase(SPACE, `test-sync-${crypto.randomUUID()}`);
    opened.push(db);
    const delays: number[] = [];
    const sender = createSync({
      db,
      remote: server,
      lock: memoryLock(),
      lockName: db.name,
      later: (_run, ms) => {
        delays.push(ms);
        return () => {};
      },
    });
    const waiting = (id: string): Change => ({ kind: "save", list: "games", record: game(id) });
    await db.outbox.add({ keys: ["games:g"], change: waiting("g") });
    sender.start();
    server.fate = () => "unanswered";
    for (let i = 0; i < 7; i++) await sender.flush();
    expect(delays).toEqual([2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000]);

    server.fate = () => "ok";
    expect(await sender.flush()).toBe("sent");
    server.fate = () => "unanswered";
    await db.outbox.add({ keys: ["games:h"], change: waiting("h") });
    await sender.flush();
    expect(delays.at(-1)).toBe(2_000);
  });

  it("goes on through a network that comes and goes, with nothing doubled or lost", async () => {
    const { server, sync, repository } = device();
    const fates: Fate[] = ["unanswered", "ok", "lost", 503, "ok", "unanswered", "lost", "ok"];
    let call = 0;
    server.fate = () => fates[call++ % fates.length] ?? "ok";

    await repository.games.save(game("g"));
    for (let i = 0; i < 5; i++) await repository.ledger.append(buyIn(`e${i}`, "g"));
    await repository.players.save(player("p", "老王"));
    for (let i = 0; i < 20 && (await sync.count()) > 0; i++) await sync.flush();

    expect(await sync.count()).toBe(0);
    const { device: mine, account } = await bothSides(repository, server);
    expect(account).toEqual(mine);
  });

  it("takes a change that arrived but whose answer was lost as there, when it is sent again", async () => {
    const { server, sync, repository } = device();
    // Every first try arrives and its answer is lost
    const tried = new Set<string>();
    server.fate = (what: Call) => {
      const key = JSON.stringify(what);
      if (tried.has(key)) return "ok";
      tried.add(key);
      return "lost";
    };
    sync.stop();
    await repository.games.save(game("g"));
    await repository.ledger.appendAll([buyIn("e1", "g"), buyIn("e2", "g")]);
    await repository.players.ensure(player("organizer", "我"));
    await repository.insuranceRules.save(rule("r", "保险"));
    await repository.insuranceRules.remove("r");
    sync.start();
    for (let i = 0; i < 12 && (await sync.count()) > 0; i++) await sync.flush();

    expect(await sync.count()).toBe(0);
    // Each one arrived twice, and the account holds each record once
    expect(sends(server)).toEqual([
      "save",
      "save",
      "append",
      "append",
      "ensure",
      "ensure",
      "save",
      "save",
      "remove",
      "remove",
    ]);
    const { books } = server.snapshot();
    expect(books.ledgerEvents.map(({ id }) => id)).toEqual(["e1", "e2"]);
    expect(books.players).toEqual([player("organizer", "我")]);
    expect(books.insuranceRules).toEqual([]);
  });

  it("stops at a change the account turns down, keeps it and all after it, and counts them", async () => {
    const { server, sync, repository, waits } = device();
    sync.stop();
    await repository.games.save(game("g"));
    await repository.players.save(player("p", "老王"));
    await repository.ledger.append(buyIn("e1", "g"));
    server.fate = (what) =>
      what.kind === "send" && what.change.kind === "save" && what.change.list === "players"
        ? 400
        : "ok";
    const seen: SyncStatus[] = [];
    const unwatch = sync.watch((status) => seen.push(status));
    sync.start();

    expect(await sync.flush()).toBe("refused");
    expect(await sync.count()).toBe(2);
    // Not skipped: the event after it is not sent either, and nothing is tried again on a timer
    expect(server.snapshot().books.ledgerEvents).toEqual([]);
    expect(waits).toEqual([]);
    await vi.waitFor(() => expect(seen.at(-1)).toMatchObject({ pending: 2, refused: true }));
    // Still on the device, and in a backup of it
    expect(await repository.players.get("p")).toEqual(player("p", "老王"));
    expect((await repository.backup.exportAll()).ledgerEvents).toHaveLength(1);

    // Tried again when asked, and once taken the rest follows
    server.fate = () => "ok";
    expect(await sync.flush()).toBe("sent");
    await vi.waitFor(() => expect(seen.at(-1)).toMatchObject({ pending: 0, refused: false }));
    unwatch();
    const { device: mine, account } = await bothSides(repository, server);
    expect(account).toEqual(mine);
  });

  it("sends a game before its events, its insurance hands and its summary", async () => {
    const { server, sync, repository } = device();
    sync.stop();
    await repository.games.save(game("g"));
    await repository.insuranceHands.save(hand("h", "g"));
    await repository.ledger.append(buyIn("e", "g"));
    await repository.games.save(game("g", { status: "settled", settledAt: 2 }));
    await repository.gameSummaries.save(summary("g"));
    sync.start();

    // The account refuses any of them that comes before its game
    expect(await sync.flush()).toBe("sent");
    expect(
      server.arrived.map((change) => (change.kind === "save" ? change.list : change.kind)),
    ).toEqual(["games", "insuranceHands", "append", "games", "gameSummaries"]);
  });

  it("sends deletes in their place, and takes one of what is gone as done", async () => {
    const { server, sync, repository } = device();
    sync.stop();
    await repository.games.save(game("g"));
    await repository.insuranceHands.save(hand("h", "g"));
    await repository.insuranceHands.remove("h");
    await repository.insuranceRules.save(rule("r", "保险"));
    await repository.gameSummaries.save(summary("g"));
    await repository.gameSummaries.remove("g");
    sync.start();
    expect(await sync.flush()).toBe("sent");
    expect(server.snapshot().books.insuranceHands).toEqual([]);
    expect(server.snapshot().summaries).toEqual([]);

    // Gone from the account already, as another device deleted it
    sync.stop();
    await repository.insuranceRules.remove("r");
    await server.send({ kind: "remove", list: "insuranceRules", id: "r" });
    sync.start();
    expect(await sync.flush()).toBe("sent");
    expect(await sync.count()).toBe(0);
  });

  it("never replaces the own record the account has, made first on another device", async () => {
    const { server, sync, repository } = device();
    server.put("players", player("organizer", "老板"));
    sync.stop();
    // Made here with no network, as the player list does when it finds none
    expect(await repository.players.ensure(player("organizer", "我"))).toEqual(
      player("organizer", "我"),
    );
    sync.start();
    expect(await sync.flush()).toBe("sent");

    expect(server.snapshot().books.players).toEqual([player("organizer", "老板")]);
    await sync.pull();
    expect(await repository.players.get("organizer")).toEqual(player("organizer", "老板"));
  });

  it("renews the session once when it is not accepted, and sends again", async () => {
    let renewed = 0;
    const { server, sync, repository } = device({
      reauth: async () => {
        renewed += 1;
        return true;
      },
    });
    let first = true;
    server.fate = () => {
      if (!first) return "ok";
      first = false;
      return 401;
    };
    sync.stop();
    await repository.games.save(game("g"));
    sync.start();

    expect(await sync.flush()).toBe("sent");
    expect(renewed).toBe(1);
    expect(server.snapshot().books.games).toEqual([game("g")]);
  });

  it("waits without a session it can renew", async () => {
    const { server, sync, repository, waits } = device({ reauth: async () => false });
    server.fate = () => 401;
    await repository.games.save(game("g"));

    expect(await sync.flush()).toBe("waiting");
    expect(await sync.count()).toBe(1);
    expect(waits.length).toBeGreaterThan(0);
  });

  it("sends nothing under another account's session, and takes its refusal as waiting", async () => {
    let user: string | undefined = "wang";
    const { server, sync, repository, db } = device({ userId: "lin", signedInAs: () => user });
    sync.stop();
    await repository.games.save(game("g"));
    sync.start();

    expect(await sync.flush()).toBe("waiting");
    expect(server.arrived).toEqual([]);

    // Signed in as lin when it goes out, and as wang by the time the account answers 403
    user = "lin";
    server.fate = () => {
      user = "wang";
      return 403;
    };
    expect(await sync.flush()).toBe("waiting");
    const [entry] = await db.outbox.toArray();
    expect(entry?.refused).toBeUndefined();
  });

  it("says it is waiting, not refused, once the change turned down fails for want of a network", async () => {
    const { server, sync, repository } = device();
    sync.stop();
    await repository.games.save(game("g"));
    server.fate = () => 400;
    const seen: SyncStatus[] = [];
    const unwatch = sync.watch((status) => seen.push(status));
    sync.start();
    expect(await sync.flush()).toBe("refused");
    await vi.waitFor(() => expect(seen.at(-1)).toMatchObject({ pending: 1, refused: true }));

    server.fate = () => "unanswered";
    expect(await sync.flush()).toBe("waiting");
    await vi.waitFor(() => expect(seen.at(-1)).toMatchObject({ pending: 1, refused: false }));
    unwatch();
  });

  it("sends nothing while stopped, as when the books are not the ones in use", async () => {
    const { server, sync, repository } = device();
    sync.stop();
    await repository.games.save(game("g"));

    expect(await sync.flush()).toBe("waiting");
    expect(server.arrived).toEqual([]);
  });

  it("is sent by one tab at a time, each change once", async () => {
    const server = createFakeServer(SPACE);
    const lock = memoryLock();
    const name = `test-sync-${crypto.randomUUID()}`;
    const one = device({ name, server, lock });
    const two = device({ name, server, lock });
    let calls = 0;
    server.gate = async () => {
      calls += 1;
      // Each call takes a while, so the other tab would overlap it if it could
      await new Promise((resolve) => setTimeout(resolve, 2));
    };
    one.sync.stop();
    two.sync.stop();
    await one.repository.games.save(game("g"));
    for (let i = 0; i < 6; i++) {
      await (i % 2 ? one : two).repository.ledger.append(buyIn(`e${i}`, "g"));
    }
    one.sync.start();
    two.sync.start();

    await Promise.all([one.sync.flush(), two.sync.flush(), one.sync.flush(), two.sync.flush()]);
    expect(server.mostAtOnce).toBe(1);
    expect(calls).toBe(7);
    expect(server.arrived).toHaveLength(7);
    expect(await one.sync.count()).toBe(0);
  });
});

describe("the pull", () => {
  it("lets go of what it read when the books are let go meanwhile, and marks nothing", async () => {
    const { server, sync, repository } = device();
    server.put("games", game("g"));
    const answering = held();
    const read = server.pull;
    server.pull = async () => {
      const snapshot = await read();
      await answering.promise;
      return snapshot;
    };

    const pulled = sync.pull();
    await new Promise((resolve) => setTimeout(resolve, 5));
    sync.stop();
    answering.release();

    expect(await pulled).toBe("discarded");
    expect(await repository.games.list()).toEqual([]);
    expect(await sync.pulled()).toBe(false);
  });

  it("lets go of what it read when another account signed in meanwhile", async () => {
    let user: string | undefined = "lin";
    const { server, sync, repository } = device({ userId: "lin", signedInAs: () => user });
    server.put("games", game("g"));
    await sync.pull();
    expect(await repository.games.list()).toEqual([game("g")]);

    // Read under the other account's session, the space looks empty
    const empty = createFakeServer(SPACE);
    server.pull = async () => {
      user = "wang";
      return empty.snapshot();
    };
    expect(await sync.pull()).toBe("discarded");
    expect(await repository.games.list()).toEqual([game("g")]);

    // And it is not read at all while that account is signed in
    const reads = vi.fn(empty.pull);
    server.pull = reads;
    expect(await sync.pull()).toBe("discarded");
    expect(reads).not.toHaveBeenCalled();
  });

  it("makes the device's copy what the account holds, summaries included", async () => {
    const { server, sync, repository, onPulled } = device();
    server.put("games", game("g", { status: "settled", settledAt: 2 }));
    server.put("ledgerEvents", buyIn("e", "g"));
    server.put("players", player("p", "老王"));
    server.put("gameSummaries", summary("g", 300));

    expect(await sync.pulled()).toBe(false);
    await sync.pull();

    expect(await sync.pulled()).toBe(true);
    expect(await repository.gameSummaries.list()).toEqual([summary("g", 300)]);
    const { device: mine, account } = await bothSides(repository, server);
    expect(mine).toEqual(account);
    expect(onPulled).toHaveBeenCalledTimes(1);

    // Nothing changed, so the pages are not asked to read again
    await sync.pull();
    expect(onPulled).toHaveBeenCalledTimes(1);
  });

  it("leaves a record with a change still to send as the device has it", async () => {
    const { server, sync, repository } = device();
    server.put("games", game("g"));
    server.put("players", player("p", "老王"));
    await sync.pull();
    server.fate = (what) => (what.kind === "pull" ? "ok" : "unanswered");

    await repository.games.save(game("g", { status: "settling" }));
    await repository.players.save(player("mine", "新来的"));
    await repository.ledger.append(buyIn("e", "g"));
    // Changed on another device meanwhile, and that player gone there
    server.put("games", game("g", { status: "settled", settledAt: 3 }));
    server.put("players", player("p", "王哥"));
    await sync.pull();

    expect((await repository.games.get("g"))?.status).toBe("settling");
    expect(await repository.players.get("mine")).toEqual(player("mine", "新来的"));
    expect((await repository.ledger.listByGame("g")).map(({ id }) => id)).toEqual(["e"]);
    // What has nothing waiting follows the account
    expect(await repository.players.get("p")).toEqual(player("p", "王哥"));
  });

  it("deletes what the account no longer has and nothing waits for", async () => {
    const { server, sync, repository } = device();
    server.put("games", game("g"));
    server.put("insuranceHands", hand("gone", "g"));
    server.put("insuranceRules", rule("r", "保险"));
    server.put("gameSummaries", summary("g"));
    await sync.pull();
    expect(await repository.insuranceHands.listByGame("g")).toHaveLength(1);

    const { books } = server.snapshot();
    const fresh = createFakeServer(SPACE);
    fresh.put("games", books.games[0] as Game);
    // The same space read again, without the hand, the rule and the summary
    Object.assign(server, { pull: fresh.pull });
    await sync.pull();

    expect(await repository.insuranceHands.listByGame("g")).toEqual([]);
    expect(await repository.insuranceRules.list()).toEqual([]);
    expect(await repository.gameSummaries.list()).toEqual([]);
    expect(await repository.games.list()).toEqual([game("g")]);
  });

  it("never runs beside the sender, so a change sent meanwhile is not deleted with an old read", async () => {
    const { server, sync, repository } = device();
    sync.stop();
    await repository.games.save(game("new"));
    // The account is read before the game reaches it, and the answer is slow to come back
    const answering = held();
    const read = server.pull;
    server.pull = async () => {
      const before = await read();
      await answering.promise;
      return before;
    };
    sync.start();

    const pulled = sync.pull();
    const flushed = sync.flush();
    await new Promise((resolve) => setTimeout(resolve, 5));
    // The sender waits for the pull: had it sent the game and let its change go, the old read
    // would find a game the account lacks with nothing waiting for it, and delete it
    expect(server.arrived).toEqual([]);
    answering.release();
    await Promise.all([pulled, flushed]);

    expect(await sync.count()).toBe(0);
    expect(await repository.games.get("new")).toEqual(game("new"));
    expect(server.snapshot().books.games).toEqual([game("new")]);
  });

  it("keeps a record written on a page while it reads the account", async () => {
    const { server, sync, repository } = device();
    const reading = held();
    server.gate = (what) => (what.kind === "pull" ? reading.promise : Promise.resolve());
    server.fate = (what) => (what.kind === "pull" ? "ok" : "unanswered");

    const pulled = sync.pull();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await repository.games.save(game("written"));
    reading.release();
    await pulled;

    expect(await repository.games.get("written")).toEqual(game("written"));
  });
});

describe("a step that has to reach the account", () => {
  it("is not run when the account cannot be read first, and nothing changes on either side", async () => {
    const { server, sync, repository } = device();
    server.put("games", game("there"));
    await sync.pull();
    server.put("games", game("since"));
    server.fate = (what) => (what.kind === "pull" ? 503 : "ok");
    const step = vi.fn(async () => {});

    await expect(sync.online(step)).rejects.toEqual(new OnlineOnlyError("offline"));
    expect(step).not.toHaveBeenCalled();
    expect((await repository.games.list()).map(({ id }) => id)).toEqual(["there"]);
    expect(server.snapshot().books.games.map(({ id }) => id)).toEqual(["since", "there"]);

    // A restore goes the same way: refused, with nothing added anywhere
    const restored = repository.backup.restore({
      games: [game("restored")],
      players: [],
      ledgerEvents: [],
      insuranceRules: [],
      insuranceHands: [],
      gameConfigs: [],
      oddsTables: [],
      chargeRules: [],
    });
    await expect(restored).rejects.toBeInstanceOf(OnlineOnlyError);
    expect(server.snapshot().books.games.map(({ id }) => id)).toEqual(["since", "there"]);
    expect((await repository.games.list()).map(({ id }) => id)).toEqual(["there"]);
  });

  it("is not run with no connection, and writes nothing", async () => {
    const { sync } = device({ online: () => false });
    const step = vi.fn(async () => {});

    await expect(sync.online(step)).rejects.toEqual(new OnlineOnlyError("offline"));
    expect(step).not.toHaveBeenCalled();
  });

  it("is not run while records are left to send, and says how many", async () => {
    const { server, sync, repository } = device();
    sync.stop();
    await repository.games.save(game("g"));
    await repository.players.save(player("p", "老王"));
    server.fate = (what) => (what.kind === "send" ? 422 : "ok");
    sync.start();
    const step = vi.fn(async () => {});

    const failed = sync.online(step);
    await expect(failed).rejects.toBeInstanceOf(OnlineOnlyError);
    await expect(failed).rejects.toMatchObject({ reason: "unsent", unsent: 2 });
    expect(step).not.toHaveBeenCalled();
  });

  it("runs once all is sent, and the copy is read again after it", async () => {
    const { server, sync, repository } = device();
    sync.stop();
    await repository.games.save(game("g"));
    sync.start();

    const result = await repository.backup.restore({
      games: [game("restored")],
      players: [player("p", "老王")],
      ledgerEvents: [],
      insuranceRules: [],
      insuranceHands: [],
      gameConfigs: [],
      oddsTables: [],
      chargeRules: [],
    });

    expect(result).toEqual({ added: 2, skipped: 0 });
    expect((await repository.games.list()).map(({ id }) => id).sort()).toEqual(["g", "restored"]);
    const { device: mine, account } = await bothSides(repository, server);
    expect(mine).toEqual(account);
  });
});

describe("the device and the account, once the network is back", () => {
  type Op =
    | { readonly kind: "game"; readonly n: number; readonly status: Game["status"] }
    | { readonly kind: "player"; readonly n: number; readonly name: string }
    | { readonly kind: "own"; readonly name: string }
    | { readonly kind: "events"; readonly n: number; readonly count: number }
    | { readonly kind: "hand"; readonly n: number; readonly game: number }
    | { readonly kind: "dropHand"; readonly n: number }
    | { readonly kind: "summary"; readonly game: number; readonly rake: number }
    | { readonly kind: "dropSummary"; readonly game: number }
    | { readonly kind: "rule"; readonly n: number; readonly name: string }
    | { readonly kind: "dropRule"; readonly n: number }
    | { readonly kind: "flush" }
    | { readonly kind: "pull" };

  const small = fc.integer({ min: 0, max: 3 });
  const name = fc.constantFrom("老王", "小李", "Amy", "张三");
  const op: fc.Arbitrary<Op> = fc.oneof(
    fc.record({
      kind: fc.constant("game" as const),
      n: small,
      status: fc.constantFrom("open" as const, "settling" as const, "settled" as const),
    }),
    fc.record({ kind: fc.constant("player" as const), n: small, name }),
    fc.record({ kind: fc.constant("own" as const), name }),
    fc.record({
      kind: fc.constant("events" as const),
      n: small,
      count: fc.integer({ min: 1, max: 3 }),
    }),
    fc.record({ kind: fc.constant("hand" as const), n: small, game: small }),
    fc.record({ kind: fc.constant("dropHand" as const), n: small }),
    fc.record({
      kind: fc.constant("summary" as const),
      game: small,
      rake: fc.integer({ min: 0, max: 900 }),
    }),
    fc.record({ kind: fc.constant("dropSummary" as const), game: small }),
    fc.record({ kind: fc.constant("rule" as const), n: small, name }),
    fc.record({ kind: fc.constant("dropRule" as const), n: small }),
    fc.constant({ kind: "flush" as const }),
    fc.constant({ kind: "pull" as const }),
  );
  const fate: fc.Arbitrary<Fate> = fc.constantFrom<Fate>(
    "ok",
    "ok",
    "unanswered",
    "lost",
    503,
    429,
  );

  it("hold the same books, whatever was written and however the network failed", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(op, { maxLength: 30 }),
        fc.array(fate, { minLength: 1, maxLength: 20 }),
        async (ops, fates) => {
          const { server, sync, repository, db } = device();
          let call = 0;
          server.fate = () => fates[call++ % fates.length] ?? "ok";
          const games = new Set<number>();
          let event = 0;

          for (const step of ops) {
            switch (step.kind) {
              case "game":
                await repository.games.save(
                  game(
                    `g${step.n}`,
                    step.status === "settled"
                      ? { status: "settled", settledAt: 2 }
                      : { status: step.status },
                  ),
                );
                games.add(step.n);
                break;
              case "player":
                await repository.players.save(player(`p${step.n}`, step.name));
                break;
              case "own":
                await repository.players.ensure(player("organizer", step.name));
                break;
              case "events":
                if (!games.has(step.n)) break;
                await repository.ledger.appendAll(
                  Array.from({ length: step.count }, () => buyIn(`e${event++}`, `g${step.n}`)),
                );
                break;
              case "hand":
                if (!games.has(step.game)) break;
                await repository.insuranceHands.save(hand(`h${step.n}`, `g${step.game}`));
                break;
              case "dropHand":
                await repository.insuranceHands.remove(`h${step.n}`);
                break;
              case "summary":
                if (!games.has(step.game)) break;
                await repository.gameSummaries.save(summary(`g${step.game}`, step.rake));
                break;
              case "dropSummary":
                await repository.gameSummaries.remove(`g${step.game}`);
                break;
              case "rule":
                await repository.insuranceRules.save(rule(`r${step.n}`, step.name));
                break;
              case "dropRule":
                await repository.insuranceRules.remove(`r${step.n}`);
                break;
              case "flush":
                await sync.flush();
                break;
              case "pull":
                await sync.pull().catch(() => undefined);
                break;
            }
          }

          // The network is back
          server.fate = () => "ok";
          expect(await sync.flush()).toBe("sent");
          const { device: mine, account } = await bothSides(repository, server);
          expect(account).toEqual(mine);
          // And reading the account again changes nothing on the device
          await sync.pull();
          expect((await bothSides(repository, server)).device).toEqual(mine);

          sync.stop();
          db.close();
          await Dexie.delete(db.name);
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe("the copy at a sign-out", () => {
  it("is deleted once everything is sent", async () => {
    const { sync, repository, db } = device();
    await repository.games.save(game("g"));
    expect(await sync.flush()).toBe("sent");

    expect(await sync.forgetIfSent()).toBe(true);
    expect(await Dexie.exists(db.name)).toBe(false);
  });

  it("is kept with records still to send, and sends them when its books open again", async () => {
    const server = createFakeServer(SPACE);
    const name = `test-sync-${crypto.randomUUID()}`;
    const first = device({ name, server });
    server.fate = () => "unanswered";
    await first.repository.games.save(game("g"));
    await first.sync.flush();

    expect(await first.sync.forgetIfSent()).toBe(false);
    expect(await Dexie.exists(name)).toBe(true);

    // The same account signs in again on this device
    server.fate = () => "ok";
    const again = device({ name, server });
    expect(await again.sync.count()).toBe(1);
    expect(await again.sync.flush()).toBe("sent");
    expect(server.snapshot().books.games).toEqual([game("g")]);
  });
});

describe("what the interface reads of the sync", () => {
  it("says a send is under way in this tab while it is, and not once it ends", async () => {
    const gate = held();
    let holding = false;
    const inner = memoryLock();
    const lock: Lock = {
      run: (name, task) =>
        inner.run(name, async () => {
          if (holding) await gate.promise;
          return task();
        }),
    };
    const { sync, repository } = device({ lock });
    sync.stop();
    await repository.games.save(game("g"));
    const seen: SyncStatus[] = [];
    const unwatch = sync.watch((status) => seen.push(status));
    await vi.waitFor(() => expect(seen.at(-1)).toMatchObject({ pending: 1, sending: false }));
    sync.start();
    holding = true;

    const flushed = sync.flush();
    await vi.waitFor(() => expect(seen.at(-1)).toMatchObject({ pending: 1, sending: true }));
    gate.release();
    expect(await flushed).toBe("sent");
    await vi.waitFor(() => expect(seen.at(-1)).toMatchObject({ pending: 0, sending: false }));
    unwatch();
  });

  it("gives when the copy was last read from the account, and nothing before the first read", async () => {
    let clock = 1_000;
    const server = createFakeServer(SPACE);
    const db = createAccountDatabase(SPACE, `test-sync-${crypto.randomUUID()}`);
    opened.push(db);
    const sync = createSync({
      db,
      remote: server,
      lock: memoryLock(),
      lockName: db.name,
      now: () => clock,
    });
    sync.start();
    const seen: SyncStatus[] = [];
    const unwatch = sync.watch((status) => seen.push(status));
    await vi.waitFor(() => expect(seen.at(-1)).toMatchObject({ pending: 0 }));
    expect(seen.at(-1)?.pulledAt).toBeUndefined();

    await sync.pull();
    await vi.waitFor(() => expect(seen.at(-1)?.pulledAt).toBe(1_000));
    clock = 5_000;
    await sync.sync();
    await vi.waitFor(() => expect(seen.at(-1)?.pulledAt).toBe(5_000));
    unwatch();
  });

  it("names what the first refused change is of, and its game, with the answer's code only", async () => {
    const { server, sync, repository } = device();
    sync.stop();
    await repository.games.save(game("g"));
    await repository.ledger.append(buyIn("e1", "g"));
    server.fate = (what) => (what.kind === "send" && what.change.kind === "append" ? 403 : "ok");
    const seen: SyncStatus[] = [];
    const unwatch = sync.watch((status) => seen.push(status));
    sync.start();

    expect(await sync.flush()).toBe("refused");
    await vi.waitFor(() =>
      expect(seen.at(-1)).toMatchObject({
        pending: 1,
        refused: true,
        stoppedAt: { kind: "ledger", removed: false, gameId: "g", code: 403 },
      }),
    );
    expect(JSON.stringify(seen.at(-1))).not.toContain("Answered");

    // Taken once tried again: nothing is stopped at any more
    server.fate = () => "ok";
    expect(await sync.flush()).toBe("sent");
    await vi.waitFor(() => expect(seen.at(-1)).toMatchObject({ pending: 0, refused: false }));
    expect(seen.at(-1)?.stoppedAt).toBeUndefined();
    unwatch();
  });

  it("has no place to stop at while what waits has not been refused", async () => {
    const { server, sync, repository } = device();
    sync.stop();
    await repository.games.save(game("g"));
    server.fate = () => "unanswered";
    const seen: SyncStatus[] = [];
    const unwatch = sync.watch((status) => seen.push(status));
    sync.start();

    expect(await sync.flush()).toBe("waiting");
    await vi.waitFor(() => expect(seen.at(-1)).toMatchObject({ pending: 1, refused: false }));
    expect(seen.at(-1)?.stoppedAt).toBeUndefined();
    unwatch();
  });

  it("sorts every kind of change into the app's terms", async () => {
    const db = createAccountDatabase(SPACE, `test-sync-${crypto.randomUUID()}`);
    opened.push(db);
    const of = (change: Change) => stoppedAtOf(db, { keys: [], change });

    expect(await of({ kind: "save", list: "games", record: game("g") })).toEqual({
      kind: "game",
      removed: false,
      gameId: "g",
    });
    expect(await of({ kind: "save", list: "players", record: player("p", "老王") })).toEqual({
      kind: "player",
      removed: false,
    });
    expect(await of({ kind: "ensure", record: player("p", "老王") })).toEqual({
      kind: "player",
      removed: false,
    });
    expect(await of({ kind: "save", list: "insuranceHands", record: hand("h", "g") })).toEqual({
      kind: "insuranceHand",
      removed: false,
      gameId: "g",
    });
    expect(await of({ kind: "save", list: "gameSummaries", record: summary("g") })).toEqual({
      kind: "summary",
      removed: false,
      gameId: "g",
    });
    expect(await of({ kind: "save", list: "insuranceRules", record: rule("r", "30") })).toEqual({
      kind: "setting",
      removed: false,
    });
    expect(await of({ kind: "remove", list: "gameConfigs", id: "c" })).toEqual({
      kind: "setting",
      removed: true,
    });
    expect(await of({ kind: "remove", list: "gameSummaries", id: "g" })).toEqual({
      kind: "summary",
      removed: true,
      gameId: "g",
    });
  });

  it("finds a deleted insurance hand's game in the copy, and gives the kind alone once it is gone", async () => {
    const db = createAccountDatabase(SPACE, `test-sync-${crypto.randomUUID()}`);
    opened.push(db);
    const change: Change = { kind: "remove", list: "insuranceHands", id: "h" };

    expect(await stoppedAtOf(db, { keys: [], change })).toEqual({
      kind: "insuranceHand",
      removed: true,
    });
    await db.insuranceHands.put(hand("h", "g"));
    expect(
      await stoppedAtOf(db, { keys: [], change, refused: { status: 400, message: "no", at: 1 } }),
    ).toEqual({ kind: "insuranceHand", removed: true, gameId: "g", code: 400 });
  });

  it("calls back as the connection comes and goes, until told to stop", () => {
    const target = new EventTarget();
    const listener = vi.fn();
    const stop = watchOnline(listener, target);

    target.dispatchEvent(new Event("offline"));
    target.dispatchEvent(new Event("online"));
    expect(listener).toHaveBeenCalledTimes(2);

    stop();
    target.dispatchEvent(new Event("offline"));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
