import {
  Check,
  Clipboard,
  Download,
  ExternalLink,
  Github,
  Menu,
  ShieldCheck,
  Terminal,
  X,
} from "lucide-react";
import { useState, type HTMLAttributes, type ReactNode } from "react";

const REPO_URL = "https://github.com/hamzaabdulwahab/bonjou-cli";
const RELEASE_URL = `${REPO_URL}/releases/latest`;

const INSTALL_SH =
  "curl -fsSL https://raw.githubusercontent.com/hamzaabdulwahab/bonjou-cli/main/scripts/install.sh | bash";
const INSTALL_PS1 =
  "iwr https://raw.githubusercontent.com/hamzaabdulwahab/bonjou-cli/main/scripts/install.ps1 -useb | iex";

type InstallKey = "macOS / Linux" | "Windows" | "Package managers";

type InstallMethod = {
  label: string;
  command: string;
  detail: string;
};

type ButtonVariant = "default" | "outline" | "ghost";

const navItems = [
  { label: "Features", href: "#features" },
  { label: "Security", href: "#security" },
  { label: "Install", href: "#install" },
  { label: "FAQ", href: "#faq" },
];

const badges = ["MIT licensed", "v1.2.0", "macOS", "Linux", "Windows"];

const signalStats = [
  {
    label: "Discovery port",
    value: "UDP 46320",
    note: "Peer announcements on the same subnet.",
  },
  {
    label: "Transfer port",
    value: "TCP 46321",
    note: "Direct message, file, and folder transfer traffic.",
  },
  {
    label: "Default cap",
    value: "16 GiB",
    note: "Default max_incoming_bytes for incoming transfers.",
  },
  {
    label: "Runtime",
    value: "Go 1.24.0+",
    note: "Required Go version for local development.",
  },
];

const audienceItems = [
  "Developers and technical teams working on the same Wi-Fi or LAN.",
  "Students, instructors, lab users, and workshop participants sharing files locally.",
  "Power users who prefer terminal workflows and want a small tool they can inspect.",
];

const featureModules = [
  {
    title: "LAN discovery",
    body: "Bonjou auto-discovers users on your subnet via UDP broadcast.",
    foot: "UDP 46320",
  },
  {
    title: "Terminal chat",
    body: "Send direct messages, multi-recipient messages, or a broadcast from @ commands.",
    foot: "@send / @multi / @broadcast",
  },
  {
    title: "File and folder transfer",
    body: "Send a single file or an entire directory to one peer.",
    foot: "@file / @folder",
  },
  {
    title: "Metadata-first approval",
    body: "Incoming files and folders enter one pending approval queue before the receiver writes them.",
    foot: "@queue / @view / @approve / @reject",
  },
  {
    title: "Guided wizard",
    body: "The interactive @wizard covers message, file, folder, multi-send, and broadcast flows.",
    foot: "@wizard",
  },
  {
    title: "Trust controls",
    body: "Operators can inspect, replace, or remove pinned peer keys.",
    foot: "@known / @fingerprint / @trust / @forget",
  },
];

const workflow = [
  {
    title: "Run Bonjou",
    body: "Start the CLI on machines connected to the same Wi-Fi or LAN.",
    command: "bonjou",
  },
  {
    title: "Discover peers",
    body: "List discovered users with last-seen timestamps.",
    command: "@users",
  },
  {
    title: "Send message or payload",
    body: "Use a username or IP address for chat, file, folder, multi-send, or broadcast flows.",
    command: "@file alex ~/report.pdf",
  },
  {
    title: "Approve incoming items",
    body: "Inspect pending metadata before accepting a file or folder.",
    command: "@view <id>\n@approve <id>",
  },
];

const protectedItems = [
  "AES-256-GCM authenticated encryption for every envelope and every file/folder byte.",
  "Per-chunk stream authentication, so corruption is detected mid-transfer.",
  "Trust-on-first-use peer identity pinning for first-seen X25519 public keys.",
  "Replay rejection with a per-peer nonce cache and timestamp freshness window.",
  "Path safety checks confine writes to the configured receive root.",
];

const limitationItems = [
  "Forward secrecy is not available yet.",
  "config.json is stored on disk in plaintext at mode 0600.",
  "Chat content is logged in plaintext to ~/.bonjou/logs/chat.log.",
  "Discovery is same-subnet only and usually does not cross routers or VLANs.",
];

