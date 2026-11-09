import { Info } from "lucide-react";
import { useId, useState } from "react";
import { Modal } from "@/components/insurance/Modal";

interface ToggleProps {
  label: string;
  detail?: string;
  /** An explanation behind an info button next to the label, shown when tapped */
  info?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/** A labeled on/off switch taking one row. */
export function Toggle({ label, detail, info, checked, disabled = false, onChange }: ToggleProps) {
  const id = useId();
  const [showInfo, setShowInfo] = useState(false);

  return (
    // The info button sits outside the labels, so tapping it never flips the switch
    <div className="relative flex min-h-11 items-center gap-1 has-disabled:cursor-default">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block font-medium">{label}</span>
        {detail && <span className="block text-sm text-muted">{detail}</span>}
      </label>
      {info && (
        <button
          type="button"
          aria-label={`${label}说明`}
          onClick={() => setShowInfo(true)}
          className="-my-1 grid size-9 shrink-0 place-items-center text-muted"
        >
          <Info className="size-4.5" aria-hidden />
        </button>
      )}
      <label htmlFor={id} className="flex min-h-11 flex-1 cursor-pointer items-center justify-end">
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className="relative h-7 w-12 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-highlight peer-disabled:opacity-60 after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
        />
      </label>
      {showInfo && info && (
        <Modal title={label} onClose={() => setShowInfo(false)}>
          <p className="text-sm text-muted">{info}</p>
          <button
            type="button"
            onClick={() => setShowInfo(false)}
            className="mt-3 min-h-11 w-full rounded-xl border border-line font-medium"
          >
            知道了
          </button>
        </Modal>
      )}
    </div>
  );
}
