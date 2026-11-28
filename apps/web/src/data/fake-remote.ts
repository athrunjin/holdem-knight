/**
 * An account's space held in memory, for tests of what sends to it and reads it (ADR 0054). It
 * answers as the database does where the tests need it to: records under the space and its IDs,
 * a ledger that is only added to, games that must be there before what belongs to them, and
 * whatever fate a test gives each call.
 */
import {
  type BackupData,
  ForeignOrganizerError,
  type GameSummary,
  type OrganizerId,
  type RestoreResult,
} from "@holdem-knight/core";

import type { BookList, Change } from "./account-database";
import { StorageError } from "./supabase-repository";
import type { Remote, Snapshot } from "./sync";

/**
 * What becomes of one call: `ok`; `unanswered`, which never arrives; `lost`, which arrives and is
 * done but whose answer never comes back; or an HTTP status the account answers with, doing
 * nothing.
 */
export type Fate = "ok" | "unanswered" | "lost" | number;

export type Call =
  | { readonly kind: "send"; readonly change: Change }
  | { readonly kind: "pull" }
  | { readonly kind: "restore" };

interface Identified {
  readonly id: string;
  readonly organizerId: OrganizerId;
}

const LISTS = [
  "games",
  "players",
  "ledgerEvents",
  "insuranceRules",
  "insuranceHands",
  "gameConfigs",
  "oddsTables",
  "chargeRules",
] as const satisfies readonly (keyof BackupData)[];

/** Lists whose records belong to a game, which has to be there first. */
const OF_A_GAME = new Set<BookList>(["ledgerEvents", "insuranceHands", "gameSummaries"]);

export interface FakeServer extends Remote {
  readonly space: OrganizerId;
  /** What the space holds now, lists sorted by ID */
  snapshot(): Snapshot;
  /** Decides each call's fate, in the order calls come */
  fate: (call: Call) => Fate;
  /** Held before each call is done, so a test can let calls through one at a time */
  gate?: (call: Call) => Promise<void>;
  /** The changes that arrived, in order, including those whose answers were lost */
  readonly arrived: Change[];
  /** The most calls that were under way at once */
  readonly mostAtOnce: number;
  /** Puts records in the space as another device would have */
  put(list: BookList, record: Identified): void;
}

export function createFakeServer(space: OrganizerId): FakeServer {
  const tables = new Map<BookList, Map<string, Identified>>(
    [...LISTS, "gameSummaries" as const].map((list) => [list, new Map()]),
  );
  const table = (list: BookList) => tables.get(list) as Map<string, Identified>;
  let atOnce = 0;

  const refuse = (message: string, status: number) => new StorageError(message, status);

  function check(list: BookList, record: Identified) {
    if (record.organizerId !== space) throw refuse("new row violates row-level security", 403);
    if (OF_A_GAME.has(list)) {
      const gameId = list === "gameSummaries" ? record.id : (record as { gameId?: string }).gameId;
      if (!gameId || !table("games").has(gameId)) {
        throw refuse("insert or update violates foreign key constraint", 409);
      }
    }
  }

  function apply(change: Change) {
    switch (change.kind) {
      case "save":
        check(change.list, change.record);
        table(change.list).set(change.record.id, structuredClone(change.record));
        return;
      case "ensure":
        check("players", change.record);
        if (!table("players").has(change.record.id)) {
          table("players").set(change.record.id, structuredClone(change.record));
        }
        return;
      case "append":
        for (const event of change.events) check("ledgerEvents", event);
        for (const event of change.events) {
          if (!table("ledgerEvents").has(event.id)) {
            table("ledgerEvents").set(event.id, structuredClone(event));
          }
        }
        return;
      case "remove":
        table(change.list).delete(change.id);
        return;
    }
  }

  function snapshot(): Snapshot {
    const sorted = (list: BookList) =>
      [...table(list).values()]
        .map((record) => structuredClone(record))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const books = Object.fromEntries(LISTS.map((list) => [list, sorted(list)])) as unknown;
    return {
      books: books as BackupData,
      summaries: sorted("gameSummaries") as unknown as GameSummary[],
    };
  }

  const arrived: Change[] = [];
  const server: FakeServer = {
    space,
    snapshot,
    fate: () => "ok",
    arrived,
    mostAtOnce: 0,
    put(list, record) {
      table(list).set(record.id, structuredClone(record));
    },
    send: (change) =>
      call({ kind: "send", change }, () => {
        apply(change);
        arrived.push(change);
      }),
    pull: () => call({ kind: "pull" }, snapshot),
    restore: (data) =>
      call({ kind: "restore" }, (): RestoreResult => {
        const records = LISTS.flatMap((list) =>
          data[list].map((record) => [list, record] as const),
        );
        if (records.some(([, record]) => record.organizerId !== space)) {
          throw new ForeignOrganizerError("Another organizer's backup");
        }
        const missing = records.filter(([list, record]) => !table(list).has(record.id));
        // All or none: a record whose game is in neither fails the lot
        const games = new Set([...table("games").keys(), ...data.games.map(({ id }) => id)]);
        for (const [list, record] of missing) {
          const gameId = (record as { gameId?: string }).gameId;
          if (OF_A_GAME.has(list) && (!gameId || !games.has(gameId))) {
            throw refuse("insert or update violates foreign key constraint", 409);
          }
        }
        for (const [list, record] of missing) table(list).set(record.id, structuredClone(record));
        return { added: missing.length, skipped: records.length - missing.length };
      }),
  };

  async function call<T>(what: Call, done: () => T): Promise<T> {
    atOnce += 1;
    (server as { mostAtOnce: number }).mostAtOnce = Math.max(server.mostAtOnce, atOnce);
    try {
      await server.gate?.(what);
      const fate = server.fate(what);
      if (fate === "unanswered") throw refuse("FetchError: network", 0);
      if (typeof fate === "number") throw refuse(`Answered ${fate}`, fate);
      const result = done();
      if (fate === "lost") throw refuse("AbortError: timed out", 0);
      return result;
    } finally {
      atOnce -= 1;
    }
  }

  return server;
}
