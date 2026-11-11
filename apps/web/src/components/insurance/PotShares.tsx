import { ArrowLeftRight } from "lucide-react";
import { type ReactNode, useState } from "react";
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

/**
 * Each part by name with its chips. `plain` leaves out the 领先 tag and the share of the pot, for
 * where the ring beside it already says both.
 */
export function PotLegend({
  parts,
  total,
  plain = false,
}: {
  parts: readonly PotShare[];
  total: number;
  plain?: boolean;
}) {
  return (
    <ul className="flex min-w-0 flex-1 flex-col gap-0.5">
      {withFills(parts).map(({ key, tone, fill, label, chips, note, onSelect }) => {
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
              {tone === "leader" && !plain && (
                <span className="shrink-0 text-xs text-accent">领先</span>
              )}
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
              {!plain && (
                <span className="block text-xs font-normal text-muted">
                  {percentText(total > 0 ? chips / total : 0)}
                </span>
              )}
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
const filled = (parts: readonly PotShare[]) => withFills(parts).filter(({ chips }) => chips > 0);

function Bar({ parts, total }: { parts: readonly PotShare[]; total: number }) {
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
        <PotLegend parts={parts} total={total} />
      </div>
    </>
  );
}

/**
 * The parts as a ring. With `cover` it gains an inner track, lit for that share of the way round,
 * and whatever is passed as children sits in the middle.
 */
export function PotRing({
  parts,
  total,
  cover,
  children,
}: {
  parts: readonly PotShare[];
  total: number;
  /** How much of the inner track is lit, from 0 to 1. Missing leaves the ring without one. */
  cover?: number | undefined;
  children?: ReactNode;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const innerRadius = 30;
  const innerCircumference = 2 * Math.PI * innerRadius;
  const lit = Math.min(1, Math.max(0, cover ?? 0)) * innerCircumference;
  let start = 0;
  return (
    <div className="relative size-28 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
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
        {cover !== undefined && (
          <>
            <circle
              cx="50"
              cy="50"
              r={innerRadius}
              fill="none"
              strokeWidth="5"
              className="stroke-line"
            />
            <circle
              cx="50"
              cy="50"
              r={innerRadius}
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${lit} ${innerCircumference}`}
              className={cn("stroke-highlight transition-all", lit === 0 && "opacity-0")}
            />
          </>
        )}
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
      )}
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
        <div className="mt-2 flex items-center gap-1.5">
          <PotRing parts={parts} total={total} />
          <PotLegend parts={parts} total={total} />
        </div>
      ) : (
        <Bar parts={parts} total={total} />
      )}
    </section>
  );
}
