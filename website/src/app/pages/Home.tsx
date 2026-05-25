import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Button,
  CopyCommand,
  Divider,
  Eyebrow,
  FadeIn,
  InlineCommand,
  Section,
  cn,
} from "../components/ui";
import { FloatingNav } from "../components/FloatingNav";
import { RepoStats } from "../components/RepoStats";
import { SecurityFlow } from "../components/SecurityFlow";
import { SubnetCanvas } from "../components/SubnetCanvas";
import { TypingTerminal, type Line } from "../components/TypingTerminal";

const REPO_URL = "https://github.com/hamzaabdulwahab/bonjou-cli";
const RELEASE_V120_URL = `${REPO_URL}/releases/tag/v1.2.0`;
const RAW_INSTALL_SH =
  "curl -fsSL https://raw.githubusercontent.com/hamzaabdulwahab/bonjou-cli/main/scripts/install.sh | bash";
const RAW_INSTALL_PS1 =
  "iwr https://raw.githubusercontent.com/hamzaabdulwahab/bonjou-cli/main/scripts/install.ps1 -useb | iex";

const heroScript: Line[] = [
  { kind: "prompt", prompt: "alex@studio", text: "bonjou" },
  { kind: "dim", text: "bonjou 1.2.0 · listening on 192.168.1.14" },
  { kind: "dim", text: "3 peers discovered on local subnet" },
  { kind: "spacer" },
  { kind: "prompt", prompt: "alex@studio", text: "@users" },
  { kind: "ghost", text: "sarah      192.168.1.22   active" },
  { kind: "ghost", text: "dev-box    192.168.1.5    idle" },
  { kind: "ghost", text: "jordan     192.168.1.31   active" },
  { kind: "spacer" },
  { kind: "prompt", prompt: "alex@studio", text: "@file sarah ./report.pdf" },
  { kind: "dim", text: "offer sent · awaiting approval" },
  { kind: "success", text: "accepted by sarah" },
  { kind: "progress" },
  { kind: "out", text: "delivered · 2.4 MB in 0.18s" },
];

export function Home() {
  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--text)] antialiased" id="top">
      <AmbientLayer />
      <FloatingNav />

      <main className="relative z-10 overflow-x-clip">
        <Hero />
        <SpecStrip />
        <Install />
        <Walkthrough />
        <Features />
        <Comparison />
        <Commands />
        <Security />
        <OpenSource />
        <FAQ />
        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
}

function AmbientLayer() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-80" style={{ contain: "strict" }}>
      <SubnetCanvas opacity={0.14} nodeCount={26} handshakeIntervalSec={3.4} />
    </div>
  );
}

function Hero() {
  return (
    <Section className="relative isolate overflow-hidden pb-20 pt-28 sm:pt-32 md:pb-28 lg:pt-36">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[38rem] rounded-full opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 62%)",
        }}
      />

      <div className="grid min-w-0 items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)] lg:gap-14">
        <FadeIn className="min-w-0">
          <div className="mb-7 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
            <span>Bonjou v1.2.0</span>
            <span className="h-px w-8 bg-[var(--border-strong)]" aria-hidden />
            <span>macOS · Linux · Windows</span>
          </div>

          <h1 className="max-w-[11ch] text-[clamp(3rem,7vw,5.7rem)] font-bold leading-[0.94] tracking-[-0.055em] text-[var(--text)]">
            Local transfer from the terminal.
          </h1>

          <p className="mt-7 max-w-[62ch] text-[17px] leading-[1.65] text-[var(--text-muted)] sm:text-[18px]">
            Bonjou finds peers on your LAN, opens a direct encrypted channel, and moves
            messages, files, and folders without accounts, cloud drives, or a central relay.
          </p>

          <div className="mt-9 max-w-[680px]">
            <CopyCommand command={RAW_INSTALL_SH} />
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-[var(--text-dim)]">
              <a
                href="#install"
                className="font-semibold text-[var(--text-muted)] underline-offset-4 transition-colors hover:text-[var(--text)] hover:underline"
              >
                Choose another installer
              </a>
              <span aria-hidden>·</span>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--text-muted)] underline-offset-4 transition-colors hover:text-[var(--text)] hover:underline"
              >
                Read the source
              </a>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={120} className="min-w-0">
          <div className="grid min-w-0 gap-4">
            <TypingTerminal title="bonjou · local network" lines={heroScript} charDelay={10} lineDelay={120} />
            <div className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
              <HeroDatum label="Discovery" value="UDP 46320" />
              <HeroDatum label="Transfer" value="TCP 46321" />
              <HeroDatum label="Trust" value="TOFU pinning" />
            </div>
          </div>
        </FadeIn>
      </div>
    </Section>
  );
}

function HeroDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-[var(--bg-soft)] px-4 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">{label}</div>
      <div className="mt-1 break-words font-mono text-[13px] text-[var(--text)]">{value}</div>
    </div>
  );
}

function SpecStrip() {
  const specs = [
    { label: "Wire format", value: "Envelope v2" },
    { label: "Cipher", value: "AES-256-GCM" },
    { label: "Approval", value: "metadata first" },
    { label: "State", value: "~/.bonjou" },
  ];

  return (
    <Section className="py-8 sm:py-10">
      <Divider />
      <div className="grid grid-cols-2 gap-px bg-[var(--border)] md:grid-cols-4">
        {specs.map((s, i) => (
          <FadeIn key={s.label} delay={i * 45} className="min-w-0 bg-[var(--bg)] px-3 py-5 sm:px-5">
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
              {s.label}
            </span>
            <span className="mt-1 block break-words font-mono text-[13px] text-[var(--text)]">{s.value}</span>
          </FadeIn>
        ))}
      </div>
      <Divider />
    </Section>
  );
}

function Install() {
  const [os, setOs] = useState<"macOS" | "Linux" | "Windows">("macOS");

  const recipes: Record<string, { label: string; command: string }[]> = {
    macOS: [
      { label: "Install script", command: RAW_INSTALL_SH },
      { label: "Homebrew", command: "brew install hamzaabdulwahab/bonjou/bonjou" },
    ],
    Linux: [
      { label: "Install script", command: RAW_INSTALL_SH },
      { label: "Arch (AUR)", command: "yay -S bonjou" },
      { label: "Debian / Ubuntu", command: "sudo dpkg -i bonjou_1.2.0_amd64.deb" },
    ],
    Windows: [
      { label: "PowerShell", command: RAW_INSTALL_PS1 },
      { label: "WinGet", command: "winget install HamzaAbdulWahab.Bonjou" },
      {
        label: "Scoop",
        command:
          "scoop bucket add bonjou https://github.com/hamzaabdulwahab/scoop-bonjou; scoop install bonjou",
      },
    ],
  };

  const tabs = Object.keys(recipes) as Array<keyof typeof recipes>;

  return (
    <Section id="install" className="py-[var(--section-y)]">
      <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-16">
        <SectionHeading
          index="01"
          label="Install"
          title="One binary, three operating systems."
          body="The fastest path is the install script. Package managers and source installs stay visible for locked-down machines."
        >
          <a
            href={`${REPO_URL}/releases/latest`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex text-[14px] font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
          >
            All releases
          </a>
        </SectionHeading>

        <FadeIn delay={120} className="min-w-0">
          <div className="min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)]">
            <div role="tablist" className="grid grid-cols-3 border-b border-[var(--border)] bg-[var(--bg-soft)]">
              {tabs.map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={os === t}
                  onClick={() => setOs(t)}
                  className={cn(
                    "relative min-w-0 px-2 py-3 text-[13px] font-semibold transition-colors sm:px-5",
                    os === t ? "text-[var(--text)]" : "text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                  )}
                >
                  {t}
                  {os === t && (
                    <span aria-hidden className="absolute inset-x-3 bottom-0 h-[2px] bg-[var(--accent)] sm:inset-x-5" />
                  )}
                </button>
              ))}
            </div>

            <div className="min-w-0 p-4 sm:p-6 md:p-8">
              <div className="space-y-5">
                {recipes[os].map((r) => (
                  <CommandBlock key={r.label} label={r.label} command={r.command} />
                ))}
              </div>

              <Divider className="my-8" />
              <CommandBlock label="From source · any platform" command="go install github.com/hamzawahab/bonjou-cli/cmd/bonjou@latest" />
            </div>
          </div>
        </FadeIn>
      </div>
    </Section>
  );
}

function CommandBlock({ label, command }: { label: string; command: string }) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--text-dim)]">{label}</div>
      <InlineCommand command={command} label={label} />
    </div>
  );
}

