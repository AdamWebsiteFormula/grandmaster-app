// Fork (red-team finding, grandmaster/sops/red-team.md): AI output must not
// load remote images. A prompt-injected answer could put meeting text in an
// image URL, and the app would send it to that server just by showing it.
// Only images that already live on this Mac may load. Shared by the note
// editor and the desktop app so both check the same way.

const LOCAL_SCHEMES = ["data:", "blob:", "asset:"];
const LOCAL_ASSET_HOSTS = ["asset.localhost"];

export function isSafeImageSrc(src: string | undefined | null): boolean {
  if (!src) return false;
  // Browsers drop tabs and newlines anywhere in a URL, ignore leading control
  // characters and spaces, and read "\" as "/". Do the same before checking.
  const value = src
    .replace(/[\t\n\r]/g, "")
    .replace(/^[\u0000- ]+/, "")
    .trim()
    .toLowerCase()
    .replace(/\\/g, "/");
  if (!value) return false;
  if (LOCAL_SCHEMES.some((scheme) => value.startsWith(scheme))) return true;
  try {
    const url = new URL(value);
    return LOCAL_ASSET_HOSTS.includes(url.hostname);
  } catch {
    // Relative paths have no scheme or host and cannot reach a server.
    return !/^[a-z][a-z0-9+.-]*:/.test(value) && !value.startsWith("//");
  }
}
