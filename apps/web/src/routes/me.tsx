import {
  type Currency,
  cents,
  daysBetween,
  type GameSummary,
  INCOME_ITEMS,
  type IncomeReport,
  incomeReport,
  periodOf,
  transferReport,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type RefObject, useEffect, useRef, useState } from "react";
import { AccountCard } from "@/components/account/AccountCard";
import { IdentityHeader } from "@/components/account/Identity";
import { BackupSection } from "@/components/BackupSection";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { InDevelopment } from "@/components/InDevelopment";
import {
  CollectedBar,
  IncomeRing,
  ITEM_FILLS,
  ITEM_NAMES,
  LOSS_FILL,
  type Money,
  PLAY_MS,
  runningFigure,
} from "@/components/income/IncomeParts";
import { Page } from "@/components/Page";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { RoleSwitch, useRole } from "@/components/RoleSwitch";
import { TextMenu } from "@/components/TextMenu";
import { LATE_DAYS, linesOf } from "@/components/transfers/TransferRows";
import { usePlayers } from "@/data/players";
import { useSession } from "@/data/session";
import { useGameSummaries } from "@/data/summaries";
import { LANGUAGES, type LanguageChoice, languageChoice, setLanguageChoice, t } from "@/i18n";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";
import { dayOf } from "@/lib/game-day";
import { QuietMotion, useCountUp, usePlaysIn } from "@/lib/motion";
import { periodName } from "@/lib/period-names";
import { libraryNameOf } from "@/lib/player-name";

export const Route = createFileRoute("/me")({
  component: MePage,
});

const cardClass = "rounded-2xl border border-line bg-surface";

/**
 * A card's title line, as on 收益 and 转账: a muted name, `·`, then what it is of. With the
 * currency its figures are in, that currency's mark follows, muted: a mark only, not a control.
 */
function TitleLine({ name, of, currency }: { name: string; of: string; currency?: Currency }) {
  return (
    <p className="flex min-h-11 min-w-0 items-center text-sm">
      <span className="shrink-0 text-muted">{name}</span>
      <span className="mx-1.5 text-muted" aria-hidden>
        ·
      </span>
      <span className="truncate font-medium">{of}</span>
      {currency && <CurrencyIcon currency={currency} className="ml-2 size-4.5 text-muted" />}
    </p>
  );
}

const newestOf = (summaries: readonly GameSummary[]) =>
  summaries.reduce((a, b) => (b.startedAt > a.startedAt ? b : a));

/** Stands in for a figure while the summaries are read: about as wide as one usually is */
const FIGURE = "00,000";

/**
 * The income card's own structure with nothing in it, while the summaries are read: its title
 * line, the headline, the ring's row and the collected line, so nothing moves when it arrives.
 */
function IncomePlaceholder({ className }: { className: string }) {
  return (
    <section className={cn(className, "invisible")} aria-hidden>
      <TitleLine name={t.me.income.due} of={FIGURE} />
      <p className="text-4xl font-semibold tracking-tight tabular-nums">{FIGURE}</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="size-24 shrink-0" />
        <ul className="flex min-w-0 flex-1 flex-col gap-1">
          {INCOME_ITEMS.map((item) => (
            <li key={item} className="min-h-6 text-sm" />
          ))}
        </ul>
      </div>
      <div className="mt-3 h-2" />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-sm">
        <p className="flex min-h-11 items-center gap-2 whitespace-nowrap">
          {t.me.income.received} {FIGURE}
        </p>
        <p className="flex min-h-11 items-center gap-2 whitespace-nowrap">
          {t.me.income.unreceived} {FIGURE} · {t.me.income.unreceivedGames(10)}
        </p>
      </div>
    </section>
  );
}

/**
 * What this month brought in, as 收益 opens on it before anything is chosen: panda points where
 * any game has them, otherwise the newest game's currency, all four kinds and no other filter.
 * The whole card leads to 收益.
 */
function IncomePreview({
  summaries,
  onPlayed,
}: {
  summaries: readonly GameSummary[] | undefined;
  onPlayed: () => void;
}) {
  const today = dayOf(Date.now());
  const thisMonth = periodName("thisMonth", today);
  const card = cn(cardClass, "block px-4 pt-1 pb-3");

  // While the games are read, the card keeps its height empty
  if (summaries === undefined) return <IncomePlaceholder className={card} />;
  if (summaries.length === 0) {
    return (
      <Link to="/me/income" className={card}>
        <TitleLine name={t.me.income.due} of={thisMonth} />
        <p className="pb-2 text-sm text-muted">{t.me.income.noneYet}</p>
      </Link>
    );
  }

  const currency = summaries.some((s) => s.currency === "CNY")
    ? "CNY"
    : newestOf(summaries).currency;
  const report = incomeReport(
    summaries.filter((s) => s.currency === currency),
    { currency, items: INCOME_ITEMS },
    periodOf("thisMonth", today),
  );

  return (
    <Link to="/me/income" className={card}>
      <TitleLine
        name={t.me.income.due}
        of={`${thisMonth} (${report.games.length})`}
        currency={currency}
      />
      <IncomeFigures
        report={report}
        money={(value) => formatGameMoney(value, currency)}
        playKey={`thisMonth${currency}`}
        onPlayed={onPlayed}
      />
    </Link>
  );
}

