// Fork: Upshot's own plan, separate from the upstream billing context (whose
// isPro stays forced on for upstream features). Free is "Auto" only; Pro
// picks a model in the chat composer, as in Granola
// (docs.granola.ai/help-center/getting-more-from-your-notes/understanding-model-selection-in-granola-chat).

/** Whether this user has Upshot Pro. Payments wire this; false until then. */
export function useUpshotPro(): boolean {
  return false;
}

/** Start the Upshot Pro upgrade. Payments wire this; a no-op until then. */
export function openUpgrade(): void {}
