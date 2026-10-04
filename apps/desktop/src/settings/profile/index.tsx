// Fork: Settings › Profile, local and with no account, as Granola's Profile
// page (Account, Your company, Account management; granola-compare-oct3
// section 8). It edits the same personal contact card as before.
import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";

import { ChartLineUp } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";

import { AccountProfile } from "~/settings/general/account-profile";
import { SettingsPageTitle } from "~/settings/page-title";
import { SettingLinkRow, SettingsGroup } from "~/settings/setting-row";
import { isMac } from "~/shared/shortcut-label";
import { DestructiveConfirmationDialog } from "~/shared/ui/destructive-confirmation-dialog";
import { useTabs } from "~/store/zustand/tabs";
import {
  deleteUpshotAccount,
  openUpshotSignIn,
  signOutUpshot,
  useUpshotPlan,
} from "~/upshot-plan";

export function SettingsProfile() {
  const currentTab = useTabs((state) => state.currentTab);
  const updateSettingsTabState = useTabs(
    (state) => state.updateSettingsTabState,
  );

  return (
    <div className="flex flex-col gap-8">
      <SettingsPageTitle
        title={<Trans>Profile</Trans>}
        description={
          // Fork: "this computer" off a Mac (NN/g heuristic #2, the user's
          // words).
          isMac() ? (
            <Trans>Your contact card in Upshot. It stays on this Mac.</Trans>
          ) : (
            <Trans>
              Your contact card in Upshot. It stays on this computer.
            </Trans>
          )
        }
      />
      <AccountProfile />
      <SettingsGroup title={<Trans>Your notes</Trans>}>
        {/* Fork: Insights left the sidebar (stats are not settings; Granola's
            Settings has no stats page) and opens from here
            (grandmaster/sops/settings-ia-oct3.md Q3). Import notes lives
            only on Connectors, whose sub-page it is, so its back button
            matches where it opened from (NN/g heuristic #4). */}
        <SettingLinkRow
          icon={ChartLineUp}
          title={<Trans>Insights</Trans>}
          description={<Trans>Your meeting stats and badges.</Trans>}
          onClick={() => {
            if (currentTab?.type === "settings") {
              updateSettingsTabState(currentTab, { tab: "insights" });
            }
          }}
        />
      </SettingsGroup>
      <AccountSection />
    </div>
  );
}

// Fork: Sign in and Sign out live on Profile, as Granola keeps them under
// Settings › Profile › Account management (redline-oct3 Settings).
export function AccountSection() {
  const { t } = useLingui();
  const { email, isSignedIn } = useUpshotPlan();

  return (
    <SettingsGroup title={<Trans>Account</Trans>}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {isSignedIn ? (
              <Trans>Signed in</Trans>
            ) : (
              <Trans>Not signed in</Trans>
            )}
          </p>
          <p
            className="text-muted-foreground mt-0.5 truncate text-xs"
            title={isSignedIn && email ? email : undefined}
          >
            {isSignedIn ? (
              (email ?? t`Upshot account`)
            ) : (
              <Trans>You're on Free. No account needed.</Trans>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-sm"
          onClick={() =>
            isSignedIn ? void signOutUpshot() : openUpshotSignIn()
          }
        >
          {isSignedIn ? <Trans>Sign out</Trans> : <Trans>Sign in</Trans>}
        </Button>
      </div>
      {isSignedIn ? <DeleteAccountRow /> : null}
    </SettingsGroup>
  );
}

// Fork: delete the Upshot account in the app, with a confirm (journey-
// account-settings P3; Apple App Store Review Guideline 5.1.1(v)). The
// Worker stops billing first, then deletes the account; notes stay local.
function DeleteAccountRow() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await deleteUpshotAccount();
      setOpen(false);
    } catch (cause) {
      setOpen(false);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            <Trans>Delete account</Trans>
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {isMac() ? (
              <Trans>
                Ends Pro and deletes your account. Notes stay on this Mac.
              </Trans>
            ) : (
              <Trans>
                Ends Pro and deletes your account. Notes stay on this computer.
              </Trans>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive h-8 px-3 text-sm"
          onClick={() => setOpen(true)}
        >
          <Trans>Delete account…</Trans>
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
      <DestructiveConfirmationDialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
        title={<Trans>Delete your Upshot account?</Trans>}
        description={
          isMac() ? (
            <Trans>
              Pro ends right away with no refund, and your account and plan are
              deleted. Your notes stay on this Mac. This can't be undone.
            </Trans>
          ) : (
            <Trans>
              Pro ends right away with no refund, and your account and plan are
              deleted. Your notes stay on this computer. This can't be undone.
            </Trans>
          )
        }
        confirmLabel={<Trans>Delete account</Trans>}
        pendingLabel={<Trans>Deleting…</Trans>}
        isPending={pending}
        onConfirm={() => void confirm()}
      />
    </div>
  );
}
