import {
  type BasicSettings,
  CURRENCIES,
  type Currency,
  chipsToCents,
  DEFAULT_GAME_SETTINGS,
  type GameSettingsForm as FormValues,
  type GameSettings,
  type InsuranceRule,
  type InsuranceRuleIssues,
  parseChips,
  parseGameSettings,
  parseInsuranceRule,
  parseRake,
  parseTableFee,
  parseWage,
  type RakeIssues,
  type RakeRule,
  type SettingsSection,
  type TableFeeIssues,
  type TableFeeRule,
  toGameSettingsForm,
  tryParseMoney,
  type WageIssues,
  type WageRule,
  withSettingsSources,
} from "@holdem-knight/core";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { ChipStack } from "@/components/ChipStack";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import {
  type InsuranceChoice,
  InsuranceSettings,
  initialInsuranceChoice,
  LAST_RULE,
} from "@/components/insurance/InsuranceSettings";
import { TextMenu } from "@/components/TextMenu";
import { useConfigLibrary } from "@/data/config-library";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";
import {
  type ChargeChoice,
  DEFAULT_PRESET,
  initialRakeChoice,
  initialTableFeeChoice,
  initialWageChoice,
  LAST_PRESET,
  PresetPicker,
  RakeSettings,
  SaveChargeConfig,
  TableFeeSettings,
  useChargePresets,
  WageSettings,
} from "./ChargeSettings";
import { chipsText, FigureInput, Join, Mark, pointsInputText, pointsText } from "./SetupFigures";

/** What each currency is called as game points, after its mark. */
const POINTS_NAMES: Record<Currency, string> = { AUD: "袋鼠分", CNY: "熊猫分" };

/** A currency is listed as its mark and points name, and shown as its mark alone once chosen. */
const CURRENCY_OPTIONS = CURRENCIES.map((currency) => ({
  value: currency,
  label: (
    <>
      <CurrencyIcon currency={currency} className="size-5" />
      {POINTS_NAMES[currency]}
    </>
  ),
  chosen: <CurrencyIcon currency={currency} className="size-5" />,
  name: POINTS_NAMES[currency],
}));

/** Common ratios, blinds and buy-ins, picked from the chevron at the end of their rows. */
const RATIO_PICKS = [1, 5, 10, 20].map((chips) => ({ chips, label: `${chips}:1` }));
const BLIND_PICKS = [
  [1, 1],
  [1, 2],
  [5, 5],
  [5, 10],
  [10, 10],
  [10, 20],
].map(([small, big]) => ({ small, big, label: `${small}/${big}` }));
const BUY_IN_PICKS = [50, 100, 200].map((bigBlinds) => ({ bigBlinds, label: `${bigBlinds}BB` }));

/**
 * A row of two figures with their marks, each typed in place. The chevron at its end lists common
 * values, which fill it at once. Its last mark sits where the 积分 row's mark does.
 */
function QuickRow<T extends string>({
  label,
  accessory,
  disabled = false,
  picks,
  value,
  onPick,
  children,
}: {
  label: string;
  /** Sits after the label */
  accessory?: ReactNode;
  disabled?: boolean;
  picks: readonly { readonly value: T; readonly label: string }[];
  /** The pick the row holds now, if any */
  value: T | undefined;
  onPick: (value: T) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-12 items-center px-4 py-1">
      <span className={cn("shrink-0 font-medium", disabled && "opacity-60")}>{label}</span>
      {accessory}
      <div className="flex min-h-11 min-w-0 flex-1 items-center justify-end pl-3 font-medium">
        {children}
      </div>
      {/* Wider than its chevron for a thumb, reaching into the row's padding */}
      <TextMenu
        label={`${label}快速选择`}
        options={picks.map((pick) => ({ ...pick, chosen: <></> }))}
        value={value}
        onChange={onPick}
        align="right"
        disabled={disabled}
        className="-mr-4 pr-4 -ml-3 pl-3"
      />
    </div>
  );
}

