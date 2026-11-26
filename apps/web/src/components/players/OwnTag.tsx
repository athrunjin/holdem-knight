import { t } from "@/i18n";
import { cn } from "@/lib/cn";

/**
 * Marks the host's own record wherever players are listed (ADR 0051): a small muted pill, the
 * shape of the guest's sign-in pill on 我的 but not gold, as it is a fact and not an action.
 */
export function OwnTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-lg border border-line px-1.5 text-xs leading-5 font-medium text-muted",
        className,
      )}
    >
      {t.ui.roleSwitch.host}
    </span>
  );
}
