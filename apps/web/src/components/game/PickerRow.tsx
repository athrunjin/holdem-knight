import { Check, ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Modal } from "@/components/insurance/Modal";
import { cn } from "@/lib/cn";

interface PickerRowProps<Value extends string> {
  /** The current choice, as the text shows it */
  children: ReactNode;
  title: string;
  options: readonly (readonly [Value, string])[];
  value: Value | undefined;
  /** Locked, it shows the choice with no way to change it */
  disabled: boolean;
  onChange: (value: Value) => void;
}

/**
 * A choice as small highlighted text with an arrow, to sit at the end of a line of text. A tap
 * opens the options.
 */
export function PickerRow<Value extends string>({
  children,
  title,
  options,
  value,
  disabled,
  onChange,
}: PickerRowProps<Value>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* The 44px target reaches up from the line of text, which stays as short as it was */}
      <button
        type="button"
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="-mt-8 flex min-h-11 max-w-[45%] min-w-0 shrink-0 items-end text-xs leading-none text-highlight"
      >
        <span className="truncate pb-px">{children}</span>
        {!disabled && <ChevronDown className="-mb-px size-3.5 shrink-0" aria-hidden />}
      </button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {options.map(([option, label]) => (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex min-h-12 w-full items-center justify-between gap-2 px-3 text-left font-medium",
                    value === option && "text-highlight",
                  )}
                >
                  <span className="truncate">{label}</span>
                  {value === option && <Check className="size-5 shrink-0" aria-label="当前选中" />}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 min-h-11 w-full rounded-xl border border-line font-medium"
          >
            取消
          </button>
        </Modal>
      )}
    </>
  );
}
