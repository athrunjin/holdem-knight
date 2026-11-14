import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export interface TransferPlan {
  /** Who collects, or `undefined` for the optimal plan. */
  collectorId: string | undefined;
  label: string;
}

interface TransferPlanPickerProps {
  /** In the order listed: the optimal plan, the organizer, then the players. */
  plans: readonly TransferPlan[];
  collectorId: string | undefined;
  disabled?: boolean;
  onChange: (collectorId: string | undefined) => void;
}

/** The transfer plan in small text with a chevron. A tap lists the plans and one more picks. */
export function TransferPlanPicker({
  plans,
  collectorId,
  disabled,
  onChange,
}: TransferPlanPickerProps) {
  const [open, setOpen] = useState(false);
  const current = plans.find((plan) => plan.collectorId === collectorId);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape closes the list from any option in it
    <div
      className="relative min-w-0"
      onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`转账方案：${current?.label ?? ""}`}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 max-w-full items-center gap-0.5 text-sm text-muted disabled:opacity-60"
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <>
          {/* A tap anywhere else puts the list away */}
          <button
            type="button"
            aria-label="收起"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            aria-label="转账方案"
            // Near the foot of the page, so it is brought clear of the tab bar as it opens
            ref={(menu) => menu?.scrollIntoView({ block: "nearest", behavior: "smooth" })}
            className="absolute top-full left-0 z-20 max-h-72 w-max scroll-mb-24 max-w-[min(18rem,calc(100vw-2rem))] min-w-44 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-lg"
          >
            {plans.map((plan) => {
              const checked = plan.collectorId === collectorId;
              return (
                <button
                  key={plan.collectorId ?? ""}
                  type="button"
                  role="menuitemradio"
                  aria-checked={checked}
                  onClick={() => {
                    setOpen(false);
                    if (!checked) onChange(plan.collectorId);
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm",
                    checked && "font-medium text-highlight",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{plan.label}</span>
                  {checked && <Check className="size-4 shrink-0" aria-hidden />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
