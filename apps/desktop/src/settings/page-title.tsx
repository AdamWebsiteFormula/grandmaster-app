import type { ReactNode } from "react";

export function SettingsPageTitle({ title }: { title: ReactNode }) {
  return (
    <h2 className="text-2xl leading-tight font-semibold">
      {title}
    </h2>
  );
}
