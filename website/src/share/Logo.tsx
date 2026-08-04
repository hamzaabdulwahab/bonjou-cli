/**
 * The mark: a geometric b on a solid tile.
 *
 * Drawn with filled shapes rather than strokes. The previous version
 * stroked a line and a circle that overlapped by 2.25px, so the join
 * between stem and bowl piled up two strokes and read as a smudge at
 * small sizes.
 *
 * The geometry is deliberate and worth preserving if this is ever
 * adjusted:
 *
 *   - The glyph is centred in the tile. Stem and bowl together span
 *     x 6.8 to 17.3 and y 4.4 to 19.6, both centred on 12.
 *   - Stem and bowl share a baseline at y 19.6, so the letter sits flat
 *     rather than the bowl hanging below the stem.
 *   - The bowl's ring is 2.6 wide, the same as the stem, so the whole
 *     letter carries one weight. That single fact is most of what makes
 *     a constructed letterform look drawn rather than assembled.
 *
 * The counter is painted back in the tile colour rather than punched out
 * with a fill rule, which keeps the shapes independent and avoids the
 * winding-order artefacts an even-odd union produces where stem and bowl
 * overlap.
 */
export function Logo({ size = 22, tone }: { size?: number; tone?: string }) {
  const ink = tone ?? "var(--paper)";
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
      <rect x="6.8" y="4.4" width="2.6" height="15.2" rx="1.3" fill={ink} />
      <circle cx="12.3" cy="14.6" r="5" fill={ink} />
      <circle cx="12.3" cy="14.6" r="2.4" fill="currentColor" />
    </svg>
  );
}
