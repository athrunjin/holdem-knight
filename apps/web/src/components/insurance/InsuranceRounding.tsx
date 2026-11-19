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

/**
 * Rounding insurance prices to the smallest chip (ADR 0037), laid out as rake's rounding is: a
 * title with its switch, the smallest chip, and how what is left over rounds. At a game the
 * smallest chip is kept in small blinds and shown in chips too, and typing chips sets the small
 * blinds. In the tools it is in chips, with common ones a tap away.
 */
export function InsuranceRounding({
  form,
  stakes,
  invalid,
  onChange,
}: {
  form: InsuranceRuleForm;
  stakes: RoundingStakes;
  invalid: boolean;
  onChange: (next: Partial<InsuranceRuleForm>) => void;
}) {
  return (
    <div className={FIGURE_GRID}>
      <span className={FIGURE_TITLE_CELL}>
        <span className={figureTitleClass(form.roundOn)}>取整</span>
        <MiniSwitch
          label="取整"
          hideLabel
          checked={form.roundOn}
          onChange={(roundOn) => onChange({ roundOn })}
        />
      </span>
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
            <span className="contents font-medium">
              <span className="col-start-6">
                <FigureInput
                  label="最小筹码面值（筹码）"
                  value={form.roundChips ?? ""}
                  onChange={(roundChips) => onChange({ roundChips })}
                  tidy={chipsText}
                  invalid={invalid}
                  wholeNumber
                  wide
                />
              </span>
              <span className="justify-self-end">
                <TextMenu
                  label="最小筹码面值快速选择"
                  options={CHIP_PICKS}
                  value={CHIP_PICKS.find((pick) => pick.value === form.roundChips?.trim())?.value}
                  onChange={(roundChips) => onChange({ roundChips })}
                  align="right"
                  className="pr-0.5 text-sm"
                />
              </span>
            </span>
          )}
          <Caption>
            <InfoButton title="超出部分" text={ROUNDING_INFO} inline />
            超出部分:
          </Caption>
          {/* Its chevron sits under the mark above */}
          <span className="col-span-5 col-start-3 justify-self-end">
            <TextMenu
              label="超出部分"
              options={ROUNDING_OPTIONS}
              value={form.roundMode}
              onChange={(roundMode) => onChange({ roundMode })}
              align="right"
              className="pr-0.5 text-sm font-medium"
            />
          </span>
        </>
      )}
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
}: {
  smallBlinds: string;
  smallBlindChips: number | null;
  invalid: boolean;
  onChange: (smallBlinds: string) => void;
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
        wide
      />
      <Mark>
        <ChipStack ground="var(--surface)" className="size-5" />
      </Mark>
    </span>
  );
}
