import { useLayoutEffect, useState } from "react";

const KEY = "list-return";

/** The page the app was on before the one it is on, as the router reports it. */
let previousPath: string | undefined;

export function notePreviousPath(path: string | undefined) {
  previousPath = path;
}

/** Called as a game is opened from a list: where the list was, to come back to. */
export function leaveList() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path: location.pathname, y: window.scrollY }));
  } catch {
    // Without storage the list opens at its top again
  }
}

function keptFor(path: string): number | undefined {
  // Only straight back from a game: reached any other way, the list opens afresh
  if (!previousPath?.startsWith("/games/")) return undefined;
  try {
    const kept: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (typeof kept !== "object" || kept === null) return undefined;
    const { path: left, y } = kept as Record<string, unknown>;
    return left === path && typeof y === "number" ? y : undefined;
  } catch {
    return undefined;
  }
}

/**
 * For a list page, called where its list is first drawn. True when the page is come back to from
 * a game opened from it: it is then scrolled to where it was left.
 */
export function useListReturn(path: string): boolean {
  const [y] = useState(() => keptFor(path));
  useLayoutEffect(() => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // Nothing was kept
    }
    if (y === undefined) return;
    window.scrollTo(0, y);
    // Once more after the router has settled, in case it moved the page meanwhile
    const frame = requestAnimationFrame(() => window.scrollTo(0, y));
    return () => cancelAnimationFrame(frame);
  }, [y]);
  return y !== undefined;
}
