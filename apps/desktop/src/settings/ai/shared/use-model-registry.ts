import { useSyncExternalStore } from "react";

import {
  getRegistryState,
  type RegistryState,
  subscribeRegistry,
} from "./model-registry";

export function useModelRegistry(): RegistryState {
  return useSyncExternalStore(subscribeRegistry, getRegistryState);
}

/** "just now", "5 min ago", "2 h ago", "3 days ago". */
export function formatUpdatedAgo(
  fetchedAt: string | null,
  now: number = Date.now(),
): string | null {
  if (!fetchedAt) return null;
  const then = Date.parse(fetchedAt);
  if (!Number.isFinite(then)) return null;
  const minutes = Math.max(0, Math.floor((now - then) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}
