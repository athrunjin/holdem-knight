import {
  type InsuranceRule,
  type InsuranceRuleForm,
  type InsuranceRuleIssues,
  parseInsuranceRule,
  RULE_30,
  toInsuranceRuleForm,
} from "@holdem-knight/core";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { MiniSwitch } from "@/components/MiniSwitch";
import { SaveNameDialog } from "@/components/SaveNameDialog";
import { Toggle } from "@/components/Toggle";
import {
  newSavedRule,
  useInsuranceRules,
  useRemoveInsuranceRule,
  useSaveInsuranceRule,
} from "@/data/insurance";
import { datedName } from "@/lib/dated-name";
import { ChoiceModal } from "./ChoiceModal";
import { CoverLimitPicker } from "./CoverLimitPicker";
import { OddsTableEditor } from "./OddsTableEditor";

const LAST_RULE = "last";
const DEFAULT_RULE = "default";
const CUSTOM_RULE = "custom";

/** Everything in a rule but its odds, which the odds table sets on its own. */
function settingsOf(form: InsuranceRuleForm) {
  const { odds: _, ...settings } = form;
  return settings;
}

const sameSettings = (a: InsuranceRule, b: InsuranceRule) =>
  JSON.stringify(settingsOf(toInsuranceRuleForm(a))) ===
  JSON.stringify(settingsOf(toInsuranceRuleForm(b)));

export interface InsuranceChoice {
  readonly enabled: boolean;
  readonly source: string;
  readonly form: InsuranceRuleForm;
}

export function initialInsuranceChoice(
  current: InsuranceRule | undefined,
  last: InsuranceRule | undefined,
): InsuranceChoice {
  const rule = current ?? last ?? RULE_30;
  return {
    enabled: current !== undefined,
    source: current || last ? LAST_RULE : DEFAULT_RULE,
    form: toInsuranceRuleForm(rule),
  };
}

interface InsuranceSettingsProps {
  value: InsuranceChoice;
  issues: InsuranceRuleIssues;
  /** The rule to offer as "last time", from this game or the latest one that had insurance */
  lastRule: InsuranceRule | undefined;
  /** What to call that rule in the list */
  lastRuleLabel: string;
  /** Once insurance has been sold in this game, it cannot be turned off */
  locked: boolean;
  onChange: (value: InsuranceChoice) => void;
}

/**
 * Turns insurance on for a game. The settings other than the odds come from last time, the default
 * or a saved set, and can be saved; the odds table picks and saves its odds on its own.
 */
