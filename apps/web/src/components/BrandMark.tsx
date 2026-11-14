/** The small K◇K mark for dark backgrounds, drawn as in `docs/brand/03-mark/mark.svg`. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="104 112 304 288" aria-hidden className={className}>
      <g transform="translate(256 256)">
        <polygon points="-96,0 0,-126 96,0 0,126" fill="#d6b04c" />
        <path
          d="M-96 0 L0 -126 L96 0 L0 126 Z"
          fill="none"
          stroke="#f3efe2"
          strokeWidth="32"
          strokeLinejoin="miter"
        />
        <g fill="#f3efe2">
          <rect x="-136" y="-136" width="44" height="272" />
          <rect x="92" y="-136" width="44" height="272" />
          <rect x="-149" y="-136" width="70" height="12" />
          <rect x="-149" y="124" width="70" height="12" />
          <rect x="79" y="-136" width="70" height="12" />
          <rect x="79" y="124" width="70" height="12" />
        </g>
      </g>
    </svg>
  );
}