function Walkthrough() {
  const alexLines: Line[] = [
    { kind: "prompt", prompt: "alex@studio", text: "bonjou" },
    { kind: "dim", text: "listening on 192.168.1.14 · 3 peers" },
    { kind: "spacer" },
    { kind: "prompt", prompt: "alex@studio", text: "@folder sarah ./assets" },
    { kind: "dim", text: "offering assets/ · 12 items · 45.2 MB" },
    { kind: "success", text: "accepted · transferring" },
    { kind: "progress" },
    { kind: "out", text: "delivered" },
  ];

  const sarahLines: Line[] = [
    { kind: "prompt", prompt: "sarah@thinkpad", text: "bonjou" },
    { kind: "dim", text: "listening on 192.168.1.22 · 3 peers" },
    { kind: "spacer" },
    { kind: "out", text: "incoming · folder from alex" },
    { kind: "dim", text: "assets/ · 12 items · 45.2 MB · fingerprint a4:7c…" },
    { kind: "prompt", prompt: "sarah@thinkpad", text: "@view 1" },
    { kind: "dim", text: "manifest · 12 files · img / fonts / brand.json" },
    { kind: "prompt", prompt: "sarah@thinkpad", text: "@approve 1" },
    { kind: "success", text: "done · 12 files" },
  ];

  return (
    <Section className="py-[var(--section-y)]">
      <SectionHeading
        index="02"
        label="Walkthrough"
        title="Nothing lands on disk until the receiver approves it."
        body="Bonjou keeps the workflow terminal-native, but the transfer model is intentionally conservative: offer metadata first, inspect, then approve."
      />

      <FadeIn delay={120} className="mt-10 min-w-0">
        <div className="relative min-w-0 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-soft)] p-4 sm:p-6 lg:p-8">
          <div
            aria-hidden
            className="absolute left-0 right-0 top-1/2 hidden h-px -translate-y-1/2 lg:block"
            style={{
              background:
                "linear-gradient(90deg, transparent 6%, color-mix(in oklab, var(--signal) 50%, transparent), color-mix(in oklab, var(--accent) 42%, transparent), transparent 94%)",
            }}
          />
          <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:gap-8">
            <TypingTerminal title="alex@studio" lines={alexLines} charDelay={30} loopHoldMs={8000} />
            <TypingTerminal title="sarah@thinkpad" lines={sarahLines} charDelay={27} loopHoldMs={8000} />
          </div>
        </div>
      </FadeIn>
    </Section>
  );
}

function Features() {
  const rows = [
    {
      tag: "discovery",
      title: "Peer discovery on the local subnet",
      body: "UDP broadcast on 46320 turns up every Bonjou on the same Wi-Fi or LAN. Names, IPs, fingerprints, last seen.",
    },
    {
      tag: "messaging",
      title: "Direct, multi-recipient, and broadcast",
      body: "@send to one peer, @multi to a list, @broadcast to everyone discovered. Messages stay inside your network.",
    },
    {
      tag: "transfer",
      title: "Files and folders over TCP",
      body: "TCP on 46321 carries the payload. Folders move with their structure intact, no zip step.",
    },
    {
      tag: "approval",
      title: "Metadata-first approval queue",
      body: "Every incoming transfer arrives as metadata only. @queue lists them, @view inspects, @approve writes. Persisted across restarts since v1.2.0.",
    },
    {
      tag: "encryption",
      title: "AEAD-sealed envelope v2",
      body: "Traffic is sealed with AES-256-GCM, chunked, and signed. Replay protection and TOFU fingerprint pinning are on by default.",
    },
    {
      tag: "interface",
      title: "Commands and a guided wizard",
      body: "@-commands for muscle memory, @wizard for a guided multi-step flow. Same primitives, two surfaces.",
    },
  ];

  return (
    <Section id="features" className="py-[var(--section-y)]">
      <SectionHeading index="03" label="Features" title="Built around the real LAN workflow." />

      <div className="mt-10 border-t border-[var(--border)]">
        {rows.map((r, i) => (
          <FadeIn key={r.tag} delay={i * 45}>
            <article className="group grid min-w-0 gap-3 border-b border-[var(--border)] py-6 transition-colors hover:bg-[color-mix(in_oklab,var(--surface-1)_55%,transparent)] md:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] md:gap-10 md:py-7">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">{r.tag}</div>
              <div className="min-w-0">
                <h3 className="text-[20px] font-semibold leading-[1.25] tracking-[-0.015em] text-[var(--text)]">
                  {r.title}
                </h3>
                <p className="mt-2 max-w-[68ch] text-[15px] leading-[1.65] text-[var(--text-muted)]">{r.body}</p>
              </div>
            </article>
          </FadeIn>
        ))}
      </div>
    </Section>
  );
}

