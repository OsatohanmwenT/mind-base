import type { ReactNode } from "react";
import Link from "next/link";
import { Lock, Search, Sparkles } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";

const VALUE_PROPS = [
  {
    icon: Lock,
    title: "Private by default",
    description: "Your notes live in a personal vault, fully isolated.",
  },
  {
    icon: Search,
    title: "Search by meaning",
    description: "Describe what you need — no exact keywords required.",
  },
  {
    icon: Sparkles,
    title: "AI-organized",
    description: "Generate titles, summaries, and tags from your notes.",
  },
];

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <header className="flex items-center justify-between px-6 py-5 lg:hidden">
        <Link
          href="/"
          className="font-[family:var(--font-heading)] text-lg font-semibold"
        >
          MindBase
        </Link>
        <ModeToggle />
      </header>

      <aside className="hidden border-r border-border bg-muted/50 lg:flex lg:w-[480px] lg:shrink-0 lg:flex-col lg:justify-between lg:p-12 xl:p-14">
        <div>
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="font-[family:var(--font-heading)] text-lg font-semibold"
            >
              MindBase
            </Link>
            <ModeToggle />
          </div>

          <div className="mt-20 max-w-sm">
            <h2 className="font-[family:var(--font-heading)] text-3xl font-semibold leading-snug text-balance">
              Your second brain for code, ideas, and context.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty">
              A private note vault for engineers. Capture thinking quickly, let
              AI organize it, and find anything later — by meaning, not
              keywords.
            </p>
          </div>
        </div>

        <div className="max-w-sm space-y-5">
          {VALUE_PROPS.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex items-start gap-3.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                <Icon className="size-3.5 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-12 lg:px-16 lg:py-0">
        {children}
      </main>
    </div>
  );
}
