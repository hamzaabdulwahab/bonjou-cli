/**
 * The mark: a geometric b cut into a solid tile.
 *
 * An app icon rather than an outline glyph, because the previous mark
 * read as the standard wifi symbol at small sizes and so said nothing
 * about this product in particular. A filled tile holds its shape at
 * 16px, survives being a favicon, and matches Manrope's roundness in the
 * bowl and the corner radius.
 */
export function Logo({ size = 22, tone }: { size?: number; tone?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="24" height="24" rx="6.75" fill="currentColor" />
      <path
        d="M8.55 4.6v14.5"
        stroke={tone ?? "var(--paper)"}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle
        cx="13.35"
        cy="14.55"
        r="4.55"
        stroke={tone ?? "var(--paper)"}
        strokeWidth="2.5"
      />
    </svg>
  );
}
