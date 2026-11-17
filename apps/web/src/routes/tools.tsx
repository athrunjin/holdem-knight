import { createFileRoute, Link } from "@tanstack/react-router";
import { Calculator, type LucideIcon, Percent, Timer } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/insurance/Modal";
import { Page } from "@/components/Page";

export const Route = createFileRoute("/tools")({
  component: ToolsPage,
});

const toolClass =
  "flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-1 text-sm font-medium whitespace-nowrap transition-colors active:bg-line/40";

function ToolIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="size-7 text-highlight" strokeWidth={1.75} aria-hidden />;
}

/** Tools that are not built yet. A tap says so. */
const COMING = [{ name: "抽水计算", icon: Percent }] as const;

function ToolsPage() {
  const [coming, setComing] = useState<string | null>(null);

  return (
    <Page title="工具">
      <ul className="grid grid-cols-3 gap-2">
        <li>
          <Link to="/tools/insurance" className={toolClass}>
            <ToolIcon icon={Calculator} />
            保险计算
          </Link>
        </li>
        <li>
          <Link to="/tools/call-time" className={toolClass}>
            <ToolIcon icon={Timer} />
            Call Time
          </Link>
        </li>
        {COMING.map(({ name, icon }) => (
          <li key={name}>
            <button type="button" onClick={() => setComing(name)} className={toolClass}>
              <ToolIcon icon={icon} />
              {name}
            </button>
          </li>
        ))}
      </ul>
      {coming && (
        <Modal title={coming} onClose={() => setComing(null)}>
          <p className="text-sm text-muted">这个功能还在开发中。</p>
          <button
            type="button"
            onClick={() => setComing(null)}
            className="mt-3 min-h-11 w-full rounded-xl border border-line font-medium"
          >
            关闭
          </button>
        </Modal>
      )}
    </Page>
  );
}
