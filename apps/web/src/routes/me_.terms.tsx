import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/account/AuthParts";

export const Route = createFileRoute("/me_/terms")({
  component: () => (
    <AuthPage title="用户协议" back="/me/sign-up" audience="anyone">
      {/* A place for the text, which is written before accounts open to the public (ADR 0041) */}
      <p className="text-muted">正式文本会在账户功能上线前补充。</p>
    </AuthPage>
  ),
});
