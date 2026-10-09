import { cn } from "@anlg/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn([
        "pointer-events-none inline-flex h-5 w-fit min-w-5 shrink-0 items-center justify-center gap-1 rounded px-1 font-mono text-xs leading-none font-medium whitespace-nowrap select-none",
        // Fork: in dark the keycap is one step lighter than its surface, so
        // it reads as a key in both themes (picture review, Oct 9; Apple
        // HIG, Dark Mode).
        "border-border bg-muted text-muted-foreground dark:bg-foreground/10 border",
        "shadow-[0_1px_0_0_var(--kbd-shadow-outer),inset_0_1px_0_0_var(--kbd-shadow-inset)]",
        "[&_svg:not([class*='size-'])]:size-3",
        className,
      ])}
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="kbd-group"
      className={cn(["inline-flex items-center gap-0.5", className])}
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
