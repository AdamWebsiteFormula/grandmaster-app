import type { ReactNode } from "react";

// Fork: medium weight with a slight negative track, as Granola's page titles
// (redline-oct3 Settings).
const PAGE_TITLE_CLASS = "text-xl leading-tight font-medium tracking-[-0.02em]";

export function SettingsPageTitle({
  title,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
}) {
  if (!description) {
    return <h2 className={PAGE_TITLE_CLASS}>{title}</h2>;
  }
  return (
    <div className="flex flex-col gap-1">
      <h2 className={PAGE_TITLE_CLASS}>{title}</h2>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

// Fork: one heading for every section inside a Settings page, so section
// sizes stop varying between tabs (ux-audit-oct3 E, NN/g #4). It is the small
// muted title above a card group, as in macOS System Settings and Granola
// (granola-compare-oct3 section 8): sentence case, a real heading, never an
// all-caps eyebrow.
export function SettingsSectionTitle({
  children,
  id,
  className,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <h3
      id={id}
      className={["text-muted-foreground text-sm font-medium", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </h3>
  );
}
