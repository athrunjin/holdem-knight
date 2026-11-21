import {
  configInUse,
  type InsuranceRule,
  type InsuranceRuleForm,
  type InsuranceRuleIssues,
  parseInsuranceRule,
  RULE_30,
  ruleToKeep,
  type SavedInsuranceRule,
  sameInsuranceSettings as sameSettings,
  insuranceSettingsOf as settingsOf,
  toInsuranceRuleForm,
  withOdds,
} from "@holdem-knight/core";
import { useState } from "react";
import { ConfigMenu } from "@/components/ConfigMenu";
import { MiniSwitch } from "@/components/MiniSwitch";
import { SaveNameDialog } from "@/components/SaveNameDialog";
import { Toggle } from "@/components/Toggle";
import { useConfigFollowers } from "@/data/game-configs";
import {
  newSavedRule,
  useInsuranceRules,
  useRemoveInsuranceRule,
  useSaveInsuranceRule,
} from "@/data/insurance";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { removalQuestion, updateQuestion } from "@/lib/config-text";
import { datedName } from "@/lib/dated-name";
import { CoverLimitPicker } from "./CoverLimitPicker";
import { InsuranceRoundingLine, type RoundingStakes, RoundingSwitch } from "./InsuranceRounding";
import { OddsTableEditor } from "./OddsTableEditor";

/** Stands for last time's settings while they are no saved set. */
export const LAST_RULE = "last";
const DEFAULT_RULE = "default";
const CUSTOM_RULE = "custom";

/**
 * The set a rule's settings belong to: the default, a saved one, or none of them. Of two saved
 * sets with the same settings, the one they were taken from comes first.
 */
export function configSourceOf(
  rule: InsuranceRule,
  saved: readonly SavedInsuranceRule[],
  takenFromId?: string,
): string {
  if (sameSettings(rule, RULE_30)) return DEFAULT_RULE;
  const set = configInUse(saved, (other) => sameSettings(other.rule, rule), takenFromId);
  return set?.id ?? CUSTOM_RULE;
}

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

interface ConfigList {
  value: InsuranceChoice;
  /** The rule to offer as "last time", from this game or the latest one that had insurance */
  lastRule: InsuranceRule | undefined;
  /** What to call that rule in the list */
  lastRuleLabel: string;
  /** The saved set that rule was taken from, which names it where another holds the same */
  lastSource?: string | undefined;
  onChange: (value: InsuranceChoice) => void;
}

/**
 * The sets of settings on offer, which leave the odds out: last time's, the default and the saved
 * ones. Picking one takes its settings and keeps the odds in use. Settings changed by hand stay
 * with the saved set they started from, which then reads as changed (ADR 0038).
 */
export function useInsuranceConfigs({
  value,
  lastRule,
  lastRuleLabel,
  lastSource,
  onChange,
}: ConfigList) {
  const { source, form } = value;
  const { data: saved = [] } = useInsuranceRules();

  // Last time's settings go by their saved name when they were a saved set
  const lastSaved =
    lastRule && configInUse(saved, (rule) => sameSettings(rule.rule, lastRule), lastSource);
  // And are listed as last time's only when they are neither a saved set nor the default
  const lastShown = lastRule !== undefined && !lastSaved && !sameSettings(lastRule, RULE_30);
  const rules = [
    ...(lastShown ? [{ id: LAST_RULE, name: lastRuleLabel, rule: lastRule }] : []),
    {
      id: DEFAULT_RULE,
      name: t.insurance.insuranceSettings.defaultInsuranceSettings,
      rule: RULE_30,
    },
    ...saved.map((rule) => ({ ...rule, removable: true })),
  ];
  const selectedId =
    source === LAST_RULE ? (lastSaved?.id ?? (lastShown ? LAST_RULE : DEFAULT_RULE)) : source;
  /** The saved set the settings are with, whether or not they still equal it. */
  const base = saved.find((rule) => rule.id === selectedId);
  // Compared as rules, so values kept for a switch that is off do not count
  const current = parseInsuranceRule(form);
  const modified = base !== undefined && !(current.ok && sameSettings(current.rule, base.rule));
  /** Where settings changed by hand belong: with their saved set, or with none. */
  const editedSource = base ? base.id : CUSTOM_RULE;

  function choose(id: string) {
    const rule = rules.find((r) => r.id === id)?.rule;
    // The odds stay as they are, with the table they came from, and so does a smallest chip in chips
    if (rule) {
      const next = withOdds(toInsuranceRuleForm(ruleToKeep(rule)), form.odds, form.oddsTableId);
      const roundChips = form.roundChips;
      onChange({
        ...value,
        source: id,
        form: { ...next, ...(roundChips !== undefined && { roundChips }) },
      });
    }
  }

  return { saved, rules, selectedId, base, modified, editedSource, choose };
}

