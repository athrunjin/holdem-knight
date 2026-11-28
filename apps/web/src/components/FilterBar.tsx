import type { Currency } from "@holdem-knight/core";
import { X } from "lucide-react";
import {
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ChipStack } from "@/components/ChipStack";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { TextMenu, type TextMenuOption } from "@/components/TextMenu";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import type { filterChoices } from "@/lib/income-filter";

/** Stands for no value chosen, in a menu chip. */
const ANY = "any";

/** Each currency's name, for a reader: the chips show the marks alone. */
const CURRENCY_NAMES: Record<Currency | "all", string> = {
  all: t.gamePages.list.all,
  CNY: t.gamePages.list.panda,
  AUD: t.gamePages.list.kangaroo,
};

/** The marks a currency choice shows: both, panda points first, for all of them. */
function Marks({ value }: { value: Currency | "all" }) {
  return value === "all" ? (
    <span className="flex items-center gap-0.5">
      <CurrencyIcon currency="CNY" className="size-5 shrink-0" />
      <CurrencyIcon currency="AUD" className="size-5 shrink-0" />
    </span>
  ) : (
    <CurrencyIcon currency={value} className="size-5 shrink-0" />
  );
}

/** One value a menu chip offers. */
export interface MenuValue {
  readonly value: string;
  /** What its line in the list shows */
  readonly label: ReactNode;
  /** What the chip shows while it is chosen, which is also its name for a reader */
  readonly face: string;
}

/** One option a switches chip offers, shown in its own color while it is on. */
export interface SwitchValue {
  readonly value: string;
  readonly label: string;
  /** Its color while on */
  readonly className: string;
}

/** What stands after the divider, in order. */
export type FilterChip =
  | {
      readonly kind: "menu";
      readonly label: string;
      /** Missing, or one not offered, for none chosen */
      readonly value: string | undefined;
      readonly values: readonly MenuValue[];
      readonly onChange: (value: string | undefined) => void;
    }
  | {
      readonly kind: "toggle";
      readonly label: string;
      readonly on: boolean;
      readonly onChange: (on: boolean) => void;
    }
  | {
      readonly kind: "multi";
      readonly label: string;
      readonly values: readonly SwitchValue[];
      readonly on: readonly string[];
      /** With the values on, in the order offered */
      readonly onChange: (on: readonly string[]) => void;
    };

interface FilterBarProps {
  /** Missing where the bar narrows by something else than the currency */
  currency?: {
    readonly value: Currency | "all";
    readonly options: readonly (Currency | "all")[];
    /** Called only for another currency than the one in force */
    readonly onChange: (value: Currency | "all") => void;
  };
  /** After the divider, in order */
  filters: readonly FilterChip[];
  /** A second row of chips under the first, with 清除 at its right end, where one row cannot hold them all */
  secondRow?: readonly FilterChip[];
  /** Puts every filter after the divider back to how it starts. Shown while any of them is on */
  onClear?: () => void;
  /** Which edge of the currency chip its list hangs from: the right one at the right end of a line */
  align?: "left" | "right";
  className?: string;
}

const chip =
  "h-9 gap-1 rounded-lg border bg-surface px-3 text-sm whitespace-nowrap transition-colors duration-200 ease-out";
const quiet = "border-line font-normal text-muted";
const lit = "border-highlight font-medium text-text tabular-nums";

const isOn = (filter: FilterChip) =>
  filter.kind === "menu"
    ? filter.values.some(({ value }) => value === filter.value)
    : filter.kind === "toggle"
      ? filter.on
      : filter.on.length < filter.values.length;

function CurrencyChip({
  currency,
  align = "left",
}: {
  currency: NonNullable<FilterBarProps["currency"]>;
  align?: "left" | "right" | undefined;
}) {
  return (
    <div className="shrink-0">
      <TextMenu<Currency | "all">
        align={align}
        label={t.me.income.currency}
        options={currency.options.map((value) => ({
          value,
          name: CURRENCY_NAMES[value],
          label: <Marks value={value} />,
        }))}
        value={currency.value}
        // Picking the currency in force changes nothing
        onChange={(value) => value !== currency.value && currency.onChange(value)}
        floating
        faceClassName={cn(chip, "border-line text-text")}
      />
    </div>
  );
}

