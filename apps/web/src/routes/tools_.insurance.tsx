import { BUILT_IN_RULES, blankInsuranceHand, RULE_30, type TieOuts } from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { InsuranceCalculator } from "@/components/insurance/InsuranceCalculator";
import { Page } from "@/components/Page";
import { useInsuranceRules } from "@/data/insurance";

export const Route = createFileRoute("/tools_/insurance")({
  component: InsuranceToolPage,
});

const SEATS = Array.from({ length: 9 }, (_, i) => ({ id: `seat-${i + 1}`, name: `玩家 ${i + 1}` }));

const scratchHand = () =>
  blankInsuranceHand({ id: "scratch", organizerId: "guest", gameId: "tool", createdAt: 0 });

/** The calculator on its own: nothing here touches a game. */
function InsuranceToolPage() {
  const { data: saved = [] } = useInsuranceRules();
  const rules = [...BUILT_IN_RULES, ...saved];
  const [ruleId, setRuleId] = useState<string>(BUILT_IN_RULES[0].id);
  // Set by the switch for this visit only. Picking a rule goes back to what that rule says.
  const [tieOuts, setTieOuts] = useState<TieOuts>();
  const picked = rules.find(({ id }) => id === ruleId)?.rule ?? RULE_30;
  const rule = tieOuts === undefined ? picked : { ...picked, tieOuts };

  return (
    <Page
      title="保险计算"
      actions={
        <Link
          to="/tools"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 text-highlight"
        >
          <ArrowLeft className="size-5" strokeWidth={1.75} aria-hidden />
          返回工具
        </Link>
      }
    >
      <label className="mb-3 block">
        <span className="mb-1 block text-sm text-muted">赔率规则</span>
        <select
          value={ruleId}
          onChange={(event) => {
            setRuleId(event.target.value);
            setTieOuts(undefined);
          }}
          className="min-h-12 w-full rounded-xl border border-line bg-surface px-3"
        >
          {rules.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <InsuranceCalculator
        rule={rule}
        onTieOutsChange={setTieOuts}
        seats={SEATS}
        autoSeat
        createHand={scratchHand}
      />
    </Page>
  );
}
