import {
  type Charge,
  chipsToCents,
  type Game,
  INSURANCE_PLAYER_ID,
  type LedgerEvent,
  ledgerTotals,
  type PlayerLedger,
  RAKE_PLAYER_ID,
  timerElapsedMs,
} from "@holdem-knight/core";
import { organizerNameOf } from "@/data";
import { t } from "@/i18n";
import { gameRuleLines } from "@/lib/charges";
import { formatSignedChips } from "@/lib/chips";
import { formatGameAmount } from "@/lib/currency";
import type {
  ImageCard,
  ImageHeader,
  ImageLine,
  ImageRecord,
  ImageSeat,
} from "@/lib/settlement-image";
import { netTone } from "@/lib/tone";
import { buyInRecordOf, RECORD_ACTIONS, type RecordRow, timeOf } from "./BuyInRecord";
import { buyInBigBlinds, gameOptions } from "./GameOptions";
import { formatStart } from "./GameTiles";
import { formatElapsed } from "./GameTimer";
import { type ResultCard, type ResultLine, summaryItems } from "./ResultCards";
import { imbalanceChoices } from "./SettlementSummary";

/**
 * What the settlement image shows, read from the same places the settlement page reads it, so the
 * two say the same thing: the page's components draw it in the browser, and the image on a canvas.
 */

/** The top of the settlement page: the title lines, the opened settings, the host and the boxes. */
export function imageHeader(
  game: Game,
  ledger: readonly PlayerLedger[],
  charges: readonly Charge[],
  difference: number,
): ImageHeader {
  const { smallBlindChips, bigBlindChips, handChips, chipRatio, currency, timer } = game;
  const cash = (chips: number) => formatGameAmount(chipsToCents(chips, chipRatio), currency);
  const people = ledger.filter(
    (p) => p.playerId !== INSURANCE_PLAYER_ID && p.playerId !== RAKE_PLAYER_ID,
  );
  const { boughtChips } = ledgerTotals(people);
  const handling = imbalanceChoices(game, difference).find(
    ([choice]) => choice === game.imbalanceHandling,
  )?.[1];
  return {
    title: `${smallBlindChips} / ${bigBlindChips}`,
    currency,
    blindsCash: `${cash(smallBlindChips)}/${cash(bigBlindChips)}`,
    buyIn: handChips === undefined ? undefined : `${buyInBigBlinds(handChips, bigBlindChips)}BB`,
    options: gameOptions(game),
    rules: gameRuleLines(game, charges, currency),
    host: organizerNameOf(game),
    start: formatStart(game.createdAt),
    handling: difference === 0 ? undefined : handling,
    buyInLabel: t.game.gameTiles.totalBuyIn(
      handChips === undefined ? "" : ` · ${boughtChips / handChips}`,
    ),
    buyInTotal: cash(boughtChips),
    lengthLabel: t.game.settlementSummary.length,
    length: timer ? formatElapsed(timerElapsedMs(timer, game.settledAt ?? Date.now())) : "—",
    balance:
      difference === 0
        ? { balanced: true, text: t.game.gameTiles.chipBalance }
        : {
            balanced: false,
            label: t.game.gameTiles.notBalanced,
            figure: `${difference > 0 ? t.game.gameTiles.over : t.game.gameTiles.short} ${cash(Math.abs(difference))}`,
          },
  };
}

/** A player's whole Buy-in record, as the opened record on their card lists it. */
export function imageRecord(
  game: Pick<Game, "handChips" | "chipRatio" | "currency">,
  events: readonly LedgerEvent[],
  playerId: string,
): ImageRecord {
  const { handChips, chipRatio, currency } = game;
  const { rows, held, left, timesBought } = buyInRecordOf(game, events, playerId);
  const cash = (chips: number) => formatGameAmount(chipsToCents(chips, chipRatio), currency);
  const hands = handChips === undefined ? "—" : String(held / handChips);
  const out: RecordRow[] = left
    ? [{ id: "out", action: "out", at: left.at, ...(handChips !== undefined && { total: hands }) }]
    : [];
  const all = [...rows, ...out];
  return {
    times: `${t.game.buyInRecord.timesBefore}${timesBought}${t.game.buyInRecord.timesAfter}`,
    boughtIn: t.game.buyInRecord.boughtIn,
    hands,
    chips: held.toLocaleString("zh-CN"),
    cash: cash(held),
    rows: all.map((row, index) => {
      const [text, tone] = RECORD_ACTIONS[row.action];
      const day = new Date(row.at).getDate();
      const previous = all[index - 1];
      const sameDay = previous !== undefined && day === new Date(previous.at).getDate();
      return {
        day: sameDay ? "" : t.game.buyInRecord.dayOfMonth(day),
        time: timeOf(row.at),
        action: { text, tone },
        moved: row.moved,
        total: row.total,
        ...(row.action === "out" &&
          left && { chips: left.chips.toLocaleString("zh-CN"), cash: cash(left.chips) }),
      };
    }),
  };
}

/** A line under a card's row, as `Line` shows it. */
function imageLine({ label, amount, tone, note, waiver }: ResultLine, game: Game): ImageLine {
  const off = waiver?.waived === true;
  return {
    label,
    // A line switched off with nothing to show leaves its figures blank rather than a dash
    value:
      amount === undefined
        ? off
          ? ""
          : "—"
        : formatGameAmount(amount, game.currency, amount === 0 ? "auto" : "exceptZero"),
    tone: off || tone === "charge" ? "muted" : "highlight",
    struck: off,
    note: note === true,
    ticked: waiver && !off,
  };
}

/** One person's card, with the seats and the record the page draws from components. */
export function imageCard(
  card: ResultCard,
  game: Game,
  parts: { readonly seats?: readonly ImageSeat[]; readonly record?: ImageRecord | undefined } = {},
): ImageCard {
  const { currency } = game;
  const { netChips, base, total } = card;
  const summary = summaryItems(card, currency).map(({ group, value, tone }) => ({
    text: `${group} ${value}`,
    tone: tone === "charge" ? ("muted" as const) : ("highlight" as const),
  }));
  return {
    name: card.name,
    hands: card.hands,
    chips: card.chips,
    net:
      netChips === undefined
        ? { text: "—", tone: "muted" }
        : { text: formatSignedChips(netChips), tone: netTone(netChips) },
    amount:
      base === undefined
        ? { text: "—", tone: "muted" }
        : { text: formatGameAmount(base, currency, "exceptZero"), tone: netTone(base) },
    seats: parts.seats ?? [],
    // With no items the row over the line already shows the result, unless it has none from chips
    summary:
      (card.lines.length === 0 && card.record === undefined) ||
      (summary.length === 0 && base !== undefined)
        ? undefined
        : summary,
    record: parts.record,
    lines: card.lines.map((line) => imageLine(line, game)),
    total: { text: formatGameAmount(total, currency, "exceptZero"), tone: netTone(total) },
  };
}
