"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle,
  FileText,
  Mic,
  Route,
  BookOpen,
  CalendarClock,
  Search,
  GitBranch,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import FeatureCard from "@/components/LandingPage/feature-card";
import FaqAccordion from "@/components/LandingPage/faq-accordion";
import TopoCanvas from "@/components/LandingPage/topo-canvas";
import AgentNetwork from "@/components/LandingPage/agent-network";
import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

const FEATURES = [
  {
    icon: <Route className="h-5 w-5" />,
    title: "A career plan that persists",
    description:
      "Generates a week-by-week roadmap toward your target role, stores it durably, and seeds trackable skill gaps automatically — no starting over when a cache expires.",
  },
  {
    icon: <FileText className="h-5 w-5" />,
    title: "Resumes, actually edited",
    description:
      '"Enhance with AI" rewrites the section you\'re on and replaces it in place — not a wall of generic suggestions left for you to copy in by hand.',
  },
  {
    icon: <Mic className="h-5 w-5" />,
    title: "A voice interview simulator",
    description:
      "A live voice call with an AI interviewer — real transcription, real-time responses, and structured feedback after each session.",
  },
  {
    icon: <BookOpen className="h-5 w-5" />,
    title: "Academy & skill tracking",
    description:
      "Structured learning paths with lessons and assignments feed a real mastery score per skill, visible across your plan, resume, and dashboard.",
  },
  {
    icon: <CalendarClock className="h-5 w-5" />,
    title: "Agents that take action",
    description:
      "Ask for a study session or interview prep block, and the scheduling agent creates the actual Google Calendar event — with your confirmation first.",
  },
  {
    icon: <Search className="h-5 w-5" />,
    title: "Automated job matching",
    description:
      "A search agent scores open roles against your target role and skill gaps, then tracks each one from first match through offer.",
  },
];

const PHASES = [
  {
    title: "Build your profile & plan",
    description:
      "Add your background and target role. The career agent maps the gaps between where you are and where you're headed.",
  },
  {
    title: "Practice and create",
    description:
      "Sharpen your resume, cover letter, and interview answers — including a full voice interview simulation — with feedback tied to your target role.",
  },
  {
    title: "Let the agents run it",
    description:
      "Approve an action once and the right agent executes it: a calendar event, a job search pass, or a scheduled study block.",
  },
];

const TOUR_HIGHLIGHTS = [
  {
    title: "Resume refinement",
    description:
      "In-place AI edits and ATS-aware feedback tied to a target role.",
  },
  {
    title: "Interview practice",
    description:
      "Timed simulations, including live voice, with structured feedback.",
  },
  {
    title: "Role targeting",
    description:
      "Skill-gap analysis mapped directly to your chosen target role.",
  },
  {
    title: "Action planning",
    description:
      "Agent-executed calendar events and job search, not just checklists.",
  },
];

// Section eyebrow + heading reveal — used directly on each header block so
// it fires independently of any parent stagger container.
const headerReveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.6, ease: EASE },
};

