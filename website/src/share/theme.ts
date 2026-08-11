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
