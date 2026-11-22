import type { ImbalanceHandling } from "@holdem-knight/core";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";

interface ImbalanceOptionsProps {
  /** Chips cashed out minus chips bought */
  differenceChips: number;
  /** The difference in cash, without a sign */
  cash: string;
  /** The organizer by name, which is their ID until organizers have names */
  organizerName: string;
  value: ImbalanceHandling | undefined;
  disabled: boolean;
  onChange: (handling: ImbalanceHandling) => void;
}

/** Each way to settle a chip difference, with its label. */
function imbalanceChoices(
  differenceChips: number,
  cash: string,
  organizerName: string,
): readonly (readonly [ImbalanceHandling, string])[] {
  return [
    [
      "organizer",
      `${organizerName} ${differenceChips > 0 ? t.game.imbalanceOptions.covers : t.common.keeps} ${cash}`,
    ],
    [
      "split",
      t.game.imbalanceOptions.splitByShareOf(
        differenceChips > 0 ? t.game.imbalanceOptions.winnings : t.game.imbalanceOptions.losses,
      ),
    ],
    ["ignore", t.game.imbalanceOptions.leaveAsIs],
  ];
}

/** The ways to settle a chip difference. */
export function ImbalanceOptions({
  differenceChips,
  cash,
  organizerName,
  value,
  disabled,
  onChange,
}: ImbalanceOptionsProps) {
  const options = imbalanceChoices(differenceChips, cash, organizerName);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{t.game.imbalanceOptions.howToHandleTheDifference}</legend>
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
