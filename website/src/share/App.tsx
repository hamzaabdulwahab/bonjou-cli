import { useCallback, useState } from "react";

import { Instrument } from "./Instrument";
import { useSession } from "./useSession";

const REPO = "https://github.com/hamzaabdulwahab/bonjou-cli";
const RAW = "https://raw.githubusercontent.com/hamzaabdulwahab/bonjou-cli/main";

// Verbatim from README.md. An install command is executed as written, so
// these must never be paraphrased or shortened to a nicer-looking domain.
const INSTALL = [
  {
    os: "macOS, Linux",
    cmd: `curl -fsSL ${RAW}/scripts/install.sh | bash`,
  },
  { os: "Homebrew", cmd: "brew install hamzaabdulwahab/bonjou/bonjou" },
  { os: "Windows", cmd: "winget install HamzaAbdulWahab.Bonjou" },
];

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
            bonjou
          </a>
          <nav>
            <a href="#how">How it works</a>
            <a href="#cli">Terminal</a>
            <a href="#security">Security</a>
            <a href={REPO}>Source</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <p className="eyebrow">Local network transfer, in the browser</p>
            <h1>
              Everyone on your Wi&#8209;Fi is <em>already here</em>.
            </h1>
            <p className="lede">
              Send a message, a file, or a whole folder straight to the laptop
              across the table. Encrypted in your browser before it leaves,
              relayed without ever being stored, and never written to anyone's
              disk until they say yes.
            </p>
            <p className="hero-meta">
              <span>No accounts</span>
              <span>Nothing stored</span>
              <span>Any file size</span>
              <span>Open source</span>
            </p>
          </div>

          <Instrument
            name={name}
            onName={commitName}
            status={session.status}
            code={session.code}
            peers={session.peers}
            fingerprints={session.fingerprints}
            outgoing={session.outgoing}
            incoming={session.incoming}
            chat={session.chat}
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

        <section className="wrap">
          <div className="section-head">
            <p className="eyebrow">What travels</p>
            <h2>Messages, files, folders.</h2>
          </div>
          <div className="carries">
            <div className="carry">
              <h3>Messages</h3>
              <p>
                Type and send, to one person or to the whole room. Text rides
                inside the same sealed envelope the terminal client uses, so a
                note and a 40 GB archive are protected the same way.
              </p>
            </div>
            <div className="carry">
              <h3>Files</h3>
              <p>
                Any size. Sealed in 64 KiB chunks, each authenticated on its
                own, so interference is caught partway through rather than after
                you have the whole file.
              </p>
            </div>
            <div className="carry">
              <h3>Folders</h3>
              <p>
                Choose a folder and everything inside goes, each file keeping
                its path so the structure survives the trip.
              </p>
            </div>
            <div className="carry">
              <h3>Across networks</h3>
              <p>
                Not on the same Wi&#8209;Fi? Open a room and send the link.
                Everything else works exactly the same.
              </p>
            </div>
          </div>
        </section>

        <section id="cli" className="wrap">
          <div className="section-head">
            <p className="eyebrow">Terminal</p>
            <h2>It started as a CLI.</h2>
            <p className="lede">
              Bonjou is a Go program for chat and file transfer over the local
              network, with no server at all. It finds peers by UDP broadcast,
              moves payloads over TCP, and never touches the internet. The
              browser version speaks the same wire protocol.
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
                substitute its own. Compare the eight&#8209;byte fingerprint
                shown beside each name out loud to rule that out.
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
      </main>

      <footer>
        <div className="wrap footer-inner">
          <span>Bonjou. MIT licensed.</span>
          <span>
            <a href={REPO}>Source</a> · <a href={`${REPO}/releases/latest`}>Releases</a> ·{" "}
            <a href={`${REPO}/blob/main/docs/security-model.md`}>Security model</a>
          </span>
        </div>
      </footer>
    </>
  );
}
