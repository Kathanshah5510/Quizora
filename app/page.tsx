import Link from "next/link";
import type { Metadata } from "next";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Quizora — AI-Powered Exam Platform",
  description:
    "AI-powered grading, real-time monitoring, and bulletproof exam security — all in one platform.",
};

const ArrowIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
  </svg>
);

const features = [
  {
    span: "col-span-1 sm:col-span-2",
    accent: "oklch(0.55 0.25 264)",
    accentEnd: "oklch(0.60 0.22 295)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    title: "AI-Powered Grading",
    desc: "Gemini 2.5 Flash grades short-text answers, suggests scores with reasoning, and flags edge cases for human review. Supports exact, fuzzy (Levenshtein), and AI-assisted modes — per exam.",
    badge: "Powered by Gemini",
  },
  {
    span: "col-span-1",
    accent: "oklch(0.55 0.22 155)",
    accentEnd: "oklch(0.60 0.20 180)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: "Bulletproof Security",
    desc: "Fullscreen enforcement, tab detection, session tokens, answer keys never sent to client.",
    badge: "Zero Trust",
  },
  {
    span: "col-span-1",
    accent: "oklch(0.60 0.22 30)",
    accentEnd: "oklch(0.65 0.20 55)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: "Live Monitoring",
    desc: "Real-time dashboard with per-student status, violations, and event timelines.",
    badge: "Real-time",
  },
  {
    span: "col-span-1",
    accent: "oklch(0.58 0.22 295)",
    accentEnd: "oklch(0.63 0.20 320)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Server-Authoritative Timer",
    desc: "Expiry is set in the DB at attempt start — clients can't cheat the clock.",
    badge: "Tamper-proof",
  },
  {
    span: "col-span-1",
    accent: "oklch(0.58 0.22 215)",
    accentEnd: "oklch(0.63 0.20 240)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
    title: "6 Question Types",
    desc: "MCQ, MSQ, True/False, Numerical, Short Text, Image-based — all with negative marking.",
    badge: "Flexible",
  },
  {
    span: "col-span-1 sm:col-span-3",
    accent: "oklch(0.55 0.22 340)",
    accentEnd: "oklch(0.60 0.20 20)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    title: "Roster & RBAC",
    desc: "CSV bulk import, manual add, open-exam mode for external students. Super Admin and Admin roles with strict permission enforcement. Soft deletes keep audit trails intact — nothing is ever hard-deleted.",
    badge: "Multi-role",
  },
];

const stats = [
  { value: "6", label: "Question Types" },
  { value: "3", label: "Grading Modes" },
  { value: "2", label: "Timer Modes" },
  { value: "∞", label: "Scale" },
];

const steps = [
  {
    number: "01",
    title: "Create & Configure",
    desc: "Build your exam with timer rules, fullscreen enforcement, and randomization. Import questions from any PDF or CSV — AI extracts them automatically.",
  },
  {
    number: "02",
    title: "Students Take It",
    desc: "Students join via a secure link. Fullscreen is enforced from question 1. Answers auto-save; the server owns the timer.",
  },
  {
    number: "03",
    title: "Auto-grade & Ship",
    desc: "AI grades short-text answers instantly. Review, override, and release results — manually or automatically after the window closes.",
  },
];

