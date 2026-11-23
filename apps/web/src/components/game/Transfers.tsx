import { type Game, isTransferDone, type Transfer } from "@holdem-knight/core";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Share2 } from "lucide-react";
import { useState } from "react";
import { type TransferPlan, TransferPlanPicker } from "@/components/game/TransferPlanPicker";
import { Modal } from "@/components/insurance/Modal";
import { t } from "@/i18n";
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
  /** Opened from 收益, which the line at the foot then leads back to */
  fromIncome?: boolean;
  /** While an image is being made. */
  sharing: boolean;
  /** Shares the image of one transfer's payer, or of the whole game when none is named. */
  onShare: (transfer?: Transfer) => void;
  onChoosePlan: (collectorId: string | undefined) => void;
  /** Marks transfers as made, or as not made again. Only called once the results are confirmed. */
  onMark: (transfers: readonly Transfer[], done: boolean) => void;
  /** Takes a tap on a tick before the results are confirmed. */
  onUnsettled: () => void;
}

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
  fromIncome = false,
  sharing,
  onShare,
  onChoosePlan,
  onMark,
  onUnsettled,
}: TransfersProps) {
  const [locked, setLocked] = useState(false);
  const { currency } = game;
  const settled = game.status === "settled";
  const made = settled ? transfers.filter((t) => isTransferDone(game, t)) : [];
  const allDone = transfers.length > 0 && made.length === transfers.length;
  const close = () => setLocked(false);

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
            onLocked={() => setLocked(true)}
            onChange={onChoosePlan}
          />
        </div>
        {transfers.length > 0 && (
          <>
            <ShareButton
              label={t.game.transfers.shareAllTransfers}
              disabled={sharing}
              onClick={() => onShare()}
            />
            <DoneButton
              label={t.game.transfers.allReceived}
              done={allDone}
              disabled={disabled}
              onClick={() => mark(transfers, !allDone)}
            />
          </>
        )}
      </div>

      {transfers.length === 0 ? (
        <p className="border-t border-line py-2 pl-0.5 text-sm text-muted">
          {t.game.transfers.nobodyWonOrLostSoThere}
        </p>
      ) : (
        <ul className="border-t border-line">
          {transfers.map((transfer) => {
            const { from, to, amount } = transfer;
            const done = made.includes(transfer);
            const pair = t.game.transfers.pays(nameOf(from), nameOf(to));
            const struck = done && "text-muted line-through";
            return (
              <li
                key={`${from}-${to}`}
                className="flex min-h-11 items-center gap-1.5 pl-0.5 text-sm"
              >
                <span className={cn("min-w-0 truncate font-medium", struck)}>{nameOf(from)}</span>
                <ArrowRight
                  className="size-3.5 shrink-0 text-muted"
                  aria-label={t.game.transfers.pays2}
                />
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
                  <ShareButton
                    label={t.game.transfers.share(pair)}
                    disabled={sharing}
                    onClick={() => onShare(transfer)}
                  />
                  <DoneButton
                    label={t.game.transfers.done(pair)}
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
            t.game.transfers.inAllReceived(transfers.length, made.length, transfers.length)}
        </p>
        {/* A game opened from 收益 leads back there */}
        <Link
          to={fromIncome ? "/me/income" : "/"}
          className="flex min-h-11 shrink-0 items-center text-xs text-highlight"
        >
          {fromIncome ? t.game.transfers.backToIncome : t.game.transfers.backToTheMainView}
        </Link>
      </div>

      {locked && (
        <Modal title={t.game.transfers.cantSwitchPlans} onClose={close}>
          <p className="text-sm text-muted">{t.game.transfers.someTransfersAreMarkedDoneUntick}</p>
          <button
            type="button"
            onClick={close}
            className="mt-3 min-h-11 w-full rounded-xl border border-line font-medium"
          >
            {t.common.close}
          </button>
        </Modal>
      )}
    </div>
  );
}

function ShareButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-end pr-1.5 text-muted disabled:opacity-60"
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
