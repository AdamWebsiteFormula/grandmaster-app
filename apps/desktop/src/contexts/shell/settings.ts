import { useCallback } from "react";

import { useTabs } from "~/store/zustand/tabs";

export function useSettings() {
  const openNew = useTabs((state) => state.openNew);

  const openSettings = useCallback(() => {
    openNew({ type: "settings" });
  }, [openNew]);

  // Fork: ⌘, is the native "Settings…" menu item's accelerator now; a web
  // hotkey too would open Settings twice (UX audit Oct 3, A: HIG menu bar).

  return { openSettings };
}
