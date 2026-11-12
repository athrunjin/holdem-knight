import { type ChipRatio, type Currency, chipsToCents, parseChips } from "@holdem-knight/core";
import { ArrowRight } from "lucide-react";
import { type FormEvent, useState } from "react";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";
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
      setIssue("请输入大于 0 的整数手数");
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
            {review.name} <span className={tone}>{by > 0 ? "增加" : "减少"}</span> {Math.abs(by)}{" "}
            手买入
          </>
        }
        submitLabel="确认"
        back={{ label: "返回", onBack: () => setConfirming(false) }}
        saving={saving}
        saveFailed={saveFailed}
        onSubmit={handleSubmit}
        onClose={onClose}
      >
        <div>
          <div
            role="img"
            aria-label={`${review.currentHands} 手变为 ${hands} 手`}
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
          <p className="mt-2 text-center text-sm text-muted">
            {(review.currentHands * handChips).toLocaleString("zh-CN")} →{" "}
            {(hands * handChips).toLocaleString("zh-CN")} 筹码，{by > 0 ? "多买" : "退回"}{" "}
            {money(Math.abs(by) * handChips)}
          </p>
        </div>
      </FormDialog>
    );
  }

  return (
    <FormDialog
      title={title}
      submitLabel="确定"
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
            {(hands * handChips).toLocaleString("zh-CN")} 筹码，{money(hands * handChips)}
          </p>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="mt-1 inline-flex min-h-11 items-center text-sm text-highlight"
          >
            移出这局
          </button>
        )}
      </div>
    </FormDialog>
  );
}
