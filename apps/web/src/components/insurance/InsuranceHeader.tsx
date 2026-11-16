import { parseInsuranceRule } from "@holdem-knight/core";
import { ArrowLeftRight } from "lucide-react";
import { TextMenu } from "@/components/TextMenu";
import { cn } from "@/lib/cn";
import type { InsuranceMode } from "./InsuranceCalculator";
import {
  CUSTOM_NAME,
  type InsuranceChoice,
  InsuranceSettings,
  useInsuranceConfigs,
} from "./InsuranceSettings";
import { OddsTableMenu } from "./OddsTableMenu";

const MODES = [
  { id: "cards", label: "选牌计算" },
  { id: "outs", label: "Outs数速算" },
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
      <span className="sr-only">保险计算：</span>
      {cards}
      <button
        type="button"
        aria-label="切换计算方式"
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
  onChange: (value: InsuranceChoice) => void;
}

/**
 * What the insurance is priced by, under an insurance page's title: a line with the configuration
 * at the left and the odds table at the right, each a name that opens a menu in the page, then
 * the configuration's settings on show. Whoever owns the settings decides where a change goes.
 */
export function InsuranceSetup({ value, onChange }: InsuranceSetupProps) {
  const { form } = value;
  const parsed = parseInsuranceRule(form);
  const configs = useInsuranceConfigs({
    value,
    lastRule: undefined,
    lastRuleLabel: "",
    onChange,
  });
  const options = [
    ...configs.rules.map(({ id, name }) => ({ value: id, label: name })),
    // Settings changed by hand belong to no set, and show as such until one is picked
    ...(configs.rules.some(({ id }) => id === configs.selectedId)
      ? []
      : [{ value: configs.selectedId, label: CUSTOM_NAME }]),
  ];

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <TextMenu
          label="保险配置"
          options={options}
          value={configs.selectedId}
          onChange={configs.choose}
          className="text-sm font-medium"
        />
        <OddsTableMenu
          odds={form.odds}
          // The odds are apart from the settings, so the configuration keeps its name
          onApply={(odds) => onChange({ ...value, form: { ...form, odds } })}
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
        onChange={onChange}
      />
    </>
  );
}
