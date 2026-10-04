export const WELCOME_NOTE_DEMO_URL = "";
export const WELCOME_NOTE_TRACKING_ID = "anarlog-onboarding-demo-v1";

// Fork: the welcome note is a how-to, not a meeting, so meeting actions
// (Generate summary, Draft follow-up email) stay off it (NN/g #8).
export function isWelcomeNoteEvent(eventJson: string | null | undefined) {
  if (!eventJson) return false;
  try {
    const event = JSON.parse(eventJson) as { tracking_id?: unknown } | null;
    return event?.tracking_id === WELCOME_NOTE_TRACKING_ID;
  } catch {
    return false;
  }
}
// Fork: the seeded "Example: Product sync" meeting (onboarding/example-note.ts).
export const EXAMPLE_NOTE_TRACKING_ID = "upshot-onboarding-example-v1";
const WELCOME_NOTE_COMPLETE_PATH = "/onboarding-demo/complete";
const WELCOME_NOTE_DEMO_AUTOJOIN_PARAM = "autojoin";

export function buildWelcomeNoteDemoUrl(meetingLink: string, port?: number) {
  const url = new URL(meetingLink);
  url.searchParams.set(WELCOME_NOTE_DEMO_AUTOJOIN_PARAM, "1");
  if (port != null) {
    url.searchParams.set(
      "completion_url",
      `http://127.0.0.1:${port}${WELCOME_NOTE_COMPLETE_PATH}`,
    );
  }
  return url.toString();
}
