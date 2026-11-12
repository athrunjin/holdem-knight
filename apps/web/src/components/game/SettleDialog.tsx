import type { ImbalanceHandling } from "@holdem-knight/core";
import { type FormEvent, useState } from "react";
import { formatDifference } from "@/lib/chips";
import { FormDialog } from "./FormDialog";
import { ImbalanceOptions } from "./ImbalanceOptions";

interface SettleDialogProps {
  seatedCount: number;
  /** Insurance sold whose card has not been recorded yet */
  pendingInsurance: number;
  balanceChips: number;
  /** The balance in cash, without a sign */
  cash: string;
  initialHandling: ImbalanceHandling | undefined;
  saving: boolean;
  saveFailed: boolean;
  onSubmit: (handling: ImbalanceHandling | undefined) => void;
  onClose: () => void;
}

/** Shows whether the table balances before settling, and can seat everyone out in one step. */
export function SettleDialog({
  seatedCount,
  pendingInsurance,
  balanceChips,
  cash,
  initialHandling,
  saving,
  saveFailed,
  onSubmit,
  onClose,
}: SettleDialogProps) {
  const [handling, setHandling] = useState(initialHandling);
  const [issue, setIssue] = useState<string>();
  const balanced = balanceChips === 0;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!balanced && !handling) {
      setIssue("请选择差额怎么处理");
    } else {
      onSubmit(balanced ? undefined : handling);
    }
  }

  return (
    <FormDialog
      title="结算"
      submitLabel={seatedCount > 0 ? "一键离桌并结算" : "去结算"}
      saving={saving}
      saveFailed={saveFailed}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <p role="status" className={balanced ? "text-win" : "text-highlight"}>
        {balanced ? "水上下平衡" : `水上下不平衡，差额 ${formatDifference(balanceChips, cash)}`}
      </p>
      {seatedCount > 0 && (
        <p className="text-sm text-muted">
          还有 {seatedCount}{" "}
          人在桌，一键离桌会按当前筹码记录，之后可以点「回桌」或「一键回桌」回到牌桌。
        </p>
      )}
      {pendingInsurance > 0 && (
        <p role="alert" className="text-sm text-highlight">
          还有 {pendingInsurance} 笔保险没有记录开奖结果。
        </p>
      )}
      {!balanced && (
        <div>
          <ImbalanceOptions
            differenceChips={balanceChips}
            cash={cash}
            value={handling}
            disabled={saving}
            onChange={(next) => {
              setIssue(undefined);
              setHandling(next);
            }}
          />
          {issue && <p className="mt-1 text-sm text-highlight">{issue}</p>}
        </div>
      )}
    </FormDialog>
  );
}
