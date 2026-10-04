import { Trans, useLingui } from "@lingui/react/macro";
import { type MouseEvent, useCallback, useState } from "react";

import {
  ArrowUpRight,
  Lock,
  MagnifyingGlass,
  User,
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
import { scrollToSettingsSection, settingsNavPage } from "~/settings/sections";
import { useOwnerUserId } from "~/shared/owner-user";
import { type SettingsTab, useTabs } from "~/store/zustand/tabs";
import { useUpshotPlan } from "~/upshot-plan";
import { signOutUpshot } from "~/upshot-plan/session";

export function SettingsNav() {
  const { t } = useLingui();
  const { isPro } = useBillingAccess();
  const { isSignedIn } = useUpshotPlan();
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
  // Fork: a section or sub-page marks the page that holds it
  // (settings/sections.ts).
  const activeTab = settingsNavPage(requestedTab);

  const setActiveTab = useCallback(
    (tab: SettingsTab) => {
      if (currentTab?.type === "settings") {
        updateSettingsTabState(currentTab, { tab });
      }
    },
    [currentTab, updateSettingsTabState],
  );

  const query = search.trim().toLowerCase();
  // Fork: sections and sub-pages (Appearance, Privacy, Dictionary, Imports…)
  // show only as search results, as macOS System Settings search finds
  // settings inside a pane.
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
    : groups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => !("parent" in item && item.parent),
          ),
        }))
        .filter((group) => group.items.length > 0);

  const openItem = (item: (typeof groups)[number]["items"][number]) => {
    if ("destination" in item) {
      openNew(item.destination);
      return;
    }
    setActiveTab(item.id);
    scrollToSettingsSection(item.id);
  };

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
            // Fork: a focus ring, not just a fill (WCAG 2.2 SC 2.4.7).
            "focus-within:bg-accent focus-within:ring-ring transition-colors focus-within:ring-1",
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
              // Fork: Return opens the top match, as macOS System Settings
              // search does (journey-account-settings P3).
              const first = visibleGroups[0]?.items[0];
              if (
                event.key === "Enter" &&
                query &&
                first &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                openItem(first);
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
                      onClick={() => openItem(item)}
                      className={cn([
                        "flex w-full items-center gap-2 rounded-full px-3 py-2 text-left text-sm",
                        "transition-colors",
                        // Fork: a visible focus ring, inset so the scroll
                        // area never clips it (WCAG 2.2 SC 2.4.7).
                        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
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
      {/* Fork: Sign out stays in view at the bottom of Settings, where
          Granola puts it; it was only at the end of Profile (owner test,
          Oct 4; NN/g #6, recognition rather than recall). */}
      {isSignedIn ? (
        <div className="border-border border-t pt-2">
          <button
            type="button"
            data-settings-sign-out
            onClick={() => void signOutUpshot()}
            className={cn([
              "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground flex w-full items-center gap-2 rounded-full px-3 py-2 text-left text-sm transition-colors",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
            ])}
          >
            <Trans>Sign out</Trans>
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Fork: who is signed in, on top of the Settings sidebar, as Granola shows
// avatar, name and email (granola-compare-oct3 section 8): the name on line 1,
// the email in small muted text on line 2 (redline2-oct3 Settings). Without a
// saved name, line 1 is the email's local part. A small neutral badge names
// the plan, as Notion and Slack put the plan next to the workspace name.
// Fork: a help tag only when the text is cut off, so the full name or email
// never covers the search field below it (Apple HIG "Offering help":
// expansion tooltips show truncated text; redline round 4).
function titleWhenTruncated(event: MouseEvent<HTMLElement>) {
  const el = event.currentTarget;
  if (el.scrollWidth > el.clientWidth) {
    el.title = el.textContent ?? "";
  } else {
    el.removeAttribute("title");
  }
}

export function SettingsAccountHeader() {
  const { t } = useLingui();
  const { email, isSignedIn, isLoading, plan } = useUpshotPlan();
  const currentTab = useTabs((state) => state.currentTab);
  const updateSettingsTabState = useTabs(
    (state) => state.updateSettingsTabState,
  );
  const openPlan = () => {
    if (currentTab?.type === "settings") {
      updateSettingsTabState(currentTab, { tab: "plan" });
    }
  };
  const auth = useAuth();
  const localOwnerUserId = useOwnerUserId();
  const humanId = auth.session?.user.id ?? localOwnerUserId ?? "";
  const profile = usePersonalContact(humanId);
  const profileName = profile.data?.name?.trim() || null;
  const isProPlan = Boolean(plan?.pro);
  // Fork: no badge until the plan is known, so a paying user never sees
  // "Free" while it loads or offline (journey-account-settings P2; NN/g #1).
  const planKnown = isSignedIn ? plan !== null : !isLoading;
  const avatar = profile.data?.avatarDataUrl ?? null;

  const signedInEmail = isSignedIn && email ? email : null;
  const emailLocalPart = signedInEmail?.split("@")[0]?.trim() || null;
  // Fork: no name yet is "You" with a person icon, never the app's name and
  // letter as the user's own; the transcript and the recording bar already
  // say "You" (NN/g heuristic #4, consistency and standards).
  const named = profileName ?? emailLocalPart;
  const title = named ?? t`You`;
  const initial = (title.trim()[0] ?? "U").toUpperCase();

  return (
    <div
      data-testid="settings-account-header"
      className="flex flex-col items-center gap-1 px-2 pt-2 pb-4 text-center"
    >
      {/* Fork: the Profile photo when there is one (journey-account-settings
          P3; Granola screens 12–19). */}
      {avatar ? (
        <img
          src={avatar}
          alt=""
          aria-hidden
          data-testid="settings-account-avatar"
          className="rounded-pill mb-1 size-10 object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="bg-sidebar-accent text-foreground rounded-pill mb-1 flex size-10 items-center justify-center text-base font-medium"
        >
          {named ? initial : <User aria-hidden className="size-5" />}
        </span>
      )}
      <div className="flex w-full min-w-0 items-center justify-center gap-1.5">
        <p
          className="min-w-0 truncate text-sm font-medium"
          onMouseEnter={titleWhenTruncated}
        >
          {title}
        </p>
        {planKnown ? (
          // Fork: the plan badge opens Plan, so Upgrade to Pro is one click
          // from the top of Settings (owner test, Oct 4; NN/g #7).
          <button
            type="button"
            data-testid="settings-plan-badge"
            title={t`Open Plan`}
            onClick={openPlan}
            className="border-input text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground focus-visible:ring-ring shrink-0 cursor-pointer rounded-full border px-1.5 text-xs leading-4 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {isProPlan ? t`Pro` : t`Free`}
            <span className="sr-only"> {t`plan`}</span>
          </button>
        ) : null}
      </div>
      {signedInEmail ? (
        <p
          className="text-muted-foreground w-full truncate text-xs"
          onMouseEnter={titleWhenTruncated}
        >
          {signedInEmail}
        </p>
      ) : null}
    </div>
  );
}
