/**
 * Bringing a guest's records on this device into the account signed in (ADR 0053): a copy, never
 * a move. The guest's books are read, re-addressed to the account's space by `backupForOrganizer`
 * and restored there in one call, which adds only what the space lacks. The guest's books are not
 * written to at all; what was brought is remembered on the device, per space, by a fingerprint.
 */
import {
  type BackupData,
  backupForOrganizer,
  type GameSummary,
  ORGANIZER_PLAYER_ID,
  type OrganizerId,
  type Player,
  type Repository,
  type RestoreResult,
} from "@holdem-knight/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toInitials } from "@/lib/pinyin";
import { booksInUse, guestRepository, useBooks } from ".";

/** What a guest's books hold that is worth bringing, as the card counts it. */
export interface GuestHoldings {
  readonly games: number;
  /** Players other than the guest's own record, which joins the account's (ADR 0051) */
  readonly players: number;
  /** Everything saved under a name: insurance rules, odds tables, charge and game settings */
  readonly settings: number;
}

export function holdingsOf(data: BackupData): GuestHoldings {
  return {
    games: data.games.length,
    players: data.players.filter(({ id }) => id !== ORGANIZER_PLAYER_ID).length,
    settings:
      data.insuranceRules.length +
      data.oddsTables.length +
      data.chargeRules.length +
      data.gameConfigs.length,
  };
}

const worthBringing = ({ games, players, settings }: GuestHoldings) =>
  games + players + settings > 0;

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

/** A 53-bit hash of a text (cyrb53), enough to tell one set of IDs from another. */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Which records a guest's books hold, by list and ID: what a restore of them could add. A record
 * changed since keeps its ID, and a restore would leave the account's copy as it is, so a change
 * to one does not count; a record added does. The guest's own record is left out, as it never
 * comes over as one of its own: the account keeps its own under that ID.
 */
export function fingerprintOf(data: BackupData): string {
  const keys = LISTS.flatMap((list) =>
    data[list]
      .filter((record) => list !== "players" || record.id !== ORGANIZER_PLAYER_ID)
      .map((record) => `${list}:${record.id}`),
  ).sort();
  return `${keys.length}.${hash(keys.join("\n"))}`;
}

/** What this device remembers of each space it brought a guest's books into. */
export interface ImportMarks {
  get(space: OrganizerId): string | undefined;
  set(space: OrganizerId, fingerprint: string): void;
}

const markKey = (space: OrganizerId) => `guest-import.${space}`;

/** Kept in this browser, beside the guest's books, never in them. */
export const deviceMarks: ImportMarks = {
  get(space) {
    try {
      return localStorage.getItem(markKey(space)) ?? undefined;
    } catch {
      // Without storage the card is offered again, and bringing the records in again adds nothing
      return undefined;
    }
  },
  set(space, fingerprint) {
    try {
      localStorage.setItem(markKey(space), fingerprint);
    } catch {
      // As above
    }
  },
};

/** A guest's books as the card offers them: what they hold, and what marks them once brought. */
export interface GuestOffer {
  readonly holdings: GuestHoldings;
  readonly fingerprint: string;
}

/**
 * What the guest's books on this device would bring into a space, or nothing: when they hold
 * nothing worth bringing, or exactly what was brought into that space before.
 */
export async function guestOffer(
  guest: Pick<Repository, "backup">,
  space: OrganizerId,
  marks: ImportMarks,
): Promise<GuestOffer | null> {
  const data = await guest.backup.exportAll();
  const holdings = holdingsOf(data);
  const fingerprint = fingerprintOf(data);
  if (!worthBringing(holdings) || marks.get(space) === fingerprint) return null;
  return { holdings, fingerprint };
}

/** The books an import goes into: an account's space, with the name its own record is made with. */
export interface Destination {
  readonly repository: Pick<Repository, "backup" | "gameSummaries">;
  readonly organizerId: OrganizerId;
  readonly ownerName: string;
}

