import { FULL_POT_LIMIT, parseCoverLimit, STAKE_LIMIT } from "@holdem-knight/core";
import { type FormEvent, useState } from "react";
import { FormDialog } from "@/components/game/FormDialog";
import { TextField } from "@/components/TextField";
import { TextMenu } from "@/components/TextMenu";

const CUSTOM = "custom";

const PRESETS = [
  { id: STAKE_LIMIT, name: "保本" },
  { id: "50", name: "半池" },
  { id: "75", name: "3/4池" },
  { id: FULL_POT_LIMIT, name: "满池" },
] as const;

interface CoverLimitPickerProps {
  /** The street whose all-in buys this cover, such as 翻牌 */
  street: string;
  /** `stake` or a percentage of the pot share */
  value: string;
  onChange: (value: string) => void;
}

/** A street's cover limit as a small menu in the page, with a percentage for anything else. */
export function CoverLimitPicker({ street, value, onChange }: CoverLimitPickerProps) {
  const [customizing, setCustomizing] = useState(false);
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
    setCustomizing(false);
  }

  return (
    <>
      <TextMenu
        label={`${street}保费上限`}
        caption={street}
        options={[
          ...PRESETS.map(({ id, name }) => ({ value: id as string, label: name })),
          // Its own percentage shows in the line, and picking it again changes the percentage
          isPreset
            ? { value: CUSTOM, label: "自定义" }
            : { value: CUSTOM, label: `自定义（${value}%）`, chosen: `${value}%` },
        ]}
        value={isPreset ? value : CUSTOM}
        onChange={(id) => {
          if (id === CUSTOM) {
            setPercent(isPreset ? "" : value);
            setIssue(undefined);
            setCustomizing(true);
          } else {
            onChange(id);
          }
        }}
        className="font-medium"
      />

      {customizing && (
        <FormDialog
          title={`${street}保费上限`}
          submitLabel="确定"
          saving={false}
          saveFailed={false}
          onSubmit={handleCustom}
          onClose={() => setCustomizing(false)}
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
