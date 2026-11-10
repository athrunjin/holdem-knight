import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export interface PotShare {
  readonly key: "leader" | "trailer" | "dead";
  readonly label: string;
  readonly chips: number;
  /** Chances after the name: the leader's win, the trailer's outs, the dead money's split. */
  readonly note?: string | undefined;
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
      {parts.map(({ key, label, chips, note }) => (
        <li
          key={key}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm",
            key === "leader" && "bg-accent/15 font-semibold",
          )}
        >
          <span className={cn("size-3 shrink-0 rounded-full", BAR_CLASS[key])} aria-hidden />
          {/* A long name gives way, so the chances stay whole on the same line */}
          <span className="flex min-w-0 flex-1 items-baseline gap-1">
            <span className="truncate">{label}</span>
            {key === "leader" && <span className="shrink-0 text-xs text-accent">领先</span>}
            {note && (
              <span
                className={cn(
                  "shrink-0 text-xs whitespace-nowrap tabular-nums",
                  key === "leader" ? "text-accent" : "font-normal text-muted",
                )}
              >
                {note}
              </span>
            )}
          </span>
          <span className="shrink-0 text-right tabular-nums">
            <span className="block">{chipText(chips)}</span>
            <span className="block text-xs font-normal text-muted">
              {percentText(total > 0 ? chips / total : 0)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Parts with chips, the only ones that take up room in a chart. */
const filled = (parts: readonly PotShare[]) => parts.filter(({ chips }) => chips > 0);

function Bar({ parts, total }: { parts: readonly PotShare[]; total: number }) {
  return (
    <>
      <div className="mt-2 flex h-4 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {filled(parts).map(({ key, chips }) => (
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
    <div className="mt-2 flex items-center gap-2">
      <svg viewBox="0 0 100 100" className="size-20 shrink-0 -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="10" className="stroke-line" />
        {filled(parts).map(({ key, chips }) => {
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
export function PotShares({ parts }: { parts: readonly PotShare[] }) {
  const [look, setLook] = useState<"ring" | "bar">("ring");
  const total = parts.reduce((sum, { chips }) => sum + chips, 0);
  return (
    <section aria-label="有效总底池" className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <p>
          <span className="block text-sm text-muted">有效总底池</span>
          <span className="block text-2xl font-semibold tabular-nums">{chipText(total)}</span>
        </p>
        <button
          type="button"
          aria-label={look === "ring" ? "换成横条" : "换成圆圈"}
          onClick={() => setLook(look === "ring" ? "bar" : "ring")}
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-line text-highlight"
        >
          <ArrowLeftRight className="size-5" aria-hidden />
        </button>
      </div>
      {look === "ring" ? <Ring parts={parts} total={total} /> : <Bar parts={parts} total={total} />}
    </section>
  );
}
