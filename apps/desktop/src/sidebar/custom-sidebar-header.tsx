import { useLingui } from "@lingui/react/macro";
import { type ReactNode, useCallback, useState } from "react";
import { createPortal } from "react-dom";

import { ArrowLeft } from "@anlg/ui/components/icons";
import { useMountEffect } from "@anlg/ui/hooks/use-mount-effect";
import { cn } from "@anlg/utils";

import { useShell } from "~/contexts/shell";
import {
  usesWindowsStyleTitleBar,
  useWindowControlsGutter,
  WINDOW_CONTROLS_GUTTER_CLASS,
  WINDOW_CONTROLS_ROW_PADDING_TOP_CLASS,
} from "~/shared/hooks/useWindowControlsGutter";
import { leaveOverlayTab } from "~/shared/leave-overlay-tab";
import { useTabs } from "~/store/zustand/tabs";

export const TITLE_BAR_SIDEBAR_ACTIONS_SLOT_ID = "title-bar-sidebar-actions";

export function useCustomSidebarBack() {
  const { chat } = useShell();
  const currentTab = useTabs((state) => state.currentTab);

  return useCallback(() => {
    if (currentTab?.type !== "automations" && chat.mode !== "FloatingClosed") {
      chat.sendEvent({ type: "CLOSE" });
      return;
    }

    leaveOverlayTab();
  }, [chat, currentTab]);
}

export function CustomSidebarHeader({ children }: { children?: ReactNode }) {
  if (usesWindowsStyleTitleBar()) {
    return <TitleBarSidebarActions>{children}</TitleBarSidebarActions>;
  }

  return <InlineCustomSidebarHeader>{children}</InlineCustomSidebarHeader>;
}

function TitleBarSidebarActions({ children }: { children?: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useMountEffect(() => {
    setSlot(document.getElementById(TITLE_BAR_SIDEBAR_ACTIONS_SLOT_ID));
  });

  if (!children || !slot) {
    return null;
  }

  return createPortal(children, slot);
}

function InlineCustomSidebarHeader({ children }: { children?: ReactNode }) {
  const { t } = useLingui();
  const showWindowControlsGutter = useWindowControlsGutter();
  const handleBack = useCustomSidebarBack();

  return (
    <div
      data-tauri-drag-region
      className={cn([
        "flex h-12 shrink-0 items-start py-0 pr-1",
        showWindowControlsGutter
          ? [
              WINDOW_CONTROLS_GUTTER_CLASS,
              WINDOW_CONTROLS_ROW_PADDING_TOP_CLASS,
            ]
          : "pt-[9px] pl-2",
      ])}
    >
      <div
        data-tauri-drag-region
        className="flex min-w-0 flex-1 items-center gap-1"
      >
        {/* Fork: the name says what it does, it goes back (ux-audit-oct3 B,
            WCAG 4.1.2). The word shows next to the arrow, since an arrow
            alone was easy to miss on Settings and Templates (owner test,
            Oct 4; NN/g, "Icon Usability": label icons with text; Linear's
            Settings has "Back to app"). */}
        <CustomSidebarHeaderButton
          label={t`Back`}
          title={t`Back`}
          onClick={handleBack}
        >
          <ArrowLeft size={16} />
          <span className="text-sm">{t`Back`}</span>
        </CustomSidebarHeaderButton>
      </div>
      {children ? (
        <div
          data-tauri-drag-region="false"
          className="ml-1 flex shrink-0 items-center"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function CustomSidebarHeaderButton({
  children,
  disabled = false,
  label,
  onClick,
  title,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      data-tauri-drag-region="false"
      disabled={disabled}
      className={cn([
        "relative z-50 flex h-7 shrink-0 items-center gap-1 rounded-full pr-2.5 pl-1.5",
        "text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-hidden",
        "disabled:text-muted-foreground/70 disabled:hover:text-muted-foreground/70 disabled:hover:bg-transparent",
      ])}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
