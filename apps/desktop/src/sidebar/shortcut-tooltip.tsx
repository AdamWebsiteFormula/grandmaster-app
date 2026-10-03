import type { ReactNode } from "react";

import { Kbd } from "@anlg/ui/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@anlg/ui/components/ui/tooltip";

// Fork: shortcuts live in a hover tooltip, not a chip on every row
// (redline-oct3; Granola's sidebar rows carry no key chips, and Apple HIG
// "Offering help" puts shortcut hints in help tags). Its own provider, so the
// row also works outside the app shell.
export function ShortcutTooltip({
  label,
  keys,
  children,
}: {
  label: string;
  keys: string;
  children: ReactNode;
}) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side="right"
          className="flex items-center gap-2 text-xs"
        >
          <span>{label}</span>
          <Kbd>{keys}</Kbd>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
