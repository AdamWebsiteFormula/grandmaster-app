// Fork (red-team finding, grandmaster/sops/red-team.md): AI output must not
// load remote images. A prompt-injected answer could put meeting text in an
// image URL, and the app would send it to that server just by showing it.
// Only images that already live on this Mac may load.

const LOCAL_SCHEMES = ["data:", "blob:", "asset:"];
const LOCAL_ASSET_HOSTS = ["asset.localhost"];

export function isSafeImageSrc(src: string | undefined | null): boolean {
  if (!src) return false;
  const value = src.trim().toLowerCase();
  if (LOCAL_SCHEMES.some((scheme) => value.startsWith(scheme))) return true;
  try {
    const url = new URL(value);
    return LOCAL_ASSET_HOSTS.includes(url.hostname);
  } catch {
    // Relative paths have no scheme or host and cannot reach a server.
    return !/^[a-z][a-z0-9+.-]*:/.test(value) && !value.startsWith("//");
  }
}

// Markdown image: ![alt](url "title"). Keeps the alt text, drops the image.
const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;

export function stripRemoteMarkdownImages(text: string): string {
  return text.replace(MARKDOWN_IMAGE, (match, alt: string, src: string) =>
    isSafeImageSrc(src) ? match : alt,
  );
}
