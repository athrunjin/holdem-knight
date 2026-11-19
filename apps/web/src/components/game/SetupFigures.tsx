import { parseChips, tryParseMoney } from "@holdem-knight/core";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/cn";
import { selectOnFocus } from "@/lib/number-input";

/**
 * The pieces of a setup row of figures: numbers typed in place, centered in slots so rows line up,
 * with marks such as BB or a chip after them and joins such as = or ⇔ between them.
 */

/**
 * A number typed in place: a tap selects it, so typing replaces it, and Enter is held back as it
 * would submit the form. It is centered in a slot that holds 3 digits, or 4 when `wide`, so the
 * rows' numbers and marks line up; a longer number widens its own row. Away from it, `tidy` shows
 * the value neatly, such as 1,000 for 1000. `above` is small text over it, such as the blind in
 * points.
 */
export function FigureInput({
  label,
  value,
  onChange,
  tidy,
  invalid = false,
  wide = false,
  wholeNumber = false,
  disabled = false,
  above,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  tidy?: (value: string) => string;
  invalid?: boolean;
  wide?: boolean;
  /** Only digits get through */
  wholeNumber?: boolean;
  disabled?: boolean;
  above?: string | null | undefined;
  onBlur?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const shown = editing ? value : (tidy?.(value) ?? value);
  return (
    <span className="flex shrink-0 flex-col items-center">
      {above && <span className="text-[0.625rem] leading-3 font-normal text-muted">{above}</span>}
      <input
        type="text"
        aria-label={label}
        inputMode={wholeNumber ? "numeric" : "decimal"}
        autoComplete="off"
        disabled={disabled}
        value={shown}
        aria-invalid={invalid || undefined}
        onFocus={(event) => {
          setEditing(true);
          selectOnFocus(event.currentTarget);
        }}
        onBlur={() => {
          setEditing(false);
          onBlur?.();
        }}
        onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
        onChange={(event) =>
          onChange(wholeNumber ? event.target.value.replace(/\D/g, "") : event.target.value)
        }
        style={{ width: `${Math.max(wide ? 4 : 3, shown.length) + 1}ch` }}
        className={cn(
          "min-h-9 border-b bg-transparent text-center font-medium tabular-nums outline-none focus:border-highlight disabled:opacity-60",
          invalid ? "border-highlight" : "border-transparent",
        )}
      />
    </span>
  );
}

/** Chips with thousands separators, once they are a whole number. */
export function chipsText(text: string) {
  const value = parseChips(text);
  return value === null ? text : value.toLocaleString("zh-CN");
}

/** Points as typed, shown without cents when there are none. */
export function pointsInputText(text: string) {
  const value = tryParseMoney(text);
  return value === null ? text : pointsText(value);
}

/** Points without cents when there are none: 1 for 1.00, 2.50 for 2.5. */
export function pointsText(value: number) {
  const whole = Math.trunc(value / 100).toLocaleString("zh-CN");
  const fraction = Math.abs(value % 100);
  return fraction === 0 ? whole : `${whole}.${String(fraction).padStart(2, "0")}`;
}

/** The mark after a number: an icon, or SB, BB in small type. */
export const Mark = ({ children }: { children: ReactNode }) => (
  <span className="ml-1 grid w-5 shrink-0 place-items-center text-xs font-normal text-muted">
    {children}
  </span>
);

/** What joins two figures, such as = or /. */
export const Join = ({ children }: { children: ReactNode }) => (
  <span className="grid w-6 shrink-0 place-items-center font-normal text-muted">{children}</span>
);
