import { formatRakeNumber, type InsuranceRuleForm, RAKE_ROUNDINGS } from "@holdem-knight/core";
import { useState } from "react";
import { ChipStack } from "@/components/ChipStack";
import {
  Caption,
  chipsText,
  FIGURE_GRID,
  FIGURE_TITLE_CELL,
  FigureInput,
  figureTitleClass,
  Join,
  Mark,
} from "@/components/game/SetupFigures";
import { InfoButton } from "@/components/InfoButton";
import { MiniSwitch } from "@/components/MiniSwitch";
import { TextMenu } from "@/components/TextMenu";
import { RAKE_ROUNDING_NAMES } from "@/lib/charges";
import { cn } from "@/lib/cn";

const ROUNDING_OPTIONS = RAKE_ROUNDINGS.map((mode) => ({
  value: mode,
  label: RAKE_ROUNDING_NAMES[mode],
}));

/** Common smallest chips, picked from the chevron where there are no blinds to go by. */
const CHIP_PICKS = ["1", "5", "10", "20"].map((chips) => ({
  value: chips,
  label: chips,
  chosen: <></>,
}));

const ROUNDING_INFO = [
  "保费按「赔付 ÷ 赔率」算出，赔付按「保费 × 赔率」算出。两者不满一个最小筹码面值的零头：",
  "· 四舍五入：满半个面值进一个，不满半个舍去",
  "· 向下取整：零头舍去",
  "· 向上取整：有零头就进一个",
  "保费至少一个最小筹码面值。取整后，保本的赔付可能比本金略少或略多，满池的赔付也可能略超过底池份额。",
  "关闭取整时按整个筹码计：保本、半池的赔付至少够数，满池的赔付不超过底池份额。",
].join("\n");

/** Where the smallest chip is set: in small blinds at a game, or in chips in the tools. */
export type RoundingStakes =
  /** At a game, with its small blind as typed, which may be missing while it is being typed */
  | { readonly smallBlindChips: number | null }
  /** In the tools, with no game to go by */
  | undefined;

/** A small blind count with a decimal or two, as it is kept. */
const blindText = (value: number) => formatRakeNumber(Math.round(value * 100) / 100);

interface RoundingProps {
  form: InsuranceRuleForm;
  stakes: RoundingStakes;
  invalid: boolean;
  onChange: (next: Partial<InsuranceRuleForm>) => void;
}

/** 取整 with its switch, faded and struck through while off. */
export function RoundingSwitch({
  form,
  onChange,
  className,
}: Pick<RoundingProps, "form" | "onChange"> & { className?: string }) {
  return (
    <span className={cn("flex min-h-11 items-center gap-1.5 whitespace-nowrap", className)}>
      <span className={figureTitleClass(form.roundOn)}>取整</span>
      <MiniSwitch
        label="取整"
        hideLabel
        checked={form.roundOn}
        onChange={(roundOn) => onChange({ roundOn })}
      />
    </span>
  );
}

/** The smallest chip in chips, with common ones under the chevron after it, for the tools. */
function ChipFigure({ form, invalid, onChange }: Omit<RoundingProps, "stakes">) {
  return (
    <>
      <FigureInput
        label="最小筹码面值（筹码）"
        value={form.roundChips ?? ""}
        onChange={(roundChips) => onChange({ roundChips })}
        tidy={chipsText}
        invalid={invalid}
        wholeNumber
      />
      <TextMenu
        label="最小筹码面值快速选择"
        options={CHIP_PICKS}
        value={CHIP_PICKS.find((pick) => pick.value === form.roundChips?.trim())?.value}
        onChange={(roundChips) => onChange({ roundChips })}
        align="right"
        className="pr-0.5 text-sm"
      />
    </>
  );
}

const modeMenu = ({ form, onChange }: Pick<RoundingProps, "form" | "onChange">) => (
  <TextMenu
    label="超出部分"
    options={ROUNDING_OPTIONS}
    value={form.roundMode}
    onChange={(roundMode) => onChange({ roundMode })}
    align="right"
    className="pr-0.5 text-sm font-medium"
  />
);

const modeCaption = (
  <>
    <InfoButton title="超出部分" text={ROUNDING_INFO} inline />
    超出部分:
  </>
);

/**
 * Rounding insurance prices to the smallest chip (ADR 0037), laid out at game setup as rake's
 * rounding is: a title with its switch, the smallest chip, and how what is left over rounds, in a
 * grid whose colons and marks line up. At a game the smallest chip is kept in small blinds and
 * shown in chips too, and typing chips sets the small blinds.
 */
