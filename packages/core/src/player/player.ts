/** Player list: name validation and search. */
import { INSURANCE_PLAYER_NAME, type Player } from "../domain";

export const MAX_PLAYER_NAME_LENGTH = 30;

/** Issue codes. The UI decides the wording. */
export type PlayerNameIssue = "empty" | "too-long" | "duplicate" | "reserved";

export type ParsedPlayerName =
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly issue: PlayerNameIssue };

/** For comparing names: removes whitespace and ignores case. */
function comparable(text: string): string {
  return text.replace(/\s/g, "").toLowerCase();
}

/**
 * Validates and normalizes a name. `otherNames` holds the other players' names: players are picked by name,
 * so duplicates would pick the wrong person and are not allowed. Real namesakes can be written like 小王2.
 */
export function parsePlayerName(input: string, otherNames: readonly string[]): ParsedPlayerName {
  const name = input.trim().replace(/\s+/g, " ");
  if (name === "") return { ok: false, issue: "empty" };
  if ([...name].length > MAX_PLAYER_NAME_LENGTH) return { ok: false, issue: "too-long" };
  const key = comparable(name);
  if (key === comparable(INSURANCE_PLAYER_NAME)) return { ok: false, issue: "reserved" };
  if (otherNames.some((other) => comparable(other) === key)) {
    return { ok: false, issue: "duplicate" };
  }
  return { ok: true, name };
}

/** Searches by name or pinyin initials, ignoring case and keeping the original order. An empty query returns everyone. */
export function searchPlayers(players: readonly Player[], query: string): Player[] {
  const key = comparable(query);
  if (key === "") return [...players];
  return players.filter(
    (player) => comparable(player.name).includes(key) || player.initials.includes(key),
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
  const sorted = [...players].sort(
    (a, b) => compare(a.initials, b.initials) || compare(a.name, b.name),
  );
  const groups = new Map<string, T[]>();
  for (const player of sorted) {
    const letter = initialLetter(player);
    groups.set(letter, [...(groups.get(letter) ?? []), player]);
  }
  return [...groups]
    .sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : compare(a, b)))
    .map(([letter, members]) => ({ letter, players: members }));
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
