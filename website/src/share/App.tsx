import { useCallback, useState } from "react";
import {
  Boxes,
  FileText,
  Github,
  Globe,
  KeyRound,
  MessageSquare,
  PackageOpen,
  ShieldCheck,
  Terminal,
} from "lucide-react";

import { Instrument } from "./Instrument";
import { Logo } from "./Logo";
import { RepoStats } from "./RepoStats";
import { useSession } from "./useSession";

const REPO = "https://github.com/hamzaabdulwahab/bonjou-cli";
const RAW = "https://raw.githubusercontent.com/hamzaabdulwahab/bonjou-cli/main";

// Verbatim from README.md. An install command is executed as written, so
// these must never be paraphrased or shortened to a nicer-looking domain.
const INSTALL = [
  { os: "macOS, Linux", cmd: `curl -fsSL ${RAW}/scripts/install.sh | bash` },
  { os: "Windows", cmd: `iwr ${RAW}/scripts/install.ps1 -useb | iex` },
  { os: "Homebrew", cmd: "brew install hamzaabdulwahab/bonjou/bonjou" },
  { os: "WinGet", cmd: "winget install HamzaAbdulWahab.Bonjou" },
];

const STATUS_LABEL: Record<string, string> = {
  idle: "starting",
  connecting: "connecting",
  connected: "on air",
  reconnecting: "reconnecting",
  closed: "offline",
};

function storedName(): string {
  try {
    return localStorage.getItem("bonjou.name") ?? "";
  } catch {
    return "";
  }
}

