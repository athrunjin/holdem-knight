import type { Charge, Game } from "@holdem-knight/core";
import { InfoButton } from "@/components/InfoButton";
import { chargeRuleNotes, chargeSettingLines } from "@/lib/charges";

interface ChargeSummaryProps {
  game: Pick<Game, "wage" | "tableFee" | "currency">;
  charges: readonly Charge[];
}

/**
 * The wages and table fee this game charged, in brief, with the charging rules behind an info
 * button. Shown above the cards once their details are open.
 */
export function ChargeSummary({ game, charges }: ChargeSummaryProps) {
  const lines = chargeSettingLines(game, charges, game.currency);
  if (lines.length === 0) return null;
  const title = lines.map(({ label }) => label).join("和");

  return (
    <section
      aria-label={title}
      className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs"
    >
      <div className="flex items-center">
        <h4 className="font-medium">{title}</h4>
        <InfoButton title="计费规则" text={chargeRuleNotes(game, game.currency).join("\n")} />
      </div>
      <dl>
        {lines.map(({ label, items }) => (
          <div key={label} className="flex gap-2 pb-1">
            <dt className="shrink-0 text-muted">{label}</dt>
            {/* Each setting stays whole when the line wraps */}
            <dd className="flex min-w-0 flex-wrap gap-x-2">
              {items.map((item) => (
                <span key={item} className="whitespace-nowrap">
                  {item}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