export function InsuranceRounding({ form, stakes, invalid, onChange }: RoundingProps) {
  return (
    <div className={FIGURE_GRID}>
      <RoundingSwitch form={form} onChange={onChange} className={FIGURE_TITLE_CELL} />
      {form.roundOn && (
        <>
          <Caption>最小筹码面值:</Caption>
          {stakes ? (
            <BlindFigures
              smallBlinds={form.roundSmallBlinds}
              smallBlindChips={stakes.smallBlindChips}
              invalid={invalid}
              onChange={(roundSmallBlinds) => onChange({ roundSmallBlinds })}
            />
          ) : (
            <span className="col-span-2 col-start-6 flex items-center justify-end font-medium">
              <ChipFigure form={form} invalid={invalid} onChange={onChange} />
            </span>
          )}
          <Caption>{modeCaption}</Caption>
          {/* Its chevron sits under the mark above */}
          <span className="col-span-5 col-start-3 justify-self-end">
            {modeMenu({ form, onChange })}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * The same settings on an insurance page, where they take less room: the switch goes at the end
 * of the cover limits line, and this line holds the smallest chip and how what is left over rounds,
 * wrapping only where the screen is too narrow for both.
 */
export function InsuranceRoundingLine({ form, stakes, invalid, onChange }: RoundingProps) {
  if (!form.roundOn) return null;
  const caption = "mr-1 flex items-center text-xs whitespace-nowrap text-muted";
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2">
      <span className="flex items-center font-medium">
        <span className={caption}>最小筹码面值:</span>
        {stakes ? (
          <BlindFigures
            smallBlinds={form.roundSmallBlinds}
            smallBlindChips={stakes.smallBlindChips}
            invalid={invalid}
            onChange={(roundSmallBlinds) => onChange({ roundSmallBlinds })}
            narrow
          />
        ) : (
          <ChipFigure form={form} invalid={invalid} onChange={onChange} />
        )}
      </span>
      <span className="ml-auto flex items-center">
        <span className={caption}>{modeCaption}</span>
        {modeMenu({ form, onChange })}
      </span>
    </div>
  );
}

/**
 * The smallest chip at a game: small blinds ⇔ chips, as rake's rows read. The small blinds are
 * kept; chips typed are turned into small blinds, so the smallest chip follows the blinds.
 */
function BlindFigures({
  smallBlinds,
  smallBlindChips,
  invalid,
  onChange,
  narrow = false,
}: {
  smallBlinds: string;
  smallBlindChips: number | null;
  invalid: boolean;
  onChange: (smallBlinds: string) => void;
  /** Each figure only as wide as its digits, where room is short */
  narrow?: boolean;
}) {
  // Chips being typed, from which the small blinds are worked out
  const [draft, setDraft] = useState<string | null>(null);
  const typed = Number(smallBlinds);
  const known = smallBlinds.trim() !== "" && Number.isFinite(typed) && typed > 0;
  // As the price works it out: whole chips, and at least 1
  const chips =
    known && smallBlindChips ? String(Math.max(1, Math.round(typed * smallBlindChips))) : "";

  function typeChips(text: string) {
    setDraft(text);
    const value = Number(text);
    if (text.trim() !== "" && smallBlindChips && value > 0) {
      onChange(blindText(value / smallBlindChips));
    }
  }

  // Five cells of the grid: small blinds, their mark, ⇔, chips, and the chip mark
  return (
    <span className="contents font-medium">
      <FigureInput
        label="最小筹码面值（SB）"
        value={smallBlinds}
        {...(narrow && { minChars: 1 })}
        onChange={onChange}
        invalid={invalid}
      />
      <Mark>SB</Mark>
      <Join>
        <span aria-hidden className="text-xl leading-none">
          ⇔
        </span>
        <span className="sr-only">即</span>
      </Join>
      <FigureInput
        label="最小筹码面值（筹码）"
        value={draft ?? chips}
        onChange={typeChips}
        onBlur={() => setDraft(null)}
        tidy={chipsText}
        disabled={!smallBlindChips}
        wholeNumber
        {...(narrow ? { minChars: 1 } : { wide: true })}
      />
      <Mark>
        <ChipStack ground="var(--surface)" className="size-5" />
      </Mark>
    </span>
  );
}