/**
 * A guest's books as the space's own (`backupForOrganizer`), with the guest's own record standing
 * for the account's: named after the account, as the app makes it. A space that has its own
 * record keeps it, as a restore leaves what is there; one that has none yet gets it under the
 * account's name, in the same all-or-none call, never the guest's 我 (ADR 0051).
 */
export function booksFor(data: BackupData, { organizerId, ownerName }: Destination): BackupData {
  const own = backupForOrganizer(data, organizerId);
  return {
    ...own,
    players: own.players.map((player): Player => {
      if (player.id !== ORGANIZER_PLAYER_ID) return player;
      // Its number in the guest's books means nothing in the space, which numbers it itself
      const { number: _, ...rest } = player;
      return { ...rest, name: ownerName, initials: toInitials(ownerName) };
    }),
  };
}

/**
 * Copies the summaries the guest's settled games keep, re-addressed, where the space has none for
 * that game, so the games arrive with their results as worked out (ADR 0049). A game the space
 * had already keeps its own. One missing, or one that cannot be written, is made again from the
 * ledger the next time a report is read, as for any game brought in from a backup.
 */
async function copySummaries(
  guest: Pick<Repository, "gameSummaries">,
  { repository, organizerId }: Destination,
  games: ReadonlySet<string>,
) {
  const [theirs, kept] = await Promise.all([
    guest.gameSummaries.list(),
    repository.gameSummaries.list(),
  ]);
  const there = new Set(kept.map(({ id }) => id));
  const missing = theirs.filter(({ id }) => games.has(id) && !there.has(id));
  await Promise.all(
    missing.map((summary: GameSummary) =>
      repository.gameSummaries.save({ ...summary, organizerId }).catch(() => undefined),
    ),
  );
}

export interface ImportResult extends RestoreResult {
  readonly holdings: GuestHoldings;
}

/**
 * Brings the guest's books on this device into a space: all of them in one restore, which adds
 * only what the space lacks and writes nothing if it fails. Once it has, the summaries follow,
 * the space is marked as holding these books, and what the app has read is let go so the pages
 * show them. The guest's books are only read.
 */
export async function bringGuestBooks({
  guest,
  destination,
  marks,
  letGo,
}: {
  guest: Pick<Repository, "backup" | "gameSummaries">;
  destination: Destination;
  marks: ImportMarks;
  /** Lets go of what was read, so pages already open read the books again */
  letGo: () => Promise<void> | void;
}): Promise<ImportResult> {
  const data = await guest.backup.exportAll();
  const result = await destination.repository.backup.restore(booksFor(data, destination));
  const settled = new Set(data.games.filter((g) => g.status === "settled").map(({ id }) => id));
  await copySummaries(guest, destination, settled).catch(() => undefined);
  marks.set(destination.organizerId, fingerprintOf(data));
  await letGo();
  return { ...result, holdings: holdingsOf(data) };
}

const OFFER_KEY = "guest-import";

/**
 * What the guest's books on this device would bring into the account's space signed in, or null:
 * for a guest, when there is nothing worth bringing, or when exactly these were brought before.
 */
export function useGuestOffer() {
  const books = useBooks();
  const space = books.status === "open" && books.mode === "account" ? books.key : undefined;
  return useQuery({
    queryKey: [OFFER_KEY, space],
    queryFn: () => guestOffer(guestRepository, booksInUse().organizerId, deviceMarks),
    enabled: space !== undefined,
    staleTime: 0,
  });
}

/** Brings the guest's books into the account's space whose books are open. */
export function useBringGuestBooks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      // The books as they are at the tap: a sign-out on the way fails rather than lands elsewhere
      const { mode, repository, organizerId, organizerName } = booksInUse();
      if (mode !== "account") throw new Error("Guest records are only brought into an account");
      return bringGuestBooks({
        guest: guestRepository,
        destination: { repository, organizerId, ownerName: organizerName },
        marks: deviceMarks,
        // As a switch of books does, with who the account is kept; not waited on, so the result
        // shows while the pages read again
        letGo: () => {
          void queryClient.resetQueries({ predicate: ({ queryKey }) => queryKey[0] !== "account" });
        },
      });
    },
  });
}
