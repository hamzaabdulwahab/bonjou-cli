import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button, CopyCommand, FadeIn, InlineCommand, Section, cn } from "../components/ui";
import { FloatingNav } from "../components/FloatingNav";
import { SecurityFlow } from "../components/SecurityFlow";
import { TypingTerminal, type Line } from "../components/TypingTerminal";

const REPO_URL = "https://github.com/hamzaabdulwahab/bonjou-cli";
const RAW_INSTALL_SH =
  "curl -fsSL https://raw.githubusercontent.com/hamzaabdulwahab/bonjou-cli/main/scripts/install.sh | bash";
const RAW_INSTALL_PS1 =
  "iwr https://raw.githubusercontent.com/hamzaabdulwahab/bonjou-cli/main/scripts/install.ps1 -useb | iex";

type OS = "macOS" | "Linux" | "Windows";

const heroLines: Line[] = [
  { kind: "prompt", prompt: "alex@studio", text: "bonjou" },
  { kind: "dim", text: "listening on 192.168.1.14" },
  { kind: "dim", text: "sarah, jordan, dev-box discovered" },
  { kind: "spacer" },
  { kind: "prompt", prompt: "alex@studio", text: "@folder sarah ./launch-assets" },
  { kind: "dim", text: "offer sent: 12 files, 45.2 MB" },
  { kind: "success", text: "accepted by sarah" },
  { kind: "progress" },
  { kind: "out", text: "delivered locally in 0.9s" },
];

const proof = [
  ["Network", "LAN only"],
  ["Approval", "metadata first"],
  ["Security", "AES-256-GCM"],
  ["Platforms", "macOS, Linux, Windows"],
];

const useCases = [
  {
    title: "Teams in the same office",
    body: "Move builds, reports, exports, and folders across the room without creating a cloud link first.",
  },
  {
    title: "Labs and classrooms",
    body: "Share datasets, class material, and project folders on a local network where accounts slow everyone down.",
  },
  {
    title: "Mixed OS workstations",
    body: "Send from macOS to Linux to Windows through one terminal workflow instead of platform-specific sharing.",
  },
  {
    title: "Sensitive internal handoffs",
    body: "Keep bytes local, require receiver approval, and avoid third-party storage for routine transfers.",
  },
];

const workflow = [
  {
    label: "Discover",
    title: "Peers appear automatically",
    body: "Bonjou listens on UDP 46320 and announces peers on the same broadcast domain.",
  },
  {
    label: "Offer",
    title: "Send metadata first",
    body: "Files and folders are offered as names, sizes, counts, and fingerprints before any write occurs.",
  },
  {
    label: "Approve",
    title: "The receiver controls the disk",
    body: "@queue, @view, and @approve keep every incoming transfer explicit and inspectable.",
  },
  {
    label: "Transfer",
    title: "Bytes move peer to peer",
    body: "Payloads stream directly over TCP 46321 using a sealed envelope and no central relay.",
  },
];

const commands = [
  ["@users", "See nearby peers"],
  ["@send sarah hello", "Message one person"],
  ["@folder sarah ./demo", "Offer a folder"],
  ["@view 1", "Inspect incoming metadata"],
  ["@approve 1", "Accept and write"],
  ["@setpath ~/Received", "Choose destination"],
];

const security = [
  {
    title: "No cloud relay",
    body: "Bonjou does not upload your files to a service or wait for a public download URL.",
  },
  {
    title: "Approval before write",
    body: "Incoming files stay in the queue until the receiver explicitly approves them.",
  },
  {
    title: "Pinned peer trust",
    body: "TOFU fingerprint pinning keeps repeat peer identity visible and harder to silently swap.",
  },
];

const faqs = [
  {
    q: "Does Bonjou need internet access?",
    a: "No. It is designed for peers on the same local network. Discovery uses UDP 46320, transfers use TCP 46321.",
  },
  {
    q: "Can it send folders?",
    a: "Yes. @folder offers a directory with its structure intact. The receiver can inspect the manifest before approval.",
  },
  {
    q: "Does it work across operating systems?",
    a: "Yes. Bonjou is a Go CLI and supports macOS, Linux, and Windows release builds.",
  },
  {
    q: "Is it a replacement for cloud drives?",
    a: "It is for local transfer moments. When two machines are on the same LAN, Bonjou removes accounts, uploads, share links, and external storage from the path.",
  },
];

