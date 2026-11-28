/**
 * Keeps an account's books on this device and in its space in step (ADR 0054): changes go out in
 * the order they were made, one at a time, and the copy is read again from the account. Only one
 * tab does either at a time, and never both at once.
 */
import {
  type BackupData,
  ForeignOrganizerError,
  type GameSummary,
  type RestoreResult,
} from "@holdem-knight/core";
import Dexie, { liveQuery, type Table } from "dexie";

import { type AccountDatabase, type BookList, type Change, recordKey } from "./account-database";
import { StorageError } from "./supabase-repository";

/** All of a space, as the account holds it. */
export interface Snapshot {
  readonly books: BackupData;
  readonly summaries: readonly GameSummary[];
}

/** The account's side, as the device talks to it. Each call fails with the account's answer. */
export interface Remote {
  /** Sends one change. Sending the same change again leaves the account as the first did. */
  send(change: Change): Promise<void>;
  pull(): Promise<Snapshot>;
  /** Adds the records the space lacks, all or none (`restore_books`). */
  restore(data: BackupData): Promise<RestoreResult>;
}

/**
 * What to do about a change that failed. `retry`: no answer came, or one that says nothing of the
 * change (busy, timed out, a server's error), so it is sent again later. `reauth`: the session
 * was not accepted, so it is renewed and the change sent again. `refused`: the account answered
 * and turned the change down, so the queue stops at it.
 */
export type FailureClass = "retry" | "reauth" | "refused";

export function classify(error: unknown): FailureClass {
  if (error instanceof ForeignOrganizerError) return "refused";
  // Anything not from the account, such as a request that threw, never reached it
  if (!(error instanceof StorageError)) return "retry";
  const { status } = error;
  // Turned down here, before it was sent
  if (status === undefined) return "refused";
  if (status === 401) return "reauth";
  if (status === 0 || status === 408 || status === 429 || status >= 500) return "retry";
  return status >= 400 ? "refused" : "retry";
}

/** Runs one task at a time under a name, across tabs where the browser can. */
export interface Lock {
  run<T>(name: string, task: () => Promise<T>): Promise<T>;
}

/** A lock within this page only, where the browser has no Web Locks, and for tests. */
export function memoryLock(): Lock {
  const tails = new Map<string, Promise<unknown>>();
  return {
    run(name, task) {
      const before = tails.get(name) ?? Promise.resolve();
      const mine = before.then(task, task);
      tails.set(
        name,
        mine.catch(() => undefined),
      );
      return mine;
    },
  };
}

/** The browser's Web Locks, held by one tab at a time. */
export function browserLock(): Lock {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!locks) return memoryLock();
  return { run: (name, task) => locks.request(name, task) };
}

/** Thrown by a step that has to reach the account first, which writes nothing (ADR 0054). */
export class OnlineOnlyError extends Error {
  override readonly name = "OnlineOnlyError";

  constructor(
    /** `offline`: no connection; `unsent`: changes on the device could not all be sent first */
    readonly reason: "offline" | "unsent",
    readonly unsent = 0,
  ) {
    super(reason === "offline" ? "A connection is needed" : `${unsent} changes are not sent yet`);
  }
}

/** What the device has still to send. */
export interface SyncStatus {
  /** Changes not yet sent */
  readonly pending: number;
  /** The account turned the first of them down, so none is sent until it takes it */
  readonly refused: boolean;
}

export type FlushResult = "sent" | "waiting" | "refused";

interface Options {
  readonly db: AccountDatabase;
  readonly remote: Remote;
  readonly lock: Lock;
  /** Shared by every tab with this space's books */
  readonly lockName: string;
  /** Whether the browser says it has a connection */
  readonly online?: () => boolean;
  /** Renews the session; true if there is one to send with */
  readonly reauth?: () => Promise<boolean>;
  /** Called once a pull has changed the copy, so pages read it again */
  readonly onPulled?: () => void;
  /** Waits before trying again, and returns how to call it off */
  readonly later?: (run: () => void, ms: number) => () => void;
  readonly now?: () => number;
}

const LISTS: readonly (keyof BackupData)[] = [
  "games",
  "players",
  "ledgerEvents",
  "insuranceRules",
  "insuranceHands",
  "gameConfigs",
  "oddsTables",
  "chargeRules",
];

/** Two records with the same content, whatever order their fields come in. */
export function sameRecord(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = Object.entries(a).filter(([, value]) => value !== undefined);
  const right = new Map(Object.entries(b).filter(([, value]) => value !== undefined));
  if (left.length !== right.size) return false;
  return left.every(([key, value]) => right.has(key) && sameRecord(value, right.get(key)));
}

interface Identified {
  readonly id: string;
}
type AnyTable = Table<Identified, string>;

const FIRST_WAIT = 2_000;
const LONGEST_WAIT = 60_000;

/**
 * The sender and the pull of one space's books on this device. Nothing is sent or pulled until it
 * is started, and nothing after it is stopped.
 */
