import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Button,
  CopyCommand,
  InlineCommand,
  Eyebrow,
  Section,
  Divider,
  FadeIn,
  cn,
} from "../components/ui";
import { FloatingNav } from "../components/FloatingNav";
import { SubnetCanvas } from "../components/SubnetCanvas";
import { TypingTerminal, type Line } from "../components/TypingTerminal";
import { RepoStats } from "../components/RepoStats";
import { SecurityFlow } from "../components/SecurityFlow";

const REPO_URL = "https://github.com/hamzaabdulwahab/bonjou-cli";
const RELEASE_V120_URL = `${REPO_URL}/releases/tag/v1.2.0`;
const RAW_INSTALL_SH =
  "curl -fsSL https://raw.githubusercontent.com/hamzaabdulwahab/bonjou-cli/main/scripts/install.sh | bash";
const RAW_INSTALL_PS1 =
  "iwr https://raw.githubusercontent.com/hamzaabdulwahab/bonjou-cli/main/scripts/install.ps1 -useb | iex";

// ---------------------------------------------------------------------------
// Hero terminal script — the self-typing sequence
// ---------------------------------------------------------------------------
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
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased" id="top">
      {/* Persistent ambient layer — subnet canvas continues behind every section at low opacity */}
      <AmbientLayer />

      <FloatingNav />

      <main className="relative">
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

// ----------------------------------------------------------------------------
// AMBIENT LAYER
// Fixed full-viewport canvas at very low opacity behind everything.
// ----------------------------------------------------------------------------
function AmbientLayer() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ contain: "strict" }}
    >
      <SubnetCanvas opacity={0.18} nodeCount={28} handshakeIntervalSec={3.2} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// HERO
