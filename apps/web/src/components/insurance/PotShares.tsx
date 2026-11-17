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

/**
 * What heads a box about a pot: its name at the left, a little under a section's title in size,
 * and its chips at the right. Anything passed as children sits straight after the name.
 */
export function PotHeading({
  title,
  chips,
  children,
}: {
  title: string;
  chips: number;
  children?: ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-1">
      <span className="min-w-0 truncate text-[17px] font-semibold">{title}</span>
      {children}
      <span className="ml-auto shrink-0 pl-1 text-2xl font-semibold tabular-nums">
        {chipText(chips)}
      </span>
    </h3>
  );
}

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
 * Each part by name with its chips, and its chances on a line of their own under the name, so a
 * name of six characters and chips of six digits still share the line beside the ring on a phone
 * 393px wide. `plain` leaves out the 领先 tag and the share of the pot, for where the ring beside
 * it already says both.
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
          "flex w-full items-start gap-1 rounded-lg px-1 py-0.5 text-left text-sm",
          tone === "leader" && "bg-accent/15 font-semibold",
        );
        const cells = (
          <>
            {/* On the middle of the name's line */}
            <span className={cn("mt-[5px] size-2.5 shrink-0 rounded-full", fill.bar)} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-1">
                <span className="truncate">{label}</span>
                {tone === "leader" && !plain && (
                  <span className="shrink-0 text-xs text-accent">领先</span>
                )}
              </span>
              {note && (
                <span
                  className={cn(
                    "block truncate text-[11px] leading-tight tabular-nums",
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

/** A cover against the pot share it insures, each as a part of that share from 0 to 1. */
export interface CoverShares {
  /** The premium paid for it */
  readonly premium: number;
  /** What it pays on a hit: all of the share for a full pot, half of it for a half pot */
  readonly payout: number;
}

/** One arc of a ring: `start` and `length` are parts of the turn, clockwise from the top. */
function Arc({
  radius,
  width,
  start,
  length,
  className,
}: {
  radius: number;
  width: number;
  start: number;
  length: number;
  className: string;
}) {
  if (length <= 0) return null;
  const circumference = 2 * Math.PI * radius;
  const drawn = Math.min(1, length) * circumference;
  return (
    <circle
      cx="50"
      cy="50"
      r={radius}
      fill="none"
      strokeWidth={width}
      // No round caps: an arc ends where its share ends
      strokeDasharray={`${drawn} ${circumference - drawn}`}
      strokeDashoffset={-start * circumference}
      className={className}
    />
  );
}

/**
 * A pot as three rings, each read clockwise from the top.
 *
 * The outer ring is who put the pot in: the leaders, then the players behind, then the dead
 * money, which so ends at the top.
 *
 * With `cover` come two more. The middle ring is what the cover pays, as long as its part of the
 * pot share: half a turn for half the pot. The inner ring is the premium. Where the pot has dead
 * money it runs back from the top first, under the dead money of the outer ring, and only what is
 * more than the dead money goes on clockwise from the top; with no dead money it is all clockwise.
 * The rest of each turn is left empty. Whatever is passed as children sits in the middle.
 */
export function PotRing({
  parts,
  total,
  cover,
  children,
}: {
  parts: readonly PotShare[];
  total: number;
  /** Missing or all zero leaves the pot's own ring alone. */
  cover?: CoverShares | undefined;
  children?: ReactNode;
}) {
  const radius = 44;
  const part = (share: number) => Math.min(1, Math.max(0, share));
  const payout = part(cover?.payout ?? 0);
  const premium = part(cover?.premium ?? 0);
  // The legend beside the ring lists the parts in the same order, each with the fill it has here
  const shown = filled(parts);
  const drawn = (["leader", "trailer", "dead"] as const).flatMap((tone) =>
    shown.filter((part) => part.tone === tone),
  );
  const dead =
    total > 0
      ? shown.filter(({ tone }) => tone === "dead").reduce((sum, { chips }) => sum + chips, 0) /
        total
      : 0;
  // The premium comes out of the dead money first, as far as that goes
  const back = Math.min(premium, dead);
  // The loss color taken darker, so the premium reads as dark red on the dark page
  const premiumClass = "stroke-[color-mix(in_srgb,var(--loss)_60%,black)]";
  let start = 0;
  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="7" className="stroke-line" />
        {drawn.map(({ key, tone, fill, chips }) => {
          const length = total > 0 ? chips / total : 0;
          const from = start;
          start += length;
          return (
            <Arc
              key={key}
              radius={radius}
              width={tone === "leader" ? 10 : 7}
              start={from}
              length={length}
              className={fill.stroke}
            />
          );
        })}
        {/* A little wider than the premium's ring inside it */}
        <Arc radius={35.25} width={4.5} start={0} length={payout} className="stroke-win/60" />
        <Arc radius={29.5} width={3.5} start={1 - back} length={back} className={premiumClass} />
        <Arc radius={29.5} width={3.5} start={0} length={premium - back} className={premiumClass} />
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
      <PotHeading title="有效总底池" chips={total}>
        {/* A small icon after the name, with a 44px place to tap that takes no room from the line */}
        <button
          type="button"
          aria-label={shown === "ring" ? "换成横条" : "换成圆圈"}
          onClick={() => setPicked(shown === "ring" ? "bar" : "ring")}
          className="-my-2.5 grid size-11 shrink-0 place-items-center text-highlight"
        >
          <ArrowLeftRight className="size-4" aria-hidden />
        </button>
      </PotHeading>
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
