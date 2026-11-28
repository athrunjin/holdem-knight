import { parseDisplayName } from "@holdem-knight/core";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { Page } from "@/components/Page";
import { TextField } from "@/components/TextField";
import { openAgreedBooks } from "@/data";
import { type AuthIssue, agreeToTerms, firstEntryName } from "@/data/auth";
import { useAccount, useSession } from "@/data/session";
import { t } from "@/i18n";
import { AgreeField, FormIssue, SubmitButton, textLinkClass } from "./AuthParts";
import { UnsentStep, useSignOut } from "./SignOutStep";

/** What was typed and ticked on the step, as far as it got */
interface Draft {
  typed?: string | undefined;
  agreed: boolean;
}

/**
 * The step's draft for each account, kept while the terms or the privacy policy stand in its
 * place, so reading them loses nothing. In memory only: nothing of it is kept on the device, and
 * it goes when the account agrees or signs out from the step.
 */
const drafts = new Map<string, Draft>();

/**
 * The pages that send an account on to 我的, which the step can stand in for, as a sign-in leaves
 * the address on one. Left there, the page is shown for a moment as the terms open, and sends the
 * account back before they appear.
 */
const GUESTS_ONLY = new Set(["/me/sign-in", "/me/sign-up", "/me/reset"]);

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
  const pathname = useLocation({ select: (location) => location.pathname });
  useEffect(() => {
    if (GUESTS_ONLY.has(pathname)) void navigate({ to: "/me", replace: true });
  }, [pathname, navigate]);
  const email = session.status === "signed-in" ? session.email : "";
  const [draft, setDraft] = useState<Draft>(() => drafts.get(userId) ?? { agreed: false });
  function keep(next: Draft) {
    drafts.set(userId, next);
    setDraft(next);
  }
  // What the person typed, or else the name the account shows, or Google's where that fell back
  const { typed, agreed } = draft;
  const name =
    typed ??
    (account.data
      ? firstEntryName(
          account.data.displayName,
          email,
          session.status === "signed-in" ? session.givenName : undefined,
        )
      : "");
  const [issues, setIssues] = useState<{ name?: string | undefined; agreed?: string | undefined }>(
    {},
  );
  const [issue, setIssue] = useState<AuthIssue>();
  const [busy, setBusy] = useState(false);
  // Signed out, its draft goes; the step keeps it while the sign-out fails
  const leaving = useSignOut((issue) => {
    if (!issue) drafts.delete(userId);
  });

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
    drafts.delete(userId);
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
          selectOnFocus
          onChange={(next) => {
            keep({ ...draft, typed: next });
            setIssues({ ...issues, name: undefined });
          }}
        />
        <AgreeField
          checked={agreed}
          issue={issues.agreed}
          onChange={(next) => {
            keep({ ...draft, agreed: next });
            setIssues({ ...issues, agreed: undefined });
          }}
        />
        <FormIssue issue={issue} />
        <SubmitButton busy={busy}>{t.account.firstEntry.start}</SubmitButton>
        {leaving.unsent === undefined ? (
          <button
            type="button"
            disabled={leaving.leaving}
            onClick={leaving.ask}
            className={`${textLinkClass} self-center disabled:opacity-60`}
          >
            {t.common.signOut}
          </button>
        ) : (
          <UnsentStep
            unsent={leaving.unsent}
            leaving={leaving.leaving}
            onCancel={leaving.cancel}
            onKeep={leaving.keep}
          />
        )}
      </form>
    </Page>
  );
}