interface GameSettingsFormProps {
  initial: FormValues;
  submitLabel: string;
  /** Whether the currency and chip ratio are locked */
  ratioLocked?: boolean;
  /** Hides the buy-in setting for older games that already record chips */
  showBuyIn?: boolean;
  /** Insurance needs whole hands, so older games that record chips cannot use it */
  showInsurance?: boolean;
  /** This game's insurance rule. Missing means it is off. */
  initialInsurance?: InsuranceRule | undefined;
  /** Offered as "last time": this game's rule, or the latest game's */
  lastInsurance?: InsuranceRule | undefined;
  /** What to call that rule when it did not come from last time */
  lastInsuranceLabel?: string | undefined;
  /** Once insurance has been sold in this game, it cannot be turned off */
  insuranceLocked?: boolean;
  /** This game's table fee. Missing means it is off. */
  initialTableFee?: TableFeeRule | undefined;
  /** Offered as "last time", like the insurance rule */
  lastTableFee?: TableFeeRule | undefined;
  lastTableFeeLabel?: string | undefined;
  /** This game's wages. Missing means they are off. */
  initialWage?: WageRule | undefined;
  /** Offered as "last time", like the insurance rule */
  lastWage?: WageRule | undefined;
  lastWageLabel?: string | undefined;
  /** This game's rake. Missing means it is off. */
  initialRake?: RakeRule | undefined;
  /** Offered as "last time", like the insurance rule */
  lastRake?: RakeRule | undefined;
  lastRakeLabel?: string | undefined;
  /** Once rake has been recorded in this game, it cannot be turned off */
  rakeLocked?: boolean;
  saving: boolean;
  saveFailed: boolean;
  onSubmit: (settings: GameSettings) => void;
  /** Offers saving the entered settings, beside the submit button */
  onSaveConfig?: (settings: GameSettings) => void;
  /** Offered as "last time" for the basic settings, like the insurance rule. Older games may have no Buy-in */
  lastBasics?: LastBasics | undefined;
  lastBasicsLabel?: string | undefined;
  /** The saved configs the "last time" values were taken from, by section */
  lastSources?: LastSources | undefined;
  /** Told whether the settings differ from the ones the form was given, at first and on each change */
  onModifiedChange?: (modified: boolean) => void;
}

type LastSources = { readonly [Section in SettingsSection]?: string | undefined };

/**
 * The saved config a section's values are claimed for: last time's own while they are last time's,
 * or the one picked. A claim only counts once the values are found to be that config's.
 */
const claimed = (source: string, last: string | undefined) =>
  source === LAST_PRESET || source === LAST_RULE ? last : source;

/** Settings as text for comparing, without which of two tables with the same odds is named. */
function settingsText(settings: GameSettings | null) {
  if (!settings?.insurance) return JSON.stringify(settings);
  const { oddsTableId: _, ...insurance } = settings.insurance;
  return JSON.stringify({ ...settings, insurance });
}

/** The basic settings of a new game with nothing to carry over. */
const DEFAULT_BASICS: BasicSettings = {
  currency: DEFAULT_GAME_SETTINGS.currency,
  smallBlindChips: DEFAULT_GAME_SETTINGS.smallBlindChips,
  bigBlindChips: DEFAULT_GAME_SETTINGS.bigBlindChips,
  chipRatio: DEFAULT_GAME_SETTINGS.chipRatio,
  buyInBigBlinds: DEFAULT_GAME_SETTINGS.buyInBigBlinds,
};

type LastBasics = Omit<BasicSettings, "buyInBigBlinds"> & {
  readonly buyInBigBlinds?: number | undefined;
};

/** Only the basic settings of a game or config, with the default Buy-in where it has none. */
const basicsFrom = (last: LastBasics): BasicSettings => ({
  currency: last.currency,
  smallBlindChips: last.smallBlindChips,
  bigBlindChips: last.bigBlindChips,
  chipRatio: last.chipRatio,
  buyInBigBlinds: last.buyInBigBlinds ?? DEFAULT_GAME_SETTINGS.buyInBigBlinds,
});

const toBasicsForm = (basics: BasicSettings): FormValues => toGameSettingsForm(basics);

/** The basic settings as typed, or null while some are invalid. */
function basicsOf(form: FormValues): BasicSettings | null {
  const parsed = parseGameSettings(form);
  if (!parsed.ok) return null;
  const { currency, smallBlindChips, bigBlindChips, chipRatio, buyInBigBlinds } = parsed.settings;
  return { currency, smallBlindChips, bigBlindChips, chipRatio, buyInBigBlinds };
}

