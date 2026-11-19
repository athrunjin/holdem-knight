import {
  type ChargeIssue,
  type Currency,
  DEFAULT_AFTER_HOURS,
  DEFAULT_RAKE_RULE,
  DEFAULT_TABLE_FEE,
  DEFAULT_TIME_SEGMENT,
  DEFAULT_WAGE,
  formatRakeNumber,
  MAX_WAGE_SEGMENTS,
  MAX_WAGE_SEGMENTS_IN_ALL,
  parseChips,
  parseRake,
  parseTableFee,
  parseWage,
  potAtCap,
  RAKE_PERCENT_PICKS,
  RAKE_ROUNDINGS,
  type RakeAmount,
  type RakeForm,
  type RakeIssues,
  type RakeRule,
  rakeAmountChips,
  type SavedChargeRule,
  type TableFeeForm,
  type TableFeeIssues,
  type TableFeeRule,
  toRakeForm,
  toTableFeeForm,
  toWageForm,
  tryParseMoney,
  WAGE_ROUNDINGS,
  WAGE_UNITS,
  type WageAfterStartSegmentForm,
  type WageForm,
  type WageIssues,
  type WageRule,
  type WageTimeSegmentForm,
  type WageUnitMinutes,
} from "@holdem-knight/core";
import { ChevronDown, Plus, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ChipStack } from "@/components/ChipStack";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { InfoButton } from "@/components/InfoButton";
import { ChoiceModal } from "@/components/insurance/ChoiceModal";
import { MiniSwitch } from "@/components/MiniSwitch";
import { SaveNameDialog } from "@/components/SaveNameDialog";
import { TextMenu } from "@/components/TextMenu";
import { Toggle } from "@/components/Toggle";
import {
  newChargeRule,
  useChargeRules,
  useRemoveChargeRule,
  useSaveChargeRule,
} from "@/data/charge-rules";
import { RAKE_ROUNDING_NAMES, ROUNDING_NAMES } from "@/lib/charges";
import { cn } from "@/lib/cn";
import { CURRENCY_INFO } from "@/lib/currency";
import { datedName } from "@/lib/dated-name";
import { formatMoneyText, selectOnFocus } from "@/lib/number-input";
import { chipsText, FigureInput, Join, Mark, pointsInputText, pointsText } from "./SetupFigures";

const LAST_PRESET = "last";
const DEFAULT_PRESET = "default";
const CUSTOM_PRESET = "custom";

