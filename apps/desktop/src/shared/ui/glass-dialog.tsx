import type { ComponentProps } from "react";

import { Button } from "@anlg/ui/components/ui/button";
import { DialogContent } from "@anlg/ui/components/ui/dialog";
import { cn } from "@anlg/utils";

// Fork: an opaque, raised sheet. In dark mode raised surfaces are lighter
// (developer.apple.com/design/human-interface-guidelines/dark-mode; Material
// dark theme gives a 24 dp dialog a 16% white overlay,
// m2.material.io/design/color/dark-theme.html), so the surface is 16% gray
// on the black app with 15% white hairlines. The overlay dims the window
// (HIG sheets). Field borders inside use 46% gray: 3.2:1 on the dark
// surface and 4.6:1 on white, over the 3:1 of WCAG 2.2 SC 1.4.11.
export function GlassDialogContent({
  className,
  ...props
}: ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      overlayClassName="bg-black/60"
      // Fork: the dark 16% surface is marked important, because the ui
      // stylesheet's .bg-popover loads later and would win (design-system.md
      // Dialogs and Build notes).
      className={cn([
        "w-[calc(100vw-48px)] max-w-[320px] gap-4 overflow-hidden rounded-[26px] p-5 sm:rounded-[26px]",
        "bg-popover dark:bg-[hsl(0_0%_16%)]! dark:[--color-border:hsl(0_0%_100%/0.15)]",
        "border-border [--color-input:hsl(0_0%_46%)]",
        "shadow-[0_24px_70px_rgba(0,0,0,0.32)] dark:shadow-none",
        "[&>button:last-child]:hidden",
        className,
      ])}
      {...props}
    />
  );
}

export function GlassDialogCancelButton({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn([
        "border-border/70 bg-background/50 text-foreground h-8 rounded-full border px-4 text-xs font-medium shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
        "hover:bg-background/80 hover:text-foreground",
        className,
      ])}
      {...props}
    />
  );
}
