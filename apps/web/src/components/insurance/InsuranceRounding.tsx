import { formatRakeNumber, type InsuranceRuleForm, RAKE_ROUNDINGS } from "@holdem-knight/core";
import { useState } from "react";
import {
  chipsText,
  FigureInput,
  figureTitleClass,
  Mark,
  SMALLEST_CHIP_PICKS,
} from "@/components/game/SetupFigures";
import { InfoButton } from "@/components/InfoButton";
import { MiniSwitch } from "@/components/MiniSwitch";
import { TextMenu } from "@/components/TextMenu";
import { t } from "@/i18n";
import { RAKE_ROUNDING_NAMES } from "@/lib/charges";
import { cn } from "@/lib/cn";

const ROUNDING_OPTIONS = RAKE_ROUNDINGS.map((mode) => ({
  value: mode,
  label: RAKE_ROUNDING_NAMES[mode],
}));

const ROUNDING_INFO = [
  t.insurance.insuranceRounding.thePremiumIsPayoutOddsAnd,
  t.insurance.insuranceRounding.roundHalfAChipOrMore,
  t.insurance.insuranceRounding.roundDownThePartIsDropped,
  t.insurance.insuranceRounding.roundUpAnyPartGoesUp,
  t.insurance.insuranceRounding.thePremiumIsAtLeastOne,
  t.insurance.insuranceRounding.withRoundingOffWholeChipsAre,
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
      <span className={figureTitleClass(form.roundOn)}>
        {t.insurance.insuranceRounding.rounding}
      </span>
      <MiniSwitch
        label={t.insurance.insuranceRounding.rounding}
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
        label={t.insurance.insuranceRounding.smallestChipChips}
        value={form.roundChips ?? ""}
        onChange={(roundChips) => onChange({ roundChips })}
        tidy={chipsText}
        invalid={invalid}
        wholeNumber
      />
      <TextMenu
        label={t.insurance.insuranceRounding.quickSmallestChip}
        options={SMALLEST_CHIP_PICKS}
        value={SMALLEST_CHIP_PICKS.find((pick) => pick.value === form.roundChips?.trim())?.value}
        onChange={(roundChips) => onChange({ roundChips })}
        align="right"
        className="pr-0.5 text-sm"
      />
    </>
  );
}

const modeMenu = ({ form, onChange }: Pick<RoundingProps, "form" | "onChange">) => (
  <TextMenu
    label={t.insurance.insuranceRounding.leftover}
    options={ROUNDING_OPTIONS}
    value={form.roundMode}
    onChange={(roundMode) => onChange({ roundMode })}
    align="right"
    className="pr-0.5 text-sm font-medium"
  />
);

const modeCaption = (
  <>
    <InfoButton title={t.insurance.insuranceRounding.leftover} text={ROUNDING_INFO} inline />
    {t.insurance.insuranceRounding.leftover2}
  </>
);

/**
 * Rounding insurance prices to the smallest chip (ADR 0037), in little room: `RoundingSwitch` ends
 * the cover limits line, and this line holds the smallest chip and how what is left over rounds,
 * wrapping only where the screen is too narrow for both. At a game the smallest chip is kept in
 * small blinds and shown in chips too, and typing chips sets the small blinds. In the tools it is
 * in chips, with common ones a tap away.
 */
export function InsuranceRoundingLine({ form, stakes, invalid, onChange }: RoundingProps) {
  if (!form.roundOn) return null;
  const caption = "mr-1 flex items-center text-xs whitespace-nowrap text-muted";
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-1">
      <span className="flex items-center font-medium">
        <span className={caption}>{t.insurance.insuranceRounding.smallestChip}</span>
        {stakes ? (
          <BlindFigures
            smallBlinds={form.roundSmallBlinds}
            smallBlindChips={stakes.smallBlindChips}
            invalid={invalid}
            onChange={(roundSmallBlinds) => onChange({ roundSmallBlinds })}
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
 * The smallest chip at a game: small blinds ⇔ chips, as rake's rows read, each figure only as wide
 * as its digits so the line fits a phone's card. The chips need no mark after the ⇔. The small
 * blinds are kept; chips typed are turned into small blinds, so the smallest chip follows the blinds.
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

  return (
    <span className="contents font-medium">
      <FigureInput
        label={t.insurance.insuranceRounding.smallestChipSb}
        value={smallBlinds}
        minChars={1}
        onChange={onChange}
        invalid={invalid}
      />
      <Mark>SB</Mark>
      <span className="grid w-5 shrink-0 place-items-center font-normal text-muted">
        <span aria-hidden className="text-xl leading-none">
          ⇔
        </span>
        <span className="sr-only">{t.common.equals}</span>
      </span>
      <FigureInput
        label={t.insurance.insuranceRounding.smallestChipChips}
        value={draft ?? chips}
        onChange={typeChips}
        onBlur={() => setDraft(null)}
        tidy={chipsText}
        disabled={!smallBlindChips}
        wholeNumber
        minChars={1}
      />
    </span>
  );
}
