import {
  chipsToCents,
  type GameSettingsForm as FormValues,
  type GameSettingsField,
  type GameSettingsIssue,
  type GameSettingsIssues,
  parseChips,
  parseGameSettings,
  tryParseMoney,
} from "@holdem-knight/core";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { TextField } from "@/components/TextField";
import { CURRENCY_INFO, formatGameAmount } from "@/lib/currency";
import { formatMoneyText } from "@/lib/number-input";
import { FormDialog } from "./FormDialog";

const ISSUE_TEXT: Record<GameSettingsIssue, string> = {
  invalid: "请输入有效的数字",
  "not-positive": "必须大于 0",
  "below-small-blind": "大盲不能小于小盲",
};

/** The blinds in cash for the current input, or null while the input is incomplete. */
export function previewBlindCash({
  currency,
  smallBlindChips,
  bigBlindChips,
  ratioChips,
  ratioAmount,
}: FormValues) {
  const small = parseChips(smallBlindChips);
  const big = parseChips(bigBlindChips);
  const chips = parseChips(ratioChips);
  const amount = tryParseMoney(ratioAmount);
  if (!small || !big || !chips || !amount) return null;
  const cash = (blind: number) =>
    formatGameAmount(chipsToCents(blind, { chips, amount }), currency);
  return `${cash(small)}/${cash(big)}`;
}

/** One Buy-in in chips and cash for the current input, or null while the input is incomplete. */
export function previewHand({
  currency,
  bigBlindChips,
  buyInBigBlinds,
  ratioChips,
  ratioAmount,
}: FormValues) {
  const big = parseChips(bigBlindChips);
  const multiple = parseChips(buyInBigBlinds);
  const chips = parseChips(ratioChips);
  const amount = tryParseMoney(ratioAmount);
  if (!big || !multiple || !chips || !amount) return null;
  const handChips = big * multiple;
  const cash = formatGameAmount(chipsToCents(handChips, { chips, amount }), currency);
  return `${handChips.toLocaleString("zh-CN")} 筹码（${cash}）`;
}

interface SettingDialogProps {
  values: FormValues;
  onConfirm: (values: FormValues) => void;
  onClose: () => void;
}

/**
 * Edits a draft of the settings, which reach the form only once they pass validation.
 * The input given `inputRef` is selected on open so a number can be typed right away.
 */
function useSettingDraft({ values, onConfirm }: SettingDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(values);
  const [issues, setIssues] = useState<GameSettingsIssues>({});

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = parseGameSettings(draft);
    if (result.ok) {
      onConfirm(draft);
    } else {
      setIssues(result.issues);
    }
  }

  function field(name: GameSettingsField) {
    const issue = issues[name];
    return {
      id: name,
      value: draft[name],
      selectOnFocus: true,
      issue: issue && ISSUE_TEXT[issue],
      onChange: (value: string) => setDraft({ ...draft, [name]: value }),
    };
  }

  return { inputRef, draft, setDraft, handleSubmit, field };
}

export function ChipRatioDialog(props: SettingDialogProps) {
  const { inputRef, draft, setDraft, handleSubmit, field } = useSettingDraft(props);

  return (
    <FormDialog
      title="筹码"
      submitLabel="确定"
      saving={false}
      saveFailed={false}
      onSubmit={handleSubmit}
      onClose={props.onClose}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        <TextField
          {...field("ratioChips")}
          label="筹码数"
          suffix="筹码"
          inputMode="numeric"
          inputRef={inputRef}
        />
        <span className="mt-6 grid min-h-12 place-items-center text-muted">=</span>
        <TextField
          {...field("ratioAmount")}
          label="对应金额"
          prefix={CURRENCY_INFO[draft.currency].symbol}
          inputMode="decimal"
          onBlur={() => setDraft({ ...draft, ratioAmount: formatMoneyText(draft.ratioAmount) })}
        />
      </div>
    </FormDialog>
  );
}

export function BlindsDialog(props: SettingDialogProps) {
  const { inputRef, draft, handleSubmit, field } = useSettingDraft(props);
  const blindCash = previewBlindCash(draft);

  return (
    <FormDialog
      title="盲注"
      submitLabel="确定"
      saving={false}
      saveFailed={false}
      onSubmit={handleSubmit}
      onClose={props.onClose}
    >
      <div>
        <div className="grid grid-cols-2 items-start gap-2">
          <TextField
            {...field("smallBlindChips")}
            label="小盲"
            inputMode="numeric"
            inputRef={inputRef}
          />
          <TextField {...field("bigBlindChips")} label="大盲" inputMode="numeric" />
        </div>
        {blindCash && <p className="mt-1 text-sm text-muted">对应金额 {blindCash}</p>}
      </div>
    </FormDialog>
  );
}

export function BuyInDialog(props: SettingDialogProps) {
  const { inputRef, draft, handleSubmit, field } = useSettingDraft(props);
  const hand = previewHand(draft);

  return (
    <FormDialog
      title="Buy-in"
      submitLabel="确定"
      saving={false}
      saveFailed={false}
      onSubmit={handleSubmit}
      onClose={props.onClose}
    >
      <div>
        <TextField
          {...field("buyInBigBlinds")}
          label="一个 Buy-in"
          suffix="BB"
          inputMode="numeric"
          inputRef={inputRef}
        />
        {hand && <p className="mt-1 text-sm text-muted">{hand}</p>}
      </div>
    </FormDialog>
  );
}
