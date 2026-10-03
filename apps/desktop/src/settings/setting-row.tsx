import { type ReactNode, useId } from "react";

import { ArrowUpRight, CaretRight, type Icon } from "@anlg/ui/components/icons";
import { Switch } from "@anlg/ui/components/ui/switch";
import { cn } from "@anlg/utils";

import { SettingsSectionTitle } from "~/settings/page-title";

export const SETTING_CONTROL_CLASS = "bg-card h-9 w-full shadow-none";

// Fork: one segmented control look for Theme, Plan billing period and
// Insights date range. Light: the selected segment is a white tile with a
// border-input edge on the bg-accent track (3.05:1 to the track, 3.46:1 to
// the tile: WCAG 2.2 SC 1.4.11), lighter than a black pill, as macOS
// segmented controls (Apple HIG, Segmented controls; redline3-oct3 S1).
// Dark keeps the solid pill (14.8:1). Every segment has a 1 px border so
// the selection never shifts the text.
export const SEGMENT_TRACK_CLASS = "bg-accent flex gap-1 rounded-lg p-1";
export const SEGMENT_BASE_CLASS = "border border-transparent";
// Fork: `!` on the dark colors: @anlg/ui's stylesheet loads later and
// also defines .text-foreground, which otherwise wins and draws white text on
// the white selected segment in dark mode (round 5 dark check).
export const SEGMENT_SELECTED_CLASS =
  "bg-card text-foreground border-input hover:bg-card hover:text-foreground dark:bg-foreground dark:text-background! dark:border-transparent! dark:hover:bg-foreground dark:hover:text-background!";
export const SEGMENT_IDLE_CLASS = "text-muted-foreground hover:text-foreground";
/** A note inside the selected segment, for example "save 21%". */
export const SEGMENT_SELECTED_NOTE_CLASS =
  "text-muted-foreground dark:text-background/70!";

// Fork: Settings rows sit in rounded cards with hairlines between them, as
// macOS System Settings and Granola's Settings do (Apple HIG, "Settings";
// granola-compare-oct3 section 8). The card is one surface step up from the
// panel (design-system "Contrast": raised is lighter): white on the warm
// canvas in light, as Granola's Settings (redline3-oct3 S1), and the 10%
// step on the 6% panel in dark. Switches need no override here: the shared
// off track meets 3:1 on the card.
export function SettingsCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-settings-card
      className={cn([
        "border-border bg-card dark:bg-muted divide-border flex min-w-0 flex-col divide-y rounded-xl border",
        "[&>*]:px-4 [&>*]:py-3.5",
        className,
      ])}
    >
      {children}
    </div>
  );
}

// A group title above a card (sentence case, a real heading, not an
// eyebrow on one element) and the card itself.
export function SettingsGroup({
  id,
  title,
  action,
  footer,
  children,
  className,
}: {
  /** An anchor for links that open this group (settings/sections.ts). */
  id?: string;
  title?: ReactNode;
  action?: ReactNode;
  /** A small muted note under the card, as macOS grouped-form footers. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();

  return (
    <section
      id={id}
      aria-labelledby={title ? titleId : undefined}
      className={cn(["flex min-w-0 scroll-mt-6 flex-col gap-2", className])}
    >
      {title || action ? (
        <div className="flex min-h-6 items-center justify-between gap-3 px-1">
          {title ? (
            <SettingsSectionTitle id={titleId}>{title}</SettingsSectionTitle>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      <SettingsCard>{children}</SettingsCard>
      {footer ? (
        <p className="text-muted-foreground px-1 text-xs">{footer}</p>
      ) : null}
    </section>
  );
}

export function SettingIconTile({ icon: IconComponent }: { icon: Icon }) {
  return (
    <span
      aria-hidden
      data-testid="setting-icon"
      className="border-border bg-card flex size-8 shrink-0 items-center justify-center rounded-lg border"
    >
      <IconComponent className="text-muted-foreground size-4" />
    </span>
  );
}

export function SettingRow({
  title,
  description,
  icon,
  controlWidth = "fixed",
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: Icon;
  controlWidth?: "fixed" | "content";
  children: (labelProps: {
    "aria-labelledby": string;
    "aria-describedby": string | undefined;
  }) => ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {icon ? <SettingIconTile icon={icon} /> : null}
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-sm font-medium">
            {title}
          </h3>
          {description && (
            <p
              id={descriptionId}
              className="text-muted-foreground mt-0.5 text-xs"
            >
              {description}
            </p>
          )}
        </div>
      </div>
      <div
        className={cn([
          "flex justify-end",
          controlWidth === "fixed" && "w-48 max-w-full min-w-0",
          controlWidth !== "fixed" && "shrink-0",
        ])}
      >
        {children({
          "aria-labelledby": titleId,
          "aria-describedby": description ? descriptionId : undefined,
        })}
      </div>
    </div>
  );
}

export function SettingSwitchRow({
  title,
  description,
  icon,
  checked,
  onChange,
  disabled = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: Icon;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <SettingRow
      title={title}
      description={description}
      icon={icon}
      controlWidth="content"
    >
      {(labelProps) => (
        <Switch
          {...labelProps}
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
        />
      )}
    </SettingRow>
  );
}

// A row that opens another page: icon, title, description, a value and a
// chevron, as Granola's Connectors list and macOS System Settings rows.
export function SettingLinkRow({
  icon,
  title,
  description,
  value,
  external = false,
  onClick,
}: {
  icon: Icon;
  title: ReactNode;
  description?: ReactNode;
  value?: ReactNode;
  external?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn([
        "flex w-full min-w-0 items-center gap-3 text-left transition-colors",
        "hover:bg-accent focus-visible:bg-accent focus-visible:outline-hidden",
        "first:rounded-t-xl last:rounded-b-xl",
      ])}
    >
      <SettingIconTile icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        {description ? (
          <span className="text-muted-foreground mt-0.5 block text-xs">
            {description}
          </span>
        ) : null}
      </span>
      {value ? (
        <span className="text-muted-foreground shrink-0 text-xs">{value}</span>
      ) : null}
      {external ? (
        <ArrowUpRight
          aria-hidden
          className="text-muted-foreground size-4 shrink-0"
        />
      ) : (
        <CaretRight
          aria-hidden
          className="text-muted-foreground size-4 shrink-0"
        />
      )}
    </button>
  );
}
