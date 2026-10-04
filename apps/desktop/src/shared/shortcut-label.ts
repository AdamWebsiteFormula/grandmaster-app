import { platform } from "@tauri-apps/plugin-os";

// Fork: shortcut hints follow the computer they run on. A Mac shows the
// ⌥ ⇧ ⌘ glyphs in Apple's order (Apple HIG, Keyboards); Windows and Linux
// name the keys joined by "+", as in Ctrl+Shift+N, and never show ⌘
// (Microsoft Writing Style Guide, Keys and keyboard shortcuts). Keys are
// written as react-hotkeys-hook reads them: "mod" is ⌘ on a Mac, Ctrl
// elsewhere.

type Platform = ReturnType<typeof platform>;

/** The OS, or null outside the Tauri runtime (unit tests, previews). */
export function runtimePlatform(): Platform | null {
  try {
    return platform();
  } catch {
    return null;
  }
}

/** True on a Mac, and with no runtime, so tests and previews keep the Mac UI. */
export function isMac(currentPlatform = runtimePlatform()) {
  return currentPlatform === null || currentPlatform === "macos";
}

const MAC_ORDER = ["alt", "shift", "mod"];
const PC_ORDER = ["mod", "alt", "shift"];
const MAC_NAMES: Record<string, string> = {
  mod: "⌘",
  alt: "⌥",
  shift: "⇧",
  enter: "↵",
};
const PC_NAMES: Record<string, string> = {
  mod: "Ctrl",
  alt: "Alt",
  shift: "Shift",
  enter: "Enter",
};

function ordered(keys: readonly string[], order: readonly string[]) {
  return [
    ...order.filter((key) => keys.includes(key)),
    ...keys.filter((key) => !order.includes(key)),
  ];
}

function keyNames(keys: readonly string[], mac: boolean) {
  const names = mac ? MAC_NAMES : PC_NAMES;
  return ordered(keys, mac ? MAC_ORDER : PC_ORDER).map(
    (key) => names[key] ?? key,
  );
}

/** "⇧⌘N" on a Mac, "Ctrl+Shift+N" elsewhere: a hint inside text. */
export function shortcutLabel(
  keys: readonly string[],
  currentPlatform = runtimePlatform(),
) {
  const mac = isMac(currentPlatform);
  return keyNames(keys, mac).join(mac ? "" : "+");
}

/** "⇧ ⌘ N" on a Mac, "Ctrl+Shift+N" elsewhere: the text of a <Kbd>. */
export function kbdLabel(
  keys: readonly string[],
  currentPlatform = runtimePlatform(),
) {
  const mac = isMac(currentPlatform);
  return keyNames(keys, mac).join(mac ? " " : "+");
}

/** "Meta+J" on a Mac, "Control+J" elsewhere, for aria-keyshortcuts. */
export function ariaKeyShortcut(
  keys: readonly string[],
  currentPlatform = runtimePlatform(),
) {
  const mac = isMac(currentPlatform);
  const names: Record<string, string> = {
    mod: mac ? "Meta" : "Control",
    alt: "Alt",
    shift: "Shift",
    enter: "Enter",
  };
  return ordered(keys, PC_ORDER)
    .map((key) => names[key] ?? key)
    .join("+");
}
