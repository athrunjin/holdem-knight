import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/account/AuthParts";
import { t } from "@/i18n";

export const Route = createFileRoute("/me_/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <AuthPage title={t.account.privacy} back="/me/sign-up" audience="anyone">
      {/* A place for the text, which is written before accounts open to the public (ADR 0041) */}
      <p className="text-muted">{t.account.textToCome}</p>
    </AuthPage>
  );
}