function MenuChip({ filter }: { filter: Extract<FilterChip, { kind: "menu" }> }) {
  // One kept but no longer offered counts as none
  const chosen = filter.values.find(({ value }) => value === filter.value);
  const options: TextMenuOption<string>[] = [
    { value: ANY, label: t.me.income.any, chosen: filter.label },
    ...filter.values.map(({ value, label, face }) => ({ value, label, name: face, chosen: face })),
  ];
  return (
    <div className="shrink-0">
      <TextMenu
        label={filter.label}
        options={options}
        value={chosen?.value ?? ANY}
        valueName={chosen ? chosen.face : t.me.income.any}
        onChange={(value) => filter.onChange(value === ANY ? undefined : value)}
        floating
        faceClassName={cn(chip, chosen ? lit : quiet)}
      />
    </div>
  );
}

function ToggleChip({ filter }: { filter: Extract<FilterChip, { kind: "toggle" }> }) {
  return (
    <button
      type="button"
      aria-pressed={filter.on}
      onClick={() => filter.onChange(!filter.on)}
      className="group flex min-h-11 shrink-0 items-center focus-visible:outline-none"
    >
      <span
        className={cn(
          "flex items-center group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-highlight",
          chip,
          "gap-1.5",
          filter.on ? lit : quiet,
        )}
      >
        {/* Filled while on, so the color is not the only sign */}
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            filter.on ? "bg-highlight" : "border border-muted",
          )}
          aria-hidden
        />
        {filter.label}
      </span>
    </button>
  );
}

function MultiChip({ filter }: { filter: Extract<FilterChip, { kind: "multi" }> }) {
  const all = filter.values.length;
  const count = filter.values.filter(({ value }) => filter.on.includes(value)).length;
  const some = count < all;
  return (
    <div className="shrink-0">
      <TextMenu
        label={filter.label}
        options={filter.values.map(({ value, label, className }) => {
          const on = filter.on.includes(value);
          return {
            value,
            name: label,
            // On in its own color, off gray and struck through
            label: (
              <span className={on ? cn("font-medium", className) : "text-muted line-through"}>
                {label}
              </span>
            ),
          };
        })}
        value={undefined}
        placeholder={some ? t.ui.filterBar.optionsOn(count, all) : filter.label}
        valueName={some ? `${count}/${all}` : t.gamePages.list.all}
        checked={filter.on}
        onChange={(picked) =>
          // Kept in the order offered, whatever order they were switched in
          filter.onChange(
            filter.values
              .map(({ value }) => value)
              .filter((value) =>
                value === picked ? !filter.on.includes(value) : filter.on.includes(value),
              ),
          )
        }
        floating
        faceClassName={cn(chip, some ? lit : quiet)}
      />
    </div>
  );
}

/** What a chip stands at, so a change to any of them can be told after it is drawn. */
const stateOf = (filter: FilterChip) =>
  filter.kind === "menu"
    ? (filter.value ?? "")
    : filter.kind === "toggle"
      ? String(filter.on)
      : filter.on.join(",");

/** How far a chip's face stays from the row's ends, and from 清除: its focus ring's room. */
const RING = 4;

/** The order currencies are listed in on every page: all of them, then panda points, then kangaroo. */
export const CURRENCY_ORDER: readonly (Currency | "all")[] = ["all", "CNY", "AUD"];

const inOrder = (options: readonly (Currency | "all")[]) =>
  [...options].sort((a, b) => CURRENCY_ORDER.indexOf(a) - CURRENCY_ORDER.indexOf(b));

