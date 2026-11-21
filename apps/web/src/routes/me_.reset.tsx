import { parseEmail } from "@holdem-knight/core";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { AuthPage, EmailField, FormIssue, SubmitButton } from "@/components/account/AuthParts";
import { type AuthIssue, requestReset } from "@/data/auth";
import { messages, useMessages } from "@/i18n";
import { keepPendingCode } from "@/lib/pending-code";

export const Route = createFileRoute("/me_/reset")({
  component: ResetPage,
});

function ResetPage() {
  const m = useMessages();
  const navigate = Route.useNavigate();
  const [email, setEmail] = useState("");
  const [emailIssue, setEmailIssue] = useState<string>();
  const [issue, setIssue] = useState<AuthIssue>();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const address = parseEmail(email);
    setEmailIssue(address.ok ? undefined : messages().account.emailIssue[address.issue]);
    setIssue(undefined);
    if (!address.ok) return;

    setBusy(true);
    const failed = await requestReset(address.value);
    if (failed) {
      setBusy(false);
      setIssue(failed);
      return;
    }
    keepPendingCode({ email: address.value, purpose: "recovery", sentAt: Date.now() });
    await navigate({ to: "/me/verify" });
  }

  return (
    <AuthPage
      title={m.account.resetPage.title}
      back="/me/sign-in"
      audience="guests"
      onSubmit={handleSubmit}
    >
      <p className="text-sm text-muted">{m.account.resetPage.body}</p>
      <EmailField
        value={email}
        issue={emailIssue}
        onChange={(next) => {
          setEmail(next);
          setEmailIssue(undefined);
        }}
      />
      <FormIssue issue={issue} />
      <SubmitButton busy={busy}>{m.account.sendCode}</SubmitButton>
    </AuthPage>
  );
}