export function InsuranceSettings({
  value,
  issues,
  lastRule,
  lastRuleLabel,
  locked,
  onChange,
}: InsuranceSettingsProps) {
  const { enabled, source, form } = value;
  const { data: saved = [] } = useInsuranceRules();
  const removeRule = useRemoveInsuranceRule();
  const saveRule = useSaveInsuranceRule();
  const [picking, setPicking] = useState(false);
  const [naming, setNaming] = useState(false);

  const setForm = (next: Partial<InsuranceRuleForm>) =>
    onChange({ ...value, source: CUSTOM_RULE, form: { ...form, ...next } });

  // Last time's settings go by their saved name when they were a saved set
  const lastSaved = lastRule && saved.find((rule) => sameSettings(rule.rule, lastRule));
  const rules = [
    ...(lastRule && !lastSaved ? [{ id: LAST_RULE, name: lastRuleLabel, rule: lastRule }] : []),
    { id: DEFAULT_RULE, name: "默认配置", rule: RULE_30 },
    ...saved.map((rule) => ({ ...rule, removable: true })),
  ];
  const selectedId = source === LAST_RULE && lastSaved ? lastSaved.id : source;
  const selectedName = rules.find((rule) => rule.id === selectedId)?.name ?? "自定义";
  // Worth saving only once the settings are valid and differ from every set already on offer
  const settingsText = JSON.stringify(settingsOf(form));
  const savable =
    parseInsuranceRule(form).ok &&
    ![...rules.map((r) => r.rule), ...(lastRule ? [lastRule] : [])].some(
      (rule) => JSON.stringify(settingsOf(toInsuranceRuleForm(rule))) === settingsText,
    );

  /** Takes a set's settings and keeps this game's odds. */
  function choose(id: string) {
    const rule = rules.find((r) => r.id === id)?.rule;
    if (rule) {
      const next = { ...toInsuranceRuleForm(rule), odds: form.odds };
      onChange({ ...value, source: id, form: next });
    }
    setPicking(false);
  }

  /** Saved with this game's odds too, but only the other settings are taken when it is picked. */
  function handleSave(name: string) {
    const parsed = parseInsuranceRule(form);
    if (!parsed.ok) return "规则里有无效的数值";
    const existing = saved.find((rule) => rule.name === name);
    const rule = existing ? { ...existing, rule: parsed.rule } : newSavedRule(name, parsed.rule);
    saveRule.mutate(rule, {
      onSuccess: () => {
        onChange({ ...value, source: rule.id });
        setNaming(false);
      },
    });
    return undefined;
  }

  function handleRemove(id: string) {
    const rule = saved.find((r) => r.id === id);
    if (rule && window.confirm(`删除规则「${rule.name}」？`)) {
      removeRule.mutate(id, {
        onSuccess: () => {
          if (selectedId === id) onChange({ ...value, source: CUSTOM_RULE });
        },
      });
    }
  }

  return (
    <section className="flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-2">
      <Toggle
        label="保险"
        {...(locked && { detail: "这局已有保险记录，不能关闭" })}
        info="开启后「保险」作为一席加入牌局，默认 1 个 Buy-in"
        checked={enabled}
        disabled={locked}
        accessory={
          enabled && (
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={`保险配置：${selectedName}`}
              onClick={() => setPicking(true)}
              className="flex min-h-11 min-w-0 items-center gap-0.5 text-sm"
            >
              <span className="truncate">{selectedName}</span>
              <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
            </button>
          )
        }
        onChange={(checked) => onChange({ ...value, enabled: checked })}
      />

      {enabled && (
        <>
          <div className="flex flex-wrap gap-x-4">
            <MiniSwitch
              label="命中退还保费"
              checked={form.refundPremium}
              onChange={(refundPremium) => setForm({ refundPremium })}
            />
            <MiniSwitch
              label="平分牌算 outs"
              checked={form.tieOuts === "include"}
              onChange={(checked) => setForm({ tieOuts: checked ? "include" : "exclude" })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 text-sm">
            <span className="text-muted">保费上限</span>
            <CoverLimitPicker
              street="翻牌"
              value={form.turnLimit}
              onChange={(turnLimit) => setForm({ turnLimit })}
            />
            <CoverLimitPicker
              street="转牌"
              value={form.riverLimit}
              onChange={(riverLimit) => setForm({ riverLimit })}
            />
            {savable && (
              <button
                type="button"
                onClick={() => setNaming(true)}
                className="ml-auto min-h-11 font-medium text-highlight"
              >
                保存配置
              </button>
            )}
          </div>
          {(issues.turnLimit || issues.riverLimit || issues.odds) && (
            <p role="alert" className="text-sm text-highlight">
              规则里有无效的数值，请重新选择。
            </p>
          )}

          <OddsTableEditor
            odds={form.odds}
            // The odds are apart from the settings, so the settings keep their name
            onApply={(odds) => onChange({ ...value, form: { ...form, odds } })}
          />
        </>
      )}

      {picking && (
        <ChoiceModal
          title="保险配置（不含赔率）"
          choices={rules}
          selectedId={selectedId}
          onPick={choose}
          onRemove={handleRemove}
          onClose={() => setPicking(false)}
        />
      )}

      {naming && (
        <SaveNameDialog
          title="保存保险配置，下次快速应用？"
          label="名称，同名会覆盖；赔率另存为赔率表"
          initialName={datedName("保险配置", new Set(saved.map((rule) => rule.name)))}
          saving={saveRule.isPending}
          saveFailed={saveRule.isError}
          onSave={handleSave}
          onClose={() => setNaming(false)}
        />
      )}
    </section>
  );
}
