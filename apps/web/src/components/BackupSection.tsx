import { ForeignOrganizerError } from "@holdem-knight/core";
import { useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, useRef, useState } from "react";
import { InfoButton } from "@/components/InfoButton";
import { repository } from "@/data";
import { parseBackup, serializeBackup } from "@/data/backup";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { shareFile } from "@/lib/share";

const rowClass =
  "flex min-h-12 min-w-0 flex-1 items-center px-4 text-left font-medium disabled:opacity-60";

type Status = { tone: "ok" | "error"; text: string };

/**
 * Two rows of the settings list, to export and to restore a backup of the books in use: the
 * guest's, which exist only on this device, so are backed up before changing devices or clearing
 * the browser, or the account's, as a copy to keep. What came of it shows under them.
 */
export function BackupSection({ account }: { account: boolean }) {
  const text = t.me.backup;
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>();
  // Read the data ahead of time: the system share must come directly from a tap, and iOS may refuse it if the database is read after the tap
  const [backup, setBackup] = useState(read);

  function read() {
    const all = repository.backup.exportAll();
    // A read that fails is reported when the backup is asked for, not before
    all.catch(() => {});
    return all;
  }

  async function handleExport() {
    setBusy(true);
    setStatus(undefined);
    try {
      const now = new Date();
      const text = serializeBackup(await backup, now.getTime());
      const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()].join("-");
      await shareFile(
        new Blob([text], { type: "application/json" }),
        `holdem-knight-backup-${day}.json`,
      );
    } catch (error) {
      setStatus({
        tone: "error",
        text: text.exportFailed(error instanceof Error ? error.name : ""),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setStatus(undefined);
    try {
      const parsed = parseBackup(await file.text());
      if (!parsed.ok) {
        setStatus({
          tone: "error",
          text: parsed.issue === "newer-version" ? text.newerVersion : text.unreadable,
        });
        return;
      }
      const result = await repository.backup.restore(parsed.data);
      await queryClient.invalidateQueries();
      setBackup(read());
      setStatus({
        tone: "ok",
        text:
          result.skipped === 0
            ? text.restored(result.added)
            : account
              ? text.restoredSkippingAccount(result.added, result.skipped)
              : text.restoredSkippingGuest(result.added, result.skipped),
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text:
          error instanceof ForeignOrganizerError
            ? account
              ? text.foreignAccount
              : text.foreignGuest
            : account
              ? text.failedAccount
              : text.failedGuest,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center border-t border-line">
        <button type="button" disabled={busy} onClick={handleExport} className={rowClass}>
          {text.export}
        </button>
        {/* Its own target beside the row's, at the row's end */}
        <span className="mr-1 shrink-0">
          <InfoButton
            title={text.title}
            text={account ? text.bodyAccount : text.bodyGuest}
            target
          />
        </span>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => fileInput.current?.click()}
        className={cn(rowClass, "w-full border-t border-line")}
      >
        {text.restore}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        aria-label={text.chooseFile}
        onChange={handleImport}
        className="hidden"
      />
      {status && (
        <p
          role={status.tone === "error" ? "alert" : "status"}
          className={cn(
            "border-t border-line px-4 py-3 text-sm",
            status.tone === "error" && "text-highlight",
          )}
        >
          {status.text}
        </p>
      )}
    </>
  );
}
