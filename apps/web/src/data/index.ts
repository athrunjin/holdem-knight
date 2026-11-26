import type { OrganizerId, Repository } from "@holdem-knight/core";
import { useSyncExternalStore } from "react";

import { type BooksState, createBooks, type Store } from "./books";
import { createDexieRepository, createGuestDatabase } from "./dexie-repository";
import { queryClient } from "./query-client";
import { accountKey, accountQuery, currentSession, onSessionChange } from "./session";
import { supabase } from "./supabase";
import { createSupabaseRepository } from "./supabase-repository";

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
    const { spaceId, spaceName, agreed } = await queryClient.fetchQuery(accountQuery(userId));
    // The account is asked first, and nothing of its books is read before it answers (ADR 0052)
    if (!agreed) return "agreeing";
    return {
      key: `account:${spaceId}`,
      mode: "account",
      organizerId: spaceId,
      organizerName: spaceName,
      repository: createSupabaseRepository(supabase, spaceId),
    };
  },
  // Nothing read from the books just left may show as the next ones'. Who the account is stays.
  onSwitch: () =>
    queryClient.removeQueries({ predicate: ({ queryKey }) => queryKey[0] !== "account" }),
});

onSessionChange(() => void books.follow());
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
  });
}

/** Whether there are books to show, and whose. Pages are only shown once they are open. */
export function useBooks(): BooksState {
  return useSyncExternalStore(books.subscribe, books.state);
}

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
