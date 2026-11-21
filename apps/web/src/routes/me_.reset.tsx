import { parseEmail } from "@holdem-knight/core";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import {
  AuthPage,
  EMAIL_ISSUE_TEXT,
  EmailField,
  FormIssue,
  SubmitButton,
} from "@/components/account/AuthParts";
import { type AuthIssue, requestReset } from "@/data/auth";
import { keepPendingCode } from "@/lib/pending-code";

export const Route = createFileRoute("/me_/reset")({
  component: ResetPage,
});

function ResetPage() {
  const navigate = Route.useNavigate();
  const [email, setEmail] = useState("");
  const [emailIssue, setEmailIssue] = useState<string>();
  const [issue, setIssue] = useState<AuthIssue>();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const address = parseEmail(email);
    setEmailIssue(address.ok ? undefined : EMAIL_ISSUE_TEXT[address.issue]);
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
    <AuthPage title="重置密码" back="/me/sign-in" audience="guests" onSubmit={handleSubmit}>
      <p className="text-sm text-muted">输入注册时的邮箱，我们发一个验证码给你。</p>
      <EmailField
        value={email}
        issue={emailIssue}
        onChange={(next) => {
          setEmail(next);
          setEmailIssue(undefined);
        }}
      />
      <FormIssue issue={issue} />
      <SubmitButton busy={busy}>发送验证码</SubmitButton>
    </AuthPage>
  );
}
