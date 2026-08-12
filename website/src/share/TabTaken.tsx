import { ExternalLink } from "lucide-react";

import { Logo } from "./Logo";

/**
 * What a second tab shows.
 *
 * Bonjou is a presence: other people see a name in a list and send things
 * to it. Two tabs would be two names, and nobody outside this browser can
 * tell they are one person, so the second tab does not connect at all.
 *
 * It offers to take the session rather than refusing outright, because
 * the tab somebody is looking at is the one they mean to use, and a tab
 * left open in another window an hour ago should not win by seniority.
 */
export function TabTaken({ onTakeOver }: { onTakeOver: () => void }) {
  return (
    <div className="gate">
      <div className="gate-bar">
        <Logo size={16} />
        <span className="gate-brand">bonjou</span>
        <span className="spacer" />
        <span className="gate-status">
          <span className="blip is-closed" aria-hidden="true" />
          not connected
        </span>
      </div>

      <div className="gate-body">
        <p className="bj-label is-accent">Already open</p>
        <h1>
          Bonjou is running
          <br />
          in another tab.
        </h1>
        <p className="gate-lede">
          Only one tab connects at a time. Two would put you on everyone
          else&rsquo;s list twice, and they have no way of telling that both
          are you.
        </p>

        <div className="gate-actions">
          <button type="button" className="btn-accent is-large" onClick={onTakeOver}>
            <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
            Use it in this tab
          </button>
        </div>

        <p className="gate-note">
          The other tab keeps your conversation and drops its connection.
          Nothing in flight is lost, because nothing is stored on a server
          either way.
        </p>
      </div>
    </div>
  );
}
