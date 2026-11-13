import type { Currency } from "@holdem-knight/core";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CURRENCY_INFO } from "@/lib/currency";

/**
 * Each currency's mark, drawn in a 24 by 24 box in the color of the text around it.
 *
 * 人民币 is a sitting panda in two strengths of that color: its white fur at full strength and its
 * ears, limbs and eye patches fainter or cut out, so it reads as a panda on a dark page. Drawn for
 * this app.
 *
 * 澳元 is the kangaroo from Material Design Icons (Pictogrammers, Apache License 2.0).
 */
const MARKS: Record<Currency, ReactNode> = {
  CNY: (
    <>
      <g opacity=".45">
        <circle cx="6.9" cy="4.6" r="2.5" />
        <circle cx="17.1" cy="4.6" r="2.5" />
        <ellipse cx="5.3" cy="15.2" rx="2.3" ry="3.3" />
        <ellipse cx="18.7" cy="15.2" rx="2.3" ry="3.3" />
        <ellipse cx="7.6" cy="20.3" rx="3.1" ry="2.4" />
        <ellipse cx="16.4" cy="20.3" rx="3.1" ry="2.4" />
      </g>
      <ellipse cx="12" cy="16.6" rx="5.6" ry="5.4" />
      <path
        fillRule="evenodd"
        d="M5.7 8.6a6.3 5.9 0 1 0 12.6 0a6.3 5.9 0 1 0-12.6 0zM7.9 8.4a1.5 1.9 0 1 0 3 0a1.5 1.9 0 1 0-3 0zM13.1 8.4a1.5 1.9 0 1 0 3 0a1.5 1.9 0 1 0-3 0zM11.05 11.6a.95.6 0 1 0 1.9 0a.95.6 0 1 0-1.9 0z"
      />
    </>
  ),
  AUD: (
    <path d="M19.8 6.59L19 7.97v2.07l-1.31 1.57l-.38 1.64L16 14l-.5-.88l.94-.53l.26-1.14l.07-.3l.7-.84c.18-.21.15-.53-.06-.7a.506.506 0 0 0-.71.06l-.85 1.02l-.29 1.24c-.18.03-.36.07-.56.07c-.69 0-1.32-.24-1.77-.6c-.08 1.3-.5 2.41-1.1 3.03l-1.63 1.76l-.54 3.6L8.07 21l-.54-.83l1.51-.98l.46-3.27v-.01l.5-1.37c-.53-.46-.92-1.26-1.12-2.24l-.17.31c-.36.64-.71 1.29-1.15 1.95c-.45.64-.9 1.34-1.78 1.88c-.44.28-1.08.4-1.61.29c-.56-.12-1.03-.47-1.31-.84c-.55-.76-.71-1.54-.86-2.27l.97-.26c.23.64.53 1.29.91 1.64c.38.33.69.26.96 0c.32-.27.63-.85.89-1.45c.27-.61.49-1.27.72-1.95c.48-1.36.94-2.78 1.75-4.24c.42-.72.93-1.47 1.72-2.14C10.7 4.55 11.73 4 13 4s2.7 1.22 3.58 2.34c.42.55 1.29.48 1.64-.13l.92-1.58a.9.9 0 0 1-.35-.23a.984.984 0 0 1 0-1.4l1.14 1.13c.03 0 .07-.02.07-.02a1 1 0 0 1 .91.58L22 7l-1 .5z" />
  ),
};

/** A currency as its mark, which stands in for its name wherever the app shows one. */
export function CurrencyIcon({ currency, className }: { currency: Currency; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label={CURRENCY_INFO[currency].label}
      className={cn("inline-block size-4 shrink-0", className)}
    >
      {MARKS[currency]}
    </svg>
  );
}
