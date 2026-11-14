import { type Game, isTransferDone, type Transfer } from "@holdem-knight/core";
import { Link } from "@tanstack/react-router";
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
  /** Marks transfers as made, or as not made again. Only called once the results are confirmed. */
  onMark: (transfers: readonly Transfer[], done: boolean) => void;
  /** Takes a tap on a tick before the results are confirmed. */
  onUnsettled: () => void;
}

type Notice = "share" | "locked";

const NOTICE_TITLE: Record<Notice, string> = {
  share: "分享转账",
  locked: "不能切换方案",
};

/**
 * The transfers of the chosen plan, set out like a bill. The line over them names the plan, and
 * each transfer can be shared and ticked off once made; the line's own tick marks them all, or
 * none when all are marked. The line under them counts what has come in and leads back to the
 * games list. Until the results are confirmed nothing can be ticked: the transfers may still
 * change.
 */
export function Transfers({
  game,
  transfers,
  plans,
  collectorId,
  nameOf,
  disabled,
  onChoosePlan,
  onMark,
  onUnsettled,
}: TransfersProps) {
  const [notice, setNotice] = useState<Notice>();
  const { currency } = game;
  const settled = game.status === "settled";
  const made = settled ? transfers.filter((t) => isTransferDone(game, t)) : [];
  const allDone = transfers.length > 0 && made.length === transfers.length;
  const close = () => setNotice(undefined);

  const mark = (marked: readonly Transfer[], done: boolean) =>
    settled ? onMark(marked, done) : onUnsettled();

  return (
    <div>
      {/* The plan leads the line. Its two buttons line up with those of the rows under it */}
      <div className="flex items-center pl-0.5">
        <div className="flex min-w-0 flex-1">
          <TransferPlanPicker
            plans={plans}
            collectorId={collectorId}
            disabled={disabled}
            // A plan with a transfer already made stays: another plan would ask for it again
            locked={made.length > 0}
            onLocked={() => setNotice("locked")}
            onChange={onChoosePlan}
          />
        </div>
        {transfers.length > 0 && (
          <>
            <ShareButton label="分享全部转账" onClick={() => setNotice("share")} />
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
        <p className="border-t border-line py-2 pl-0.5 text-sm text-muted">
          没有输赢，不需要转账。
        </p>
      ) : (
        <ul className="border-t border-line">
          {transfers.map((transfer) => {
            const { from, to, amount } = transfer;
            const done = made.includes(transfer);
            const pair = `${nameOf(from)} 转给 ${nameOf(to)}`;
            const struck = done && "text-muted line-through";
            return (
              <li
                key={`${from}-${to}`}
                className="flex min-h-11 items-center gap-1.5 pl-0.5 text-sm"
              >
                <span className={cn("min-w-0 truncate font-medium", struck)}>{nameOf(from)}</span>
                <ArrowRight className="size-3.5 shrink-0 text-muted" aria-label="转给" />
                <span className={cn("min-w-0 truncate font-medium", struck)}>{nameOf(to)}</span>
                <span
                  className={cn(
                    "ml-auto shrink-0 pl-1 font-semibold whitespace-nowrap",
                    struck || "text-highlight",
                  )}
                >
                  {formatGameMoney(amount, currency)}
                </span>
                <div className="-ml-1.5 flex shrink-0">
                  <ShareButton label={`分享 ${pair}`} onClick={() => setNotice("share")} />
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

      <div className="flex min-h-11 items-center justify-between gap-3 border-t border-line pt-1.5 pl-0.5">
        <p className="min-w-0 text-xs text-muted">
          {transfers.length > 0 &&
            `共 ${transfers.length} 笔（已收 ${made.length} / ${transfers.length}）`}
        </p>
        <Link to="/" className="flex min-h-11 shrink-0 items-center text-xs text-highlight">
          返回主界面
        </Link>
      </div>

      {notice && (
        <Modal title={NOTICE_TITLE[notice]} onClose={close}>
          {notice === "share" && <p className="text-sm text-muted">这个功能还在开发中。</p>}
          {notice === "locked" && (
            <p className="text-sm text-muted">存在已完成的转账。取消勾选后才能切换方案。</p>
          )}
          <button
            type="button"
            onClick={close}
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
      className="flex size-11 shrink-0 items-center justify-end pr-1.5 text-muted"
    >
      <Share2 className="size-4" strokeWidth={1.75} aria-hidden />
    </button>
  );
}

/**
 * A box that is empty until ticked. It sits close to the share icon before it and ends level with
 * the page's content: each keeps a 44px target, this one reaching into the page's margin.
 */
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
      className="-mr-4 flex size-11 shrink-0 items-center pl-1.5"
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