const docsRows = [
  {
    path: "README.md",
    title: "Quick start, usage, package routes, and security overview",
    type: "guide",
  },
  {
    path: "HELP.md",
    title: "Complete @ command guide for terminal users",
    type: "manual",
  },
  {
    path: "docs/security-model.md",
    title: "Protocol v2 protections, threat model, and known limits",
    type: "security",
  },
  {
    path: "docs/install-guide.md",
    title: "macOS, Linux, Windows, Homebrew, WinGet, Scoop, AUR, Debian",
    type: "install",
  },
];

const installMethods: Record<InstallKey, InstallMethod[]> = {
  "macOS / Linux": [
    {
      label: "One-line installer",
      command: INSTALL_SH,
      detail:
        "Uses package-manager routes when available, then falls back to a direct binary install.",
    },
    {
      label: "Run",
      command: "bonjou",
      detail: "Starts the Bonjou prompt.",
    },
  ],
  Windows: [
    {
      label: "PowerShell installer",
      command: INSTALL_PS1,
      detail:
        "Uses WinGet when available, then Scoop, then direct release download.",
    },
    {
      label: "Run",
      command: "bonjou",
      detail: "Run from PowerShell or Command Prompt.",
    },
  ],
  "Package managers": [
    {
      label: "Homebrew",
      command: "brew install hamzaabdulwahab/bonjou/bonjou",
      detail: "macOS package route.",
    },
    {
      label: "WinGet",
      command: "winget install --id HamzaAbdulWahab.Bonjou --exact",
      detail: "Windows package route when the community index is available.",
    },
    {
      label: "Scoop",
      command:
        "scoop install https://raw.githubusercontent.com/hamzaabdulwahab/scoop-bonjou/main/bonjou.json",
      detail: "Portable Windows package route.",
    },
    {
      label: "Debian or Ubuntu",
      command:
        "wget https://github.com/hamzaabdulwahab/bonjou-cli/releases/download/v1.2.0/bonjou_1.2.0_amd64.deb\nsudo dpkg -i bonjou_1.2.0_amd64.deb",
      detail: "Use the arm64 package on ARM Linux machines.",
    },
  ],
};

const faqs = [
  {
    q: "Does Bonjou need internet?",
    a: "No. Bonjou is built for devices on the same local network. It does not use a cloud relay for messages or transfer payloads.",
  },
  {
    q: "Can I send folders?",
    a: "Yes. Use @folder to offer a directory. The receiver can inspect the sender-provided manifest before approving the whole folder.",
  },
  {
    q: "Where do approved files go?",
    a: "By default, approved files land under ~/.bonjou/received/files/ and folders under ~/.bonjou/received/folders/.",
  },
  {
    q: "What ports should my firewall allow?",
    a: "Bonjou uses UDP 46320 for peer discovery and TCP 46321 for transfer traffic.",
  },
  {
    q: "Will discovery cross routers or VLANs?",
    a: "Bonjou discovery is same-subnet only. UDP broadcast generally does not cross routers or VLANs.",
  },
  {
    q: "What does Bonjou cost?",
    a: "Bonjou is distributed under the MIT License. There is no hosted plan, seat price, or usage meter.",
  },
];