interface InsuranceSettingsProps extends ConfigList {
  issues: InsuranceRuleIssues;
  /** Once insurance has been sold in this game, it cannot be turned off */
  locked: boolean;
  /** The game's small blind for the smallest chip, or undefined in the tools */
  stakes: RoundingStakes;
  /**
   * For the calculator on its own, which has no insurance to switch on and shows the configuration
   * and the odds table itself: only the settings between them, on show, with no frame.
   */
  bare?: boolean;
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
  lastSource,
  locked,
  stakes,
  bare = false,
  onChange,
}: InsuranceSettingsProps) {
  const { form } = value;
  const enabled = bare || value.enabled;
  const { saved, rules, selectedId, base, modified, editedSource, choose } = useInsuranceConfigs({
    value,
    lastRule,
    lastRuleLabel,
    lastSource,
    onChange,
  });
  const removeRule = useRemoveInsuranceRule();
  const saveRule = useSaveInsuranceRule();
  const followers = useConfigFollowers();
  const [naming, setNaming] = useState(false);

  // The smallest chip in chips is not part of a set, so changing it keeps the set's name
  const setForm = (next: Partial<InsuranceRuleForm>) => {
    const changed = { ...form, ...next };
    const same = JSON.stringify(settingsOf(changed)) === JSON.stringify(settingsOf(form));
    onChange({ ...value, source: same ? value.source : editedSource, form: changed });
  };

  // Worth saving only once the settings are valid and differ from every set already on offer
  const settingsText = JSON.stringify(settingsOf(form));
  const savable =
    parseInsuranceRule(form).ok &&
    ![...rules.map((r) => r.rule), ...(lastRule ? [lastRule] : [])].some(
      (rule) => JSON.stringify(settingsOf(toInsuranceRuleForm(rule))) === settingsText,
    );

  // Settings changed from a saved set can go back into it, once they are valid
  const updating = base !== undefined && modified && parseInsuranceRule(form).ok;

  const roundingInvalid = issues.roundSmallBlinds !== undefined || issues.roundChips !== undefined;

  const configButton = (
    <ConfigMenu
      label={t.insurance.insuranceSettings.insuranceSettings}
      choices={rules}
      selectedId={selectedId}
      modified={modified}
      onPick={choose}
      onRemove={handleRemove}
      align="right"
      className="text-sm"
    />
  );

  /** Saved with this game's odds too, but only the other settings are taken when it is picked. */
  function handleSave(name: string) {
    const parsed = parseInsuranceRule(form);
    if (!parsed.ok) return t.insurance.insuranceSettings.someRulesArentValid;
    const existing = saved.find((rule) => rule.name === name);
    // Kept with the smallest chip in small blinds only, to be worked out at the game it is used in
    const kept = ruleToKeep(parsed.rule);
    const rule = existing ? { ...existing, rule: kept } : newSavedRule(name, kept);
    saveRule.mutate(rule, {
      onSuccess: () => {
        onChange({ ...value, source: rule.id });
        setNaming(false);
      },
    });
    return undefined;
  }

  /**
   * Saves the settings into the set they were taken from. Game configs that follow the set take
   * its new settings, so that is asked about first.
   */
  function handleUpdate() {
    const parsed = parseInsuranceRule(form);
    if (!parsed.ok || !base) return;
    const using = followers({ section: "insurance", id: base.id });
    if (using > 0 && !window.confirm(updateQuestion(base.name, using))) return;
    saveRule.mutate(
      { ...base, rule: ruleToKeep(parsed.rule) },
      { onSuccess: () => onChange({ ...value, source: base.id }) },
    );
  }

  function handleRemove(id: string) {
    const rule = saved.find((r) => r.id === id);
    const using = followers({ section: "insurance", id });
    if (rule && window.confirm(removalQuestion(t.common.settings, rule.name, using))) {
      removeRule.mutate(id, {
        onSuccess: () => {
          if (selectedId === id) onChange({ ...value, source: CUSTOM_RULE });
        },
      });
    }
  }

  return (
    <section
      className={cn(
        "flex flex-col",
        !bare && "gap-1 rounded-xl border border-line bg-surface px-4 py-2",
      )}
    >
      {!bare && (
        <Toggle
          label={t.common.insurance}
          {...(locked && {
            detail: t.insurance.insuranceSettings.thisGameAlreadyHasInsuranceRecorded,
          })}
          info={t.insurance.insuranceSettings.whenOnInsuranceJoinsTheGame}
          checked={enabled}
          disabled={locked}
          accessory={enabled && configButton}
          onChange={(checked) => onChange({ ...value, enabled: checked })}
        />
      )}

      {enabled && (
        <>
          <div className="flex flex-wrap gap-x-4">
            <MiniSwitch
              label={t.insurance.insuranceSettings.refundPremiumOnAHit}
              checked={form.refundPremium}
              onChange={(refundPremium) => setForm({ refundPremium })}
            />
            <MiniSwitch
              label={t.insurance.insuranceSettings.tieCardsCountAsOuts}
              checked={form.tieOuts === "include"}
              onChange={(checked) => setForm({ tieOuts: checked ? "include" : "exclude" })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 text-sm">
            <span className="text-muted">{t.insurance.insuranceSettings.coverLimit}</span>
            <CoverLimitPicker
              street={t.insurance.insuranceSettings.flop}
              value={form.turnLimit}
              onChange={(turnLimit) => setForm({ turnLimit })}
            />
            <CoverLimitPicker
              street={t.common.turn}
              value={form.riverLimit}
              onChange={(riverLimit) => setForm({ riverLimit })}
            />
            {/* Rounding's switch ends this line, wrapping when it is too narrow */}
            <RoundingSwitch form={form} onChange={setForm} className="ml-auto" />
          </div>
          {(issues.turnLimit || issues.riverLimit || issues.odds) && (
            <p role="alert" className="text-sm text-highlight">
              {t.insurance.insuranceSettings.someRulesArentValidChooseAgain}
            </p>
          )}

          <InsuranceRoundingLine
            form={form}
            stakes={stakes}
            invalid={roundingInvalid}
            onChange={setForm}
          />

          {(savable || updating) && (
            <div className="flex min-w-0 justify-end gap-5">
              {updating && (
                <button
                  type="button"
                  disabled={saveRule.isPending}
                  onClick={handleUpdate}
                  className="min-h-11 min-w-0 truncate text-sm font-medium text-highlight disabled:opacity-60"
                >
                  {t.insurance.insuranceSettings.update(base.name)}
                </button>
              )}
              {savable && (
                <button
                  type="button"
                  onClick={() => setNaming(true)}
                  className="min-h-11 shrink-0 text-sm font-medium text-highlight"
                >
                  {updating
                    ? t.insurance.insuranceSettings.saveAs
                    : t.insurance.insuranceSettings.saveInsuranceSettings}
                </button>
              )}
            </div>
          )}
          {saveRule.isError && !naming && (
            <p role="alert" className="text-right text-sm text-highlight">
              {t.common.couldntSaveTryAgain}
            </p>
          )}

          {!bare && (
            <OddsTableEditor
              odds={form.odds}
              tableId={form.oddsTableId}
              // The odds are apart from the settings, so the settings keep their name
              onApply={(odds, tableId) =>
                onChange({ ...value, form: withOdds(form, odds, tableId) })
              }
            />
          )}
        </>
      )}

      {naming && (
        <SaveNameDialog
          title={t.insurance.insuranceSettings.saveTheseInsuranceSettingsToApply}
          label={t.insurance.insuranceSettings.nameAnExistingNameIsOverwritten}
          initialName={datedName(
            t.insurance.insuranceSettings.insuranceSettings,
            new Set(saved.map((rule) => rule.name)),
          )}
          saving={saveRule.isPending}
          saveFailed={saveRule.isError}
          onSave={handleSave}
          onClose={() => setNaming(false)}
        />
      )}
    </section>
  );
}