export function Home() {
  return (
    <div id="top" className="min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--text)] antialiased">
      <FloatingNav />
      <main className="overflow-x-clip">
        <Hero />
        <ProofStrip />
        <UseCases />
        <Workflow />
        <Product />
        <Security />
        <Install />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <Section className="relative isolate overflow-hidden pb-20 pt-28 sm:pt-32 lg:pb-28 lg:pt-36">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[42rem]"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, color-mix(in oklab, var(--accent) 14%, transparent), transparent 48%), linear-gradient(180deg, var(--bg-soft), transparent 70%)",
        }}
      />

      <div className="grid min-w-0 items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:gap-16">
        <FadeIn className="min-w-0">
          <h1 className="max-w-[12ch] text-[clamp(3.5rem,8vw,7rem)] font-semibold leading-[0.9] tracking-[-0.07em] text-[var(--text)]">
            Local file transfer without the cloud.
          </h1>
          <p className="mt-7 max-w-[58ch] text-[18px] leading-[1.65] tracking-[-0.01em] text-[var(--text-muted)] sm:text-[20px]">
            Bonjou finds nearby machines, asks before anything lands on disk, and moves messages, files, and folders directly across your LAN.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" onClick={() => document.getElementById("install")?.scrollIntoView({ behavior: "smooth" })}>
              Install Bonjou
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => document.getElementById("product")?.scrollIntoView({ behavior: "smooth" })}
            >
              See how it works
            </Button>
          </div>

          <div className="mt-10 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
            {proof.map(([label, value]) => (
              <div key={label} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-3">
                <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">{label}</div>
                <div className="mt-1 text-[13px] font-semibold tracking-[-0.01em] text-[var(--text)]">{value}</div>
              </div>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={120} className="min-w-0">
          <ProductFrame />
        </FadeIn>
      </div>
    </Section>
  );
}

function ProductFrame() {
  return (
    <div className="relative min-w-0">
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-[2rem] bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] blur-3xl"
      />
      <div className="overflow-hidden rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface-1)] p-2 shadow-[0_32px_100px_-68px_oklch(16%_0.037_255/0.65)]">
        <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--bg-soft)] p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div className="text-[12px] font-semibold text-[var(--text-muted)]">Live LAN handoff</div>
            <div className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--accent)]">
              no relay
            </div>
          </div>
          <TypingTerminal title="bonjou session" lines={heroLines} charDelay={10} lineDelay={120} />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <MiniStat label="Discovery" value="UDP 46320" />
            <MiniStat label="Transfer" value="TCP 46321" />
            <MiniStat label="State" value="~/.bonjou" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">{label}</div>
      <div className="mt-1 truncate font-mono text-[12px] text-[var(--text)]">{value}</div>
    </div>
  );
}

function ProofStrip() {
  const claims = [
    "No account",
    "No upload link",
    "No central storage",
    "No vendor lock-in",
    "No write before approval",
  ];

  return (
    <Section className="pb-10">
      <FadeIn>
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-6 gap-y-3 rounded-[1rem] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-5 shadow-[0_20px_70px_-62px_oklch(16%_0.037_255/0.45)]">
          {claims.map((claim) => (
            <span key={claim} className="text-[13px] font-semibold text-[var(--text-muted)]">
              {claim}
            </span>
          ))}
        </div>
      </FadeIn>
    </Section>
  );
}

