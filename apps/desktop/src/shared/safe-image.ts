// Fork (red-team finding, grandmaster/sops/red-team.md): AI output must not
// load remote images. The real guard is at render time (isSafeImageSrc in the
// note editor, chat and preview cards). This strip is a second layer for text
// that is saved before it is shown.
import { isSafeImageSrc } from "@anlg/utils/safe-image";

export { isSafeImageSrc };

// Optional title: "t", 't' or (t), possibly on the next line.
const TITLE = String.raw`(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?`;
// Destination: <anything> or a bare URL with balanced parentheses.
const DEST = String.raw`(?:<([^>\n]*)>|([^\s()<>]+(?:\([^\s()]*\)[^\s()<>]*)*))`;

// Inline image: ![alt](url title)
const INLINE_IMAGE = new RegExp(
  String.raw`!\[([^\]]*)\]\(\s*${DEST}${TITLE}\s*\)`,
  "g",
);
// Reference definition: [label]: url title
const REFERENCE_DEFINITION = new RegExp(
  String.raw`^ {0,3}\[([^\]]+)\]:[ \t]*\n?[ \t]*${DEST}${TITLE}[ \t]*$`,
  "gm",
);
// Reference image: ![alt][label], ![alt][] or ![alt]
const REFERENCE_IMAGE = /!\[([^\]]*)\](?:\[([^\]]*)\])?(?![(:])/g;

function normalizeLabel(label: string) {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

export function stripRemoteMarkdownImages(text: string): string {
  const unsafeLabels = new Set<string>();
  const withoutDefinitions = text.replace(
    REFERENCE_DEFINITION,
    (match, label: string, angled?: string, bare?: string) => {
      if (isSafeImageSrc(angled ?? bare)) return match;
      unsafeLabels.add(normalizeLabel(label));
      return "";
    },
  );

  const withoutInline = withoutDefinitions.replace(
    INLINE_IMAGE,
    (match, alt: string, angled?: string, bare?: string) =>
      isSafeImageSrc(angled ?? bare) ? match : alt,
  );

  if (unsafeLabels.size === 0) return withoutInline;
  return withoutInline.replace(
    REFERENCE_IMAGE,
    (match, alt: string, label?: string) =>
      unsafeLabels.has(normalizeLabel(label || alt)) ? alt : match,
  );
}
