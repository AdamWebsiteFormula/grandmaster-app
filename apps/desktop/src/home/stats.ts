// Fork (F5): pure math behind the home stat cards. Everything runs on this
// Mac from local SQLite aggregates; nothing here talks to the network.

/** Typing speed used to turn AI-written words into time saved. */
export const TYPING_WPM = 40;

// ---------- Time saved ----------

export type TimeSavedTier = "coffee" | "lunch" | "workday" | "week";

export function minutesSaved(words: number): number {
  if (!Number.isFinite(words) || words <= 0) return 0;
  return words / TYPING_WPM;
}

export function timeSavedTier(minutes: number): TimeSavedTier {
  if (minutes >= 40 * 60) return "week";
  if (minutes >= 8 * 60) return "workday";
  if (minutes >= 30) return "lunch";
  return "coffee";
}

/** "1 min", "42 min", "3 h 20 min", "12 h". Never "0". */
export function formatMinutes(minutes: number): string {
  const total = Math.max(1, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours >= 10 || rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

// ---------- Talk share ----------

export type ChannelSpeech = {
  /** 0 = mic (you), 1 = system audio (them). */
  channel: number;
  words: number;
  /** Speaking time: word durations plus short pauses between words. */
  speech_ms: number;
};

export type TalkShare = { percent: number; wpm: number | null };

/** Below this much speech in the window the card shows its call to action. */
export const MIN_SPEECH_MS = 30_000;
/** wpm needs at least a minute of your own speech to mean anything. */
const MIN_WPM_SPEECH_MS = 60_000;

export function talkShare(rows: ChannelSpeech[]): TalkShare | null {
  let youMs = 0;
  let themMs = 0;
  let youWords = 0;
  for (const row of rows) {
    const ms = Number.isFinite(row.speech_ms) ? Math.max(0, row.speech_ms) : 0;
    if (row.channel === 0) {
      youMs += ms;
      youWords += Math.max(0, row.words || 0);
    } else if (row.channel === 1) {
      themMs += ms;
    }
  }
  const total = youMs + themMs;
  if (total < MIN_SPEECH_MS) return null;
  const percent = Math.round((youMs / total) * 100);
  const wpm =
    youMs >= MIN_WPM_SPEECH_MS ? Math.round(youWords / (youMs / 60_000)) : null;
  return { percent, wpm };
}

// ---------- Wrap-up streak ----------

export type MeetingDay = {
  /** When the meeting (its first transcript) started, epoch ms. */
  started_at_ms: number;
  /** 1 when the meeting has an enhanced note. */
  enhanced: number;
};

export type Streak = {
  /** Consecutive workdays where every transcribed meeting was enhanced. */
  days: number;
  /** Today has a meeting that is not wrapped up yet. Never breaks the streak. */
  todayPending: boolean;
};

/** How far back the streak looks. Also bounds the SQL. */
export const STREAK_LOOKBACK_DAYS = 366;

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * Walks back from today, one local calendar day at a time.
 * - Saturdays and Sundays are skipped: they never count and never break it.
 * - Workdays with no transcribed meeting are skipped the same way.
 * - Today with an unfinished meeting is pending, not broken.
 * - Any earlier workday with a meeting that was not enhanced ends the streak.
 */
export function wrapUpStreak(meetings: MeetingDay[], now: Date): Streak {
  const days = new Map<string, boolean>();
  for (const meeting of meetings) {
    if (!Number.isFinite(meeting.started_at_ms)) continue;
    if (meeting.started_at_ms > now.getTime()) continue;
    const key = dayKey(new Date(meeting.started_at_ms));
    const done = Boolean(meeting.enhanced);
    days.set(key, (days.get(key) ?? true) && done);
  }

  let count = 0;
  let todayPending = false;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 0; i < STREAK_LOOKBACK_DAYS; i += 1) {
    const weekday = cursor.getDay();
    const allDone = days.get(dayKey(cursor));
    if (weekday !== 0 && weekday !== 6 && allDone !== undefined) {
      if (allDone) count += 1;
      else if (i === 0) todayPending = true;
      else break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return { days: count, todayPending };
}

// ---------- AI cost estimate ----------

/** Enhance does not record token usage, so cost is an estimate: chars ÷ 4. */
export const CHARS_PER_TOKEN = 4;
/** Average English word plus its space, used for note output. */
export const CHARS_PER_WORD = 6;
/** System prompt and template sent with every Enhance run. */
export const PROMPT_OVERHEAD_TOKENS = 1_500;

export type ModelPrice =
  | { kind: "local" }
  | { kind: "subscription" }
  | { kind: "included" }
  | { kind: "api"; inputPerMillion: number; outputPerMillion: number };

const LOCAL_PROVIDERS = new Set([
  "apple_foundation",
  "lmstudio",
  "ollama",
  "unsloth",
]);
const SUBSCRIPTION_PROVIDERS = new Set([
  "claude",
  "chatgpt",
  "github_copilot",
  "kimi_code",
]);

// List prices (USD per 1M tokens), checked Oct 2, 2026:
// Claude Sonnet 5.5 and 5 $2/$10, Haiku 4.5 $1/$5
// (platform.claude.com/docs/en/about-claude/pricing);
// Gemini 3.x Flash $0.75/$3.75 intro price through Dec 31, 2026
// (cloud.google.com Gemini pricing). Any other cloud model uses the
// Sonnet-class rate, so the estimate leans high, never low.
// TODO(F1): prefer the model catalog price once it ships.
const DEFAULT_API_PRICE: ModelPrice = {
  kind: "api",
  inputPerMillion: 2,
  outputPerMillion: 10,
};

export function priceFor(
  provider: string | undefined,
  model: string | undefined,
): ModelPrice | null {
  if (!provider) return null;
  if (LOCAL_PROVIDERS.has(provider)) return { kind: "local" };
  if (SUBSCRIPTION_PROVIDERS.has(provider)) return { kind: "subscription" };
  // Fork: Upshot AI is hosted at no charge to the user.
  if (provider === "anarlog") return { kind: "included" };
  const id = (model ?? "").toLowerCase();
  if (id.includes("haiku")) {
    return { kind: "api", inputPerMillion: 1, outputPerMillion: 5 };
  }
  if (id.includes("gemini") && id.includes("flash")) {
    return { kind: "api", inputPerMillion: 0.75, outputPerMillion: 3.75 };
  }
  return DEFAULT_API_PRICE;
}

export type MonthUsage = {
  /** Enhanced notes generated this month. */
  generations: number;
  /** Transcript characters sent to the model across those runs. */
  input_chars: number;
  /** Words the model wrote. */
  output_words: number;
};

export function estimateCostUsd(usage: MonthUsage, price: ModelPrice): number {
  if (price.kind !== "api") return 0;
  const inputTokens =
    Math.max(0, usage.input_chars) / CHARS_PER_TOKEN +
    Math.max(0, usage.generations) * PROMPT_OVERHEAD_TOKENS;
  const outputTokens =
    (Math.max(0, usage.output_words) * CHARS_PER_WORD) / CHARS_PER_TOKEN;
  return (
    (inputTokens * price.inputPerMillion +
      outputTokens * price.outputPerMillion) /
    1_000_000
  );
}

export function formatUsd(amount: number): string {
  if (amount > 0 && amount < 0.01) return "< $0.01";
  return `$${amount.toFixed(2)}`;
}
