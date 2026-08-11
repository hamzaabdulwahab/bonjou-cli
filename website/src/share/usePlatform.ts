import { useEffect, useState } from "react";

export interface PlatformInfo {
  isMac: boolean;
  isMobile: boolean;
  modKey: string;
}

/**
 * Detects operating system (macOS vs Windows/Linux) and mobile touch status
 * so keyboard shortcut badges (⌘K vs Ctrl+K) and spotlight search controls
 * adapt dynamically to the user's OS and device type.
 */
export function usePlatform(): PlatformInfo {
  const [platform, setPlatform] = useState<PlatformInfo>({
    isMac: true,
    isMobile: false,
    modKey: "⌘",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent.toLowerCase();
    const isMac = /mac|iphone|ipad|ipod/.test(ua);
    const isMobile =
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(ua) ||
      (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);

    setPlatform({
      isMac,
      isMobile,
      modKey: isMac ? "⌘" : "Ctrl",
    });
  }, []);

  return platform;
}
