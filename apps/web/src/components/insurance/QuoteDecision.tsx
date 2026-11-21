import type { QuoteBlock, QuoteOption } from "@holdem-knight/core";
import { t } from "@/i18n";

const BLOCK_TEXT: Record<QuoteBlock, string> = {
  "tied-lead": t.insurance.quoteDecision.tiedForTheLeadSoNo,
  "no-outs": t.insurance.quoteDecision.noOutsAgainstSoNoInsurance,
  "too-many-outs": t.insurance.quoteDecision.moreOutsThanTheOddsTable,
  "pot-too-small": t.insurance.quoteDecision.thePotIsTooSmallA,
};

const chipText = (chips: number) => chips.toLocaleString("zh-CN");

export interface QuotePurchase {
  readonly option: QuoteOption;
  readonly oddsHundredths: number;
}

export type QuoteDecision =
  | {
      readonly kind: "bought";
      readonly purchaseId: string;
      readonly premiumChips: number;
      readonly payoutChips: number;
    }
  | { readonly kind: "declined" };

/** Why a pot has no insurance to sell, in place of its covers. */
export function QuoteBlocked({ block }: { block: QuoteBlock }) {
  return <p className="mt-2 text-sm text-muted">{BLOCK_TEXT[block]}</p>;
}

/** What was decided for an offer, with the way back to change it. */
export function DecisionBar({
  decision,
  saving,
  onRevise,
}: {
  decision: QuoteDecision;
  saving: boolean | undefined;
  onRevise: (() => void) | undefined;
}) {
  return (
    <div
      role="status"
      className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-line bg-bg p-2"
    >
      {decision.kind === "bought" ? (
        // The payout is on the row bought, just above
        <p className="min-w-0 font-semibold">
          {t.insurance.quoteDecision.insuredPremium(chipText(decision.premiumChips))}
        </p>
      ) : (
        <p className="min-w-0 font-semibold">{t.insurance.quoteDecision.choseNotToBuy}</p>
      )}
      <button
        type="button"
        disabled={saving}
        onClick={onRevise}
        className="min-h-11 shrink-0 rounded-xl bg-accent px-5 font-semibold text-accent-text disabled:opacity-60"
      >
        {t.insurance.quoteDecision.edit}
      </button>
    </div>
  );
}
