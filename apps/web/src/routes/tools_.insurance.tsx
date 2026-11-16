import {
  blankInsuranceHand,
  type InsuranceRuleForm,
  parseInsuranceRule,
  RULE_30,
  toInsuranceRuleForm,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftRight, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  InsuranceCalculator,
  type InsuranceMode,
} from "@/components/insurance/InsuranceCalculator";
import {
  CUSTOM_NAME,
  type InsuranceChoice,
  InsuranceSettings,
  useInsuranceConfigs,
} from "@/components/insurance/InsuranceSettings";
import { OddsTableMenu } from "@/components/insurance/OddsTableMenu";
import { Page } from "@/components/Page";
import { TextMenu } from "@/components/TextMenu";
import { cn } from "@/lib/cn";
import { useStoredState } from "@/lib/stored-state";

export const Route = createFileRoute("/tools_/insurance")({
  component: InsuranceToolPage,
});

const SEATS = Array.from({ length: 9 }, (_, i) => ({
  id: `seat-${i + 1}`,
  name: `玩家 ${i + 1}`,
  chips: 0,
}));

const scratchHand = () =>
  blankInsuranceHand({ id: "scratch", organizerId: "guest", gameId: "tool", createdAt: 0 });

/** The calculator's settings, kept in this browser between visits. */
interface ToolSettings {
  /** The set of settings they came from, or that they were changed by hand */
  readonly source: string;
  readonly form: InsuranceRuleForm;
}

const DEFAULT_SETTINGS: ToolSettings = { source: "default", form: toInsuranceRuleForm(RULE_30) };

function parseSettings(stored: unknown): ToolSettings | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { source, form } = stored as Partial<ToolSettings>;
  if (typeof source !== "string" || typeof form !== "object" || form === null) return undefined;
  const { odds, tieOuts, refundPremium, turnLimit, riverLimit } = form;
  if (
    !Array.isArray(odds) ||
    !odds.every((value) => typeof value === "string") ||
    (tieOuts !== "include" && tieOuts !== "exclude") ||
    typeof refundPremium !== "boolean" ||
    typeof turnLimit !== "string" ||
    typeof riverLimit !== "string"
  ) {
    return undefined;
  }
  const kept = { odds, tieOuts, refundPremium, turnLimit, riverLimit };
  return parseInsuranceRule(kept).ok ? { source, form: kept } : undefined;
}

const MODES = [
  { id: "cards", label: "选牌计算" },
  { id: "outs", label: "Outs数速算" },
] as const;

/**
 * The page's title: both ways of working, with the one in use as the title and the other gray
 * beside it. A tap on a name picks it, and the arrows between them switch. Each name keeps the
 * width it has in bold, so nothing moves on a switch.
 */
function ModeTitle({
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

/** The calculator on its own: nothing here touches a game. */
function InsuranceToolPage() {
  const [mode, setMode] = useState<InsuranceMode>("cards");
  const [settings, setSettings] = useStoredState(
    "insurance-tool.settings",
    DEFAULT_SETTINGS,
    parseSettings,
  );

  const choice: InsuranceChoice = { enabled: true, ...settings };
  const setChoice = ({ source, form }: InsuranceChoice) => setSettings({ source, form });
  const { form } = settings;
  const parsed = useMemo(() => parseInsuranceRule(form), [form]);
  const configs = useInsuranceConfigs({
    value: choice,
    lastRule: undefined,
    lastRuleLabel: "",
    onChange: setChoice,
  });

  const options = [
    ...configs.rules.map(({ id, name }) => ({ value: id, label: name })),
    // Settings changed by hand belong to no set, and show as such until one is picked
    ...(configs.rules.some(({ id }) => id === configs.selectedId)
      ? []
      : [{ value: configs.selectedId, label: CUSTOM_NAME }]),
  ];

  return (
    <Page
      title={<ModeTitle mode={mode} onChange={setMode} />}
      actions={
        <Link
          to="/tools"
          aria-label="返回工具"
          className="-mr-2 grid size-11 shrink-0 place-items-center text-highlight"
        >
          <X className="size-6" strokeWidth={1.75} aria-hidden />
        </Link>
      }
    >
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
          onApply={(odds) => setChoice({ ...choice, form: { ...form, odds } })}
          align="right"
          className="text-sm font-medium"
        />
      </div>
      {/* The settings of the configuration, on show under its name */}
      <InsuranceSettings
        bare
        value={choice}
        issues={parsed.ok ? {} : parsed.issues}
        lastRule={undefined}
        lastRuleLabel=""
        locked={false}
        onChange={setChoice}
      />
      <InsuranceCalculator
        mode={mode}
        rule={parsed.ok ? parsed.rule : RULE_30}
        seats={SEATS}
        autoSeat
        createHand={scratchHand}
      />
    </Page>
  );
}
