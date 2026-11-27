import "fake-indexeddb/auto";

import {
  type BackupData,
  cents,
  type Game,
  type LedgerEvent,
  ORGANIZER_PLAYER_ID,
  type Player,
  type Repository,
  RULE_30,
} from "@holdem-knight/core";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDexieRepository, createGuestDatabase } from "./dexie-repository";
import type { ImportMarks } from "./guest-import";

// The books in use are not what is under test here
vi.mock(".", () => ({ repository: {} }));

const { bringGuestBooks, fingerprintOf, guestOffer, holdingsOf } = await import("./guest-import");
const { currentSummaries } = await import("./summaries");

const GUEST = "guest";
const SPACE = "space-1";

const settled: Game = {
  id: "g-settled",
  organizerId: GUEST,
  currency: "CNY",
  smallBlindChips: 5,
  bigBlindChips: 10,
  chipRatio: { chips: 1, amount: cents(100) },
  status: "settled",
  createdAt: Date.UTC(2026, 10, 21, 12),
  settledAt: Date.UTC(2026, 10, 21, 16),
  timeZone: "Asia/Shanghai",
};
/** Still being played, as the guest left it. */
const { settledAt: _, ...unsettled } = settled;
const open: Game = { ...unsettled, id: "g-open", status: "open" };

const event = (
  id: string,
  gameId: string,
  type: "buy_in" | "cash_out",
  playerId: string,
  chips: number,
): LedgerEvent => ({
  id,
  organizerId: GUEST,
  gameId,
  occurredAt: settled.createdAt + (type === "buy_in" ? 60_000 : 3_600_000),
  type,
  playerId,
  chips,
});

const player = (id: string, name: string, organizerId = GUEST): Player => ({
  id,
  organizerId,
  name,
  initials: name,
  createdAt: 1,
});

/** The host played under the organizer seat, and won 500 off 老王. */
const hostPlayed = [
  event("e1", settled.id, "buy_in", ORGANIZER_PLAYER_ID, 1000),
  event("e2", settled.id, "buy_in", "wang", 1000),
  event("e3", settled.id, "cash_out", ORGANIZER_PLAYER_ID, 1500),
  event("e4", settled.id, "cash_out", "wang", 500),
];

/** Remembered in memory, as the device would in its storage. */
function memoryMarks(): ImportMarks & { kept: Map<string, string> } {
  const kept = new Map<string, string>();
  return { kept, get: (space) => kept.get(space), set: (space, mark) => kept.set(space, mark) };
}

