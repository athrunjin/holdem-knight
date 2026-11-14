import {
  CURRENCIES,
  type GameSettingsForm as FormValues,
  type GameSettings,
  type InsuranceRule,
  type InsuranceRuleIssues,
  parseGameSettings,
  parseInsuranceRule,
  parseTableFee,
  parseWage,
  type TableFeeIssues,
  type TableFeeRule,
  toDecimalString,
  tryParseMoney,
  type WageIssues,
  type WageRule,
} from "@holdem-knight/core";
import { type FormEvent, type ReactNode, useState } from "react";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import {
  InsuranceSettings,
  initialInsuranceChoice,
} from "@/components/insurance/InsuranceSettings";
import { TextMenu } from "@/components/TextMenu";
import { Toggle } from "@/components/Toggle";
import { CURRENCY_INFO } from "@/lib/currency";
import {
  initialTableFeeChoice,
  initialWageChoice,
  TableFeeSettings,
  WageSettings,
} from "./ChargeSettings";
import {
  BlindsDialog,
  BuyInDialog,
  ChipRatioDialog,
  previewBlindCash,
  previewHand,
} from "./GameSettingDialogs";

type SettingDialog = "ratio" | "blinds" | "buyIn";

/** A currency is listed as its mark and name, and shown as its mark alone once chosen. */
const CURRENCY_OPTIONS = CURRENCIES.map((currency) => ({
  value: currency,
  label: (
    <>
      <CurrencyIcon currency={currency} className="size-5" />
      {CURRENCY_INFO[currency].label}
    </>
  ),
  chosen: <CurrencyIcon currency={currency} className="size-5" />,
  name: CURRENCY_INFO[currency].label,
}));

/** Options with no settings yet. Rake comes last, after insurance. */
const PLANNED_OPTIONS = ["抽水"];

function PlannedOption({ label }: { label: string }) {
  const [enabled, setEnabled] = useState(false);

  return (
    <section className="rounded-xl border border-line bg-surface px-4 py-2">
      <Toggle label={label} checked={enabled} onChange={setEnabled} />
      {enabled && <p className="pb-2 text-sm text-muted">开发中</p>}
    </section>
  );
}

function SettingRow({
  label,
  detail,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  /** Small text under the value */
  detail?: string | null | undefined;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left disabled:opacity-60"
    >
      <span className="font-medium">{label}</span>
      <span className="min-w-0 text-right">
        <span className="block font-medium">{children}</span>
        {detail && <span className="block text-sm text-muted">{detail}</span>}
      </span>
    </button>
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
  const currencyIcon = (
    <CurrencyIcon currency={values.currency} className="size-5 align-[-0.2em]" />
  );
  const ratioAmount = tryParseMoney(values.ratioAmount);

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
            <SettingRow label="筹码" disabled={ratioLocked} onClick={() => setDialog("ratio")}>
              {values.ratioChips} <small className="font-normal text-muted">筹码</small> :{" "}
              {ratioAmount === null ? values.ratioAmount : toDecimalString(ratioAmount)}{" "}
              <span className="text-muted">{currencyIcon}</span>
            </SettingRow>
            <SettingRow
              label="盲注"
              detail={previewBlindCash(values)}
              onClick={() => setDialog("blinds")}
            >
              {values.smallBlindChips}/{values.bigBlindChips}
            </SettingRow>
            {showBuyIn && (
              <SettingRow
                label="Buy-in"
                detail={ratioLocked ? null : previewHand(values)}
                disabled={ratioLocked}
                onClick={() => setDialog("buyIn")}
              >
                {values.buyInBigBlinds}BB
              </SettingRow>
            )}
          </div>
          {ratioLocked && (
            <p className="mt-2 text-sm text-muted">
              已有账本记录，积分、筹码和 Buy-in 不能再修改。
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
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
          {PLANNED_OPTIONS.map((label) => (
            <PlannedOption key={label} label={label} />
          ))}
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
