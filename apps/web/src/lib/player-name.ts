import {
  type Game,
  gamePlayerNames,
  INSURANCE_PLAYER_ID,
  INSURANCE_PLAYER_NAME,
  type LedgerEvent,
  MAX_PLAYER_NAME_LENGTH,
  ORGANIZER_PLAYER_ID,
  type Player,
  type PlayerNameIssue,
  playerNameKey,
  playerNumberText,
  RAKE_PLAYER_ID,
  RAKE_PLAYER_NAME,
} from "@holdem-knight/core";
import { organizerNameOf } from "@/data";
import { t } from "@/i18n";

/**
 * Names for everyone with chips in a game: the players, the insurance and rake seats and the
 * organizer, by the name of their space. Players who share a name read it with a suffix in the
 * order they sat down, worked out from the game's ledger (ADR 0043).
 */
export function gameNameOf(
  players: readonly Player[],
  game: Pick<Game, "organizerId">,
  events: readonly LedgerEvent[],
) {
  const names = new Map(players.map(({ id, name }) => [id, name]));
  for (const [id, label] of gamePlayerNames(events, players)) names.set(id, label);
  names.set(INSURANCE_PLAYER_ID, t.common.insurance);
  names.set(RAKE_PLAYER_ID, t.common.rake);
  names.set(ORGANIZER_PLAYER_ID, organizerNameOf(game));
  return (playerId: string) => names.get(playerId) ?? t.common.unknownPlayer;
}

/**
 * The suffix a player's name takes in a game (`_1`), so a name cut short can keep it: the end of
 * their label beyond their plain name, from `gamePlayerNames`, never read off the text, since a
 * real name may end in `_1`. Nothing for a player who reads their plain name, nor for the seats.
 */
export function gameNameSuffixOf(players: readonly Player[], events: readonly LedgerEvent[]) {
  const plain = new Map(players.map(({ id, name }) => [id, name]));
  const suffixes = new Map<string, string>();
  for (const [id, label] of gamePlayerNames(events, players)) {
    const name = plain.get(id);
    if (name === undefined || label === name) continue;
    const base = name.trim();
    if (label.length > base.length && label.startsWith(base)) {
      suffixes.set(id, label.slice(base.length));
    }
  }
  return (playerId: string): string | undefined => suffixes.get(playerId);
}

/**
 * The name a player reads in a game once bought in, for the dialog of their buy-in: the label
 * they have if they are in the game, or the one a buy-in after the ledger's events gives them.
 */
export function gameNameOnBuyIn(
  players: readonly Player[],
  events: readonly LedgerEvent[],
  playerId: string,
): string {
  const player = players.find(({ id }) => id === playerId);
  if (!player) return t.common.unknownPlayer;
  const buyIn: LedgerEvent = {
    id: `${playerId}:next-buy-in`,
    organizerId: player.organizerId,
    gameId: events[0]?.gameId ?? "",
    occurredAt: events.at(-1)?.occurredAt ?? 0,
    type: "buy_in",
    playerId,
    chips: 1,
  };
  return gamePlayerNames([...events, buyIn], players).get(playerId) ?? player.name;
}

/** A name across games: the plain name, and the record's number where another record has the name. */
export interface LibraryName {
  name: string;
  /** `#0003`, only when the name's key is carried by more than one record of the library */
  number: string | undefined;
}

/** A library name as one line of text, for labels read aloud and short chips. */
export function libraryNameText({ name, number }: LibraryName): string {
  return number === undefined ? name : `${name} ${number}`;
}

/**
 * Names outside one game, where there is no order of sitting down and so no suffix: a player
 * whose name another record of the library also carries reads it with their number. Seats and the
 * organizer read as in a game. Without a game, the organizer reads as an unknown player.
 */
export function libraryNameOf(
  players: readonly Player[],
  game?: Pick<Game, "organizerId">,
): (playerId: string) => LibraryName {
  const holders = new Map<string, number>();
  for (const { name } of players) {
    const key = playerNameKey(name);
    holders.set(key, (holders.get(key) ?? 0) + 1);
  }
  const names = new Map<string, LibraryName>(
    players.map(({ id, name, number }) => [
      id,
      {
        name,
        number:
          number !== undefined && (holders.get(playerNameKey(name)) ?? 0) > 1
            ? playerNumberText(number)
            : undefined,
      },
    ]),
  );
  const seat = (name: string): LibraryName => ({ name, number: undefined });
  names.set(INSURANCE_PLAYER_ID, seat(t.common.insurance));
  names.set(RAKE_PLAYER_ID, seat(t.common.rake));
  if (game) names.set(ORGANIZER_PLAYER_ID, seat(organizerNameOf(game)));
  return (playerId: string) => names.get(playerId) ?? seat(t.common.unknownPlayer);
}

/** Initials for ordering everyone in a game by name: a player's own, or the name of a seat. */
export function gameInitialsOf(players: readonly Player[]) {
  const initials = new Map(players.map((player) => [player.id, player.initials]));
  return (playerId: string, name: string) => initials.get(playerId) ?? name;
}

export const PLAYER_NAME_ISSUE_TEXT: Record<PlayerNameIssue, string> = {
  empty: t.lib.playerName.enterAName,
  "too-long": t.lib.playerName.aNameCantBeLongerThan(MAX_PLAYER_NAME_LENGTH),
  reserved: t.lib.playerName.andAreReservedNamesChooseAnother(
    INSURANCE_PLAYER_NAME,
    RAKE_PLAYER_NAME,
  ),
};

/** The players of the library whose name has the same key as `name`, none for an empty name. */
export function namesakesOf(players: readonly Player[], name: string): Player[] {
  const key = playerNameKey(name);
  if (key === "") return [];
  return players.filter((player) => playerNameKey(player.name) === key);
}

/** The line under a name field that other players have the name, with their numbers, or nothing. */
export function namesakeHint(namesakes: readonly Player[]): string | undefined {
  if (namesakes.length === 0) return undefined;
  const numbers = namesakes
    .flatMap(({ number }) => (number === undefined ? [] : [number]))
    .toSorted((a, b) => a - b)
    .map(playerNumberText)
    .join(t.lib.playerName.numberSeparator);
  return t.lib.playerName.namesakeExists(numbers).trim();
}
