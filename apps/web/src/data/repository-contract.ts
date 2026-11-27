/**
 * What every repository has to do, whatever it keeps its records in. The device's own storage and
 * an account's are both held to it, so the app reads and writes either the same way (ADR 0005).
 */
import {
  type BackupData,
  backupForOrganizer,
  cents,
  ForeignOrganizerError,
  type Game,
  type GameSummary,
  type InsuranceHand,
  type LedgerEvent,
  type Player,
  type Repository,
  RULE_30,
  type SavedChargeRule,
  type SavedGameConfig,
  type SavedInsuranceRule,
  type SavedOddsTable,
} from "@holdem-knight/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/** A repository of one organizer, with nothing kept yet. */
export interface Books {
  readonly repository: Repository;
  readonly organizerId: string;
}

export interface Storage {
  /** Two organizers who share the same storage */
  readonly me: Books;
  readonly other: Books;
  /** An organizer with nothing kept, for a backup to be restored to */
  readonly elsewhere: Books;
  /** Clears away what the tests made */
  readonly dispose: () => Promise<void>;
}

const game = (id: string, organizerId: string, createdAt: number): Game => ({
  id,
  organizerId,
  currency: "AUD",
  smallBlindChips: 100,
  bigBlindChips: 200,
  chipRatio: { chips: 100, amount: cents(100) },
  status: "open",
  createdAt,
});

const player = (id: string, organizerId: string, name: string): Player => ({
  id,
  organizerId,
  name,
  initials: name.toLowerCase(),
  createdAt: 1,
});

const buyIn = (
  id: string,
  organizerId: string,
  gameId: string,
  occurredAt: number,
): LedgerEvent => ({
  id,
  organizerId,
  gameId,
  occurredAt,
  type: "buy_in",
  playerId: "p1",
  chips: 1000,
});

const hand = (
  id: string,
  organizerId: string,
  gameId: string,
  createdAt: number,
): InsuranceHand => ({
  id,
  organizerId,
  gameId,
  status: "open",
  step: "players",
  players: [],
  pools: [0],
  board: [],
  purchases: [],
  declined: [],
  createdAt,
});

const named = (id: string, organizerId: string, name: string, createdAt: number) => ({
  id,
  organizerId,
  name,
  createdAt,
});

const insuranceRule = (...of: Parameters<typeof named>): SavedInsuranceRule => ({
  ...named(...of),
  rule: RULE_30,
});
const oddsTable = (...of: Parameters<typeof named>): SavedOddsTable => ({
  ...named(...of),
  oddsHundredths: [3000, 1500],
});
const wageRule = (...of: Parameters<typeof named>): SavedChargeRule => ({
  ...named(...of),
  kind: "wage",
  rule: { hourly: cents(2500), unitMinutes: 1, rounding: "nearest" },
});
const gameConfig = (...of: Parameters<typeof named>): SavedGameConfig => ({
  ...named(...of),
  settings: {
    currency: "CNY",
    smallBlindChips: 5,
    bigBlindChips: 10,
    chipRatio: { chips: 1, amount: cents(100) },
    buyInBigBlinds: 100,
  },
});

const summary = (gameId: string, organizerId: string, rake: number): GameSummary => ({
  id: gameId,
  organizerId,
  basis: "[1,5,null,[]]",
  startedAt: 1,
  day: "2026-11-21",
  settledAt: 5,
  currency: "AUD",
  chipRatio: { chips: 100, amount: cents(100) },
  smallBlindChips: 100,
  bigBlindChips: 200,
  playerCount: 1,
  income: { rake: cents(rake), insurance: cents(-300), wage: cents(0), tableFee: cents(0) },
  difference: cents(0),
  absorbed: cents(0),
  players: [
    {
      playerId: "p1",
      boughtChips: 1000,
      cashedOutChips: 400,
      chipNet: cents(-600),
      share: cents(0),
      insurance: cents(0),
      wage: cents(0),
      tableFee: cents(0),
      total: cents(-600),
    },
  ],
  transfers: [{ from: "p1", to: "organizer", amount: cents(600), done: false }],
});

const EMPTY: BackupData = {
  games: [],
  players: [],
  ledgerEvents: [],
  insuranceRules: [],
  insuranceHands: [],
  gameConfigs: [],
  oddsTables: [],
  chargeRules: [],
};

