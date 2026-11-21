import { ForeignOrganizerError } from "@holdem-knight/core";
import { useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, useRef, useState } from "react";
import { repository } from "@/data";
import { parseBackup, serializeBackup } from "@/data/backup";
import { shareFile } from "@/lib/share";

const buttonClass = "min-h-12 rounded-xl border border-line px-4 font-medium disabled:opacity-60";

type Status = { tone: "ok" | "error"; text: string };

/**
 * A backup of the books in use: the guest's, which exist only on this device, so are backed up
 * before changing devices or clearing the browser, or the account's, as a copy to keep.
 */
export function BackupSection({ account }: { account: boolean }) {
  const here = account ? "账户里" : "本机";
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
      const reason = error instanceof Error ? `（${error.name}）` : "";
      setStatus({ tone: "error", text: `导出失败${reason}，请重试。` });
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
          text:
            parsed.issue === "newer-version"
              ? "这个备份来自更新的版本，请先刷新应用。"
              : "文件无法识别，请选择 Hold’em Knight 导出的备份。",
        });
        return;
      }
      const result = await repository.backup.restore(parsed.data);
      await queryClient.invalidateQueries();
      setBackup(read());
      setStatus({
        tone: "ok",
        text:
          result.skipped > 0
            ? `恢复完成：新增 ${result.added} 条，跳过 ${result.skipped} 条${here}已有的记录。`
            : `恢复完成：新增 ${result.added} 条记录。`,
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text:
          error instanceof ForeignOrganizerError
            ? account
              ? "这个备份不是这个账户导出的，不能恢复到账户里。"
              : "这个备份属于其他账户，不能恢复。"
            : `恢复失败，${here}的数据没有改动。`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-line bg-surface p-5">
      <p className="font-medium">数据备份</p>
      <p className="mt-1 text-sm text-muted">
        {account
          ? "导出账户里的全部记录，留作备份。恢复只新增记录，不会覆盖账户里已有的数据。"
          : "换手机或清理浏览器数据后，本机记录会丢失。定期导出备份，需要时再恢复。恢复只新增记录，不会覆盖本机已有的数据。"}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={handleExport} className={buttonClass}>
          导出备份
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className={buttonClass}
        >
          恢复备份
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        aria-label="选择备份文件"
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
