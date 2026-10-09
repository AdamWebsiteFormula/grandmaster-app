const NETWORK_ERROR_PATTERN =
  /failed to fetch|load failed|network|offline|internet|ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|could not connect|couldn't connect|unable to connect|dns/i;

// Fork: one test for "can't reach the internet", shared by the summary
// error card and the chat error bubble (NN/g #4, #9).
export function isNetworkError(error: Error | undefined): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }

  return Boolean(error && NETWORK_ERROR_PATTERN.test(error.message));
}
