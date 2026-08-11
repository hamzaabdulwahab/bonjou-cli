import { useState } from "react";

import { Logo } from "./Logo";

/**
 * First run. One field, because there is genuinely only one thing to
 * decide: no account is created, nothing is verified, and the name exists
 * so other people can tell which machine is yours.
 */
export function NameGate({ onName }: { onName: (value: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <div className="gate">
      <div className="gate-bar">
        <Logo size={16} />
        <span className="gate-brand">bonjou</span>
        <span className="spacer" />
        <span className="gate-status">
          <span className="blip is-idle" aria-hidden="true" />
          waiting
        </span>
      </div>

      <form
        className="gate-body"
        onSubmit={(event) => {
          event.preventDefault();
          const name = value.trim();
          if (name) onName(name);
        }}
      >
        <p className="bj-label is-accent">Step one of one</p>
        <h1>
          What should people
          <br />
          see you as?
        </h1>
        <p className="gate-lede">
          A name, not an account. It lives in this browser and is shown only to
          people who can already reach you.
        </p>

        <div className="gate-field">
          <input
            autoFocus
            value={value}
            maxLength={64}
            onChange={(event) => setValue(event.target.value)}
            placeholder="ada"
            aria-label="Your name"
          />
          <button type="submit" className="btn-accent" disabled={!value.trim()}>
            Appear
          </button>
        </div>

        <p className="gate-note">
          Nothing is stored on a server, and nothing sends until somebody
          approves it.
        </p>
      </form>
    </div>
  );
}
