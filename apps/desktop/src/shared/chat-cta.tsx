import { useLingui } from "@lingui/react/macro";
import type { ReactNode } from "react";

import { Kbd } from "@anlg/ui/components/ui/kbd";
import { cn } from "@anlg/utils";

import { useShell } from "~/contexts/shell";
import { ariaKeyShortcut, kbdLabel } from "~/shared/shortcut-label";

export function ChatCTA({
  label,
  ariaLabel,
}: {
  label?: ReactNode;
  ariaLabel?: string;
}) {
  const { t } = useLingui();
  const { chat } = useShell();
  const isChatOpen = chat.mode !== "FloatingClosed";
  const resolvedLabel = label ?? t`Ask anything`;

  const handleClick = () => {
    chat.sendEvent({ type: "OPEN" });
  };

  if (isChatOpen) {
    return null;
  }

  return (
    <button
      type="button"
      data-chat-cta-trigger
      // Fork: the accessible name is the visible label ("Ask anything") and the
      // ⌘J shortcut is announced (ux-audit-oct3 D, WCAG 2.5.3; NN/g #6),
      // as Ctrl+J off a Mac (Microsoft Writing Style Guide, Keys and
      // keyboard shortcuts).
      aria-label={ariaLabel}
      aria-keyshortcuts={ariaKeyShortcut(["mod", "J"])}
      onClick={handleClick}
      className="group/anarlog-chat-cta relative h-10 w-[196px] max-w-full cursor-text focus-visible:outline-none"
    >
      <span
        data-chat-cta-surface
        aria-hidden="true"
        className={cn([
          // Fork: always labeled (Granola-style "Ask anything"), grows on hover.
          "rounded-pill border-input bg-popover pointer-events-none absolute bottom-0 left-1/2 inline-flex h-9 w-[196px] -translate-x-1/2 items-center overflow-hidden border px-4 text-sm",
          // Fork: flat, no drop shadow (design-system Shape and space).
          "origin-bottom transition-[width,height,background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "group-hover/anarlog-chat-cta:bg-card group-focus-visible/anarlog-chat-cta:bg-card",
          "group-hover/anarlog-chat-cta:h-10 group-hover/anarlog-chat-cta:w-[min(640px,calc(100cqw_-_2rem))]",
          "group-focus-visible/anarlog-chat-cta:h-10 group-focus-visible/anarlog-chat-cta:w-[min(640px,calc(100cqw_-_2rem))]",
          "group-focus-visible/anarlog-chat-cta:ring-ring group-focus-visible/anarlog-chat-cta:ring-2 group-focus-visible/anarlog-chat-cta:ring-offset-2",
        ])}
      >
        <span
          aria-hidden="true"
          className={cn([
            "text-muted-foreground min-w-0 flex-1 truncate text-left",
          ])}
        >
          {resolvedLabel}
        </span>
        <Kbd className="ml-2 shrink-0">{kbdLabel(["mod", "J"])}</Kbd>
      </span>
      <span className="sr-only">{resolvedLabel}</span>
    </button>
  );
}

export function FloatingChatCTA({ label }: { label?: ReactNode }) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex h-10 w-[196px] max-w-[calc(100%-2rem)] -translate-x-1/2 items-end justify-center pb-0">
      <div className="pointer-events-auto max-w-full">
        <ChatCTA label={label} />
      </div>
    </div>
  );
}
