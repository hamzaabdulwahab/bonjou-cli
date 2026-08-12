import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bug,
  Check,
  CheckCircle2,
  ChevronDown,
  EyeOff,
  FileCode,
  FileText,
  FolderClosed,
  Github,
  Globe,
  HelpCircle,
  History,
  Lock,
  MessageSquare,
  Moon,
  ShieldCheck,
  SquareChevronRight,
  Sun,
  Tag,
  Terminal,
} from "lucide-react";

import { Install } from "./Install";
import { Wordmark } from "./Logo";
import { RepoStats } from "./RepoStats";
import { formatBytes } from "./transfer";
import type { useSession } from "./useSession";

const REPO = "https://github.com/hamzaabdulwahab/bonjou-cli";

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#travels", label: "What travels" },
  { href: "#encryption", label: "Encryption" },
  { href: "#install", label: "Install" },
  { href: "#faq", label: "Questions" },
];

/** Highlights the section currently under the masthead. */
function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState("");

  useEffect(() => {
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top))[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-76px 0px -40% 0px", threshold: [0, 0.2] },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

export function Landing({
  session,
  onOpenApp,
  theme,
  onToggleTheme,
}: {
  session: ReturnType<typeof useSession>;
  onOpenApp: () => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
}) {
  const active = useActiveSection(NAV.map((item) => item.href.slice(1)));
  const live = session.status === "connected";

  return (
    <div className="site">
      <header className="masthead">
        <div className="masthead-left">
          <a className="masthead-brand" href="#top">
            <Wordmark size={18} />
          </a>
          <nav aria-label="Sections">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                aria-current={active === item.href.slice(1) ? "true" : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="masthead-right">
          {/* The page demonstrates the product by being connected to it. */}
          <span className={live ? "status-indicator is-live" : "status-indicator"}>
            <span className="status-dot" aria-hidden="true" />
            <span>
              {live
                ? `${session.peers.length} peer${session.peers.length === 1 ? "" : "s"} reachable`
                : "Relay disconnected"}
            </span>
          </span>
          <span className="masthead-rule" aria-hidden="true" />
          <RepoStats compact />
          {onToggleTheme ? (
            <button
              type="button"
              className="icon-btn theme-toggle-btn"
              onClick={onToggleTheme}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? (
                <Sun size={14} strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Moon size={14} strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>
          ) : null}
          <a className="btn-outline" href="#install">
            Install the CLI
          </a>
          <button type="button" className="btn-solid" onClick={onOpenApp}>
            Open the app
            <ArrowRight size={12} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <h1>
              Everyone on your Wi&#8209;Fi is <Typewriter />
            </h1>
            <p className="lede">
              Messages, files and whole folders, straight to the laptop across
              the table. Everything is sealed in your browser before it leaves,
              and nothing lands on anyone's disk until they agree to take it.
            </p>
            <div className="hero-actions">
              <button type="button" className="btn-accent is-large" onClick={onOpenApp}>
                Open it in this tab
              </button>
              <a className="btn-quiet is-large" href="#encryption">
                Read the security model
              </a>
            </div>
            <p className="hero-aside">
              Works between two laptops on one Wi&#8209;Fi, or between two
              cities. Nothing is uploaded, so nothing is waiting on a server
              afterwards.
            </p>
          </div>

          <div className="hero-live">
            <p className="bj-label">Live on this page</p>
            <LivePanel session={session} onOpenApp={onOpenApp} />
            <p className="hero-live-note">
              Not a screenshot. This page is connected to the same relay the
              product uses.
            </p>
          </div>
        </section>

        <section id="how" className="band">
          <div className="band-head">
            <h2>Three steps, and the order is the point.</h2>
          </div>
          <div className="steps">
            <div>
              <span className="step-num">01</span>
              <h3>You appear</h3>
              <p>
                Open the page. Anyone on the same network sees you by name, and
                no code changes hands. The relay groups you by the address your
                network shows the internet.
              </p>
            </div>
            <div>
              <span className="step-num">02</span>
              <h3>You offer</h3>
              <p>
                Pick one person or everyone. They see a name and a size. The
                bytes have not moved, and are still sitting on your machine.
              </p>
            </div>
            <div>
              <span className="step-num">03</span>
              <h3>They approve</h3>
              <p>
                Only then does anything transfer, decrypting in their browser as
                it writes to disk. Decline, and nothing was ever sent.
              </p>
            </div>
          </div>
        </section>

        <section id="travels" className="carries">
          <div>
            <MessageSquare size={19} strokeWidth={1.75} aria-hidden="true" />
            <h3>Messages</h3>
            <p>A note and a 40 GB archive ride in the same sealed envelope.</p>
          </div>
          <div>
            <FileText size={19} strokeWidth={1.75} aria-hidden="true" />
            <h3>Files</h3>
            <p>Any size. Interference is caught partway through, not after.</p>
          </div>
          <div>
            <FolderClosed size={19} strokeWidth={1.75} aria-hidden="true" />
            <h3>Folders</h3>
            <p>One approval, not one per file. The structure survives the trip.</p>
          </div>
          <div>
            <Globe size={19} strokeWidth={1.75} aria-hidden="true" />
            <h3>Across networks</h3>
            <p>Different Wi-Fi? Open a room, send the link. Nothing else changes.</p>
          </div>
        </section>

        <section id="encryption" className="split">
          <div className="split-copy">
            <h2>What actually happens to your file.</h2>
            <p className="lede">
              Four steps, in order, every time. None of them involve the relay
              holding a key.
            </p>
            <div className="relay-box">
              <div className="relay-box-head">
                <Lock size={12} strokeWidth={1.75} aria-hidden="true" />
                <span>RELAY METADATA VISIBILITY</span>
              </div>
              <div className="relay-box-list">
                <div className="relay-item is-visible">
                  <Check size={13} strokeWidth={1.75} aria-hidden="true" />
                  <span>Destination peer ID</span>
                </div>
                <div className="relay-item is-visible">
                  <Check size={13} strokeWidth={1.75} aria-hidden="true" />
                  <span>Encrypted payload byte count</span>
                </div>
                <div className="relay-item is-hidden">
                  <EyeOff size={13} strokeWidth={1.75} aria-hidden="true" />
                  <span>User names · File names · Content</span>
                  <span className="redacted-tag">SEALED</span>
                </div>
              </div>
            </div>
          </div>

          <ol className="chain">
            <li>
              <div className="chain-head">
                <span className="chain-num">01</span>
                <h3>Your tab makes a keypair</h3>
              </div>
              <p>
                X25519, generated on load and destroyed when the tab closes. It
                never leaves the machine, so a key recovered later cannot open a
                transfer that already happened.
              </p>
            </li>
            <li>
              <div className="chain-head">
                <span className="chain-num">02</span>
                <h3>You agree a secret without sending one</h3>
              </div>
              <p>
                Each side combines its private key with the other's public key
                and lands on the same value. HKDF then splits it per purpose:
                the key protecting a file is not the key protecting a message.
              </p>
            </li>
            <li>
              <div className="chain-head">
                <span className="chain-num">03</span>
                <h3>The file is sealed in pieces</h3>
              </div>
              <p>
                AES&#8209;256&#8209;GCM over 64 KiB chunks, each with its own
                tag. A corrupted transfer stops partway instead of completing
                and handing you a bad file.
              </p>
            </li>
            <li>
              <div className="chain-head">
                <span className="chain-num">04</span>
                <h3>The relay moves bytes it cannot read</h3>
              </div>
              <p>
                It writes nothing to disk, so there is no copy to leak later. On
                the same Wi-Fi it is skipped entirely and the two browsers
                connect directly.
              </p>
            </li>
          </ol>
        </section>

        <section id="install" className="band">
          <div className="band-head is-split">
            <div>
              <h2>bonjou&#8209;cli, the original.</h2>
              <p className="lede">
                A single Go binary for chat and file transfer over the local
                network, with no server at all. UDP broadcast to find peers, TCP
                to move payloads, and it never touches the internet. This page
                speaks the same wire protocol.
              </p>
            </div>
          </div>
          <Install />
        </section>

        <section id="security" className="band">
          <h2 className="band-title">
            The limits, at the same volume as the claims.
          </h2>
          <div className="facts">
            <Fact good>
              <strong>End-to-end encrypted.</strong> X25519 then
              AES&#8209;256&#8209;GCM, keys derived per purpose through HKDF.
            </Fact>
            <Fact good>
              <strong>Nothing lands without consent.</strong> Offers carry a name
              and a size, and the payload is only requested after an approval.
            </Fact>
            <Fact good>
              <strong>Forward secrecy per tab.</strong> Each tab's keypair is
              thrown away when it closes.
            </Fact>
            <Fact good>
              <strong>The relay is skipped when it can be.</strong> Two browsers
              that can reach each other carry the payload directly.
            </Fact>
            <Fact>
              <strong>A direct connection shows your address.</strong> That is
              how it is found. On your own network it reveals nothing new.
            </Fact>
            <Fact>
              <strong>The relay sees metadata.</strong> Who sent to whom, when,
              and how many bytes. Not names, filenames, or content.
            </Fact>
            <Fact>
              <strong>First contact is trust on first use.</strong> Compare the
              eight-byte fingerprint out loud to rule out a hostile relay.
            </Fact>
            <Fact>
              <strong>Same address is only a hint.</strong> Behind carrier-grade
              NAT it can mean a whole region, so grouping stops past a small
              number of devices.
            </Fact>
          </div>
        </section>

        <section id="faq" className="band">
          <div className="band-head">
            <h2>The things people ask.</h2>
          </div>
          <div className="faq">
            <details>
              <summary>
                <span>Why do both of us have to be online?</span>
                <ChevronDown size={14} strokeWidth={1.75} className="faq-chevron" aria-hidden="true" />
              </summary>
              <p>
                Because nothing is stored. Your file streams from your machine to
                theirs while both pages are open; there is no copy sitting on a
                server waiting to be collected. That is the trade for the relay
                having nothing to lose, leak, or be asked to hand over.
              </p>
            </details>
            <details>
              <summary>
                <span>How large a file can I send?</span>
                <ChevronDown size={14} strokeWidth={1.75} className="faq-chevron" aria-hidden="true" />
              </summary>
              <p>
                There is no practical ceiling. Files stream in pieces and are
                never held whole in memory, on either side or on the relay. A
                transfer is bounded by patience and bandwidth rather than size.
              </p>
            </details>
            <details>
              <summary>
                <span>Nobody appears on my network. Why?</span>
                <ChevronDown size={14} strokeWidth={1.75} className="faq-chevron" aria-hidden="true" />
              </summary>
              <p>
                Grouping uses the public address your network presents, so both
                devices must be behind the same router. A phone on mobile data
                will not match a laptop on Wi&#8209;Fi even sitting side by side.
                On a large campus or carrier network, too many devices share one
                address to group safely, and the page will say so and suggest a
                room instead.
              </p>
            </details>
            <details>
              <summary>
                <span>Do you keep anything?</span>
                <ChevronDown size={14} strokeWidth={1.75} className="faq-chevron" aria-hidden="true" />
              </summary>
              <p>
                No accounts, no history, no files. The relay holds a list of who
                is connected, in memory, and forgets it when they leave or when
                it restarts. Your name is stored in your own browser and nowhere
                else.
              </p>
            </details>
            <details>
              <summary>
                <span>How is this different from the terminal version?</span>
                <ChevronDown size={14} strokeWidth={1.75} className="faq-chevron" aria-hidden="true" />
              </summary>
              <p>
                bonjou&#8209;cli finds peers over UDP broadcast on your actual
                LAN and never touches the internet, but only works on one subnet.
                bonjou&#8209;web works anywhere and needs the relay to introduce
                you. Both speak the same wire protocol.
              </p>
            </details>
            <details>
              <summary>
                <span>Can I check any of this myself?</span>
                <ChevronDown size={14} strokeWidth={1.75} className="faq-chevron" aria-hidden="true" />
              </summary>
              <p>
                The whole thing is public and readable, relay included. The two
                parts worth your time are the key schedule in{" "}
                <code>internal/network</code> and the relay in{" "}
                <code>internal/relay</code>, which imports none of the crypto
                because it has nothing to decrypt. Every claim on this page is
                checkable against one of those two.
              </p>
            </details>
          </div>
        </section>

        <section className="closer-card">
          <div className="closer-content">
            <h2>Nothing to sign up for. Nothing to delete afterwards.</h2>
            <button
              type="button"
              className="btn-accent is-large closer-btn"
              onClick={onOpenApp}
            >
              Open bonjou web
              <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="foot-grid">
          <div className="foot-brand">
            <Wordmark size={17} tag={null} />
            <p>
              Encrypted transfer for people in the same room. No accounts, no
              history, nothing stored.
            </p>
          </div>

          <div className="foot-col">
            <p className="bj-label">Get it</p>
            <a href="#install">
              <Terminal size={12} strokeWidth={1.75} aria-hidden="true" />
              Install the CLI
            </a>
            <a
              href={`${REPO}/releases/latest`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Tag size={12} strokeWidth={1.75} aria-hidden="true" />
              Releases
            </a>
            <a
              href={`${REPO}/blob/main/docs/install-guide.md`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText size={12} strokeWidth={1.75} aria-hidden="true" />
              Install guide
            </a>
            <button type="button" className="linkish" onClick={onOpenApp}>
              <Globe size={12} strokeWidth={1.75} aria-hidden="true" />
              Open the web app
            </button>
          </div>

          <div className="foot-col">
            <p className="bj-label">Learn</p>
            <a href="#how">
              <BookOpen size={12} strokeWidth={1.75} aria-hidden="true" />
              How it works
            </a>
            <a
              href={`${REPO}/blob/main/docs/security-model.md`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ShieldCheck size={12} strokeWidth={1.75} aria-hidden="true" />
              Security model
            </a>
            <a
              href={`${REPO}/blob/main/HELP.md`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <SquareChevronRight size={12} strokeWidth={1.75} aria-hidden="true" />
              Command reference
            </a>
            <a href="#faq">
              <HelpCircle size={12} strokeWidth={1.75} aria-hidden="true" />
              Frequent questions
            </a>
          </div>

          <div className="foot-col">
            <p className="bj-label">Project</p>
            <a href={REPO} target="_blank" rel="noopener noreferrer">
              <Github size={12} strokeWidth={1.75} aria-hidden="true" />
              Source on GitHub
            </a>
            <a
              href={`${REPO}/issues`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Bug size={12} strokeWidth={1.75} aria-hidden="true" />
              Report an issue
            </a>
            <a
              href={`${REPO}/blob/main/README.md`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileCode size={12} strokeWidth={1.75} aria-hidden="true" />
              Readme
            </a>
            <a
              href={`${REPO}/releases`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <History size={12} strokeWidth={1.75} aria-hidden="true" />
              Changelog
            </a>
          </div>
        </div>

        <div className="foot-bottom">
          <span className="foot-copy">
            No cookies, no analytics, no account.
          </span>
          <span className="spacer" />
          <span className={live ? "foot-relay is-live" : "foot-relay"}>
            <span className="foot-status-dot" aria-hidden="true" />
            <span>{live ? "Relay operational" : "Relay disconnected"}</span>
          </span>
          <a
            className="foot-icon"
            href={REPO}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Source on GitHub"
          >
            <Github size={14} strokeWidth={1.75} aria-hidden="true" />
          </a>
          <a
            className="foot-icon"
            href={`${REPO}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Report an issue"
          >
            <MessageSquare size={14} strokeWidth={1.75} aria-hidden="true" />
          </a>
        </div>
      </footer>
    </div>
  );
}

const TYPEWRITER_PHRASES = [
  "already here.",
  "in the same room.",
  "on the same network.",
  "a tab away.",
  "ready to connect.",
];

function Typewriter() {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentPhrase = TYPEWRITER_PHRASES[phraseIdx];
    let timer: ReturnType<typeof setTimeout>;

    if (!isDeleting && displayText.length < currentPhrase.length) {
      const randomTypingSpeed = Math.floor(Math.random() * 40) + 50;
      timer = setTimeout(() => {
        setDisplayText(currentPhrase.slice(0, displayText.length + 1));
      }, randomTypingSpeed);
    } else if (!isDeleting && displayText.length === currentPhrase.length) {
      timer = setTimeout(() => {
        setIsDeleting(true);
      }, 1800);
    } else if (isDeleting && displayText.length > 0) {
      timer = setTimeout(() => {
        setDisplayText(currentPhrase.slice(0, displayText.length - 1));
      }, 40);
    } else if (isDeleting && displayText.length === 0) {
      setIsDeleting(false);
      setPhraseIdx((prev) => (prev + 1) % TYPEWRITER_PHRASES.length);
    }

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, phraseIdx]);

  return (
    <em className="hero-typewriter">
      <span className="typewriter-text">{displayText}</span>
      <span className="typewriter-cursor" aria-hidden="true">|</span>
    </em>
  );
}

function Fact({ good, children }: { good?: boolean; children: React.ReactNode }) {
  return (
    <p className={good ? "fact is-good" : "fact is-limit"}>
      <span className="fact-mark" aria-hidden="true">
        {good ? "✓" : "!"}
      </span>
      <span>{children}</span>
    </p>
  );
}

/**
 * The roster, live, on the marketing page.
 *
 * Only shown once the session is actually connected, which needs a name.
 * Before that it says so, rather than filling in plausible-looking people:
 * a fake roster on a page whose whole argument is "nothing is stored"
 * would be the one lie that undoes the rest.
 */
function LivePanel({
  session,
  onOpenApp,
}: {
  session: ReturnType<typeof useSession>;
  onOpenApp: () => void;
}) {
  const connected = session.status === "connected";

  return (
    <div className="live-panel">
      <div className="live-panel-bar">
        <span className={connected ? "status-dot is-live" : "status-dot"} aria-hidden="true" />
        <span>
          {connected
            ? `bonjou / you / ${session.peers.length} reachable`
            : "bonjou / not connected"}
        </span>
      </div>

      <div className="live-panel-body">
        {connected && session.peers.length > 0 ? (
          <>
            {session.peers.slice(0, 4).map((peer) => (
              <div className="live-row" key={peer.id}>
                <span className="avatar" aria-hidden="true">
                  {peer.name.slice(0, 1).toLowerCase()}
                </span>
                <span className="live-row-name">{peer.name}</span>
                <span className="live-row-tag">
                  {peer.source === "network" ? "wi-fi" : "room"}
                </span>
              </div>
            ))}
            {session.received.length > 0 ? (
              <p className="live-panel-note">
                {session.received.length} received this session ·{" "}
                {formatBytes(
                  session.received.reduce((sum, item) => sum + item.size, 0),
                )}
              </p>
            ) : null}
          </>
        ) : connected ? (
          <p className="live-panel-empty">
            You are on air. Nobody else has opened the page on this network yet.
          </p>
        ) : (
          <>
            <p className="live-panel-empty">
              Pick a name and this fills with whoever else is on your network.
            </p>
            <button type="button" className="btn-solid" onClick={onOpenApp}>
              Open the app
            </button>
          </>
        )}
      </div>
    </div>
  );
}
