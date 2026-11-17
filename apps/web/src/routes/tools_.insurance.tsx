import {
  blankInsuranceHand,
  type InsuranceRuleForm,
  parseInsuranceRule,
  RULE_30,
  toInsuranceRuleForm,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  InsuranceCalculator,
  type InsuranceMode,
} from "@/components/insurance/InsuranceCalculator";
import { InsuranceSetup, ModeTitle } from "@/components/insurance/InsuranceHeader";
import type { InsuranceChoice } from "@/components/insurance/InsuranceSettings";
import { Page } from "@/components/Page";
import { useStoredState } from "@/lib/stored-state";

export const Route = createFileRoute("/tools_/insurance")({
  component: InsuranceToolPage,
});

const SEATS = Array.from({ length: 9 }, (_, i) => ({
  id: `seat-${i + 1}`,
  name: `玩家 ${i + 1}`,
  // A round stack to start from, so a hand prices as soon as its cards are in
  chips: 1000,
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
  const { odds, tieOuts, refundPremium, turnLimit, riverLimit, oddsTableId } = form;
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
  const kept = {
    odds,
    tieOuts,
    refundPremium,
    turnLimit,
    riverLimit,
    // The table the odds are from, so one of two tables with the same odds keeps its name
    ...(typeof oddsTableId === "string" && { oddsTableId }),
  };
  return parseInsuranceRule(kept).ok ? { source, form: kept } : undefined;
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
      <InsuranceSetup value={choice} onChange={setChoice} />
      <InsuranceCalculator
        mode={mode}
        rule={parsed.ok ? parsed.rule : RULE_30}
        seats={SEATS}
        createHand={scratchHand}
      />
    </Page>
  );
}
