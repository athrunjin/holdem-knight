import type { OrganizerId, Repository } from "@holdem-knight/core";

/** One set of books the app reads and writes: a guest's on this device, or an account's space. */
export interface Store {
  /** Tells one set of books from another. What was read from one is never shown for another. */
  readonly key: string;
  readonly mode: "guest" | "account";
  /** Whose records these are, which every new record carries. */
  readonly organizerId: OrganizerId;
  /** What the organizer is called in their games: the name of an account's space (ADR 0040). */
  readonly organizerName: string;
  readonly repository: Repository;
}

/** Who is using the app, as far as the books go. */
export type Reader =
  | { readonly status: "loading" }
  | { readonly status: "guest" }
  | { readonly status: "account"; readonly userId: string };

/**
 * Whether there are books to show: not known yet, an account's that cannot be reached, or open.
 * Nothing reads or writes until they are open.
 */
export type BooksState =
  | { readonly status: "opening" }
  | { readonly status: "unreachable" }
  | { readonly status: "open"; readonly key: string; readonly mode: Store["mode"] };

interface Sources {
  /** The books on this device, which are there with or without an account. */
  readonly guest: Store;
  reader(): Reader;
  /** The books of an account's space. Fails when they cannot be reached. */
  openAccount(userId: string): Promise<Store>;
  /** Called as the books change hands, before anything reads the new ones. */
  onSwitch(): void;
}

/**
 * Keeps the one set of books in use in step with who is signed in (ADR 0046): the guest's until an
 * account signs in, that account's space while it is, and the guest's again once it signs out. The
 * guest's books are left as they are throughout.
 */
export function createBooks({ guest, reader, openAccount, onSwitch }: Sources) {
  let current = guest;
  let state: BooksState = { status: "opening" };
  /** The account whose books are open, if they are an account's. */
  let account: string | undefined;
  /** Counts the changes of reader, so books that arrive for an earlier one are let go. */
  let turn = 0;
  const listeners = new Set<() => void>();

  function show(next: BooksState) {
    state = next;
    for (const listener of listeners) listener();
  }

  function open(store: Store, userId?: string) {
    account = userId;
    if (store.key !== current.key) {
      current = store;
      onSwitch();
    }
    show({ status: "open", key: store.key, mode: store.mode });
  }

  /** Looks at who is using the app now and opens their books. Called again to try once more. */
  async function follow() {
    const who = reader();
    turn += 1;
    const mine = turn;
    if (who.status === "loading") return show({ status: "opening" });
    if (who.status === "guest") return open(guest);
    if (state.status === "open" && account === who.userId) return;
    show({ status: "opening" });
    try {
      const store = await openAccount(who.userId);
      if (mine === turn) open(store, who.userId);
    } catch {
      if (mine === turn) show({ status: "unreachable" });
    }
  }

  return {
    follow,
    /** The books in use. Only read once they are open. */
    current: () => current,
    state: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
