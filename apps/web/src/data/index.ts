import type { OrganizerId, Repository } from "@holdem-knight/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import Dexie from "dexie";
import { useEffect, useState, useSyncExternalStore } from "react";

import { accountDatabaseName, createAccountDatabase } from "./account-database";
import { createAccountRepository } from "./account-repository";
import { type AuthIssue, signOut } from "./auth";
import { type BooksState, createBooks, type Store } from "./books";
import { createDexieRepository, createGuestDatabase } from "./dexie-repository";
import { queryClient } from "./query-client";
import {
  accountKey,
  accountQuery,
  currentSession,
  forgetAccount,
  keptAccount,
  onSessionChange,
} from "./session";
import { storedUser, supabase } from "./supabase";
import { createSupabaseRemote } from "./supabase-remote";
import { browserLock, createSync, type Sync, type SyncStatus } from "./sync";

/** Guest mode has no account, so the records on the device sit under this organizer. */
export const GUEST_ORGANIZER_ID = "guest";

const guest: Store = {
  key: "guest",
  mode: "guest",
  organizerId: GUEST_ORGANIZER_ID,
  // A guest has no name, so the ID stands in
  organizerName: GUEST_ORGANIZER_ID,
  repository: createDexieRepository(createGuestDatabase(), GUEST_ORGANIZER_ID),
};

/** Everything the app has read but who the account is. */
const notAccount = ({ queryKey }: { readonly queryKey: readonly unknown[] }) =>
  queryKey[0] !== "account";

const online = () => typeof navigator === "undefined" || navigator.onLine;

const lock = browserLock();

/** Each space's books on this device, made once a page and kept while it is open (ADR 0054). */
const spaces = new Map<OrganizerId, { readonly repository: Repository; readonly sync: Sync }>();

/** A space's books on this device, for the account that owns it. */
function deviceBooksOf(client: SupabaseClient, space: OrganizerId, userId: string) {
  const made = spaces.get(space);
  if (made) return made;
  const db = createAccountDatabase(space);
  const remote = createSupabaseRemote(client, space);
  const sync = createSync({
    db,
    remote,
    lock,
    lockName: `holdem-account-sync.${space}`,
    online,
    reauth: async () => !(await client.auth.refreshSession()).error,
    // Whose session the client sends with: the one it keeps in this browser
    userId,
    signedInAs: () => storedUser()?.id,
    // The pages read again what the pull changed, and keep who the account is
    onPulled: () => void queryClient.invalidateQueries({ predicate: notAccount }),
  });
  const repository = createAccountRepository(db, space, {
    changed: () => void sync.flush(),
    restore: (data) => sync.online(() => remote.restore(data)),
  });
  const books = { repository, sync };
  spaces.set(space, books);
  return books;
}

const books = createBooks({
  guest,
  reader() {
    const session = currentSession();
    if (session.status === "loading") return { status: "loading" };
    return session.status === "signed-in"
      ? { status: "account", userId: session.userId }
      : { status: "guest" };
  },
  async openAccount(userId) {
    if (!supabase) throw new Error("No project to sign in to");
    // With no network, what this device read of the account last time, without waiting on a
    // request that cannot be answered; otherwise the account, or that where it cannot be read
    const kept = online() ? undefined : keptAccount(userId);
    const { spaceId, spaceName, agreed } =
      kept ?? (await queryClient.fetchQuery(accountQuery(userId)));
    // The account is asked first, and nothing of its books is read before it answers (ADR 0052)
    if (!agreed) return "agreeing";
    const { repository, sync } = deviceBooksOf(supabase, spaceId, userId);
    // Opened here for the first time: the books are read whole before they are shown, which
    // needs a network once (ADR 0054)
    if (!(await sync.pulled()) && (await sync.pull()) === "discarded") {
      throw new Error("The account's books were read under another session");
    }
    return {
      key: `account:${spaceId}`,
      mode: "account",
      organizerId: spaceId,
      organizerName: spaceName,
      repository,
      sync,
    };
  },
  // Nothing read from the books just left may show as the next ones'. Who the account is stays.
  onSwitch: () => queryClient.removeQueries({ predicate: notAccount }),
});

/** Sends what is waiting and reads the account's books again, where they are the ones in use. */
function syncBooks() {
  if (books.state().status !== "open") return;
  void books
    .current()
    .sync?.sync()
    .catch(() => undefined);
}

onSessionChange(() => void books.follow());
books.subscribe(syncBooks);
void books.follow();

/** Books that could not be reached are tried again, as they are when the network comes back. */
export const retryBooks = () => void books.follow();

/**
 * Opens an account's books once it has agreed to the terms: the account is read again, as what
 * was read of it said it had not, and its space with the name it confirmed is opened, so its own
 * record is made under that name (ADR 0051).
 */
