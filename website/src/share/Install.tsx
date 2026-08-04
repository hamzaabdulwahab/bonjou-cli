import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Getting bonjou-cli onto your machine.
 *
 * The job here is narrow: one person, on one operating system, wants the
 * one line that works for them. A flat list of every platform makes them
 * scan for their own and then hand-select the text, which is the part
 * that goes wrong. So the platform is detected, the command is presented
 * as a terminal because that is literally where it goes, and copying is
 * a button rather than a drag.
 *
 * Commands are verbatim from README.md. They are executed as written, so
 * they are never paraphrased or pointed at a nicer-looking domain.
 */

const RAW = "https://raw.githubusercontent.com/hamzaabdulwahab/bonjou-cli/main";
const RELEASES = "https://github.com/hamzaabdulwahab/bonjou-cli/releases/latest";

interface Platform {
  id: string;
  label: string;
  prompt: string;
  command: string;
  alternatives: { name: string; command: string }[];
}

const PLATFORMS: Platform[] = [
  {
    id: "macos",
    label: "macOS",
    prompt: "$",
    command: `curl -fsSL ${RAW}/scripts/install.sh | bash`,
    alternatives: [
      { name: "Homebrew", command: "brew install hamzaabdulwahab/bonjou/bonjou" },
    ],
  },
  {
    id: "linux",
    label: "Linux",
    prompt: "$",
    command: `curl -fsSL ${RAW}/scripts/install.sh | bash`,
    alternatives: [],
  },
  {
    id: "windows",
    label: "Windows",
    prompt: "PS>",
    command: `iwr ${RAW}/scripts/install.ps1 -useb | iex`,
    alternatives: [
      { name: "WinGet", command: "winget install HamzaAbdulWahab.Bonjou" },
      {
        name: "Scoop",
        command:
          "scoop install https://raw.githubusercontent.com/hamzaabdulwahab/scoop-bonjou/main/bonjou.json",
      },
    ],
  },
];

function detectPlatform(): string {
  if (typeof navigator === "undefined") return "macos";
  const ua = `${navigator.userAgent} ${navigator.platform ?? ""}`;
  if (/win/i.test(ua)) return "windows";
  if (/mac|iphone|ipad/i.test(ua)) return "macos";
  if (/linux|x11|android|cros/i.test(ua)) return "linux";
  return "macos";
}

function useCopy(): [string | null, (id: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = useCallback((id: string, text: string) => {
    void navigator.clipboard.writeText(text).then(
      () => setCopied(id),
      () => setCopied(null),
    );
  }, []);

  return [copied, copy];
}

export function Install() {
  const [active, setActive] = useState<string>(detectPlatform);
  const [copied, copy] = useCopy();

  const platform = PLATFORMS.find((p) => p.id === active) ?? PLATFORMS[0];

  return (
    <div className="install">
      <div className="install-bar" role="tablist" aria-label="Operating system">
        {PLATFORMS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            className="os-tab"
            aria-selected={entry.id === active}
            onClick={() => setActive(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="terminal">
        <pre>
          <span className="prompt">{platform.prompt}</span>
          <code>{platform.command}</code>
        </pre>
        <button
          type="button"
          className="copy"
          onClick={() => copy(platform.id, platform.command)}
          aria-label={`Copy the ${platform.label} install command`}
        >
          {copied === platform.id ? (
            <>
              <Check size={14} strokeWidth={2.5} aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy size={14} strokeWidth={2} aria-hidden="true" />
              Copy
            </>
          )}
        </button>
      </div>

      {platform.alternatives.length > 0 ? (
        <div className="alts">
          <p className="alts-label">Or through a package manager</p>
          {platform.alternatives.map((alt) => (
            <div className="alt" key={alt.name}>
              <span className="alt-name">{alt.name}</span>
              <code>{alt.command}</code>
              <button
                type="button"
                className="copy quiet"
                onClick={() => copy(alt.name, alt.command)}
                aria-label={`Copy the ${alt.name} command`}
              >
                {copied === alt.name ? (
                  <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  <Copy size={13} strokeWidth={2} aria-hidden="true" />
                )}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <p className="install-note">
        {platform.id === "linux"
          ? "Debian packages for amd64 and arm64 are on the "
          : "Raw binaries for every platform are on the "}
        <a href={RELEASES}>releases page</a>.
      </p>
    </div>
  );
}
