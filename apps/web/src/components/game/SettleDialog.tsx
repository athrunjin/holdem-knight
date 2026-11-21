import type { ImbalanceHandling } from "@holdem-knight/core";
import { Check, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { FormDialog } from "./FormDialog";
import { ImbalanceOptions } from "./ImbalanceOptions";

interface SettleDialogProps {
  seatedCount: number;
  /** Insurance sold whose card has not been recorded yet */
  pendingInsurance: number;
  balanceChips: number;
  /** The balance in cash, without a sign */
  cash: string;
  /** The organizer by name, which is their ID until organizers have names */
  organizerName: string;
  initialHandling: ImbalanceHandling | undefined;
  saving: boolean;
  saveFailed: boolean;
  onSubmit: (handling: ImbalanceHandling | undefined) => void;
  onClose: () => void;
}

/**
 * Settling the whole table. The chips come first: whether they add up, said either way, and if
 * not, how the difference is handled, with the organizer taking it chosen to begin with. Under
 * that, who is still seated and leaves with this step, and any insurance still open.
 */
export function SettleDialog({
  seatedCount,
  pendingInsurance,
  balanceChips,
  cash,
  organizerName,
  initialHandling,
  saving,
  saveFailed,
  onSubmit,
  onClose,
}: SettleDialogProps) {
  const [handling, setHandling] = useState<ImbalanceHandling>(initialHandling ?? "organizer");
  const balanced = balanceChips === 0;
  const chips = Math.abs(balanceChips).toLocaleString("zh-CN");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(balanced ? undefined : handling);
  }

  return (
    <FormDialog
      title={t.game.settleDialog.settle}
      submitLabel={
        seatedCount > 0 ? t.game.settleDialog.allLeaveSettle : t.game.settleDialog.goToSettlement
      }
      saving={saving}
      saveFailed={saveFailed}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <p
        role="status"
        className={cn("flex items-center gap-1 font-medium", balanced ? "text-win" : "text-loss")}
      >
        {balanced ? (
          <>
            {t.game.settleDialog.chipBalance}
            <Check className="size-4 shrink-0" aria-hidden />
          </>
        ) : (
          <>
            <X className="size-4 shrink-0" aria-hidden />
            {t.game.settleDialog.chipsDontBalance}
            {balanceChips > 0 ? t.game.settleDialog.over : t.game.settleDialog.short} {chips}{" "}
            {t.game.settleDialog.chips} {cash}
          </>
        )}
      </p>
      {!balanced && (
        <ImbalanceOptions
          differenceChips={balanceChips}
          cash={cash}
          organizerName={organizerName}
          value={handling}
          disabled={saving}
          onChange={setHandling}
        />
      )}
      {seatedCount > 0 && (
        <p className="text-sm text-muted">
          {t.game.settleDialog.stillAtTheTableLeavingAll(seatedCount, " ")}
        </p>
      )}
      {pendingInsurance > 0 && (
        <p role="alert" className="text-sm text-highlight">
          {t.game.settleDialog.insuranceBetsHaveNoResultRecorded(pendingInsurance)}
        </p>
      )}
    </FormDialog>
  );
}
