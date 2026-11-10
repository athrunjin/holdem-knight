import { useState } from "react";
import { cn } from "@/lib/cn";

export interface PotShare {
  readonly key: "leader" | "trailer" | "dead";
  readonly label: string;
  readonly chips: number;
}

const chipText = (chips: number) => chips.toLocaleString("zh-CN");
const percentText = (share: number) => `${(share * 100).toFixed(1)}%`;

/** Fill for each part. The leader is the one in the accent color. */
const BAR_CLASS = { leader: "bg-accent", trailer: "bg-muted/50", dead: "bg-highlight/80" } as const;
const STROKE_CLASS = {
  leader: "stroke-accent",
  trailer: "stroke-muted/50",
  dead: "stroke-highlight/80",
} as const;

function Legend({ parts, total }: { parts: readonly PotShare[]; total: number }) {
  return (
    <ul className="flex min-w-0 flex-1 flex-col gap-1">
      {parts.map(({ key, label, chips }) => (
        <li
          key={key}
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-1 text-sm",
            key === "leader" && "bg-accent/15 font-semibold",
          )}
        >
          <span className={cn("size-3 shrink-0 rounded-full", BAR_CLASS[key])} aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            {label}
            {key === "leader" && <span className="ml-1 text-xs text-accent">领先</span>}
          </span>
          <span className="tabular-nums">{chipText(chips)}</span>
          <span className="w-12 text-right text-xs text-muted tabular-nums">
            {percentText(total > 0 ? chips / total : 0)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Bar({ parts, total }: { parts: readonly PotShare[]; total: number }) {
  return (
    <>
      <div className="mt-2 flex h-4 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {parts.map(({ key, chips }) => (
          <span
            key={key}
            className={cn(BAR_CLASS[key], key === "leader" && "ring-2 ring-accent ring-inset")}
            style={{ flexGrow: chips }}
          />
        ))}
      </div>
      <div className="mt-2">
        <Legend parts={parts} total={total} />
      </div>
    </>
  );
}

function Ring({ parts, total }: { parts: readonly PotShare[]; total: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let start = 0;
  return (
    <div className="mt-2 flex items-center gap-3">
      <svg viewBox="0 0 100 100" className="size-28 shrink-0 -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="10" className="stroke-line" />
        {parts.map(({ key, chips }) => {
          const length = total > 0 ? (chips / total) * circumference : 0;
          const offset = -start;
          start += length;
          return (
            <circle
              key={key}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              strokeWidth={key === "leader" ? 14 : 10}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={offset}
              className={STROKE_CLASS[key]}
            />
          );
        })}
      </svg>
      <Legend parts={parts} total={total} />
    </div>
  );
}

/** The contested pot split into who put what in, with the leader picked out. */
export function PotShares({
  parts,
  uncalledChips,
}: {
  parts: readonly PotShare[];
  uncalledChips: number;
}) {
  // Two looks to compare on a phone; one goes once the organizer picks
  const [look, setLook] = useState<"bar" | "ring">("bar");
  const total = parts.reduce((sum, { chips }) => sum + chips, 0);
  const shown = parts.filter(({ chips }) => chips > 0);
  return (
    <section aria-label="有效总底池" className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <p>
          <span className="block text-sm text-muted">有效总底池</span>
          <span className="block text-2xl font-semibold tabular-nums">{chipText(total)}</span>
        </p>
        <div className="flex rounded-lg border border-line p-0.5 text-xs">
          {(["bar", "ring"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={look === option}
              onClick={() => setLook(option)}
              className={cn(
                "min-h-11 rounded-md px-2",
                look === option ? "bg-accent text-accent-text" : "text-muted",
              )}
            >
              {option === "bar" ? "横条" : "圆圈"}
            </button>
          ))}
        </div>
      </div>
      {look === "bar" ? <Bar parts={shown} total={total} /> : <Ring parts={shown} total={total} />}
      {uncalledChips > 0 && (
        <p className="mt-2 text-sm text-muted">
          未被跟注的 {chipText(uncalledChips)} 退回，不计入。
        </p>
      )}
    </section>
  );
}