function Comparison() {
  const rows = [
    {
      alt: "Cloud drives",
      tradeoff: "Round-trip through someone else's server. Account, upload, share link, download.",
      bonjou: "Direct peer to peer at LAN speed. No external hop.",
    },
    {
      alt: "AirDrop-style sharing",
      tradeoff: "Bound to a single vendor ecosystem.",
      bonjou: "macOS, Linux, and Windows talk to each other.",
    },
    {
      alt: "Slack or Discord",
      tradeoff: "Heavy attachments get throttled, re-encoded, and held by a third party.",
      bonjou: "Untouched bytes, no rate limit, fully local.",
    },
    {
      alt: "python -m http.server",
      tradeoff: "Plain HTTP, open to anyone on the network, manual IP handoff.",
      bonjou: "Authenticated peers, encrypted envelope, explicit approval.",
    },
  ];

  return (
    <Section className="py-[var(--section-y)]">
      <SectionHeading index="04" label="Why Bonjou" title="A local tool for local work." />

      <FadeIn delay={100} className="mt-10">
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)]">
          <table className="hidden w-full table-fixed border-collapse text-left md:table">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)]">
                <Th>Alternative</Th>
                <Th>Tradeoff</Th>
                <Th accent>Bonjou</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.alt} className="border-t border-[var(--border)] first:border-t-0">
                  <td className="w-[24%] px-5 py-5 align-top text-[15px] font-semibold text-[var(--text)]">{r.alt}</td>
                  <td className="px-5 py-5 align-top text-[15px] leading-[1.6] text-[var(--text-muted)]">{r.tradeoff}</td>
                  <td className="px-5 py-5 align-top text-[15px] leading-[1.6] text-[var(--text)]">{r.bonjou}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="divide-y divide-[var(--border)] md:hidden">
            {rows.map((r) => (
              <article key={r.alt} className="p-4">
                <h3 className="text-[16px] font-semibold text-[var(--text)]">{r.alt}</h3>
                <p className="mt-2 text-[14px] leading-[1.55] text-[var(--text-muted)]">{r.tradeoff}</p>
                <p className="mt-3 border-t border-[var(--border)] pt-3 text-[14px] leading-[1.55] text-[var(--text)]">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--accent)]">Bonjou</span>
                  <br />
                  {r.bonjou}
                </p>
              </article>
            ))}
          </div>
        </div>
      </FadeIn>
    </Section>
  );
}

function Th({ children, accent = false }: { children: string; accent?: boolean }) {
  return (
    <th
      className={cn(
        "px-5 py-4 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em]",
        accent ? "text-[var(--accent)]" : "text-[var(--text-dim)]"
      )}
    >
      {children}
    </th>
  );
}

