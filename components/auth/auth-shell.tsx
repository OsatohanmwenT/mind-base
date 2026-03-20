import type { ReactNode } from "react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <section className="w-full max-w-md">
      <div className="rounded-[28px] border border-border/70 bg-background/85 p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-8">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        <div className="mt-8">{children}</div>
      </div>
      {footer ? (
        <div className="mt-5 text-center text-sm text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
