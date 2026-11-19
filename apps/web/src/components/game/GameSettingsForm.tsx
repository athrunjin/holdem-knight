import {
  CURRENCIES,
  type Currency,
  chipsToCents,
  DEFAULT_RAKE_RULE,
  type GameSettingsForm as FormValues,
  type GameSettings,
  type InsuranceRule,
  type InsuranceRuleIssues,
  parseChips,
  parseGameSettings,
  parseInsuranceRule,
  parseTableFee,
  parseWage,
  type RakeRule,
  type TableFeeIssues,
  type TableFeeRule,
  tryParseMoney,
  type WageIssues,
  type WageRule,
} from "@holdem-knight/core";
import { type FormEvent, type ReactNode, useState } from "react";
import { ChipStack } from "@/components/ChipStack";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import {
  InsuranceSettings,
  initialInsuranceChoice,
} from "@/components/insurance/InsuranceSettings";
import { TextMenu } from "@/components/TextMenu";
import { Toggle } from "@/components/Toggle";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";
import {
  initialTableFeeChoice,
  initialWageChoice,
  TableFeeSettings,
  WageSettings,
} from "./ChargeSettings";
import { BlindsDialog, BuyInDialog, ChipRatioDialog } from "./GameSettingDialogs";

type SettingDialog = "ratio" | "blinds" | "buyIn";

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
 * A number centered in a slot that holds 3 digits, or 4 when `wide`, so the rows' numbers and
 * marks line up. A longer number widens its own row. `above` is small text over it, such as the
 * blind in points.
 */
const Figure = ({
  children,
  wide = false,
  above,
}: {
  children: ReactNode;
  wide?: boolean;
  above?: string | null | undefined;
}) => (
  <span
    className={cn(
      "flex shrink-0 flex-col items-center tabular-nums",
      wide ? "min-w-[4ch]" : "min-w-[3ch]",
    )}
  >
    {above && <span className="text-[0.625rem] leading-3 font-normal text-muted">{above}</span>}
    <span>{children}</span>
  </span>
);

/** Points without cents when there are none: 1 for 1.00, 2.50 for 2.5. */
function pointsText(value: number) {
  const whole = Math.trunc(value / 100).toLocaleString("zh-CN");
  const fraction = Math.abs(value % 100);
  return fraction === 0 ? whole : `${whole}.${String(fraction).padStart(2, "0")}`;
}

/** The mark after a number: an icon, or SB, BB in small type. */
const Mark = ({ children }: { children: ReactNode }) => (
  <span className="ml-1 grid w-5 shrink-0 place-items-center text-xs font-normal text-muted">
    {children}
  </span>
);

/** What joins two figures, such as = or /. */
const Join = ({ children }: { children: ReactNode }) => (
  <span className="grid w-6 shrink-0 place-items-center font-normal text-muted">{children}</span>
);

/**
 * A row of two figures with their marks. The row opens a dialog to type them; the chevron at its
 * end lists common values, which fill it at once. Its last mark sits where the 积分 row's mark does.
 */