function Commands() {
  const [query, setQuery] = useState("");

  const groups = [
    {
      name: "Discovery & info",
      items: [
        { cmd: "@users", desc: "List peers on the local subnet with last-seen timestamps." },
        { cmd: "@whoami", desc: "Show your username, IP, and listen port." },
        { cmd: "@status", desc: "Show app info and current receive path." },
        { cmd: "@history", desc: "Show saved chat and transfer history." },
        { cmd: "@help", desc: "Show the full command reference inside Bonjou." },
      ],
    },
    {
      name: "Messaging",
      items: [
        { cmd: "@send <peer> <msg>", desc: "Direct message a single peer." },
        { cmd: "@multi <a,b,c> <msg>", desc: "Send the same message to a comma-separated list." },
        { cmd: "@broadcast <msg>", desc: "Send to every active peer on the subnet." },
      ],
    },
    {
      name: "Transfers",
      items: [
        { cmd: "@file <peer> <path>", desc: "Offer a single file." },
        { cmd: "@folder <peer> <path>", desc: "Offer a directory, structure preserved." },
        { cmd: "@multi <a,b> <path>", desc: "Offer the same file or folder to a comma-separated list." },
      ],
    },
    {
      name: "Approval queue",
      items: [
        { cmd: "@queue", desc: "List every pending incoming file and folder offer." },
        { cmd: "@view <id>", desc: "Inspect one pending item. For folders, shows the sender's manifest." },
        { cmd: "@approve <id>", desc: "Accept an offer and write to disk." },
        { cmd: "@reject <id>", desc: "Decline an offer." },
        { cmd: "@approveAll", desc: "Approve every pending item in the queue." },
        { cmd: "@rejectAll", desc: "Reject every pending item in the queue." },
      ],
    },
    {
      name: "Session & settings",
      items: [
        { cmd: "@wizard", desc: "Open the interactive guided flow for sending." },
        { cmd: "@setname <name>", desc: "Change the username you announce on the subnet." },
        { cmd: "@setpath <dir>", desc: "Change the destination directory for received files and folders." },
        { cmd: "@clear", desc: "Clear the screen. Add 'history' to also clear saved logs." },
        { cmd: "@exit", desc: "Quit Bonjou." },
      ],
    },
  ];

  const q = query.trim().toLowerCase();
  const filtered = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => i.cmd.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <Section id="commands" className="py-[var(--section-y)]">
      <FadeIn className="flex min-w-0 flex-col justify-between gap-6 md:flex-row md:items-end">
        <SectionHeading index="05" label="Reference" title="The command surface stays small enough to remember." compact />

        <label className="relative w-full min-w-0 md:w-80">
          <span className="sr-only">Search commands</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 22 commands"
            className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] py-2 pl-9 pr-3 font-mono text-[13px] text-[var(--text)] placeholder:text-[var(--text-dim)] transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--bg)]"
          />
        </label>
      </FadeIn>

      <div className="mt-10 space-y-10">
        {filtered.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] py-10 text-center font-mono text-[13px] text-[var(--text-dim)]">
            no match for "{query}"
          </div>
        ) : (
          filtered.map((g, gi) => (
            <FadeIn key={g.name} delay={gi * 60}>
              <h3 className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--text-dim)]">{g.name}</h3>
              <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)]">
                {g.items.map((it, j) => (
                  <div
                    key={it.cmd}
                    className={cn(
                      "grid min-w-0 gap-1 px-4 py-4 transition-colors hover:bg-[var(--surface-2)] md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:gap-6 md:px-5",
                      j !== 0 && "border-t border-[var(--border)]"
                    )}
                  >
                    <code className="min-w-0 break-words font-mono text-[13px] text-[var(--accent)]">{it.cmd}</code>
                    <span className="min-w-0 text-[14.5px] leading-[1.55] text-[var(--text-muted)]">{it.desc}</span>
                  </div>
                ))}
              </div>
            </FadeIn>
          ))
        )}
      </div>
    </Section>
  );
}

function Security() {
  const guarantees = [
    {
      title: "AES-256-GCM sealed envelope",
      body: "Protocol v2 wraps every payload in an AEAD envelope, chunked, signed, and replay-protected with HKDF-derived keys.",
    },
    {
      title: "Metadata-first approval",
      body: "Incoming files and folders arrive as metadata only. Bonjou shows the name, size, and fingerprint and waits for an explicit @approve.",
    },
    {
      title: "Local-network design",
      body: "No external server, tracker, or relay. Bonjou operates within your broadcast domain and never opens an outbound connection on its own.",
    },
  ];

  return (
    <Section id="security" className="py-[var(--section-y)]">
      <SectionHeading
        index="06"
        label="Security"
        title="Designed for explicit control."
        body="Nothing leaves your subnet. Nothing lands on disk before you say so."
      />

      <FadeIn delay={120} className="mt-10">
        <SecurityFlow />
      </FadeIn>

      <div className="mt-8 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--border)] md:grid-cols-3">
        {guarantees.map((g, i) => (
          <FadeIn key={g.title} delay={140 + i * 60}>
            <div className="h-full bg-[var(--bg)] p-5 sm:p-6 md:p-7">
              <h4 className="text-[16px] font-semibold leading-[1.35] text-[var(--text)]">{g.title}</h4>
              <p className="mt-3 text-[14.5px] leading-[1.65] text-[var(--text-muted)]">{g.body}</p>
            </div>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={360} className="mt-8">
        <div className="rounded-[var(--radius-lg)] border border-[color-mix(in_oklab,var(--warn)_35%,var(--border))] bg-[color-mix(in_oklab,var(--warn)_8%,var(--surface-1))] p-5 sm:p-6">
          <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--warn)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--warn)]" />
            Known limits
          </div>
          <p className="mt-3 max-w-[72ch] text-[14.5px] leading-[1.65] text-[var(--text-muted)]">
            Discovery uses UDP broadcast, which most routers drop between VLANs and subnets. Bonjou
            finds peers on the same broadcast domain only, unless a relay is configured on network hardware.
          </p>
        </div>
      </FadeIn>
    </Section>
  );
}

