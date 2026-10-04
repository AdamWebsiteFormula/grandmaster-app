import { Trans, useLingui } from "@lingui/react/macro";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { platform } from "@tauri-apps/plugin-os";
import { useState } from "react";

import {
  commands as detectCommands,
  type InstalledApp,
  type Result,
} from "@anlg/plugin-detect";
import { commands as notificationCommands } from "@anlg/plugin-notification";
import {
  AppWindow,
  Bell,
  CalendarDots,
  Microphone,
  Moon,
  RadioButton,
  Sparkle,
  Waveform,
  X,
} from "@anlg/ui/components/icons";
import { Badge } from "@anlg/ui/components/ui/badge";
import { Button } from "@anlg/ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@anlg/ui/components/ui/command";
import {
  AppFloatingPanel,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@anlg/ui/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@anlg/ui/components/ui/select";
import { useMountEffect } from "@anlg/ui/hooks/use-mount-effect";
import { cn } from "@anlg/utils";

import {
  getIgnoredBundleIds,
  getIgnorableApps,
  toggleIgnoredApp,
} from "./notification-app-options";

import { useSetSettingValues } from "~/settings/queries";
import {
  SettingRow,
  SettingsGroup,
  SettingSwitchRow,
} from "~/settings/setting-row";
import { useConfigValues } from "~/shared/config";

export function NotificationSettingsView() {
  const { t } = useLingui();
  const currentPlatform = platform();
  const supportsMicDetection = currentPlatform !== "windows";
  const supportsDoNotDisturb = currentPlatform === "macos";
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const configs = useConfigValues([
    "notification_disabled",
    "notification_event",
    "notification_detect",
    "notification_transcription_complete",
    "notification_summary_complete",
    "notification_cloudsync_complete",
    "notification_recording",
    "notification_bounce",
    "show_app_in_dock",
    "respect_dnd",
    "ignored_platforms",
    "included_platforms",
    "mic_active_threshold",
  ] as const);

  useMountEffect(() => {
    void notificationCommands.clearNotifications();
    return () => {
      void notificationCommands.clearNotifications();
    };
  });

  const { data: installedApps = [] } = useQuery({
    queryKey: ["settings", "all-installed-applications"],
    queryFn: detectCommands.listInstalledApplications,
    enabled: supportsMicDetection,
    select: (result: Result<InstalledApp[], string>) => {
      if (result.status === "error") {
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const { data: defaultIgnoredBundleIds = [] } = useQuery({
    queryKey: ["settings", "default-ignored-bundle-ids"],
    queryFn: detectCommands.listDefaultIgnoredBundleIds,
    enabled: supportsMicDetection,
    select: (result: Result<string[], string>) => {
      if (result.status === "error") {
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const bundleIdToName = (bundleId: string) => {
    return installedApps.find((a) => a.id === bundleId)?.name ?? bundleId;
  };

  const isDefaultIgnored = (bundleId: string) => {
    return defaultIgnoredBundleIds.includes(bundleId);
  };

  const setSettingValues = useSetSettingValues();

  const form = useForm({
    defaultValues: {
      notification_disabled: configs.notification_disabled,
      notification_event: configs.notification_event,
      notification_detect: configs.notification_detect,
      notification_transcription_complete:
        configs.notification_transcription_complete,
      notification_summary_complete: configs.notification_summary_complete,
      notification_cloudsync_complete: configs.notification_cloudsync_complete,
      notification_recording: configs.notification_recording,
      notification_bounce: configs.notification_bounce,
      respect_dnd: configs.respect_dnd,
      ignored_platforms: configs.ignored_platforms,
      included_platforms: configs.included_platforms,
      mic_active_threshold: configs.mic_active_threshold,
    },
    listeners: {
      onChange: async ({ formApi }) => {
        void formApi.handleSubmit();
      },
    },
    onSubmit: async ({ value }) => {
      setSettingValues({
        notification_disabled: value.notification_disabled,
        notification_event: value.notification_event,
        notification_detect: value.notification_detect,
        notification_transcription_complete:
          value.notification_transcription_complete,
        notification_summary_complete: value.notification_summary_complete,
        notification_cloudsync_complete: value.notification_cloudsync_complete,
        notification_recording: value.notification_recording,
        notification_bounce: value.notification_bounce,
        respect_dnd: value.respect_dnd,
        ignored_platforms: JSON.stringify(value.ignored_platforms),
        included_platforms: JSON.stringify(value.included_platforms),
        mic_active_threshold: value.mic_active_threshold,
      });
    },
  });

  const handleToggleIgnoredApp = (
    bundleId: string,
    ignoredPlatforms: string[],
    includedPlatforms: string[],
  ) => {
    if (!bundleId) {
      return;
    }

    const {
      ignoredPlatforms: newIgnoredPlatforms,
      includedPlatforms: newIncludedPlatforms,
    } = toggleIgnoredApp({
      bundleId,
      ignoredPlatforms,
      includedPlatforms,
      defaultIgnoredBundleIds,
    });

    form.setFieldValue("ignored_platforms", newIgnoredPlatforms);
    form.setFieldValue("included_platforms", newIncludedPlatforms);
    void form.handleSubmit();
    setSearchOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="flex flex-col gap-8">
      <SettingsGroup>
        <form.Field name="notification_disabled">
          {(field) => (
            // Fork: a positive "Allow notifications" switch, as macOS
            // System Settings › Notifications (Apple HIG: on means on). Same
            // stored key, shown inverted; no schema change.
            <SettingSwitchRow
              icon={Bell}
              title={<Trans>Allow notifications</Trans>}
              description={
                field.state.value ? (
                  <Trans>Turn on Allow notifications to change these.</Trans>
                ) : (
                  <Trans>
                    Show notification panels, Dock alerts, and completion
                    sounds.
                  </Trans>
                )
              }
              checked={!field.state.value}
              onChange={(allowed) => {
                field.handleChange(!allowed);
                if (!allowed) {
                  void notificationCommands.clearNotifications();
                }
              }}
            />
          )}
        </form.Field>
        {supportsDoNotDisturb && (
          <div className="flex flex-col gap-6">
            <form.Subscribe
              selector={(state) =>
                !state.values.notification_disabled &&
                (state.values.notification_event ||
                  state.values.notification_detect)
              }
            >
              {(anyNotificationEnabled) => (
                <form.Field name="respect_dnd">
                  {(field) => (
                    <SettingSwitchRow
                      icon={Moon}
                      title={<Trans>Respect Do Not Disturb</Trans>}
                      description={
                        <Trans>Pause alerts while Do Not Disturb is on.</Trans>
                      }
                      checked={field.state.value}
                      onChange={field.handleChange}
                      disabled={!anyNotificationEnabled}
                    />
                  )}
                </form.Field>
              )}
            </form.Subscribe>
          </div>
        )}
      </SettingsGroup>

      <form.Subscribe selector={(state) => state.values.notification_disabled}>
        {(notificationsDisabled) => (
          <>
            {/* Fork: three cards, as Granola's Notifications page groups
                meeting alerts apart from the rest (granola-compare-oct3
                section 8). */}
            <SettingsGroup title={<Trans>Meetings</Trans>}>
              <form.Field name="notification_event">
                {(field) => (
                  <SettingSwitchRow
                    icon={CalendarDots}
                    title={<Trans>Event notifications</Trans>}
                    description={
                      <Trans>
                        Prepare for events with a 5-minute reminder.
                      </Trans>
                    }
                    checked={field.state.value}
                    onChange={field.handleChange}
                    disabled={notificationsDisabled}
                  />
                )}
              </form.Field>
              {supportsMicDetection && (
                <form.Field name="notification_detect">
                  {(field) => (
                    <div className="flex flex-col gap-4">
                      <SettingSwitchRow
                        icon={Microphone}
                        title={<Trans>Microphone detection</Trans>}
                        description={
                          <Trans>
                            Detect meetings from microphone activity.
                          </Trans>
                        }
                        checked={field.state.value}
                        onChange={field.handleChange}
                        disabled={notificationsDisabled}
                      />

                      {field.state.value && !notificationsDisabled && (
                        <div
                          className={cn([
                            "border-border ml-3 border-l-2 pt-2 pl-4",
                          ])}
                        >
                          <form.Field name="mic_active_threshold">
                            {(thresholdField) => (
                              // Fork: a named, translated delay picker
                              // (ux-audit-oct3 E, WCAG 4.1.2).
                              <div className="mb-4">
                                <SettingRow
                                  title={<Trans>Detection delay</Trans>}
                                  description={
                                    <Trans>
                                      Wait before treating microphone activity
                                      as a meeting.
                                    </Trans>
                                  }
                                  controlWidth="content"
                                >
                                  {(labelProps) => (
                                    <Select
                                      value={String(thresholdField.state.value)}
                                      onValueChange={(v) =>
                                        thresholdField.handleChange(Number(v))
                                      }
                                    >
                                      <SelectTrigger
                                        {...labelProps}
                                        className="w-[120px]"
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent align="end">
                                        <SelectItem value="5">
                                          <Trans>5 seconds</Trans>
                                        </SelectItem>
                                        <SelectItem value="10">
                                          <Trans>10 seconds</Trans>
                                        </SelectItem>
                                        <SelectItem value="15">
                                          <Trans>15 seconds</Trans>
                                        </SelectItem>
                                        <SelectItem value="30">
                                          <Trans>30 seconds</Trans>
                                        </SelectItem>
                                        <SelectItem value="60">
                                          <Trans>1 minute</Trans>
                                        </SelectItem>
                                        <SelectItem value="120">
                                          <Trans>2 minutes</Trans>
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                </SettingRow>
                              </div>
                            )}
                          </form.Field>

                          <div className="mb-3 flex flex-col gap-1">
                            <h4 className="text-sm font-medium">
                              <Trans>Exclude apps from detection</Trans>
                            </h4>
                            <p className="text-muted-foreground text-xs">
                              <Trans>
                                Prevent selected apps from triggering meeting
                                detection.
                              </Trans>
                            </p>
                          </div>
                          <form.Subscribe selector={(state) => state.values}>
                            {(values) => {
                              const ignoredPlatforms = values.ignored_platforms;
                              const includedPlatforms =
                                values.included_platforms;
                              const ignorableApps = getIgnorableApps({
                                installedApps,
                                ignoredPlatforms,
                                includedPlatforms,
                                inputValue: searchQuery,
                                defaultIgnoredBundleIds,
                              });
                              const ignoredBundleIds = getIgnoredBundleIds({
                                installedApps,
                                ignoredPlatforms,
                                includedPlatforms,
                                defaultIgnoredBundleIds,
                              });

                              return (
                                <div className="flex flex-col gap-3">
                                  <Popover
                                    open={searchOpen}
                                    onOpenChange={setSearchOpen}
                                  >
                                    <PopoverTrigger asChild>
                                      <div
                                        role="button"
                                        tabIndex={0}
                                        aria-expanded={searchOpen}
                                        className={cn([
                                          "flex min-h-[38px] w-full cursor-text flex-wrap items-center gap-2 rounded-2xl border p-2",
                                          "focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-hidden",
                                        ])}
                                        onKeyDown={(event) => {
                                          if (
                                            event.key === "Enter" ||
                                            event.key === " "
                                          ) {
                                            event.preventDefault();
                                            setSearchOpen(true);
                                          }
                                        }}
                                      >
                                        {ignoredBundleIds.map(
                                          (bundleId: string) => {
                                            const isDefault =
                                              isDefaultIgnored(bundleId);
                                            return (
                                              <Badge
                                                key={bundleId}
                                                variant="secondary"
                                                className={cn([
                                                  "flex items-center gap-1 px-2 py-0.5 text-xs",
                                                  isDefault
                                                    ? [
                                                        "bg-accent text-muted-foreground",
                                                      ]
                                                    : ["bg-muted"],
                                                ])}
                                                title={
                                                  isDefault
                                                    ? "default"
                                                    : undefined
                                                }
                                              >
                                                {bundleIdToName(bundleId)}
                                                {isDefault && (
                                                  <span className="text-xs opacity-70">
                                                    <Trans>(default)</Trans>
                                                  </span>
                                                )}
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  aria-label={t`Remove ${bundleIdToName(bundleId)}`}
                                                  className="-my-1 -mr-1.5 size-6 p-0 hover:bg-transparent"
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleToggleIgnoredApp(
                                                      bundleId,
                                                      ignoredPlatforms,
                                                      includedPlatforms,
                                                    );
                                                  }}
                                                >
                                                  <X className="size-3" />
                                                </Button>
                                              </Badge>
                                            );
                                          },
                                        )}
                                        <span className="text-muted-foreground text-sm">
                                          <Trans>Search installed apps…</Trans>
                                        </span>
                                      </div>
                                    </PopoverTrigger>
                                    <PopoverContent
                                      variant="app"
                                      align="start"
                                      style={{
                                        width:
                                          "var(--radix-popover-trigger-width)",
                                      }}
                                    >
                                      <AppFloatingPanel className="overflow-hidden">
                                        <Command className="rounded-[inherit] border-0 bg-transparent">
                                          <CommandInput
                                            placeholder={t`Search installed apps…`}
                                            value={searchQuery}
                                            onValueChange={setSearchQuery}
                                          />
                                          <CommandEmpty>
                                            <div className="text-muted-foreground px-2 py-1.5 text-sm">
                                              <Trans>No apps found.</Trans>
                                            </div>
                                          </CommandEmpty>
                                          <CommandList>
                                            <CommandGroup className="max-h-[250px] overflow-y-auto">
                                              {ignorableApps.map((app) => (
                                                <CommandItem
                                                  key={app.id}
                                                  value={`${app.name} ${app.id}`}
                                                  onSelect={() =>
                                                    handleToggleIgnoredApp(
                                                      app.id,
                                                      ignoredPlatforms,
                                                      includedPlatforms,
                                                    )
                                                  }
                                                  className={cn([
                                                    "cursor-pointer",
                                                    "hover:bg-accent! focus:bg-accent! aria-selected:bg-transparent",
                                                  ])}
                                                >
                                                  <span className="flex-1 truncate">
                                                    {app.name}
                                                  </span>
                                                </CommandItem>
                                              ))}
                                            </CommandGroup>
                                          </CommandList>
                                        </Command>
                                      </AppFloatingPanel>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              );
                            }}
                          </form.Subscribe>
                        </div>
                      )}
                    </div>
                  )}
                </form.Field>
              )}
              <form.Field name="notification_recording">
                {(field) => (
                  <SettingSwitchRow
                    icon={RadioButton}
                    title={<Trans>Recording status prompts</Trans>}
                    description={
                      <Trans>
                        Ask before stopping when a meeting may have ended. When
                        alerts are off, Upshot keeps recording.
                      </Trans>
                    }
                    checked={field.state.value}
                    onChange={field.handleChange}
                    disabled={notificationsDisabled}
                  />
                )}
              </form.Field>
            </SettingsGroup>

            <SettingsGroup title={<Trans>When notes are ready</Trans>}>
              <form.Field name="notification_transcription_complete">
                {(field) => (
                  <SettingSwitchRow
                    icon={Waveform}
                    title={<Trans>Transcription complete</Trans>}
                    description={
                      <Trans>Show when a transcript is ready.</Trans>
                    }
                    checked={field.state.value}
                    onChange={field.handleChange}
                    disabled={notificationsDisabled}
                  />
                )}
              </form.Field>
              <form.Field name="notification_summary_complete">
                {(field) => (
                  <SettingSwitchRow
                    icon={Sparkle}
                    title={<Trans>Summary complete</Trans>}
                    description={<Trans>Show when a summary is ready.</Trans>}
                    checked={field.state.value}
                    onChange={field.handleChange}
                    disabled={notificationsDisabled}
                  />
                )}
              </form.Field>
              {/* Fork: cloud sync is hidden, so its notification row is too. */}
            </SettingsGroup>

            {/* Fork: Upshot makes no sounds (owner decision, Oct 3; Granola's
                Mac app is silent), so the completion sound toggle and picker
                are gone. Only the app icon bounce remains in this group. */}
            {(currentPlatform !== "macos" || configs.show_app_in_dock) && (
              <SettingsGroup title={<Trans>App icon</Trans>}>
                <form.Field name="notification_bounce">
                  {(field) => (
                    <SettingSwitchRow
                      icon={AppWindow}
                      title={<Trans>Bounce app icon</Trans>}
                      description={
                        <Trans>
                          Get your attention when Upshot finishes work in the
                          background.
                        </Trans>
                      }
                      checked={field.state.value}
                      onChange={field.handleChange}
                      disabled={notificationsDisabled}
                    />
                  )}
                </form.Field>
              </SettingsGroup>
            )}
          </>
        )}
      </form.Subscribe>
    </div>
  );
}