// ----------------------------------------------------------------------------
function Hero() {
  return (
    <Section className="relative isolate pt-36 pb-24 md:pt-44 md:pb-32">
      {/* Hero gets its own dedicated canvas instance at full intensity */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[120%]"
        style={{
          maskImage:
            "radial-gradient(ellipse at 50% 30%, oklch(0% 0 0 / 1) 0%, oklch(0% 0 0 / 0.85) 45%, oklch(0% 0 0 / 0) 80%)",
        }}
      >
        <SubnetCanvas opacity={0.9} nodeCount={32} handshakeIntervalSec={1.7} />
      </div>

      {/* Gradient floor that fades the canvas into the page */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-b from-transparent to-[var(--bg)]"
      />

      <div className="relative mx-auto flex flex-col items-center text-center">
        <FadeIn>
          <Eyebrow>
            <span>v1.2.0</span>
            <span aria-hidden className="text-[var(--border-strong)]">·</span>
            <span>macOS · Linux · Windows</span>
          </Eyebrow>
        </FadeIn>

        <FadeIn delay={80}>
          <h1
            className="mt-7 max-w-[14ch] text-[3.25rem] font-semibold leading-[0.98] tracking-[-0.04em] text-[var(--text)] md:text-[5rem]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Hello,
            <br />
            <span className="text-[var(--accent)]">local network.</span>
          </h1>
        </FadeIn>

        <FadeIn delay={160}>
          <p className="mt-6 max-w-[52ch] text-balance text-[16px] leading-[1.65] text-[var(--text-muted)] md:text-[17px]">
            A terminal CLI for LAN chat and file transfer. Bonjou finds the machines on your
            subnet and moves messages, files, and folders between them. No account, no relay,
            no cloud.
          </p>
        </FadeIn>

        <FadeIn delay={260} className="mt-10 w-full max-w-[640px]">
          <CopyCommand command={RAW_INSTALL_SH} />
          <div className="mt-4 flex items-center justify-center gap-1.5 text-[12.5px] text-[var(--text-dim)]">
            <span>or</span>
            <a
              href="#install"
              className="font-medium text-[var(--text-muted)] underline-offset-4 transition-colors hover:text-[var(--text)] hover:underline"
            >
              pick a package manager
            </a>
            <span aria-hidden>→</span>
          </div>
        </FadeIn>

        <FadeIn delay={380} className="mt-16 w-full max-w-[720px]">
          <TypingTerminal title="bonjou — local network" lines={heroScript} />
        </FadeIn>
      </div>
    </Section>
  );
}

// ----------------------------------------------------------------------------
// SPEC STRIP
// ----------------------------------------------------------------------------
function SpecStrip() {
  const specs = [
    { label: "Discovery", value: "UDP 46320" },
    { label: "Transfer", value: "TCP 46321" },
    { label: "Wire format", value: "Envelope v2 · AES-256-GCM" },
    { label: "Peer trust", value: "TOFU fingerprint pinning" },
  ];

  return (
    <Section className="relative py-10 md:py-12">
      <Divider />
      <div className="grid grid-cols-2 gap-y-6 py-10 md:grid-cols-4 md:gap-x-10">
        {specs.map((s, i) => (
          <FadeIn key={s.label} delay={i * 60} className="flex flex-col gap-1.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
              {s.label}
            </span>
            <span className="font-mono text-[13px] text-[var(--text)]">{s.value}</span>
          </FadeIn>
        ))}
      </div>
      <Divider />
    </Section>
  );
}

// ----------------------------------------------------------------------------
// INSTALL
// ----------------------------------------------------------------------------
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
    <Section id="install" className="py-28 md:py-36">
      <div className="grid gap-14 lg:grid-cols-[20rem_1fr] lg:gap-20">
        <FadeIn>
          <Eyebrow>02 · Install</Eyebrow>
          <h2 className="mt-5 text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[2.5rem]">
            One binary,
            <br />
            three operating systems.
          </h2>
          <p className="mt-5 max-w-[34ch] text-[15px] leading-[1.65] text-[var(--text-muted)]">
            Bonjou ships as a self-contained executable. Pick the path that matches your machine.
          </p>
          <a
            href={`${REPO_URL}/releases/latest`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            All releases
            <span aria-hidden>→</span>
          </a>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-1)]">
            <div role="tablist" className="flex border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-1)_50%,var(--surface-2))]">
              {tabs.map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={os === t}
                  onClick={() => setOs(t)}
                  className={cn(
                    "relative flex-1 px-5 py-3 text-[13px] font-medium transition-colors",
                    os === t
                      ? "text-[var(--text)]"
                      : "text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                  )}
                >
                  {t}
                  {os === t && (
                    <span
                      aria-hidden
                      className="absolute inset-x-5 bottom-0 h-[2px] bg-[var(--accent)]"
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="p-6 md:p-8">
              <div className="space-y-5">
                {recipes[os].map((r) => (
                  <div key={r.label} className="space-y-2">
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
                      {r.label}
                    </div>
                    <InlineCommand command={r.command} label={r.label} />
                  </div>
                ))}
              </div>

              <Divider className="my-8" />

              <div className="space-y-2">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  From source · any platform
                </div>
                <InlineCommand command="go install github.com/hamzawahab/bonjou-cli/cmd/bonjou@latest" />
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </Section>
  );
}

// ----------------------------------------------------------------------------
// WALKTHROUGH — the one raised stage on the page
// ----------------------------------------------------------------------------
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
    { kind: "out", text: "→ incoming · folder from alex" },
    { kind: "dim", text: "assets/ · 12 items · 45.2 MB · fingerprint a4:7c…" },
    { kind: "prompt", prompt: "sarah@thinkpad", text: "@view 1" },
    { kind: "dim", text: "manifest · 12 files · top-level: img / fonts / brand.json" },
    { kind: "prompt", prompt: "sarah@thinkpad", text: "@approve 1" },
    { kind: "dim", text: "writing to ~/.bonjou/received/folders/assets/" },
    { kind: "success", text: "done · 12 files" },
  ];

  return (
    <Section className="py-28 md:py-36">
      <FadeIn className="mb-14 max-w-2xl">
        <Eyebrow>03 · Walkthrough</Eyebrow>
        <h2 className="mt-5 text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[2.5rem]">
          Two terminals.
          <br />
          One subnet.
        </h2>
        <p className="mt-5 text-[15px] leading-[1.65] text-[var(--text-muted)]">
          Alex offers a folder. Sarah sees the metadata first, inspects it, and approves
          explicitly. Bonjou never writes a byte to her disk until she does.
        </p>
      </FadeIn>

      {/* the raised stage */}
      <FadeIn delay={140}>
        <div
          className={cn(
            "relative overflow-hidden rounded-3xl border border-[var(--border)]",
            "bg-[color-mix(in_oklab,var(--surface-1)_70%,transparent)] backdrop-blur",
            "p-6 md:p-10",
            "shadow-[0_60px_120px_-60px_oklch(0%_0_0/0.7),0_1px_0_oklch(100%_0_0/0.04)_inset]"
          )}
        >
          {/* faint connection line crossing the two terminals */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-1/2 hidden h-px -translate-y-1/2 lg:block"
            style={{
              background:
                "linear-gradient(90deg, transparent 8%, color-mix(in oklab, var(--accent) 28%, transparent) 50%, transparent 92%)",
            }}
          />
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
            <TypingTerminal title="alex@studio" lines={alexLines} charDelay={32} loopHoldMs={8000} />
            <TypingTerminal title="sarah@thinkpad" lines={sarahLines} charDelay={28} loopHoldMs={8000} />
          </div>
        </div>
      </FadeIn>
    </Section>
  );
}

// ----------------------------------------------------------------------------
// FEATURES
// ----------------------------------------------------------------------------
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
    <Section id="features" className="py-28 md:py-36">
      <FadeIn className="mb-16 max-w-2xl">
        <Eyebrow>04 · Features</Eyebrow>
        <h2 className="mt-5 text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[2.5rem]">
          What the binary does.
        </h2>
      </FadeIn>

      <div className="border-t border-[var(--border)]">
        {rows.map((r, i) => (
          <FadeIn key={r.tag} delay={i * 50}>
            <article className="group grid grid-cols-1 gap-2 border-b border-[var(--border)] py-7 transition-colors hover:bg-[color-mix(in_oklab,var(--surface-1)_60%,transparent)] md:grid-cols-[10rem_minmax(0,1fr)] md:gap-10 md:py-8">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
                {r.tag}
              </div>
              <div>
                <h3 className="text-[19px] font-medium leading-[1.35] text-[var(--text)]">
                  {r.title}
                </h3>
                <p className="mt-2 max-w-[64ch] text-[14.5px] leading-[1.65] text-[var(--text-muted)]">
                  {r.body}
                </p>
              </div>
            </article>
          </FadeIn>
        ))}
      </div>
    </Section>
  );
}

// ----------------------------------------------------------------------------
// COMPARISON
// ----------------------------------------------------------------------------
function Comparison() {
  const rows = [
    {
      alt: "Cloud drives",
      tradeoff: "Round-trip through someone else's server. Account, upload, share link, download.",
      bonjou: "Direct peer to peer at LAN speed. No external hop.",
    },
    {
      alt: "AirDrop-style sharing",
      tradeoff: "Bound to a single vendor's ecosystem.",
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
    <Section className="py-28 md:py-36">
      <FadeIn className="mb-14 max-w-2xl">
        <Eyebrow>05 · Why Bonjou</Eyebrow>
        <h2 className="mt-5 text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[2.5rem]">
          Compared with the usual alternatives.
        </h2>
      </FadeIn>

      <FadeIn delay={100}>
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-1)_45%,transparent)] backdrop-blur">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="w-[24%] px-6 py-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  Alternative
                </th>
                <th className="px-6 py-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  Tradeoff
                </th>
                <th className="px-6 py-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
                  Bonjou
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={i}
                  className={cn("border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-1)]", i === 0 && "border-t-0")}
                >
                  <td className="px-6 py-5 align-top text-[14.5px] font-medium text-[var(--text)]">
                    {r.alt}
                  </td>
                  <td className="px-6 py-5 align-top text-[14px] leading-[1.6] text-[var(--text-muted)]">
                    {r.tradeoff}
                  </td>
                  <td className="px-6 py-5 align-top text-[14px] leading-[1.6] text-[var(--text)]">
                    {r.bonjou}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeIn>
    </Section>
  );
}