function OpenSource() {
  const highlights = [
    { tag: "new", title: "Metadata-first approval queue", body: "No bytes hit disk before you call @approve." },
    { tag: "new", title: "Six queue commands", body: "@queue, @view, @approve, @reject, @approveAll, @rejectAll." },
    { tag: "improved", title: "Queue survives restarts", body: "Pending approvals persist across process restarts." },
  ];

  return (
    <Section id="open-source" className="py-[var(--section-y)]">
      <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-16">
        <SectionHeading
          index="07"
          label="Open source"
          title="Written in Go. Released under MIT."
          body="The source is small enough to read end to end. Audits, forks, and patches are welcome."
        >
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => window.open(REPO_URL, "_blank")}>
              <GithubIcon />
              hamzaabdulwahab / bonjou-cli
            </Button>
            <RepoStats />
          </div>
        </SectionHeading>

        <FadeIn delay={120} className="min-w-0">
          <div className="grid min-w-0 gap-6 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)] p-5 sm:p-6 md:p-8">
            <div className="min-w-0">
              <div className="mb-4 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                Latest · v1.2.0
              </div>
              <ul className="space-y-4">
                {highlights.map((h) => (
                  <li key={h.title} className="grid min-w-0 grid-cols-[4.75rem_minmax(0,1fr)] gap-4">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--accent)]">{h.tag}</span>
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold text-[var(--text)]">{h.title}</div>
                      <div className="text-[14px] leading-[1.55] text-[var(--text-muted)]">{h.body}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <a
                href={RELEASE_V120_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex text-[14px] font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
              >
                Full release notes
              </a>
            </div>

            <Divider />

            <div className="min-w-0 space-y-4">
              <CommandBlock label="Clone" command="git clone https://github.com/hamzaabdulwahab/bonjou-cli.git" />
              <CommandBlock label="Run" command="go run ./cmd/bonjou" />
              <CommandBlock label="Test" command="go test ./..." />
            </div>
          </div>
        </FadeIn>
      </div>
    </Section>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "Does Bonjou need internet access?",
      a: "No. It operates entirely on your local network. UDP broadcast for discovery on 46320, direct TCP for transfer on 46321.",
    },
    {
      q: "Is there an account or a server?",
      a: "No. Every running process is a peer. There is no signup, no central directory, no relay.",
    },
    {
      q: "What about cross-platform?",
      a: "macOS, Linux, and Windows are first-class. A folder sent from a Mac arrives on a Linux box with its tree intact.",
    },
    {
      q: "How do entire folders work?",
      a: "@folder offers the directory as a tree. Bonjou streams the structure, the receiver inspects with @view, approves with @approve, files land in ~/.bonjou/received/folders by default.",
    },
    {
      q: "Can it cross subnets or VLANs?",
      a: "Not out of the box. Discovery uses UDP broadcast, which routers normally drop between subnets. A broadcast relay on the network hardware works around it.",
    },
    {
      q: "Is the connection encrypted?",
      a: "Yes. Protocol v2 seals every message and file with AES-256-GCM and signs the envelope with HKDF-derived keys. Peer trust is TOFU with fingerprint pinning.",
    },
  ];

  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section className="py-[var(--section-y)]">
      <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-16">
        <SectionHeading index="08" label="Questions" title="Common questions." compact />

        <FadeIn delay={120} className="min-w-0 border-t border-[var(--border)]">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="border-b border-[var(--border)]">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full min-w-0 items-center justify-between gap-5 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="min-w-0 text-[16px] font-semibold text-[var(--text)]">{f.q}</span>
                  <PlusIcon className={cn("shrink-0 text-[var(--text-dim)] transition-transform duration-300", isOpen && "rotate-45 text-[var(--accent)]")} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ gridTemplateRows: "0fr", opacity: 0 }}
                      animate={{ gridTemplateRows: "1fr", opacity: 1 }}
                      exit={{ gridTemplateRows: "0fr", opacity: 0 }}
                      transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                      className="grid"
                    >
                      <div className="overflow-hidden">
                        <p className="max-w-[68ch] pb-6 pr-8 text-[15px] leading-[1.7] text-[var(--text-muted)]">{f.a}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </FadeIn>
      </div>
    </Section>
  );
}

