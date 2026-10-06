import {
  useSmoothCorners,
  type EffectsConfig,
  type SmoothCornerOptions,
} from "@lisse/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";

import { controlSquircle } from "@anlg/ui/lib/squircle";

// Fork: Lisse copies an element's CSS border into its overlay once, when the
// element mounts, so after a light/dark switch the border kept the old
// theme's color (picture review, Oct 6: a light 54% gray border on the dark
// Settings search). One shared observer reports the theme class, and each
// squircle turns auto effects off for one render and back on, which makes
// Lisse restore the CSS border and read it again.
const themeListeners = new Set<() => void>();
let themeObserver: MutationObserver | null = null;

function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  if (!themeObserver && typeof document !== "undefined") {
    themeObserver = new MutationObserver(() => {
      for (const notify of themeListeners) notify();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }
  return () => {
    themeListeners.delete(listener);
    if (themeListeners.size === 0) {
      themeObserver?.disconnect();
      themeObserver = null;
    }
  };
}

function isDarkTheme() {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  );
}

// Transitions stay off while Lisse reads the border again: otherwise it reads
// a color still fading from the old theme, or from currentColor, which its
// inline `border: 0` had set (the box came back with a near-black border).
function useBorderRefresh(ref: { current: HTMLElement | null }) {
  const dark = useSyncExternalStore(subscribeTheme, isDarkTheme, () => false);
  const lastDark = useRef(dark);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (lastDark.current === dark) return;
    lastDark.current = dark;
    if (ref.current) ref.current.style.transition = "none";
    setRefreshing(true);
  }, [dark, ref]);

  useEffect(() => {
    if (refreshing) {
      setRefreshing(false);
      return;
    }
    const el = ref.current;
    if (!el || el.style.transition !== "none") return;
    const frame = requestAnimationFrame(() => {
      el.style.transition = "";
    });
    return () => cancelAnimationFrame(frame);
  }, [refreshing, ref]);

  return refreshing;
}

export function useSquircleRef<T extends HTMLElement>(
  forwardedRef?: Ref<T>,
  corners: SmoothCornerOptions = controlSquircle,
  effects?: EffectsConfig,
) {
  const localRef = useRef<T | null>(null);
  const fallbackRadius =
    "radius" in corners && typeof corners.radius === "number"
      ? `${corners.radius}px`
      : `${controlSquircle.radius}px`;

  const refreshingBorder = useBorderRefresh(localRef);

  useSmoothCorners(localRef, corners, {
    autoEffects: !refreshingBorder,
    effects,
    // CSS radius intersects clip-path and squares the curve; Lisse clears this
    // after the clip-path lands and restores it on teardown.
    fallbackBorderRadius: fallbackRadius,
    // Omit skipShadowHandle so extracted box-shadows (shadow-xs) paint on
    // the parent overlay instead of being clipped on the host.
  });

  return useCallback(
    (node: T | null) => {
      localRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );
}
