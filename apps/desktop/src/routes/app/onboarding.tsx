import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { useMountEffect } from "@anlg/ui/hooks/use-mount-effect";

import { resolveShellEntryPath } from "./-resolve-entry-path";

import { promptMoveToApplications } from "~/main/move-to-applications";
import { StandaloneOnboardingScreen } from "~/onboarding";
import { useTabs } from "~/store/zustand/tabs";

export const Route = createFileRoute("/app/onboarding")({
  component: Component,
});

function Component() {
  const navigate = useNavigate();
  const openCurrent = useTabs((state) => state.openCurrent);

  // Fork: first launch from the disk image lands here, so ask before setup
  // (journey-first-run P3).
  useMountEffect(() => {
    void promptMoveToApplications().catch((error: unknown) => {
      console.error("[launch] move-to-Applications check failed", error);
    });
  });

  // Fork: land on Home, not the Welcome note (Granola Setup guide;
  // journey-first-run P1). The welcome and example notes are listed there.
  const handleFinish = useCallback(
    (_sessionId: string) => {
      openCurrent({ type: "empty" });
      void (async () => {
        await navigate({ to: await resolveShellEntryPath() });
      })();
    },
    [navigate, openCurrent],
  );

  return <StandaloneOnboardingScreen onFinish={handleFinish} />;
}
