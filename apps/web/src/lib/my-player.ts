import {
  ORGANIZER_COLLECTOR,
  type PartyTransfers,
  type Player,
  type TransferLine,
  type TransferReport,
} from "@holdem-knight/core";
import { currentOrganizerId } from "@/data";
import { usePlayers } from "@/data/players";
import { useStoredState } from "@/lib/stored-state";

/** Where this device keeps which player of each set of books is the one using it. */
export const MY_PLAYER_KEY = "me.player";

/** From the organizer ID of a set of books to the ID of the player chosen as oneself in them. */
export type MyPlayers = Readonly<Record<string, string>>;

/** What was kept, where it is a map of strings to strings; anything else counts as nothing kept. */
export function parseMyPlayers(stored: unknown): MyPlayers | undefined {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return undefined;
  const entries = Object.entries(stored);
  return entries.every(([, value]) => typeof value === "string")
    ? Object.fromEntries(entries)
    : undefined;
}

/** The player chosen as oneself in the books in use: still being looked up, none, or that one. */
export type MyPlayer =
  | { readonly status: "loading" }
  | { readonly status: "none" }
  | { readonly status: "chosen"; readonly player: Player };

export interface MyPlayerState {
  readonly mine: MyPlayer;
  /** Keeps a player as oneself in the books in use, on this device only */
  readonly choose: (playerId: string) => void;
}

/**
 * Which player of the books in use is the one using the app, as this device keeps it. The guest's
 * books and each account's keep their own choice, so another books' player never shows. A kept ID
 * the library does not have counts as none, and is kept, so it comes back with the player.
 * The state is this call's own: a page calls it once and hands it down.
 */
export function useMyPlayer(): MyPlayerState {
  const [kept, keep] = useStoredState<MyPlayers>(MY_PLAYER_KEY, {}, parseMyPlayers);
  const { data: players } = usePlayers();
  const organizerId = currentOrganizerId();
  const id = kept[organizerId];
  const player = id === undefined ? undefined : players?.find((p) => p.id === id);

  const mine: MyPlayer =
    id === undefined
      ? { status: "none" }
      : players === undefined
        ? { status: "loading" }
        : player
          ? { status: "chosen", player }
          : { status: "none" };
  return {
    mine,
    choose: (playerId) => keep({ ...kept, [organizerId]: playerId }),
  };
}

/**
 * The player's own open lines in a report of transfers: those with the organizer, their party's,
 * and those between them and another player. Oldest first, by day and then by when the game
 * started, so the ones waiting longest come first.
 */
export function myLines(
  report: Pick<TransferReport, "parties" | "between">,
  playerId: string,
): { readonly party: PartyTransfers | undefined; readonly lines: readonly TransferLine[] } {
  const party = report.parties.find(({ partyId }) => partyId === playerId);
  const between = report.between.filter(({ from, to }) => from === playerId || to === playerId);
  const lines = [...(party?.lines ?? []), ...between].toSorted(
    (a, b) => a.day.localeCompare(b.day) || a.startedAt - b.startedAt,
  );
  return { party, lines };
}

/** Who a line of the player's is with, from their side. */
export type Counterpart =
  | { readonly kind: "toOrganizer" | "fromOrganizer" }
  | { readonly kind: "toPlayer" | "fromPlayer"; readonly playerId: string };

export function counterpartOf(line: TransferLine, playerId: string): Counterpart {
  if (line.to === ORGANIZER_COLLECTOR) return { kind: "toOrganizer" };
  if (line.from === ORGANIZER_COLLECTOR) return { kind: "fromOrganizer" };
  return line.from === playerId
    ? { kind: "toPlayer", playerId: line.to }
    : { kind: "fromPlayer", playerId: line.from };
}
