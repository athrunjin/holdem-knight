import { parseDisplayName } from "@holdem-knight/core";
import { Check, Copy } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { TextField } from "@/components/TextField";
import { signOut } from "@/data/auth";
import { useAccount, useRenameAccount } from "@/data/session";
import { t } from "@/i18n";

const rowClass = "flex min-h-11 items-center justify-between gap-3";

/**
 * An account's code with a button that copies it, for sending to a host to check. The button
 * shows a tick for a moment once it has, and says so where copying is not allowed.
 */
function AccountCode({ code }: { code: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const shown = useRef<HTMLSpanElement>(null);

  /** The older way to copy: select the code where it shows and ask the browser to copy that. */
  function copySelection() {
    const selection = window.getSelection();
    if (!shown.current || !selection) return false;
    const range = document.createRange();
    range.selectNodeContents(shown.current);
    selection.removeAllRanges();
    selection.addRange(range);
    const copied = document.execCommand("copy");
    selection.removeAllRanges();
    return copied;
  }

  async function handleCopy() {
    let copied: boolean;
    try {
      await navigator.clipboard.writeText(code);
      copied = true;
    } catch {
      // No clipboard, as on a page not served securely, or the browser refused it
      copied = copySelection();
    }
    setState(copied ? "copied" : "failed");
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <dd className="flex min-w-0 items-center">
      {state !== "idle" && (
        <span role="status" className="mr-2 text-xs text-muted">
          {state === "copied" ? t.me.account.copied : t.me.account.copyFailed}
        </span>
      )}
      <span ref={shown} className="font-medium tabular-nums select-all">
        {code}
      </span>
      <button
        type="button"
        aria-label={t.me.account.copyCode}
        onClick={handleCopy}
        className="-mr-3 grid size-11 shrink-0 place-items-center text-muted"
      >
        {state === "copied" ? (
          <Check className="size-4.5 text-win" aria-hidden />
        ) : (
          <Copy className="size-4.5" aria-hidden />
        )}
      </button>
    </dd>
  );
}
const buttonClass = "min-h-11 rounded-xl border border-line px-4 font-medium disabled:opacity-60";

/**
 * The account signed in: the name it shows, which can be changed here, its code for others to
 * check it by, its address, and the way out.
 */
export function AccountCard({ userId, email }: { userId: string; email: string }) {
  const { data: account, isError } = useAccount(userId);
  const rename = useRenameAccount(userId);
  const [editing, setEditing] = useState<string>();
  const [nameIssue, setNameIssue] = useState<string>();
  const [leaving, setLeaving] = useState(false);

  function handleRename(event: FormEvent) {
    event.preventDefault();
    const shown = parseDisplayName(editing ?? "");
    if (!shown.ok) {
      setNameIssue(t.account.nameIssue[shown.issue]);
      return;
    }
    rename.mutate(shown.value, { onSuccess: () => setEditing(undefined) });
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      {editing === undefined ? (
        <div className={rowClass}>
          <p className="min-w-0 truncate text-lg font-medium">{account?.displayName ?? " "}</p>
          <button
            type="button"
            disabled={!account}
            onClick={() => {
              setEditing(account?.displayName ?? "");
              setNameIssue(undefined);
              rename.reset();
            }}
            className="min-h-11 shrink-0 text-sm font-medium text-highlight disabled:opacity-60"
          >
            {t.me.account.rename}
          </button>
        </div>
      ) : (
        <form onSubmit={handleRename} noValidate className="flex flex-col gap-3">
          <TextField
            id="display-name"
            label={t.account.name}
            value={editing}
            issue={nameIssue ?? (rename.isError ? t.me.account.renameFailed : undefined)}
            inputMode="text"
            selectOnFocus
            onChange={(next) => {
              setEditing(next);
              setNameIssue(undefined);
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setEditing(undefined)} className={buttonClass}>
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={rename.isPending}
              className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-accent-text disabled:opacity-60"
            >
              {t.common.save}
            </button>
          </div>
        </form>
      )}

      <dl className="mt-2 divide-y divide-line text-sm">
        <div className={rowClass}>
          <dt className="shrink-0 text-muted">{t.me.account.code}</dt>
          {account ? <AccountCode code={account.code} /> : <dd />}
        </div>
        <div className={rowClass}>
          <dt className="shrink-0 text-muted">{t.me.account.email}</dt>
          <dd className="min-w-0 truncate">{email}</dd>
        </div>
      </dl>
      {isError && (
        <p role="alert" className="mt-2 text-sm text-highlight">
          {t.me.account.unread}
        </p>
      )}

      <button
        type="button"
        disabled={leaving}
        onClick={async () => {
          setLeaving(true);
          await signOut();
          setLeaving(false);
        }}
        className={`${buttonClass} mt-4 w-full`}
      >
        {t.common.signOut}
      </button>
    </section>
  );
}
