import {
  type ChargeIssue,
  type Currency,
  DEFAULT_TABLE_FEE,
  DEFAULT_WAGE,
  type TableFeeForm,
  type TableFeeIssues,
  type TableFeeRule,
  toTableFeeForm,
  toWageForm,
  type WageAdjustmentKind,
  type WageForm,
  type WageIssues,
  type WageRule,
} from "@holdem-knight/core";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/insurance/Modal";
import { TextField } from "@/components/TextField";
import { Toggle } from "@/components/Toggle";
import { cn } from "@/lib/cn";
import { CURRENCY_INFO } from "@/lib/currency";

const LAST_PRESET = "last";
const DEFAULT_PRESET = "default";
const CUSTOM_PRESET = "custom";

const ISSUE_TEXT: Record<ChargeIssue, string> = {
  invalid: "请输入有效的数字",
  "not-positive": "必须大于 0",
  "same-hours": "开始和结束不能相同",
};

const issueText = (issue: ChargeIssue | undefined) => issue && ISSUE_TEXT[issue];

/** Whether an option is on, where its values came from, and the values being edited. */
export interface ChargeChoice<Form> {
  readonly enabled: boolean;
  readonly source: string;
  readonly form: Form;
}

/** Starts from this game's rule, or else last time's, or else the default. */
function initialChoice<Rule, Form>(
  current: Rule | undefined,
  last: Rule | undefined,
  fallback: Rule,
  toForm: (rule: Rule) => Form,
): ChargeChoice<Form> {
  return {
    enabled: current !== undefined,
    source: current || last ? LAST_PRESET : DEFAULT_PRESET,
    form: toForm(current ?? last ?? fallback),
  };
}

export const initialTableFeeChoice = (
  current: TableFeeRule | undefined,
  last: TableFeeRule | undefined,
) => initialChoice(current, last, DEFAULT_TABLE_FEE, toTableFeeForm);

export const initialWageChoice = (current: WageRule | undefined, last: WageRule | undefined) =>
  initialChoice(current, last, DEFAULT_WAGE, toWageForm);

interface Preset<Form> {
  readonly id: string;
  readonly name: string;
  readonly form: Form;
}

/** Last time's values, when there are any, and the defaults. */
function presets<Rule, Form>(
  last: Rule | undefined,
  lastLabel: string,
  fallback: Rule,
  toForm: (rule: Rule) => Form,
): Preset<Form>[] {
  return [
    ...(last ? [{ id: LAST_PRESET, name: lastLabel, form: toForm(last) }] : []),
    { id: DEFAULT_PRESET, name: "默认配置", form: toForm(fallback) },
  ];
}

