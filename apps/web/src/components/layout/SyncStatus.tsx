import { retrySending, useSyncStatus } from "@/data";
import { t } from "@/i18n";

const frameClass = "mx-auto mt-3 w-[calc(100%-2rem)] max-w-3xl text-sm";

/**
 * What the account's books on this device have still to send, at the top of the page (ADR 0054):
 * a muted line while records wait for a connection, and an alert with 重试 once the account has
 * turned one down, which stops the rest behind it. Nothing for a guest, or once all is sent.
 */
export function SyncStatus() {
  const status = useSyncStatus();
  if (!status || status.pending === 0) return null;

  if (!status.refused) {
    return (
      <p role="status" className={`${frameClass} px-1 text-muted`}>
        {t.shell.sync.pending(status.pending)}
      </p>
    );
  }

  return (
    <div
      role="alert"
      className={`${frameClass} flex items-center gap-3 rounded-xl border border-line bg-surface py-1 pr-1 pl-4`}
    >
      <div className="min-w-0 flex-1 py-2">
        <p className="font-medium text-highlight">{t.shell.sync.refused(status.pending)}</p>
        <p className="mt-0.5 text-muted">{t.shell.sync.refusedNote}</p>
      </div>
      <button
        type="button"
        onClick={retrySending}
        className="min-h-11 shrink-0 rounded-lg px-3 font-medium"
      >
        {t.common.retry}
      </button>
    </div>
  );
}
