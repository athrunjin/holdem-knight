import { createFileRoute, Link } from "@tanstack/react-router";
import { AccountCard } from "@/components/account/AccountCard";
import { BackupSection } from "@/components/BackupSection";
import { InDevelopment } from "@/components/InDevelopment";
import { Page } from "@/components/Page";
import { useSession } from "@/data/session";

export const Route = createFileRoute("/me")({
  component: MePage,
});

const cardClass = "rounded-2xl border border-line bg-surface p-5";

/** With no project to sign in to, as this build has none: the app is a guest's only. */
function GuestOnly() {
  return (
    <section className={cardClass}>
      <p className="font-medium">游客模式</p>
      <p className="mt-1 text-sm text-muted">
        记录只保存在这台设备上。登录后可以保存玩家库和历史牌局，并在多台设备间同步。
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled
          className="h-11 rounded-xl bg-accent px-5 font-semibold text-accent-text disabled:opacity-60"
        >
          登录
        </button>
        <InDevelopment milestone="M6" />
      </div>
    </section>
  );
}

function SignedOut() {
  return (
    <section className={cardClass}>
      <p className="font-medium">还没有登录</p>
      <p className="mt-1 text-sm text-muted">
        记录只保存在这台设备上。登录后自动保存到云端，换手机也不会丢。
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to="/me/sign-in"
          className="grid min-h-11 place-items-center rounded-xl bg-accent px-5 font-semibold text-accent-text"
        >
          登录
        </Link>
        <Link
          to="/me/sign-up"
          className="grid min-h-11 place-items-center rounded-xl border border-line px-5 font-medium"
        >
          注册
        </Link>
      </div>
    </section>
  );
}

function MePage() {
  const session = useSession();

  return (
    <Page title="我的">
      {session.status === "unavailable" && <GuestOnly />}
      {session.status === "signed-out" && <SignedOut />}
      {session.status === "signed-in" && (
        <AccountCard userId={session.userId} email={session.email} />
      )}
      {/* While the kept session is being read, the card's place stays empty for a moment */}
      {session.status === "loading" && <section className={`${cardClass} min-h-40`} />}
      <BackupSection />
      <p className="mt-6 text-center text-xs text-muted">
        Hold’em Knight · 开发版 {__APP_VERSION__}
      </p>
    </Page>
  );
}