export function createSync({
  db,
  remote,
  lock,
  lockName,
  online = () => true,
  reauth = async () => false,
  onPulled = () => {},
  later = (run, ms) => {
    const timer = setTimeout(run, ms);
    return () => clearTimeout(timer);
  },
  now = Date.now,
}: Options) {
  let active = false;
  let flushing: Promise<FlushResult> | undefined;
  let again = false;
  let failures = 0;
  let cancelWait: (() => void) | undefined;

  /** Sends what is waiting, oldest first, until it is all sent or one cannot be. Under the lock. */
  async function flushHeld(): Promise<FlushResult> {
    let renewed = false;
    for (;;) {
      if (!active) return "waiting";
      const entry = await db.outbox.orderBy("seq").first();
      if (!entry?.seq) return "sent";
      try {
        await remote.send(entry.change);
      } catch (error) {
        const kind = classify(error);
        if (kind === "reauth" && !renewed) {
          renewed = true;
          if (await reauth().catch(() => false)) continue;
        }
        if (kind === "refused") {
          const message = error instanceof Error ? error.message : String(error);
          const status = error instanceof StorageError ? error.status : undefined;
          await db.outbox.update(entry.seq, {
            refused: { message, at: now(), ...(status !== undefined && { status }) },
          });
          return "refused";
        }
        return "waiting";
      }
      await db.outbox.delete(entry.seq);
    }
  }

  /** The records that have a change still to send, as `list:id`. */
  async function pendingKeys(): Promise<Set<string>> {
    return new Set(await db.outbox.orderBy("keys").uniqueKeys()) as Set<string>;
  }

  /**
   * Makes the copy what the account holds, but for records with a change still to send. Whether
   * a record has one is read in the same transaction that writes it, so a change made meanwhile
   * on a page is never undone. Under the lock, so the sender never deletes a change between the
   * snapshot and its use here.
   */
  async function pullHeld(): Promise<number> {
    const { books, summaries } = await remote.pull();
    const tables: [BookList, AnyTable, readonly Identified[]][] = [
      ...LISTS.map((list): [BookList, AnyTable, readonly Identified[]] => [
        list,
        db[list] as unknown as AnyTable,
        books[list],
      ]),
      ["gameSummaries", db.gameSummaries as unknown as AnyTable, summaries],
    ];
    const changed = await db.transaction(
      "rw",
      [db.outbox, db.meta, ...tables.map(([, table]) => table)],
      async () => {
        const pending = await pendingKeys();
        let count = 0;
        for (const [list, table, theirs] of tables) {
          const there = new Map(theirs.map((record) => [record.id, record]));
          const mine = await table.toArray();
          const kept = new Map(mine.map((record) => [record.id, record]));
          const gone = mine
            .filter(({ id }) => !there.has(id) && !pending.has(recordKey(list, id)))
            .map(({ id }) => id);
          const fresh = theirs.filter(
            (record) =>
              !pending.has(recordKey(list, record.id)) && !sameRecord(kept.get(record.id), record),
          );
          await table.bulkDelete(gone);
          await table.bulkPut([...fresh]);
          count += gone.length + fresh.length;
        }
        await db.meta.put({ key: "pulled", at: now() });
        return count;
      },
    );
    if (changed > 0) onPulled();
    return changed;
  }

  function wait() {
    cancelWait?.();
    const ms = Math.min(LONGEST_WAIT, FIRST_WAIT * 2 ** failures);
    failures += 1;
    cancelWait = later(() => {
      cancelWait = undefined;
      void flush();
    }, ms);
  }

  /** Sends what is waiting. Calls while it runs are folded into it. */
  function flush(): Promise<FlushResult> {
    if (flushing) {
      again = true;
      return flushing;
    }
    flushing = (async () => {
      let result: FlushResult;
      do {
        again = false;
        result = await lock.run(lockName, flushHeld);
      } while (again);
      return result;
    })()
      .catch((): FlushResult => "waiting")
      .then((result) => {
        flushing = undefined;
        if (result === "sent") failures = 0;
        if (result === "waiting" && active) wait();
        return result;
      });
    return flushing;
  }

  async function count(): Promise<number> {
    return db.outbox.count();
  }

  return {
    flush,

    /** Sends what is waiting, then reads the account again. Fails only if the pull does. */
    async sync() {
      const sent = await flush();
      if (sent === "waiting" || !active || !online()) return;
      await lock.run(lockName, pullHeld);
    },

    /** Reads the account again, as a pull does, whatever is waiting. */
    pull: () => lock.run(lockName, pullHeld),

    /** Whether the copy has ever been made to match the account, as it is on first opening. */
    async pulled() {
      return (await db.meta.get("pulled")) !== undefined;
    },

    /**
     * Sends everything waiting, then runs a step that has to reach the account, then reads the
     * account again, all under the lock. With no connection, or anything left unsent, the step is
     * not run.
     */
    async online<T>(step: () => Promise<T>): Promise<T> {
      if (!online()) throw new OnlineOnlyError("offline");
      return lock.run(lockName, async () => {
        const sent = await flushHeld();
        if (sent !== "sent") {
          const unsent = await count();
          throw new OnlineOnlyError(unsent > 0 ? "unsent" : "offline", unsent);
        }
        const result = await step();
        // The step is done; a pull that fails now is made at the next one
        await pullHeld().catch(() => undefined);
        return result;
      });
    },

    count,

    /** Calls back as what is waiting changes, in this tab or another. */
    watch(listener: (status: SyncStatus) => void) {
      const subscription = liveQuery(async () => {
        const first = await db.outbox.orderBy("seq").first();
        return { pending: await db.outbox.count(), refused: first?.refused !== undefined };
      }).subscribe({ next: listener, error: () => undefined });
      return () => subscription.unsubscribe();
    },

    start() {
      active = true;
    },

    stop() {
      active = false;
      cancelWait?.();
      cancelWait = undefined;
      failures = 0;
    },

    get active() {
      return active;
    },

    /** Lets go of the database, and deletes it when nothing is waiting. True if it was deleted. */
    async forgetIfSent(): Promise<boolean> {
      this.stop();
      return lock.run(lockName, async () => {
        if ((await count()) > 0) return false;
        db.close();
        await Dexie.delete(db.name);
        return true;
      });
    },
  };
}

export type Sync = ReturnType<typeof createSync>;
