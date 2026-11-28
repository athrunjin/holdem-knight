/**
 * An account's books on this device (ADR 0054): a copy of its space that pages read and write,
 * and the changes still to send to the account, in the order they were made. Each space has a
 * database of its own, apart from the guest's.
 */
import type {
  Game,
  GameSummary,
  InsuranceHand,
  LedgerEvent,
  OrganizerId,
  Player,
  SavedChargeRule,
  SavedGameConfig,
  SavedInsuranceRule,
  SavedOddsTable,
} from "@holdem-knight/core";
import Dexie, { type Table } from "dexie";

import { BOOK_STORES, type GuestDatabase } from "./dexie-repository";

/** The records of each list that can be saved again under the same ID. */
interface Saved {
  readonly games: Game;
  readonly players: Player;
  readonly insuranceHands: InsuranceHand;
  readonly insuranceRules: SavedInsuranceRule;
  readonly gameConfigs: SavedGameConfig;
  readonly oddsTables: SavedOddsTable;
  readonly chargeRules: SavedChargeRule;
  readonly gameSummaries: GameSummary;
}

export type SavedList = keyof Saved;

/** The lists a record can be deleted from. Games, players and the ledger have no delete. */
export type RemovableList = Exclude<SavedList, "games" | "players">;

/** Every list of the books, the ledger and the summaries included. */
export type BookList = SavedList | "ledgerEvents";

/**
 * A change made on the device, as it is sent: a record saved, the host's own record made only if
 * missing, events added to the ledger, or a record deleted.
 */
export type Change =
  | {
      [L in SavedList]: { readonly kind: "save"; readonly list: L; readonly record: Saved[L] };
    }[SavedList]
  | { readonly kind: "ensure"; readonly record: Player }
  | { readonly kind: "append"; readonly events: readonly LedgerEvent[] }
  | { readonly kind: "remove"; readonly list: RemovableList; readonly id: string };

/** Why the account turned a change down, as it answered. */
export interface Refusal {
  readonly status?: number;
  readonly message: string;
  readonly at: number;
}

/** One change still to send. */
export interface OutboxEntry {
  /** The order changes were made in, which is the order they are sent in */
  readonly seq?: number;
  /** The records it touches, as `list:id`: a pull leaves these as the device has them */
  readonly keys: readonly string[];
  readonly change: Change;
  /** Set once the account has turned it down. It stays, and so does everything after it */
  readonly refused?: Refusal;
}

/** What the device notes of its copy. */
export interface MetaEntry {
  readonly key: "pulled";
  /** When the copy was last made to match the account */
  readonly at: number;
}

export type AccountDatabase = GuestDatabase & {
  outbox: Table<OutboxEntry, number>;
  meta: Table<MetaEntry, string>;
};

export const recordKey = (list: BookList, id: string) => `${list}:${id}`;

/** The records a change touches. */
export function keysOf(change: Change): string[] {
  switch (change.kind) {
    case "save":
    case "ensure":
      return [recordKey(change.kind === "ensure" ? "players" : change.list, change.record.id)];
    case "append":
      return change.events.map(({ id }) => recordKey("ledgerEvents", id));
    case "remove":
      return [recordKey(change.list, change.id)];
  }
}

const PREFIX = "holdem-account-";

/** The name of a space's database on the device. */
export const accountDatabaseName = (space: OrganizerId) => `${PREFIX}${space}`;

export function createAccountDatabase(space: OrganizerId, name = accountDatabaseName(space)) {
  const db = new Dexie(name) as AccountDatabase;
  db.version(1).stores({ ...BOOK_STORES, outbox: "++seq, *keys", meta: "key" });
  return db;
}
