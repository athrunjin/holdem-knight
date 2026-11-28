/**
 * Keeps an account's books on this device and in its space in step (ADR 0054): changes go out in
 * the order they were made, one at a time, and the copy is read again from the account. Only one
 * tab does either at a time, and never both at once.
 */
import {
  type BackupData,
  ForeignOrganizerError,
  type GameSummary,
  type InsuranceHand,
  type RestoreResult,
} from "@holdem-knight/core";
import Dexie, { liveQuery, type Table } from "dexie";

import {
  type AccountDatabase,
  type BookList,
  type Change,
  type OutboxEntry,
  type Refusal,
  recordKey,
} from "./account-database";
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

/** Whether the browser says it has a connection. Outside a browser, it is taken to have one. */
export const isOnline = () => typeof navigator === "undefined" || navigator.onLine;

/** Calls back as the browser says its connection comes or goes. */
export function watchOnline(
  listener: () => void,
  target: EventTarget | undefined = typeof window === "undefined" ? undefined : window,
): () => void {
  if (!target) return () => {};
  target.addEventListener("online", listener);
  target.addEventListener("offline", listener);
  return () => {
    target.removeEventListener("online", listener);
    target.removeEventListener("offline", listener);
  };
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

/** What a change the account turned down was of, in the app's terms rather than its tables. */
export type StoppedKind = "game" | "ledger" | "insuranceHand" | "summary" | "player" | "setting";

/** Where the sender stopped: the change the account turned down. */
export interface StoppedAt {
  readonly kind: StoppedKind;
  /** It was a deletion */
  readonly removed: boolean;
  /** The game it belongs to, where it has one the copy still holds */
  readonly gameId?: string;
  /** The status code of the account's answer, where it had one. Never its message */
  readonly code?: number;
}

/** What the device has still to send. */
export interface SyncStatus {
  /** Changes not yet sent */
  readonly pending: number;
  /** The account turned the first of them down, so none is sent until it takes it */
  readonly refused: boolean;
  /** A send is under way in this tab */
  readonly sending: boolean;
  /** When the copy was last made to match the account, if ever on this device */
  readonly pulledAt?: number;
  /** What the first change is of, once the account has turned it down */
  readonly stoppedAt?: StoppedAt;
}

const KIND_OF_LIST: Record<BookList, StoppedKind> = {
  games: "game",
  players: "player",
  ledgerEvents: "ledger",
  insuranceHands: "insuranceHand",
  gameSummaries: "summary",
  insuranceRules: "setting",
  gameConfigs: "setting",
  oddsTables: "setting",
  chargeRules: "setting",
};

/**
 * What a change is of, and its game: a ledger append's is its events', a deletion's is looked up
 * in the copy, where the record may be gone already.
 */
export async function stoppedAtOf(
  db: AccountDatabase,
  { change, refused }: OutboxEntry,
): Promise<StoppedAt> {
  const code = refused?.status;
  const base = (kind: StoppedKind, removed: boolean, gameId?: string): StoppedAt => ({
    kind,
    removed,
    ...(gameId !== undefined && { gameId }),
    ...(code !== undefined && { code }),
  });
  switch (change.kind) {
    case "ensure":
      return base("player", false);
    case "append":
      return base("ledger", false, change.events[0]?.gameId);
    case "save": {
      const { list, record } = change;
      // A game's summary goes by the game's ID
      if (list === "games" || list === "gameSummaries")
        return base(KIND_OF_LIST[list], false, record.id);
      if (list === "insuranceHands") {
        return base("insuranceHand", false, (record as InsuranceHand).gameId);
      }
      return base(KIND_OF_LIST[list], false);
    }
    case "remove": {
      const { list, id } = change;
      if (list === "gameSummaries") return base("summary", true, id);
      if (list !== "insuranceHands") return base(KIND_OF_LIST[list], true);
      return base("insuranceHand", true, (await db.insuranceHands.get(id))?.gameId);
    }
  }
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
  /**
   * The account these books are for, and who the client is signed in as now. Nothing is sent, and
   * no read of the account is kept, under a session that is not this account's: its rows are
   * hidden from another, which would read as an empty space.
   */
  readonly userId?: string;
  readonly signedInAs?: () => string | undefined;
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
  userId,
  signedInAs = () => userId,
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
  /** Counts the stops, so a pull that a stop came during is let go */
  let stops = 0;
  /** Told as a send in this tab starts and ends */
  const sendingListeners = new Set<() => void>();
  const sendingChanged = () => {
    for (const listener of sendingListeners) listener();
  };

  const ours = () => userId === undefined || signedInAs() === userId;

  /** Clears a refusal from an entry, as its last try failed for want of a network instead. */
  async function unrefuse(seq: number) {
    await db.outbox
      .where("seq")
      .equals(seq)
      .modify((entry: { refused?: Refusal }) => {
        delete entry.refused;
      });
  }

  /** Sends what is waiting, oldest first, until it is all sent or one cannot be. Under the lock. */
  async function flushHeld(): Promise<FlushResult> {
    let renewed = false;
    for (;;) {
      if (!active || !ours()) return "waiting";
      const entry = await db.outbox.orderBy("seq").first();
      if (!entry?.seq) return "sent";
      try {
        await remote.send(entry.change);
      } catch (error) {
        // Sent under a session that is no longer this account's: what it was told is not its own
        if (!ours()) return "waiting";
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
        // It is waiting for a network now, whatever the account said of it before
        if (entry.refused) await unrefuse(entry.seq);
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
   * snapshot and its use here. A snapshot read while the books were let go, or under a session
   * that is not this account's at either end, is let go too: nothing is written or marked.
   */
  async function pullHeld(): Promise<number | "discarded"> {
    const before = stops;
    if (!ours()) return "discarded";
    const { books, summaries } = await remote.pull();
    if (stops !== before || !ours()) return "discarded";
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
        // Checked again where it is written, as a stop can come while the transaction waits
        if (stops !== before) return "discarded" as const;
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
    if (typeof changed === "number" && changed > 0) onPulled();
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
    const started = (async () => {
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
        sendingChanged();
        if (result === "sent") failures = 0;
        if (result === "waiting" && active) wait();
        return result;
      });
    flushing = started;
    sendingChanged();
    return started;
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
     * Sends everything waiting, reads the account, runs a step that has to reach the account, then
     * reads it again, all under the lock. With no connection, anything left unsent, or a read of
     * the account that fails first, the step is not run: what it decides by is what the account
     * holds. A read after it that fails is made at the next one.
     */
    async online<T>(step: () => Promise<T>): Promise<T> {
      if (!online()) throw new OnlineOnlyError("offline");
      return lock.run(lockName, async () => {
        const sent = await flushHeld();
        if (sent !== "sent") {
          const unsent = await count();
          throw new OnlineOnlyError(unsent > 0 ? "unsent" : "offline", unsent);
        }
        const read = await pullHeld().catch(() => "discarded" as const);
        if (read === "discarded") throw new OnlineOnlyError("offline");
        const result = await step();
        // The step is done; a pull that fails now is made at the next one
        await pullHeld().catch(() => undefined);
        return result;
      });
    },

    count,

    /** Calls back as what is waiting changes, in this tab or another, and as a send starts or ends. */
    watch(listener: (status: SyncStatus) => void) {
      type Stored = Omit<SyncStatus, "sending">;
      let stored: Stored | undefined;
      let told: { readonly from: Stored; readonly sending: boolean } | undefined;
      const tell = () => {
        if (!stored) return;
        const sending = flushing !== undefined;
        // A send that starts or ends with nothing else changed is told once
        if (told?.from === stored && told.sending === sending) return;
        told = { from: stored, sending };
        listener({ ...stored, sending });
      };
      const subscription = liveQuery(async (): Promise<Stored> => {
        const first = await db.outbox.orderBy("seq").first();
        const pulled = await db.meta.get("pulled");
        const refused = first?.refused !== undefined;
        return {
          pending: await db.outbox.count(),
          refused,
          ...(pulled !== undefined && { pulledAt: pulled.at }),
          ...(first && refused && { stoppedAt: await stoppedAtOf(db, first) }),
        };
      }).subscribe({
        next: (next) => {
          stored = next;
          tell();
        },
        error: () => undefined,
      });
      sendingListeners.add(tell);
      return () => {
        sendingListeners.delete(tell);
        subscription.unsubscribe();
      };
    },

    start() {
      active = true;
    },

    stop() {
      active = false;
      stops += 1;
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