export default function Home() {
  const currentYear = new Date().getFullYear();
  const router = useRouter();

  const heroStagger = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const heroItem = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  };

  return (
    <div className="landing-scope font-landing-body flex min-h-screen flex-col bg-background text-foreground">
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden pt-16">
          <div className="absolute inset-0">
            <TopoCanvas />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
          </div>

          <div className="container relative z-10 mx-auto px-4 py-16 md:px-6 md:py-24">
            <motion.div
              className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16"
              initial="hidden"
              animate="visible"
              variants={heroStagger}
            >
              <motion.div className="space-y-7" variants={heroItem}>
                <div className="inline-flex items-center gap-2 rounded-sm border border-primary/30 bg-primary/5 px-3 py-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  <span className="font-mono-data text-[11px] uppercase tracking-[0.14em] text-primary">
                    System status — 5 agents online
                  </span>
                </div>

                <h1
                  className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl"
                  style={{ textWrap: "balance" }}
                >
                  Plan it once.
                  <br />
                  Let the agents run it.
                </h1>

                <p className="max-w-[54ch] text-lg leading-relaxed text-muted-foreground">
                  Elevate AI turns a career plan into calendar events,
                  applications, and interview practice. A supervisor reads each
                  request and dispatches it to the agent built for the job, so
                  nothing stalls in a to-do list.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    onClick={() => router.push("/dashboard")}
                    size="lg"
                    className="group gap-1.5"
                  >
                    Open Dashboard
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link href="#faq">Know More</Link>
                  </Button>
                </div>

                <div className="grid gap-2.5 pt-2 sm:grid-cols-2">
                  {[
                    "Durable plan — persists across sessions",
                    "Real calendar events, not suggestions",
                    "Job matches scored against your plan",
                  ].map((item, i) => (
                    <div
                      key={item}
                      className={`flex items-center gap-2 rounded-sm border bg-card/60 px-3 py-2 text-sm text-muted-foreground ${
                        i === 2 ? "sm:col-span-2" : ""
                      }`}
                    >
                      <CheckCircle className="h-3.5 w-3.5 shrink-0 text-primary" />
                      {item}
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div variants={heroItem}>
                <div className="rounded-md border bg-card/80 backdrop-blur-sm">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <span className="font-mono-data text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Agent routing
                    </span>
                    <span className="font-mono-data text-[11px] text-muted-foreground/70">
                      supervisor.dispatch()
                    </span>
                  </div>
                  <div className="h-[340px] p-2 sm:h-[380px]">
                    <AgentNetwork />
                  </div>
                  <p className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                    A supervisor reads each request and hands it to the agent
                    built for the job — career advice, scheduling, interview
                    prep, job search, or document edits.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 md:py-28">
          <div className="container mx-auto px-4 md:px-6">
            <motion.div className="mb-14 max-w-2xl" {...headerReveal}>
              <span className="font-mono-data text-[11px] uppercase tracking-[0.14em] text-primary">
                What&apos;s built
              </span>
              <h2
                className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl"
                style={{ textWrap: "balance" }}
              >
                Six tools, one shared model of your growth
              </h2>
              <p className="mt-3 text-muted-foreground">
                Every feature writes to the same profile, so a mastered skill
                shows up in your resume and a failed practice round shows up as
                a recommendation — nothing is siloed.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature, i) => (
                <FeatureCard
                  key={feature.title}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  index={i}
                />
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="border-y bg-card/30 py-20 md:py-28"
        >
          <div className="container mx-auto px-4 md:px-6">
            <motion.div className="mb-14 max-w-2xl" {...headerReveal}>
              <span className="font-mono-data text-[11px] uppercase tracking-[0.14em] text-primary">
                The flow
              </span>
              <h2
                className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl"
                style={{ textWrap: "balance" }}
              >
                Three phases, in order
              </h2>
            </motion.div>

            <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
              <div className="absolute left-0 right-0 top-6 hidden border-t border-dashed border-border md:block" />
              {PHASES.map((phase, i) => (
                <motion.div
                  key={phase.title}
                  className="relative space-y-3"
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.55, ease: EASE, delay: i * 0.12 }}
                >
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-md border bg-background">
                    <span className="font-mono-data text-sm font-semibold text-primary">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-semibold">
                    {phase.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {phase.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Product Tour */}
        <section id="product-tour" className="py-20 md:py-28">
          <div className="container mx-auto px-4 md:px-6">
            <motion.div className="mb-14 max-w-2xl" {...headerReveal}>
              <span className="font-mono-data text-[11px] uppercase tracking-[0.14em] text-primary">
                Walkthrough
              </span>
              <h2
                className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl"
                style={{ textWrap: "balance" }}
              >
                See the workflow end to end
              </h2>
              <p className="mt-3 text-muted-foreground">
                Resume review through interview practice to a plan you can
                actually execute.
              </p>
            </motion.div>

            <motion.div
              className="overflow-hidden rounded-md border bg-card"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <span className="font-mono-data text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Recording
                </span>
                <span className="font-mono-data text-[11px] text-muted-foreground/70">
                  elevate-ai-showcase.mp4
                </span>
              </div>
              <div className="flex items-center justify-center p-3">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-full w-full max-w-5xl rounded-sm"
                >
                  <source src="/elevate-ai-showcase.mp4" type="video/mp4" />
                </video>
              </div>
            </motion.div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TOUR_HIGHLIGHTS.map((item, i) => (
                <motion.div
                  key={item.title}
                  className="rounded-md border bg-card p-4 transition-colors hover:border-primary/40"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, ease: EASE, delay: i * 0.08 }}
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                >
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t bg-card/30 py-20 md:py-28">
          <div className="container mx-auto px-4 md:px-6">
            <motion.div className="mb-14 max-w-2xl" {...headerReveal}>
              <span className="font-mono-data text-[11px] uppercase tracking-[0.14em] text-primary">
                FAQ
              </span>
              <h2
                className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl"
                style={{ textWrap: "balance" }}
              >
                Questions people actually ask
              </h2>
            </motion.div>

            <motion.div
              className="mx-auto max-w-3xl"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.55, ease: EASE }}
            >
              <FaqAccordion />
            </motion.div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 md:py-28">
          <div className="container mx-auto px-4 md:px-6">
            <motion.div
              className="mx-auto max-w-3xl rounded-md border bg-card p-8 text-center md:p-12"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                <Target className="h-6 w-6" />
              </div>
              <h2
                className="font-display text-2xl font-semibold tracking-tight md:text-3xl"
                style={{ textWrap: "balance" }}
              >
                Ready to put a career agent to work?
              </h2>
              <p className="mx-auto mt-3 max-w-[46ch] text-muted-foreground">
                Free to use — no credit card, no paid tier, no catch.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link href="/sign-up">Create free account</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="#features">Explore the platform</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="container mx-auto px-4 py-12 md:px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2 font-display text-xl font-semibold">
                <span className="text-primary">Elevate</span>
                <span>AI</span>
              </div>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                A multi-agent system for the parts of a job search that usually
                stall — planning, practice, scheduling, and tracking.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 text-sm">
              <h3 className="mb-1 font-medium">Product</h3>
              <Link
                href="#features"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Features
              </Link>
              <Link
                href="#how-it-works"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                How it works
              </Link>
              <Link
                href="#product-tour"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Product tour
              </Link>
              <Link
                href="#faq"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                FAQ
              </Link>
            </div>
            <div className="flex flex-col gap-2.5 text-sm">
              <h3 className="mb-1 font-medium">Explore</h3>
              <Link
                href="/chatbot"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Career Plan
              </Link>
              <Link
                href="/resume"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Resume Builder
              </Link>
              <Link
                href="/interview"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Interview Prep
              </Link>
              <Link
                href="/jobs"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Job Search
              </Link>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t pt-6 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              © {currentYear} Elevate AI.
            </p>
            <p className="font-mono-data text-xs text-muted-foreground/70 flex items-center gap-1.5">
              <GitBranch className="h-3 w-3" />
              Next.js · LangGraph · self-hosted LLM
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
