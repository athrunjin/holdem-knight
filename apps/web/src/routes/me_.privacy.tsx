import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/account/AuthParts";
import { useMessages } from "@/i18n";

export const Route = createFileRoute("/me_/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  const m = useMessages();
  return (
    <AuthPage title={m.account.privacy} back="/me/sign-up" audience="anyone">
      {/* A place for the text, which is written before accounts open to the public (ADR 0041) */}
      <p className="text-muted">{m.account.textToCome}</p>
    </AuthPage>
  );
}
