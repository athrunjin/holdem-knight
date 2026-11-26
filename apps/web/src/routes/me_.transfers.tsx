import {
  type Currency,
  cents,
  type Game,
  type GameSummary,
  type PartyTransfers,
  PERIOD_CHOICES,
  type PeriodChoice,
  type Player,
  periodOf,
  type TransferReport,
  type TransferState,
  transferReport,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { InfoButton } from "@/components/InfoButton";
import { Page } from "@/components/Page";
import { TextMenu } from "@/components/TextMenu";
import {
  Confirm,
  FoldedSection,
  keyOf,
  Line,
  linesOf,
  type Money,
  PartyRow,
  useTransferDraft,
} from "@/components/transfers/TransferRows";
import { useGames } from "@/data/games";
import { usePlayers } from "@/data/players";
import { useGameSummaries } from "@/data/summaries";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";
import { dayOf } from "@/lib/game-day";
import { useListReturn } from "@/lib/list-return";
import { QuietMotion, useCountUp, useQuietArrival } from "@/lib/motion";
import { periodName } from "@/lib/period-names";
import { libraryNameOf, libraryNameText } from "@/lib/player-name";
import {
  currenciesOf,
  currencyShown,
  parseTransfersView,
  TRANSFERS_VIEW_FALLBACK,
  TRANSFERS_VIEW_KEY,
  type TransfersView,
} from "@/lib/report-views";
import { useStoredState } from "@/lib/stored-state";

export const Route = createFileRoute("/me_/transfers")({
  component: TransfersPage,
});

const cardClass = "rounded-2xl border border-line bg-surface";

const CURRENCY_NAMES: Record<Currency, string> = {
  CNY: t.gamePages.list.panda,
  AUD: t.gamePages.list.kangaroo,
};

function TransfersPage() {
  const { data: summaries, isError, refetch } = useGameSummaries();
  const { data: games } = useGames();
  const { data: players } = usePlayers();

  return (
    <Page
      title={t.me.transfers.title}
      titleNote={
        <InfoButton title={t.me.transfers.title} small>
          <p className="text-sm text-muted">{t.me.transfers.explain}</p>
        </InfoButton>
      }
      actions={
        <Link
          to="/me"
          aria-label={t.me.income.back}
          className="grid min-h-11 shrink-0 place-items-center"
        >
          {/* The emblem, as on the settlement page */}
          <img src="/emblem-on-dark.svg" alt="" className="h-12 w-auto" />
        </Link>
      }
    >
      {isError ? (
        <div role="alert" className={cn(cardClass, "p-5")}>
          <p className="text-sm">{t.me.transfers.unread}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 min-h-11 rounded-xl border border-line px-5 font-medium"
          >
            {t.common.retry}
          </button>
        </div>
      ) : summaries === undefined ? (
        // While the games are read, the total's place stays empty for a moment
        <section className={cn(cardClass, "min-h-28")} />
      ) : summaries.length === 0 ? (
        <p className={cn(cardClass, "p-5 text-sm text-muted")}>{t.me.transfers.noneYet}</p>
      ) : (
        <Transfers summaries={summaries} games={games ?? []} players={players ?? []} />
      )}
    </Page>
  );
}

function Transfers({
  summaries,
  games,
  players,
}: {
  summaries: readonly GameSummary[];
  games: readonly Game[];
  players: readonly Player[];
}) {
  const today = dayOf(Date.now());
  // Come back to from a game, the page is where it was left and nothing plays in again
  const returning = useListReturn("/me/transfers");
  const quiet = useQuietArrival(returning);
  const [view, setView] = useStoredState<TransfersView>(
    TRANSFERS_VIEW_KEY,
    TRANSFERS_VIEW_FALLBACK,
    parseTransfersView,
  );
  const [betweenOpen, setBetweenOpen] = useState(false);
  const [badOpen, setBadOpen] = useState(false);

  // The currencies there are games in, in the app's own order. Panda points come up first, and
  // the newest game's currency where there are none. The preview on 我的 resolves it the same way
  const currencies = currenciesOf(summaries);
  const newest = summaries.reduce((a, b) => (b.startedAt > a.startedAt ? b : a));
  // There is at least one game, so there is a currency
  const currency = currencyShown(summaries, view.currency) as Currency;
  const { done, period } = view;
  const state: TransferState = done ? "done" : "open";

  const open = transferReport(summaries, { currency, state: "open" });
  const madeIn = (choice: PeriodChoice) =>
    transferReport(summaries, { currency, state: "done" }, periodOf(choice, today));
  const made = madeIn(period);
  const report = done ? made : open;
  // Set down as not coming in for now: under everything else, folded, and in no total above
  const bad = transferReport(summaries, { currency, state: "bad" });

  const money: Money = (value) => formatGameMoney(value, currency);
  // Across games there is no order of sitting down: namesakes read with their numbers (ADR 0043)
  const nameOf = libraryNameOf(players, newest);
  const playKey = [done, period, currency].join();
  const { draft, disabled } = useTransferDraft(games, summaries);

  const partyRows = (parties: readonly PartyTransfers[], of: TransferState) =>
    parties.map((party, index) => (
      <PartyRow
        key={party.partyId + of + playKey}
        party={party}
        name={nameOf(party.partyId).name}
        number={nameOf(party.partyId).number}
        // A seat of the game, such as insurance, has no page of its own
        isPlayer={players.some(({ id }) => id === party.partyId)}
        state={of}
        today={today}
        index={index}
        playKey={playKey}
        money={money}
        draft={draft}
        disabled={disabled}
      />
    ));

  return (
    <QuietMotion value={quiet}>
      <div className="pb-8">
        <section className={cn(cardClass, "px-4 pt-1 pb-3")}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center text-sm">
              {/* Each with the number of transfers behind it */}
              <TextMenu
                label={t.me.transfers.status}
                options={[
                  { value: "open", label: `${t.me.transfers.open} (${linesOf(open)})` },
                  { value: "made", label: `${t.me.transfers.made} (${linesOf(made)})` },
                ]}
                value={done ? "made" : "open"}
                onChange={(value) => setView({ ...view, currency, done: value === "made" })}
                className="font-medium"
              />
              {done && (
                <>
                  <span className="mx-1.5 text-muted" aria-hidden>
                    ·
                  </span>
                  <TextMenu
                    label={t.me.income.period}
                    options={PERIOD_CHOICES.map((choice) => ({
                      value: choice,
                      label: `${periodName(choice, today)} (${
                        choice === period ? linesOf(made) : linesOf(madeIn(choice))
                      })`,
                    }))}
                    value={period}
                    onChange={(choice) => setView({ ...view, currency, period: choice })}
                    className="font-medium"
                  />
                </>
              )}
            </div>
            {currencies.length > 1 && (
              <TextMenu
                label={t.me.income.currency}
                options={currencies.map((c) => ({
                  value: c,
                  name: CURRENCY_NAMES[c],
                  label: <CurrencyIcon currency={c} className="size-5" />,
                }))}
                value={currency}
                onChange={(c) => setView({ ...view, currency: c })}
                align="right"
              />
            )}
          </div>
          <Totals report={report} done={done} money={money} playKey={playKey} />
        </section>

        {report.parties.length === 0 && report.between.length === 0 ? (
          <p className="px-1 py-4 text-sm text-muted">
            {done ? t.me.transfers.noneMade : t.me.transfers.noneOpen}
          </p>
        ) : (
          <ul className="mt-3">{partyRows(report.parties, state)}</ul>
        )}

        {/* The organizer is no part of these, so they are kept out of the way and of the totals */}
        {report.between.length > 0 && (
          <FoldedSection
            title={t.me.transfers.between}
            note={t.me.transfers.betweenCount(report.between.length)}
            open={betweenOpen}
            onToggle={() => setBetweenOpen(!betweenOpen)}
          >
            <div className="rounded-xl border border-line bg-surface">
              <ul className="px-4">
                {report.between.map((line) => (
                  <Line
                    key={keyOf(line)}
                    line={line}
                    who={t.me.transfers.pays(
                      libraryNameText(nameOf(line.from)),
                      libraryNameText(nameOf(line.to)),
                    )}
                    between
                    today={today}
                    money={money}
                    draft={draft}
                    disabled={disabled}
                  />
                ))}
              </ul>
              <Confirm lines={report.between} state={state} draft={draft} />
            </div>
          </FoldedSection>
        )}

        {/* Last on the page, under the transfers still to make */}
        {!done && bad.parties.length > 0 && (
          <FoldedSection
            title={t.common.badDebt}
            note={`${t.me.transfers.betweenCount(linesOf(bad))} · ${money(bad.toOrganizer)}`}
            tone="loss"
            open={badOpen}
            onToggle={() => setBadOpen(!badOpen)}
          >
            <ul>{partyRows(bad.parties, "bad")}</ul>
          </FoldedSection>
        )}
      </div>
    </QuietMotion>
  );
}

/**
 * What is to come in, as the page's one large figure, and what is to go out under it: or, for the
 * transfers made, what came in and what went out.
 */
function Totals({
  report,
  done,
  money,
  playKey,
}: {
  report: TransferReport;
  done: boolean;
  money: Money;
  playKey: string;
}) {
  const { toOrganizer, fromOrganizer, parties } = report;
  const count = { duration: 800, resetKey: playKey };
  const shown = useCountUp(toOrganizer, count);
  const paying = parties.filter((party) => party.fromOrganizer > 0).length;
  const owing = parties.filter((party) => party.toOrganizer > 0).length;
  // Whole amounts on the way, and the cents only of the amount arrived at
  const figure = shown === toOrganizer ? toOrganizer : cents(Math.round(shown / 100) * 100);

  return (
    <>
      <p className="flex items-baseline gap-2">
        <span className="text-4xl font-semibold tracking-tight tabular-nums">{money(figure)}</span>
        <span className="text-sm text-muted">
          {done ? t.me.transfers.received : t.me.transfers.toCome}
          {owing > 0 && ` · ${t.me.transfers.people(owing)}`}
        </span>
      </p>
      <p className="mt-1 flex min-h-8 items-center gap-2 text-sm">
        <span className="text-muted">{done ? t.me.transfers.paid : t.me.transfers.toPay}</span>
        <span className="tabular-nums">{money(fromOrganizer)}</span>
        {paying > 0 && <span className="text-muted">· {t.me.transfers.people(paying)}</span>}
      </p>
    </>
  );
}
