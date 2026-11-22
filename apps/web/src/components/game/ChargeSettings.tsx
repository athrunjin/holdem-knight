import {
  type ChargeIssue,
  type Currency,
  configInUse,
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
  type RakeAmountUse,
  type RakeForm,
  type RakeIssues,
  type RakeRule,
  rakeAmountChips,
  rakeChipsToBlinds,
  rakeFormForTools,
  rakeFormInBlinds,
  rakeFromPot,
  rakeRuleFromTools,
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
import { ChevronDown, ChevronsUpDown, Plus, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ChipStack } from "@/components/ChipStack";
import { ConfigMenu } from "@/components/ConfigMenu";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { InfoButton } from "@/components/InfoButton";
import { ChoiceModal } from "@/components/insurance/ChoiceModal";
import { MiniSwitch } from "@/components/MiniSwitch";
import { SaveNameDialog } from "@/components/SaveNameDialog";
import { TextMenu } from "@/components/TextMenu";
import { Toggle } from "@/components/Toggle";
import {
  newChargeRule,
  SECTION_OF_KIND,
  useChargeRules,
  useRemoveChargeRule,
  useSaveChargeRule,
} from "@/data/charge-rules";
import { useConfigFollowers } from "@/data/game-configs";
import { t } from "@/i18n";
import { RAKE_ROUNDING_NAMES, ROUNDING_NAMES } from "@/lib/charges";
import { cn } from "@/lib/cn";
import { removalQuestion, updateQuestion } from "@/lib/config-text";
import { CURRENCY_INFO } from "@/lib/currency";
import { datedName } from "@/lib/dated-name";
import { formatMoneyText, numberTyped, selectOnFocus } from "@/lib/number-input";
import { useSettledChange } from "@/lib/settled-change";
import {
  Caption,
  chipsText,
  FIGURE_GRID,
  FIGURE_TITLE_CELL,
  FigureInput,
  figureTitleClass,
  Join,
  Mark,
  pointsInputText,
  pointsText,
  SMALLEST_CHIP_PICKS,
} from "./SetupFigures";

export const LAST_PRESET = "last";
export const DEFAULT_PRESET = "default";
export const CUSTOM_PRESET = "custom";

const ISSUE_TEXT: Record<ChargeIssue, string> = {
  invalid: t.game.chargeSettings.enterAValidNumber,
  "not-positive": t.game.chargeSettings.mustBeMoreThan0,
  "same-hours": t.game.chargeSettings.startAndEndCantBeThe,
  overlap: t.game.chargeSettings.periodsCantOverlapOrAddUp,
  "not-rising": t.game.chargeSettings.eachStepNeedsMoreHoursThan,
  "too-many": t.game.chargeSettings.atMostStepsInAll(MAX_WAGE_SEGMENTS_IN_ALL),
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
  /** Drawn before the name, such as the currency a wage config was set in */
  readonly icon?: ReactNode;
}

type ChargeKind = SavedChargeRule["kind"];

/**
 * What each kind's saved setups are called. The default, last time's and the save button carry
 * it, as in 默认工资设置, so they are told apart from the other sections' and the whole setup's.
 */
export const CONFIG_NAMES: Record<ChargeKind, string> = {
  basics: t.game.chargeSettings.basics,
  table_fee: t.game.chargeSettings.timeChargeSettings,
  wage: t.game.chargeSettings.dealerWageSettings,
  rake: t.game.chargeSettings.rakeSettings,
};

/**
 * Last time's values, the defaults and the saved configs of one kind. Last time goes by its saved
 * name when it was a saved config, as insurance does, and by the config it was taken from where
 * two hold the same values; equal to the default, it goes by the default. Values changed by hand stay with the saved config they started from,
 * which then reads as changed and can take them (ADR 0038).
 */
export function useChargePresets<Rule, Form>(
  kind: ChargeKind,
  last: Rule | undefined,
  lastLabel: string,
  fallback: Rule,
  toForm: (rule: Rule) => Form,
  /** The values as a rule, or null while some are invalid */
  toRule: (form: Form) => Rule | null,
  { source, form }: Pick<ChargeChoice<Form>, "source" | "form">,
  {
    lastSource,
    currency,
  }: {
    /** The saved config last time's values were taken from */
    readonly lastSource?: string | undefined;
    /** The game's currency, where configs are set in one: those in another come last */
    readonly currency?: Currency | undefined;
  } = {},
) {
  const { data: all = [] } = useChargeRules();
  const saved = all.flatMap((r) => (r.kind === kind ? [{ ...r, rule: r.rule as Rule }] : []));
  const same = (a: Rule, b: Rule) => JSON.stringify(toForm(a)) === JSON.stringify(toForm(b));
  const lastSaved = last && configInUse(saved, (r) => same(r.rule, last), lastSource);
  // Last time's values are listed as such only when they are neither a saved config nor the default
  const lastShown = last !== undefined && !lastSaved && !same(last, fallback);
  const lastId = lastShown ? LAST_PRESET : DEFAULT_PRESET;
  const setIn = (r: (typeof saved)[number]) => ("currency" in r ? r.currency : undefined);
  const foreign = (r: (typeof saved)[number]) =>
    currency !== undefined && setIn(r) !== undefined && setIn(r) !== currency;
  const choices: Preset<Form>[] = [
    ...(lastShown ? [{ id: LAST_PRESET, name: lastLabel, form: toForm(last) }] : []),
    {
      id: DEFAULT_PRESET,
      name: t.game.chargeSettings.default(CONFIG_NAMES[kind]),
      form: toForm(fallback),
    },
    ...[...saved.filter((r) => !foreign(r)), ...saved.filter(foreign)].map((r) => {
      const mark = setIn(r);
      return {
        id: r.id,
        name: r.name,
        form: toForm(r.rule),
        removable: true,
        ...(mark && {
          icon: <CurrencyIcon currency={mark} className="size-4 shrink-0 text-muted" />,
        }),
      };
    }),
  ];
  const selectedId = source === LAST_PRESET ? (lastSaved?.id ?? lastId) : source;
  /** The saved config the values are with, whether or not they still equal it. */
  const base = saved.find((r) => r.id === selectedId);
  const rule = toRule(form);
  const modified = base !== undefined && (rule === null || !same(rule, base.rule));
  /** Where values changed by hand belong: with their saved config, or with none. */
  const editedSource = base ? base.id : CUSTOM_PRESET;
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
  return { choices, selectedId, saved, isNew, base, modified, editedSource };
}

/**
 * Where the values came from, beside the switch like insurance's, and a way to switch: a list right
 * under the name, or a dialog once there are many saved ones (`ConfigMenu`). A saved one is deleted
 * from the list, after asking.
 */
export function PresetPicker<Form>({
  kind,
  title,
  choices,
  source,
  modified = false,
  onPick,
}: {
  kind: ChargeKind;
  title: string;
  choices: readonly Preset<Form>[];
  source: string;
  /** The values were changed by hand since they were taken from the saved config in use */
  modified?: boolean;
  onPick: (preset: Preset<Form>) => void;
}) {
  const removeRule = useRemoveChargeRule();
  const followers = useConfigFollowers();

  return (
    <ConfigMenu
      label={title}
      choices={choices}
      selectedId={source}
      modified={modified}
      onPick={(id) => {
        const preset = choices.find((choice) => choice.id === id);
        if (preset) onPick(preset);
      }}
      onRemove={(id) => {
        const preset = choices.find((choice) => choice.id === id);
        const using = followers({ section: SECTION_OF_KIND[kind], id });
        if (preset && window.confirm(removalQuestion(t.common.settings, preset.name, using))) {
          removeRule.mutate(id);
        }
      }}
      align="right"
      className="text-sm"
    />
  );
}

/**
 * 保存工资设置 and the like at the foot of an option: names its values and keeps them for later games. Shown only
 * for a valid change, one that matches no preset already on offer. Values changed from a saved
 * config can go back into it with 更新, when keeping them under a new name reads 另存为.
 */
export function SaveChargeConfig({
  kind,
  takenNames,
  visible,
  base,
  modified = false,
  currency,
  note,
  read,
  onSaved,
}: {
  kind: ChargeKind;
  visible: boolean;
  takenNames: readonly string[];
  /** The saved config the values were taken from, which 更新 saves them into */
  base?: { readonly id: string; readonly name: string } | undefined;
  /** Whether the values differ from that config's */
  modified?: boolean;
  /** The currency the values are set in, kept with a table fee or wage config */
  currency?: Currency;
  /** Said after the name's label, such as what of the values is left out of the config */
  note?: string;
  /** The values as a rule, or null when some are invalid */
  read: () => Parameters<typeof newChargeRule>[1]["rule"] | null;
  onSaved: (id: string) => void;
}) {
  const { data: all = [] } = useChargeRules();
  const saveRule = useSaveChargeRule();
  const followers = useConfigFollowers();
  const [naming, setNaming] = useState(false);
  const named = CONFIG_NAMES[kind];
  const fieldsOf = (rule: NonNullable<ReturnType<typeof read>>) =>
    ({ kind, rule, ...(currency && { currency }) }) as Parameters<typeof newChargeRule>[1];
  const updating = base !== undefined && modified && read() !== null;

  /** Game configs that follow the config take its new values, so that is asked about first. */
  function handleUpdate() {
    const rule = read();
    const existing = all.find((r) => r.id === base?.id);
    if (!rule || !existing) return;
    const using = followers({ section: SECTION_OF_KIND[kind], id: existing.id });
    if (using > 0 && !window.confirm(updateQuestion(existing.name, using))) return;
    saveRule.mutate({ ...existing, ...fieldsOf(rule) } as SavedChargeRule, {
      onSuccess: () => onSaved(existing.id),
    });
  }

  function handleSave(name: string) {
    const rule = read();
    if (!rule) return t.game.chargeSettings.someSettingsArentValid;
    const existing = all.find((r) => r.kind === kind && r.name === name);
    const fields = fieldsOf(rule);
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

  if (!visible && !updating && !naming) return null;

  return (
    <>
      <div className="flex min-w-0 justify-end gap-5">
        {updating && (
          <button
            type="button"
            disabled={saveRule.isPending}
            onClick={handleUpdate}
            className="min-h-11 min-w-0 truncate text-sm font-medium text-highlight disabled:opacity-60"
          >
            {t.game.chargeSettings.update(base.name)}
          </button>
        )}
        {(visible || naming) && (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="min-h-11 shrink-0 text-sm font-medium text-highlight"
          >
            {updating ? t.game.chargeSettings.saveAs : t.game.chargeSettings.save(named)}
          </button>
        )}
      </div>
      {saveRule.isError && !naming && (
        <p role="alert" className="text-right text-sm text-highlight">
          {t.common.couldntSaveTryAgain}
        </p>
      )}
      {naming && (
        <SaveNameDialog
          title={t.game.chargeSettings.saveTheseToApplyQuicklyNext(named)}
          label={
            note
              ? t.game.chargeSettings.nameAnExistingNameIsOverwritten(note)
              : t.game.chargeSettings.nameAnExistingNameIsOverwritten2
          }
          initialName={datedName(named, new Set(takenNames))}
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
  /** Only digits get through, where otherwise a decimal point does too */
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
        onChange={(event) => onChange(numberTyped(event.target.value, wholeNumber))}
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
  hour === 0
    ? t.game.chargeSettings.n000Midnight
    : hour === 12
      ? t.game.chargeSettings.n1200Noon
      : t.game.chargeSettings.n00(hour);
const HOURS = Array.from({ length: 24 }, (_, hour) => ({ id: String(hour), name: hourName(hour) }));
const NO_END = "";
const NO_END_NAME = t.game.chargeSettings.noEndTime;

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
  const name = value === NO_END ? t.game.chargeSettings.noEnd : hourName(Number(value));

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`${title}${t.common.colon}${value === NO_END ? NO_END_NAME : name}`}
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
  /** The saved config that rule was taken from, which names it where another holds the same */
  lastSource?: string | undefined;
  onChange: (value: ChargeChoice<Form>) => void;
}

/** Turns the table fee on for a game and sets its amount and minimum time. */
export function TableFeeSettings({
  value,
  issues,
  currency,
  lastRule,
  lastRuleLabel,
  lastSource,
  onChange,
}: ChargeSettingsProps<TableFeeRule, TableFeeForm, TableFeeIssues>) {
  const { enabled, form } = value;
  const minutes = Number(form.minMinutes) || 0;
  // Issues show as they are made, not only once the game is started
  const live = parseTableFee(form);
  const shown: TableFeeIssues = { ...(live.ok ? {} : live.issues), ...issues };
  const { choices, selectedId, saved, isNew, base, modified, editedSource } = useChargePresets(
    "table_fee",
    lastRule,
    lastRuleLabel,
    DEFAULT_TABLE_FEE,
    toTableFeeForm,
    (f) => {
      const parsed = parseTableFee(f);
      return parsed.ok ? parsed.rule : null;
    },
    value,
    { lastSource, currency },
  );
  const setForm = (next: Partial<TableFeeForm>) =>
    onChange({ ...value, source: editedSource, form: { ...form, ...next } });

  return (
    <section className="flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-2">
      <Toggle
        label={t.common.timeCharge}
        info={t.game.chargeSettings.chargedOncePerPlayerPerGame}
        checked={enabled}
        accessory={
          enabled && (
            <PresetPicker
              kind="table_fee"
              title={t.game.chargeSettings.timeChargeSettings}
              choices={choices}
              source={selectedId}
              modified={modified}
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
                {t.game.chargeSettings.baseCharge}
              </label>
              {minutes === 0 && (
                <span className="text-xs text-highlight">
                  {t.game.chargeSettings.chargedOnSittingDown}
                </span>
              )}
            </span>
            <InlineNumber
              id="table-fee-amount"
              label={t.game.chargeSettings.baseCharge}
              value={form.amount}
              invalid={shown.amount !== undefined}
              prefix={CURRENCY_INFO[currency].symbol}
              suffix={t.game.chargeSettings.playerGame}
              minChars={6}
              format={formatMoneyText}
              onChange={(amount) => setForm({ amount })}
            />
          </div>
          {shown.amount && <p className="text-sm text-highlight">{issueText(shown.amount)}</p>}
          {/* Fixed at 5 minutes; a game set up with another time keeps it */}
          <Toggle
            label={t.game.chargeSettings.chargedAfterMinAtTheTable(
              minutes > 0 ? minutes : DEFAULT_TABLE_FEE.minMinutes,
            )}
            detail={t.game.chargeSettings.keepsAPlayerAddedByMistake}
            checked={minutes > 0}
            onChange={(on) =>
              setForm({ minMinutes: on ? String(DEFAULT_TABLE_FEE.minMinutes) : "0" })
            }
          />
          <SaveChargeConfig
            kind="table_fee"
            takenNames={saved.map((r) => r.name)}
            visible={isNew(form)}
            base={base}
            modified={modified}
            currency={currency}
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
  1: t.game.chargeSettings.perMinute,
  15: t.game.chargeSettings.per15Min,
  30: t.game.chargeSettings.per30Min,
  60: t.game.chargeSettings.perHour,
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
  t.game.chargeSettings.eachPlayersTimeAtTheTable,
  t.game.chargeSettings.roundHalfABlockOrMore,
  t.game.chargeSettings.roundUpAnyPartOfA,
  t.game.chargeSettings.roundDownAPartOfA,
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
  lastSource,
  onChange,
}: ChargeSettingsProps<WageRule, WageForm, WageIssues>) {
  const { enabled, form } = value;
  const [segmentsOpen, setSegmentsOpen] = useState(false);
  const symbol = CURRENCY_INFO[currency].symbol;
  const { choices, selectedId, saved, isNew, base, modified, editedSource } = useChargePresets(
    "wage",
    lastRule,
    lastRuleLabel,
    DEFAULT_WAGE,
    toWageForm,
    (f) => {
      const parsed = parseWage(f);
      return parsed.ok ? parsed.rule : null;
    },
    value,
    { lastSource, currency },
  );
  const setForm = (next: Partial<WageForm>) =>
    onChange({ ...value, source: editedSource, form: { ...form, ...next } });

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
        label={t.common.dealerWage}
        info={t.game.chargeSettings.workedOutFromEachPlayersTime}
        checked={enabled}
        accessory={
          enabled && (
            <PresetPicker
              kind="wage"
              title={t.game.chargeSettings.dealerWageSettings}
              choices={choices}
              source={selectedId}
              modified={modified}
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
              {t.game.chargeSettings.baseRate}
            </label>
            <InlineNumber
              id="wage-hourly"
              label={t.game.chargeSettings.baseRate}
              value={form.hourly}
              invalid={shown.hourly !== undefined}
              prefix={symbol}
              suffix={t.game.chargeSettings.hr}
              format={formatMoneyText}
              onChange={(hourly) => setForm({ hourly })}
            />
          </div>
          {shown.hourly && <p className="text-sm text-highlight">{issueText(shown.hourly)}</p>}

          <div className="-mt-2 flex flex-wrap items-center justify-between gap-x-3 text-sm">
            <TextMenu
              label={t.game.chargeSettings.countBy}
              caption={t.game.chargeSettings.countBy}
              options={UNIT_OPTIONS}
              value={String(form.unitMinutes)}
              onChange={(unit) => setForm({ unitMinutes: Number(unit) as WageUnitMinutes })}
              className="font-medium"
            />
            <span className="flex items-center">
              <span className="mr-1 flex items-center text-xs text-muted">
                <InfoButton title={t.game.chargeSettings.leftover} text={ROUNDING_INFO} inline />
                {t.game.chargeSettings.leftover}
              </span>
              <TextMenu
                label={t.game.chargeSettings.rounding}
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
            {t.game.chargeSettings.steppedRates}
            <ChevronDown
              className={cn("size-5 text-muted transition-transform", expanded && "rotate-180")}
              aria-hidden
            />
          </button>

          {expanded && (
            <div className="flex flex-col gap-1 pb-2">
              {form.timeOn && form.afterOn && (
                <p className="text-sm text-highlight">
                  {t.game.chargeSettings.withBothOnWhicheverHigherRate}
                </p>
              )}
              {shown.segments && (
                <p className="text-sm text-highlight">{issueText(shown.segments)}</p>
              )}

              <Toggle
                label={t.game.chargeSettings.byTimeOfDay}
                info={t.game.chargeSettings.byTheTimeWhereTheGame}
                checked={form.timeOn}
                onChange={(on) => switchKind("time", on)}
              />
              {form.timeOn && (
                <>
                  <ul className="flex flex-col">
                    {time.map((row, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: rows are places in a chain
                      <li key={i} className="flex flex-wrap items-center gap-x-1 text-sm">
                        <span className="text-muted">{t.game.chargeSettings.from}</span>
                        {i === 0 ? (
                          <HourPicker
                            title={t.game.chargeSettings.startTime}
                            value={row.fromHour}
                            onChange={(fromHour) => setTime(i, { fromHour })}
                          />
                        ) : (
                          <span className="font-medium">{hourName(Number(row.fromHour))}</span>
                        )}
                        <span className="text-muted">{t.game.chargeSettings.to}</span>
                        <HourPicker
                          title={t.game.chargeSettings.endTime}
                          value={row.toHour}
                          allowNoEnd={i === time.length - 1}
                          except={row.fromHour}
                          onChange={(toHour) => setTime(i, { toHour })}
                        />
                        <span className="ml-auto flex items-center">
                          {/* Before the rate, so every rate lines up on the right with the base rate */}
                          {i > 0 && (
                            <SmallButton
                              label={t.game.chargeSettings.deleteStep(i + 1)}
                              onClick={() => setForm({ timeSegments: time.slice(0, i) })}
                            >
                              <X className="size-4" aria-hidden />
                            </SmallButton>
                          )}
                          <InlineNumber
                            id={`wage-time-${i}`}
                            label={t.game.chargeSettings.hourlyRateOfStep(i + 1)}
                            value={row.hourly}
                            invalid={shown[`time-${i}-hourly`] !== undefined}
                            prefix={symbol}
                            suffix={t.game.chargeSettings.hr}
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
                      label={t.game.chargeSettings.addAPeriod}
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
                label={t.game.chargeSettings.byTimePlayed}
                info={t.game.chargeSettings.byTheGameClockPausesDont}
                checked={form.afterOn}
                onChange={(on) => switchKind("after", on)}
              />
              {form.afterOn && (
                <>
                  <ul className="flex flex-col">
                    {after.map((row, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: rows are places in a list
                      <li key={i} className="flex items-center gap-x-1 text-sm">
                        <span className="text-muted">{t.game.chargeSettings.start}</span>
                        <InlineNumber
                          id={`wage-after-hours-${i}`}
                          label={t.game.chargeSettings.hoursIntoTheGameForStep(i + 1)}
                          value={row.afterHours}
                          invalid={shown[`after-${i}-afterHours`] !== undefined}
                          wholeNumber
                          minChars={2}
                          onChange={(afterHours) => setAfter(i, { afterHours })}
                        />
                        <span className="text-muted">{t.game.chargeSettings.hrIn}</span>
                        <span className="ml-auto flex items-center">
                          {/* Before the rate, so every rate lines up on the right with the base rate */}
                          {i > 0 && (
                            <SmallButton
                              label={t.game.chargeSettings.deleteStep(i + 1)}
                              onClick={() =>
                                setForm({ afterSegments: after.filter((_, j) => j !== i) })
                              }
                            >
                              <X className="size-4" aria-hidden />
                            </SmallButton>
                          )}
                          <InlineNumber
                            id={`wage-after-${i}`}
                            label={t.game.chargeSettings.hourlyRateOfStep(i + 1)}
                            value={row.hourly}
                            invalid={shown[`after-${i}-hourly`] !== undefined}
                            prefix={symbol}
                            suffix={t.game.chargeSettings.hr}
                            format={formatMoneyText}
                            onChange={(hourly) => setAfter(i, { hourly })}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                  {(shown.after || after.some((_, i) => shown[`after-${i}-afterHours`])) && (
                    <p className="text-sm text-highlight">
                      {shown.after
                        ? issueText(shown.after)
                        : t.game.chargeSettings.hoursMustBeAWholeNumber}
                    </p>
                  )}
                  {canAddAfter && (
                    <SmallButton
                      label={t.game.chargeSettings.addAStep}
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
            takenNames={saved.map((r) => r.name)}
            visible={isNew(form)}
            base={base}
            modified={modified}
            currency={currency}
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

const RAKE_ROUNDING_INFO = [
  t.game.chargeSettings.afterEachHandsRakeIsWorked,
  t.game.chargeSettings.roundHalfAChipOrMore,
  t.game.chargeSettings.roundDownThePartIsDropped,
  t.game.chargeSettings.roundUpAnyPartGoesUp,
  t.game.chargeSettings.theCapIsRoundedDownTo,
  t.game.chargeSettings.withRoundingOffTheRakeIs,
].join("\n");

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
 * follows. A tap on the chip mark shows points instead. The blinds are what is kept, so the amount
 * follows the game's blinds: chips or points typed are turned into blinds (ADR 0039). The chips
 * read as the rule uses them, in whole chips. An amount kept in chips from before shows as it is
 * until it is typed over.
 */
function RakeAmountFigures({
  label,
  blind,
  use,
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
  /** What the amount is for, which decides how its blinds come to whole chips */
  use: RakeAmountUse;
  unit: RakeAmount["unit"];
  amount: string;
  invalid: boolean;
  stakes: RakeStakes;
  currency: Currency;
  onChange: (unit: RakeAmount["unit"], amount: string) => void;
}) {
  const [inPoints, setInPoints] = useState(false);
  // Chips or points being typed, from which the blinds are worked out
  const [draft, setDraft] = useState<string | null>(null);
  const { ratio } = stakes;
  const typed = Number(amount);
  const known = amount.trim() !== "" && Number.isFinite(typed);
  const raw = known ? (rakeAmountChips({ unit, amount: typed }, blindsOf(stakes)) ?? null) : null;
  // As the rule uses them: a cap rounds down to whole chips, a smallest chip to the nearest
  const chips =
    raw === null || unit === "chips"
      ? raw
      : use === "cap"
        ? Math.floor(raw)
        : Math.max(1, Math.round(raw));
  const blindChips = blind === "smallBlinds" ? stakes.smallBlindChips : stakes.bigBlindChips;
  const blinds = !known
    ? null
    : unit === blind
      ? typed
      : blindChips && raw !== null
        ? raw / blindChips
        : null;
  const points = chips !== null && ratio ? Math.round((chips * ratio.amount) / ratio.chips) : null;
  const right =
    draft ??
    (inPoints
      ? points === null
        ? ""
        : pointsText(points)
      : chips === null
        ? ""
        : formatRakeNumber(chips));
  const mark = blind === "smallBlinds" ? "SB" : "BB";

  /** Chips typed, or points turned into chips, are kept as the blinds they come to. */
  function typeRight(text: string) {
    setDraft(text);
    if (!blindChips) return;
    const cents = inPoints ? tryParseMoney(text) : null;
    const typedChips = inPoints
      ? cents !== null && cents > 0 && ratio
        ? Math.max(1, Math.round((cents * ratio.chips) / ratio.amount))
        : null
      : parseChips(text);
    if (typedChips === null || typedChips <= 0) return;
    onChange(blind, formatRakeNumber(rakeChipsToBlinds(typedChips, blindChips, use).amount));
  }

  // Five cells of the rake grid: blinds, their mark, ⇔, chips or points, and the switching mark
  return (
    <span className="contents font-medium">
      <FigureInput
        label={`${label}${t.common.openParen}${mark}${t.common.closeParen}`}
        value={unit === blind ? amount : blinds === null ? "" : blindText(blinds)}
        onChange={(text) => onChange(blind, text)}
        invalid={invalid}
      />
      <Mark>{mark}</Mark>
      <Join>
        <span aria-hidden className="text-xl leading-none">
          ⇔
        </span>
        <span className="sr-only">{t.common.equals}</span>
      </Join>
      <FigureInput
        label={`${label}${t.common.openParen}${inPoints ? t.game.chargeSettings.currency : t.common.chips}${t.common.closeParen}`}
        value={right}
        onChange={typeRight}
        onBlur={() => setDraft(null)}
        tidy={inPoints ? pointsInputText : chipsText}
        // With no blind to go by there is nothing to keep what is typed as
        disabled={!blindChips}
        wholeNumber={!inPoints}
        wide
      />
      <button
        type="button"
        aria-label={t.game.chargeSettings.showingAsTapToSwitch(
          label,
          inPoints ? t.game.chargeSettings.currency : t.common.chips,
        )}
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

/**
 * Under the cap: the pot whose rake, before rounding, is the cap, in chips whatever the cap shows.
 * Typing a pot sets the cap to that pot's rate, kept in blinds wherever there is a blind to go by,
 * so the pot comes back as typed. Rounding can make the rake reach the cap a little sooner.
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
    const unit = form.capUnit === "chips" ? "bigBlinds" : form.capUnit;
    const blind = rakeAmountChips({ unit, amount: 1 }, blinds);
    if (blind) onCap(unit, blindText(chips / blind));
    else onCap("chips", String(Math.max(1, Math.round(chips))));
  }

  // A row of the rake grid: its caption, then the pot under the chips above it
  return (
    <span className="contents font-medium">
      <Caption>{t.game.chargeSettings.equalToAPotOf}</Caption>
      <span className="col-start-6">
        <FigureInput
          label={t.game.chargeSettings.equalToAPotOfChips}
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

/** No blinds and no ratio, as in the tools. */
export const NO_STAKES: RakeStakes = { smallBlindChips: null, bigBlindChips: null, ratio: null };

/**
 * The rule of a choice, its presets and whether its values make a new one: what both the setup
 * card and 抽水计算 show the rule by. A config keeps its amounts in blinds (ADR 0039), so values
 * count as the config they would be kept as: at a game, with chips turned into blinds; in the
 * tools, which have no blinds, without the chips typed there.
 */
function useRakePresets(
  value: ChargeChoice<RakeForm>,
  lastRule: RakeRule | undefined,
  lastRuleLabel: string,
  lastSource: string | undefined,
  stakes: RakeStakes,
  /** In the tools, with no blinds */
  chipsOnly: boolean,
) {
  const blinds = blindsOf(stakes);
  const toRule = (f: RakeForm) => {
    const parsed = parseRake(f);
    return parsed.ok ? parsed.rule : null;
  };
  const presets = useChargePresets(
    "rake",
    lastRule,
    lastRuleLabel,
    DEFAULT_RAKE_RULE,
    toRakeForm,
    toRule,
    value,
    { lastSource },
  );
  const { base } = presets;
  /** A config on offer as it is kept now: one from before, in chips, counts in blinds at a game. */
  const offered = (form: RakeForm) => toRule(chipsOnly ? form : rakeFormInBlinds(form, blinds));
  /** The rule the values would be kept as in a config, or null while they are invalid. */
  const kept = (form: RakeForm) =>
    chipsOnly ? rakeRuleFromTools(form, base?.rule) : toRule(rakeFormInBlinds(form, blinds));
  /** A config's values as they show once picked, given the values in use. */
  const shown = (config: RakeForm, current: RakeForm) =>
    chipsOnly ? rakeFormForTools(config, current) : rakeFormInBlinds(config, blinds);
  /** The values as they stay on show once a config has been saved from them. */
  const afterSaving = (form: RakeForm) => (chipsOnly ? form : rakeFormInBlinds(form, blinds));
  const isNew = (form: RakeForm) => {
    const rule = kept(form);
    if (!rule) return false;
    const text = JSON.stringify(rule);
    return !presets.choices.some((c) => JSON.stringify(offered(c.form)) === text);
  };
  const modified =
    base !== undefined &&
    JSON.stringify(kept(value.form)) !== JSON.stringify(offered(toRakeForm(base.rule)));
  return { ...presets, isNew, toRule, kept, shown, afterSaving, modified };
}

/**
 * The rake rule's fields: 比例, then 封顶 and 取整 in one grid so their colons, figures and marks
 * line up, 保险报价先扣除抽水 and 保存抽水设置. With `chipsOnly`, as in the tools with no blinds, the cap
 * and the smallest chip are in chips alone, and the smallest chip has common ones a tap away.
 */
function RakeFields({
  value,
  issues,
  currency,
  stakes,
  chipsOnly = false,
  stacked = false,
  presets,
  onChange,
}: {
  value: ChargeChoice<RakeForm>;
  issues: RakeIssues;
  currency: Currency;
  stakes: RakeStakes;
  chipsOnly?: boolean;
  /** Each title on a line of its own, where the box is narrower than a setup card, as in a dialog */
  stacked?: boolean;
  presets: ReturnType<typeof useRakePresets>;
  onChange: (value: ChargeChoice<RakeForm>) => void;
}) {
  const { form } = value;
  // A change that leaves what a config would keep as it was keeps the config's name: values held
  // for a switch that is off, and in the tools the chips typed there
  const setForm = (next: Partial<RakeForm>) => {
    const changed = { ...form, ...next };
    const same = JSON.stringify(presets.kept(changed)) === JSON.stringify(presets.kept(form));
    onChange({ ...value, source: same ? value.source : presets.editedSource, form: changed });
  };
  // Issues show as they are made, not only once the game is started
  const live = parseRake(form);
  const shown: RakeIssues = { ...(live.ok ? {} : live.issues), ...issues };
  const titleCell = cn(FIGURE_TITLE_CELL, stacked && "col-span-full");
  // A cap under one smallest chip rounds down to nothing, and the rule then takes no rake at all
  const takesNothing =
    form.capOn && live.ok && rakeFromPot(1_000_000_000, live.rule, blindsOf(stakes)) === 0;

  /** A figure in chips alone, under the chips of the rows with blinds, then what follows it. */
  const chipsFigure = (
    label: string,
    amount: string,
    invalid: boolean,
    onAmount: (amount: string) => void,
    after: ReactNode,
  ) => (
    <span className="contents font-medium">
      <span className="col-start-6">
        <FigureInput
          label={t.game.chargeSettings.chips(label)}
          value={amount}
          onChange={onAmount}
          tidy={chipsText}
          invalid={invalid}
          wholeNumber
          wide
        />
      </span>
      {after}
    </span>
  );

  return (
    <>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <label htmlFor="rake-percent" className="font-medium">
          {t.game.chargeSettings.ratio}
        </label>
        <span className="flex items-center">
          <InlineNumber
            id="rake-percent"
            label={t.game.chargeSettings.rake}
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
            label={t.game.chargeSettings.quickRake}
            options={PERCENT_OPTIONS}
            value={PERCENT_OPTIONS.find((o) => Number(o.value) === Number(form.percent))?.value}
            onChange={(percent) => setForm({ percent })}
            align="right"
            className="-mr-4 pr-4 pl-2"
          />
        </span>
      </div>
      {shown.percent && (
        <p role="alert" className="text-right text-sm text-highlight">
          {t.game.chargeSettings.mustBeMoreThan0And}
        </p>
      )}

      {/*
        One grid for the cap and the rounding, so their colons, figures and marks line up.
        On a narrow card each title takes a line of its own, decided by the screen's width,
        not by the numbers, so typing never moves anything between lines.
      */}
      <div className={FIGURE_GRID}>
        <span className={titleCell}>
          <span className={figureTitleClass(form.capOn)}>{t.game.chargeSettings.cap}</span>
          <MiniSwitch
            label={t.game.chargeSettings.cap}
            hideLabel
            checked={form.capOn}
            onChange={(capOn) => setForm({ capOn })}
          />
        </span>
        {form.capOn && (
          <>
            <Caption>{t.game.chargeSettings.atMostPerPot}</Caption>
            {chipsOnly ? (
              chipsFigure(
                t.game.chargeSettings.cap,
                form.capAmount,
                shown.capAmount !== undefined,
                (capAmount) => setForm({ capUnit: "chips", capAmount }),
                <Mark>
                  <ChipStack ground="var(--surface)" className="size-5" />
                </Mark>,
              )
            ) : (
              <RakeAmountFigures
                label={t.game.chargeSettings.cap}
                blind="bigBlinds"
                use="cap"
                unit={form.capUnit}
                amount={form.capAmount}
                invalid={shown.capAmount !== undefined}
                stakes={stakes}
                currency={currency}
                onChange={(capUnit, capAmount) => setForm({ capUnit, capAmount })}
              />
            )}
            <MaxPotLine
              form={form}
              stakes={stakes}
              onCap={(capUnit, capAmount) => setForm({ capUnit, capAmount })}
            />
          </>
        )}

        {takesNothing && (
          <p role="alert" className="col-span-full pb-1 text-right text-xs text-highlight">
            {t.game.chargeSettings.theCapIsUnderOneSmallest}
          </p>
        )}

        <span className={titleCell}>
          <span className={figureTitleClass(form.roundOn)}>{t.game.chargeSettings.rounding2}</span>
          <MiniSwitch
            label={t.game.chargeSettings.rounding2}
            hideLabel
            checked={form.roundOn}
            onChange={(roundOn) => setForm({ roundOn })}
          />
        </span>
        {form.roundOn && (
          <>
            <Caption>{t.game.chargeSettings.smallestChip}</Caption>
            {chipsOnly ? (
              chipsFigure(
                t.game.chargeSettings.smallestChip2,
                form.roundAmount,
                shown.roundAmount !== undefined,
                (roundAmount) => setForm({ roundUnit: "chips", roundAmount }),
                <span className="justify-self-end">
                  <TextMenu
                    label={t.game.chargeSettings.quickSmallestChip}
                    options={SMALLEST_CHIP_PICKS}
                    value={
                      SMALLEST_CHIP_PICKS.find((pick) => pick.value === form.roundAmount.trim())
                        ?.value
                    }
                    onChange={(roundAmount) => setForm({ roundUnit: "chips", roundAmount })}
                    align="right"
                    className="pr-0.5 text-sm"
                  />
                </span>,
              )
            ) : (
              <RakeAmountFigures
                label={t.game.chargeSettings.smallestChip2}
                blind="smallBlinds"
                use="smallestChip"
                unit={form.roundUnit}
                amount={form.roundAmount}
                invalid={shown.roundAmount !== undefined}
                stakes={stakes}
                currency={currency}
                onChange={(roundUnit, roundAmount) => setForm({ roundUnit, roundAmount })}
              />
            )}
            <Caption>
              <InfoButton title={t.game.chargeSettings.leftover} text={RAKE_ROUNDING_INFO} inline />
              {t.game.chargeSettings.leftover2}
            </Caption>
            {/* Its chevron sits under the chip mark above */}
            <span className="col-span-5 col-start-3 justify-self-end">
              <TextMenu
                label={t.game.chargeSettings.leftover}
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
          {t.game.chargeSettings.takeRakeBeforeQuotingInsurance}
          <InfoButton
            title={t.game.chargeSettings.takeRakeBeforeQuotingInsurance}
            text={t.game.chargeSettings.whenOnAHandsRakeComes}
          />
        </span>
        {/* Not in effect yet, so held off whatever a rule from before has kept */}
        <MiniSwitch
          label={t.game.chargeSettings.inProgress}
          checked={false}
          disabled
          onChange={() => undefined}
        />
      </div>

      <SaveChargeConfig
        kind="rake"
        takenNames={presets.saved.map((r) => r.name)}
        visible={presets.isNew(form)}
        base={presets.base}
        modified={presets.modified}
        {...(chipsOnly && { note: t.game.chargeSettings.theCapAndTheSmallestChip })}
        read={() => presets.kept(form)}
        onSaved={(id) => onChange({ ...value, source: id, form: presets.afterSaving(form) })}
      />
    </>
  );
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
  lastSource,
  locked,
  stakes,
  onChange,
}: RakeSettingsProps) {
  const { enabled } = value;
  const presets = useRakePresets(value, lastRule, lastRuleLabel, lastSource, stakes, false);

  return (
    <section className="flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-2">
      <Toggle
        label={t.common.rake}
        {...(locked && { detail: t.game.chargeSettings.thisGameAlreadyHasRakeRecorded })}
        info={t.game.chargeSettings.aPercentageOfEachPotRake}
        checked={enabled}
        disabled={locked}
        accessory={
          enabled && (
            <PresetPicker
              kind="rake"
              title={t.game.chargeSettings.rakeSettings}
              choices={presets.choices}
              source={presets.selectedId}
              modified={presets.modified}
              onPick={(preset) =>
                onChange({
                  ...value,
                  source: preset.id,
                  form: presets.shown(preset.form, value.form),
                })
              }
            />
          )
        }
        onChange={(checked) => onChange({ ...value, enabled: checked })}
      />
      {enabled && (
        <RakeFields
          value={value}
          issues={issues}
          currency={currency}
          stakes={stakes}
          presets={presets}
          onChange={onChange}
        />
      )}
    </section>
  );
}

interface RakeSettingsPanelProps {
  /** The settings in use, and the preset they came from */
  value: ChargeChoice<RakeForm>;
  currency: Currency;
  stakes: RakeStakes;
  /** In the tools, with no blinds: amounts in chips alone */
  chipsOnly?: boolean;
  /** Offered as "last time", such as this game's own rule */
  lastRule?: RakeRule | undefined;
  lastRuleLabel?: string;
  /** The saved config that rule was taken from */
  lastSource?: string | undefined;
  /** Open at first, as in the tools; a game's start closed */
  defaultOpen: boolean;
  /**
   * A change. Returns false to turn it down, when it shows the settings as they were. While a
   * number is being typed, the change comes once the field is left, so it is asked about once.
   */
  onChange: (value: ChargeChoice<RakeForm>) => boolean | undefined;
}

/**
 * 抽水计算's title line and settings: `抽水计算 · preset ⇅`, where a tap on the preset lists the
 * others in the page and one more switches to it (in a dialog once there are many saved ones), and at the end of the line a chevron that opens
 * the same fields as game setup. Switching preset opens them, to show what it set.
 */
export function RakeSettingsPanel({
  value,
  currency,
  stakes,
  chipsOnly = false,
  lastRule,
  lastRuleLabel = t.game.chargeSettings.lastRakeSettings,
  lastSource,
  defaultOpen,
  onChange,
}: RakeSettingsPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const settled = useSettledChange(value, onChange);
  const shown = settled.value;
  const presets = useRakePresets(shown, lastRule, lastRuleLabel, lastSource, stakes, chipsOnly);
  function pick(id: string) {
    const preset = presets.choices.find((choice) => choice.id === id);
    if (!preset) return;
    settled.change({ ...shown, source: preset.id, form: presets.shown(preset.form, shown.form) });
    setOpen(true);
  }

  return (
    <div className="flex flex-col gap-1" {...settled.containerProps}>
      <div className="-mt-2 -mr-3 flex items-center gap-1.5">
        <h2 className="shrink-0 text-lg font-semibold">{t.game.chargeSettings.rakeCalculator}</h2>
        <span aria-hidden className="text-muted">
          ·
        </span>
        <ConfigMenu
          label={t.game.chargeSettings.rakeSettings}
          choices={presets.choices.map(({ id, name, removable }) => ({
            id,
            name,
            ...(removable && { removable }),
          }))}
          selectedId={presets.selectedId}
          modified={presets.modified}
          onPick={pick}
          icon={<ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden />}
          className="font-medium"
        />
        <button
          type="button"
          aria-label={t.game.chargeSettings.showRakeSettings}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="ml-auto grid size-11 shrink-0 place-items-center text-muted"
        >
          <ChevronDown
            className={cn("size-5 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-1 rounded-xl border border-line px-3 py-1">
          <RakeFields
            value={shown}
            issues={{}}
            currency={currency}
            stakes={stakes}
            chipsOnly={chipsOnly}
            stacked
            presets={presets}
            onChange={settled.change}
          />
        </div>
      )}
    </div>
  );
}
