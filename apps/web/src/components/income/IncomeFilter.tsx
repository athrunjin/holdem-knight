import type { Currency, GameSummary } from "@holdem-knight/core";
import { ChevronUp } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChipStack } from "@/components/ChipStack";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { TextMenu } from "@/components/TextMenu";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { type IncomeFilter as Filter, filterChoices } from "@/lib/income-filter";

/** How long the panel takes to grow out of the button, and to shrink back into it. */
const GROW_MS = 280;
const ANY = "any";

const CURRENCY_NAMES: Record<Currency, string> = {
  CNY: t.gamePages.list.panda,
  AUD: t.gamePages.list.kangaroo,
};

interface Size {
  readonly width: number;
  readonly height: number;
}

const sizeOf = (element: HTMLElement | null): Size => ({
  width: element?.offsetWidth ?? 0,
  height: element?.offsetHeight ?? 0,
});

/** So many chips for one point, with the marks a new game's ratio has. */
function Ratio({ chips, currency }: { chips: number; currency: Currency }) {
  return (
    <span className="flex items-center gap-1 tabular-nums">
      {chips}
      <ChipStack ground="var(--surface)" className="size-5" />
      <span className="text-muted">=</span>1
      <CurrencyIcon currency={currency} className="size-5 shrink-0" />
    </span>
  );
}

/**
 * The games counted, as a framed button: the currency's mark, then a ratio and blinds where one
 * is chosen. A tap grows it leftward and down into a panel, whose lines show once it has grown:
 * the currency, the ratio, the blinds, and a chevron that puts the panel away. Nothing chosen in
 * the panel counts until that chevron is tapped; a tap anywhere else drops it.
 */
