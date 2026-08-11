/**
 * The mark: an isometric cube, drawn open.
 *
 * From the approved comp, and kept as a hand-written component rather than
 * an icon-library import so the brand mark stays under our own control.
 *
 * The geometry is worth preserving if this is ever adjusted: one outer
 * hexagon and three edges meeting at the centre. The three edges are what
 * turn a flat hexagon into a solid, and they must terminate exactly at
 * 12,12 — a gap of even half a unit at that junction reads as a drawing
 * error rather than a corner. Stroked, not filled, so the accent colour
 * carries it at any size without a second tone.
 */
export function Logo({ size = 18, tone = "var(--bj-acc)" }: { size?: number; tone?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={tone}
      aria-hidden="true"
      focusable="false"
      className="bj-logo-mark"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5 3H13.5C16.5376 3 19 5.46243 19 8.5C19 10.3842 18.0535 12.0468 16.6186 13.0298C18.3184 14.0041 19.5 15.8643 19.5 18C19.5 21.0376 17.0376 23.5 14 23.5H5V3ZM9.5 7H13C13.8284 7 14.5 7.67157 14.5 8.5C14.5 9.32843 13.8284 10 13 10H9.5V7ZM9.5 14H13.5C14.3284 14 15 14.6716 15 15.5C15 16.3284 14.3284 17 13.5 17H9.5V14Z"
      />
    </svg>
  );
}

/** Mark plus wordmark, used in both mastheads and the footer. */
export function Wordmark({
  size = 18,
  tag = "web",
  className,
}: {
  size?: number;
  tag?: string | null;
  className?: string;
}) {
  return (
    <span className={className ? `wordmark ${className}` : "wordmark"}>
      <Logo size={size} />
      <span className="wordmark-name">bonjou</span>
      {tag ? <span className="wordmark-tag">{tag}</span> : null}
    </span>
  );
}
