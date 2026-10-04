// Fork: Upshot makes no sounds except playback of the user's own recordings
// (owner decision, Oct 3). Granola's Mac app is silent; it chimes only on
// Apple Watch, where the screen isn't in view (docs.granola.ai/help-center/
// ios/apple-watch). The export stays so upstream callers compile unchanged.
export async function playCompletionSound(): Promise<void> {}
