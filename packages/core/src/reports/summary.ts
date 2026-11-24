/**
 * A game settled in one place: the settlement page shows what `settleBooks` works out, and a
 * settled game's summary keeps it for reports, so the two never differ (ADR 0049).
 */
import {
  applyCharges,
  type Charge,
  type ChargeClock,
  chargeStatuses,
  chargesFrom,
  type PlayerChargeStatus,
} from "../charges";
import {
  type Game,
  type GameSummary,
  INSURANCE_PLAYER_ID,
  type LedgerEvent,
  RAKE_PLAYER_ID,
  type SummaryPlayer,
  type Transfer,
} from "../domain";
import { timerElapsedMs } from "../game";
import { type PlayerLedger, summarizeByPlayer } from "../ledger";
import { type Cents, cents, sum, ZERO } from "../money";
import {
  attributeInsurance,
  attributeRake,
  isTransferDone,
  ORGANIZER_COLLECTOR,
  type PlayerNet,
  planTransfers,
  type SettlementOutcome,
  settlementOutcome,
  transferCollector,
  transferDoneAt,
} from "../settlement";

export interface SettledBooks {
  readonly ledger: readonly PlayerLedger[];
  /** Each charged player's time at the table and what it comes to. Empty with no charges. */
  readonly statuses: readonly PlayerChargeStatus[];
  /** Table fees and wages, the waived ones among them and marked. */
  readonly charges: readonly Charge[];
  /** Each seat's result from the chips alone, before a difference is handled. */
  readonly chipNets: readonly PlayerNet[];
  /** The results once the difference is handled the game's way, with every seat still its own. */
  readonly outcome: SettlementOutcome;
  /** Who takes the insurance result, or `INSURANCE_PLAYER_ID` where it stays on its own row. */
  readonly insuranceOwnerId: string;
  /** Who the charges go to. */
  readonly chargeRecipientId: string;
  /** What everyone receives or pays in the end: insurance, rake and charges with whoever takes them. */
  readonly nets: readonly PlayerNet[];
  /** Who collects, or `undefined` for the plan with the fewest transfers. */
  readonly collectorId: string | undefined;
  readonly transfers: readonly Transfer[];
}

/** One person's result in a list, 0 for someone not in it. */
export function netOf(list: readonly PlayerNet[], playerId: string): Cents {
  return list.find((p) => p.playerId === playerId)?.net ?? ZERO;
}

/**
 * Settles a game from its ledger: the chips in cash, the difference handled as the game says, the
 * insurance and the rake with whoever takes them, the charges, and the transfers of its plan.
 */
export function settleBooks(
  game: Game,
  events: readonly LedgerEvent[],
  clock: ChargeClock,
): SettledBooks {
  const ledger = summarizeByPlayer(events);
  // Table fees and wages come last, in cash, so they never touch the chip results
  const statuses = game.tableFee || game.wage ? chargeStatuses(game, events, clock) : [];
  const charges = chargesFrom(game, statuses);
  const outcome = settlementOutcome(ledger, game.chipRatio, game.imbalanceHandling, {
    insuranceInSplit: game.insuranceInSplit === true,
    rakeInSplit: game.rakeInSplit === true,
  });
  const chipNets = settlementOutcome(ledger, game.chipRatio, undefined).nets;
  const insured = attributeInsurance(outcome.nets, game.insuranceOwner);
  // The rake is always the organizer's, as a share of the results like insurance
  const charged = applyCharges(attributeRake(insured.nets), charges);
  return {
    ledger,
    statuses,
    charges,
    chipNets,
    outcome,
    insuranceOwnerId: insured.ownerId,
    chargeRecipientId: charged.recipientId,
    nets: charged.nets,
    collectorId: transferCollector(game, charged.nets),
    transfers: planTransfers(game, charged.nets),
  };
}

/** Raised when the way summaries are worked out changes, so the ones kept are made again. */
const SUMMARY_VERSION = 1;

/**
 * What of a settled game its summary depends on, besides the ledger, which a settled game no
 * longer adds to: when it was settled, its transfer plan and the transfers marked as made.
 * Anything else can only change once the results are opened again, which clears the time.
 */
