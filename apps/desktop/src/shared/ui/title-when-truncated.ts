import type { MouseEvent } from "react";

// Fork: a help tag with the full text only when it is cut off, as a Mac list
// shows an expansion tooltip for a truncated row (Apple HIG, Offering help;
// truncation sweep, Oct 12). Same rule as the Settings account header.
export function titleWhenTruncated(event: MouseEvent<HTMLElement>) {
  const el = event.currentTarget;
  const cutOff =
    el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
  if (cutOff) {
    el.title = el.textContent ?? "";
  } else {
    el.removeAttribute("title");
  }
}
