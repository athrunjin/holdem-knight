import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export interface PotShare {
  readonly key: string;
  /** What the part is: someone ahead, someone behind, or the dead money. */
  readonly tone: "leader" | "trailer" | "dead";
  readonly label: string;
  readonly chips: number;
  /** Chances after the name: the leader's win, the trailer's outs, the dead money's split. */
  readonly note?: string | undefined;
  /** Opens a quick edit of this part. Missing once the part can no longer change. */
  readonly onSelect?: (() => void) | undefined;
}

type Look = "ring" | "bar";

const chipText = (chips: number) => chips.toLocaleString("zh-CN");
const percentText = (share: number) => `${(share * 100).toFixed(1)}%`;

/** Fills by tone. Leaders take the accent color; players behind fade one step each, so neighbors tell apart. */
const FILLS = {
  leader: [{ bar: "bg-accent", stroke: "stroke-accent" }],
  trailer: [
    { bar: "bg-muted/50", stroke: "stroke-muted/50" },
    { bar: "bg-muted/80", stroke: "stroke-muted/80" },
    { bar: "bg-muted/30", stroke: "stroke-muted/30" },
    { bar: "bg-muted/65", stroke: "stroke-muted/65" },
  ],
  dead: [{ bar: "bg-highlight/80", stroke: "stroke-highlight/80" }],
} as const;

/** A part with the fill it keeps in the chart and in the legend. */
type Filled = PotShare & { readonly fill: (typeof FILLS)[PotShare["tone"]][number] };

function withFills(parts: readonly PotShare[]): Filled[] {
  const seen = { leader: 0, trailer: 0, dead: 0 };
  return parts.map((part) => {
    const fills = FILLS[part.tone];
    const fill = fills[seen[part.tone]++ % fills.length] ?? fills[0];
    return { ...part, fill };
  });
}

function Legend({ parts, total }: { parts: readonly Filled[]; total: number }) {
  return (
    <ul className="flex min-w-0 flex-1 flex-col gap-0.5">
      {parts.map(({ key, tone, fill, label, chips, note, onSelect }) => {
        const rowClass = cn(
          "flex w-full items-center gap-1 rounded-lg px-1 py-0.5 text-left text-sm",
          tone === "leader" && "bg-accent/15 font-semibold",
        );
        const cells = (
          <>
            <span className={cn("size-3 shrink-0 rounded-full", fill.bar)} aria-hidden />
            {/* A long name gives way, so the chances stay whole on the same line */}
            <span className="flex min-w-0 flex-1 items-baseline gap-1">
              <span className="truncate">{label}</span>
              {tone === "leader" && <span className="shrink-0 text-xs text-accent">领先</span>}
              {note && (
                <span
                  className={cn(
                    "shrink-0 text-[11px] whitespace-nowrap tabular-nums",
                    tone === "leader" ? "text-accent" : "font-normal text-muted",
                  )}
                >
                  {note}
                </span>
              )}
            </span>
            <span className="shrink-0 text-right leading-tight tabular-nums">
              <span className="block">{chipText(chips)}</span>
              <span className="block text-xs font-normal text-muted">
                {percentText(total > 0 ? chips / total : 0)}
              </span>
            </span>
          </>
        );
        return (
          <li key={key}>
            {onSelect ? (
              <button
                type="button"
                aria-label={`修改${label}`}
                onClick={onSelect}
                className={cn(rowClass, "active:bg-line")}
              >
                {cells}
              </button>
            ) : (
              <div className={rowClass}>{cells}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Parts with chips, the only ones that take up room in a chart. */
const filled = (parts: readonly Filled[]) => parts.filter(({ chips }) => chips > 0);

function Bar({ parts, total }: { parts: readonly Filled[]; total: number }) {
  return (
    <>
      <div className="mt-2 flex h-4 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {filled(parts).map(({ key, tone, fill, chips }) => (
          <span
            key={key}
            className={cn(fill.bar, tone === "leader" && "ring-2 ring-accent ring-inset")}
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

function Ring({ parts, total }: { parts: readonly Filled[]; total: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let start = 0;
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <svg viewBox="0 0 100 100" className="size-28 shrink-0 -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="10" className="stroke-line" />
        {filled(parts).map(({ key, tone, fill, chips }) => {
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
              strokeWidth={tone === "leader" ? 14 : 10}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={offset}
              className={fill.stroke}
            />
          );
        })}
      </svg>
      <Legend parts={parts} total={total} />
    </div>
  );
}

/**
 * The contested pot split into who put what in, with the leaders picked out.
 * `look` is where it starts; the organizer's own pick of ring or bar then stays.
 */
export function PotShares({ parts, look = "ring" }: { parts: readonly PotShare[]; look?: Look }) {
  const [picked, setPicked] = useState<Look>();
  const shown = picked ?? look;
  const total = parts.reduce((sum, { chips }) => sum + chips, 0);
  const drawn = withFills(parts);
  return (
    <section aria-label="有效总底池" className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <p>
          <span className="block text-sm text-muted">有效总底池</span>
          <span className="block text-2xl font-semibold tabular-nums">{chipText(total)}</span>
        </p>
        <button
          type="button"
          aria-label={shown === "ring" ? "换成横条" : "换成圆圈"}
          onClick={() => setPicked(shown === "ring" ? "bar" : "ring")}
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-line text-highlight"
        >
          <ArrowLeftRight className="size-5" aria-hidden />
        </button>
      </div>
      {shown === "ring" ? (
        <Ring parts={drawn} total={total} />
      ) : (
        <Bar parts={drawn} total={total} />
      )}
    </section>
  );
}
