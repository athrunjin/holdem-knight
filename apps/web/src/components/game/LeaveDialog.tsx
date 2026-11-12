import {
  type ChargeWaiver,
  cents,
  chargeStatuses,
  chargesFrom,
  chipsToCents,
  type Game,
  type LedgerEvent,
  summarizeByPlayer,
} from "@holdem-knight/core";
import { type FormEvent, useState } from "react";
import { gameMinuteOfDay } from "@/lib/charges";
import { BuyInRecord } from "./BuyInRecord";
import { chargeLines } from "./chargeLines";
import { FormDialog } from "./FormDialog";
import { Card, ColumnTitles } from "./ResultCards";

interface LeaveDialogProps {
  game: Game;
  events: readonly LedgerEvent[];
  playerId: string;
  name: string;
  saving: boolean;
  saveFailed: boolean;
  /** Lets the player off a charge, or charges it again, as on the settlement page. */
  onWaive: (key: ChargeWaiver, waived: boolean) => void;
  /** `leftAt` is when the dialog opened, so the charges shown are the charges made. */
  onSubmit: (chips: number, leftAt: number) => void;
  onClose: () => void;
}

/**
 * A player's result before they leave the table, as their card on the settlement page: chips and
 * cash, their Buy-in record, the time sat with the wages and table fee it comes to, and the total.
 * The Buy-ins and chips are the ones on the game page, which is where they are changed. The charges
 * are worked out once, for the moment the dialog opened, and stay still while it is open. Closing
 * it without leaving changes nothing, so the time goes on counting.
 */
export function LeaveDialog({
  game,
  events,
  playerId,
  name,
  saving,
  saveFailed,
  onWaive,
  onSubmit,
  onClose,
}: LeaveDialogProps) {
  const { handChips, chipRatio: ratio, currency } = game;
  const [openedAt] = useState(Date.now);
  const player = summarizeByPlayer(events).find((p) => p.playerId === playerId);
  const boughtChips = player?.boughtChips ?? 0;
  const chips = player?.stackChips ?? 0;
  const net = chips + (player?.cashedOutChips ?? 0) - boughtChips;
  const cash = chipsToCents(net, ratio);

  // Charged as of the moment the dialog opened, which is also when the player is recorded leaving
  const statuses =
    game.tableFee || game.wage
      ? chargeStatuses(game, events, { now: openedAt, minuteOfDay: gameMinuteOfDay(game) })
      : [];
  const charges = chargesFrom(game, statuses);
  const due = charges
    .filter((c) => c.playerId === playerId && !c.waived)
    .reduce((total, c) => total + c.amount, 0);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(chips, openedAt);
  }

  return (
    <FormDialog
      title="结算并下桌"
      submitLabel="确认下桌"
      wide
      saving={saving}
      saveFailed={saveFailed}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <div className="flex flex-col gap-1">
        <ColumnTitles first="玩家" />
        <Card
          currency={currency}
          card={{
            id: playerId,
            name,
            hands: handChips === undefined ? "—" : String(boughtChips / handChips),
            chips: chips.toLocaleString("zh-CN"),
            netChips: net,
            base: cash,
            record: (
              <BuyInRecord
                game={game}
                events={events}
                playerId={playerId}
                leaving={{ chips, at: openedAt }}
              />
            ),
            lines: chargeLines(game, statuses, charges, playerId, { disabled: saving, onWaive }),
            total: cents(cash - due),
          }}
        />
      </div>
    </FormDialog>
  );
}
