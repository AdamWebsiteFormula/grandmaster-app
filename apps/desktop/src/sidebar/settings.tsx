import { Trans, useLingui } from "@lingui/react/macro";
import { useCallback, useState } from "react";

import {
  ArrowUpRight,
  Lock,
  MagnifyingGlass,
  X,
} from "@anlg/ui/components/icons";
import { useSquircleRef } from "@anlg/ui/hooks/use-squircle";
import { cn } from "@anlg/utils";

import { CustomSidebarHeader } from "./custom-sidebar-header";
import {
  settingsNavItemMatches,
  useSettingsNavGroups,
} from "./settings-nav-groups";

import { useAuth } from "~/auth";
import { useBillingAccess } from "~/auth/billing-context";
import { usePersonalContact } from "~/contacts/queries";
import { useOwnerUserId } from "~/shared/owner-user";
import { type SettingsTab, useTabs } from "~/store/zustand/tabs";
import { useUpshotPlan } from "~/upshot-plan";

export function SettingsNav() {
  const { t } = useLingui();
  const { isPro } = useBillingAccess();
  // Fork: entries kept only for the ⌘K navigator stay out of the sidebar.
  const groups = useSettingsNavGroups()
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !("navigatorOnly" in item && item.navigatorOnly),
      ),
    }))
    .filter((group) => group.items.length > 0);
  const [search, setSearch] = useState("");
  const searchRef = useSquircleRef<HTMLDivElement>();
  const currentTab = useTabs((state) => state.currentTab);
  const updateSettingsTabState = useTabs(
    (state) => state.updateSettingsTabState,
  );
  const openNew = useTabs((state) => state.openNew);

  const requestedTab =
    currentTab?.type === "settings" ? (currentTab.state.tab ?? "app") : "app";
  const activeTab =
    requestedTab === "audio"
      ? "meetings"
      : requestedTab === "stats"
        ? "insights"
        : requestedTab;

  const setActiveTab = useCallback(
    (tab: SettingsTab) => {
      if (currentTab?.type === "settings") {
        updateSettingsTabState(currentTab, { tab });
      }
    },
    [currentTab, updateSettingsTabState],
  );

  const query = search.trim().toLowerCase();
  const visibleGroups = query
    ? groups
        .map((group) =>
          group.label.toLowerCase().includes(query)
            ? group
            : {
                ...group,
                items: group.items.filter((item) =>
                  settingsNavItemMatches(item, query),
                ),
              },
        )
        .filter((group) => group.items.length > 0)
    : groups;

  return (
    // Fork: pb-3 keeps the last row off the window edge (redline-oct3
    // Settings; design-system "Nothing touches the window edges").
    <div className="flex h-full w-full flex-col overflow-hidden pb-3">
      <CustomSidebarHeader />
      <SettingsAccountHeader />
      <div className="pb-2">
        <div
          ref={searchRef}
          className={cn([
            "border-input bg-accent/50 flex h-8 w-full shrink-0 items-center gap-2 rounded-lg border px-3",
            "focus-within:bg-accent transition-colors",
          ])}
        >
          <MagnifyingGlass className="text-muted-foreground h-4 w-4 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              // Fork: Esc clears the search without also closing Settings
              // (ux-audit-oct3 E, NN/g #3).
              if (event.key === "Escape" && search) {
                event.preventDefault();
                event.stopPropagation();
                setSearch("");
              }
            }}
            aria-label={t`Search settings`}
            placeholder={t`Search`}
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm placeholder:text-sm focus:outline-hidden"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className={cn([
                "-mr-2 flex size-6 shrink-0 items-center justify-center rounded-full",
                "text-muted-foreground hover:text-foreground",
                "transition-colors",
              ])}
              aria-label={t`Clear search`}
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="scrollbar-hide flex-1 overflow-y-auto">
        <div className="flex flex-col gap-5 pb-3">
          {visibleGroups.length === 0 ? (
            <div className="text-muted-foreground px-3 py-8 text-center">
              <MagnifyingGlass
                size={32}
                className="text-muted-foreground/70 mx-auto mb-2"
              />
              <p className="text-sm">
                <Trans>No results found.</Trans>
              </p>
            </div>
          ) : null}
          {visibleGroups.map((group) => (
            <div
              key={group.label}
              role="group"
              aria-label={group.label}
              className="flex flex-col gap-0.5"
            >
              {group.items.map((item) => {
                const requiresPro = Boolean(item.requiresPro && !isPro);
                const leavesSettings = "destination" in item;
                const isActive = !leavesSettings && activeTab === item.id;

                return (
                  <div key={item.id} className="relative">
                    <button
                      type="button"
                      aria-current={isActive ? "page" : undefined}
                      aria-label={
                        leavesSettings
                          ? t`${item.label}, opens outside Settings`
                          : undefined
                      }
                      onClick={() => {
                        if ("destination" in item) {
                          openNew(item.destination);
                          return;
                        }

                        setActiveTab(item.id);
                      }}
                      className={cn([
                        "flex w-full items-center gap-2 rounded-full px-3 py-2 text-left text-sm",
                        "transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-foreground font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                      ])}
                    >
                      <item.icon
                        size={15}
                        className="shrink-0"
                        data-testid={`settings-nav-icon-${item.id}`}
                      />
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="min-w-0 flex-1 truncate">
                          {item.label}
                        </span>
                        {/* Fork: Folders, Calendar and Templates open their
                            own screens, so they carry an arrow (ux-audit-oct3
                            E, NN/g #4). */}
                        {leavesSettings ? (
                          <ArrowUpRight
                            aria-hidden
                            className="text-muted-foreground size-3.5 shrink-0"
                          />
                        ) : null}
                        {requiresPro ? (
                          <Lock
                            aria-label={t`Requires Upshot Pro`}
                            className="size-3.5 shrink-0"
                          />
                        ) : null}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Fork: who is signed in, on top of the Settings sidebar, as Granola shows
// avatar, name and email (granola-compare-oct3 section 8). Signed out, it
// names the app and the plan.
export function SettingsAccountHeader() {
  const { t } = useLingui();
  const { email, isSignedIn, plan } = useUpshotPlan();
  const auth = useAuth();
  const localOwnerUserId = useOwnerUserId();
  const humanId = auth.session?.user.id ?? localOwnerUserId ?? "";
  const profile = usePersonalContact(humanId);
  const profileName = profile.data?.name?.trim() || null;
  const planLabel = plan?.pro ? t`Pro plan` : t`Free plan`;

  // Fork: the name on its own line and the email under it in small muted
  // text, as Granola's Settings sidebar (redline-oct3 Settings). Without a
  // name, the plan takes the first line so the email never sits in bold.
  const signedInEmail = isSignedIn && email ? email : null;
  const title = profileName ?? (signedInEmail ? planLabel : t`Upshot`);
  const subtitle = signedInEmail ?? planLabel;
  const initial = (
    (profileName ?? signedInEmail ?? title).trim()[0] ?? "U"
  ).toUpperCase();

  return (
    <div
      data-testid="settings-account-header"
      className="flex flex-col items-center gap-1 px-2 pt-2 pb-4 text-center"
    >
      <span
        aria-hidden
        className="bg-sidebar-accent text-foreground mb-1 flex size-10 items-center justify-center rounded-full text-base font-medium"
      >
        {initial}
      </span>
      <p className="w-full truncate text-sm font-medium" title={title}>
        {title}
      </p>
      <p
        className="text-muted-foreground w-full truncate text-xs"
        title={subtitle}
      >
        {subtitle}
      </p>
    </div>
  );
}
