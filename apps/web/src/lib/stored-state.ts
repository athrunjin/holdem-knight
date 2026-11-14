import { useState } from "react";

function read<T>(key: string, parse: (stored: unknown) => T | undefined): T | undefined {
  try {
    const text = localStorage.getItem(key);
    return text === null ? undefined : parse(JSON.parse(text));
  } catch {
    // Storage that is switched off or holds something unreadable counts as nothing kept
    return undefined;
  }
}

/**
 * State that this browser keeps between visits, such as how a page was left. What comes back is
 * checked by `parse`, so anything kept in an older shape gives way to the fallback.
 */
export function useStoredState<T>(
  key: string,
  fallback: T,
  parse: (stored: unknown) => T | undefined,
) {
  const [state, setState] = useState(() => read(key, parse) ?? fallback);

  function store(next: T) {
    setState(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Without storage the state still holds until the page is left
    }
  }

  return [state, store] as const;
}

export const parseBoolean = (stored: unknown) => (typeof stored === "boolean" ? stored : undefined);
