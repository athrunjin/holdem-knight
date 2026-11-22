import { parseInsuranceRule, withOdds } from "@holdem-knight/core";
import { ArrowLeftRight } from "lucide-react";
import { ConfigMenu } from "@/components/ConfigMenu";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { useSettledChange } from "@/lib/settled-change";
import type { InsuranceMode } from "./InsuranceCalculator";
import type { RoundingStakes } from "./InsuranceRounding";
import { type InsuranceChoice, InsuranceSettings, useInsuranceConfigs } from "./InsuranceSettings";
import { OddsTableMenu } from "./OddsTableMenu";

const MODES = [
  { id: "cards", label: t.insurance.insuranceHeader.pickCards },
  { id: "outs", label: t.insurance.insuranceHeader.quickOuts },
] as const;

/**
 * The title of an insurance page: both ways of working, with the one in use as the title and the
 * other gray beside it. A tap on a name picks it, and the arrows between them switch. Each name
 * keeps the width it has in bold, so nothing moves on a switch.
 */
export function ModeTitle({
  mode,
  onChange,
}: {
  mode: InsuranceMode;
  onChange: (mode: InsuranceMode) => void;
}) {
  const [cards, outs] = MODES.map(({ id, label }) => (
    <button
      key={id}
      type="button"
      aria-pressed={mode === id}
      onClick={() => onChange(id)}
      className="grid min-h-11 items-center text-left"
    >
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {label}
      </span>
      <span className={cn("col-start-1 row-start-1", mode !== id && "font-normal text-muted")}>
        {label}
      </span>
    </button>
  ));
  return (
    <span className="flex items-center whitespace-nowrap">
      <span className="sr-only">{t.insurance.insuranceHeader.insurance}</span>
      {cards}
      <button
        type="button"
        aria-label={t.insurance.insuranceHeader.switchHowItsWorkedOut}
        onClick={() => onChange(mode === "cards" ? "outs" : "cards")}
        className="grid h-11 w-9 shrink-0 place-items-center text-highlight"
      >
        <ArrowLeftRight className="size-5" strokeWidth={1.75} aria-hidden />
      </button>
      {outs}
    </span>
  );
}

interface InsuranceSetupProps {
  /** The settings in use, and the set they came from */
  value: InsuranceChoice;
  /** The game's small blind for the smallest chip, or undefined in the tools */
  stakes: RoundingStakes;
  /**
   * A change. Where it is asked about first, as a game's own settings are, it returns false when
   * turned down, and a number being typed comes through once its field is left.
   */
  onChange: (value: InsuranceChoice) => boolean | undefined;
  /** Hold what is being typed until its field is left, so a change is asked about once */
  settleTyping?: boolean;
}

/**
 * What the insurance is priced by, under an insurance page's title: a line with the configuration
 * at the left and the odds table at the right, each a name that opens a menu in the page, then
 * the configuration's settings on show. Whoever owns the settings decides where a change goes.
 */
export function InsuranceSetup({
  value: saved,
  stakes,
  onChange: save,
  settleTyping = false,
}: InsuranceSetupProps) {
  const settled = useSettledChange(saved, save);
  const value = settleTyping ? settled.value : saved;
  const onChange = settleTyping ? settled.change : save;
  const { form } = value;
  const parsed = parseInsuranceRule(form);
  const configs = useInsuranceConfigs({
    value,
    lastRule: undefined,
    lastRuleLabel: "",
    onChange,
  });

  return (
    <div className="contents" {...(settleTyping && settled.containerProps)}>
      <div className="flex items-center justify-between gap-4">
        <ConfigMenu
          label={t.insurance.insuranceHeader.insuranceSettings}
          choices={configs.rules.map(({ id, name }) => ({ id, name }))}
          selectedId={configs.selectedId}
          modified={configs.modified}
          onPick={configs.choose}
          className="text-sm font-medium"
        />
        <OddsTableMenu
          odds={form.odds}
          tableId={form.oddsTableId}
          // The odds are apart from the settings, so the configuration keeps its name
          onApply={(odds, tableId) => onChange({ ...value, form: withOdds(form, odds, tableId) })}
          align="right"
          className="text-sm font-medium"
        />
      </div>
      <InsuranceSettings
        bare
        value={value}
        issues={parsed.ok ? {} : parsed.issues}
        lastRule={undefined}
        lastRuleLabel=""
        locked={false}
        stakes={stakes}
        onChange={onChange}
      />
    </div>
  );
}
