import type { SVGProps } from 'react';

type BrandMarkProps = SVGProps<SVGSVGElement> & Readonly<{
  /** When true, node uses signal cyan; otherwise inherits currentColor. */
  accentNode?: boolean;
}>;

/** Locked WP JSON Discovery mark — brace frame + probe + node. */
export function BrandMark({ accentNode = true, ...props }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden={props['aria-label'] || props['aria-labelledby'] ? undefined : true}
      {...props}
    >
      <path
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
        d="M 22 18 H 78 V 40 L 71.5 50 L 78 60 V 82 H 22 V 60 L 28.5 50 L 22 40 Z"
      />
      <line
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="square"
        x1="34"
        y1="66"
        x2="48"
        y2="52"
      />
      <circle
        fill={accentNode ? 'var(--brand-signal, #5eb8c4)' : 'currentColor'}
        cx="55.75"
        cy="44.25"
        r="4.35"
      />
    </svg>
  );
}
