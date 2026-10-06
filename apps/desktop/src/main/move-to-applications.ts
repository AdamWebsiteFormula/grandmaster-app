import { t } from "@lingui/core/macro";
import { resourceDir } from "@tauri-apps/api/path";
import { ask } from "@tauri-apps/plugin-dialog";
import { platform } from "@tauri-apps/plugin-os";
import { exit } from "@tauri-apps/plugin-process";

import { commands as openerCommands } from "@anlg/plugin-opener2";

// Fork: ask to move Upshot to Applications when it runs from the mounted disk
// image or a Gatekeeper App Translocation path. Ejecting the disk image quits
// the app, and translocated paths change on every launch. Granola's Setup
// guide step 3 is "drag to Applications"; Apple Gatekeeper path randomization.
// Journey-first-run P3. Upshot doesn't copy itself: the user drags it in
// Finder, which also ends translocation (a scripted copy would keep it).

export function getBundlePath(resourcePath: string): string | null {
  const index = resourcePath.indexOf(".app/");
  if (index === -1) {
    return resourcePath.endsWith(".app") ? resourcePath : null;
  }
  return resourcePath.slice(0, index + ".app".length);
}

export function isRunningFromDiskImage(bundlePath: string): boolean {
  return (
    bundlePath.startsWith("/Volumes/") ||
    bundlePath.includes("/AppTranslocation/")
  );
}

let checked = false;

export async function promptMoveToApplications(): Promise<void> {
  if (checked) return;
  checked = true;
  if (platform() !== "macos") return;

  const bundlePath = getBundlePath(await resourceDir());
  if (!bundlePath || !isRunningFromDiskImage(bundlePath)) return;

  const move = await ask(
    t`Upshot is running from the disk image, so it quits when you eject it. Click Move to quit Upshot and open Applications, then drag Upshot there and open it again.`,
    {
      title: t`Move Upshot to Applications`,
      kind: "warning",
      okLabel: t`Move`,
      // Fork: "Cancel", so Esc dismisses it (Apple HIG, Alerts: title the
      // button that cancels "Cancel"; NSAlert gives Esc to that title).
      cancelLabel: t`Cancel`,
    },
  );
  if (!move) return;

  await openerCommands.openPath("/Applications", null);
  if (bundlePath.startsWith("/Volumes/")) {
    await openerCommands.revealItemInDir(bundlePath);
  }
  await exit(0);
}

export function resetMoveToApplicationsCheckForTests() {
  checked = false;
}
