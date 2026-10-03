import { platform } from "@tauri-apps/plugin-os";

import type { SectionStatus } from "./shared";

export type OnboardingStep =
  | "permissions"
  | "transcription"
  | "login"
  | "calendar"
  | "imports"
  | "final";

// Fork: no sign-in step (needs upstream services). The calendar step offers
// only the local Apple Calendar; Granola connects the calendar during setup
// (docs.granola.ai/help-center/getting-started/setting-up-granola-for-the-first-time).
// No AI key step either: Granola hosts its models, and so does Upshot AI.
const STEPS_MACOS: OnboardingStep[] = [
  "permissions",
  "transcription",
  "calendar",
  "imports",
  "final",
];
const STEPS_OTHER: OnboardingStep[] = ["imports", "final"];

// Fork: count only the steps that will show. With no meeting app found, the
// imports step is left out, so "Step 3 of 5" never jumps to "Step 5 of 5"
// (NN/g #1; journey-first-run P3).
export type OnboardingStepOptions = { hideImports?: boolean };

export function getOnboardingSteps(
  options: OnboardingStepOptions = {},
): OnboardingStep[] {
  const steps = platform() === "macos" ? STEPS_MACOS : STEPS_OTHER;
  return options.hideImports
    ? steps.filter((step) => step !== "imports")
    : steps;
}

export function getInitialStep(): OnboardingStep {
  return getOnboardingSteps()[0];
}

export function getNextStep(
  currentStep: OnboardingStep,
  options: OnboardingStepOptions = {},
): OnboardingStep | null {
  const steps = getOnboardingSteps(options);
  const idx = steps.indexOf(currentStep);
  return idx < steps.length - 1 ? steps[idx + 1] : null;
}

export function getPrevStep(
  currentStep: OnboardingStep,
  options: OnboardingStepOptions = {},
): OnboardingStep | null {
  const steps = getOnboardingSteps(options);
  const idx = steps.indexOf(currentStep);
  return idx > 0 ? steps[idx - 1] : null;
}

export function getStepStatus(
  step: OnboardingStep,
  currentStep: OnboardingStep,
  options: OnboardingStepOptions = {},
): SectionStatus | null {
  const steps = getOnboardingSteps(options);
  const stepIdx = steps.indexOf(step);
  if (stepIdx === -1) return null;
  const currentIdx = steps.indexOf(currentStep);
  if (stepIdx < currentIdx) return "completed";
  if (stepIdx === currentIdx) return "active";
  return "upcoming";
}

// Fork: "Step n of total" for the active section (UX audit Oct 3, A: NN/g #1).
export function getStepProgress(
  step: OnboardingStep,
  options: OnboardingStepOptions = {},
): { current: number; total: number } | undefined {
  const steps = getOnboardingSteps(options);
  const idx = steps.indexOf(step);
  if (idx === -1) return undefined;
  return { current: idx + 1, total: steps.length };
}