export function summaryBasis(
  game: Pick<Game, "settledAt" | "collectorId" | "doneTransfers">,
): string {
  const done = (game.doneTransfers ?? [])
    .map(({ from, to, amount }) => `${from}>${to}:${amount}`)
    .toSorted();
  return JSON.stringify([SUMMARY_VERSION, game.settledAt ?? null, game.collectorId ?? null, done]);
}

/** Whether a game's kept summary still says what the game does. */
export function isSummaryCurrent(game: Game, summary: GameSummary | undefined): boolean {
  return summary !== undefined && summary.basis === summaryBasis(game);
}

export interface SummaryContext {
  /** Open sessions end at `now`: the time the game was settled. */
  readonly clock: ChargeClock;
  /** The day the game started where it was played, as `2026-11-21`. */
  readonly day: string;
}

/** The summary of a settled game. The time it was settled is the clock's for a game without one. */
export function gameSummary(
  game: Game,
  events: readonly LedgerEvent[],
  { clock, day }: SummaryContext,
): GameSummary {
  const books = settleBooks(game, events, clock);
  const { ledger, charges, chipNets, outcome, insuranceOwnerId, transfers, collectorId } = books;
  const settledAt = game.settledAt ?? clock.now;
  const covering = game.imbalanceHandling === "organizer";
  const due = charges.filter((c) => !c.waived);
  const paid = (kind: Charge["kind"], playerId?: string) =>
    sum(
      due
        .filter((c) => c.kind === kind && (playerId === undefined || c.playerId === playerId))
        .map((c) => c.amount),
    );
  const insuranceNet = netOf(outcome.nets, INSURANCE_PLAYER_ID);
  const receives = books.chargeRecipientId === ORGANIZER_COLLECTOR;

  const players = ledger
    .filter((p) => p.playerId !== INSURANCE_PLAYER_ID && p.playerId !== RAKE_PLAYER_ID)
    .map((p): SummaryPlayer => {
      const { playerId, boughtChips, cashedOutChips } = p;
      const host = playerId === ORGANIZER_COLLECTOR;
      const chipNet = netOf(chipNets, playerId);
      // A difference the organizer takes on is not part of their play
      const share = host && covering ? ZERO : cents(netOf(outcome.nets, playerId) - chipNet);
      const insurance = !host && playerId === insuranceOwnerId ? insuranceNet : ZERO;
      const wage = paid("wage", playerId);
      const tableFee = paid("table_fee", playerId);
      return {
        playerId,
        boughtChips,
        cashedOutChips,
        chipNet,
        share,
        insurance,
        wage,
        tableFee,
        total: cents(chipNet + share + insurance - wage - tableFee),
      };
    });

  const hasInsurance = ledger.some((p) => p.playerId === INSURANCE_PLAYER_ID);
  return {
    id: game.id,
    organizerId: game.organizerId,
    // The game's own, so a game that never kept its time is not made again on every read
    basis: summaryBasis(game),
    startedAt: game.createdAt,
    day,
    settledAt,
    ...(game.timer && { playedMs: timerElapsedMs(game.timer, settledAt) }),
    currency: game.currency,
    chipRatio: game.chipRatio,
    smallBlindChips: game.smallBlindChips,
    bigBlindChips: game.bigBlindChips,
    playerCount: players.length,
    income: {
      rake: netOf(outcome.nets, RAKE_PLAYER_ID),
      insurance: insuranceOwnerId === ORGANIZER_COLLECTOR ? insuranceNet : ZERO,
      wage: receives ? paid("wage") : ZERO,
      tableFee: receives ? paid("table_fee") : ZERO,
    },
    ...(hasInsurance && { insuranceOwnerId }),
    difference: outcome.difference,
    ...(game.imbalanceHandling && { imbalanceHandling: game.imbalanceHandling }),
    absorbed: covering ? cents(-outcome.difference) : ZERO,
    players,
    ...(collectorId !== undefined && { collectorId }),
    transfers: transfers.map((transfer) => {
      const doneAt = transferDoneAt(game, transfer);
      return {
        ...transfer,
        done: isTransferDone(game, transfer),
        ...(doneAt !== undefined && { doneAt }),
      };
    }),
  };
}
