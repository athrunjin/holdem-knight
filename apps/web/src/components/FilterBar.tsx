import type { Currency } from "@holdem-knight/core";
import { X } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
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

/** The marks a currency choice shows: both, in the app's order, for all of them. */
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
  filters: readonly FilterChip[];
  /** Puts every filter after the divider back to how it starts. Shown while any of them is on */
  onClear?: () => void;
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

function CurrencyChip({ currency }: { currency: NonNullable<FilterBarProps["currency"]> }) {
  return (
    <div className="shrink-0">
      <TextMenu<Currency | "all">
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

/**
 * What narrows the cards or the list under it, on one line: the currency as its mark, a divider,
 * then each filter as a chip, gold-edged while it narrows. Every choice counts at once. Where the
 * chips do not fit, the row scrolls sideways, and 清除 stays at its right end while any filter
 * after the divider is on.
 */
export function FilterBar({ currency, filters, onClear, className }: FilterBarProps) {
  const group = useRef<HTMLDivElement>(null);
  const clear = useRef<HTMLDivElement>(null);
  const clearing = onClear !== undefined && filters.some(isOn);
  const [clearWidth, setClearWidth] = useState(0);
  useLayoutEffect(() => {
    setClearWidth(clearing ? (clear.current?.offsetWidth ?? 0) : 0);
  }, [clearing]);

  const chips = filters.map((filter) =>
    filter.kind === "menu" ? (
      <MenuChip key={filter.label} filter={filter} />
    ) : filter.kind === "toggle" ? (
      <ToggleChip key={filter.label} filter={filter} />
    ) : (
      <MultiChip key={filter.label} filter={filter} />
    ),
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset does not lay its chips out in a row
    <div
      ref={group}
      role="group"
      aria-label={t.me.income.filter}
      className={cn("relative flex min-h-11 min-w-0 items-center", className)}
    >
      {/* Reaching 4px past the bar on each side, so a chip's focus ring is not cut off */}
      <div
        className="-mx-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        // A chip taken to by Tab stops clear of 清除
        style={{ scrollPaddingRight: clearWidth }}
      >
        {currency && <CurrencyChip currency={currency} />}
        {currency && filters.length > 0 && (
          <span className="h-5 w-px shrink-0 bg-line" aria-hidden />
        )}
        {chips}
        {/* Room for the last chip to be scrolled clear of 清除 */}
        {clearWidth > 0 && (
          <span className="h-px shrink-0" style={{ width: clearWidth - 12 }} aria-hidden />
        )}
      </div>
      {clearing && (
        <div
          ref={clear}
          className="absolute inset-y-0 -right-1 flex animate-appear items-center bg-bg pr-1 pl-2"
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