/** One row's scroller: it scrolls sideways where its chips do not fit, and the page does not. */
const scrollerClass =
  "-mx-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * What narrows the cards or the list under it: the currency as its mark, a divider, then each
 * filter as a chip, gold-edged while it narrows. Every choice counts at once. On one line, where
 * the chips do not fit, the row scrolls sideways, and 清除 stays at its right end while any filter
 * after the divider is on. With a second row, that row holds its own chips and 清除 at its right
 * end, in its flow; both rows are always there, so nothing under the bar moves. The chip last used,
 * or taken to by Tab, is scrolled into view, clear of 清除.
 */
export function FilterBar({
  currency,
  filters,
  secondRow,
  onClear,
  align,
  className,
}: FilterBarProps) {
  const group = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLDivElement>(null);
  const second = useRef<HTMLDivElement>(null);
  const clear = useRef<HTMLDivElement>(null);
  const two = secondRow !== undefined;
  const clearing = onClear !== undefined && [...filters, ...(secondRow ?? [])].some(isOn);
  // 清除 over the end of a single row takes room the row's last chip is scrolled clear of
  const overlay = clearing && !two;
  const [clearWidth, setClearWidth] = useState(0);
  // The chip last tapped or focused, to keep in view as the row changes
  const touched = useRef<HTMLElement | null>(null);
  // 清除 shown as the bar comes up stands there already; it plays in only after a choice
  const clearAtStart = useRef(clearing);

  // Measured as drawn, and again as its words change width
  useLayoutEffect(() => {
    if (!clearing) clearAtStart.current = false;
    if (!overlay) {
      setClearWidth(0);
      return;
    }
    const block = clear.current;
    if (!block) return;
    const measure = () => setClearWidth(Math.ceil(block.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(block);
    return () => observer.disconnect();
  }, [clearing, overlay]);

  /** Scrolls the chip's row, and only that row, so the chip stands clear of its ends and of 清除. */
  const reveal = useCallback(
    (chip: HTMLElement) => {
      const scroller = chip.closest<HTMLElement>("[data-row]");
      if (!scroller) return;
      const bounds = scroller.getBoundingClientRect();
      const face = chip.getBoundingClientRect();
      const start = bounds.left + RING;
      const block = overlay ? clear.current?.getBoundingClientRect() : undefined;
      const end = (block ? block.left : bounds.right) - RING;
      let delta = 0;
      if (face.right > end) delta = face.right - end;
      // Its start is never pushed out of sight, however wide it is
      if (face.left - delta < start) delta = face.left - start;
      if (delta !== 0) scroller.scrollLeft += delta > 0 ? Math.ceil(delta) : Math.floor(delta);
    },
    [overlay],
  );

  const states = [...filters, ...(secondRow ?? [])].map(stateOf).join("|");
  // After a choice, the chip used; on arrival, the last chip that narrows, row by row
  // biome-ignore lint/correctness/useExhaustiveDependencies: run again as the chips or 清除 change
  useLayoutEffect(() => {
    for (const scroller of [first.current, second.current]) {
      if (!scroller) continue;
      const used = touched.current;
      if (used && scroller.contains(used)) {
        reveal(used);
        continue;
      }
      // A chip in use in the other row leaves this one where it is
      if (used && group.current?.contains(used)) continue;
      const lit = scroller.querySelectorAll<HTMLElement>("[data-lit]");
      const last = lit[lit.length - 1];
      if (last) reveal(last);
    }
  }, [states, clearWidth, reveal]);

  const chipOf = (target: EventTarget) =>
    target instanceof Element ? target.closest<HTMLElement>("[data-chip]") : null;

  // Notes which chip is in use, and keeps a chip taken to by Tab in view
  const tracking = {
    onPointerDown: (event: PointerEvent) => {
      touched.current = chipOf(event.target);
    },
    onFocus: (event: FocusEvent) => {
      const chip = chipOf(event.target);
      if (!chip) return;
      touched.current = chip;
      // After whatever the browser scrolls on its own for focus
      requestAnimationFrame(() => reveal(chip));
    },
  };

  const chipsOf = (row: readonly FilterChip[]) =>
    row.map((filter) => {
      const on = isOn(filter);
      return (
        <div key={filter.label} data-chip="" data-lit={on ? "" : undefined} className="shrink-0">
          {filter.kind === "menu" ? (
            <MenuChip filter={filter} />
          ) : filter.kind === "toggle" ? (
            <ToggleChip filter={filter} />
          ) : (
            <MultiChip filter={filter} />
          )}
        </div>
      );
    });

  const clearButton = clearing && (
    <div
      ref={clear}
      className={cn(
        "flex items-center bg-bg pl-2",
        overlay ? "absolute inset-y-0 -right-1 pr-1" : "shrink-0",
        !clearAtStart.current && "animate-appear",
      )}
    >
      <button
        type="button"
        aria-label={t.ui.filterBar.clearFilters}
        onClick={() => {
          onClear();
          // Its own place goes, so focus goes back to the start of the bar
          group.current?.querySelector("button")?.focus();
        }}
        className="flex min-h-11 items-center gap-1 px-1 text-sm whitespace-nowrap text-muted"
      >
        <X className="size-4" aria-hidden />
        {t.ui.filterBar.clear}
      </button>
    </div>
  );

  const firstRow = (
    <div ref={first} data-row="" className={scrollerClass} {...tracking}>
      {currency && (
        <div data-chip="" className="shrink-0">
          <CurrencyChip
            currency={{ ...currency, options: inOrder(currency.options) }}
            align={align}
          />
        </div>
      )}
      {currency && filters.length > 0 && <span className="h-5 w-px shrink-0 bg-line" aria-hidden />}
      {chipsOf(filters)}
      {/* Room for the last chip to be scrolled clear of 清除: its width, less the row's end and the gap */}
      {clearWidth > 0 && (
        <span
          className="h-px shrink-0"
          style={{ width: Math.max(0, clearWidth - 2 * RING) }}
          aria-hidden
        />
      )}
    </div>
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset does not lay its chips out in a row
    <div
      ref={group}
      role="group"
      aria-label={t.me.income.filter}
      className={cn(
        two ? "flex min-w-0 flex-col" : "relative flex min-h-11 min-w-0 items-center",
        className,
      )}
    >
      {two ? (
        <>
          {/* Each row 44px, both always there */}
          <div className="flex h-11 min-w-0 items-center">{firstRow}</div>
          <div className="flex h-11 min-w-0 items-center">
            <div ref={second} data-row="" className={scrollerClass} {...tracking}>
              {chipsOf(secondRow)}
            </div>
            {/* At the row's right end, in its flow; its place stays empty while nothing is on */}
            {clearButton}
          </div>
        </>
      ) : (
        <>
          {firstRow}
          {clearButton}
        </>
      )}
    </div>
  );
}

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

type Choices = ReturnType<typeof filterChoices>;

/** The ratio chip: the ratios on offer in the currency, each as chips to one point. */
export function ratioChip(
  choices: Choices,
  value: string | undefined,
  currency: Currency | "all",
  onChange: (value: string | undefined) => void,
): FilterChip {
  return {
    kind: "menu",
    label: t.me.income.ratio,
    value,
    values: choices.ratios.map(({ value: ratio, chips }) => ({
      value: ratio,
      face: `${chips} : 1`,
      label: currency === "all" ? `${chips} : 1` : <Ratio chips={chips} currency={currency} />,
    })),
    onChange,
  };
}

/** The blinds chip: the blinds on offer in the currency. */
export function blindsChip(
  choices: Choices,
  value: string | undefined,
  onChange: (value: string | undefined) => void,
): FilterChip {
  return {
    kind: "menu",
    label: t.me.income.blinds,
    value,
    values: choices.blinds.map(({ value: blinds, name }) => ({
      value: blinds,
      face: name,
      label: <span className="tabular-nums">{name}</span>,
    })),
    onChange,
  };
}
