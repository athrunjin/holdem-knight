import { type ChipRatio, type Currency, chipsToCents, parseChips } from "@holdem-knight/core";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { formatGameMoney } from "@/lib/currency";
import { FormDialog } from "./FormDialog";
import { HandsStepper } from "./HandsStepper";

interface HandsDialogProps {
  title: string;
  initialHands: number;
  /** Select the input on open so a number can be typed right away */
  selectInput: boolean;
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
  selectInput,
  handChips,
  ratio,
  currency,
  saving,
  saveFailed,
  onSubmit,
  onRemove,
  onClose,
}: HandsDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(String(initialHands));
  const [issue, setIssue] = useState<string>();
  const hands = parseChips(value);
  const valid = hands !== null && hands > 0;

  useEffect(() => {
    if (selectInput) inputRef.current?.select();
  }, [selectInput]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (valid) {
      onSubmit(hands);
    } else {
      setIssue("请输入大于 0 的整数手数");
    }
  }

  return (
    <FormDialog
      title={title}
      submitLabel="确定"
      saving={saving}
      saveFailed={saveFailed}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <div>
        <HandsStepper
          value={value}
          inputRef={inputRef}
          onChange={(next) => {
            setIssue(undefined);
            setValue(next);
          }}
        />
        {issue && <p className="mt-1 text-sm text-highlight">{issue}</p>}
        {valid && (
          <p className="mt-1 text-sm text-muted">
            {(hands * handChips).toLocaleString("zh-CN")} 筹码，
            {formatGameMoney(chipsToCents(hands * handChips, ratio), currency)}
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
