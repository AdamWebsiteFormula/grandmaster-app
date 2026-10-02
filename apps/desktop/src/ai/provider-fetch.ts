import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export const providerFetch: typeof fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  // Fork: strip Origin for every provider, not only local ones. With the
  // webview Origin, api.anthropic.com treats the call as browser CORS and
  // rejects valid keys with 401.
  if (url.protocol === "http:" || url.protocol === "https:") {
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    if (!headers.has("Origin")) {
      // Tauri's unsafe-headers transport removes an empty Origin instead of
      // injecting the webview origin, which local servers can reject.
      headers.set("Origin", "");
      return tauriFetch(input, { ...init, headers });
    }
  }

  return tauriFetch(input, init);
};
