import { parseChips } from "@holdem-knight/core";
import type { Ref } from "react";
import { TextField } from "@/components/TextField";

const stepClass = "size-12 shrink-0 rounded-xl border border-line text-xl font-semibold";

interface HandsStepperProps {
  value: string;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
}

/** Hand count with − and + on either side. The field can also be typed in. */
export function HandsStepper({ value, inputRef, onChange }: HandsStepperProps) {
  function step(by: number) {
    onChange(String(Math.max(1, (parseChips(value) ?? 0) + by)));
  }

  return (
    <div className="flex items-end gap-2">
      <button
        type="button"
        aria-label="减 1 个 Buy-in"
        onClick={() => step(-1)}
        className={stepClass}
      >
        −
      </button>
      <div className="min-w-0 flex-1">
        <TextField
          id="hands"
          label="Buy-in"
          value={value}
          issue={undefined}
          suffix="个"
          inputMode="numeric"
          {...(inputRef ? { inputRef } : {})}
          onChange={onChange}
        />
      </div>
      <button
        type="button"
        aria-label="加 1 个 Buy-in"
        onClick={() => step(1)}
        className={stepClass}
      >
        +
      </button>
    </div>
  );
}