/** Runs the contract against a storage, made anew for each test. */
export function describeRepository(name: string, open: () => Promise<Storage>) {
  describe(`${name}: what every repository does`, () => {
    let storage: Storage;
    let repository: Repository;
    let me: string;
    let other: Repository;
    let them: string;

    beforeEach(async () => {
      storage = await open();
      ({ repository, organizerId: me } = storage.me);
      ({ repository: other, organizerId: them } = storage.other);
    });

    afterEach(async () => {
      await storage.dispose();
    });

    it("lists games newest first and updates on saving the same ID", async () => {
      await repository.games.save(game("old", me, 1));
      await repository.games.save(game("new", me, 2));
      await repository.games.save({ ...game("old", me, 1), status: "settled" });

      const games = await repository.games.list();
      expect(games.map((g) => g.id)).toEqual(["new", "old"]);
      expect(await repository.games.get("old")).toEqual({
        ...game("old", me, 1),
        status: "settled",
      });
      expect(await repository.games.get("none")).toBeUndefined();
    });

    it("sorts players by name and updates on saving the same ID", async () => {
      await repository.players.save(player("b", me, "Bob"));
      await repository.players.save(player("a", me, "Alice"));
      await repository.players.save(player("c", me, "张三"));
      await repository.players.save(player("b", me, "Bobby"));

      expect((await repository.players.list()).map((p) => p.name)).toEqual([
        "Alice",
        "Bobby",
        "张三",
      ]);
      expect(await repository.players.get("a")).toEqual(player("a", me, "Alice"));
    });

    it("keeps the record first ensured under an ID, once, and returns it", async () => {
      const own = player("organizer", me, "我");
      expect(await repository.players.ensure(own)).toEqual(own);
      // Again, under another name: the record kept stays as it is
      expect(await repository.players.ensure({ ...own, name: "Me" })).toEqual(own);
      // A rename is kept too, and ensuring again does not undo it
      await repository.players.save({ ...own, name: "老板" });
      expect(await repository.players.ensure(own)).toEqual({ ...own, name: "老板" });
      expect((await repository.players.list()).filter((p) => p.id === "organizer")).toHaveLength(1);
    });

    it("keeps one record when it is ensured twice at once", async () => {
      const own = player("organizer", me, "我");
      const [first, second] = await Promise.all([
        repository.players.ensure(own),
        repository.players.ensure({ ...own, name: "Me" }),
      ]);
      expect(first).toEqual(second);
      expect(await repository.players.list()).toEqual([first]);
    });

    it("refuses to ensure another organizer's record", async () => {
      await expect(repository.players.ensure(player("organizer", them, "Eve"))).rejects.toThrow(
        ForeignOrganizerError,
      );
    });

    it("sorts ledger events by time, then by ID, and returns only this game's", async () => {
      await repository.games.save(game("g1", me, 1));
      await repository.games.save(game("g2", me, 2));
      await repository.ledger.append(buyIn("later", me, "g1", 2));
      await repository.ledger.append(buyIn("z-same-time", me, "g1", 1));
      await repository.ledger.append(buyIn("a-same-time", me, "g1", 1));
      await repository.ledger.append(buyIn("elsewhere", me, "g2", 1));

      const events = await repository.ledger.listByGame("g1");
      expect(events.map((e) => e.id)).toEqual(["a-same-time", "z-same-time", "later"]);
      expect(events[2]).toEqual(buyIn("later", me, "g1", 2));
    });

    it("does not let the same ID overwrite a ledger event", async () => {
      await repository.games.save(game("g1", me, 1));
      await repository.ledger.append(buyIn("e1", me, "g1", 1));

      await expect(repository.ledger.append(buyIn("e1", me, "g1", 2))).rejects.toThrow();
      const events = await repository.ledger.listByGame("g1");
      expect(events.map((e) => e.occurredAt)).toEqual([1]);
    });

    it("writes nothing if one event in a batch fails", async () => {
      await repository.games.save(game("g1", me, 1));
      await repository.ledger.append(buyIn("e1", me, "g1", 1));

      await expect(
        repository.ledger.appendAll([buyIn("e2", me, "g1", 2), buyIn("e1", me, "g1", 3)]),
      ).rejects.toThrow();
      const events = await repository.ledger.listByGame("g1");
      expect(events.map((e) => e.id)).toEqual(["e1"]);
    });

    it("lists every event of a long game", async () => {
      await repository.games.save(game("g1", me, 1));
      const many = Array.from({ length: 1100 }, (_, i) =>
        buyIn(`e${String(i).padStart(4, "0")}`, me, "g1", i),
      );
      await repository.ledger.appendAll(many);

      const events = await repository.ledger.listByGame("g1");
      expect(events).toHaveLength(1100);
      expect(events.at(-1)?.id).toBe("e1099");
    });

    it("keeps each list of saved things oldest first, saved by ID, and deleted", async () => {
      const lists = [
        [repository.insuranceRules, insuranceRule],
        [repository.oddsTables, oddsTable],
        [repository.chargeRules, wageRule],
        [repository.gameConfigs, gameConfig],
      ] as const;
      for (const [list, make] of lists) {
        const save = list.save as (record: unknown) => Promise<void>;
        await save(make("newer", me, "新的", 2));
        await save(make("older", me, "旧的", 1));
        await save(make("newer", me, "改名", 2));

        const kept = (await list.list()) as readonly { id: string; name: string }[];
        expect(kept.map(({ id, name }) => [id, name])).toEqual([
          ["older", "旧的"],
          ["newer", "改名"],
        ]);
        await list.remove("older");
        expect((await list.list()).map(({ id }) => id)).toEqual(["newer"]);
      }
    });

    it("keeps the same ID apart in two lists of saved things", async () => {
      await repository.insuranceRules.save(insuranceRule("same", me, "保险", 1));
      await repository.oddsTables.save(oddsTable("same", me, "赔率", 1));
      await repository.insuranceRules.remove("same");

      expect(await repository.insuranceRules.list()).toEqual([]);
      expect(await repository.oddsTables.list()).toEqual([oddsTable("same", me, "赔率", 1)]);
    });

    it("lists a game's insurance hands oldest first, saves by ID and deletes", async () => {
      await repository.games.save(game("g1", me, 1));
      await repository.games.save(game("g2", me, 2));
      await repository.insuranceHands.save(hand("second", me, "g1", 2));
      await repository.insuranceHands.save(hand("first", me, "g1", 1));
      await repository.insuranceHands.save(hand("elsewhere", me, "g2", 1));
      await repository.insuranceHands.save({ ...hand("first", me, "g1", 1), status: "done" });

      const hands = await repository.insuranceHands.listByGame("g1");
      expect(hands.map(({ id, status }) => [id, status])).toEqual([
        ["first", "done"],
        ["second", "open"],
      ]);
      await repository.insuranceHands.remove("first");
      expect((await repository.insuranceHands.listByGame("g1")).map(({ id }) => id)).toEqual([
        "second",
      ]);
    });

    it("keeps one summary for a game, replaced on saving and deleted", async () => {
      await repository.games.save(game("g1", me, 1));
      await repository.games.save(game("g2", me, 2));
      await repository.gameSummaries.save(summary("g1", me, 100));
      await repository.gameSummaries.save(summary("g2", me, 200));
      await repository.gameSummaries.save(summary("g1", me, 150));

      const kept = await repository.gameSummaries.list();
      expect(kept.toSorted((a, b) => a.id.localeCompare(b.id))).toEqual([
        summary("g1", me, 150),
        summary("g2", me, 200),
      ]);
      await repository.gameSummaries.remove("g1");
      await repository.gameSummaries.remove("none");
      expect((await repository.gameSummaries.list()).map(({ id }) => id)).toEqual(["g2"]);
    });

    it("keeps summaries out of a backup", async () => {
      await repository.games.save(game("g1", me, 1));
      await repository.gameSummaries.save(summary("g1", me, 100));

      expect(await repository.backup.exportAll()).toEqual({ ...EMPTY, games: [game("g1", me, 1)] });
    });

    it("hides other organizers' data from reads, and leaves it alone", async () => {
      await other.games.save(game("g", them, 1));
      await other.players.save(player("p", them, "Eve"));
      await other.ledger.append(buyIn("e", them, "g", 1));
      await other.oddsTables.save(oddsTable("t", them, "赔率", 1));
      await other.gameSummaries.save(summary("g", them, 100));

      expect(await repository.gameSummaries.list()).toEqual([]);
      await repository.gameSummaries.remove("g");
      expect(await other.gameSummaries.list()).toHaveLength(1);
      expect(await repository.games.list()).toEqual([]);
      expect(await repository.games.get("g")).toBeUndefined();
      expect(await repository.players.list()).toEqual([]);
      expect(await repository.players.get("p")).toBeUndefined();
      expect(await repository.ledger.listByGame("g")).toEqual([]);
      expect(await repository.oddsTables.list()).toEqual([]);

      // Deleting by an ID of theirs deletes nothing
      await repository.oddsTables.remove("t");
      await repository.insuranceHands.remove("h");
      expect(await other.oddsTables.list()).toHaveLength(1);
    });

    it("refuses to write other organizers' data", async () => {
      await expect(repository.games.save(game("g", them, 1))).rejects.toThrow(
        ForeignOrganizerError,
      );
      await expect(repository.players.save(player("p", them, "Eve"))).rejects.toThrow(
        ForeignOrganizerError,
      );
      await expect(repository.ledger.append(buyIn("e", them, "g", 1))).rejects.toThrow(
        ForeignOrganizerError,
      );
      await expect(repository.oddsTables.save(oddsTable("t", them, "赔率", 1))).rejects.toThrow(
        ForeignOrganizerError,
      );
      await expect(repository.gameSummaries.save(summary("g", them, 100))).rejects.toThrow(
        ForeignOrganizerError,
      );
    });

    it("restores an export to an organizer with nothing kept, with identical data", async () => {
      await repository.games.save(game("g", me, 1));
      await repository.players.save(player("p", me, "Alice"));
      await repository.ledger.append(buyIn("e", me, "g", 1));
      await repository.insuranceHands.save(hand("h", me, "g", 1));
      await repository.insuranceRules.save(insuranceRule("i", me, "保险", 1));
      await repository.oddsTables.save(oddsTable("t", me, "赔率", 1));
      await repository.chargeRules.save(wageRule("w", me, "工资", 1));
      await repository.gameConfigs.save(gameConfig("c", me, "周五局", 1));
      await other.games.save(game("foreign", them, 1));
      const backup = await repository.backup.exportAll();
      expect(backup.games.map((g) => g.id)).toEqual(["g"]);

      const { repository: target, organizerId } = storage.elsewhere;
      const theirs = backupForOrganizer(backup, organizerId);
      expect(await target.backup.restore(theirs)).toEqual({ added: 8, skipped: 0 });
      expect(await target.backup.exportAll()).toEqual(theirs);
      // A second time adds nothing, and leaves the books as the first left them
      expect(await target.backup.restore(theirs)).toEqual({ added: 0, skipped: 8 });
      expect(await target.backup.exportAll()).toEqual(theirs);
    });

    it("keeps one own record through a backup restored, and through guest data brought in", async () => {
      const own = player("organizer", me, "我");
      await repository.players.ensure(own);
      await repository.players.save(player("p", me, "Alice"));
      const backup = await repository.backup.exportAll();

      // Restored to the same books: nothing added, the record as it was
      expect(await repository.backup.restore(backup)).toEqual({ added: 0, skipped: 2 });

      // Brought into books that already have their own record: theirs stays, under the one ID
      const { repository: target, organizerId } = storage.elsewhere;
      const theirs = player("organizer", organizerId, "Host");
      await target.players.ensure(theirs);
      expect(await target.backup.restore(backupForOrganizer(backup, organizerId))).toEqual({
        added: 1,
        skipped: 1,
      });
      const kept = (await target.players.list()).filter((p) => p.id === "organizer");
      expect(kept).toEqual([theirs]);

      // An older backup with no own record leaves the one there
      await target.backup.restore({ ...EMPTY, players: [player("q", organizerId, "Bob")] });
      expect((await target.players.list()).filter((p) => p.id === "organizer")).toHaveLength(1);
    });

    it("skips existing records on restore without overwriting what is kept", async () => {
      await repository.games.save({ ...game("g", me, 1), status: "settled" });
      await repository.ledger.append(buyIn("e", me, "g", 1));

      const result = await repository.backup.restore({
        ...EMPTY,
        games: [game("g", me, 1), game("new", me, 2)],
        ledgerEvents: [buyIn("e", me, "g", 99)],
      });

      expect(result).toEqual({ added: 1, skipped: 2 });
      expect((await repository.games.get("g"))?.status).toBe("settled");
      expect((await repository.ledger.listByGame("g")).map((e) => e.occurredAt)).toEqual([1]);
    });

    it("fails to restore another organizer's backup and writes nothing", async () => {
      const restore = repository.backup.restore({
        ...EMPTY,
        games: [game("mine", me, 1), game("theirs", them, 1)],
      });

      await expect(restore).rejects.toThrow(ForeignOrganizerError);
      expect(await repository.games.list()).toEqual([]);
    });
  });
}