export function IncomeFilter({
  applied,
  currencies,
  games,
  onApply,
}: {
  applied: Filter;
  /** The currencies there are games in */
  currencies: readonly Currency[];
  /** The games of the period shown, which decide the ratios and blinds on offer */
  games: readonly GameSummary[];
  onApply: (filter: Filter) => void;
}) {
  // In the page from the tap that opens the panel until it has shrunk back
  const [draft, setDraft] = useState<Filter>();
  const [grown, setGrown] = useState(false);
  // Grown all the way: the lines show, and the panel takes the size of what is in it
  const [settled, setSettled] = useState(false);
  const [sizes, setSizes] = useState<{ from: Size; to: Size }>();
  const frame = useRef<HTMLSpanElement>(null);
  const lines = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const mounted = draft !== undefined;
  // The panel starts at the button's size, and grows from the next frame on
  useLayoutEffect(() => {
    if (!mounted) return;
    setSizes({ from: sizeOf(frame.current), to: sizeOf(lines.current) });
    const next = requestAnimationFrame(() => {
      setGrown(true);
      timer.current = setTimeout(() => setSettled(true), GROW_MS);
    });
    return () => cancelAnimationFrame(next);
  }, [mounted]);

  function close(filter?: Filter) {
    if (!settled) return;
    if (filter) onApply(filter);
    // Back to a set size first, from which it can shrink
    setSizes({ from: sizeOf(frame.current), to: sizeOf(lines.current) });
    setSettled(false);
    requestAnimationFrame(() => {
      setGrown(false);
      timer.current = setTimeout(() => {
        setDraft(undefined);
        setSizes(undefined);
      }, GROW_MS);
    });
  }

  const shown = draft ?? applied;
  const choices = filterChoices(games, shown.currency);
  const ratio = choices.ratios.find(({ value }) => value === shown.ratio);
  const blinds = choices.blinds.find(({ value }) => value === shown.blinds);
  const size = settled ? undefined : grown ? sizes?.to : sizes?.from;

  // What the button shows, which the panel also shows while it grows and shrinks
  const face = (filter: Filter) => {
    const { ratios, blinds: blindsChoices } = filterChoices(games, filter.currency);
    const chosenRatio = ratios.find(({ value }) => value === filter.ratio);
    const chosenBlinds = blindsChoices.find(({ value }) => value === filter.blinds);
    return (
      <>
        <CurrencyIcon currency={filter.currency} className="size-5 shrink-0" />
        {chosenRatio && <span>{chosenRatio.chips} : 1</span>}
        {chosenBlinds && <span>{chosenBlinds.name}</span>}
      </>
    );
  };
  const faceClass = "flex h-9 items-center gap-2 px-2 text-sm whitespace-nowrap tabular-nums";

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-expanded={draft !== undefined}
        aria-label={t.me.income.filter}
        onClick={() => setDraft(applied)}
        className={cn("flex min-h-11 items-center", draft && "invisible")}
      >
        <span ref={frame} className={cn(faceClass, "rounded-lg border border-line bg-line/40")}>
          {face(applied)}
        </span>
      </button>
      {draft && (
        <>
          {/* A tap anywhere else drops what was chosen */}
          <button
            type="button"
            aria-label={t.ui.textMenu.collapse}
            tabIndex={-1}
            onClick={() => close()}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            className={cn(
              "absolute top-1 right-0 z-20 rounded-lg border border-line bg-surface shadow-lg",
              "transition-[width,height] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none",
              !settled && "overflow-hidden",
            )}
            style={{ ...size, transitionDuration: `${GROW_MS}ms` }}
          >
            {!settled && (
              <span
                className={cn(
                  faceClass,
                  "absolute top-0 right-0 -m-px h-9 border border-transparent",
                )}
              >
                {face(grown ? draft : applied)}
              </span>
            )}
            <div
              ref={lines}
              className={cn(
                "w-max min-w-44 text-sm transition-opacity duration-150",
                settled ? "opacity-100" : "absolute top-0 right-0 opacity-0",
              )}
            >
              <div className="flex min-h-11 items-center justify-between gap-4 pl-3">
                <span className="text-muted">{t.me.income.currency}</span>
                {/* The mark at the end stands over the one the ratio has */}
                <div role="radiogroup" aria-label={t.me.income.currency} className="mr-5 flex">
                  {currencies.map((currency) => {
                    const checked = currency === draft.currency;
                    return (
                      // biome-ignore lint/a11y/useSemanticElements: a button that reads as one of the choices
                      <button
                        key={currency}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        aria-label={CURRENCY_NAMES[currency]}
                        // Another currency has its own ratios and blinds
                        onClick={() => checked || setDraft({ currency })}
                        className="grid size-11 place-items-center"
                      >
                        <span
                          className={cn(
                            "grid size-8 place-items-center rounded-lg",
                            checked ? "bg-line" : "opacity-50",
                          )}
                        >
                          <CurrencyIcon currency={currency} className="size-5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex min-h-11 items-center justify-between gap-4 px-3">
                <span className="text-muted">{t.me.income.ratio}</span>
                <TextMenu
                  label={t.me.income.ratio}
                  options={[
                    { value: ANY, label: t.me.income.any },
                    ...choices.ratios.map(({ value, chips }) => ({
                      value,
                      name: `${chips} : 1`,
                      label: <Ratio chips={chips} currency={draft.currency} />,
                    })),
                  ]}
                  value={ratio?.value ?? ANY}
                  onChange={(value) =>
                    setDraft({ ...draft, ratio: value === ANY ? undefined : value })
                  }
                  align="right"
                />
              </div>
              <div className="flex min-h-11 items-center justify-between gap-4 px-3">
                <span className="text-muted">{t.me.income.blinds}</span>
                <TextMenu
                  label={t.me.income.blinds}
                  options={[
                    { value: ANY, label: t.me.income.any },
                    ...choices.blinds.map(({ value, name }) => ({ value, label: name })),
                  ]}
                  value={blinds?.value ?? ANY}
                  onChange={(value) =>
                    setDraft({ ...draft, blinds: value === ANY ? undefined : value })
                  }
                  align="right"
                  className="tabular-nums"
                />
              </div>
              <button
                type="button"
                aria-label={t.me.income.applyFilter}
                onClick={() =>
                  close({ currency: draft.currency, ratio: ratio?.value, blinds: blinds?.value })
                }
                className="flex min-h-11 w-full items-center justify-center border-t border-line text-muted"
              >
                <ChevronUp className="size-5" aria-hidden />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
