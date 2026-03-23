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
      <p className="text-xs font-medium uppercase text-muted-foreground">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-balance">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
        {description}
      </p>
      <div className="mt-8">{children}</div>
      {footer ? (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
