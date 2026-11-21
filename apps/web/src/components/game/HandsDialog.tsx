import { type ChipRatio, type Currency, chipsToCents, parseChips } from "@holdem-knight/core";
import { ArrowRight } from "lucide-react";
import { type FormEvent, useState } from "react";
import { t } from "@/i18n";
import { formatSignedChips } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { formatGameAmount, formatGameMoney } from "@/lib/currency";
import { FormDialog } from "./FormDialog";
import { HandsStepper } from "./HandsStepper";

interface HandsDialogProps {
  title: string;
  initialHands: number;
  /**
   * A change to someone already in view: the confirm button lights once the hands differ from
   * `currentHands`, and a second step shows the change before it reaches the game.
   */
  review?: { readonly name: string; readonly currentHands: number } | undefined;
  handChips: number;
  ratio: ChipRatio;
  currency: Currency;
  saving: boolean;
  saveFailed: boolean;
  onSubmit: (hands: number) => void;
  /** Offered for a player added by mistake, who can still be taken out of the game */
  onRemove?: (() => void) | undefined;
  onClose: () => void;
}

export function HandsDialog({
  title,
  initialHands,
  review,
  handChips,
  ratio,
  currency,
  saving,
  saveFailed,
  onSubmit,
  onRemove,
  onClose,
}: HandsDialogProps) {
  const [value, setValue] = useState(String(initialHands));
  const [issue, setIssue] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const hands = parseChips(value);
  const valid = hands !== null && hands > 0;
  const changed = valid && hands !== review?.currentHands;
  const money = (chips: number) => formatGameMoney(chipsToCents(chips, ratio), currency);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid) {
      setIssue(t.game.handsDialog.enterAWholeNumberOfBuy);
    } else if (review && !confirming) {
      if (changed) setConfirming(true);
    } else {
      onSubmit(hands);
    }
  }

  if (review && confirming && valid) {
    const by = hands - review.currentHands;
    // Green for more chips on the table, red for fewer
    const tone = by > 0 ? "text-win" : "text-loss";
    return (
      <FormDialog
        title={
          <>
            {review.name}{" "}
            <span className={tone}>
              {by > 0 ? t.game.handsDialog.more : t.game.handsDialog.less}
            </span>{" "}
            {Math.abs(by)} {t.game.handsDialog.buyIns}
          </>
        }
        submitLabel={t.common.confirm}
        back={{ label: t.common.back, onBack: () => setConfirming(false) }}
        saving={saving}
        saveFailed={saveFailed}
        onSubmit={handleSubmit}
        onClose={onClose}
      >
        <div>
          <div
            role="img"
            aria-label={t.game.handsDialog.buyInsBecome(review.currentHands, hands)}
            className="flex items-end justify-center gap-4 text-3xl font-semibold tabular-nums"
          >
            <span className="text-muted">{review.currentHands}</span>
            <span className={cn("flex flex-col items-center", tone)}>
              <span className="text-sm">
                {by > 0 ? "+" : "−"}
                {Math.abs(by)}
              </span>
              <ArrowRight className="size-7" aria-hidden />
            </span>
            <span className={tone}>{hands}</span>
          </div>
          {/* Only this change. The stack follows it too, but that is not this step's news */}
          <p className="mt-2 text-center text-sm text-muted">
            {t.game.handsDialog.chips}{" "}
            <span className={cn("tabular-nums", tone)}>
              {formatSignedChips(by * handChips)}（
              {formatGameAmount(chipsToCents(by * handChips, ratio), currency, "exceptZero")}）
            </span>
          </p>
        </div>
      </FormDialog>
    );
  }

  return (
    <FormDialog
      title={title}
      submitLabel={t.common.ok}
      canSubmit={review ? changed : true}
      saving={saving}
      saveFailed={saveFailed}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <div>
        <HandsStepper
          value={value}
          onChange={(next) => {
            setIssue(undefined);
            setValue(next);
          }}
        />
        {issue && <p className="mt-1 text-sm text-highlight">{issue}</p>}
        {valid && (
          <p className="mt-1 text-sm text-muted">
            {t.game.handsDialog.chips2(
              (hands * handChips).toLocaleString("zh-CN"),
              money(hands * handChips),
            )}
          </p>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="mt-1 inline-flex min-h-11 items-center text-sm text-highlight"
          >
            {t.game.handsDialog.removeFromThisGame}
          </button>
        )}
      </div>
    </FormDialog>
  );
}
