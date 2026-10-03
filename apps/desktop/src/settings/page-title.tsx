import type { ReactNode } from "react";

export function SettingsPageTitle({ title }: { title: ReactNode }) {
  return <h2 className="text-xl leading-tight font-semibold">{title}</h2>;
}

// Fork: one heading for every section inside a Settings page, so section
// sizes stop varying between tabs (ux-audit-oct3 E, NN/g #4).
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
      className={["text-base font-semibold", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </h3>
  );
}
