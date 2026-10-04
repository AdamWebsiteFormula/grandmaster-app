import { getCurrentWindow } from "@tauri-apps/api/window";

import { WindowsWindowControls } from "~/main/windows-window-controls";
import { usesWindowsStyleTitleBar } from "~/shared/hooks/useWindowControlsGutter";

export function StandaloneWindowShell({
  children,
  topDragRegion = true,
}: {
  children: React.ReactNode;
  topDragRegion?: boolean;
}) {
  // Fork: on Windows and Linux the main window has no OS title bar
  // (plugins/windows v1.rs), so onboarding there gets the main title bar's
  // minimize, maximize and close buttons, top right (Microsoft "Title bar"
  // design guidance: caption buttons are always present). Other windows keep
  // their OS title bar.
  const windowControls =
    usesWindowsStyleTitleBar() && getCurrentWindow().label === "main";

  return (
    <div className="relative flex h-full flex-col">
      {topDragRegion ? (
        <div
          data-tauri-drag-region
          data-standalone-window-top-drag-region
          className="absolute inset-x-0 top-0 z-20 h-10"
        />
      ) : null}
      {windowControls ? (
        <div className="absolute top-0 right-0 z-50 flex h-10">
          <WindowsWindowControls />
        </div>
      ) : null}
      {children}
    </div>
  );
}