export async function openAgreedBooks(userId: string) {
  await queryClient.invalidateQueries({ queryKey: accountKey(userId), refetchType: "none" });
  await books.follow();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    if (books.state().status === "unreachable") retryBooks();
    else syncBooks();
  });
  // Back in front, the app sends what it kept and reads what other devices did meanwhile
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncBooks();
  });
}

/**
 * What the account's books in use have still to send, kept up to date, or nothing for a guest's
 * (ADR 0054).
 */
export function useSyncStatus(): SyncStatus | undefined {
  const state = useBooks();
  const sync = state.status === "open" ? books.current().sync : undefined;
  const [status, setStatus] = useState<SyncStatus>();
  useEffect(() => {
    setStatus(undefined);
    return sync?.watch(setStatus);
  }, [sync]);
  return status;
}

/** Tries sending again now, as the network coming back does. */
export const retrySending = syncBooks;

/**
 * How many records of the signed-in account's books on this device are still to send, after one
 * more try where they are open and there is a network: what a sign-out would leave on this
 * device. None for a guest.
 */
export async function unsentBeforeSignOut(): Promise<number> {
  const session = currentSession();
  if (session.status !== "signed-in" || !supabase) return 0;
  const { sync } = books.current();
  if (sync) {
    if (online()) await sync.flush();
    return sync.count();
  }
  // Its books are not open, as on its first-entry step or when they could not be: what this
  // device keeps of them, if anything, is counted without opening them
  const kept = keptAccount(session.userId);
  if (!kept || !(await Dexie.exists(accountDatabaseName(kept.spaceId)))) return 0;
  return deviceBooksOf(supabase, kept.spaceId, session.userId).sync.count();
}

/**
 * Signs this browser out of the account (ADR 0054). Its books on this device go with it once
 * everything is sent; with records still to send they stay, and go out the next time the same
 * account signs in here. What a page has written by then is either sent or kept.
 */
export async function signOutOfAccount(): Promise<AuthIssue | undefined> {
  const session = currentSession();
  const issue = await signOut();
  if (issue || session.status !== "signed-in" || !supabase) return issue;
  const kept = keptAccount(session.userId);
  if (!kept) return undefined;
  const { sync } = deviceBooksOf(supabase, kept.spaceId, session.userId);
  if (await sync.forgetIfSent().catch(() => false)) {
    spaces.delete(kept.spaceId);
    forgetAccount(session.userId);
  }
  return undefined;
}

/** Whether there are books to show, and whose. Pages are only shown once they are open. */
export function useBooks(): BooksState {
  return useSyncExternalStore(books.subscribe, books.state);
}

/**
 * The guest's books on this device, whoever is signed in. Only for bringing them into an account
 * (ADR 0053): pages read and write the books in use, through `repository`.
 */
export const guestRepository: Repository = guest.repository;

/** The books in use, as a whole, for a step that has to finish in the books it started in. */
export const booksInUse = (): Store => books.current();

/** The same, read once, outside a page. */
export const booksState = (): BooksState => books.state();

/** The organizer every new record is written under: the guest, or the space of the account signed in. */
export const currentOrganizerId = (): OrganizerId => books.current().organizerId;

/**
 * The name the host's own record is made with in the books in use (ADR 0051): the account's, as
 * its space is named after it; nothing for a guest, who has no name.
 */
export function currentOwnerName(): string | undefined {
  const { mode, organizerName } = books.current();
  return mode === "account" ? organizerName : undefined;
}

/**
 * What a game's organizer is called on its pages and in what is shared from them: the name of the
 * space whose books are open. Games are only ever read from the books in use; an ID from anywhere
 * else stands for itself.
 */
export function organizerNameOf({ organizerId }: { readonly organizerId: OrganizerId }) {
  const { organizerId: mine, organizerName } = books.current();
  return organizerId === mine ? organizerName : organizerId;
}

/**
 * The books in use: the device's for a guest, the account's space once signed in (ADR 0005, ADR
 * 0046). Each list is looked up as it is used, so what was imported before a sign-in reads and
 * writes the right books after it.
 */
export const repository: Repository = {
  get games() {
    return books.current().repository.games;
  },
  get players() {
    return books.current().repository.players;
  },
  get ledger() {
    return books.current().repository.ledger;
  },
  get insuranceRules() {
    return books.current().repository.insuranceRules;
  },
  get insuranceHands() {
    return books.current().repository.insuranceHands;
  },
  get gameConfigs() {
    return books.current().repository.gameConfigs;
  },
  get oddsTables() {
    return books.current().repository.oddsTables;
  },
  get chargeRules() {
    return books.current().repository.chargeRules;
  },
  get gameSummaries() {
    return books.current().repository.gameSummaries;
  },
  get backup() {
    return books.current().repository.backup;
  },
};