/** The total, the ring with the four kinds beside it as plain text, and what is in of it. */
function IncomeFigures({
  report,
  money,
  playKey,
  onPlayed,
}: {
  report: IncomeReport;
  money: Money;
  playKey: string;
  onPlayed: () => void;
}) {
  const { total, byItem, gamesByItem } = report;
  const figure = runningFigure(money);
  const playsIn = usePlaysIn(playKey);
  const totalShown = useCountUp(total, { duration: PLAY_MS, resetKey: playKey });
  // Once it has shown, it is there at once when the role is switched away and back
  useEffect(() => {
    onPlayed();
  }, [onPlayed]);

  return (
    <>
      <p
        className={cn(
          "text-4xl font-semibold tracking-tight tabular-nums",
          total < 0 && "text-loss",
        )}
      >
        {figure(totalShown, total)}
      </p>
      <div className="mt-3 flex items-center gap-4">
        <IncomeRing report={report} items={INCOME_ITEMS} playKey={playKey} size="sm" />
        <ul aria-label={t.me.income.items} className="flex min-w-0 flex-1 flex-col gap-1">
          {INCOME_ITEMS.map((item, index) => {
            const amount = byItem[item];
            // A kind none of the games had is struck out, as on 收益
            const there = gamesByItem[item] > 0;
            const fill = amount < 0 ? LOSS_FILL : ITEM_FILLS[item];
            return (
              <li
                key={item + playKey}
                className={cn(
                  "flex min-h-6 items-center gap-1.5 text-sm",
                  playsIn && "animate-settle",
                )}
                style={{ animationDelay: `${150 + index * 200}ms` }}
              >
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    there ? fill.dot : "border border-muted",
                  )}
                  aria-hidden
                />
                <span
                  className={cn("min-w-0 flex-1 truncate", !there && "text-muted line-through")}
                >
                  {ITEM_NAMES[item]}
                </span>
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    !there ? "text-muted line-through" : amount < 0 && "text-loss",
                  )}
                >
                  {money(amount)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <CollectedBar report={report} playKey={playKey} money={money} />
    </>
  );
}

/** How many of the people owing the most the card lists */
const SHOWN_PARTIES = 3;

/**
 * The transfers card's own structure with nothing in it, while the summaries are read: its title
 * line, the line of what is to come in and to go out, and the rows of the people owing the most.
 */
function TransfersPlaceholder({ className }: { className: string }) {
  return (
    <section className={cn(className, "invisible")} aria-hidden>
      <TitleLine name={t.me.transfers.title} of={t.me.transfers.open} />
      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight tabular-nums">{FIGURE}</span>
          <span className="text-sm whitespace-nowrap">
            {t.me.transfers.toCome} · {t.me.transfers.people(10)}
          </span>
        </span>
        <span className="text-sm whitespace-nowrap">
          {t.me.transfers.toPay} {FIGURE}
        </span>
      </p>
      {/* The rows of the people owing the most, 44px each */}
      <div className="mt-2" style={{ height: `${SHOWN_PARTIES * 2.75}rem` }} />
    </section>
  );
}

/**
 * The transfers still to make, as 转账 opens on them before anything is chosen: in the newest
 * game's currency, with what is to come in, what is to go out, and the people owing the most.
 * The whole card leads to 转账, so nothing inside it is a target of its own.
 */
function TransfersPreview({ summaries }: { summaries: readonly GameSummary[] | undefined }) {
  const { data: players = [] } = usePlayers();
  const card = cn(cardClass, "mt-3 block px-4 pt-1 pb-3");

  if (summaries === undefined) return <TransfersPlaceholder className={card} />;
  if (summaries.length === 0) {
    return (
      <Link to="/me/transfers" className={card}>
        <TitleLine name={t.me.transfers.title} of={t.me.transfers.open} />
        <p className="pb-2 text-sm text-muted">{t.me.transfers.noneYet}</p>
      </Link>
    );
  }

  const today = dayOf(Date.now());
  const newest = newestOf(summaries);
  const { currency } = newest;
  const open = transferReport(summaries, { currency, state: "open" });
  const money = (value: number) => formatGameMoney(cents(value), currency);
  const nameOf = libraryNameOf(players, newest);
  const owing = open.parties.filter((party) => party.toOrganizer > 0).length;
  const owed = open.parties.filter((party) => party.net > 0).slice(0, SHOWN_PARTIES);
  const empty = open.parties.length === 0 && open.between.length === 0;

  return (
    <Link to="/me/transfers" className={card}>
      <TitleLine
        name={t.me.transfers.title}
        of={`${t.me.transfers.open} (${linesOf(open)})`}
        currency={currency}
      />
      {empty ? (
        <p className="pb-2 text-sm text-muted">{t.me.transfers.noneOpen}</p>
      ) : (
        <>
          {/* What is to go out gives way to the next line before anything else does */}
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-4xl font-semibold tracking-tight tabular-nums",
                  open.toOrganizer > 0 && "text-highlight",
                )}
              >
                {money(open.toOrganizer)}
              </span>
              <span className="text-sm whitespace-nowrap text-muted">
                {t.me.transfers.toCome}
                {owing > 0 && ` · ${t.me.transfers.people(owing)}`}
              </span>
            </span>
            <span className="text-sm whitespace-nowrap">
              <span className="text-muted">{t.me.transfers.toPay}</span>
              <span className="ml-2 tabular-nums">{money(open.fromOrganizer)}</span>
            </span>
          </p>
          {owed.length > 0 && (
            <ul className="mt-2">
              {owed.map((party) => {
                const { name, number } = nameOf(party.partyId);
                const late = daysBetween(party.oldestDay, today) > LATE_DAYS;
                return (
                  <li key={party.partyId} className="flex min-h-11 items-center gap-3">
                    {/* A seat of the game, such as insurance, has no avatar, as on 转账 */}
                    {players.some(({ id }) => id === party.partyId) && (
                      <PlayerAvatar id={party.partyId} name={name} size="sm" />
                    )}
                    {/* The name gives way before the number does */}
                    <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                      <span className="truncate font-medium">{name}</span>
                      {number !== undefined && (
                        <span className="shrink-0 text-xs text-muted tabular-nums">{number}</span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "flex shrink-0 items-baseline gap-1.5",
                        late ? "text-loss" : "text-highlight",
                      )}
                    >
                      {late && <span className="text-xs">{t.me.transfers.overdue}</span>}
                      <span className="font-medium tabular-nums">{money(Math.abs(party.net))}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Link>
  );
}

/**
 * The language of the interface: the device's, or one picked here, which takes effect at once and
 * is kept in this browser. Each language is listed under its own name, so it can be found by
 * someone who cannot read the one in use.
 */
function LanguageRow() {
  const options = [
    { value: "device" as LanguageChoice, label: t.me.language.device },
    ...Object.entries(LANGUAGES).map(([value, { name }]) => ({
      value: value as LanguageChoice,
      label: name,
    })),
  ];

  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4">
      <p className="shrink-0 font-medium">{t.me.language.title}</p>
      <TextMenu
        label={t.me.language.title}
        options={options}
        value={languageChoice}
        onChange={setLanguageChoice}
        align="right"
        className="min-h-11"
      />
    </div>
  );
}

/** The language and the backups, as rows of one card. */
function SettingsList({ account }: { account: boolean }) {
  return (
    <section className={cn(cardClass, "mt-3")}>
      <LanguageRow />
      <BackupSection account={account} />
    </section>
  );
}

/** Until a player is chosen as oneself, there is nothing of one's own to show. */
function PlayerFace() {
  return (
    <section className={cn(cardClass, "flex flex-col items-start gap-3 p-4")}>
      <p className="text-sm text-muted">{t.me.playerFace.empty}</p>
      <InDevelopment milestone="M6" />
    </section>
  );
}

/**
 * The previews of 收益 and 转账. The income card plays in once on arriving at 我的; switched away
 * to the player's face and back, it is there at once.
 */
function HostFace({ played }: { played: RefObject<boolean> }) {
  const { data: summaries } = useGameSummaries();
  const [quiet] = useState(() => played.current);

  return (
    <QuietMotion value={quiet}>
      <IncomePreview
        summaries={summaries}
        onPlayed={() => {
          played.current = true;
        }}
      />
      <TransfersPreview summaries={summaries} />
    </QuietMotion>
  );
}

function MePage() {
  const session = useSession();
  const [role, setRole] = useRole();
  const played = useRef(false);

  return (
    <Page
      title={t.me.title}
      heading={
        <div className="flex items-center justify-between">
          <IdentityHeader />
          <RoleSwitch role={role} onChange={setRole} />
        </div>
      }
    >
      {role === "host" ? <HostFace played={played} /> : <PlayerFace />}
      <SettingsList account={session.status === "signed-in"} />
      {session.status === "signed-in" && (
        <div className="mt-3">
          <AccountCard userId={session.userId} email={session.email} />
        </div>
      )}
      <p className="mt-6 text-center text-xs text-muted">{t.me.version(__APP_VERSION__)}</p>
    </Page>
  );
}