// ----------------------------------------------------------------------------
// COMMANDS — the full 22-command surface
// ----------------------------------------------------------------------------
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
      items: g.items.filter(
        (i) => i.cmd.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)
      ),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <Section id="commands" className="py-28 md:py-36">
      <FadeIn className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <Eyebrow>06 · Reference</Eyebrow>
          <h2 className="mt-5 text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[2.5rem]">
            Everything happens at the prompt.
          </h2>
        </div>

        <label className="relative w-full md:w-72">
          <span className="sr-only">Search commands</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 22 commands"
            className="w-full rounded-full border border-[var(--border)] bg-[var(--surface-1)] py-2 pl-9 pr-3 font-mono text-[13px] text-[var(--text)] placeholder:text-[var(--text-dim)] transition-colors focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--bg)]"
          />
        </label>
      </FadeIn>

      <div className="space-y-12">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] py-10 text-center font-mono text-[13px] text-[var(--text-dim)]">
            no match for "{query}"
          </div>
        ) : (
          filtered.map((g, gi) => (
            <FadeIn key={g.name} delay={gi * 80}>
              <h3 className="mb-4 font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
                {g.name}
              </h3>
              <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-1)_60%,transparent)] backdrop-blur">
                {g.items.map((it, j) => (
                  <div
                    key={it.cmd}
                    className={cn(
                      "grid grid-cols-1 gap-1 px-5 py-4 transition-colors hover:bg-[var(--surface-1)] md:grid-cols-[18rem_minmax(0,1fr)] md:gap-6",
                      j !== 0 && "border-t border-[var(--border)]"
                    )}
                  >
                    <code className="font-mono text-[13px] text-[var(--accent)]">{it.cmd}</code>
                    <span className="text-[14px] leading-[1.55] text-[var(--text-muted)]">
                      {it.desc}
                    </span>
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

// ----------------------------------------------------------------------------
// SECURITY — animated flow + guarantees
// ----------------------------------------------------------------------------
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
    <Section id="security" className="py-28 md:py-36">
      <FadeIn className="mb-14 max-w-2xl">
        <Eyebrow>07 · Security</Eyebrow>
        <h2 className="mt-5 text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[2.5rem]">
          Designed for explicit control.
        </h2>
        <p className="mt-5 text-[15px] leading-[1.65] text-[var(--text-muted)]">
          Nothing leaves your subnet. Nothing lands on disk before you say so.
        </p>
      </FadeIn>

      <FadeIn delay={120} className="mb-10">
        <SecurityFlow />
      </FadeIn>

      <div className="grid gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] md:grid-cols-3">
        {guarantees.map((g, i) => (
          <FadeIn key={g.title} delay={140 + i * 80}>
            <div className="h-full bg-[var(--bg)] p-6 md:p-8">
              <h4 className="text-[15.5px] font-medium leading-[1.4] text-[var(--text)]">
                {g.title}
              </h4>
              <p className="mt-3 text-[13.5px] leading-[1.65] text-[var(--text-muted)]">{g.body}</p>
            </div>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={420} className="mt-10">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-6 md:p-8">
          <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--warn)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--warn)]" />
            Known limits
          </div>
          <p className="mt-3 max-w-[68ch] text-[14px] leading-[1.65] text-[var(--text-muted)]">
            Discovery uses UDP broadcast, which most routers drop between VLANs and subnets. Bonjou
            will find peers on the same broadcast domain only, unless a relay is configured on your
            network hardware.
          </p>
        </div>
      </FadeIn>
    </Section>
  );
}

// ----------------------------------------------------------------------------
// OPEN SOURCE — v1.2.0 highlights merged in
// ----------------------------------------------------------------------------
function OpenSource() {
  const highlights = [
    {
      tag: "new",
      title: "Metadata-first approval queue",
      body: "No bytes hit disk before you call @approve.",
    },
    {
      tag: "new",
      title: "Six new queue commands",
      body: "@queue, @view, @approve, @reject, @approveAll, @rejectAll.",
    },
    {
      tag: "improved",
      title: "Queue survives restarts",
      body: "Pending approvals persist across process restarts.",
    },
  ];

  return (
    <Section id="open-source" className="py-28 md:py-36">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <FadeIn className="max-w-[36ch]">
          <Eyebrow>08 · Open source</Eyebrow>
          <h2 className="mt-5 text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[2.5rem]">
            Written in Go.
            <br />
            Released under MIT.
          </h2>
          <p className="mt-5 text-[15px] leading-[1.65] text-[var(--text-muted)]">
            The source is small enough to read end to end. Audits, forks, and patches are welcome.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => window.open(REPO_URL, "_blank")}>
              <GithubIcon />
              hamzaabdulwahab / bonjou-cli
            </Button>
            <RepoStats />
          </div>

          {/* v1.2.0 inline highlights */}
          <div className="mt-10">
            <div className="mb-4 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              Latest · v1.2.0
            </div>
            <ul className="space-y-3">
              {highlights.map((h) => (
                <li key={h.title} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--accent)]">
                    {h.tag}
                  </span>
                  <div>
                    <div className="text-[14px] font-medium text-[var(--text)]">{h.title}</div>
                    <div className="text-[13px] text-[var(--text-muted)]">{h.body}</div>
                  </div>
                </li>
              ))}
            </ul>
            <a
              href={RELEASE_V120_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-[13px] font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              Full release notes
              <span aria-hidden>→</span>
            </a>
          </div>
        </FadeIn>

        <FadeIn delay={140}>
          <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-1)_55%,transparent)] backdrop-blur p-6 md:p-8">
            <div className="space-y-4">
              <div>
                <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  Clone
                </div>
                <InlineCommand command="git clone https://github.com/hamzaabdulwahab/bonjou-cli.git" />
              </div>
              <div>
                <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  Run
                </div>
                <InlineCommand command="go run ./cmd/bonjou" />
              </div>
              <div>
                <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  Test
                </div>
                <InlineCommand command="go test ./..." />
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </Section>
  );
}

