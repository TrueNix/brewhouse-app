import type { ReactNode } from "react";

interface ViewShellProps {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/** Consistent header + scroll container shared by every view. */
export function ViewShell({ eyebrow, title, subtitle, actions, children }: ViewShellProps) {
  return (
    <section className="view">
      <header className="topbar" data-tauri-drag-region>
        <div className="topbar__titles">
          {eyebrow && <div className="topbar__eyebrow">{eyebrow}</div>}
          <h1 className="topbar__title">{title}</h1>
          {subtitle && <p className="topbar__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="topbar__actions">{actions}</div>}
      </header>
      <div className="content">{children}</div>
    </section>
  );
}
