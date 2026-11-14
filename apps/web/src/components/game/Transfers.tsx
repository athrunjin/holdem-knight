import { type Game, isTransferDone, markTransfers, type Transfer } from "@holdem-knight/core";
import { ArrowRight, Check, Share2 } from "lucide-react";
import { useState } from "react";
import { type TransferPlan, TransferPlanPicker } from "@/components/game/TransferPlanPicker";
import { Modal } from "@/components/insurance/Modal";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";

interface TransfersProps {
  game: Game;
  transfers: readonly Transfer[];
  plans: readonly TransferPlan[];
  collectorId: string | undefined;
  nameOf: (playerId: string) => string;
  /** While a save is under way. */
  disabled: boolean;
  onChoosePlan: (collectorId: string | undefined) => void;
  /** Saves the game with transfers marked as made, or not made. */
  onSave: (game: Game) => void;
}

/**
 * The transfers of the chosen plan. The line over them names the plan, and each transfer can be
 * shared and ticked off once made. The line's own tick marks them all, or none when all are marked.
 */
export function Transfers({
  game,
  transfers,
  plans,
  collectorId,
  nameOf,
  disabled,
  onChoosePlan,
  onSave,
}: TransfersProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const allDone = transfers.length > 0 && transfers.every((t) => isTransferDone(game, t));
  const mark = (marked: readonly Transfer[], done: boolean) =>
    onSave(markTransfers(game, marked, done));

  return (
    <div>
      {/* The two buttons line up with those of the rows under them, inside the rows' border */}
      <div className="flex items-center pr-px pl-0.5">
        <h3 className="shrink-0 text-sm text-muted">转账方案</h3>
        <div className="ml-auto flex min-w-0 justify-end pl-3">
          <TransferPlanPicker
            plans={plans}
            collectorId={collectorId}
            disabled={disabled}
            onChange={onChoosePlan}
          />
        </div>
        {transfers.length > 0 && (
          <>
            <ShareButton label="分享全部转账" onClick={() => setShareOpen(true)} />
            <DoneButton
              label="全部收到"
              done={allDone}
              disabled={disabled}
              onClick={() => mark(transfers, !allDone)}
            />
          </>
        )}
      </div>

      {transfers.length === 0 ? (
        <p className="text-sm text-muted">没有输赢，不需要转账。</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {transfers.map((transfer) => {
            const { from, to, amount } = transfer;
            const done = isTransferDone(game, transfer);
            const pair = `${nameOf(from)} 转给 ${nameOf(to)}`;
            return (
              <li
                key={`${from}-${to}`}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-surface pl-3 text-sm",
                  done && "text-muted",
                )}
              >
                <span className="min-w-0 truncate font-medium">{nameOf(from)}</span>
                <ArrowRight className="size-3.5 shrink-0 text-muted" aria-label="转给" />
                <span className="min-w-0 truncate font-medium">{nameOf(to)}</span>
                <span
                  className={cn(
                    "ml-auto shrink-0 pl-1 font-semibold whitespace-nowrap",
                    !done && "text-highlight",
                  )}
                >
                  {formatGameMoney(amount, game.currency)}
                </span>
                <div className="-ml-1.5 flex shrink-0">
                  <ShareButton label={`分享 ${pair}`} onClick={() => setShareOpen(true)} />
                  <DoneButton
                    label={`${pair} 已完成`}
                    done={done}
                    disabled={disabled}
                    onClick={() => mark([transfer], !done)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {shareOpen && (
        <Modal title="分享转账" onClose={() => setShareOpen(false)}>
          <p className="text-sm text-muted">这个功能还在开发中。</p>
          <button
            type="button"
            onClick={() => setShareOpen(false)}
            className="mt-3 min-h-11 w-full rounded-xl border border-line font-medium"
          >
            关闭
          </button>
        </Modal>
      )}
    </div>
  );
}

function ShareButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 shrink-0 place-items-center text-muted"
    >
      <Share2 className="size-4" strokeWidth={1.75} aria-hidden />
    </button>
  );
}

/** A box that is empty until ticked, in a 44px target. */
function DoneButton({
  label,
  done,
  disabled,
  onClick,
}: {
  label: string;
  done: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={done}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 shrink-0 place-items-center"
    >
      <span
        className={cn(
          "grid size-5 place-items-center rounded-md border",
          done ? "border-accent bg-accent text-accent-text" : "border-muted",
        )}
      >
        {done && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
      </span>
    </button>
  );
}
