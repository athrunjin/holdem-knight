import { CODE_LENGTH, parseCode } from "@holdem-knight/core";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import {
  AuthPage,
  CodeField,
  FormIssue,
  SubmitButton,
  textLinkClass,
} from "@/components/account/AuthParts";
import { type AuthIssue, resendCode, verifyCode } from "@/data/auth";
import { messages, useMessages } from "@/i18n";
import { keepPendingCode, readPendingCode } from "@/lib/pending-code";

export const Route = createFileRoute("/me_/verify")({
  component: VerifyPage,
});

/** Seconds between two emails to one address, which the sign-in service holds to as well. */
const RESEND_AFTER = 60;

/** Seconds until another email may go out, counted from when the last one did. */
function useSecondsLeft(sentAt: number) {
  const left = () => Math.max(0, RESEND_AFTER - Math.floor((Date.now() - sentAt) / 1000));
  const [seconds, setSeconds] = useState(left);
  // biome-ignore lint/correctness/useExhaustiveDependencies: counts from the last email, whenever that was
  useEffect(() => {
    setSeconds(left());
    const timer = setInterval(() => setSeconds(left()), 1000);
    return () => clearInterval(timer);
  }, [sentAt]);
  return seconds;
}

function VerifyPage() {
  const m = useMessages();
  const navigate = Route.useNavigate();
  const [pending, setPending] = useState(readPendingCode);
  const [code, setCode] = useState("");
  const [codeIssue, setCodeIssue] = useState<string>();
  const [issue, setIssue] = useState<AuthIssue>();
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const secondsLeft = useSecondsLeft(pending?.sentAt ?? 0);

  // Reached with no email on its way, such as from a bookmark
  if (!pending) return <Navigate to="/me/sign-in" replace />;
  const { email, purpose } = pending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const typed = parseCode(code);
    setCodeIssue(typed.ok ? undefined : messages().account.codeIssue(CODE_LENGTH)[typed.issue]);
    setIssue(undefined);
    if (!typed.ok) return;

    setBusy(true);
    const failed = await verifyCode(email, typed.value, purpose);
    if (failed) {
      setBusy(false);
      setIssue(failed);
      return;
    }
    keepPendingCode(undefined);
    // A right code signs the account in: a new one is done, a reset still needs its password
    await navigate({ to: purpose === "recovery" ? "/me/new-password" : "/me", replace: true });
  }

  async function handleResend() {
    setIssue(undefined);
    setResent(false);
    const failed = await resendCode(email, purpose);
    if (failed) {
      setIssue(failed);
      return;
    }
    const next = { email, purpose, sentAt: Date.now() };
    keepPendingCode(next);
    setPending(next);
    setResent(true);
  }

  return (
    <AuthPage
      title={m.account.verifyPage.title}
      back={purpose === "recovery" ? "/me/reset" : "/me/sign-up"}
      audience="anyone"
      onSubmit={handleSubmit}
    >
      <p className="text-sm text-muted">
        {m.account.verifyPage.sentBefore(CODE_LENGTH)}
        <span className="break-all text-text">{email}</span>
        {m.account.verifyPage.sentAfter}
      </p>
      <CodeField
        value={code}
        issue={codeIssue}
        onChange={(next) => {
          setCode(next);
          setCodeIssue(undefined);
        }}
      />
      <FormIssue issue={issue} />
      <SubmitButton busy={busy}>{m.common.confirm}</SubmitButton>
      <div className="flex items-center justify-between">
        {secondsLeft > 0 ? (
          <span className="inline-flex min-h-11 items-center text-sm text-muted">
            {resent ? m.account.verifyPage.resent : ""}
            {m.account.verifyPage.resendIn(secondsLeft)}
          </span>
        ) : (
          <button type="button" onClick={handleResend} className={textLinkClass}>
            {m.account.verifyPage.resend}
          </button>
        )}
        <Link to={purpose === "recovery" ? "/me/reset" : "/me/sign-up"} className={textLinkClass}>
          {m.account.verifyPage.changeEmail}
        </Link>
      </div>
      <p className="text-xs text-muted">
        {m.account.verifyPage.notReceived}
        {purpose === "sign-up" && m.account.verifyPage.alreadyRegistered}
      </p>
    </AuthPage>
  );
}
