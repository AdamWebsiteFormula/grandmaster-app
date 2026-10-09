import { t } from "@lingui/core/macro";

import { toast } from "@anlg/ui/components/ui/toast";

import { DEVICE_AUTH_REASON } from "./auth";
import { useAppLock } from "./store";

import { updateSession } from "~/session/queries";

export async function setSessionLocked(
  sessionId: string,
  locked: boolean,
): Promise<boolean> {
  const reason = locked
    ? DEVICE_AUTH_REASON.lockNote
    : DEVICE_AUTH_REASON.unlockNote;
  const ok = await useAppLock.getState().authenticate(reason);
  if (!ok) return false;
  await updateSession(sessionId, { locked });
  if (locked) {
    useAppLock.getState().concealNote(sessionId);
  } else {
    useAppLock.getState().markNoteRevealed(sessionId);
  }
  return true;
}

// Fork: a lock that failed to save said nothing, so the note looked locked
// when it was not (task sweep, Oct 9; NN/g #1, #9).
export async function toggleSessionLock(
  sessionId: string,
  locked: boolean,
): Promise<void> {
  try {
    await setSessionLocked(sessionId, locked);
  } catch (error) {
    console.error("[lock] failed to change note lock", error);
    toast.error(
      locked
        ? t`Couldn't lock this note. Try again.`
        : t`Couldn't unlock this note. Try again.`,
    );
  }
}

export async function revealLockedNote(sessionId: string): Promise<boolean> {
  return useAppLock
    .getState()
    .revealNote(sessionId, DEVICE_AUTH_REASON.openApp);
}
