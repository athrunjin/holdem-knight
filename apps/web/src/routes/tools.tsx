import { DEFAULT_RAKE_RULE, parseRake, type RakeForm, toRakeForm } from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Calculator, HandCoins, type LucideIcon, Timer } from "lucide-react";
import { useState } from "react";
import { inChipsOnly, NO_STAKES, RakeSettingsPanel } from "@/components/game/ChargeSettings";
import { RakeDialog, type RakeEntry } from "@/components/game/RakeDialog";
import { Page } from "@/components/Page";
import { useStoredState } from "@/lib/stored-state";

export const Route = createFileRoute("/tools")({
  component: ToolsPage,
});

const toolClass =
  "flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-1 text-sm font-medium whitespace-nowrap transition-colors active:bg-line/40";

function ToolIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="size-7 text-highlight" strokeWidth={1.75} aria-hidden />;
}

/** The tool's rake settings, kept in this browser between visits. */
interface RakeToolSettings {
  readonly source: string;
  readonly form: RakeForm;
}

/** The default rule in chips alone, as there are no blinds here. */
const DEFAULT_RAKE_SETTINGS: RakeToolSettings = {
  source: "default",
  form: inChipsOnly(toRakeForm(DEFAULT_RAKE_RULE)),
};

function parseRakeSettings(stored: unknown): RakeToolSettings | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { source, form } = stored as Partial<RakeToolSettings>;
  if (typeof source !== "string" || typeof form !== "object" || form === null) return undefined;
  const kept = { ...DEFAULT_RAKE_SETTINGS.form, ...form };
  return parseRake(kept).ok ? { source, form: inChipsOnly(kept) } : undefined;
}

/**
 * 抽水计算 on its own: the dialog a game opens, with nothing read from or saved to a game. Its
 * settings are open, in chips alone, and kept in this browser. What is added stays while the page
 * is open.
 */
function RakeTool({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<RakeEntry[]>([]);
  const [settings, setSettings] = useStoredState(
    "rake-tool.settings",
    DEFAULT_RAKE_SETTINGS,
    parseRakeSettings,
  );
  const parsed = parseRake(settings.form);
  const total = entries.reduce((sum, entry) => sum + entry.chips, 0);
  const latest = entries.at(-1);

  return (
    <RakeDialog
      currentChips={total}
      rule={parsed.ok ? parsed.rule : DEFAULT_RAKE_RULE}
      settings={
        <RakeSettingsPanel
          value={{ enabled: true, ...settings }}
          currency="CNY"
          stakes={NO_STAKES}
          chipsOnly
          defaultOpen
          onChange={({ source, form }) => {
            setSettings({ source, form });
            return true;
          }}
        />
      }
      entries={entries}
      undoTo={latest && total - latest.chips}
      saving={false}
      saveFailed={false}
      onSave={async (totalChips, potChips, typedOver) => {
        const entry = {
          id: crypto.randomUUID(),
          occurredAt: Date.now(),
          chips: totalChips - total,
          ...(potChips !== undefined && { potChips }),
          ...(typedOver && { typedOver: true as const }),
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
