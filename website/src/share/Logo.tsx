/**
 * The mark: a point with arcs opening to either side.
 *
 * It reads as a signal passing between two places, which is the whole
 * product. Drawn inline so it needs no asset pipeline and inherits
 * currentColor, and legible down to 16px because that is the size it
 * spends most of its life at.
 */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
      <path d="M7.2 8.6a4.8 4.8 0 0 0 0 6.8" />
      <path d="M16.8 8.6a4.8 4.8 0 0 1 0 6.8" />
      <path d="M3.6 5.4a9.3 9.3 0 0 0 0 13.2" opacity="0.55" />
      <path d="M20.4 5.4a9.3 9.3 0 0 1 0 13.2" opacity="0.55" />
    </svg>
  );
}
