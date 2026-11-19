import { DEFAULT_RAKE_RULE } from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Calculator, HandCoins, type LucideIcon, Timer } from "lucide-react";
import { useState } from "react";
import { RakeDialog, type RakeEntry } from "@/components/game/RakeDialog";
import { Page } from "@/components/Page";

export const Route = createFileRoute("/tools")({
  component: ToolsPage,
});

const toolClass =
  "flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-1 text-sm font-medium whitespace-nowrap transition-colors active:bg-line/40";

function ToolIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="size-7 text-highlight" strokeWidth={1.75} aria-hidden />;
}

/**
 * 抽水计算 on its own: the dialog a game opens, with the default rule and nothing read from or
 * saved to a game. What is added stays while the page is open.
 */
function RakeTool({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<RakeEntry[]>([]);
  const total = entries.reduce((sum, entry) => sum + entry.chips, 0);
  const latest = entries.at(-1);

  return (
    <RakeDialog
      currentChips={total}
      rule={DEFAULT_RAKE_RULE}
      entries={entries}
      undoTo={latest && total - latest.chips}
      saving={false}
      saveFailed={false}
      onSave={async (totalChips, potChips) => {
        const entry = {
          id: crypto.randomUUID(),
          occurredAt: Date.now(),
          chips: totalChips - total,
          ...(potChips !== undefined && { potChips }),
        };
        setEntries([...entries, entry]);
      }}
      onUndo={async () => setEntries(entries.slice(0, -1))}
      onClose={onClose}
    />
  );
}

function ToolsPage() {
  const [raking, setRaking] = useState(false);

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
        <li>
          <button type="button" onClick={() => setRaking(true)} className={toolClass}>
            {/* The rake seat's mark on the game page */}
            <ToolIcon icon={HandCoins} />
            抽水计算
          </button>
        </li>
      </ul>
      {raking && <RakeTool onClose={() => setRaking(false)} />}
    </Page>
  );
}
