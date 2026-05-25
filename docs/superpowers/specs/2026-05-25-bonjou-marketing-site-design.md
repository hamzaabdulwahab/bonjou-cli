# Bonjou Marketing Site Redesign

## Direction

Rebuild the website as a product marketing site, not an open-source project showcase. The visual reference is Beam's marketing structure: strong executive headline, obvious call to action, proof line, solution/use-case sections, product walkthrough, security proof, install flow, FAQ, and final CTA.

The page should feel light, precise, and product-led. Use a mostly white interface with deep navy text, blue accent, and dark terminal/product surfaces. The logo is text-only: `Bonjou`. Avoid GitHub stars, release pills, icon-heavy navigation, and decorative repo widgets.

## Audience

People who need to move files and messages across a local network without accounts, cloud storage, or shared-drive friction:

- dev teams on the same LAN
- labs, classrooms, and offices
- secure internal file handoffs
- mixed macOS, Linux, and Windows environments

## Page Structure

1. Hero with the product promise, install CTA, secondary "see workflow" CTA, proof line, and a large terminal/product visual.
2. Proof strip with local-first, approval-first, encrypted, and cross-platform claims.
3. Use-case suite that replaces the GitHub showcase with concrete customer contexts.
4. Workflow story: discover peers, inspect incoming metadata, approve, receive locally.
5. Product surface: terminal demo plus compact command examples.
6. Security and trust: no relay, metadata-first approval, AES-256-GCM, TOFU pinning.
7. Install section with OS tabs and copy controls.
8. FAQ.
9. Final CTA.

## Visual System

- Typography: Geist for headings, body, and UI chrome; JetBrains Mono only for commands and terminal content.
- Color: white background, navy text, blue primary CTA, pale blue bands, black terminal panels.
- Components: low-radius buttons, clean table/list rows, product mockup frames, restrained section bands.
- Motion: subtle reveal and terminal typing only. Respect reduced-motion preferences.
- Icons: avoid generic decorative icons. Use text labels, lines, and product UI instead.

## Responsive Requirements

The page must stay professional at desktop, tablet, and mobile widths. No horizontal scrollbars, clipped text, overlapping copy states, oversized fonts, or broken command rows. The first viewport must show the offer and a visible product surface.

## Verification

Run the Vite build, Go tests, and browser checks for desktop and mobile. Verify no runtime errors, no horizontal overflow, CTA/copy interaction works, and the deployed Vercel production URL reflects the latest commit.
