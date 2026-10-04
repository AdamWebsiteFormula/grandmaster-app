import { Trans } from "@lingui/react/macro";
import { platform } from "@tauri-apps/plugin-os";

import {
  Chats,
  Megaphone,
  PictureInPicture,
  Play,
  StopCircle,
  VideoCamera,
} from "@anlg/ui/components/icons";

import { SettingsGroup, SettingSwitchRow } from "~/settings/setting-row";

interface SettingItem {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function MeetingSettingsView({
  autoJoinScheduledMeetings,
  autoStartScheduledMeetings,
  autoStopMeetings,
  floatingBar,
  meetingDisclosureAutoPost,
  captureMeetingChat,
}: {
  autoJoinScheduledMeetings: SettingItem;
  autoStartScheduledMeetings: SettingItem;
  autoStopMeetings: SettingItem;
  floatingBar: SettingItem;
  meetingDisclosureAutoPost: SettingItem;
  captureMeetingChat: SettingItem;
}) {
  const currentPlatform = platform();
  const supportsMeetingAx =
    currentPlatform === "macos" || currentPlatform === "linux";
  const supportsMicDetection = currentPlatform !== "windows";
  // Fork: scheduled meetings come from the Mac's Calendar only, so these
  // rows show on a Mac only (NN/g heuristic #5, error prevention).
  const supportsCalendar = currentPlatform === "macos";

  return (
    <SettingsGroup title={<Trans>Recording</Trans>}>
      {supportsCalendar && (
        <>
          <SettingSwitchRow
            icon={Play}
            title={<Trans>Start when meeting begins</Trans>}
            description={
              <Trans>Start recording when a scheduled meeting begins.</Trans>
            }
            checked={autoStartScheduledMeetings.value}
            onChange={autoStartScheduledMeetings.onChange}
          />
          <SettingSwitchRow
            icon={VideoCamera}
            title={<Trans>Join scheduled meetings</Trans>}
            description={
              // Fork: a disabled row says why (ux-audit-oct3 E, NN/g #1).
              autoStartScheduledMeetings.value ? (
                <Trans>
                  Open the meeting link when a scheduled meeting begins.
                </Trans>
              ) : (
                // Fork: the setting's name in quotes so the hint parses at a
                // glance (NN/g heuristic #2).
                <Trans>Turn on “Start when meeting begins” first.</Trans>
              )
            }
            checked={autoJoinScheduledMeetings.value}
            onChange={autoJoinScheduledMeetings.onChange}
            disabled={!autoStartScheduledMeetings.value}
          />
        </>
      )}
      {supportsMicDetection && (
        <SettingSwitchRow
          // Fork: a stop symbol in a circle; a bare square read as an
          // unchecked checkbox (NN/g, Icon Usability).
          icon={StopCircle}
          title={<Trans>Stop when meeting ends</Trans>}
          description={<Trans>Stop recording when your call ends.</Trans>}
          checked={autoStopMeetings.value}
          onChange={autoStopMeetings.onChange}
        />
      )}
      {supportsMeetingAx && (
        <>
          <SettingSwitchRow
            icon={Megaphone}
            // Fork: the same words as onboarding (first-run helper, Oct 3).
            title={<Trans>Post a short notice in the meeting chat</Trans>}
            description={
              <Trans>
                Tell participants when recording starts; this does not confirm
                consent.
              </Trans>
            }
            checked={meetingDisclosureAutoPost.value}
            onChange={meetingDisclosureAutoPost.onChange}
          />
          <SettingSwitchRow
            icon={Chats}
            title={<Trans>Save meeting chat to your notes</Trans>}
            description={
              <Trans>
                Save visible chat from supported meetings using Accessibility.
              </Trans>
            }
            checked={captureMeetingChat.value}
            onChange={captureMeetingChat.onChange}
          />
        </>
      )}
      <SettingSwitchRow
        icon={PictureInPicture}
        title={<Trans>Show floating bar</Trans>}
        description={<Trans>Control recording without reopening Upshot.</Trans>}
        checked={floatingBar.value}
        onChange={floatingBar.onChange}
      />
    </SettingsGroup>
  );
}
