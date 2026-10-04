import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";

import { commands as openerCommands } from "@anlg/plugin-opener2";
import { type PermissionStatus } from "@anlg/plugin-permissions";
import {
  ArrowLeft,
  ArrowRight,
  CalendarSlash,
  Check,
  WarningCircle,
} from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@anlg/ui/components/ui/dialog";
import { cn } from "@anlg/utils";

import {
  GlassDialogCancelButton,
  GlassDialogContent,
} from "~/shared/ui/glass-dialog";

// Fork: Google and Outlook calendars reach Upshot through the Mac's Internet
// Accounts (support.apple.com/guide/calendar/add-or-delete-calendar-accounts-icl4308d6701/mac).
// The pane's id matches InternetAccountsSettingsExtension.appex on macOS 15
// and 26; if it fails to open, System Settings opens instead.
export const INTERNET_ACCOUNTS_URL =
  "x-apple.systempreferences:com.apple.Internet-Accounts-Settings.extension";
const SYSTEM_SETTINGS_APP = "/System/Applications/System Settings.app";

export async function openInternetAccounts() {
  const result = await openerCommands.openUrl(INTERNET_ACCOUNTS_URL, null);
  if (result.status === "error") {
    await openerCommands.openPath(SYSTEM_SETTINGS_APP, null);
  }
}

// Fork: three calendar states, each with one next step (NN/g empty states,
// nngroup.com/articles/empty-state-interface-design; Apple HIG, ask for
// permission in context, developer.apple.com/design/human-interface-guidelines/privacy).
export function NoCalendarsYet({
  onRefresh,
  isLoading,
  showAddAccount = true,
  className,
}: {
  onRefresh?: () => void;
  isLoading?: boolean;
  showAddAccount?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(["flex flex-col items-start gap-3", className])}
    >
      <div className="text-muted-foreground flex items-start gap-2 text-sm">
        <CalendarSlash className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <Trans>
            No calendars yet. Add your Google or Outlook account to your Mac,
            and its calendars show up here.
          </Trans>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {/* Fork: Apple's own label, Calendar › Add Account (support
            icl4308d6701), the same on every calendar surface. */}
        {showAddAccount ? (
          <Button
            size="sm"
            className="h-8 px-3"
            onClick={() => void openInternetAccounts()}
          >
            <Trans>Add account</Trans>
          </Button>
        ) : null}
        {onRefresh ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3"
            disabled={isLoading}
            onClick={onRefresh}
          >
            <Trans>Refresh</Trans>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function CalendarAccessNeeded({
  onAllow,
  isPending,
  className,
}: {
  onAllow: () => void;
  isPending?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(["flex flex-col items-start gap-3", className])}>
      {/* Fork: name the accounts, so no one reads "Apple only" (owner,
          Oct 3; Granola names Google and Outlook, docs.granola.ai
          syncing-your-calendars). The serial comma follows the Apple Style
          Guide (NN/g #4). */}
      <p className="text-muted-foreground text-sm">
        <Trans>
          Upshot needs calendar access to show meetings from your Google,
          Outlook, and iCloud calendars and name your notes.
        </Trans>
      </p>
      <Button
        size="sm"
        className="h-8 px-3"
        disabled={isPending}
        onClick={onAllow}
      >
        <Trans>Allow access</Trans>
      </Button>
    </div>
  );
}

export function AppleCalendarPermissionDialog({
  open,
  onOpenChange,
  onOpenSettings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <GlassDialogContent>
        <DialogHeader className="items-center gap-2 text-center sm:text-center">
          {/* Fork: one access covers every calendar on this Mac, not only
              Apple's; › as the other System Settings paths (owner, Oct 3). */}
          <DialogTitle className="text-foreground text-sm leading-5 font-semibold tracking-normal">
            <Trans>Calendar access is off</Trans>
          </DialogTitle>
          <DialogDescription className="text-foreground w-full text-center text-sm leading-[1.36]">
            <Trans>
              Turn on Upshot in System Settings › Privacy &amp; Security ›
              Calendars, then return here.
            </Trans>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:justify-normal">
          <GlassDialogCancelButton onClick={() => onOpenChange(false)}>
            <Trans>Cancel</Trans>
          </GlassDialogCancelButton>
          <Button
            className="bg-primary text-primary-foreground h-8 rounded-full px-4 text-xs font-medium shadow-sm hover:brightness-90 dark:bg-white dark:text-black dark:hover:bg-white/90"
            onClick={() => {
              onOpenSettings();
              onOpenChange(false);
            }}
          >
            <Trans>Open settings</Trans>
          </Button>
        </DialogFooter>
      </GlassDialogContent>
    </Dialog>
  );
}

function ActionLink({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn([
        "hover:text-foreground underline transition-colors",
        disabled && "cursor-not-allowed opacity-50",
      ])}
    >
      {children}
    </button>
  );
}