export default function App() {
  const [name, setName] = useState(storedName);
  const session = useSession(name, Boolean(name));

  const commitName = useCallback((value: string) => {
    try {
      localStorage.setItem("bonjou.name", value);
    } catch {
      // Private browsing refuses storage. The name still works for this
      // session; it just will not be remembered.
    }
    setName(value);
  }, []);

  return (
    <>
      <header className="masthead">
        <div className="wrap masthead-inner">
          <a className="wordmark" href="/">
            <Logo size={20} />
            <span>bonjou</span>
            <span className="wordmark-tag">web</span>
          </a>

          <nav>
            <a href="#how">How it works</a>
            <a href="#travels">What travels</a>
            <a href="#encryption">Encryption</a>
            <a href="#cli">Terminal</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="masthead-side">
            {/* The site demonstrates the product by being connected to it. */}
            <span className={`live live-${session.status}`}>
              <span className="live-dot" aria-hidden="true" />
              {STATUS_LABEL[session.status] ?? session.status}
              {session.peers.length > 0 ? ` · ${session.peers.length}` : ""}
            </span>
            <a className="icon-link" href={REPO} aria-label="Source on GitHub">
              <Github size={18} strokeWidth={2} aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <h1>
              Everyone on your Wi&#8209;Fi is <em>already here</em>.
            </h1>
            <p className="lede">
              Messages, files, and folders, straight to the laptop across the
              table. Encrypted in your browser, never stored, never saved
              without a yes.
            </p>
          </div>

          <Instrument
            name={name}
            onName={commitName}
            status={session.status}
            code={session.code}
            peers={session.peers}
            fingerprints={session.fingerprints}
            events={session.events}
            received={session.received}
            pendingCount={session.pendingCount}
            unread={session.unread}
            markRead={session.markRead}
            notice={session.notice}
            networkGrouped={session.networkGrouped}
            onNotice={session.setNotice}
            onSendText={session.sendText}
            onSendFiles={session.sendFiles}
            onApprove={session.approve}
            onDecline={session.decline}
            onCreateRoom={session.createRoom}
            onJoinRoom={session.joinRoom}
          />

          <RepoStats />
        </section>

        <section id="how" className="wrap">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2>Three steps, and the order matters.</h2>
          </div>
          <div className="steps">
            <div className="step">
              <h3>You appear</h3>
              <p>
                Open the page. Anyone else who opens it on the same network
                sees you by name, without a code passing between you. The
                terminal version does this with UDP broadcast. A browser is not
                allowed to, so the relay groups you by the address your network
                shows the internet.
              </p>
            </div>
            <div className="step">
              <h3>You offer</h3>
              <p>
                Pick one person or everyone at once, then send. They receive the
                name and the size. The bytes have not moved yet and are still
                sitting on your machine.
              </p>
            </div>
            <div className="step">
              <h3>They approve</h3>
              <p>
                Only after they accept does anything transfer, streaming through
                the relay and decrypting in their browser as it writes to disk.
                Decline, and nothing was ever sent.
              </p>
            </div>
          </div>
        </section>

        <section id="travels" className="wrap">
          <div className="section-head">
            <p className="eyebrow">What travels</p>
            <h2>Messages, files, folders.</h2>
          </div>
          <div className="carries">
            <div className="carry">
              <MessageSquare size={20} strokeWidth={1.8} aria-hidden="true" />
              <h3>Messages</h3>
              <p>
                Type and send, to one person or the whole room. Text rides
                inside the same sealed envelope the terminal client uses, so a
                note and a 40 GB archive are protected the same way.
              </p>
            </div>
            <div className="carry">
              <FileText size={20} strokeWidth={1.8} aria-hidden="true" />
              <h3>Files</h3>
              <p>
                Any size. Sealed in 64 KiB chunks, each authenticated on its
                own, so interference is caught partway through rather than after
                you have the whole file.
              </p>
            </div>
            <div className="carry">
              <Boxes size={20} strokeWidth={1.8} aria-hidden="true" />
              <h3>Folders</h3>
              <p>
                Packed into one archive as it sends, so a folder is a single
                approval rather than one per file, and the structure inside
                survives the trip.
              </p>
            </div>
            <div className="carry">
              <Globe size={20} strokeWidth={1.8} aria-hidden="true" />
              <h3>Across networks</h3>
              <p>
                Not on the same Wi&#8209;Fi? Open a room and send the link.
                Everything else works exactly the same.
              </p>
            </div>
          </div>
        </section>

        <section id="encryption" className="wrap">
          <div className="section-head">
            <p className="eyebrow">Encryption</p>
            <h2>What actually happens to your file.</h2>
            <p className="lede">
              Four steps, in order, every time. None of them involve the relay
              holding a key.
            </p>
          </div>
          <ol className="chain">
            <li>
              <KeyRound size={18} strokeWidth={1.8} aria-hidden="true" />
              <div>
                <h3>Your tab makes a keypair</h3>
                <p>
                  X25519, generated when the page loads and destroyed when the
                  tab closes. It is never sent anywhere. Because it is thrown
                  away, a key recovered later cannot open a transfer that
                  already happened.
                </p>
              </div>
            </li>
            <li>
              <ShieldCheck size={18} strokeWidth={1.8} aria-hidden="true" />
              <div>
                <h3>You and the other side agree a secret</h3>
                <p>
                  Each of you combines your own private key with the other's
                  public key and arrives at the same value without it ever
                  crossing the network. HKDF then splits it into separate keys
                  per purpose, so the key protecting a file is not the key
                  protecting a message.
                </p>
              </div>
            </li>
            <li>
              <PackageOpen size={18} strokeWidth={1.8} aria-hidden="true" />
              <div>
                <h3>The file is sealed in pieces</h3>
                <p>
                  AES&#8209;256&#8209;GCM over 64 KiB chunks, each carrying its
                  own authentication tag. Tampering with any chunk is caught as
                  that chunk arrives, so a corrupted transfer stops partway
                  instead of completing and handing you a bad file.
                </p>
              </div>
            </li>
            <li>
              <Terminal size={18} strokeWidth={1.8} aria-hidden="true" />
              <div>
                <h3>The relay moves bytes it cannot read</h3>
                <p>
                  It sees a destination and a byte count. Not a name, not a
                  filename, not content. It writes nothing to disk, so there is
                  no copy to leak later.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section id="cli" className="wrap">
          <div className="section-head">
            <p className="eyebrow">Terminal</p>
            <h2>bonjou&#8209;cli, the original.</h2>
            <p className="lede">
              A Go program for chat and file transfer over the local network,
              with no server at all. It finds peers by UDP broadcast, moves
              payloads over TCP, and never touches the internet. This page
              speaks the same wire protocol.
            </p>
          </div>
          <div className="install">
            {INSTALL.map((entry) => (
              <div className="cmd" key={entry.os}>
                <span>{entry.os}</span>
                <code>{entry.cmd}</code>
              </div>
            ))}
          </div>
          <p className="install-note">
            Debian packages for amd64 and arm64, Scoop, and raw binaries for
            every platform are on the{" "}
            <a href={`${REPO}/releases/latest`}>releases page</a>.
          </p>
        </section>

        <section id="security" className="wrap">
          <div className="section-head">
            <p className="eyebrow">Security</p>
            <h2>What is protected, and what is not.</h2>
            <p className="lede">
              Claims below match what the code does. The limits are listed with
              the same weight as the guarantees.
            </p>
          </div>
          <dl className="facts">
            <div className="fact">
              <dt>Encrypted end to end</dt>
              <dd>
                X25519 key agreement, then AES&#8209;256&#8209;GCM with keys
                derived per purpose through HKDF. Every chunk carries its own
                authentication tag.
              </dd>
            </div>
            <div className="fact">
              <dt>The relay cannot read it</dt>
              <dd>
                It routes on a destination and forwards bytes it has no key
                for. It holds no key material and imports none of the crypto
                code. Nothing is written to disk at any point.
              </dd>
            </div>
            <div className="fact">
              <dt>Nothing lands without consent</dt>
              <dd>
                Offers carry a name and a size. A payload is only requested
                after the person receiving it approves, which is the same rule
                the terminal client enforces with its approval queue.
              </dd>
            </div>
            <div className="fact">
              <dt>Forward secrecy in the browser</dt>
              <dd>
                Each tab generates a keypair that is thrown away when it
                closes, so a key recovered later cannot open a transfer that
                already happened.
              </dd>
            </div>
            <div className="fact is-limit">
              <dt>The relay sees metadata</dt>
              <dd>
                It knows which peer sent to which, when, and how many bytes. It
                does not see names, filenames, or content.
              </dd>
            </div>
            <div className="fact is-limit">
              <dt>First contact is trust on first use</dt>
              <dd>
                Public keys arrive through the relay, so a hostile relay could
                substitute its own. Hover a name to see its
                eight&#8209;byte fingerprint, and read it aloud to each other
                to rule that out.
              </dd>
            </div>
            <div className="fact is-limit">
              <dt>Same address is only a hint</dt>
              <dd>
                Automatic grouping uses the public address your network
                presents. Usually that means one Wi&#8209;Fi network. Behind
                carrier&#8209;grade NAT it can mean an entire region, so
                grouping stops past a small number of devices and you are asked
                to use a room instead.
              </dd>
            </div>
          </dl>
        </section>

        <section id="faq" className="wrap">
          <div className="section-head">
            <p className="eyebrow">Questions</p>
            <h2>The things people ask.</h2>
          </div>
          <div className="faq">
            <details>
              <summary>Why do both of us have to be online?</summary>
              <p>
                Because nothing is stored. Your file streams from your machine
                to theirs while both pages are open; there is no copy sitting on
                a server waiting to be collected. That is the trade for the
                relay having nothing to lose, leak, or be asked to hand over.
              </p>
            </details>
            <details>
              <summary>How large a file can I send?</summary>
              <p>
                There is no practical ceiling. Files stream in pieces and are
                never held whole in memory, on either side or on the relay. A
                transfer is bounded by patience and bandwidth rather than size.
              </p>
            </details>
            <details>
              <summary>Nobody appears on my network. Why?</summary>
              <p>
                Grouping uses the public address your network presents, so both
                devices must be behind the same router. A phone on mobile data
                will not match a laptop on Wi&#8209;Fi even sitting side by
                side. On a large campus or carrier network, too many devices
                share one address to group safely, and the page will say so and
                suggest a room instead.
              </p>
            </details>
            <details>
              <summary>Do you keep anything?</summary>
              <p>
                No accounts, no history, no files. The relay holds a list of who
                is connected, in memory, and forgets it when they leave or when
                it restarts. Your name is stored in your own browser and nowhere
                else.
              </p>
            </details>
            <details>
              <summary>How is this different from the terminal version?</summary>
              <p>
                bonjou&#8209;cli finds peers over UDP broadcast on your actual
                LAN and never touches the internet, but only works on one
                subnet. bonjou&#8209;web works anywhere and needs the relay to
                introduce you. Both speak the same wire protocol.
              </p>
            </details>
            <details>
              <summary>Is it really open source?</summary>
              <p>
                MIT licensed, relay included. The parts worth reading are the
                key schedule in <code>internal/network</code> and the relay in{" "}
                <code>internal/relay</code>, which imports none of it because it
                has nothing to decrypt.
              </p>
            </details>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap footer-grid">
          <div className="footer-brand">
            <span className="wordmark">
              <Logo size={20} />
              <span>bonjou</span>
              <span className="wordmark-tag">web</span>
            </span>
            <p>
              Encrypted transfer for people in the same room. No accounts,
              nothing stored.
            </p>
            <RepoStats />
          </div>

          <div className="footer-col">
            <h3>Get it</h3>
            <a href={`${REPO}/releases/latest`}>Releases</a>
            <a href="#cli">Install commands</a>
            <a href={`${REPO}/blob/main/docs/install-guide.md`}>Install guide</a>
          </div>

          <div className="footer-col">
            <h3>Learn</h3>
            <a href="#how">How it works</a>
            <a href="#encryption">Encryption</a>
            <a href={`${REPO}/blob/main/docs/security-model.md`}>Security model</a>
            <a href={`${REPO}/blob/main/HELP.md`}>Command reference</a>
          </div>

          <div className="footer-col">
            <h3>Project</h3>
            <a href={REPO}>Source</a>
            <a href={`${REPO}/issues`}>Report an issue</a>
            <a href={`${REPO}/blob/main/README.md`}>Readme</a>
            <a href={`${REPO}/blob/main/LICENSE`}>MIT licence</a>
          </div>
        </div>

        <div className="wrap footer-bottom">
          <span>MIT licensed. Built in the open.</span>
          <span className="footer-icons">
            <a href={REPO} aria-label="GitHub">
              <Github size={17} strokeWidth={2} aria-hidden="true" />
            </a>
            <a href={`${REPO}/issues`} aria-label="Report an issue">
              <MessageSquare size={17} strokeWidth={2} aria-hidden="true" />
            </a>
          </span>
        </div>
      </footer>
    </>
  );
}
