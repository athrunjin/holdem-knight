import { comparePlayers } from "@holdem-knight/core";

/** The columns a list of players can be ordered by. */
export type SortKey = "name" | "net" | "amount";

export interface CardSort {
  readonly key: SortKey;
  readonly dir: "asc" | "desc";
}

/** Players in alphabetical order, by the initials of their names. */
export const DEFAULT_SORT: CardSort = { key: "name", dir: "asc" };

/** A tap on a column's title: the same column turns the order round, another starts in order. */
export function nextSort(current: CardSort, key: SortKey): CardSort {
  if (current.key !== key) return { key, dir: "asc" };
  return { key, dir: current.dir === "asc" ? "desc" : "asc" };
}

export interface SortFields {
  readonly name: string;
  readonly initials: string;
  /** Missing sorts as 0 */
  readonly net?: number | undefined;
  readonly amount?: number | undefined;
}

/** Orders items by the chosen column, and alphabetically where they are level. */
export function sortCards<T>(
  items: readonly T[],
  sort: CardSort,
  fields: (item: T) => SortFields,
): T[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return items
    .map((item) => ({ item, by: fields(item) }))
    .sort((a, b) => {
      const primary =
        sort.key === "name"
          ? comparePlayers(a.by, b.by)
          : (a.by[sort.key] ?? 0) - (b.by[sort.key] ?? 0);
      return sign * primary || comparePlayers(a.by, b.by);
    })
    .map(({ item }) => item);
}
