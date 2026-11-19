import { parseChips } from "@holdem-knight/core";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { selectOnFocus } from "@/lib/number-input";

interface StackFieldProps {
  chips: number;
  label: string;
  className?: string | false;
  /** A new stack, once it is typed and left. Not called when it is unchanged or not a number */
  onCommit: (chips: number) => void;
}

/**
 * A stack on a card, typed over where it stands: a tap selects it, and leaving the field or 完成
 * saves it. Escape, or anything that is not a whole number, leaves it as it was.
 */
export function StackField({ chips, label, className, onCommit }: StackFieldProps) {
  const [draft, setDraft] = useState<string>();
  const cancelled = useRef(false);

  function commit() {
    const next = draft === undefined ? null : parseChips(draft);
    if (!cancelled.current && next !== null && next !== chips) onCommit(next);
    cancelled.current = false;
    setDraft(undefined);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      enterKeyHint="done"
      autoComplete="off"
      aria-label={label}
      value={draft ?? chips.toLocaleString("zh-CN")}
      onFocus={(event) => {
        setDraft(String(chips));
        selectOnFocus(event.currentTarget);
      }}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") cancelled.current = true;
        if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur();
      }}
      onBlur={commit}
      className={cn(
        "min-h-11 w-full min-w-0 rounded-md bg-transparent text-center tabular-nums outline-none focus:bg-bg focus:ring-1 focus:ring-highlight",
        className,
      )}
    />
  );
}
