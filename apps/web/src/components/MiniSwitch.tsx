import { cn } from "@/lib/cn";

interface MiniSwitchProps {
  label: string;
  /** Names the switch for a reader only, where its title stands beside it */
  hideLabel?: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

/** A small labeled switch for a section heading. The tap target stays 44px tall. */
export function MiniSwitch({
  label,
  hideLabel = false,
  checked,
  onChange,
  className,
}: MiniSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn("flex min-h-11 items-center gap-1.5 text-xs text-muted", className)}
    >
      {hideLabel ? <span className="sr-only">{label}</span> : label}
      <span
        aria-hidden
        className={cn(
          "relative h-4.5 w-8 rounded-full transition-colors after:absolute after:top-0.5 after:size-3.5 after:rounded-full after:bg-white after:transition-[left]",
          checked ? "bg-accent after:left-4" : "bg-line after:left-0.5",
        )}
      />
    </button>
  );
}
