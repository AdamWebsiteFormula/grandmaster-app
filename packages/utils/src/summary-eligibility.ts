export const MIN_WORDS_FOR_SUMMARY = 5;
export const MIN_TRANSCRIPT_CHARACTERS_FOR_SUMMARY = 160;
// Fork: My notes now always offers Generate summary, which can run on typed
// notes when too little was said (Granola enhances notes after any meeting:
// docs.granola.ai/help-center/getting-started/granola-101; NN/g #1, #3).
export const TOO_SHORT_FOR_SUMMARY =
  "Too little was said for a full summary. Click Generate summary in My notes to make one from your notes anyway.";

export type SummaryEligibilitySkipCode =
  | "no_transcript"
  | "transcript_too_short";

export type SummaryEligibility =
  | { eligible: true; characterCount: number; wordCount: number }
  | {
      eligible: false;
      code: SummaryEligibilitySkipCode;
      characterCount: number;
      reason: string;
      wordCount: number;
    };

export function getSummaryEligibility({
  transcriptCount,
  wordCount,
  characterCount,
}: {
  transcriptCount: number;
  wordCount: number;
  characterCount: number;
}): SummaryEligibility {
  if (transcriptCount === 0) {
    return {
      eligible: false,
      code: "no_transcript",
      reason: "No transcript recorded",
      characterCount: 0,
      wordCount: 0,
    };
  }

  if (wordCount < MIN_WORDS_FOR_SUMMARY) {
    return {
      eligible: false,
      code: "transcript_too_short",
      // Fork: plain words, not counts (ux-audit-oct3 C, NN/g #9).
      reason: TOO_SHORT_FOR_SUMMARY,
      characterCount,
      wordCount,
    };
  }

  if (characterCount < MIN_TRANSCRIPT_CHARACTERS_FOR_SUMMARY) {
    return {
      eligible: false,
      code: "transcript_too_short",
      // Fork: plain words, not counts (ux-audit-oct3 C, NN/g #9).
      reason: TOO_SHORT_FOR_SUMMARY,
      characterCount,
      wordCount,
    };
  }

  return { eligible: true, characterCount, wordCount };
}
