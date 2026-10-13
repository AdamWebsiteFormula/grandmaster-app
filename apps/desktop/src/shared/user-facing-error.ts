// Fork: an error whose message is our own words, written for people. Any
// other error (a Rust command, a server, a model) is logged, and people see
// a plain line instead of its raw text (error sweep, Oct 12; NN/g error
// message guidelines: plain language, no codes).
export class UserFacingError extends Error {}

export function userFacingMessage(error: unknown, fallback: string): string {
  if (error instanceof UserFacingError) return error.message;
  return fallback;
}
