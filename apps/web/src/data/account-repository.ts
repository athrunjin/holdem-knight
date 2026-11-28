import {
  type BackupData,
  ForeignOrganizerError,
  type GameSummary,
  type OrganizerId,
  type Repository,
  type RestoreResult,
} from "@holdem-knight/core";
import type { Table } from "dexie";
import type { z } from "zod";

import {
  type AccountDatabase,
  type Change,
  keysOf,
  type RemovableList,
  recordKey,
} from "./account-database";
import { gameSummarySchema, recordSchemas } from "./backup";
import { createDexieRepository } from "./dexie-repository";
import { StorageError } from "./supabase-repository";

type Collection = keyof typeof recordSchemas;
type RecordOf<C extends Collection> = BackupData[C][number];

const COLLECTIONS = Object.keys(recordSchemas) as Collection[];

interface Hooks {
  /** Called once a change is kept on the device, to send it */
  changed(): void;
  /** Restores a backup to the account itself, which only works online (ADR 0054) */
  restore(data: BackupData): Promise<RestoreResult>;
}

/**
 * Account mode repository, written to the device first (ADR 0054). Pages read and write the
 * space's copy on this device, as a guest's books are; each write keeps, in the same transaction,
 * the change to send to the account, and a record the account would refuse fails here, as it
 * would there (ADR 0044). A backup is restored to the account itself, as only it can say what it
 * lacks, and the copy is then read again.
 */
export function createAccountRepository(
  db: AccountDatabase,
  organizerId: OrganizerId,
  { changed, restore }: Hooks,
): Repository {
  const local = createDexieRepository(db, organizerId);

  function assertOwned(entity: { readonly organizerId: OrganizerId }) {
    if (entity.organizerId !== organizerId) {
      throw new ForeignOrganizerError(
        `Cannot write data belonging to another organizer: ${entity.organizerId}`,
      );
    }
  }

  /** A record as its list's schema allows it, or an error naming what does not fit. */
  function checked<C extends Collection>(collection: C, record: RecordOf<C>): RecordOf<C> {
    assertOwned(record);
    const parsed = (recordSchemas[collection] as z.ZodType).safeParse(record);
    if (!parsed.success) {
      throw new StorageError(`A record of ${collection} is not valid: ${parsed.error.message}`);
    }
    return parsed.data as RecordOf<C>;
  }

  function checkedSummary(summary: GameSummary): GameSummary {
    assertOwned(summary);
    const parsed = gameSummarySchema.safeParse(summary);
    if (!parsed.success) {
      throw new StorageError(`A game summary is not valid: ${parsed.error.message}`);
    }
    return parsed.data as GameSummary;
  }

  /** Writes to the copy and keeps the change to send, both or neither. */
  async function write(tables: readonly Table[], change: Change, apply: () => Promise<unknown>) {
    await db.transaction("rw", [...tables, db.outbox], async () => {
      await apply();
      await db.outbox.add({ keys: keysOf(change), change });
    });
    changed();
  }

  /**
   * Deletes a record of this space where the copy has it, and sends the delete. One the copy does
   * not have and has nothing waiting for is not in the account either, as far as this device
   * knows, so nothing is sent.
   */
  async function remove(list: RemovableList, id: string) {
    const table = db[list] as unknown as Table<{ readonly organizerId: OrganizerId }, string>;
    let removed = false;
    await db.transaction("rw", [table, db.outbox], async () => {
      const there = await table.get(id);
      const waiting = (await db.outbox.where("keys").equals(recordKey(list, id)).count()) > 0;
      if (there ? there.organizerId !== organizerId : !waiting) return;
      if (there) await table.delete(id);
      const change: Change = { kind: "remove", list, id };
      await db.outbox.add({ keys: keysOf(change), change });
      removed = true;
    });
    if (removed) changed();
  }

  /** A list of things saved under a name. */
  const saved = <C extends "insuranceRules" | "gameConfigs" | "oddsTables" | "chargeRules">(
    collection: C,
  ) => ({
    list: local[collection].list as () => Promise<RecordOf<C>[]>,
    save: async (record: RecordOf<C>) => {
      const kept = checked(collection, record);
      const table = db[collection] as unknown as Table<RecordOf<C>, string>;
      await write([table], { kind: "save", list: collection, record: kept } as Change, () =>
        table.put(kept),
      );
    },
    remove: (id: string) => remove(collection, id),
  });

  return {
    games: {
      list: local.games.list,
      get: local.games.get,
      save: async (game) => {
        const record = checked("games", game);
        await write([db.games], { kind: "save", list: "games", record }, () =>
          db.games.put(record),
        );
      },
    },
    players: {
      list: local.players.list,
      get: local.players.get,
      save: async (player) => {
        const record = checked("players", player);
        await write([db.players], { kind: "save", list: "players", record }, () =>
          db.players.put(record),
        );
      },
      // Sent as itself: the account keeps the record it has, whichever device made it first
      ensure: async (player) => {
        const record = checked("players", player);
        let made = false;
        const kept = await db.transaction("rw", db.players, db.outbox, async () => {
          const there = await db.players.get(record.id);
          if (there) {
            if (there.organizerId !== organizerId) {
              throw new ForeignOrganizerError(`Record ${record.id} is another's`);
            }
            return there;
          }
          const change: Change = { kind: "ensure", record };
          await db.players.add(record);
          await db.outbox.add({ keys: keysOf(change), change });
          made = true;
          return record;
        });
        if (made) changed();
        return kept;
      },
    },
    ledger: {
      listByGame: local.ledger.listByGame,
      append: async (event) => {
        const record = checked("ledgerEvents", event);
        await write([db.ledgerEvents], { kind: "append", events: [record] }, () =>
          db.ledgerEvents.add(record),
        );
      },
      appendAll: async (events) => {
        const records = events.map((event) => checked("ledgerEvents", event));
        await write([db.ledgerEvents], { kind: "append", events: records }, () =>
          db.ledgerEvents.bulkAdd(records),
        );
      },
    },
    insuranceRules: saved("insuranceRules"),
    insuranceHands: {
      listByGame: local.insuranceHands.listByGame,
      save: async (hand) => {
        const record = checked("insuranceHands", hand);
        await write([db.insuranceHands], { kind: "save", list: "insuranceHands", record }, () =>
          db.insuranceHands.put(record),
        );
      },
      remove: (id) => remove("insuranceHands", id),
    },
    gameConfigs: saved("gameConfigs"),
    oddsTables: saved("oddsTables"),
    chargeRules: saved("chargeRules"),
    gameSummaries: {
      list: local.gameSummaries.list,
      save: async (summary) => {
        const record = checkedSummary(summary);
        await write([db.gameSummaries], { kind: "save", list: "gameSummaries", record }, () =>
          db.gameSummaries.put(record),
        );
      },
      remove: (gameId) => remove("gameSummaries", gameId),
    },
    backup: {
      // What is on the device, sent or not
      exportAll: local.backup.exportAll,
      restore: async (data) => {
        // Checked here first, so a backup that is not this space's writes nothing at all
        const books = Object.fromEntries(
          COLLECTIONS.map((collection) => [
            collection,
            data[collection].map((record) => checked(collection, record)),
          ]),
        ) as unknown as BackupData;
        return restore(books);
      },
    },
  };
}
