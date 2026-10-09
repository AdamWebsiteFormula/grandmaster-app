import { type ReactNode, useId } from "react";

import { ArrowUpRight, CaretRight, type Icon } from "@anlg/ui/components/icons";
import { Switch } from "@anlg/ui/components/ui/switch";
import { cn } from "@anlg/utils";

import { SettingsSectionTitle } from "~/settings/page-title";

// Fork: in dark, text fields and dropdowns take the outline button's light
// tint, so every Settings control has one fill and sits raised on the card
// (Apple HIG, Dark Mode: raised is lighter; shadcn/ui's input uses
// dark:bg-input/30; NN/g #4). Light keeps bg-card.
// Fork: 32 pt, the same height as the buttons beside them, so a row of
// controls lines up (backlog item 4: selects were 36 pt, buttons 32 pt;
// Apple HIG, Layout: consistent control sizes in a group).
export const SETTING_CONTROL_CLASS =
  "bg-card dark:bg-input/30 h-8 w-full shadow-none";

// Fork: one segmented control look for Theme, Plan billing period and
// Insights date range. Light: the selected segment is a white tile with a
// border-input edge on the bg-accent track (3.05:1 to the track, 3.46:1 to
// the tile: WCAG 2.2 SC 1.4.11), lighter than a black pill, as macOS
// segmented controls (Apple HIG, Segmented controls; redline3-oct3 S1).
// Dark keeps the solid pill (14.8:1). Every segment has a 1 px border so
// the selection never shifts the text.
// Fork: a 2 pt inset and 28 pt segments make the control 32 pt, like
// every other Settings control (picture review, Oct 6: 38 and 36 pt; Apple
// HIG, Segmented controls).
// The light track is the sidebar's selection gray, so the control reads as
// one object on the panel (picture review, Oct 7: bg-accent measured 1.05:1
// on the light panel; Apple HIG, Segmented controls); dark uses 17% gray for
// the same reason (Oct 8: 13% measured 1.09:1 on a dark card). Segments
// are equal width, as Apple's segmented controls are (picture review,
// Oct 8: 55, 53 and 121 pt).
export const SEGMENT_TRACK_CLASS =
  "bg-sidebar-accent grid auto-cols-fr grid-flow-col gap-0.5 rounded-lg p-0.5 dark:bg-[hsl(0_0%_17%)]";
export const SEGMENT_BASE_CLASS = "border border-transparent";
// Fork: `!` on the dark colors: @anlg/ui's stylesheet loads later and
// also defines .text-foreground, which otherwise wins and draws white text on
// the white selected segment in dark mode (round 5 dark check).
// Fork: in dark the selected segment is the sidebar's gray selection fill,
// as macOS draws a selected segment, not a white pill that outshines the
// page's one orange action (Apple HIG Segmented controls, Dark Mode; NN/g
// Visual hierarchy). The field border marks it, as in light: the fill alone
// measured 1.22:1 on its track, the border 3.02:1 (WCAG 2.2 SC 1.4.11).
export const SEGMENT_SELECTED_CLASS =
  "bg-card text-foreground border-input hover:bg-card hover:text-foreground dark:bg-[hsl(0_0%_24%)] dark:text-foreground! dark:border-input! dark:hover:bg-[hsl(0_0%_24%)] dark:hover:text-foreground!";
export const SEGMENT_IDLE_CLASS = "text-muted-foreground hover:text-foreground";
/** A note inside the selected segment, for example "save 21%". */
export const SEGMENT_SELECTED_NOTE_CLASS =
  "text-muted-foreground dark:text-foreground/80!";

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
        "border-border bg-card dark:bg-muted flex min-w-0 flex-col rounded-xl border",
        "[&>*]:px-4 [&>*]:py-3.5",
        // Fork: row dividers stop 16 pt short of the card's edges, as in
        // macOS System Settings' grouped forms, instead of running into the
        // rounded border (picture review, Oct 9; Apple HIG, Lists and
        // tables).
        "[&>*+*]:relative [&>*+*]:before:pointer-events-none [&>*+*]:before:absolute [&>*+*]:before:inset-x-4 [&>*+*]:before:top-0 [&>*+*]:before:h-px [&>*+*]:before:bg-border [&>*+*]:before:content-['']",
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
        // Fork: the section label starts on the card's left edge, the same
        // line as the page title (backlog item 6: it sat 4 pt in; Apple HIG,
        // Layout: align to one edge).
        <div className="flex min-h-6 items-center justify-between gap-3">
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
        <p className="text-muted-foreground text-xs">{footer}</p>
      ) : null}
    </section>
  );
}

export function SettingIconTile({
  icon: IconComponent,
  dimmed,
}: {
  icon: Icon;
  dimmed?: boolean;
}) {
  return (
    <span
      aria-hidden
      data-testid="setting-icon"
      className={cn([
        // Fork: flush with the card in both themes; in dark the 6% card
        // color read as sunken on the 10% card (picture review, Oct 9;
        // Apple HIG, Dark Mode).
        "border-border bg-card flex size-8 shrink-0 items-center justify-center rounded-lg border dark:bg-transparent",
        // Fork: a disabled row's icon dims with its title, as macOS dims
        // a whole unavailable control (picture review, Oct 8; Apple HIG,
        // Color).
        dimmed && "opacity-50",
      ])}
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
  disabled = false,
  stacked = false,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: Icon;
  controlWidth?: "fixed" | "content";
  /** The row's control is unavailable: the title dims to muted text. */
  disabled?: boolean;
  /** Label above a full-width control, for narrow places like popovers. */
  stacked?: boolean;
  children: (labelProps: {
    "aria-labelledby": string;
    "aria-describedby": string | undefined;
  }) => ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <div
      className={cn([
        "flex w-full min-w-0 justify-between",
        // Fork: in a narrow popover the label sits above a full-width
        // control instead of being squeezed beside a 192 px one (owner
        // test, Oct 4; Apple HIG, Popovers: keep content compact).
        stacked ? "flex-col gap-3" : "items-center gap-4",
      ])}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {icon ? <SettingIconTile icon={icon} dimmed={disabled} /> : null}
        <div className="min-w-0 flex-1">
          {/* Fork: a disabled row's title uses the muted text color, as
              macOS dims an unavailable control's label (Apple HIG, Color);
              muted text still meets 4.5:1. The description says why. */}
          <h3
            id={titleId}
            className={cn([
              "text-sm font-medium",
              disabled && "text-muted-foreground",
            ])}
          >
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
          stacked && "w-full min-w-0",
          !stacked && controlWidth === "fixed" && "w-48 max-w-full min-w-0",
          !stacked && controlWidth !== "fixed" && "shrink-0",
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
      disabled={disabled}
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
        // Fork: a visible focus ring, not just a fill (WCAG 2.2 SC 2.4.7).
        "hover:bg-accent focus-visible:bg-accent focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
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
      {/* Fork: the drawn chevron or arrow, not its 16 px box, ends on the
          trailing edge that switches and selects use, as in System Settings
          (picture review, Oct 6: 5 pt short). */}
      {external ? (
        <ArrowUpRight
          aria-hidden
          className="text-muted-foreground -mr-1 size-4 shrink-0"
        />
      ) : (
        <CaretRight
          aria-hidden
          className="text-muted-foreground -mr-[5px] size-4 shrink-0"
        />
      )}
    </button>
  );
}