export default function LandingPage() {
  return (
    <>
      <style>{`
        @keyframes blob {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(30px,-20px) scale(1.07); }
          66%      { transform: translate(-20px,15px) scale(0.95); }
        }
        .blob1 { animation: blob 9s ease-in-out infinite; }
        .blob2 { animation: blob 12s ease-in-out infinite reverse; animation-delay:-3s; }
        .blob3 { animation: blob 15s ease-in-out infinite; animation-delay:-7s; }
        .grad-text {
          background: linear-gradient(135deg, oklch(0.55 0.25 264) 0%, oklch(0.62 0.22 295) 60%, oklch(0.68 0.20 320) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .glow-btn {
          box-shadow: 0 0 28px oklch(0.51 0.22 264 / 0.45), 0 4px 16px oklch(0.51 0.22 264 / 0.25);
          transition: box-shadow 0.25s ease, opacity 0.2s ease, transform 0.2s ease;
        }
        .glow-btn:hover {
          box-shadow: 0 0 40px oklch(0.51 0.22 264 / 0.6), 0 6px 24px oklch(0.51 0.22 264 / 0.35);
          transform: translateY(-1px);
        }
        .feat-card {
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
        }
        .feat-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 40px oklch(0 0 0 / 0.08);
        }
        .stat-item { transition: transform 0.2s ease; }
        .stat-item:hover { transform: scale(1.04); }
      `}</style>

      <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

        {/* ── Navbar ── */}
        <header className="sticky top-0 z-50 border-b border-border bg-background/75 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg font-black text-sm"
                style={{
                  background: "linear-gradient(135deg, oklch(0.55 0.25 264), oklch(0.60 0.22 295))",
                  color: "#fff",
                }}
              >
                Q
              </div>
              <span className="text-lg font-bold tracking-tight">Quizora</span>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link
                href="/admin/dashboard"
                className="glow-btn inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, oklch(0.51 0.22 264), oklch(0.55 0.22 295))" }}
              >
                Admin Portal
                <ArrowIcon />
              </Link>
            </div>
          </div>
        </header>

        {/* ── Hero ── */}
        <section className="relative overflow-hidden min-h-[88vh] flex flex-col justify-center">

          {/* Mesh gradient base */}
          <div className="absolute inset-0 -z-20" style={{
            background: `
              radial-gradient(ellipse 70% 60% at 15% 25%, oklch(0.55 0.25 264 / 0.18) 0%, transparent 65%),
              radial-gradient(ellipse 55% 55% at 85% 15%, oklch(0.60 0.22 295 / 0.15) 0%, transparent 60%),
              radial-gradient(ellipse 60% 50% at 60% 85%, oklch(0.65 0.20 215 / 0.12) 0%, transparent 60%)
            `
          }} />

          {/* Animated blobs */}
          <div className="blob1 absolute top-16 left-[8%] h-72 w-72 rounded-full blur-3xl -z-10"
            style={{ background: "oklch(0.55 0.25 264 / 0.20)" }} />
          <div className="blob2 absolute top-8 right-[10%] h-80 w-80 rounded-full blur-3xl -z-10"
            style={{ background: "oklch(0.60 0.22 295 / 0.18)" }} />
          <div className="blob3 absolute bottom-10 left-[40%] h-64 w-64 rounded-full blur-3xl -z-10"
            style={{ background: "oklch(0.65 0.20 215 / 0.14)" }} />

          <div className="mx-auto max-w-6xl px-6 py-28 text-center w-full">

            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-8 border"
              style={{
                background: "oklch(0.55 0.25 264 / 0.08)",
                borderColor: "oklch(0.55 0.25 264 / 0.25)",
                color: "oklch(0.51 0.22 264)",
              }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ background: "oklch(0.55 0.25 264)" }} />
                <span className="relative inline-flex rounded-full h-2 w-2"
                  style={{ background: "oklch(0.55 0.25 264)" }} />
              </span>
              AI-Powered · Real-time · Bulletproof
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight mb-6 leading-[1.08]">
              Exams that are
              <br />
              <span className="grad-text">actually smart.</span>
            </h1>

            <p className="mx-auto max-w-xl text-lg text-muted-foreground mb-10 leading-relaxed">
              Create, monitor, and auto-grade exams with AI. Real-time security enforcement,
              server-authoritative timers, and Gemini-powered grading — built for institutions,
              loved by faculty.
            </p>

            {/* CTA */}
            <div className="flex justify-center mb-16">
              <Link
                href="/admin/dashboard"
                className="glow-btn inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg, oklch(0.51 0.22 264), oklch(0.55 0.22 295))" }}
              >
                Open Admin Portal
                <ArrowIcon />
              </Link>
            </div>

            {/* Stats */}
            <div
              className="inline-grid grid-cols-2 sm:grid-cols-4 rounded-2xl overflow-hidden border mx-auto"
              style={{ borderColor: "oklch(0.55 0.22 264 / 0.2)" }}
            >
              {stats.map((s, i) => (
                <div
                  key={s.label}
                  className="stat-item px-8 py-5 text-center"
                  style={{
                    background: i % 2 === 0
                      ? "oklch(0.55 0.22 264 / 0.06)"
                      : "oklch(0.60 0.20 295 / 0.04)",
                    borderRight: i < stats.length - 1 ? "1px solid oklch(0.55 0.22 264 / 0.15)" : "none",
                  }}
                >
                  <div className="grad-text text-3xl font-black mb-1">{s.value}</div>
                  <div className="text-xs text-muted-foreground font-medium">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="py-24" style={{
          background: "linear-gradient(180deg, oklch(0.55 0.22 264 / 0.04) 0%, transparent 100%)"
        }}>
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center mb-14">
              <h2 className="text-4xl font-black tracking-tight mb-3">
                Built for the{" "}
                <span className="grad-text">whole exam lifecycle.</span>
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                From setting up questions to releasing grades — every step is handled.
              </p>
            </div>

            {/* Bento grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {features.map((f) => (
                <div
                  key={f.title}
                  className={`feat-card rounded-2xl border border-border bg-card p-6 ${f.span}`}
                >
                  {/* Icon */}
                  <div
                    className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl text-white"
                    style={{
                      background: `linear-gradient(135deg, ${f.accent}, ${f.accentEnd})`,
                      boxShadow: `0 4px 20px ${f.accent}55`,
                    }}
                  >
                    {f.icon}
                  </div>

                  {/* Badge */}
                  <div className="mb-3">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        background: `${f.accent}18`,
                        color: f.accent,
                      }}
                    >
                      {f.badge}
                    </span>
                  </div>

                  <h3 className="font-bold text-lg text-card-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 -z-10" style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 50%, oklch(0.55 0.22 264 / 0.07), transparent)"
          }} />
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black tracking-tight mb-3">
                Three steps.{" "}
                <span className="grad-text">Zero friction.</span>
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                From exam setup to graded results in minutes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {steps.map((s) => (
                <div
                  key={s.number}
                  className="feat-card rounded-2xl border border-border bg-card p-8"
                >
                  <div
                    className="text-7xl font-black mb-6 leading-none select-none"
                    style={{
                      background: "linear-gradient(135deg, oklch(0.55 0.25 264 / 0.25), oklch(0.60 0.22 295 / 0.10))",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {s.number}
                  </div>
                  <h3 className="font-bold text-xl text-foreground mb-3">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="py-28 text-center relative overflow-hidden">
          <div className="absolute inset-0 -z-10" style={{
            background: `
              radial-gradient(ellipse 60% 80% at 50% 100%, oklch(0.55 0.25 264 / 0.15), transparent)
            `
          }} />
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
              Ready to run{" "}
              <span className="grad-text">smarter exams?</span>
            </h2>
            <p className="text-muted-foreground mb-10 max-w-sm mx-auto text-base">
              Sign in and create your first exam in under 5 minutes.
            </p>
            <Link
              href="/admin/dashboard"
              className="glow-btn inline-flex items-center gap-2 rounded-xl px-9 py-4 text-base font-bold text-white"
              style={{ background: "linear-gradient(135deg, oklch(0.51 0.22 264), oklch(0.55 0.22 295))" }}
            >
              Get Started
              <ArrowIcon />
            </Link>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-border py-6">
          <div className="mx-auto max-w-6xl px-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div
              className="flex h-6 w-6 items-center justify-center rounded font-black text-xs text-white"
              style={{ background: "linear-gradient(135deg, oklch(0.51 0.22 264), oklch(0.55 0.22 295))" }}
            >
              Q
            </div>
            <span className="font-semibold text-foreground">Quizora</span>
            <span>— Online Exam Platform</span>
          </div>
        </footer>

      </div>
    </>
  );
}
