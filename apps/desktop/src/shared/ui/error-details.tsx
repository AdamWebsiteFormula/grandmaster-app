import { Trans } from "@lingui/react/macro";

import { cn } from "@anlg/utils";

// Fork: the raw error (a server code, a model's reply) sits behind "Show
// details", closed by default, so the plain message leads and support can
// still read it (error sweep, Oct 12; Microsoft Windows UX guidelines, Error
// messages: put technical details in a Details expander; NN/g #9: plain
// language, no codes). Native <details> works with Tab, Return and VoiceOver.
export function ErrorDetails({
  detail,
  className,
}: {
  detail: string;
  className?: string;
}) {
  return (
    <details className={cn(["group text-xs", className])}>
      <summary
        className={cn([
          "w-fit cursor-default rounded-sm opacity-80 hover:underline",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        ])}
      >
        <span className="group-open:hidden">
          <Trans>Show details</Trans>
        </span>
        <span className="hidden group-open:inline">
          <Trans>Hide details</Trans>
        </span>
      </summary>
      <p className="mt-1 break-words opacity-80 select-text">{detail}</p>
    </details>
  );
}
