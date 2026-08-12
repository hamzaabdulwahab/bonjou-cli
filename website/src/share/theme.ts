import { useCallback, useEffect, useState } from "react";

/**
 * Light and dark, plus following the operating system.
 *
 * The resolved value is stamped onto <html data-theme> rather than left to
 * CSS media queries, so "system" costs no duplicated rules and a manual
 * choice always wins. main.tsx applies the same resolution before React
 * mounts, which is what stops a dark-mode visitor seeing a white flash.
 */

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const KEY = "bonjou.theme";

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function storedChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === "light" || raw === "dark" ? raw : "system";
  } catch {
    return "system";
  }
}

export function resolve(choice: ThemeChoice): ResolvedTheme {
  if (choice === "system") return systemPrefersDark() ? "dark" : "light";
  return choice;
}

/** Applied from the document head too, before the first paint. */
export function apply(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
  paintBrowserChrome();
}

/**
 * The tokens are OKLCH, and theme-color is read by a parser older and
 * narrower than the CSS engine beside it. A canvas round-trip lands on
 * plain hex without a second copy of the colour to keep in step.
 */
function toHexColour(value: string): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return value;
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return value;
  }
}

/**
 * Hand the current background to the browser's own chrome.
 *
 * The two theme-color tags in the head only answer the operating system's
 * preference, so a manual choice left Safari's toolbar and Android's
 * status bar showing the other theme — a light strip above a dark app is
 * the most obvious way a web page announces it is a web page. Read back
 * from --bj-bg so there is still one place the colour is decided.
 */
function paintBrowserChrome(): void {
  const token = getComputedStyle(document.documentElement)
    .getPropertyValue("--bj-bg")
    .trim();
  if (!token) return;
  const colour = toHexColour(token);

  // Every one of them, including the media-scoped pair in the head: the
  // browser takes the first tag whose media matches, so writing only an
  // appended unscoped tag would be overruled by the pair above it.
  const tags = document.querySelectorAll('meta[name="theme-color"]');
  if (tags.length === 0) {
    const tag = document.createElement("meta");
    tag.setAttribute("name", "theme-color");
    tag.setAttribute("content", colour);
    document.head.appendChild(tag);
    return;
  }
  for (const tag of tags) tag.setAttribute("content", colour);
}

/**
 * A media query as state.
 *
 * Needed because some things cannot be handled in CSS alone: a modal that
 * is `display: none` is still an open modal, and it goes on holding the
 * focus trap and the body's pointer-events lock. Anything modal has to be
 * unmounted at the breakpoint, not hidden at it.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(storedChoice);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(choice));

  useEffect(() => {
    const next = resolve(choice);
    setResolved(next);
    apply(next);
    try {
      if (choice === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      // Private browsing refuses storage. The choice still holds for this
      // session, it just will not be remembered.
    }
  }, [choice]);

  // Following the system means following it as it changes, not only at
  // load. Someone on an automatic schedule should not have to reload.
  useEffect(() => {
    if (choice !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next: ResolvedTheme = query.matches ? "dark" : "light";
      setResolved(next);
      apply(next);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [choice]);

  const toggle = useCallback(() => {
    setChoice(resolve(storedChoice()) === "dark" ? "light" : "dark");
  }, []);

  return { choice, resolved, setChoice, toggle };
}
