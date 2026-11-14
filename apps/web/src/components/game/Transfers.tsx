import {
  archiveGame,
  cents,
  type Game,
  isTransferDone,
  markTransfers,
  refileGame,
  type Transfer,
  unarchiveGame,
} from "@holdem-knight/core";
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
  /** Saves the game with transfers marked or the game archived. */
  onSave: (game: Game) => void;
}

type Notice = "share" | "locked" | "archive";

const NOTICE_TITLE: Record<Notice, string> = {
  share: "分享转账",
  locked: "不能切换方案",
  archive: "归档牌局",
};

/**
 * The transfers of the chosen plan, set out like a bill. The line over them names the plan, and
 * each transfer can be shared and ticked off once made; the line's own tick marks them all, or
 * none when all are marked. The line under them counts what has come in and files the game away.
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
  const [notice, setNotice] = useState<Notice>();
  const { currency } = game;
  const made = transfers.filter((t) => isTransferDone(game, t));
  // With nothing to transfer there is nothing left to collect either
  const complete = made.length === transfers.length;
  const allDone = complete && transfers.length > 0;
  const amountOf = (list: readonly Transfer[]) =>
    formatGameMoney(cents(list.reduce((sum, t) => sum + t.amount, 0)), currency);
  const filed = `历史对局 - ${complete ? "完成" : "积分待处理"}`;
  const close = () => setNotice(undefined);

  function mark(marked: readonly Transfer[], done: boolean) {
    const next = markTransfers(game, marked, done);
    // An archived game follows its transfers between the two groups of history
    onSave(
      refileGame(
        next,
        transfers.every((t) => isTransferDone(next, t)),
      ),
    );
  }

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
        <p className="pl-0.5 text-sm text-muted">没有输赢，不需要转账。</p>
      ) : (
        <ul>
          {transfers.map((transfer) => {
            const { from, to, amount } = transfer;
            const done = isTransferDone(game, transfer);
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

      <div className="flex min-h-11 items-center justify-between gap-3 pl-0.5">
        <p className="min-w-0 text-xs text-muted">
          {transfers.length > 0 &&
            `共 ${transfers.length} 笔（已收 ${amountOf(made)} / ${amountOf(transfers)}）`}
        </p>
        {game.archive ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSave(unarchiveGame(game))}
            className="min-h-11 shrink-0 rounded-xl border border-line px-3 text-sm font-medium disabled:opacity-60"
          >
            取消归档
          </button>
        ) : (
          // Gray while money is still owed, green once it is all in. Either way it can be tapped
          <button
            type="button"
            disabled={disabled}
            onClick={() => setNotice("archive")}
            className={cn(
              "min-h-11 shrink-0 rounded-xl px-3 text-sm font-semibold disabled:opacity-60",
              complete ? "bg-accent text-accent-text" : "bg-line text-muted",
            )}
          >
            归档牌局
          </button>
        )}
      </div>
      {game.archive && <p className="pl-0.5 text-xs text-muted">已归档至 {filed}</p>}

      {notice && (
        <Modal title={NOTICE_TITLE[notice]} onClose={close}>
          {notice === "share" && <p className="text-sm text-muted">这个功能还在开发中。</p>}
          {notice === "locked" && (
            <p className="text-sm text-muted">存在已完成的转账。取消勾选后才能切换方案。</p>
          )}
          {notice === "archive" && (
            <>
              <p className="text-sm">归档至 {filed}</p>
              {game.status === "open" && (
                <p className="mt-1 text-sm text-muted">这局还没有确认结算，归档时会一并确认。</p>
              )}
              <button
                type="button"
                onClick={() => {
                  close();
                  onSave(archiveGame(game, complete, Date.now()));
                }}
                className="mt-3 min-h-11 w-full rounded-xl bg-accent font-semibold text-accent-text"
              >
                归档
              </button>
            </>
          )}
          <button
            type="button"
            onClick={close}
            className={cn(
              "min-h-11 w-full rounded-xl border border-line font-medium",
              notice === "archive" ? "mt-2" : "mt-3",
            )}
          >
            {notice === "archive" ? "取消" : "关闭"}
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