function FinalCTA() {
  return (
    <Section className="py-[var(--section-y)]">
      <FadeIn className="mx-auto max-w-4xl text-center">
        <Eyebrow className="justify-center">Start using Bonjou</Eyebrow>
        <h2 className="mt-6 text-[clamp(2.4rem,6vw,4.6rem)] font-bold leading-[0.96] tracking-[-0.05em]">
          Move files across the room.
          <br />
          <span className="text-[var(--text-muted)]">Keep the trip local.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-[56ch] text-[17px] leading-[1.65] text-[var(--text-muted)]">
          One binary. No signup. Works on the network you are already on.
        </p>
        <div className="mx-auto mt-9 max-w-[680px]">
          <CopyCommand command={RAW_INSTALL_SH} />
          <a
            href="#install"
            className="mt-4 inline-flex text-[13px] font-semibold text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline"
          >
            choose another installer
          </a>
        </div>
      </FadeIn>
    </Section>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 border-t border-[var(--border)] bg-[var(--bg-soft)]">
      <div className="mx-auto px-4 py-12 sm:px-6 md:py-14 lg:px-0" style={{ maxWidth: "var(--shell)" }}>
        <div className="grid min-w-0 gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="min-w-0">
            <div className="font-[var(--font-display)] text-[16px] font-bold tracking-[-0.02em] text-[var(--text)]">Bonjou</div>
            <p className="mt-4 max-w-[32ch] text-[14px] leading-[1.6] text-[var(--text-muted)]">
              A local-network chat and file-transfer CLI. Built in Go. Released under MIT.
            </p>
            <div className="mt-5">
              <RepoStats />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <FooterCol
              heading="Project"
              links={[
                { label: "GitHub", href: REPO_URL },
                { label: "Releases", href: `${REPO_URL}/releases` },
                { label: "Issues", href: `${REPO_URL}/issues` },
              ]}
            />
            <FooterCol
              heading="Docs"
              links={[
                { label: "README", href: `${REPO_URL}#readme` },
                { label: "Commands", href: "#commands" },
                { label: "Security", href: "#security" },
              ]}
            />
            <FooterCol
              heading="Install"
              links={[
                { label: "macOS", href: "#install" },
                { label: "Linux", href: "#install" },
                { label: "Windows", href: "#install" },
              ]}
            />
          </div>
        </div>
        <Divider className="my-9" />
        <div className="flex flex-col items-start justify-between gap-3 font-mono text-[12px] text-[var(--text-dim)] md:flex-row md:items-center">
          <div>© {new Date().getFullYear()} Bonjou · MIT licensed</div>
          <div>v1.2.0 · made for the local subnet</div>
        </div>
      </div>
    </footer>
  );
}

function SectionHeading({
  index,
  label,
  title,
  body,
  children,
  compact = false,
}: {
  index: string;
  label: string;
  title: string;
  body?: string;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <FadeIn className={cn("min-w-0", compact ? "max-w-xl" : "max-w-2xl")}>
      <div className="flex min-w-0 items-start gap-4 sm:gap-5">
        <span className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--accent)]">{index}</span>
        <div className="min-w-0">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-dim)]">{label}</div>
          <h2 className="mt-4 text-[clamp(2rem,4vw,3.1rem)] font-bold leading-[1.02] tracking-[-0.04em] text-[var(--text)]">
            {title}
          </h2>
          {body && <p className="mt-5 max-w-[62ch] text-[16px] leading-[1.65] text-[var(--text-muted)]">{body}</p>}
          {children}
        </div>
      </div>
    </FadeIn>
  );
}

function FooterCol({ heading, links }: { heading: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--text-dim)]">{heading}</div>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              target={l.href.startsWith("http") ? "_blank" : undefined}
              rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="text-[14px] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GithubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.14.08 1.74 1.18 1.74 1.18 1.02 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.77.11 3.06.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.26 5.68.41.35.78 1.05.78 2.12v3.14c0 .31.21.67.79.55C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
