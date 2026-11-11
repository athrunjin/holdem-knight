import {
  ForeignOrganizerError,
  type Game,
  type InsuranceHand,
  type LedgerEvent,
  type LegacyGame,
  type OrganizerId,
  type Player,
  type Repository,
  type RestoreResult,
  type SavedChargeRule,
  type SavedGameConfig,
  type SavedInsuranceRule,
  type SavedOddsTable,
  upgradeLegacyGame,
} from "@holdem-knight/core";
import Dexie, { type Table } from "dexie";

export type GuestDatabase = Dexie & {
  games: Table<Game, string>;
  players: Table<Player, string>;
  ledgerEvents: Table<LedgerEvent, string>;
  insuranceRules: Table<SavedInsuranceRule, string>;
  insuranceHands: Table<InsuranceHand, string>;
  gameConfigs: Table<SavedGameConfig, string>;
  oddsTables: Table<SavedOddsTable, string>;
  chargeRules: Table<SavedChargeRule, string>;
};

const STORES = {
  games: "id, [organizerId+createdAt]",
  players: "id, [organizerId+name]",
  ledgerEvents: "id, [gameId+occurredAt]",
};

export function createGuestDatabase(name = "holdem-guest"): GuestDatabase {
  const db = new Dexie(name) as GuestDatabase;
  db.version(1).stores(STORES);
  // Blinds moved from money to chips (ADR 0011)
  db.version(2)
    .stores(STORES)
    .upgrade((tx) =>
      tx
        .table<LegacyGame | Game>("games")
        .toCollection()
        .modify((game, ref) => {
          if ("smallBlind" in game) ref.value = upgradeLegacyGame(game);
        }),
    );
  const insuranceRules = "id, [organizerId+createdAt]";
  db.version(3).stores({ ...STORES, insuranceRules });
  const insuranceHands = "id, [gameId+createdAt]";
  db.version(4).stores({ ...STORES, insuranceRules, insuranceHands });
  const gameConfigs = "id, [organizerId+createdAt]";
  db.version(5).stores({ ...STORES, insuranceRules, insuranceHands, gameConfigs });
  const oddsTables = "id, [organizerId+createdAt]";
  db.version(6).stores({ ...STORES, insuranceRules, insuranceHands, gameConfigs, oddsTables });
  db.version(7).stores({
    ...STORES,
    insuranceRules,
    insuranceHands,
    gameConfigs,
    oddsTables,
    chargeRules: "id, [organizerId+createdAt]",
  });
  return db;
}