export default function App() {
  return (
    <div className="site-shell">
      <Header />
      <main>
        <Hero />
        <SignalStrip />
        <AudienceSection />
        <FeaturesSection />
        <WorkflowSection />
        <SecuritySection />
        <DocsSection />
        <InstallSection />
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <a
        className="brand"
        href="#top"
        aria-label="Bonjou home"
        onClick={() => setOpen(false)}
      >
        <strong>BONJOU_CLI</strong>
      </a>
      <nav className="desktop-nav" aria-label="Primary navigation">
        {navItems.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
      <div className="header-actions">
        <ButtonLink variant="ghost" href={REPO_URL} external>
          <Github data-icon="inline-start" aria-hidden="true" />
          Repo
        </ButtonLink>
        <button
          className="mobile-menu-button"
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
      {open ? (
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
          >
            GitHub
          </a>
        </nav>
      ) : null}
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow">serverless LAN chat and file transfer</p>
        <h1>Move messages, files, and folders from your terminal.</h1>
        <p className="hero-body">
          No servers to configure. No internet connection required. No accounts
          to create. Just open your terminal and start typing.
        </p>
        <div
          className="badge-row"
          aria-label="Bonjou platform and license facts"
        >
          {badges.map((badge) => (
            <Badge key={badge}>{badge}</Badge>
          ))}
        </div>
        <div className="hero-actions" aria-label="Primary actions">
          <ButtonLink variant="default" href="#install">
            <Download data-icon="inline-start" aria-hidden="true" />
            Install free
          </ButtonLink>
          <ButtonLink variant="outline" href={REPO_URL} external>
            <Github data-icon="inline-start" aria-hidden="true" />
            View source
          </ButtonLink>
        </div>
      </div>
      <DemoPanel />
    </section>
  );
}

function DemoPanel() {
  return (
    <Card className="demo-card" aria-label="Animated Bonjou terminal demo">
      <CardHeader>
        <div>
          <CardTitle>Local terminal flow</CardTitle>
          <CardDescription>
            Generated from documented Bonjou commands and runtime facts.
          </CardDescription>
        </div>
        <Badge>GIF</Badge>
      </CardHeader>
      <CardContent>
        <div className="demo-media">
          <img
            src="/bonjou-demo.gif"
            alt="Animated Bonjou terminal demo showing documented commands for discovery, messaging, transfer, and approval."
            width="960"
            height="720"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SignalStrip() {
  return (
    <section className="signal-strip" aria-label="Bonjou runtime facts">
      {signalStats.map((item) => (
        <article key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <p>{item.note}</p>
        </article>
      ))}
    </section>
  );
}

function AudienceSection() {
  return (
    <section className="section audience-section">
      <SectionHeading
        command="cat PRODUCT.md"
        title="Built for local technical rooms"
        body="Bonjou is meant for people in the same room, lab, classroom, office, hackathon, or workshop."
      />
      <div className="audience-grid">
        {audienceItems.map((item) => (
          <Card key={item}>
            <CardContent>
              <p>{item}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="section" id="features">
      <SectionHeading
        command="cat README.md HELP.md"
        title="Real features from the CLI"
        body="The feature list mirrors the repository docs and the implemented @ command catalog."
      />
      <div className="module-grid">
        {featureModules.map((feature) => (
          <Card className="module-card" key={feature.title}>
            <CardHeader>
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.body}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Badge>{feature.foot}</Badge>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section className="section split-section" id="workflow">
      <div>
        <p className="eyebrow">usage flow</p>
        <h2>Discover, send, inspect, approve.</h2>
        <div className="workflow-list">
          {workflow.map((step, index) => (
            <article key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <code>{step.command}</code>
              </div>
            </article>
          ))}
        </div>
      </div>
      <Alert title="Metadata-first approval">
        Incoming files and folders are first placed in a single pending approval
        queue as metadata-only transfer offers. No file or folder bytes are
        downloaded into final receive folders until approved.
      </Alert>
    </section>
  );
}

function SecuritySection() {
  return (
    <section className="section security-section" id="security">
      <SectionHeading
        command="cat docs/security-model.md"
        title="Security claims with stated limits"
        body="The page only repeats protections and limitations documented in the repository security model."
      />
      <div className="security-grid">
        <Card>
          <CardHeader>
            <CardTitle>What is protected</CardTitle>
            <CardDescription>
              Protocol v2 protections listed in docs/security-model.md.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Checklist items={protectedItems} />
          </CardContent>
        </Card>
        <Alert title="What is not protected yet" tone="warning">
          <Checklist items={limitationItems} />
        </Alert>
      </div>
    </section>
  );
}

function DocsSection() {
  return (
    <section className="section docs-section">
      <SectionHeading
        command="ls ./docs"
        title="Read the shipped materials"
        body="Install paths, commands, release notes, and the threat model are part of the repository."
      />
      <div
        className="docs-table"
        role="table"
        aria-label="Bonjou documentation files"
      >
        <div role="row" className="docs-row docs-head">
          <span role="columnheader">type</span>
          <span role="columnheader">path</span>
          <span role="columnheader">title</span>
        </div>
        {docsRows.map((row) => (
          <div role="row" className="docs-row" key={row.path}>
            <span role="cell">{row.type}</span>
            <code role="cell">{row.path}</code>
            <p role="cell">{row.title}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function InstallSection() {
  const [active, setActive] = useState<InstallKey>("macOS / Linux");
  const methods = installMethods[active];

  return (
    <section className="section install-section" id="install">
      <SectionHeading
        command="cat docs/install-guide.md"
        title="Install, then run bonjou"
        body="Use the one-command installer, a package manager, or the GitHub release artifacts."
      />
      <div className="tabs" data-orientation="horizontal">
        <div className="tabs-list" role="tablist" aria-label="Install target">
          {(Object.keys(installMethods) as InstallKey[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active === key}
              className="tabs-trigger"
              data-state={active === key ? "active" : "inactive"}
              onClick={() => setActive(key)}
            >
              {key}
            </button>
          ))}
        </div>
        <div className="tabs-content" role="tabpanel">
          {methods.map((method) => (
            <CommandBlock
              key={method.label}
              label={method.label}
              command={method.command}
              detail={method.detail}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section className="section pricing-section">
      <Card className="pricing-card">
        <CardHeader>
          <Badge>Pricing</Badge>
          <CardTitle>Free and MIT licensed.</CardTitle>
          <CardDescription>
            Bonjou does not have a hosted workspace, seat price, transfer meter,
            or account gate.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <ButtonLink variant="default" href="#install">
            <Download data-icon="inline-start" aria-hidden="true" />
            Install free
          </ButtonLink>
          <ButtonLink variant="outline" href={REPO_URL} external>
            <Github data-icon="inline-start" aria-hidden="true" />
            MIT source
          </ButtonLink>
        </CardFooter>
      </Card>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="section faq-section" id="faq">
      <div className="faq-shell">
        <div>
          <p className="eyebrow">faq</p>
          <h2>Frequently asked questions</h2>
          <p>
            Answers are taken from README.md, HELP.md, docs/install-guide.md,
            and docs/security-model.md.
          </p>
        </div>
        <div className="faq-list">
          {faqs.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="final-cta">
      <p className="eyebrow">ready</p>
      <h2>Start a local Bonjou session.</h2>
      <p>
        Install the CLI on machines connected to the same LAN, then run bonjou.
      </p>
      <div className="hero-actions" aria-label="Final actions">
        <ButtonLink variant="default" href="#install">
          <Terminal data-icon="inline-start" aria-hidden="true" />
          Install free
        </ButtonLink>
        <ButtonLink variant="outline" href={RELEASE_URL} external>
          <ExternalLink data-icon="inline-start" aria-hidden="true" />
          Latest release
        </ButtonLink>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <a className="brand" href="#top" aria-label="Bonjou home">
          <strong>BONJOU_CLI</strong>
        </a>
        <p>
          Serverless, internet-free LAN chat and file transfer from the
          terminal.
        </p>
      </div>
      <nav aria-label="Footer navigation">
        <a href="#features">Features</a>
        <a href="#security">Security</a>
        <a href="#install">Install</a>
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </nav>
    </footer>
  );
}

function SectionHeading({
  command,
  title,
  body,
}: {
  command: string;
  title: string;
  body: string;
}) {
  return (
    <div className="section-heading">
      <p>{command}</p>
      <h2>{title}</h2>
      <span>{body}</span>
    </div>
  );
}

function ButtonLink({
  children,
  external,
  href,
  variant,
}: {
  children: ReactNode;
  external?: boolean;
  href: string;
  variant: ButtonVariant;
}) {
  return (
    <a
      className="btn"
      data-variant={variant}
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
    >
      {children}
    </a>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}

function Card({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <article className={`card ${className}`.trim()} {...props}>
      {children}
    </article>
  );
}

function CardHeader({ children }: { children: ReactNode }) {
  return <div className="card-header">{children}</div>;
}

function CardTitle({ children }: { children: ReactNode }) {
  return <h3 className="card-title">{children}</h3>;
}

function CardDescription({ children }: { children: ReactNode }) {
  return <p className="card-description">{children}</p>;
}

function CardContent({ children }: { children: ReactNode }) {
  return <div className="card-content">{children}</div>;
}

function CardFooter({ children }: { children: ReactNode }) {
  return <div className="card-footer">{children}</div>;
}

function Alert({
  children,
  title,
  tone = "default",
}: {
  children: ReactNode;
  title: string;
  tone?: "default" | "warning";
}) {
  return (
    <aside className="alert" data-tone={tone}>
      <ShieldCheck aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        <div>{children}</div>
      </div>
    </aside>
  );
}

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="checklist">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function CommandBlock({ command, detail, label }: InstallMethod) {
  return (
    <article className="command-block">
      <div className="command-block-meta">
        <h3>{label}</h3>
        <p>{detail}</p>
      </div>
      <pre>
        <code>{command}</code>
      </pre>
      <CopyButton value={command} />
    </article>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    let ok = false;

    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.select();

      try {
        ok = document.execCommand("copy");
      } finally {
        document.body.removeChild(textarea);
      }
    }

    setCopied(ok);
    if (ok) {
      window.setTimeout(() => setCopied(false), 1300);
    }
  }

  return (
    <button
      className="copy-button"
      type="button"
      onClick={handleCopy}
      aria-label="Copy command"
    >
      {copied ? (
        <Check data-icon="inline-start" aria-hidden="true" />
      ) : (
        <Clipboard data-icon="inline-start" aria-hidden="true" />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