const ISSUE_TEXT: Record<ChargeIssue, string> = {
  invalid: "请输入有效的数字",
  "not-positive": "必须大于 0",
  "same-hours": "开始和结束不能相同",
  overlap: "时段不能重叠，合计不能超过 24 小时",
  "not-rising": "后一段的小时数要比前一段大",
  "too-many": `分段合计不能超过 ${MAX_WAGE_SEGMENTS_IN_ALL} 个`,
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

export const initialRakeChoice = (current: RakeRule | undefined, last: RakeRule | undefined) =>
  initialChoice(current, last, DEFAULT_RAKE_RULE, toRakeForm);

interface Preset<Form> {
  readonly id: string;
  readonly name: string;
  readonly form: Form;
  readonly removable?: boolean;
}

type ChargeKind = SavedChargeRule["kind"];

/**
 * Last time's values, the defaults and the saved configs of one kind. Last time goes by its saved
 * name when it was a saved config, as insurance does.
 */
function useChargePresets<Rule, Form>(
  kind: ChargeKind,
  last: Rule | undefined,
  lastLabel: string,
  fallback: Rule,
  toForm: (rule: Rule) => Form,
  /** The values as a rule, or null while some are invalid */
  toRule: (form: Form) => Rule | null,
  source: string,
) {
  const { data: all = [] } = useChargeRules();
  const saved = all.flatMap((r) => (r.kind === kind ? [{ ...r, rule: r.rule as Rule }] : []));
  const same = (a: Rule, b: Rule) => JSON.stringify(toForm(a)) === JSON.stringify(toForm(b));
  const lastSaved = last && saved.find((r) => same(r.rule, last));
  const choices: Preset<Form>[] = [
    ...(last && !lastSaved ? [{ id: LAST_PRESET, name: lastLabel, form: toForm(last) }] : []),
    { id: DEFAULT_PRESET, name: "默认配置", form: toForm(fallback) },
    ...saved.map(({ id, name, rule }) => ({ id, name, form: toForm(rule), removable: true })),
  ];
  const selectedId = source === LAST_PRESET && lastSaved ? lastSaved.id : source;
  /**
   * Whether the values are valid and make a rule unlike every preset on offer, so saving them adds
   * something. Rules are compared rather than forms, so rows kept for a switched-off kind don't count.
   */
  const isNew = (form: Form) => {
    const rule = toRule(form);
    if (!rule) return false;
    const text = JSON.stringify(rule);
    return !choices.some((choice) => JSON.stringify(toRule(choice.form)) === text);
  };
  return { choices, selectedId, saved, isNew };
}

/** Where the values came from, beside the switch like insurance's, and a way to switch preset. */
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
  const removeRule = useRemoveChargeRule();
  const name = choices.find((choice) => choice.id === source)?.name ?? "自定义";

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`${title}：${name}`}
        onClick={() => setOpen(true)}
        className="flex min-h-11 min-w-0 items-center gap-0.5 text-sm"
      >
        <span className="truncate">{name}</span>
        <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
      </button>
      {open && (
        <ChoiceModal
          title={title}
          choices={choices}
          selectedId={source}
          onPick={(id) => {
            const preset = choices.find((choice) => choice.id === id);
            if (preset) onPick(preset);
            setOpen(false);
          }}
          onRemove={(id) => {
            const preset = choices.find((choice) => choice.id === id);
            if (preset && window.confirm(`删除配置「${preset.name}」？`)) removeRule.mutate(id);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * 保存配置 at the foot of an option: names its values and keeps them for later games. Shown only
 * for a valid change, one that matches no preset already on offer.
 */
function SaveChargeConfig({
  kind,
  title,
  takenNames,
  visible,
  read,
  onSaved,
}: {
  kind: ChargeKind;
  visible: boolean;
  /** 台费, 工资 or 抽水 */
  title: string;
  takenNames: readonly string[];
  /** The values as a rule, or null when some are invalid */
  read: () => Parameters<typeof newChargeRule>[1]["rule"] | null;
  onSaved: (id: string) => void;
}) {
  const { data: all = [] } = useChargeRules();
  const saveRule = useSaveChargeRule();
  const [naming, setNaming] = useState(false);

  function handleSave(name: string) {
    const rule = read();
    if (!rule) return "配置里有无效的数值";
    const existing = all.find((r) => r.kind === kind && r.name === name);
    const fields = { kind, rule } as Parameters<typeof newChargeRule>[1];
    const saved = existing
      ? ({ ...existing, ...fields } as SavedChargeRule)
      : newChargeRule(name, fields);
    saveRule.mutate(saved, {
      onSuccess: () => {
        onSaved(saved.id);
        setNaming(false);
      },
    });
    return undefined;
  }

  if (!visible && !naming) return null;

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setNaming(true)}
          className="min-h-11 text-sm font-medium text-highlight"
        >
          保存配置
        </button>
      </div>
      {naming && (
        <SaveNameDialog
          title={`保存${title}配置，下次快速应用？`}
          label="名称，同名会覆盖"
          initialName={datedName(`${title}配置`, new Set(takenNames))}
          saving={saveRule.isPending}
          saveFailed={saveRule.isError}
          onSave={handleSave}
          onClose={() => setNaming(false)}
        />
      )}
    </>
  );
}

/**
 * A number edited in place: it reads as text in its row, and a tap selects it so typing replaces it.
 * Enter is held back, as it would submit the whole game form.
 */
function InlineNumber({
  id,
  label,
  value,
  invalid,
  prefix,
  suffix,
  wholeNumber = false,
  minChars = 5,
  format,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  invalid: boolean;
  prefix?: string;
  suffix?: string;
  /** Only digits get through */
  wholeNumber?: boolean;
  /** The slot holds this many characters, 5 for an amount such as 25.00; a longer value widens it */
  minChars?: number;
  /** Tidies the value once the field is left, such as 30 to 30.00 */
  format?: (value: string) => string;
  onChange: (value: string) => void;
}) {
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {prefix && <span className="text-sm text-muted">{prefix}</span>}
      <input
        id={id}
        aria-label={label}
        type="text"
        inputMode={wholeNumber ? "numeric" : "decimal"}
        autoComplete="off"
        value={value}
        aria-invalid={invalid || undefined}
        onFocus={(event) => selectOnFocus(event.currentTarget)}
        onBlur={() => {
          const tidy = format?.(value);
          if (tidy !== undefined && tidy !== value) onChange(tidy);
        }}
        onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
        onChange={(event) =>
          onChange(wholeNumber ? event.target.value.replace(/\D/g, "") : event.target.value)
        }
        style={{ width: `${Math.max(minChars, value.length) + 1}ch` }}
        className={cn(
          "min-h-11 border-b bg-transparent text-center font-semibold tabular-nums outline-none focus:border-highlight",
          invalid ? "border-highlight" : "border-transparent",
        )}
      />
      {suffix && <span className="text-sm text-muted">{suffix}</span>}
    </span>
  );
}

const hourName = (hour: number) =>
  hour === 0 ? "0点（凌晨）" : hour === 12 ? "12点（中午）" : `${hour}点`;
const HOURS = Array.from({ length: 24 }, (_, hour) => ({ id: String(hour), name: hourName(hour) }));
const NO_END = "";
const NO_END_NAME = "不选择截止时间";

/** A whole hour from a list, or for an end, no end at all. */
function HourPicker({
  title,
  value,
  allowNoEnd = false,
  except,
  onChange,
}: {
  title: string;
  value: string;
  allowNoEnd?: boolean;
  /** An hour the list leaves out, such as the segment's start */
  except?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const choices = [
    ...(allowNoEnd ? [{ id: NO_END, name: NO_END_NAME }] : []),
    ...HOURS.filter(({ id }) => id !== except),
  ];
  const name = value === NO_END ? "不截止" : hourName(Number(value));

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`${title}：${value === NO_END ? NO_END_NAME : name}`}
        onClick={() => setOpen(true)}
        className="flex min-h-11 items-center gap-0.5 font-medium"
      >
        {name}
        <ChevronDown className="size-4 text-muted" aria-hidden />
      </button>
      {open && (
        <ChoiceModal
          title={title}
          choices={choices}
          selectedId={value}
          onPick={(id) => {
            onChange(id);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function SmallButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 shrink-0 place-items-center text-muted"
    >
      {children}
    </button>
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
  const minutes = Number(form.minMinutes) || 0;
  // Issues show as they are made, not only once the game is started
  const live = parseTableFee(form);
  const shown: TableFeeIssues = { ...(live.ok ? {} : live.issues), ...issues };
  const { choices, selectedId, saved, isNew } = useChargePresets(
    "table_fee",
    lastRule,
    lastRuleLabel,
    DEFAULT_TABLE_FEE,
    toTableFeeForm,
    (f) => {
      const parsed = parseTableFee(f);
      return parsed.ok ? parsed.rule : null;
    },
    source,
  );

  return (
    <section className="flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-2">
      <Toggle
        label="台费"
        info="每位玩家每局收一次，只计对局计时器运行时的在桌时间，结算时计入组织者"
        checked={enabled}
        accessory={
          enabled && (
            <PresetPicker
              title="台费配置"
              choices={choices}
              source={selectedId}
              onPick={(preset) => onChange({ ...value, source: preset.id, form: preset.form })}
            />
          )
        }
        onChange={(checked) => onChange({ ...value, enabled: checked })}
      />
      {enabled && (
        <>
          <div className="flex min-h-11 items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <label htmlFor="table-fee-amount" className="font-medium">
                基础台费
              </label>
              {minutes === 0 && <span className="text-xs text-highlight">上桌就收</span>}
            </span>
            <InlineNumber
              id="table-fee-amount"
              label="基础台费"
              value={form.amount}
              invalid={shown.amount !== undefined}
              prefix={CURRENCY_INFO[currency].symbol}
              suffix="/ 人 / 台"
              minChars={6}
              format={formatMoneyText}
              onChange={(amount) => setForm({ amount })}
            />
          </div>
          {shown.amount && <p className="text-sm text-highlight">{issueText(shown.amount)}</p>}
          {/* Fixed at 5 minutes; a game set up with another time keeps it */}
          <Toggle
            label={`在桌满 ${minutes > 0 ? minutes : DEFAULT_TABLE_FEE.minMinutes} 分钟收`}
            detail="防止误添加玩家产生台费"
            checked={minutes > 0}
            onChange={(on) =>
              setForm({ minMinutes: on ? String(DEFAULT_TABLE_FEE.minMinutes) : "0" })
            }
          />
          <SaveChargeConfig
            kind="table_fee"
            title="台费"
            takenNames={saved.map((r) => r.name)}
            visible={isNew(form)}
            read={() => {
              const parsed = parseTableFee(form);
              return parsed.ok ? parsed.rule : null;
            }}
            onSaved={(id) => onChange({ ...value, source: id })}
          />
        </>
      )}
    </section>
  );
}

/** How the unit reads after 精确到 at setup. */
const SETUP_UNIT_NAMES: Record<WageUnitMinutes, string> = {
  1: "每分钟",
  15: "每15分",
  30: "每30分",
  60: "每小时",
};

const UNIT_OPTIONS = WAGE_UNITS.map((unit) => ({
  value: String(unit),
  label: SETUP_UNIT_NAMES[unit],
}));

const ROUNDING_OPTIONS = WAGE_ROUNDINGS.map((mode) => ({
  value: mode,
  label: ROUNDING_NAMES[mode],
}));

const ROUNDING_INFO = [
  "每位玩家的在桌时间，从坐下起按「精确到」的时长切成一段一段，只计对局计时器运行的时间。最后不满一段的超出部分：",
  "四舍五入：满半段算一段，不满半段不收。",
  "向上取整：不满一段也算一段。",
  "向下取整：不满一段不收。",
].join("\n");

/**
 * Turns wages on for a game: a base rate, how time is charged, and rates by time of day or by game
 * time, which may both be on (ADR 0025).
 */
export function WageSettings({
  value,
  issues,
  currency,
  lastRule,
  lastRuleLabel,
  onChange,
}: ChargeSettingsProps<WageRule, WageForm, WageIssues>) {
  const { enabled, source, form } = value;
  const [segmentsOpen, setSegmentsOpen] = useState(false);
  const symbol = CURRENCY_INFO[currency].symbol;
  const setForm = (next: Partial<WageForm>) =>
    onChange({ ...value, source: CUSTOM_PRESET, form: { ...form, ...next } });
  const { choices, selectedId, saved, isNew } = useChargePresets(
    "wage",
    lastRule,
    lastRuleLabel,
    DEFAULT_WAGE,
    toWageForm,
    (f) => {
      const parsed = parseWage(f);
      return parsed.ok ? parsed.rule : null;
    },
    source,
  );

  // Issues show as they are made, not only once the game is started
  const live = parseWage(form);
  const shown: WageIssues = { ...(live.ok ? {} : live.issues), ...issues };
  const expanded = segmentsOpen || form.timeOn || form.afterOn;

  const { timeSegments: time, afterSegments: after } = form;
  const used = (form.timeOn ? time.length : 0) + (form.afterOn ? after.length : 0);
  const roomLeft = used < MAX_WAGE_SEGMENTS_IN_ALL;
  const lastTime = time.at(-1);
  const canAddTime =
    roomLeft &&
    time.length < MAX_WAGE_SEGMENTS &&
    lastTime !== undefined &&
    lastTime.toHour !== NO_END;
  const canAddAfter = roomLeft && after.length < MAX_WAGE_SEGMENTS;

  /** Each segment starts where the one before ends, and an open end leaves no room after it. */
  function setTime(index: number, next: Partial<WageTimeSegmentForm>) {
    let rows = time.map((row, i) => (i === index ? { ...row, ...next } : row));
    const changedEnd = next.toHour;
    if (changedEnd === NO_END) rows = rows.slice(0, index + 1);
    else if (changedEnd !== undefined && rows[index + 1]) {
      rows = rows.map((row, i) => (i === index + 1 ? { ...row, fromHour: changedEnd } : row));
    }
    setForm({ timeSegments: rows });
  }

  function setAfter(index: number, next: Partial<WageAfterStartSegmentForm>) {
    setForm({ afterSegments: after.map((row, i) => (i === index ? { ...row, ...next } : row)) });
  }

  /** Switching a kind on keeps its rows, but no more than leave room in all. */
  function switchKind(kind: "time" | "after", on: boolean) {
    if (!on) {
      setForm(kind === "time" ? { timeOn: false } : { afterOn: false });
      return;
    }
    const others =
      kind === "time" ? (form.afterOn ? after.length : 0) : form.timeOn ? time.length : 0;
    const room = Math.max(1, MAX_WAGE_SEGMENTS_IN_ALL - others);
    setForm(
      kind === "time"
        ? {
            timeOn: true,
            timeSegments: time.length > 0 ? time.slice(0, room) : [DEFAULT_TIME_SEGMENT],
          }
        : {
            afterOn: true,
            afterSegments:
              after.length > 0
                ? after.slice(0, room)
                : [{ afterHours: DEFAULT_AFTER_HOURS, hourly: form.hourly }],
          },
    );
  }

  return (
    <section className="flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-2">
      <Toggle
        label="工资"
        info="按每位玩家的在桌时长计算，计时器暂停时不计，结算时计入组织者"
        checked={enabled}
        accessory={
          enabled && (
            <PresetPicker
              title="工资配置"
              choices={choices}
              source={selectedId}
              onPick={(preset) => onChange({ ...value, source: preset.id, form: preset.form })}
            />
          )
        }
        onChange={(checked) => onChange({ ...value, enabled: checked })}
      />
      {enabled && (
        <>
          <div className="flex min-h-11 items-center justify-between gap-3">
            <label htmlFor="wage-hourly" className="font-medium">
              基础薪资
            </label>
            <InlineNumber
              id="wage-hourly"
              label="基础薪资"
              value={form.hourly}
              invalid={shown.hourly !== undefined}
              prefix={symbol}
              suffix="/小时"
              format={formatMoneyText}
              onChange={(hourly) => setForm({ hourly })}
            />
          </div>
          {shown.hourly && <p className="text-sm text-highlight">{issueText(shown.hourly)}</p>}

          <div className="-mt-2 flex flex-wrap items-center justify-between gap-x-3 text-sm">
            <TextMenu
              label="精确到"
              caption="精确到"
              options={UNIT_OPTIONS}
              value={String(form.unitMinutes)}
              onChange={(unit) => setForm({ unitMinutes: Number(unit) as WageUnitMinutes })}
              className="font-medium"
            />
            <span className="flex items-center">
              <span className="mr-1 flex items-center text-xs text-muted">
                <InfoButton title="超出部分" text={ROUNDING_INFO} inline />
                超出部分
              </span>
              <TextMenu
                label="取整方式"
                options={ROUNDING_OPTIONS}
                value={form.rounding}
                onChange={(rounding) => setForm({ rounding })}
                align="right"
                className="font-medium"
              />
            </span>
          </div>

          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setSegmentsOpen(!expanded)}
            className="flex min-h-11 w-full items-center justify-between font-medium"
          >
            分段薪资
            <ChevronDown
              className={cn("size-5 text-muted transition-transform", expanded && "rotate-180")}
              aria-hidden
            />
          </button>

          {expanded && (
            <div className="flex flex-col gap-1 pb-2">
              {form.timeOn && form.afterOn && (
                <p className="text-sm text-highlight">两项都开启时，取先到来的较大值。</p>
              )}
              {shown.segments && (
                <p className="text-sm text-highlight">{issueText(shown.segments)}</p>
              )}

              <Toggle
                label="根据时间"
                info="按开局所在地的时间。开局时已在时段内，从开局起就按该时段算；否则从下一次到达开始时间算起。"
                checked={form.timeOn}
                onChange={(on) => switchKind("time", on)}
              />
              {form.timeOn && (
                <>
                  <ul className="flex flex-col">
                    {time.map((row, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: rows are places in a chain
                      <li key={i} className="flex flex-wrap items-center gap-x-1 text-sm">
                        <span className="text-muted">从</span>
                        {i === 0 ? (
                          <HourPicker
                            title="开始时间"
                            value={row.fromHour}
                            onChange={(fromHour) => setTime(i, { fromHour })}
                          />
                        ) : (
                          <span className="font-medium">{hourName(Number(row.fromHour))}</span>
                        )}
                        <span className="text-muted">到</span>
                        <HourPicker
                          title="截止时间"
                          value={row.toHour}
                          allowNoEnd={i === time.length - 1}
                          except={row.fromHour}
                          onChange={(toHour) => setTime(i, { toHour })}
                        />
                        <span className="ml-auto flex items-center">
                          {/* Before the rate, so every rate lines up on the right with the base rate */}
                          {i > 0 && (
                            <SmallButton
                              label={`删除第 ${i + 1} 段`}
                              onClick={() => setForm({ timeSegments: time.slice(0, i) })}
                            >
                              <X className="size-4" aria-hidden />
                            </SmallButton>
                          )}
                          <InlineNumber
                            id={`wage-time-${i}`}
                            label={`第 ${i + 1} 段时薪`}
                            value={row.hourly}
                            invalid={shown[`time-${i}-hourly`] !== undefined}
                            prefix={symbol}
                            suffix="/小时"
                            format={formatMoneyText}
                            onChange={(hourly) => setTime(i, { hourly })}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                  {(shown.time || time.some((_, i) => shown[`time-${i}-toHour`])) && (
                    <p className="text-sm text-highlight">
                      {issueText(
                        shown.time ?? time.map((_, i) => shown[`time-${i}-toHour`]).find(Boolean),
                      )}
                    </p>
                  )}
                  {canAddTime && (
                    <SmallButton
                      label="增加时段"
                      onClick={() =>
                        setForm({
                          timeSegments: [
                            ...time,
                            { fromHour: lastTime.toHour, toHour: NO_END, hourly: lastTime.hourly },
                          ],
                        })
                      }
                    >
                      <Plus className="size-5" aria-hidden />
                    </SmallButton>
                  )}
                </>
              )}

              <Toggle
                label="根据时长"
                info="按对局计时器的时间算，暂停不算"
                checked={form.afterOn}
                onChange={(on) => switchKind("after", on)}
              />
              {form.afterOn && (
                <>
                  <ul className="flex flex-col">
                    {after.map((row, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: rows are places in a list
                      <li key={i} className="flex items-center gap-x-1 text-sm">
                        <span className="text-muted">开局</span>
                        <InlineNumber
                          id={`wage-after-hours-${i}`}
                          label={`第 ${i + 1} 段开局小时数`}
                          value={row.afterHours}
                          invalid={shown[`after-${i}-afterHours`] !== undefined}
                          wholeNumber
                          minChars={2}
                          onChange={(afterHours) => setAfter(i, { afterHours })}
                        />
                        <span className="text-muted">小时后</span>
                        <span className="ml-auto flex items-center">
                          {/* Before the rate, so every rate lines up on the right with the base rate */}
                          {i > 0 && (
                            <SmallButton
                              label={`删除第 ${i + 1} 段`}
                              onClick={() =>
                                setForm({ afterSegments: after.filter((_, j) => j !== i) })
                              }
                            >
                              <X className="size-4" aria-hidden />
                            </SmallButton>
                          )}
                          <InlineNumber
                            id={`wage-after-${i}`}
                            label={`第 ${i + 1} 段时薪`}
                            value={row.hourly}
                            invalid={shown[`after-${i}-hourly`] !== undefined}
                            prefix={symbol}
                            suffix="/小时"
                            format={formatMoneyText}
                            onChange={(hourly) => setAfter(i, { hourly })}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                  {(shown.after || after.some((_, i) => shown[`after-${i}-afterHours`])) && (
                    <p className="text-sm text-highlight">
                      {shown.after ? issueText(shown.after) : "小时数请填 1–48 的整数"}
                    </p>
                  )}
                  {canAddAfter && (
                    <SmallButton
                      label="增加开局时间段"
                      onClick={() => {
                        const last = after.at(-1);
                        const hours = Number(last?.afterHours ?? DEFAULT_AFTER_HOURS);
                        setForm({
                          afterSegments: [
                            ...after,
                            { afterHours: String(hours + 1), hourly: last?.hourly ?? form.hourly },
                          ],
                        });
                      }}
                    >
                      <Plus className="size-5" aria-hidden />
                    </SmallButton>
                  )}
                </>
              )}
            </div>
          )}

          <SaveChargeConfig
            kind="wage"
            title="工资"
            takenNames={saved.map((r) => r.name)}
            visible={isNew(form)}
            read={() => (live.ok ? live.rule : null)}
            onSaved={(id) => onChange({ ...value, source: id })}
          />
        </>
      )}
    </section>
  );
}

const PERCENT_OPTIONS = RAKE_PERCENT_PICKS.map((percent) => ({
  value: percent,
  label: `${percent}%`,
  chosen: <></>,
}));

const RAKE_ROUNDING_OPTIONS = RAKE_ROUNDINGS.map((mode) => ({
  value: mode,
  label: RAKE_ROUNDING_NAMES[mode],
}));

/** The game's blinds and chip ratio as typed, for showing rake amounts in chips and points. */
export interface RakeStakes {
  readonly smallBlindChips: number | null;
  readonly bigBlindChips: number | null;
  /** `amount` is in cents */
  readonly ratio: { readonly chips: number; readonly amount: number } | null;
}

const blindsOf = ({ smallBlindChips, bigBlindChips }: RakeStakes) => ({
  smallBlindChips: smallBlindChips ?? undefined,
  bigBlindChips: bigBlindChips ?? undefined,
});

/** A blind with a decimal or two, as it is kept. */
const blindText = (value: number) => formatRakeNumber(Math.round(value * 100) / 100);

/**
 * An amount for rake in blinds ⇔ chips, as the Buy-in row reads: either can be typed and the other
 * follows. A tap on the chip mark shows points instead. What was typed last is what is kept, so an
 * amount typed in blinds follows the blinds and one typed in chips does not.
 */
function RakeAmountFigures({
  label,
  blind,
  unit,
  amount,
  invalid,
  stakes,
  currency,
  onChange,
}: {
  label: string;
  /** The blind the left figure counts in */
  blind: Exclude<RakeAmount["unit"], "chips">;
  unit: RakeAmount["unit"];
  amount: string;
  invalid: boolean;
  stakes: RakeStakes;
  currency: Currency;
  onChange: (unit: RakeAmount["unit"], amount: string) => void;
}) {
  const [inPoints, setInPoints] = useState(false);
  // Points being typed, from which the chips are worked out
  const [draft, setDraft] = useState<string | null>(null);
  const { ratio } = stakes;
  const typed = Number(amount);
  const known = amount.trim() !== "" && Number.isFinite(typed);
  const chips = known ? (rakeAmountChips({ unit, amount: typed }, blindsOf(stakes)) ?? null) : null;
  const blindChips = blind === "smallBlinds" ? stakes.smallBlindChips : stakes.bigBlindChips;
  const blinds = !known
    ? null
    : unit === blind
      ? typed
      : blindChips && chips !== null
        ? chips / blindChips
        : null;
  const points = chips !== null && ratio ? Math.round((chips * ratio.amount) / ratio.chips) : null;
  const right = inPoints
    ? (draft ?? (points === null ? "" : pointsText(points)))
    : unit === "chips"
      ? amount
      : chips === null
        ? ""
        : formatRakeNumber(chips);
  const mark = blind === "smallBlinds" ? "SB" : "BB";

  function typeRight(text: string) {
    if (!inPoints) {
      onChange("chips", text);
      return;
    }
    setDraft(text);
    const cents = tryParseMoney(text);
    if (cents !== null && cents > 0 && ratio) {
      onChange("chips", String(Math.max(1, Math.round((cents * ratio.chips) / ratio.amount))));
    }
  }

  // Five cells of the rake grid: blinds, their mark, ⇔, chips or points, and the switching mark
  return (
    <span className="contents font-medium">
      <FigureInput
        label={`${label}（${mark}）`}
        value={unit === blind ? amount : blinds === null ? "" : blindText(blinds)}
        onChange={(text) => onChange(blind, text)}
        invalid={invalid && unit === blind}
      />
      <Mark>{mark}</Mark>
      <Join>
        <span aria-hidden className="text-xl leading-none">
          ⇔
        </span>
        <span className="sr-only">即</span>
      </Join>
      <FigureInput
        label={`${label}（${inPoints ? "积分" : "筹码"}）`}
        value={right}
        onChange={typeRight}
        onBlur={() => setDraft(null)}
        tidy={inPoints ? pointsInputText : chipsText}
        invalid={invalid && unit === "chips"}
        wholeNumber={!inPoints}
        wide
      />
      <button
        type="button"
        aria-label={`${label}显示${inPoints ? "积分" : "筹码"}，点击切换`}
        onClick={() => {
          setDraft(null);
          setInPoints(!inPoints);
        }}
        className="-my-3 ml-1 grid h-11 w-5 shrink-0 place-items-center text-muted"
      >
        {inPoints ? (
          <CurrencyIcon currency={currency} className="size-5" />
        ) : (
          <ChipStack ground="var(--surface)" className="size-5" />
        )}
      </button>
    </span>
  );
}

/** A caption in the rake grid, right-aligned so the colons of every row line up. */
const Caption = ({ children }: { children: ReactNode }) => (
  <span className="col-start-2 pr-1 text-right text-xs whitespace-nowrap text-muted">
    {children}
  </span>
);

/**
 * Under the cap: the pot whose rake, before rounding, is the cap, in chips whatever the cap shows.
 * Typing a pot sets the cap to that pot's rate, kept in the cap's unit, so the pot comes back as
 * typed. Rounding can make the rake reach the cap a little sooner.
 */
function MaxPotLine({
  form,
  stakes,
  onCap,
}: {
  form: RakeForm;
  stakes: RakeStakes;
  onCap: (unit: RakeAmount["unit"], amount: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const blinds = blindsOf(stakes);
  const parsed = parseRake(form);
  const rule = parsed.ok ? parsed.rule : null;
  const maxPot = rule && potAtCap(rule, blinds);

  function typePot(text: string) {
    setDraft(text);
    const pot = parseChips(text);
    const percent = rule?.percent;
    if (!percent || pot === null || pot <= 0) return;
    const chips = (pot * percent) / 100;
    const blind = rakeAmountChips({ unit: form.capUnit, amount: 1 }, blinds);
    if (form.capUnit === "chips" || !blind) onCap("chips", String(Math.max(1, Math.round(chips))));
    else onCap(form.capUnit, blindText(chips / blind));
  }

  // A row of the rake grid: its caption, then the pot under the chips above it
  return (
    <span className="contents font-medium">
      <Caption>等值最大底池:</Caption>
      <span className="col-start-6">
        <FigureInput
          label="等值最大底池（筹码）"
          value={draft ?? (maxPot ? String(maxPot) : "")}
          onChange={typePot}
          onBlur={() => setDraft(null)}
          tidy={chipsText}
          wholeNumber
          wide
        />
      </span>
      <Mark>
        <ChipStack ground="var(--surface)" className="size-5" />
      </Mark>
    </span>
  );
}

interface RakeSettingsProps extends ChargeSettingsProps<RakeRule, RakeForm, RakeIssues> {
  /** Once rake has been recorded in this game, it cannot be turned off */
  locked: boolean;
  stakes: RakeStakes;
}

/**
 * Turns rake on for a game: a percentage of each pot, a cap and rounding to the smallest chip, each
 * switched on or off and set in big blinds or chips (ADR 0036). Rake only ever goes to the host.
 */
export function RakeSettings({
  value,
  issues,
  currency,
  lastRule,
  lastRuleLabel,
  locked,
  stakes,
  onChange,
}: RakeSettingsProps) {
  const { enabled, source, form } = value;
  const setForm = (next: Partial<RakeForm>) =>
    onChange({ ...value, source: CUSTOM_PRESET, form: { ...form, ...next } });
  const toRule = (f: RakeForm) => {
    const parsed = parseRake(f);
    return parsed.ok ? parsed.rule : null;
  };
  const { choices, selectedId, saved, isNew } = useChargePresets(
    "rake",
    lastRule,
    lastRuleLabel,
    DEFAULT_RAKE_RULE,
    toRakeForm,
    toRule,
    source,
  );
  // Issues show as they are made, not only once the game is started
  const live = parseRake(form);
  const shown: RakeIssues = { ...(live.ok ? {} : live.issues), ...issues };
  /** A title and its switch start a row of the rake grid, and have a line of their own when narrow. */
  const titleCellClass =
    "col-start-1 flex min-h-11 items-center gap-1.5 whitespace-nowrap @max-xs:col-span-full";
  /** A switched-off setting reads faded and struck through. */
  const titleClass = (on: boolean) => cn("font-medium", !on && "text-muted line-through");

  return (
    <section className="@container flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-2">
      <Toggle
        label="抽水"
        {...(locked && { detail: "这局已有抽水记录，不能关闭" })}
        info="按每手底池的比例计算，抽水只计入组织者（Host）"
        checked={enabled}
        disabled={locked}
        accessory={
          enabled && (
            <PresetPicker
              title="抽水配置"
              choices={choices}
              source={selectedId}
              onPick={(preset) => onChange({ ...value, source: preset.id, form: preset.form })}
            />
          )
        }
        onChange={(checked) => onChange({ ...value, enabled: checked })}
      />
      {enabled && (
        <>
          <div className="flex min-h-11 items-center justify-between gap-3">
            <label htmlFor="rake-percent" className="font-medium">
              比例
            </label>
            <span className="flex items-center">
              <InlineNumber
                id="rake-percent"
                label="抽水比例"
                value={form.percent}
                invalid={shown.percent !== undefined}
                suffix="%"
                minChars={2}
                format={(text) => {
                  const percent = Number(text);
                  return text.trim() !== "" && Number.isFinite(percent)
                    ? formatRakeNumber(percent)
                    : text;
                }}
                onChange={(percent) => setForm({ percent })}
              />
              <TextMenu
                label="抽水比例快速选择"
                options={PERCENT_OPTIONS}
                value={PERCENT_OPTIONS.find((o) => Number(o.value) === Number(form.percent))?.value}
                onChange={(percent) => setForm({ percent })}
                align="right"
                className="-mr-4 pr-4 pl-2"
              />
            </span>
          </div>

          {/*
            One grid for the cap and the rounding, so their colons, figures and marks line up.
            On a narrow card each title takes a line of its own, decided by the card's width,
            not by the numbers, so typing never moves anything between lines.
          */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto_auto] items-center">
            <span className={titleCellClass}>
              <span className={titleClass(form.capOn)}>封顶</span>
              <MiniSwitch
                label="封顶"
                hideLabel
                checked={form.capOn}
                onChange={(capOn) => setForm({ capOn })}
              />
            </span>
            {form.capOn && (
              <>
                <Caption>单笔最多收:</Caption>
                <RakeAmountFigures
                  label="封顶"
                  blind="bigBlinds"
                  unit={form.capUnit}
                  amount={form.capAmount}
                  invalid={shown.capAmount !== undefined}
                  stakes={stakes}
                  currency={currency}
                  onChange={(capUnit, capAmount) => setForm({ capUnit, capAmount })}
                />
                <MaxPotLine
                  form={form}
                  stakes={stakes}
                  onCap={(capUnit, capAmount) => setForm({ capUnit, capAmount })}
                />
              </>
            )}

            <span className={titleCellClass}>
              <span className={titleClass(form.roundOn)}>取整</span>
              <MiniSwitch
                label="取整"
                hideLabel
                checked={form.roundOn}
                onChange={(roundOn) => setForm({ roundOn })}
              />
            </span>
            {form.roundOn && (
              <>
                <Caption>最小筹码面值:</Caption>
                <RakeAmountFigures
                  label="最小筹码面值"
                  blind="smallBlinds"
                  unit={form.roundUnit}
                  amount={form.roundAmount}
                  invalid={shown.roundAmount !== undefined}
                  stakes={stakes}
                  currency={currency}
                  onChange={(roundUnit, roundAmount) => setForm({ roundUnit, roundAmount })}
                />
                <Caption>超出部分:</Caption>
                {/* Its chevron sits under the chip mark above */}
                <span className="col-span-5 col-start-3 justify-self-end">
                  <TextMenu
                    label="超出部分"
                    options={RAKE_ROUNDING_OPTIONS}
                    value={form.rounding}
                    onChange={(rounding) => setForm({ rounding })}
                    align="right"
                    className="pr-0.5 text-sm font-medium"
                  />
                </span>
              </>
            )}
          </div>

          <div className="flex min-h-11 items-center justify-between gap-3">
            <span className="flex items-center text-sm text-muted">
              保险报价先扣除抽水
              <InfoButton
                title="保险报价先扣除抽水"
                text={
                  "开启后，算保险时先从底池扣除这一手的抽水，再按剩下的底池报价。\n这项还在开发中，目前开关只记录选择，不影响保险报价。"
                }
              />
            </span>
            <MiniSwitch
              label="开发中"
              checked={form.insuranceAfterRake}
              onChange={(insuranceAfterRake) => setForm({ insuranceAfterRake })}
            />
          </div>

          <SaveChargeConfig
            kind="rake"
            title="抽水"
            takenNames={saved.map((r) => r.name)}
            visible={isNew(form)}
            read={() => toRule(form)}
            onSaved={(id) => onChange({ ...value, source: id })}
          />
        </>
      )}
    </section>
  );
}
