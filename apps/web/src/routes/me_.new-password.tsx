import { parsePassword } from "@holdem-knight/core";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { AuthPage, FormIssue, PasswordField, SubmitButton } from "@/components/account/AuthParts";
import { type AuthIssue, setPassword as saveNewPassword } from "@/data/auth";
import { messages, useMessages } from "@/i18n";

export const Route = createFileRoute("/me_/new-password")({
  component: NewPasswordPage,
});

/** The last step of a reset: the code has signed the account in, and it now takes a new password. */
function NewPasswordPage() {
  const m = useMessages();
  const navigate = Route.useNavigate();
  const [password, setPassword] = useState("");
  const [passwordIssue, setPasswordIssue] = useState<string>();
  const [issue, setIssue] = useState<AuthIssue>();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const chosen = parsePassword(password);
    setPasswordIssue(chosen.ok ? undefined : messages().account.passwordIssue[chosen.issue]);
    setIssue(undefined);
    if (!chosen.ok) return;

    setBusy(true);
    const failed = await saveNewPassword(chosen.value);
    if (failed) {
      setBusy(false);
      setIssue(failed);
      return;
    }
    await navigate({ to: "/me", replace: true });
  }

  return (
    <AuthPage title={m.account.newPasswordPage.title} audience="accounts" onSubmit={handleSubmit}>
      <PasswordField
        label={m.account.newPasswordWithRule}
        fresh
        value={password}
        issue={passwordIssue}
        onChange={(next) => {
          setPassword(next);
          setPasswordIssue(undefined);
        }}
      />
      <FormIssue issue={issue} />
      <SubmitButton busy={busy}>{m.common.save}</SubmitButton>
    </AuthPage>
  );
}
