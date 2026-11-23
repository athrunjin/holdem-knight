import type { Game, Timestamp } from "@holdem-knight/core";

const formats = new Map<string, Intl.DateTimeFormat | null>();

/** A format that reads a time as a day in an IANA time zone, or null for a zone this device does not know. */
function dayFormat(timeZone: string | undefined): Intl.DateTimeFormat | null {
  const key = timeZone ?? "";
  const known = formats.get(key);
  if (known !== undefined) return known;
  let format: Intl.DateTimeFormat | null = null;
  try {
    format = new Intl.DateTimeFormat("en-CA", {
      ...(timeZone && { timeZone }),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    // An unknown zone, for example from a backup made on a newer system
  }
  formats.set(key, format);
  return format;
}

/** The day a time falls on, as `2026-11-21`: in a time zone, or on this device without one. */
export function dayOf(time: Timestamp, timeZone?: string): string {
  const format = (timeZone && dayFormat(timeZone)) || dayFormat(undefined);
  const parts = format?.formatToParts(time) ?? [];
  const value = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

/**
 * The day a game started where it was played, which reports go by: a game that runs past midnight
 * belongs to the day it began. A game from before zones were kept uses this device's.
 */
export function gameDay({ createdAt, timeZone }: Pick<Game, "createdAt" | "timeZone">): string {
  return dayOf(createdAt, timeZone);
}
