import { type ChipRatio, type Currency, chipsToCents, parseChips } from "@holdem-knight/core";
import { type FormEvent, useState } from "react";
import { TextField } from "@/components/TextField";
import { t } from "@/i18n";
import { formatGameMoney } from "@/lib/currency";
import { FormDialog } from "./FormDialog";

interface ChipAmountDialogProps {
  title: string;
  submitLabel: string;
  /** Buy-ins and rebuys, which must be above 0 */
  initialChips: number | undefined;
  ratio: ChipRatio;
  currency: Currency;
  saving: boolean;
  saveFailed: boolean;
  onSubmit: (chips: number) => void;
  onClose: () => void;
}

export function ChipAmountDialog({
  title,
  submitLabel,
  initialChips,
  ratio,
  currency,
  saving,
  saveFailed,
  onSubmit,
  onClose,
}: ChipAmountDialogProps) {
  const [value, setValue] = useState(initialChips === undefined ? "" : String(initialChips));
  const [issue, setIssue] = useState<string>();
  const chips = parseChips(value);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (chips === null) {
      setIssue(t.game.chipAmountDialog.enterAWholeNumberOfChips);
    } else if (chips === 0) {
      setIssue(t.game.chipAmountDialog.mustBeMoreThan0);
    } else {
      onSubmit(chips);
    }
  }

  return (
    <FormDialog
      title={title}
      submitLabel={submitLabel}
      saving={saving}
      saveFailed={saveFailed}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <div>
        <TextField
          id="chips"
          label={t.game.chipAmountDialog.chips}
          value={value}
          issue={issue}
          suffix={t.common.chips}
          inputMode="numeric"
          onChange={setValue}
        />
        {chips !== null && (
          <p className="mt-1 text-sm text-muted">
            {t.game.chipAmountDialog.equals(formatGameMoney(chipsToCents(chips, ratio), currency))}
          </p>
        )}
      </div>
    </FormDialog>
  );
}
