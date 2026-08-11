import { useCallback, useEffect, useState } from "react";

/**
 * Small display preferences, and one real notification.
 *
 * Everything here is genuinely wired to something. A switch that looks
 * like a setting and changes nothing is worse than no switch, so this list
 * stays short on purpose.
 */

const KEY = "bonjou.settings.v1";

export interface Settings {
  /** Show "direct" or "relayed" on finished transfers. */
  routeTags: boolean;
  /** Tighter rows, for people watching a busy room on a small screen. */
  compact: boolean;
  /** A system notification when somebody offers you a file. */
  notifyOffers: boolean;
}

const DEFAULTS: Settings = {
  routeTags: true,
  compact: false,
  notifyOffers: false,
};

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // Private browsing refuses storage. The choice holds for this
      // session and is simply not remembered.
    }
  }, [settings]);

  const set = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  /**
   * Turning notifications on has to ask the browser, and the answer can be
   * no. Reporting "on" after a denial would be a lie about whether
   * anything will actually appear, so the switch only moves on a grant.
   */
  const enableNotifications = useCallback(async (): Promise<boolean> => {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") {
      set("notifyOffers", true);
      return true;
    }
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    const granted = result === "granted";
    if (granted) set("notifyOffers", true);
    return granted;
  }, [set]);

  return { settings, set, enableNotifications };
}

export function notifyOffer(from: string, name: string): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }
  if (document.visibilityState === "visible") return;
  try {
    new Notification(`${from} is offering a file`, {
      body: `${name} — nothing downloads until you approve it.`,
      icon: "/favicon.svg",
      tag: "bonjou-offer",
    });
  } catch {
    // Some engines only allow notifications from a service worker. The
    // in-page banner still fires either way.
  }
}
