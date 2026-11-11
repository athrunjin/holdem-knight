import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";
import { selectOnFocus as selectAll } from "@/lib/number-input";

interface TextFieldProps {
  id: string;
  label: string;
  /** Sits right after the label, such as an info button */
  labelAccessory?: ReactNode;
  value: string;
  issue: string | undefined;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  inputMode: "numeric" | "decimal" | "text";
  inputRef?: Ref<HTMLInputElement>;
  /** A tap selects what the field holds, so typing replaces it */
  selectOnFocus?: boolean;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function TextField({
  id,
  label,
  labelAccessory,
  value,
  issue,
  prefix,
  suffix,
  placeholder,
  inputMode,
  inputRef,
  selectOnFocus = false,
  onChange,
  onFocus,
  onBlur,
}: TextFieldProps) {
  const issueId = `${id}-issue`;
  return (
    <div className="min-w-0">
      {labelAccessory ? (
        <div className="mb-1 flex items-center">
          <label htmlFor={id} className="text-sm text-muted">
            {label}
          </label>
          {labelAccessory}
        </div>
      ) : (
        <label htmlFor={id} className="mb-1 block text-sm text-muted">
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex min-h-12 items-center gap-1 rounded-xl border bg-surface px-3 focus-within:border-highlight",
          issue ? "border-highlight" : "border-line",
        )}
      >
        {prefix && <span className="text-muted">{prefix}</span>}
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          aria-invalid={issue ? true : undefined}
          aria-describedby={issue ? issueId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => {
            if (selectOnFocus) selectAll(event.currentTarget);
            onFocus?.();
          }}
          onBlur={onBlur}
          className="min-h-11 w-full min-w-0 bg-transparent text-lg outline-none"
        />
        {suffix && <span className="shrink-0 text-sm text-muted">{suffix}</span>}
      </div>
      {issue && (
        <p id={issueId} className="mt-1 text-sm text-highlight">
          {issue}
        </p>
      )}
    </div>
  );
}
