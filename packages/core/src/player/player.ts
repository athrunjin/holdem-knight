/** Player list: name validation and search. */
import { INSURANCE_PLAYER_NAME, type Player, RAKE_PLAYER_NAME } from "../domain";

export const MAX_PLAYER_NAME_LENGTH = 30;

/** Issue codes. The UI decides the wording. */
export type PlayerNameIssue = "empty" | "too-long" | "reserved";

export type ParsedPlayerName =
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly issue: PlayerNameIssue };

/** A name as it is compared: whitespace removed and case ignored. Namesakes share a key. */
export function playerNameKey(text: string): string {
  return text.replace(/\s/g, "").toLowerCase();
}

/**
 * Validates and normalizes a name. A name another player has is allowed: a game tells namesakes
 * apart with a suffix, and the player list by number (ADR 0043).
 */
export function parsePlayerName(input: string): ParsedPlayerName {
  const name = input.trim().replace(/\s+/g, " ");
  if (name === "") return { ok: false, issue: "empty" };
  if ([...name].length > MAX_PLAYER_NAME_LENGTH) return { ok: false, issue: "too-long" };
  const key = playerNameKey(name);
  if (
    [INSURANCE_PLAYER_NAME, RAKE_PLAYER_NAME].some((reserved) => playerNameKey(reserved) === key)
  ) {
    return { ok: false, issue: "reserved" };
  }
  return { ok: true, name };
}

/** Searches by name or pinyin initials, ignoring case and keeping the original order. An empty query returns everyone. */
export function searchPlayers(players: readonly Player[], query: string): Player[] {
  const key = playerNameKey(query);
  if (key === "") return [...players];
  return players.filter(
    (player) => playerNameKey(player.name).includes(key) || player.initials.includes(key),
  );
}

/** Players sharing a heading letter, in the order of the alphabet. */
export interface InitialGroup<T> {
  /** A to Z, or # for a name that starts with anything else. */
  readonly letter: string;
  readonly players: readonly T[];
}

/** The heading letter for a player: the first of their initials, or # for anything but a letter. */
export function initialLetter({ initials }: Pick<Player, "initials">): string {
  const first = initials.charAt(0).toUpperCase();
  return first >= "A" && first <= "Z" ? first : "#";
}

/**
 * Groups players under the first letter of their initials, A to Z then #. Only letters with
 * someone appear. Within a letter, players sort by initials, then by name.
 */
export function groupByInitial<T extends Pick<Player, "name" | "initials">>(
  players: readonly T[],
): InitialGroup<T>[] {
  const sorted = [...players].sort(comparePlayers);
  const groups = new Map<string, T[]>();
  for (const player of sorted) {
    const letter = initialLetter(player);
    groups.set(letter, [...(groups.get(letter) ?? []), player]);
  }
  return [...groups]
    .sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : compare(a, b)))
    .map(([letter, members]) => ({ letter, players: members }));
}

/** Alphabetical order: by initials, then by name. */
export function comparePlayers(
  a: Pick<Player, "name" | "initials">,
  b: Pick<Player, "name" | "initials">,
): number {
  return compare(a.initials, b.initials) || compare(a.name, b.name);
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A record's number as people read it: `#0042`. */
export function playerNumberText(number: number): string {
  return `#${String(number).padStart(4, "0")}`;
}

/**
 * Gives a number to every record that needs one, and returns only the records changed. A record
 * keeps the number it has. One with none, or with a number an older record already holds (as
 * after records are brought in from elsewhere), gets the next number past the highest in use,
 * oldest record first.
 */
export function numberPlayers(players: readonly Player[]): Player[] {
  const oldestFirst = players.toSorted(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
  const held = new Set<number>();
  const unnumbered: Player[] = [];
  for (const player of oldestFirst) {
    if (player.number !== undefined && !held.has(player.number)) held.add(player.number);
    else unnumbered.push(player);
  }
  let next = Math.max(0, ...held) + 1;
  return unnumbered.map((player) => ({ ...player, number: next++ }));
}
