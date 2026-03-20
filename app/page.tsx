"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Search,
  Lock,
  Zap,
  ImageIcon,
  Sun,
  Menu,
  X,
  ArrowRight,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/mode-toggle";

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.12 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

const scrollTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};

/* ─── Navbar ─── */
function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handle = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handle, { passive: true });
    return () => window.removeEventListener("scroll", handle);
  }, []);

  const navAction = (id: string) => {
    setMobileOpen(false);
    scrollTo(id);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border shadow-[0_1px_2px_0_rgba(0,0,0,0.03)]"
          : "bg-transparent"
        }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="font-[family:var(--font-heading)] text-xl font-bold tracking-tight"
        >
          MindBase
        </Button>

        <div className="hidden md:flex items-center gap-8">
          {(["features", "about", "contact"] as const).map((id) => (
            <Button
              key={id}
              variant="ghost"
              size="sm"
              onClick={() => navAction(id)}
              className="text-[13px] text-muted-foreground hover:text-foreground font-mono tracking-[0.08em] uppercase"
            >
              {id}
            </Button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <ModeToggle />
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="text-sm font-medium"
          >
            <Link href="/auth/sign-in">Log in</Link>
          </Button>
          <Button asChild size="sm" className="text-sm font-medium">
            <Link href="/auth/sign-up">Sign up</Link>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-muted-foreground"
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border px-6 pb-6 pt-2 space-y-4">
          {(["features", "about", "contact"] as const).map((id) => (
            <Button
              key={id}
              variant="ghost"
              size="sm"
              onClick={() => navAction(id)}
              className="w-full justify-start text-sm text-muted-foreground hover:text-foreground font-mono uppercase tracking-wider"
            >
              {id}
            </Button>
          ))}
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <Button asChild variant="secondary" size="sm">
              <Link href="/auth/sign-in">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/auth/sign-up">Sign up</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ─── Hero ─── */
function Hero() {
  const { ref, isVisible } = useReveal();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          color: "var(--muted-foreground)",
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 45%, oklch(0.55 0.08 185 / 0.10) 0%, transparent 100%)",
        }}
      />

      <div
        ref={ref}
        className={`relative z-10 max-w-3xl mx-auto px-6 text-center transition-all duration-1000 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          }`}
      >
        <p className="font-mono text-xs tracking-[0.25em] uppercase text-muted-foreground mb-8">
          Private AI-powered note vault
        </p>

        <h1
          className="font-[family:var(--font-heading)] text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6"
        >
          A second brain,
          <br />
          built for engineers.
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          MindBase is an AI-powered note vault for engineers. Capture ideas
          fast, let AI organize them, and find anything later by
          meaning&mdash;not keywords.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="px-8 h-12 text-base font-medium">
            <Link href="/auth/sign-up">
              Get started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="link"
            onClick={() => scrollTo("features")}
            className="text-sm text-muted-foreground hover:text-foreground decoration-muted-foreground/30"
          >
            See how it works
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ─── About ─── */
function AboutSection() {
  const { ref, isVisible } = useReveal();

  return (
    <section id="about" className="py-20 md:py-28 border-t border-border">
      <div
        ref={ref}
        className={`max-w-3xl mx-auto px-6 text-center transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
      >
        <p className="font-mono text-xs tracking-[0.25em] uppercase text-muted-foreground mb-6">
          Why MindBase
        </p>
        <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed">
          Engineers accumulate context across docs, tabs, chats, and
          half-finished ideas. Traditional note apps are good at storage but
          weak at recall.{" "}
          <span className="text-foreground font-medium">
            MindBase reduces that friction
          </span>{" "}
          by making notes easy to capture, intelligently organized, and
          meaningfully searchable.
        </p>
      </div>
    </section>
  );
}

/* ─── Feature Section (reusable) ─── */
function FeatureSection({
  id,
  number,
  label,
  heading,
  description,
  visual,
  reverse = false,
}: {
  id?: string;
  number: string;
  label: string;
  heading: string;
  description: string;
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  const { ref, isVisible } = useReveal();

  return (
    <section id={id} className="py-20 md:py-28">
      <div
        ref={ref}
        className={`max-w-6xl mx-auto px-6 transition-all duration-700 delay-100 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
      >
        <div
          className={`grid md:grid-cols-2 gap-12 md:gap-20 items-center ${reverse ? "direction-rtl" : ""
            }`}
          style={reverse ? { direction: "rtl" } : undefined}
        >
          <div style={reverse ? { direction: "ltr" } : undefined}>
            <p className="font-mono text-xs tracking-[0.25em] uppercase text-muted-foreground mb-4">
              {number}&ensp;/&ensp;{label}
            </p>
            <h2
              className="font-[family:var(--font-heading)] text-3xl md:text-4xl font-bold tracking-tight mb-4 leading-tight"
            >
              {heading}
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              {description}
            </p>
          </div>
          <div style={reverse ? { direction: "ltr" } : undefined}>
            {visual}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Visual: AI Organize ─── */
function AIOrganizeVisual() {
  return (
    <div className="space-y-4">
      <div className="border border-border rounded-lg p-5 bg-card/60">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-muted-foreground/60" />
          <span className="font-mono text-xs text-muted-foreground">
            Untitled note
          </span>
        </div>
        <p className="text-sm text-muted-foreground/60 leading-relaxed font-mono">
          redis vs memcached for session cache, need to think about eviction
          policies, maybe use redis cluster for HA, check latency benchmarks...
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 text-foreground py-1">
        <Sparkles className="h-4 w-4" />
        <span className="font-mono text-[11px] tracking-wider uppercase">
          Auto-organize
        </span>
      </div>

      <div className="border border-primary/20 rounded-lg p-5 bg-card/60 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-4 w-4 text-foreground" />
          <span className="text-sm font-semibold">
            Architecture: Redis Caching Strategy
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          Comparison of Redis vs Memcached for session caching with focus on
          eviction policies and high-availability clustering.
        </p>
        <div className="flex gap-2 flex-wrap">
          {["redis", "caching", "architecture", "infrastructure"].map(
            (tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-muted text-muted-foreground border border-border"
              >
                {tag}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Visual: Semantic Search ─── */
function SearchVisual() {
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card/60 shadow-lg shadow-black/5 dark:shadow-black/20">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-foreground flex-1">
          that caching architecture decision
        </span>
        <kbd className="text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5 bg-background/50">
          ESC
        </kbd>
      </div>

      <div className="divide-y divide-border">
        <div className="px-4 py-3 bg-muted/50 border-l-2 border-primary">
          <p className="text-sm font-medium mb-0.5">
            Architecture: Redis Caching Strategy
          </p>
          <p className="text-xs text-muted-foreground">
            Comparison of Redis vs Memcached for session caching...
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm font-medium mb-0.5">
            Cache Invalidation Patterns
          </p>
          <p className="text-xs text-muted-foreground">
            Notes on write-through, write-behind, and TTL-based...
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm font-medium mb-0.5">
            Performance Benchmarks Q3
          </p>
          <p className="text-xs text-muted-foreground">
            Latency results for Redis cluster vs single node...
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Visual: Privacy Grid ─── */
function PrivacyVisual() {
  const items = [
    {
      icon: Lock,
      label: "Per-user isolation",
      desc: "Your data is yours alone",
    },
    { icon: Zap, label: "Autosave", desc: "Never lose an edit" },
    {
      icon: ImageIcon,
      label: "Image attachments",
      desc: "Up to 10 per note",
    },
    {
      icon: Sun,
      label: "Light & dark mode",
      desc: "Your preference, always",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(({ icon: Icon, label, desc }) => (
        <div
          key={label}
          className="border border-border rounded-lg p-4 bg-card/60 hover:border-foreground/20 transition-colors"
        >
          <Icon className="h-5 w-5 text-foreground mb-2.5" />
          <p className="text-sm font-medium mb-0.5">{label}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Contact ─── */
function ContactSection() {
  const { ref, isVisible } = useReveal();
  const [submitted, setSubmitted] = useState(false);

  return (
    <section id="contact" className="py-20 md:py-28 border-t border-border">
      <div
        ref={ref}
        className={`max-w-xl mx-auto px-6 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
      >
        <div className="text-center mb-10">
          <p className="font-mono text-xs tracking-[0.25em] uppercase text-muted-foreground mb-4">
            Get in touch
          </p>
          <h2
            className="font-[family:var(--font-heading)] text-3xl md:text-4xl font-bold tracking-tight mb-3"
          >
            Questions? Let&rsquo;s talk.
          </h2>
          <p className="text-muted-foreground">
            MindBase is early and evolving. If you have feedback or just want to
            say hello, we&rsquo;d love to hear from you.
          </p>
        </div>

        {submitted ? (
          <div className="text-center py-14 border border-primary/20 rounded-lg bg-muted/50">
            <Sparkles className="h-6 w-6 text-foreground mx-auto mb-3" />
            <p className="font-medium">Message sent. We&rsquo;ll be in touch.</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
            className="space-y-5"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Name
                </Label>
                <Input id="name" placeholder="Your name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="message" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Message
              </Label>
              <Textarea
                id="message"
                placeholder="What's on your mind?"
                rows={5}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 font-medium"
            >
              Send message
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <span className="font-[family:var(--font-heading)] text-lg font-bold">
              MindBase
            </span>
            <p className="text-sm text-muted-foreground mt-1">
              A private second brain for engineers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {(["features", "about", "contact"] as const).map((id) => (
              <Button
                key={id}
                variant="link"
                onClick={() => scrollTo(id)}
                className="text-sm text-muted-foreground hover:text-foreground p-0 h-auto capitalize"
              >
                {id}
              </Button>
            ))}
            <span className="hidden sm:inline text-border">|</span>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms
            </a>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} MindBase. All rights reserved.
          </p>
          <span className="text-xs text-muted-foreground font-mono tracking-wide">
            Built for engineers who think in text.
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ─── */
export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <AboutSection />

      <div id="features">
        <FeatureSection
          number="01"
          label="ORGANIZE"
          heading="Write messy. Let AI clean up."
          description="Dump your raw thinking and let AI generate a better title, a short summary, and relevant tags. Your words stay untouched — your notes get structured."
          visual={<AIOrganizeVisual />}
        />
      </div>

      <FeatureSection
        number="02"
        label="SEARCH"
        heading="Cmd+K and describe what you need."
        description="Forget exact keywords. MindBase uses semantic search to match notes by meaning. Describe what you're looking for in plain language and get results that actually make sense."
        visual={<SearchVisual />}
        reverse
      />

      <FeatureSection
        number="03"
        label="PRIVATE"
        heading="Your vault. Your rules."
        description="MindBase is a personal vault, not a social platform. Per-user data isolation, autosave, image attachments, and a clean interface — built for how engineers actually work."
        visual={<PrivacyVisual />}
      />

      <ContactSection />
      <Footer />
    </main>
  );
}
