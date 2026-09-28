import { useMountEffect } from "~/shared/hooks/useMountEffect";
import { recoverRunningBatchSessions } from "~/store/zustand/listener/general-batch";
import { listenerStore } from "~/store/zustand/listener/instance";

export function BatchTranscriptionRecovery() {
  useMountEffect(() => {
    let active = true;
    let stop: (() => void) | undefined;

    void recoverRunningBatchSessions(listenerStore.getState)
      .then((dispose) => {
        if (!active) {
          dispose();
          return;
        }
        stop = dispose;
      })
      .catch((error) => {
        console.error("[listener] failed to recover batch sessions", error);
      });

    return () => {
      active = false;
      stop?.();
    };
  });

  return null;
}