/** Shows where the values came from and switches to another preset. */
function PresetPicker<Form>({
  title,
  choices,
  source,
  onPick,
}: {
  title: string;
  choices: readonly Preset<Form>[];
  source: string;
  onPick: (preset: Preset<Form>) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
      >
        <span className="font-medium">{title}</span>
        <span className="flex min-w-0 items-center gap-0.5 text-sm text-muted">
          <span className="truncate">
            {choices.find((choice) => choice.id === source)?.name ?? "自定义"}
          </span>
          <ChevronDown className="size-4 shrink-0" aria-hidden />
        </span>
      </button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {choices.map((preset) => (
              <li key={preset.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(preset);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex min-h-12 w-full items-center justify-between gap-2 px-3 text-left font-medium",
                    source === preset.id && "text-highlight",
                  )}
                >
                  <span className="truncate">{preset.name}</span>
                  {source === preset.id && (
                    <Check className="size-5 shrink-0" aria-label="当前选中" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 min-h-11 w-full rounded-xl border border-line font-medium"
          >
            关闭
          </button>
        </Modal>
      )}
    </>
  );
}

interface ChargeSettingsProps<Rule, Form, Issues> {
  value: ChargeChoice<Form>;
  issues: Issues;
  currency: Currency;
  /** The rule to offer as "last time", from this game or the latest one that had it */
  lastRule: Rule | undefined;
  lastRuleLabel: string;
  onChange: (value: ChargeChoice<Form>) => void;
}

/** Turns the table fee on for a game and sets its amount and minimum time. */
export function TableFeeSettings({
  value,
  issues,
  currency,
  lastRule,
  lastRuleLabel,
  onChange,
}: ChargeSettingsProps<TableFeeRule, TableFeeForm, TableFeeIssues>) {
  const { enabled, source, form } = value;
  const setForm = (next: Partial<TableFeeForm>) =>
    onChange({ ...value, source: CUSTOM_PRESET, form: { ...form, ...next } });

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-2">
      <Toggle
        label="台费"
        detail="每位玩家每局收一次，结算时计入组织者"
        checked={enabled}
        onChange={(checked) => onChange({ ...value, enabled: checked })}
      />
      {enabled && (
        <>
          <PresetPicker
            title="台费配置"
            choices={presets(lastRule, lastRuleLabel, DEFAULT_TABLE_FEE, toTableFeeForm)}
            source={source}
            onPick={(preset) => onChange({ ...value, source: preset.id, form: preset.form })}
          />
          <div className="grid grid-cols-2 items-start gap-2">
            <TextField
              id="table-fee-amount"
              label="每人台费"
              value={form.amount}
              issue={issueText(issues.amount)}
              prefix={CURRENCY_INFO[currency].symbol}
              inputMode="decimal"
              onChange={(amount) => setForm({ amount })}
            />
            <TextField
              id="table-fee-minutes"
              label="在桌满"
              value={form.minMinutes}
              issue={issueText(issues.minMinutes)}
              suffix="分钟才收"
              inputMode="numeric"
              onChange={(minMinutes) => setForm({ minMinutes })}
            />
          </div>
          <p className="-mt-2 pb-2 text-sm text-muted">填 0 表示上桌就收。</p>
        </>
      )}
    </section>
  );
}

/** Turns wages on for a game, with an hourly rate and an optional different rate in advanced settings. */
export function WageSettings({
  value,
  issues,
  currency,
  lastRule,
  lastRuleLabel,
  onChange,
}: ChargeSettingsProps<WageRule, WageForm, WageIssues>) {
  const { enabled, source, form } = value;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const symbol = CURRENCY_INFO[currency].symbol;
  const setForm = (next: Partial<WageForm>) =>
    onChange({ ...value, source: CUSTOM_PRESET, form: { ...form, ...next } });
  const toggleAdjustment = (kind: WageAdjustmentKind) => (checked: boolean) =>
    setForm({ adjustment: checked ? kind : "none" });
  // An adjustment in use, or issues in it, would stay out of sight in a closed panel
  const advancedIssues = Object.keys(issues).some((field) => field !== "hourly");
  const expanded = advancedOpen || form.adjustment !== "none" || advancedIssues;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-2">
      <Toggle
        label="工资"
        detail="按每位玩家的在桌时长逐分钟计算，结算时计入组织者"
        checked={enabled}
        onChange={(checked) => onChange({ ...value, enabled: checked })}
      />
      {enabled && (
        <>
          <PresetPicker
            title="工资配置"
            choices={presets(lastRule, lastRuleLabel, DEFAULT_WAGE, toWageForm)}
            source={source}
            onPick={(preset) => onChange({ ...value, source: preset.id, form: preset.form })}
          />
          <TextField
            id="wage-hourly"
            label={form.adjustment === "none" ? "时薪（全天）" : "时薪（其余时间）"}
            value={form.hourly}
            issue={issueText(issues.hourly)}
            prefix={symbol}
            suffix="/ 小时"
            inputMode="decimal"
            onChange={(hourly) => setForm({ hourly })}
          />

          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setAdvancedOpen(!expanded)}
            className="flex min-h-11 w-full items-center justify-between font-medium text-highlight"
          >
            高级设置
            <ChevronDown
              className={cn("size-5 transition-transform", expanded && "rotate-180")}
              aria-hidden
            />
          </button>

          {expanded && (
            <div className="flex flex-col gap-3 pb-2">
              <p className="text-sm text-muted">下面两项只能开一个。</p>
              <Toggle
                label="按时段设置时薪"
                detail="例如 22 点到 2 点按另一个时薪算"
                checked={form.adjustment === "time_of_day"}
                onChange={toggleAdjustment("time_of_day")}
              />
              {form.adjustment === "time_of_day" && (
                <div className="grid grid-cols-3 items-start gap-2">
                  <TextField
                    id="wage-from-hour"
                    label="从"
                    value={form.fromHour}
                    issue={issueText(issues.fromHour)}
                    suffix="点"
                    inputMode="numeric"
                    onChange={(fromHour) => setForm({ fromHour })}
                  />
                  <TextField
                    id="wage-to-hour"
                    label="到"
                    value={form.toHour}
                    issue={issueText(issues.toHour)}
                    suffix="点"
                    inputMode="numeric"
                    onChange={(toHour) => setForm({ toHour })}
                  />
                  <TextField
                    id="wage-time-hourly"
                    label="时薪"
                    value={form.timeHourly}
                    issue={issueText(issues.timeHourly)}
                    prefix={symbol}
                    inputMode="decimal"
                    onChange={(timeHourly) => setForm({ timeHourly })}
                  />
                </div>
              )}
              <Toggle
                label="开局一段时间后改时薪"
                detail="从第一位玩家上桌开始算"
                checked={form.adjustment === "after_start"}
                onChange={toggleAdjustment("after_start")}
              />
              {form.adjustment === "after_start" && (
                <div className="grid grid-cols-2 items-start gap-2">
                  <TextField
                    id="wage-after-hours"
                    label="开局"
                    value={form.afterHours}
                    issue={issueText(issues.afterHours)}
                    suffix="小时后"
                    inputMode="numeric"
                    onChange={(afterHours) => setForm({ afterHours })}
                  />
                  <TextField
                    id="wage-after-hourly"
                    label="时薪"
                    value={form.afterHourly}
                    issue={issueText(issues.afterHourly)}
                    prefix={symbol}
                    suffix="/ 小时"
                    inputMode="decimal"
                    onChange={(afterHourly) => setForm({ afterHourly })}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
