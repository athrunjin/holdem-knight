import { parseDisplayName } from "@holdem-knight/core";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Page } from "@/components/Page";
import { TextField } from "@/components/TextField";
import { openAgreedBooks } from "@/data";
import { type AuthIssue, agreeToTerms, firstEntryName, signOut } from "@/data/auth";
import { useAccount, useSession } from "@/data/session";
import { t } from "@/i18n";
import { AgreeField, FormIssue, SubmitButton, textLinkClass } from "./AuthParts";

/**
 * The step an account that has not agreed to the terms passes before its books open (ADR 0052),
 * such as one made through Google or by hand: it confirms its name, says it is 18 and agrees.
 * It stands in place of every page but the terms and the privacy policy, and nothing of the
 * account's books is read until it is done. Signing out brings the guest's books back.
 */
export function FirstEntry({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const session = useSession();
  const account = useAccount(userId);
  const email = session.status === "signed-in" ? session.email : "";
  // What the person typed, or else the name the account shows, or Google's where that fell back
  const [typed, setTyped] = useState<string>();
  const name =
    typed ??
    (account.data
      ? firstEntryName(
          account.data.displayName,
          email,
          session.status === "signed-in" ? session.givenName : undefined,
        )
      : "");
  const [agreed, setAgreed] = useState(false);
  const [issues, setIssues] = useState<{ name?: string | undefined; agreed?: string | undefined }>(
    {},
  );
  const [issue, setIssue] = useState<AuthIssue>();
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const shown = parseDisplayName(name);
    setIssues({
      ...(!shown.ok && { name: t.account.nameIssue[shown.issue] }),
      ...(!agreed && { agreed: t.account.signUpPage.agreeFirst }),
    });
    setIssue(undefined);
    if (!shown.ok || !agreed) return;

    setBusy(true);
    const failed = await agreeToTerms(shown.value);
    if (failed) {
      setBusy(false);
      setIssue(failed);
      return;
    }
    // 我的 is where the account arrives, whatever page the step stood in for
    await navigate({ to: "/me", replace: true });
    await openAgreedBooks(userId);
    setBusy(false);
  }

  return (
    <Page title={t.account.firstEntry.title} centered>
      <form onSubmit={handleSubmit} noValidate className="flex max-w-md flex-col gap-4 pb-8">
        <p className="text-sm text-muted">
          {t.account.firstEntry.signedInBefore}
          <span className="break-all text-text">{email}</span>
          {t.account.firstEntry.signedInAfter}
        </p>
        <TextField
          id="display-name"
          label={t.account.name}
          value={name}
          issue={issues.name}
          inputMode="text"
          autoComplete="nickname"
          onChange={(next) => {
            setTyped(next);
            setIssues({ ...issues, name: undefined });
          }}
        />
        <AgreeField
          checked={agreed}
          issue={issues.agreed}
          onChange={(next) => {
            setAgreed(next);
            setIssues({ ...issues, agreed: undefined });
          }}
        />
        <FormIssue issue={issue} />
        <SubmitButton busy={busy}>{t.account.firstEntry.start}</SubmitButton>
        <button
          type="button"
          disabled={leaving}
          onClick={async () => {
            setLeaving(true);
            await signOut();
            setLeaving(false);
          }}
          className={`${textLinkClass} self-center disabled:opacity-60`}
        >
          {t.common.signOut}
        </button>
      </form>
    </Page>
  );
}