/** Guest mode repository: data lives only in local IndexedDB. */
export function createDexieRepository(db: GuestDatabase, organizerId: OrganizerId): Repository {
  function assertOwned(entity: { readonly organizerId: OrganizerId }) {
    if (entity.organizerId !== organizerId) {
      throw new ForeignOrganizerError(
        `Cannot write data belonging to another organizer: ${entity.organizerId}`,
      );
    }
  }

  function onlyOwned<T extends { readonly organizerId: OrganizerId }>(entity: T | undefined) {
    return entity?.organizerId === organizerId ? entity : undefined;
  }

  /** Writes only records missing from the table and returns how many were added. */
  async function addMissing<T extends { readonly id: string }>(
    table: Table<T, string>,
    rows: readonly T[],
  ) {
    const existing = await table.bulkGet(rows.map(({ id }) => id));
    const missing = rows.filter((_, i) => existing[i] === undefined);
    await table.bulkAdd(missing);
    return missing.length;
  }

  const ofOrganizer = [
    [organizerId, Dexie.minKey],
    [organizerId, Dexie.maxKey],
  ] as const;

  return {
    games: {
      list: () =>
        db.games
          .where("[organizerId+createdAt]")
          .between(...ofOrganizer)
          .reverse()
          .toArray(),
      get: (id) => db.games.get(id).then(onlyOwned),
      save: async (game) => {
        assertOwned(game);
        await db.games.put(game);
      },
    },
    players: {
      list: () =>
        db.players
          .where("[organizerId+name]")
          .between(...ofOrganizer)
          .toArray(),
      get: (id) => db.players.get(id).then(onlyOwned),
      save: async (player) => {
        assertOwned(player);
        await db.players.put(player);
      },
    },
    ledger: {
      listByGame: (gameId) =>
        db.ledgerEvents
          .where("[gameId+occurredAt]")
          .between([gameId, Dexie.minKey], [gameId, Dexie.maxKey])
          .filter((event) => event.organizerId === organizerId)
          .toArray(),
      append: async (event) => {
        assertOwned(event);
        await db.ledgerEvents.add(event);
      },
      appendAll: async (events) => {
        events.forEach(assertOwned);
        await db.transaction("rw", db.ledgerEvents, () => db.ledgerEvents.bulkAdd([...events]));
      },
    },
    insuranceRules: {
      list: () =>
        db.insuranceRules
          .where("[organizerId+createdAt]")
          .between(...ofOrganizer)
          .toArray(),
      save: async (rule) => {
        assertOwned(rule);
        await db.insuranceRules.put(rule);
      },
      remove: async (id) => {
        const rule = onlyOwned(await db.insuranceRules.get(id));
        if (rule) await db.insuranceRules.delete(id);
      },
    },
    insuranceHands: {
      listByGame: async (gameId) => {
        const hands = await db.insuranceHands
          .where("[gameId+createdAt]")
          .between([gameId, Dexie.minKey], [gameId, Dexie.maxKey])
          .toArray();
        return hands.filter((hand) => hand.organizerId === organizerId);
      },
      save: async (hand) => {
        assertOwned(hand);
        await db.insuranceHands.put(hand);
      },
      remove: async (id) => {
        const hand = onlyOwned(await db.insuranceHands.get(id));
        if (hand) await db.insuranceHands.delete(id);
      },
    },
    gameConfigs: {
      list: () =>
        db.gameConfigs
          .where("[organizerId+createdAt]")
          .between(...ofOrganizer)
          .toArray(),
      save: async (config) => {
        assertOwned(config);
        await db.gameConfigs.put(config);
      },
      remove: async (id) => {
        const config = onlyOwned(await db.gameConfigs.get(id));
        if (config) await db.gameConfigs.delete(id);
      },
    },
    oddsTables: {
      list: () =>
        db.oddsTables
          .where("[organizerId+createdAt]")
          .between(...ofOrganizer)
          .toArray(),
      save: async (table) => {
        assertOwned(table);
        await db.oddsTables.put(table);
      },
      remove: async (id) => {
        const table = onlyOwned(await db.oddsTables.get(id));
        if (table) await db.oddsTables.delete(id);
      },
    },
    chargeRules: {
      list: () =>
        db.chargeRules
          .where("[organizerId+createdAt]")
          .between(...ofOrganizer)
          .toArray(),
      save: async (rule) => {
        assertOwned(rule);
        await db.chargeRules.put(rule);
      },
      remove: async (id) => {
        const rule = onlyOwned(await db.chargeRules.get(id));
        if (rule) await db.chargeRules.delete(id);
      },
    },
    backup: {
      exportAll: async () => ({
        games: await db.games
          .where("[organizerId+createdAt]")
          .between(...ofOrganizer)
          .toArray(),
        players: await db.players
          .where("[organizerId+name]")
          .between(...ofOrganizer)
          .toArray(),
        ledgerEvents: await db.ledgerEvents.filter((e) => e.organizerId === organizerId).toArray(),
        insuranceRules: await db.insuranceRules
          .where("[organizerId+createdAt]")
          .between(...ofOrganizer)
          .toArray(),
        insuranceHands: await db.insuranceHands
          .filter((hand) => hand.organizerId === organizerId)
          .toArray(),
        gameConfigs: await db.gameConfigs
          .where("[organizerId+createdAt]")
          .between(...ofOrganizer)
          .toArray(),
        oddsTables: await db.oddsTables
          .where("[organizerId+createdAt]")
          .between(...ofOrganizer)
          .toArray(),
        chargeRules: await db.chargeRules
          .where("[organizerId+createdAt]")
          .between(...ofOrganizer)
          .toArray(),
      }),
      restore: async ({
        games,
        players,
        ledgerEvents,
        insuranceRules,
        insuranceHands,
        gameConfigs,
        oddsTables,
        chargeRules,
      }): Promise<RestoreResult> => {
        const rows = [
          ...games,
          ...players,
          ...ledgerEvents,
          ...insuranceRules,
          ...insuranceHands,
          ...gameConfigs,
          ...oddsTables,
          ...chargeRules,
        ];
        rows.forEach(assertOwned);
        const total = rows.length;
        const added = await db.transaction(
          "rw",
          [
            db.games,
            db.players,
            db.ledgerEvents,
            db.insuranceRules,
            db.insuranceHands,
            db.gameConfigs,
            db.oddsTables,
            db.chargeRules,
          ],
          async () =>
            (await addMissing(db.games, games)) +
            (await addMissing(db.players, players)) +
            (await addMissing(db.ledgerEvents, ledgerEvents)) +
            (await addMissing(db.insuranceRules, insuranceRules)) +
            (await addMissing(db.insuranceHands, insuranceHands)) +
            (await addMissing(db.gameConfigs, gameConfigs)) +
            (await addMissing(db.oddsTables, oddsTables)) +
            (await addMissing(db.chargeRules, chargeRules)),
        );
        return { added, skipped: total - added };
      },
    },
  };
}