export function AccessPermissionRow({
  title,
  status,
  isPending,
  onOpen,
  onRequest,
  onReset,
  showActionButton = true,
}: {
  title: string;
  status: PermissionStatus | undefined;
  isPending: boolean;
  onOpen: () => void;
  onRequest: () => void;
  onReset: () => void;
  showActionButton?: boolean;
}) {
  const { t } = useLingui();
  const isAuthorized = status === "authorized";
  const isDenied = status === "denied";

  const handleButtonClick = () => {
    if (isAuthorized || isDenied) {
      onOpen();
    } else {
      onRequest();
    }
  };

  return (
    <div
      className={cn([
        "flex gap-4 py-2",
        showActionButton
          ? "items-center justify-between"
          : "items-start justify-start",
      ])}
    >
      <div className="flex-1">
        <div
          className={cn([
            "mb-1 flex items-center gap-2",
            !isAuthorized && "text-destructive",
          ])}
        >
          {!isAuthorized && <WarningCircle className="size-4" />}
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        <TroubleShootingLink
          onRequest={onRequest}
          onReset={onReset}
          onOpen={onOpen}
          isPending={isPending}
        />
      </div>
      {showActionButton && (
        <Button
          variant={isAuthorized ? "outline" : "default"}
          size="icon"
          onClick={handleButtonClick}
          disabled={isPending}
          className={cn([
            "size-8",
            isAuthorized && "bg-muted text-foreground hover:bg-accent",
          ])}
          aria-label={
            isAuthorized
              ? t`Open ${title.toLowerCase()} settings`
              : t`Request ${title.toLowerCase()}`
          }
        >
          {isAuthorized ? (
            <Check className="size-5" />
          ) : (
            <ArrowRight className="size-5" />
          )}
        </Button>
      )}
    </div>
  );
}

export function TroubleShootingLink({
  onRequest: _onRequest,
  onReset,
  onOpen,
  isPending,
  isAuthorized = false,
  className,
}: {
  onRequest: () => void;
  onReset: () => void;
  onOpen: () => void;
  isPending: boolean;
  isAuthorized?: boolean;
  className?: string;
}) {
  const [showActions, setShowActions] = useState(false);
  return (
    <div className={cn(["text-muted-foreground text-xs", className])}>
      {!showActions ? (
        <button
          type="button"
          onClick={() => setShowActions(true)}
          className="hover:text-foreground underline transition-colors"
        >
          <Trans>Having trouble?</Trans>
        </button>
      ) : isAuthorized ? (
        // Fork: access is on, so the list is stale, not blocked (EventKit
        // store made before the grant; capacitor-calendar issue #219).
        <div>
          <Trans>Quit and reopen Upshot, then click Refresh.</Trans>{" "}
          <ActionLink onClick={() => setShowActions(false)}>
            <ArrowLeft className="inline-block size-3 underline" />
            <Trans>Back</Trans>
          </ActionLink>
        </div>
      ) : (
        <div>
          {/* Fork: plain words for what each link does (UX audit Oct 3, A:
              NN/g #2, #9). */}
          <Trans>Calendar access is off.</Trans>{" "}
          <ActionLink onClick={onOpen} disabled={isPending}>
            <Trans>Open System Settings</Trans>
          </ActionLink>{" "}
          <Trans>to turn it on, or</Trans>{" "}
          <ActionLink onClick={onReset} disabled={isPending}>
            <Trans>Reset calendar access</Trans>
          </ActionLink>{" "}
          <Trans>and try again.</Trans>{" "}
          <ActionLink onClick={() => setShowActions(false)}>
            <ArrowLeft className="inline-block size-3 underline" />
            <Trans>Back</Trans>
          </ActionLink>
        </div>
      )}
    </div>
  );
}
