import { useEffect, useRef, useState } from "react";
import { signOutOfAccount, unsentBeforeSignOut } from "@/data";
import type { AuthIssue } from "@/data/auth";
import { t } from "@/i18n";
import { still } from "@/lib/motion";

const buttonClass = "min-h-11 rounded-xl border border-line px-4 font-medium disabled:opacity-60";

/**
 * Signing out of the account (ADR 0054): at once when this device has nothing of its books left to
 * send, and otherwise only once the person has seen how many records stay on the device and keeps
 * them. The same wherever 退出登录 is.
 */
export function useSignOut(onSignedOut?: (issue: AuthIssue | undefined) => void) {
  const [leaving, setLeaving] = useState(false);
  /** Records still to send, once a sign-out has been asked for and some are */
  const [unsent, setUnsent] = useState<number>();

  async function leave(keep: boolean) {
    setLeaving(true);
    const left = keep ? 0 : await unsentBeforeSignOut();
    if (left > 0) setUnsent(left);
    else onSignedOut?.(await signOutOfAccount());
    setLeaving(false);
  }

  return {
    leaving,
    unsent,
    ask: () => leave(false),
    keep: () => leave(true),
    cancel: () => setUnsent(undefined),
  };
}

/**
 * The step that opens in place under 退出登录 when records are left to send: how many, that they
 * stay on the device, 取消 at the left and 保留并退出 at the right. It is brought into view as it
 * opens, clear of the tab bar.
 */
export function UnsentStep({
  unsent,
  leaving,
  onCancel,
  onKeep,
  className = "",
}: {
  unsent: number;
  leaving: boolean;
  onCancel: () => void;
  onKeep: () => void;
  className?: string;
}) {
  const asking = useRef<HTMLDivElement>(null);

  useEffect(() => {
    asking.current?.scrollIntoView({ block: "nearest", behavior: still() ? "auto" : "smooth" });
    asking.current?.focus();
  }, []);

  return (
    <div
      ref={asking}
      role="alert"
      tabIndex={-1}
      className={`scroll-mb-[calc(5rem+env(safe-area-inset-bottom))] rounded-xl border border-line p-3 text-sm outline-none md:scroll-mb-4 ${className}`}
    >
      <p className="font-medium text-highlight">{t.account.leaving.unsent(unsent)}</p>
      <p className="mt-1 text-muted">{t.account.leaving.unsentNote}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={leaving} onClick={onCancel} className={buttonClass}>
          {t.common.cancel}
        </button>
        <button
          type="button"
          disabled={leaving}
          onClick={onKeep}
          className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-accent-text disabled:opacity-60"
        >
          {t.account.leaving.keep}
        </button>
      </div>
    </div>
  );
}