describe("bringing a guest's books into an account", () => {
  let guestDb: ReturnType<typeof createGuestDatabase>;
  let spaceDb: ReturnType<typeof createGuestDatabase>;
  let guest: Repository;
  let account: Repository;
  let marks: ReturnType<typeof memoryMarks>;
  const destination = () => ({ repository: account, organizerId: SPACE, ownerName: "小林" });

  beforeEach(async () => {
    guestDb = createGuestDatabase(`guest-${crypto.randomUUID()}`);
    spaceDb = createGuestDatabase(`space-${crypto.randomUUID()}`);
    guest = createDexieRepository(guestDb, GUEST);
    account = createDexieRepository(spaceDb, SPACE);
    marks = memoryMarks();

    await guest.players.ensure(player(ORGANIZER_PLAYER_ID, "我"));
    await guest.players.save(player("wang", "老王"));
    await guest.games.save(settled);
    await guest.ledger.appendAll(hostPlayed);
    await guest.games.save(open);
    await guest.ledger.append(event("e5", open.id, "buy_in", "wang", 1000));
    await guest.insuranceRules.save({
      id: "rule",
      organizerId: GUEST,
      name: "常用",
      rule: RULE_30,
      createdAt: 1,
    });
    // The guest's settled game keeps its summary, as the settlement page leaves it
    await currentSummaries(guest);
  });

  afterEach(async () => {
    guestDb.close();
    spaceDb.close();
    await Dexie.delete(guestDb.name);
    await Dexie.delete(spaceDb.name);
  });

  const bring = (letGo = vi.fn()) =>
    bringGuestBooks({ guest, destination: destination(), marks, letGo });

  it("counts what is worth bringing, leaving out the guest's own record", async () => {
    expect(holdingsOf(await guest.backup.exportAll())).toEqual({
      games: 2,
      players: 1,
      settings: 1,
    });
  });

  it("offers nothing for books with only the guest's own record", async () => {
    const emptyDb = createGuestDatabase(`empty-${crypto.randomUUID()}`);
    const empty = createDexieRepository(emptyDb, GUEST);
    await empty.players.ensure(player(ORGANIZER_PLAYER_ID, "我"));
    expect(await guestOffer(empty, SPACE, marks)).toBeNull();
    emptyDb.close();
    await Dexie.delete(emptyDb.name);
  });

  it("copies every record into the space and leaves the guest's books as they were", async () => {
    const before = await guest.backup.exportAll();
    const summariesBefore = await guest.gameSummaries.list();
    const letGo = vi.fn();

    const result = await bring(letGo);

    // 2 games, 2 players, 5 events, 1 rule
    expect(result).toMatchObject({ added: 10, skipped: 0 });
    expect(result.holdings).toEqual({ games: 2, players: 1, settings: 1 });
    expect(await guest.backup.exportAll()).toEqual(before);
    expect(await guest.gameSummaries.list()).toEqual(summariesBefore);
    const brought = await account.backup.exportAll();
    expect(brought.games.map(({ id }) => id).sort()).toEqual(["g-open", "g-settled"]);
    expect(brought.games.find(({ id }) => id === "g-open")?.status).toBe("open");
    expect(brought.ledgerEvents).toHaveLength(5);
    expect(letGo).toHaveBeenCalledOnce();
  });

  it("never makes a second copy when brought in twice", async () => {
    await bring();
    const once = await account.backup.exportAll();
    const summariesOnce = await account.gameSummaries.list();

    const again = await bring();

    expect(again).toMatchObject({ added: 0, skipped: 10 });
    expect(await account.backup.exportAll()).toEqual(once);
    expect(await account.gameSummaries.list()).toEqual(summariesOnce);
  });

  it("keeps the account's own record, name and all, under the one ID", async () => {
    const theirs = player(ORGANIZER_PLAYER_ID, "林老板", SPACE);
    await account.players.ensure(theirs);

    await bring();

    const own = (await account.players.list()).filter(({ id }) => id === ORGANIZER_PLAYER_ID);
    expect(own).toEqual([theirs]);
  });

  it("makes the account's own record under its own name where it has none yet", async () => {
    await bring();

    const own = await account.players.get(ORGANIZER_PLAYER_ID);
    expect(own).toMatchObject({ organizerId: SPACE, name: "小林", initials: "xl" });
  });

  it("shows the host's play as a guest in the account's own record's games", async () => {
    const kept = await guest.gameSummaries.list();

    await bring();

    // The summary came as it was kept, not worked out again
    expect(await account.gameSummaries.list()).toEqual(
      kept.map((summary) => ({ ...summary, organizerId: SPACE })),
    );
    const summaries = await currentSummaries(account);
    const own = summaries.filter((s) => s.players.some((p) => p.playerId === ORGANIZER_PLAYER_ID));
    expect(own.map(({ id }) => id)).toEqual(["g-settled"]);
    expect(own[0]?.players.find((p) => p.playerId === ORGANIZER_PLAYER_ID)?.chipNet).toBe(
      cents(50000),
    );
  });

  it("brings a settled game with no summary, which the reports work out as for a backup", async () => {
    await guest.gameSummaries.remove(settled.id);

    await bring();

    expect(await account.gameSummaries.list()).toEqual([]);
    const [summary] = await currentSummaries(account);
    expect(summary).toMatchObject({ id: settled.id, organizerId: SPACE, playerCount: 2 });
  });

  it("is not offered again for what was brought, and is for what was added since", async () => {
    expect(await guestOffer(guest, SPACE, marks)).toMatchObject({ holdings: { games: 2 } });
    await bring();
    expect(await guestOffer(guest, SPACE, marks)).toBeNull();

    // A change to a record already brought is not new
    await guest.players.save({ ...player("wang", "王哥") });
    expect(await guestOffer(guest, SPACE, marks)).toBeNull();

    // Another account on this device is offered them on its own terms
    expect(await guestOffer(guest, "space-2", marks)).not.toBeNull();

    // Played as a guest again after a sign-out
    await guest.games.save({ ...open, id: "g-later" });
    expect(await guestOffer(guest, SPACE, marks)).toMatchObject({ holdings: { games: 3 } });
  });

  it("writes nothing and marks nothing when the restore fails", async () => {
    await account.players.save(player("mine", "阿强", SPACE));
    const before = await account.backup.exportAll();
    const letGo = vi.fn();
    vi.spyOn(account.backup, "restore").mockRejectedValueOnce(new Error("No connection"));

    await expect(bring(letGo)).rejects.toThrow("No connection");

    expect(await account.backup.exportAll()).toEqual(before);
    expect(await account.gameSummaries.list()).toEqual([]);
    expect(marks.kept.size).toBe(0);
    expect(letGo).not.toHaveBeenCalled();
  });
});

describe("fingerprintOf", () => {
  const books = (players: readonly Player[]): BackupData => ({
    games: [],
    players,
    ledgerEvents: [],
    insuranceRules: [],
    insuranceHands: [],
    gameConfigs: [],
    oddsTables: [],
    chargeRules: [],
  });

  it("goes by which records there are, in any order, not by what they hold", () => {
    const a = player("a", "A");
    const b = player("b", "B");
    expect(fingerprintOf(books([a, b]))).toBe(fingerprintOf(books([b, { ...a, name: "AA" }])));
    expect(fingerprintOf(books([a]))).not.toBe(fingerprintOf(books([a, b])));
  });

  it("leaves out the guest's own record", () => {
    const a = player("a", "A");
    expect(fingerprintOf(books([a, player(ORGANIZER_PLAYER_ID, "我")]))).toBe(
      fingerprintOf(books([a])),
    );
  });
});