export function GameSettingsForm({
  initial,
  submitLabel,
  ratioLocked = false,
  showBuyIn = true,
  showInsurance = true,
  initialInsurance,
  lastInsurance,
  lastInsuranceLabel = "上次设置",
  insuranceLocked = false,
  initialTableFee,
  lastTableFee,
  lastTableFeeLabel = "上次设置",
  initialWage,
  lastWage,
  lastWageLabel = "上次设置",
  initialRake,
  lastRake,
  lastRakeLabel = "上次设置",
  rakeLocked = false,
  lastBasics,
  lastBasicsLabel = "上次设置",
  lastSources,
  saving,
  saveFailed,
  onSubmit,
  onSaveConfig,
  onModifiedChange,
}: GameSettingsFormProps) {
  const library = useConfigLibrary();
  const [values, setValues] = useState(initial);
  const [basicsSource, setBasicsSource] = useState(lastBasics ? LAST_PRESET : DEFAULT_PRESET);
  const basicsPresets = useChargePresets(
    "basics",
    lastBasics && basicsFrom(lastBasics),
    lastBasicsLabel,
    DEFAULT_BASICS,
    toBasicsForm,
    basicsOf,
    { source: basicsSource, form: values },
    { lastSource: lastSources?.basics },
  );
  /** Values changed by hand stay with the saved config they started from, or belong to none. */
  const editValues = (next: FormValues) => {
    setValues(next);
    setBasicsSource(basicsPresets.editedSource);
  };
  /** A preset's values, apart from those the ledger has locked. */
  function pickBasics(id: string, form: FormValues) {
    setBasicsSource(id);
    setValues(
      ratioLocked
        ? { ...values, smallBlindChips: form.smallBlindChips, bigBlindChips: form.bigBlindChips }
        : form,
    );
  }
  const [insurance, setInsurance] = useState(() =>
    initialInsuranceChoice(initialInsurance, lastInsurance),
  );
  const [ruleIssues, setRuleIssues] = useState<InsuranceRuleIssues>({});
  const [tableFee, setTableFee] = useState(() =>
    initialTableFeeChoice(initialTableFee, lastTableFee),
  );
  const [tableFeeIssues, setTableFeeIssues] = useState<TableFeeIssues>({});
  const [wage, setWage] = useState(() => initialWageChoice(initialWage, lastWage));
  const [wageIssues, setWageIssues] = useState<WageIssues>({});
  const [rake, setRake] = useState(() => initialRakeChoice(initialRake, lastRake));
  const [rakeIssues, setRakeIssues] = useState<RakeIssues>({});
  const ratioAmount = tryParseMoney(values.ratioAmount);
  const ratioChips = parseChips(values.ratioChips);
  const smallBlind = parseChips(values.smallBlindChips);
  const bigBlind = parseChips(values.bigBlindChips);
  const buyIn = parseChips(values.buyInBigBlinds);
  const handChips = bigBlind !== null && buyIn !== null ? bigBlind * buyIn : null;
  // Chips in points, once the ratio is complete
  const inPoints = (value: number | null) =>
    value !== null && ratioChips && ratioAmount
      ? chipsToCents(value, { chips: ratioChips, amount: ratioAmount })
      : null;
  const blindPoints = (value: number | null) => {
    const cents = inPoints(value);
    return cents === null ? null : formatGameMoney(cents, values.currency);
  };
  const handPoints = inPoints(handChips);
  const [buyInInPoints, setBuyInInPoints] = useState(false);
  // What is typed into the hand's chips or points, from which the big blinds are worked out
  const [handDraft, setHandDraft] = useState<string | null>(null);
  const setValue = (field: keyof FormValues) => (text: string) =>
    editValues({ ...values, [field]: text });
  const positive = (value: number | null) => value === null || value <= 0;

  /** The chips a typed hand comes to, from chips or from points by the ratio. */
  function handChipsFrom(text: string) {
    if (!buyInInPoints) return parseChips(text);
    const cents = tryParseMoney(text);
    return cents !== null && ratioChips && ratioAmount ? (cents * ratioChips) / ratioAmount : null;
  }

  /**
   * A typed hand sets the big blinds whenever it comes to a whole number of them, and on leaving,
   * the nearest. Nothing else changes.
   */
  function typeHand(text: string, settle: boolean) {
    const typed = handChipsFrom(text);
    if (typed === null || !bigBlind) return;
    const bigBlinds = typed / bigBlind;
    if (Number.isInteger(bigBlinds) && bigBlinds > 0) {
      editValues({ ...values, buyInBigBlinds: String(bigBlinds) });
    } else if (settle) {
      editValues({ ...values, buyInBigBlinds: String(Math.max(1, Math.round(bigBlinds))) });
    }
  }
  const chipMark = <ChipStack ground="var(--surface)" className="size-5" />;
  const pointsMark = <CurrencyIcon currency={values.currency} className="size-5" />;

  /** Everything as typed, each part parsed, and the settings they make once all are valid. */
  function parseAll(of: {
    values: FormValues;
    insurance: InsuranceChoice;
    tableFee: ChargeChoice<Parameters<typeof parseTableFee>[0]>;
    wage: ChargeChoice<Parameters<typeof parseWage>[0]>;
    rake: ChargeChoice<Parameters<typeof parseRake>[0]>;
  }) {
    const result = parseGameSettings(of.values);
    const rule =
      showInsurance && of.insurance.enabled ? parseInsuranceRule(of.insurance.form) : null;
    const fee = of.tableFee.enabled ? parseTableFee(of.tableFee.form) : null;
    const hourly = of.wage.enabled ? parseWage(of.wage.form) : null;
    const raked = of.rake.enabled ? parseRake(of.rake.form) : null;
    const settings: GameSettings | null =
      !result.ok ||
      (rule && !rule.ok) ||
      (fee && !fee.ok) ||
      (hourly && !hourly.ok) ||
      (raked && !raked.ok)
        ? null
        : {
            ...result.settings,
            ...(rule && { insurance: rule.rule }),
            ...(fee && { tableFee: fee.rule }),
            ...(hourly && { wage: hourly.rule }),
            ...(raked && { rake: raked.rule }),
          };
    return { rule, fee, hourly, raked, settings };
  }

  /**
   * The settings, with the saved configs they belong to, or null with the issues on show. Without
   * the saved configs to hand, the settings name none.
   */
  function validate() {
    const { rule, fee, hourly, raked, settings } = parseAll({
      values,
      insurance,
      tableFee,
      wage,
      rake,
    });
    setRakeIssues(raked && !raked.ok ? raked.issues : {});
    setRuleIssues(rule && !rule.ok ? rule.issues : {});
    setTableFeeIssues(fee && !fee.ok ? fee.issues : {});
    setWageIssues(hourly && !hourly.ok ? hourly.issues : {});
    if (!settings || !library) return settings;
    const takenFrom = Object.fromEntries(
      (
        [
          ["basics", claimed(basicsPresets.selectedId, lastSources?.basics)],
          ["insurance", claimed(insurance.source, lastSources?.insurance)],
          ["tableFee", claimed(tableFee.source, lastSources?.tableFee)],
          ["wage", claimed(wage.source, lastSources?.wage)],
          ["rake", claimed(rake.source, lastSources?.rake)],
        ] as const
      ).flatMap(([section, id]) => (id === undefined ? [] : [[section, id]])),
    );
    return withSettingsSources(settings, takenFrom, library);
  }

  // Against the settings the form was given as they are now, so a config saved from here, or one
  // that takes these values, reads as unchanged at once
  const given = parseAll({
    values: initial,
    insurance: initialInsuranceChoice(initialInsurance, lastInsurance),
    tableFee: initialTableFeeChoice(initialTableFee, lastTableFee),
    wage: initialWageChoice(initialWage, lastWage),
    rake: initialRakeChoice(initialRake, lastRake),
  }).settings;
  const entered = parseAll({ values, insurance, tableFee, wage, rake }).settings;
  const modified = settingsText(entered) !== settingsText(given);
  useEffect(() => onModifiedChange?.(modified), [modified, onModifiedChange]);

  // Set once starting or saving was tried with something invalid, so the reason is said, until
  // everything is valid again
  const [tried, setTried] = useState(false);
  if (tried && entered !== null) setTried(false);

  /** The settings for going on with, or null after saying that some are invalid. */
  function checked() {
    const settings = validate();
    setTried(settings === null);
    return settings;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const settings = checked();
    if (settings) onSubmit(settings);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-md flex-col gap-6 pb-8">
      <div>
        <div className="rounded-xl border border-line bg-surface">
          {/* Always open, so with no switch; its preset sits where the others' do */}
          <div className="flex min-h-12 items-center justify-between gap-3 px-4 pt-1">
            <span className="font-medium">基础设置</span>
            <PresetPicker
              kind="basics"
              title="基础设置"
              choices={basicsPresets.choices}
              source={basicsPresets.selectedId}
              modified={basicsPresets.modified}
              onPick={(preset) => pickBasics(preset.id, preset.form)}
            />
          </div>
          <div>
            {/* The whole row opens the list, which hangs under the mark at its right */}
            <TextMenu
              label="积分"
              caption="积分"
              options={CURRENCY_OPTIONS}
              value={values.currency}
              onChange={(currency) => editValues({ ...values, currency })}
              align="right"
              disabled={ratioLocked}
              className="min-h-12 w-full px-4 py-1 font-medium"
              captionClassName="mr-auto font-medium text-text"
            />
            <QuickRow
              label="比例"
              disabled={ratioLocked}
              picks={RATIO_PICKS.map(({ chips: n, label }) => ({ value: String(n), label }))}
              value={ratioAmount === 100 && ratioChips !== null ? String(ratioChips) : undefined}
              onPick={(n) => editValues({ ...values, ratioChips: n, ratioAmount: "1.00" })}
            >
              <FigureInput
                label="比例筹码"
                value={values.ratioChips}
                onChange={setValue("ratioChips")}
                tidy={chipsText}
                invalid={positive(ratioChips)}
                wholeNumber
                disabled={ratioLocked}
              />
              <Mark>{chipMark}</Mark>
              <Join>=</Join>
              <FigureInput
                label="比例积分"
                value={values.ratioAmount}
                onChange={setValue("ratioAmount")}
                tidy={pointsInputText}
                invalid={positive(ratioAmount)}
                wide
                disabled={ratioLocked}
              />
              <Mark>{pointsMark}</Mark>
            </QuickRow>
            <QuickRow
              label="盲注"
              picks={BLIND_PICKS.map(({ label }) => ({ value: label, label }))}
              value={
                smallBlind !== null && bigBlind !== null ? `${smallBlind}/${bigBlind}` : undefined
              }
              onPick={(pick) => {
                const [small = "", big = ""] = pick.split("/");
                editValues({ ...values, smallBlindChips: small, bigBlindChips: big });
              }}
            >
              <FigureInput
                label="小盲"
                value={values.smallBlindChips}
                onChange={setValue("smallBlindChips")}
                tidy={chipsText}
                invalid={positive(smallBlind)}
                wholeNumber
                above={blindPoints(smallBlind)}
              />
              <Mark>SB</Mark>
              <Join>/</Join>
              <FigureInput
                label="大盲"
                value={values.bigBlindChips}
                onChange={setValue("bigBlindChips")}
                tidy={chipsText}
                invalid={
                  positive(bigBlind) ||
                  (smallBlind !== null && bigBlind !== null && bigBlind < smallBlind)
                }
                wide
                wholeNumber
                above={blindPoints(bigBlind)}
              />
              <Mark>BB</Mark>
            </QuickRow>
            {showBuyIn && (
              <QuickRow
                label="Buy-in"
                accessory={
                  <button
                    type="button"
                    aria-label={`右侧显示${buyInInPoints ? "积分" : "筹码"}，点击切换`}
                    onClick={() => {
                      setHandDraft(null);
                      setBuyInInPoints(!buyInInPoints);
                    }}
                    className="-my-1 ml-1 grid size-9 shrink-0 place-items-center text-muted"
                  >
                    {buyInInPoints ? (
                      <CurrencyIcon currency={values.currency} className="size-4.5" />
                    ) : (
                      <ChipStack ground="var(--surface)" className="size-4.5" />
                    )}
                  </button>
                }
                disabled={ratioLocked}
                picks={BUY_IN_PICKS.map(({ bigBlinds, label }) => ({
                  value: String(bigBlinds),
                  label,
                }))}
                value={buyIn === null ? undefined : String(buyIn)}
                onPick={(bigBlinds) => editValues({ ...values, buyInBigBlinds: bigBlinds })}
              >
                <FigureInput
                  label="一个买入的大盲数"
                  value={values.buyInBigBlinds}
                  onChange={setValue("buyInBigBlinds")}
                  tidy={chipsText}
                  invalid={positive(buyIn)}
                  wholeNumber
                  disabled={ratioLocked}
                />
                <Mark>BB</Mark>
                <Join>
                  <span aria-hidden className="text-xl leading-none">
                    ⇔
                  </span>
                  <span className="sr-only">即</span>
                </Join>
                <FigureInput
                  label={buyInInPoints ? "一个买入的积分" : "一个买入的筹码"}
                  value={
                    handDraft ??
                    (buyInInPoints
                      ? handPoints === null
                        ? ""
                        : pointsText(handPoints)
                      : handChips === null
                        ? ""
                        : String(handChips))
                  }
                  onChange={(text) => {
                    setHandDraft(text);
                    typeHand(text, false);
                  }}
                  onBlur={() => {
                    if (handDraft !== null) typeHand(handDraft, true);
                    setHandDraft(null);
                  }}
                  tidy={buyInInPoints ? pointsInputText : chipsText}
                  wide
                  wholeNumber={!buyInInPoints}
                  disabled={ratioLocked}
                />
                <Mark>{buyInInPoints ? pointsMark : chipMark}</Mark>
              </QuickRow>
            )}
          </div>
          <div className="px-4">
            <SaveChargeConfig
              kind="basics"
              title="基础设置"
              takenNames={basicsPresets.saved.map((r) => r.name)}
              visible={basicsPresets.isNew(values)}
              base={basicsPresets.base}
              modified={basicsPresets.modified}
              read={() => basicsOf(values)}
              onSaved={setBasicsSource}
            />
          </div>
        </div>
        {ratioLocked && (
          <p className="mt-2 text-sm text-muted">已有账本记录，积分、比例和 Buy-in 不能再修改。</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {showInsurance && (
          <InsuranceSettings
            value={insurance}
            issues={ruleIssues}
            lastRule={lastInsurance}
            lastRuleLabel={lastInsuranceLabel}
            lastSource={lastSources?.insurance}
            locked={insuranceLocked}
            stakes={{ smallBlindChips: smallBlind }}
            onChange={setInsurance}
          />
        )}
        <WageSettings
          value={wage}
          issues={wageIssues}
          currency={values.currency}
          lastRule={lastWage}
          lastRuleLabel={lastWageLabel}
          lastSource={lastSources?.wage}
          onChange={setWage}
        />
        <TableFeeSettings
          value={tableFee}
          issues={tableFeeIssues}
          currency={values.currency}
          lastRule={lastTableFee}
          lastRuleLabel={lastTableFeeLabel}
          lastSource={lastSources?.tableFee}
          onChange={setTableFee}
        />
        <RakeSettings
          value={rake}
          issues={rakeIssues}
          currency={values.currency}
          lastRule={lastRake}
          lastRuleLabel={lastRakeLabel}
          lastSource={lastSources?.rake}
          locked={rakeLocked}
          stakes={{
            smallBlindChips: smallBlind,
            bigBlindChips: bigBlind,
            ratio: ratioChips && ratioAmount ? { chips: ratioChips, amount: ratioAmount } : null,
          }}
          onChange={setRake}
        />
      </div>

      {saveFailed && (
        <p role="alert" className="text-sm text-highlight">
          保存失败，请重试。
        </p>
      )}
      {tried && entered === null && (
        <p role="alert" className="text-sm text-highlight">
          有无效的数值，请检查标出的项后再试。
        </p>
      )}

      <div className={onSaveConfig ? "grid grid-cols-[1fr_2fr] gap-2" : "grid"}>
        {onSaveConfig && (
          <button
            type="button"
            onClick={() => {
              const settings = checked();
              if (settings) onSaveConfig(settings);
            }}
            className="min-h-12 rounded-xl border border-line px-2 text-sm font-medium text-highlight"
          >
            保存全局设置
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="min-h-12 rounded-xl bg-accent px-6 font-semibold text-accent-text disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
