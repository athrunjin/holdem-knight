import { ForeignOrganizerError } from "@holdem-knight/core";
import { useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, useRef, useState } from "react";
import { repository } from "@/data";
import { parseBackup, serializeBackup } from "@/data/backup";
import { t } from "@/i18n";
import { shareFile } from "@/lib/share";

const buttonClass = "min-h-12 rounded-xl border border-line px-4 font-medium disabled:opacity-60";

type Status = { tone: "ok" | "error"; text: string };

/**
 * A backup of the books in use: the guest's, which exist only on this device, so are backed up
 * before changing devices or clearing the browser, or the account's, as a copy to keep.
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
    <section className="mt-4 rounded-2xl border border-line bg-surface p-5">
      <p className="font-medium">{text.title}</p>
      <p className="mt-1 text-sm text-muted">{account ? text.bodyAccount : text.bodyGuest}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={handleExport} className={buttonClass}>
          {text.export}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className={buttonClass}
        >
          {text.restore}
        </button>
      </div>
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
          className={status.tone === "error" ? "mt-3 text-sm text-highlight" : "mt-3 text-sm"}
        >
          {status.text}
        </p>
      )}
    </section>
  );
}