function UseCases() {
  return (
    <Section id="use-cases" className="py-[var(--section-y)]">
      <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <SectionHeader
          label="Use cases"
          title="Made for the moments when the other machine is already nearby."
          body="Bonjou turns local transfer into a product-grade workflow instead of a messy pile of links, chat attachments, USB drives, and temporary servers."
        />
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {useCases.map((item, i) => (
            <FadeIn key={item.title} delay={i * 65}>
              <article className="h-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)] p-6 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[0_22px_70px_-60px_oklch(16%_0.037_255/0.55)]">
                <h3 className="text-[18px] font-semibold tracking-[-0.025em] text-[var(--text)]">{item.title}</h3>
                <p className="mt-3 text-[15px] leading-[1.65] text-[var(--text-muted)]">{item.body}</p>
              </article>
            </FadeIn>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Workflow() {
  return (
    <Section className="py-[var(--section-y)]">
      <SectionHeader
        label="Workflow"
        title="A transfer model that respects the receiver."
        body="The payload does not arrive first. Bonjou offers metadata, lets the receiver inspect it, then writes only after approval."
        centered
      />
      <div className="mt-12 grid min-w-0 gap-px overflow-hidden rounded-[1.2rem] border border-[var(--border)] bg-[var(--border)] md:grid-cols-4">
        {workflow.map((step, i) => (
          <FadeIn key={step.label} delay={i * 70}>
            <article className="h-full bg-[var(--surface-1)] p-6 md:p-7">
              <div className="mb-8 flex items-center justify-between gap-3">
                <span className="text-[12px] font-semibold uppercase tracking-[0.13em] text-[var(--accent)]">{step.label}</span>
                <span className="font-mono text-[12px] text-[var(--text-dim)]">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="text-[20px] font-semibold leading-[1.15] tracking-[-0.035em] text-[var(--text)]">{step.title}</h3>
              <p className="mt-4 text-[14.5px] leading-[1.65] text-[var(--text-muted)]">{step.body}</p>
            </article>
          </FadeIn>
        ))}
      </div>
    </Section>
  );
}

function Product() {
  return (
    <Section id="product" className="py-[var(--section-y)]">
      <div className="grid min-w-0 items-start gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
        <FadeIn className="min-w-0">
          <div className="sticky top-28">
            <SectionHeader
              label="Product"
              title="Terminal-native, but not loose or risky."
              body="The command surface stays small enough to remember. The important safety decisions stay visible."
            />
            <div className="mt-8 max-w-[680px]">
              <CopyCommand command={RAW_INSTALL_SH} />
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={120} className="min-w-0">
          <div className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface-1)] p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-semibold text-[var(--text)]">Command surface</div>
                <div className="text-[12px] text-[var(--text-dim)]">Core actions, no dashboard required.</div>
              </div>
              <div className="rounded-full border border-[var(--border)] px-3 py-1 font-mono text-[11px] text-[var(--text-dim)]">
                6 examples
              </div>
            </div>
            <div className="divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
              {commands.map(([cmd, desc]) => (
                <div key={cmd} className="grid min-w-0 gap-2 bg-[var(--surface-1)] px-4 py-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-5">
                  <code className="min-w-0 break-words font-mono text-[13px] text-[var(--accent)]">{cmd}</code>
                  <p className="min-w-0 text-[14px] leading-[1.55] text-[var(--text-muted)]">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </Section>
  );
}

function Security() {
  return (
    <Section id="security" className="py-[var(--section-y)]">
      <div className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--bg-soft)] p-5 sm:p-8 lg:p-10">
        <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
          <SectionHeader
            label="Security"
            title="Local-first by design, approval-first by default."
            body="Bonjou is built for explicit local handoffs. It does not hide a cloud storage step behind a nice interface."
          />
          <div className="min-w-0">
            <SecurityFlow />
          </div>
        </div>
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {security.map((item, i) => (
            <FadeIn key={item.title} delay={i * 65}>
              <article className="h-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)] p-5">
                <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--text)]">{item.title}</h3>
                <p className="mt-3 text-[14.5px] leading-[1.65] text-[var(--text-muted)]">{item.body}</p>
              </article>
            </FadeIn>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Install() {
  const [os, setOs] = useState<OS>("macOS");
  const recipes: Record<OS, { label: string; command: string }[]> = {
    macOS: [
      { label: "Install script", command: RAW_INSTALL_SH },
      { label: "Homebrew", command: "brew install hamzaabdulwahab/bonjou/bonjou" },
    ],
    Linux: [
      { label: "Install script", command: RAW_INSTALL_SH },
      { label: "Debian / Ubuntu", command: "sudo dpkg -i bonjou_1.2.0_amd64.deb" },
      { label: "Arch", command: "yay -S bonjou" },
    ],
    Windows: [
      { label: "PowerShell", command: RAW_INSTALL_PS1 },
      { label: "WinGet", command: "winget install HamzaAbdulWahab.Bonjou" },
      { label: "Scoop", command: "scoop bucket add bonjou https://github.com/hamzaabdulwahab/scoop-bonjou; scoop install bonjou" },
    ],
  };
  const tabs = Object.keys(recipes) as OS[];

  return (
    <Section id="install" className="py-[var(--section-y)]">
      <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
        <SectionHeader
          label="Install"
          title="One binary. Three operating systems."
          body="Use the script for the fastest path, or pick a package manager when your machine is locked down."
        />
        <FadeIn delay={120} className="min-w-0">
          <div className="overflow-hidden rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface-1)] shadow-[0_24px_80px_-70px_oklch(16%_0.037_255/0.5)]">
            <div role="tablist" className="grid grid-cols-3 border-b border-[var(--border)] bg-[var(--bg-soft)] p-1">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={os === tab}
                  onClick={() => setOs(tab)}
                  className={cn(
                    "h-10 rounded-[var(--radius-md)] text-[13px] font-semibold transition-colors",
                    os === tab ? "bg-[var(--surface-1)] text-[var(--text)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="space-y-5 p-4 sm:p-6">
              {recipes[os].map((recipe) => (
                <CommandBlock key={recipe.label} label={recipe.label} command={recipe.command} />
              ))}
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
      <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--text-dim)]">{label}</div>
      <InlineCommand command={command} label={label} />
    </div>
  );
}

function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <Section className="py-[var(--section-y)]">
      <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
        <SectionHeader label="FAQ" title="The questions people ask before installing." />
        <FadeIn delay={120} className="min-w-0 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {faqs.map((faq, i) => {
            const isOpen = open === i;
            return (
              <div key={faq.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full min-w-0 items-center justify-between gap-5 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="min-w-0 text-[17px] font-semibold tracking-[-0.02em] text-[var(--text)]">{faq.q}</span>
                  <span className={cn("shrink-0 text-[22px] leading-none text-[var(--text-dim)] transition-transform", isOpen && "rotate-45 text-[var(--accent)]")}>
                    +
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ gridTemplateRows: "0fr", opacity: 0 }}
                      animate={{ gridTemplateRows: "1fr", opacity: 1 }}
                      exit={{ gridTemplateRows: "0fr", opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="grid"
                    >
                      <div className="overflow-hidden">
                        <p className="max-w-[66ch] pb-6 text-[15px] leading-[1.7] text-[var(--text-muted)]">{faq.a}</p>
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
    <Section className="pb-20 pt-[var(--section-y)]">
      <FadeIn>
        <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--text)] p-7 text-white sm:p-10 lg:p-14">
          <div className="grid min-w-0 items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white/55">Start local</p>
              <h2 className="mt-5 max-w-[12ch] text-[clamp(2.8rem,6vw,5.4rem)] font-semibold leading-[0.92] tracking-[-0.065em]">
                Send the file without uploading it.
              </h2>
            </div>
            <div className="min-w-0">
              <p className="text-[17px] leading-[1.65] text-white/72">
                Install Bonjou, run it on two machines on the same LAN, and move the handoff through the terminal.
              </p>
              <div className="mt-7">
                <CopyCommand command={RAW_INSTALL_SH} className="border-white bg-white hover:border-white hover:bg-white" />
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </Section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface-1)]">
      <div className="mx-auto flex min-w-0 flex-col gap-6 px-4 py-9 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-0" style={{ maxWidth: "var(--shell)" }}>
        <div className="min-w-0">
          <div className="text-[17px] font-bold tracking-[-0.04em] text-[var(--text)]">Bonjou</div>
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">Local-network chat and file transfer from the terminal.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-medium text-[var(--text-muted)]">
          <a href="#install" className="hover:text-[var(--text)]">Install</a>
          <a href="#security" className="hover:text-[var(--text)]">Security</a>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text)]">Source</a>
        </div>
      </div>
    </footer>
  );
}

function SectionHeader({
  label,
  title,
  body,
  centered = false,
}: {
  label: string;
  title: string;
  body?: string;
  centered?: boolean;
}) {
  return (
    <FadeIn className={cn("min-w-0", centered && "mx-auto max-w-3xl text-center")}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">{label}</p>
      <h2 className={cn("mt-4 max-w-[13ch] text-[clamp(2.35rem,5vw,4.2rem)] font-semibold leading-[0.98] tracking-[-0.06em] text-[var(--text)]", centered && "mx-auto")}>
        {title}
      </h2>
      {body && <p className={cn("mt-5 max-w-[62ch] text-[16.5px] leading-[1.7] text-[var(--text-muted)]", centered && "mx-auto")}>{body}</p>}
    </FadeIn>
  );
}
