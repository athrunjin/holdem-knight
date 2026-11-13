import type { ImbalanceHandling } from "@holdem-knight/core";
import { cn } from "@/lib/cn";

interface ImbalanceOptionsProps {
  /** Chips cashed out minus chips bought */
  differenceChips: number;
  /** The difference in cash, without a sign */
  cash: string;
  value: ImbalanceHandling | undefined;
  disabled: boolean;
  onChange: (handling: ImbalanceHandling) => void;
}

/** Each way to settle a chip difference, with its label. */
function imbalanceChoices(
  differenceChips: number,
  cash: string,
): readonly (readonly [ImbalanceHandling, string])[] {
  return [
    ["split", `按水${differenceChips > 0 ? "上" : "下"}比例分摊`],
    ["organizer", `组织者${differenceChips > 0 ? "补齐" : "收取"} ${cash}`],
    ["ignore", "不做处理"],
  ];
}

/** The ways to settle a chip difference. */
export function ImbalanceOptions({
  differenceChips,
  cash,
  value,
  disabled,
  onChange,
}: ImbalanceOptionsProps) {
  const options = imbalanceChoices(differenceChips, cash);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">差额处理方式</legend>
      {options.map(([handling, label]) => (
        <button
          key={handling}
          type="button"
          aria-pressed={value === handling}
          disabled={disabled}
          onClick={() => onChange(handling)}
          className={cn(
            "min-h-11 rounded-xl border px-3 text-left font-medium disabled:opacity-60",
            value === handling
              ? "border-accent bg-accent text-accent-text"
              : "border-line bg-surface",
          )}
        >
          {label}
        </button>
      ))}
    </fieldset>
  );
}
