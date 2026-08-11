import { useEffect, useState } from "react";
import { ArrowDownToLine, Check, Copy } from "lucide-react";

export interface TerminalDisplayProps {
  /** The shell command string or download URL */
  command: string;
  /** OS label, e.g., "macOS", "Linux", "Windows" */
  osLabel?: string;
  /** Shell type or method title, e.g., "bash", "zsh", "powershell", "Homebrew", "WinGet" */
  shellType?: string;
  /** Terminal prompt symbol, e.g., "$", "PS>", ">" */
  prompt?: string;
  /** If true, renders a direct download link button instead of a copy button */
  isLink?: boolean;
  /** Optional additional CSS class names */
  className?: string;
}

/**
 * Reusable macOS-style terminal code display component with multi-OS support,
 * dark theme styling, top window dots, prompt indicator, embedded header copy button,
 * interactive external URLs for binary releases, and responsive horizontal scroll.
 */
export function TerminalDisplay({
  command,
  osLabel = "macOS",
  shellType,
  prompt,
  isLink = false,
  className = "",
}: TerminalDisplayProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = () => {
    if (isLink) return;
    void navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
    });
  };

  const defaultPrompt =
    prompt ??
    (osLabel.toLowerCase() === "windows" || shellType?.toLowerCase() === "powershell"
      ? "PS>"
      : "$");

  const title = shellType
    ? shellType.toLowerCase().includes(osLabel.toLowerCase())
      ? shellType
      : `${osLabel} (${shellType})`
    : `${osLabel} terminal`;

  const lines = command.split("\n");

  return (
    <div className={`terminal ${className}`.trim()}>
      <div className="terminal-bar">
        <div className="terminal-controls">
          <span className="terminal-dot is-close" aria-hidden="true" />
          <span className="terminal-dot is-minimize" aria-hidden="true" />
          <span className="terminal-dot is-maximize" aria-hidden="true" />
          <span className="terminal-label">{title}</span>
        </div>
        <span className="spacer" />
        {isLink ? (
          <a
            href={command}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-copy is-link-btn"
            aria-label={`Download ${osLabel} binary release`}
          >
            <ArrowDownToLine size={12} strokeWidth={1.75} aria-hidden="true" />
            Download
          </a>
        ) : (
          <button
            type="button"
            className="btn-copy"
            onClick={handleCopy}
            aria-label={`Copy ${title} command`}
          >
            {copied ? (
              <>
                <Check size={12} strokeWidth={1.75} aria-hidden="true" />
                Copied!
              </>
            ) : (
              <>
                <Copy size={12} strokeWidth={1.75} aria-hidden="true" />
                Copy
              </>
            )}
          </button>
        )}
      </div>
      <div className="terminal-body">
        {isLink ? (
          <div className="terminal-line">
            <ArrowDownToLine
              size={12}
              strokeWidth={1.75}
              className="recipe-glyph"
              aria-hidden="true"
            />
            <a
              href={command}
              target="_blank"
              rel="noopener noreferrer"
              className="terminal-url-link"
              title="Open GitHub Releases page in a new tab"
            >
              {command}
            </a>
          </div>
        ) : (
          lines.map((line, idx) => (
            <div className="terminal-line" key={idx}>
              <span className="prompt">{defaultPrompt}</span>
              <code>{line}</code>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
