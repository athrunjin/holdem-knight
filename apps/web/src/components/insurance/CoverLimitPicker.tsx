import { FULL_POT_LIMIT, parseCoverLimit, STAKE_LIMIT } from "@holdem-knight/core";
import { ChevronDown } from "lucide-react";
import { type FormEvent, useState } from "react";
import { FormDialog } from "@/components/game/FormDialog";
import { TextField } from "@/components/TextField";
import { ChoiceModal } from "./ChoiceModal";

const CUSTOM = "custom";

const PRESETS = [
  { id: STAKE_LIMIT, name: "保本" },
  { id: "50", name: "半池" },
  { id: "75", name: "3/4池" },
  { id: FULL_POT_LIMIT, name: "满池" },
] as const;

const limitName = (limit: string) => PRESETS.find(({ id }) => id === limit)?.name ?? `${limit}%`;

interface CoverLimitPickerProps {
  /** The street whose all-in buys this cover, such as 翻牌 */
  street: string;
  /** `stake` or a percentage of the pot share */
  value: string;
  onChange: (value: string) => void;
}

/** A street's cover limit as a small dropdown, with a percentage for anything else. */
export function CoverLimitPicker({ street, value, onChange }: CoverLimitPickerProps) {
  const [step, setStep] = useState<"pick" | "custom" | null>(null);
  const [percent, setPercent] = useState("");
  const [issue, setIssue] = useState<string>();
  const isPreset = PRESETS.some(({ id }) => id === value);

  function handleCustom(event: FormEvent) {
    event.preventDefault();
    const limit = parseCoverLimit(percent);
    if (limit === null || limit === STAKE_LIMIT) {
      setIssue("请输入 1–100 的整数");
      return;
    }
    onChange(limit === undefined ? FULL_POT_LIMIT : String(limit));
    setStep(null);
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`${street}保费上限：${limitName(value)}`}
        onClick={() => setStep("pick")}
        className="flex min-h-11 items-center gap-0.5"
      >
        <span className="text-muted">{street}</span>
        <span className="ml-1 font-medium">{limitName(value)}</span>
        <ChevronDown className="size-4 text-muted" aria-hidden />
      </button>

      {step === "pick" && (
        <ChoiceModal
          title={`${street}保费上限`}
          choices={[...PRESETS, { id: CUSTOM, name: isPreset ? "自定义" : `自定义（${value}%）` }]}
          selectedId={isPreset ? value : CUSTOM}
          onPick={(id) => {
            if (id === CUSTOM) {
              setPercent(isPreset ? "" : value);
              setIssue(undefined);
              setStep("custom");
            } else {
              onChange(id);
              setStep(null);
            }
          }}
          onClose={() => setStep(null)}
        />
      )}

      {step === "custom" && (
        <FormDialog
          title={`${street}保费上限`}
          submitLabel="确定"
          saving={false}
          saveFailed={false}
          onSubmit={handleCustom}
          onClose={() => setStep(null)}
        >
          <TextField
            id={`${street}-limit`}
            label="命中后最多拿回自己那份底池的"
            value={percent}
            issue={issue}
            suffix="%"
            inputMode="numeric"
            selectOnFocus
            onChange={(next) => {
              setPercent(next);
              setIssue(undefined);
            }}
          />
        </FormDialog>
      )}
    </>
  );
}
