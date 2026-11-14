import {
  type ChargeIssue,
  type Currency,
  DEFAULT_AFTER_HOURS,
  DEFAULT_TABLE_FEE,
  DEFAULT_TIME_SEGMENT,
  DEFAULT_WAGE,
  MAX_WAGE_SEGMENTS,
  MAX_WAGE_SEGMENTS_IN_ALL,
  parseTableFee,
  parseWage,
  type SavedChargeRule,
  type TableFeeForm,
  type TableFeeIssues,
  type TableFeeRule,
  toTableFeeForm,
  toWageForm,
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
import { InfoButton } from "@/components/InfoButton";
import { ChoiceModal } from "@/components/insurance/ChoiceModal";
import { SaveNameDialog } from "@/components/SaveNameDialog";
import { TextField } from "@/components/TextField";
import { TextMenu } from "@/components/TextMenu";
import { Toggle } from "@/components/Toggle";
import {
  newChargeRule,
  useChargeRules,
  useRemoveChargeRule,
  useSaveChargeRule,
} from "@/data/charge-rules";
import { ROUNDING_NAMES, UNIT_NAMES } from "@/lib/charges";
import { cn } from "@/lib/cn";
import { CURRENCY_INFO } from "@/lib/currency";
import { datedName } from "@/lib/dated-name";
import { formatMoneyText, selectOnFocus } from "@/lib/number-input";

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

interface Preset<Form> {
  readonly id: string;
  readonly name: string;
  readonly form: Form;
  readonly removable?: boolean;
}

type ChargeKind = "table_fee" | "wage";

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
  /** 台费 or 工资 */
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
  widthClass = "w-16",
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
  widthClass?: string;
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
        className={cn(
          "min-h-11 border-b bg-transparent text-right font-semibold tabular-nums outline-none focus:border-highlight",
          invalid ? "border-highlight" : "border-line",
          widthClass,
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
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-2">
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
          <div className="grid grid-cols-2 items-start gap-2">
            <TextField
              id="table-fee-amount"
              label="每人台费"
              value={form.amount}
              issue={issueText(issues.amount)}
              prefix={CURRENCY_INFO[currency].symbol}
              inputMode="decimal"
              selectOnFocus
              onBlur={() => {
                const amount = formatMoneyText(form.amount);
                if (amount !== form.amount) setForm({ amount });
              }}
              onChange={(amount) => setForm({ amount })}
            />
            <TextField
              id="table-fee-minutes"
              label="在桌满"
              labelAccessory={
                <InfoButton
                  title="在桌满"
                  text={"建议保留一定时长，防止误添加玩家产生台费。\n0 表示上桌就收。"}
                />
              }
              value={form.minMinutes}
              issue={issueText(issues.minMinutes)}
              suffix="分钟才收"
              inputMode="numeric"
              selectOnFocus
              onChange={(minMinutes) => setForm({ minMinutes })}
            />
          </div>
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

const UNIT_OPTIONS = WAGE_UNITS.map((unit) => ({ value: String(unit), label: UNIT_NAMES[unit] }));

const ROUNDING_OPTIONS = WAGE_ROUNDINGS.map((mode) => ({
  value: mode,
  label: ROUNDING_NAMES[mode],
}));

const ROUNDING_INFO = [
  "每位玩家的在桌时间，从坐下起按计费单位切成一段一段。最后不满一段的部分：",
  "四舍五入：满半段算一段，不满半段不收。",
  "向上取整：不满一段也算一段。",
  "向下取整：不满一段不收。",
  "",
  "一段时间跨两种时薪时，按占时较长的时薪收；一样长时按较高的收。算作一段的不满部分，顺延到离桌之后再比较。",
  "",
  "例如零点前 ¥20、零点后 ¥30，按 30 分钟计费、向上取整，23:16 坐到 0:13：23:16–23:46 按 ¥20；余下 27 分钟算一段（23:46–0:16），零点后占 16 分钟，按 ¥30。",
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
              基础时薪
            </label>
            <InlineNumber
              id="wage-hourly"
              label="基础时薪"
              value={form.hourly}
              invalid={shown.hourly !== undefined}
              prefix={symbol}
              suffix="/小时"
              format={formatMoneyText}
              onChange={(hourly) => setForm({ hourly })}
            />
          </div>
          {shown.hourly && <p className="text-sm text-highlight">{issueText(shown.hourly)}</p>}

          <div className="flex flex-wrap items-center justify-between gap-x-3 text-sm">
            <TextMenu
              label="计费方式"
              caption="计费方式"
              options={UNIT_OPTIONS}
              value={String(form.unitMinutes)}
              onChange={(unit) => setForm({ unitMinutes: Number(unit) as WageUnitMinutes })}
              className="font-medium"
            />
            <span className="flex items-center">
              <InfoButton title="取整方式" text={ROUNDING_INFO} />
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
                label="时段设置"
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
                label="开局时间设置"
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
                          widthClass="w-9"
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