function QuickRow<T extends string>({
  label,
  accessory,
  disabled = false,
  onOpen,
  picks,
  value,
  onPick,
  children,
}: {
  label: string;
  /** Sits after the label, outside the part that opens the dialog */
  accessory?: ReactNode;
  disabled?: boolean;
  onOpen: () => void;
  picks: readonly { readonly value: T; readonly label: string }[];
  /** The pick the row holds now, if any */
  value: T | undefined;
  onPick: (value: T) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-center px-4 py-2">
      <span className={cn("shrink-0 font-medium", disabled && "opacity-60")}>{label}</span>
      {accessory}
      <button
        type="button"
        aria-label={`${label}：手动输入`}
        disabled={disabled}
        onClick={onOpen}
        className="flex min-h-11 min-w-0 flex-1 items-center justify-end pl-3 font-medium disabled:opacity-60"
      >
        {children}
      </button>
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

/**
 * Rake, last after insurance. It has one rule for now, a tenth of the pot, so it is only a switch.
 * Once rake is recorded in the game it stays on, as insurance does.
 */
function RakeSettings({
  enabled,
  locked,
  onChange,
}: {
  enabled: boolean;
  locked: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface px-4 py-2">
      <Toggle
        label="抽水"
        {...(enabled && {
          detail: locked
            ? "这局已有抽水记录，不能关闭"
            : `按底池 ${DEFAULT_RAKE_RULE.percent}% 计算，不足 1 筹码舍去`,
        })}
        checked={enabled}
        disabled={locked}
        onChange={onChange}
      />
    </section>
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
  /** Once rake has been recorded in this game, it cannot be turned off */
  rakeLocked?: boolean;
  saving: boolean;
  saveFailed: boolean;
  onSubmit: (settings: GameSettings) => void;
  /** Offers saving the entered settings, beside the submit button */
  onSaveConfig?: (settings: GameSettings) => void;
}

export function GameSettingsForm({
  initial,
  submitLabel,
  ratioLocked = false,
  showBuyIn = true,
  showInsurance = true,
  initialInsurance,
  lastInsurance,
  lastInsuranceLabel = "上次配置",
  insuranceLocked = false,
  initialTableFee,
  lastTableFee,
  lastTableFeeLabel = "上次配置",
  initialWage,
  lastWage,
  lastWageLabel = "上次配置",
  initialRake,
  rakeLocked = false,
  saving,
  saveFailed,
  onSubmit,
  onSaveConfig,
}: GameSettingsFormProps) {
  const [values, setValues] = useState(initial);
  const [dialog, setDialog] = useState<SettingDialog | null>(null);
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
  const [rake, setRake] = useState(initialRake !== undefined);
  const ratioAmount = tryParseMoney(values.ratioAmount);
  const ratioChips = parseChips(values.ratioChips);
  const smallBlind = parseChips(values.smallBlindChips);
  const bigBlind = parseChips(values.bigBlindChips);
  const buyIn = parseChips(values.buyInBigBlinds);
  const handChips = bigBlind !== null && buyIn !== null ? bigBlind * buyIn : null;
  const chips = (value: number | null, text: string) =>
    value === null ? text : value.toLocaleString("zh-CN");
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
  const chipMark = <ChipStack ground="var(--surface)" className="size-5" />;
  const pointsMark = <CurrencyIcon currency={values.currency} className="size-5" />;

  function validate() {
    const result = parseGameSettings(values);
    const rule = showInsurance && insurance.enabled ? parseInsuranceRule(insurance.form) : null;
    const fee = tableFee.enabled ? parseTableFee(tableFee.form) : null;
    const hourly = wage.enabled ? parseWage(wage.form) : null;
    setRuleIssues(rule && !rule.ok ? rule.issues : {});
    setTableFeeIssues(fee && !fee.ok ? fee.issues : {});
    setWageIssues(hourly && !hourly.ok ? hourly.issues : {});
    if (!result.ok || (rule && !rule.ok) || (fee && !fee.ok) || (hourly && !hourly.ok)) {
      return null;
    }
    return {
      ...result.settings,
      ...(rule && { insurance: rule.rule }),
      ...(fee && { tableFee: fee.rule }),
      ...(hourly && { wage: hourly.rule }),
      ...(rake && { rake: initialRake ?? DEFAULT_RAKE_RULE }),
    };
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const settings = validate();
    if (settings) onSubmit(settings);
  }

  const dialogProps = {
    values,
    onConfirm: (next: FormValues) => {
      setValues(next);
      setDialog(null);
    },
    onClose: () => setDialog(null),
  };

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="flex max-w-md flex-col gap-6 pb-8">
        <div>
          <div className="divide-y divide-line rounded-xl border border-line bg-surface">
            {/* The whole row opens the list, which hangs under the mark at its right */}
            <TextMenu
              label="积分"
              caption="积分"
              options={CURRENCY_OPTIONS}
              value={values.currency}
              onChange={(currency) => setValues({ ...values, currency })}
              align="right"
              disabled={ratioLocked}
              className="min-h-14 w-full px-4 py-2 font-medium"
              captionClassName="mr-auto font-medium text-text"
            />
            <QuickRow
              label="比例"
              disabled={ratioLocked}
              onOpen={() => setDialog("ratio")}
              picks={RATIO_PICKS.map(({ chips: n, label }) => ({ value: String(n), label }))}
              value={ratioAmount === 100 && ratioChips !== null ? String(ratioChips) : undefined}
              onPick={(n) => setValues({ ...values, ratioChips: n, ratioAmount: "1.00" })}
            >
              <Figure>{chips(ratioChips, values.ratioChips)}</Figure>
              <Mark>{chipMark}</Mark>
              <Join>=</Join>
              <Figure wide>
                {ratioAmount === null ? values.ratioAmount : pointsText(ratioAmount)}
              </Figure>
              <Mark>{pointsMark}</Mark>
            </QuickRow>
            <QuickRow
              label="盲注"
              onOpen={() => setDialog("blinds")}
              picks={BLIND_PICKS.map(({ label }) => ({ value: label, label }))}
              value={
                smallBlind !== null && bigBlind !== null ? `${smallBlind}/${bigBlind}` : undefined
              }
              onPick={(pick) => {
                const [small = "", big = ""] = pick.split("/");
                setValues({ ...values, smallBlindChips: small, bigBlindChips: big });
              }}
            >
              <Figure above={blindPoints(smallBlind)}>
                {chips(smallBlind, values.smallBlindChips)}
              </Figure>
              <Mark>SB</Mark>
              <Join>/</Join>
              <Figure wide above={blindPoints(bigBlind)}>
                {chips(bigBlind, values.bigBlindChips)}
              </Figure>
              <Mark>BB</Mark>
            </QuickRow>
            {showBuyIn && (
              <QuickRow
                label="Buy-in"
                accessory={
                  <button
                    type="button"
                    aria-label={`右侧显示${buyInInPoints ? "积分" : "筹码"}，点击切换`}
                    onClick={() => setBuyInInPoints(!buyInInPoints)}
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
                onOpen={() => setDialog("buyIn")}
                picks={BUY_IN_PICKS.map(({ bigBlinds, label }) => ({
                  value: String(bigBlinds),
                  label,
                }))}
                value={buyIn === null ? undefined : String(buyIn)}
                onPick={(bigBlinds) => setValues({ ...values, buyInBigBlinds: bigBlinds })}
              >
                <Figure>{chips(buyIn, values.buyInBigBlinds)}</Figure>
                <Mark>BB</Mark>
                <Join>
                  <span aria-hidden className="text-xl leading-none">
                    ⇔
                  </span>
                  <span className="sr-only">即</span>
                </Join>
                <Figure wide>
                  {buyInInPoints
                    ? handPoints === null
                      ? "–"
                      : pointsText(handPoints)
                    : handChips === null
                      ? "–"
                      : handChips.toLocaleString("zh-CN")}
                </Figure>
                <Mark>{buyInInPoints ? pointsMark : chipMark}</Mark>
              </QuickRow>
            )}
          </div>
          {ratioLocked && (
            <p className="mt-2 text-sm text-muted">
              已有账本记录，积分、比例和 Buy-in 不能再修改。
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {showInsurance && (
            <InsuranceSettings
              value={insurance}
              issues={ruleIssues}
              lastRule={lastInsurance}
              lastRuleLabel={lastInsuranceLabel}
              locked={insuranceLocked}
              onChange={setInsurance}
            />
          )}
          <WageSettings
            value={wage}
            issues={wageIssues}
            currency={values.currency}
            lastRule={lastWage}
            lastRuleLabel={lastWageLabel}
            onChange={setWage}
          />
          <TableFeeSettings
            value={tableFee}
            issues={tableFeeIssues}
            currency={values.currency}
            lastRule={lastTableFee}
            lastRuleLabel={lastTableFeeLabel}
            onChange={setTableFee}
          />
          <RakeSettings enabled={rake} locked={rakeLocked} onChange={setRake} />
        </div>

        {saveFailed && (
          <p role="alert" className="text-sm text-highlight">
            保存失败，请重试。
          </p>
        )}

        <div className={onSaveConfig ? "grid grid-cols-[1fr_2fr] gap-2" : "grid"}>
          {onSaveConfig && (
            <button
              type="button"
              onClick={() => {
                const settings = validate();
                if (settings) onSaveConfig(settings);
              }}
              className="min-h-12 rounded-xl border border-line px-2 text-sm font-medium text-highlight"
            >
              保存当前配置
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

      {/* Outside the form: a dialog's own form must not nest in it or submit it */}
      {dialog === "ratio" && <ChipRatioDialog {...dialogProps} />}
      {dialog === "blinds" && <BlindsDialog {...dialogProps} />}
      {dialog === "buyIn" && <BuyInDialog {...dialogProps} />}
    </>
  );
}