// ----------------------------------------------------------------------------
// FAQ
// ----------------------------------------------------------------------------
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
    <Section className="py-28 md:py-36">
      <div className="grid gap-14 lg:grid-cols-[20rem_1fr] lg:gap-20">
        <FadeIn>
          <Eyebrow>09 · Questions</Eyebrow>
          <h2 className="mt-5 text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[2.5rem]">
            Common questions.
          </h2>
        </FadeIn>

        <FadeIn delay={120} className="border-t border-[var(--border)]">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="border-b border-[var(--border)]">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-6 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-[15.5px] font-medium text-[var(--text)]">{f.q}</span>
                  <PlusIcon className={cn("shrink-0 text-[var(--text-dim)] transition-transform duration-300", isOpen && "rotate-45 text-[var(--accent)]")} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <p className="max-w-[64ch] pb-6 pr-12 text-[14.5px] leading-[1.7] text-[var(--text-muted)]">
                        {f.a}
                      </p>
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

// ----------------------------------------------------------------------------
// FINAL CTA
// ----------------------------------------------------------------------------
function FinalCTA() {
  return (
    <Section className="py-32 md:py-40">
      <FadeIn className="mx-auto max-w-3xl text-center">
        <Eyebrow className="justify-center">Start using Bonjou</Eyebrow>
        <h2 className="mt-6 text-[2.5rem] font-semibold leading-[0.98] tracking-[-0.035em] md:text-[3.75rem]">
          Move files across the room.
          <br />
          <span className="text-[var(--text-muted)]">Not across the planet.</span>
        </h2>
        <p className="mt-6 text-[16px] leading-[1.65] text-[var(--text-muted)]">
          One binary. No signup. Works on the network you are already on.
        </p>
        <div className="mt-10 w-full">
          <div className="mx-auto max-w-[640px]">
            <CopyCommand command={RAW_INSTALL_SH} />
          </div>
          <div className="mt-4 flex items-center justify-center gap-1.5 text-[12.5px] text-[var(--text-dim)]">
            <span>or</span>
            <a
              href="#install"
              className="font-medium text-[var(--text-muted)] underline-offset-4 transition-colors hover:text-[var(--text)] hover:underline"
            >
              pick a package manager
            </a>
            <span aria-hidden>→</span>
          </div>
        </div>
      </FadeIn>
    </Section>
  );
}

// ----------------------------------------------------------------------------
// FOOTER
// ----------------------------------------------------------------------------
function Footer() {
  return (
    <footer className="relative border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_92%,var(--surface-1))]">
      <div className="mx-auto px-6 py-12 md:px-10 md:py-16" style={{ maxWidth: "var(--shell)" }}>
        <div className="grid gap-10 md:grid-cols-[1fr_2fr]">
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--text)]">Bonjou</div>
            <p className="mt-4 max-w-[28ch] text-[13px] leading-[1.6] text-[var(--text-muted)]">
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
        <Divider className="my-10" />
        <div className="flex flex-col items-start justify-between gap-3 text-[12px] text-[var(--text-dim)] md:flex-row md:items-center">
          <div className="font-mono">© {new Date().getFullYear()} Bonjou · MIT licensed</div>
          <div className="font-mono">v1.2.0 · made for the local subnet</div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  heading,
  links,
}: {
  heading: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
        {heading}
      </div>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              target={l.href.startsWith("http") ? "_blank" : undefined}
              rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="text-[13px] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ----------------------------------------------------------------------------
// ICONS
// ----------------------------------------------------------------------------
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
