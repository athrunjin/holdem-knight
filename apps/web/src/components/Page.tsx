import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PageProps {
  title: ReactNode;
  /** A short note on the title's line, to its right */
  titleNote?: ReactNode;
  /** A line under the title */
  subtitle?: ReactNode;
  /** Narrows the page to a centered column, for single forms. The title stays at the left, as on every page. */
  centered?: boolean;
  /** Actions to the right of the title */
  actions?: ReactNode;
  children: ReactNode;
}

/** Page skeleton: shared title, margins and maximum width. */
export function Page({
  title,
  titleNote,
  subtitle,
  centered = false,
  actions,
  children,
}: PageProps) {
  return (
    <div
      className={cn("mx-auto w-full px-4 md:px-8", centered ? "max-w-md md:max-w-lg" : "max-w-3xl")}
    >
      {/* Actions that do not fit beside the title go under it, at the right */}
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-4 md:pt-8">
        <div className="max-w-full min-w-0 shrink-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
            {titleNote}
          </div>
          {subtitle}
        </div>
        {actions}
      </header>
      <div className="pt-4">{children}</div>
    </div>
  );
}
