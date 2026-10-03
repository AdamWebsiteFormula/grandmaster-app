import type { ImgHTMLAttributes, ReactNode } from "react";
import { Streamdown } from "streamdown";

import { CircleNotch, XCircle } from "@anlg/ui/components/icons";
import { streamdownIcons } from "@anlg/ui/components/streamdown-icons";
import { cn } from "@anlg/utils";

import { extractMcpOutputText } from "~/chat/mcp/mcp-output-parser";
import { isSafeImageSrc } from "~/shared/safe-image";

export function ToolCard({
  failed,
  children,
}: {
  failed?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn([
        "my-2.5 overflow-hidden rounded-xl border shadow-sm",
        failed ? "border-destructive/40" : "border-border/80",
      ])}
    >
      {children}
    </div>
  );
}

export function ToolCardHeader({
  icon,
  running,
  failed,
  done,
  label,
}: {
  icon: ReactNode;
  running: boolean;
  failed: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div
      className={cn([
        "flex items-center gap-2.5 px-3.5 py-2 text-sm",
        failed
          ? "bg-destructive/10 text-destructive"
          : "bg-muted/80 text-muted-foreground",
      ])}
    >
      {running ? (
        <CircleNotch className="h-4 w-4 animate-spin" />
      ) : (
        <span
          className={cn([
            "shrink-0 [&>svg]:h-4 [&>svg]:w-4",
            failed
              ? "text-destructive"
              : done
                ? "text-primary"
                : "text-muted-foreground",
          ])}
        >
          {icon}
        </span>
      )}
      <span className="font-medium">{label}</span>
    </div>
  );
}

export function ToolCardBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2.5 px-3.5 py-2.5">{children}</div>;
}

export function ToolCardFooterError({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-destructive/40 bg-destructive/10 px-3.5 py-2.5">
      <XCircle className="h-4 w-4 shrink-0 text-destructive" />
      <p className="text-sm text-destructive">{text}</p>
    </div>
  );
}

function ToolCardFooterRaw({ text }: { text: string }) {
  return (
    <div className="border-border/80 bg-muted/80 border-t px-3.5 py-2.5">
      <p className="text-muted-foreground text-sm whitespace-pre-wrap">
        {text}
      </p>
    </div>
  );
}

export function useToolState(part: { state: string }) {
  const running =
    part.state === "input-streaming" || part.state === "input-available";
  const failed = part.state === "output-error";
  const done = part.state === "output-available";
  return { running, failed, done };
}

export function useMcpOutput<T>(
  done: boolean,
  output: unknown,
  parseFn: (output: unknown) => T | null,
): { parsed: T | null; rawText: string | null } {
  const parsed = done ? parseFn(output) : null;
  const rawText = done && !parsed ? extractMcpOutputText(output) : null;
  return { parsed, rawText };
}

export function ToolCardFooters({
  failed,
  errorText,
  rawText,
  children,
}: {
  failed: boolean;
  errorText?: unknown;
  rawText: string | null;
  children?: ReactNode;
}) {
  return (
    <>
      {children}
      {failed ? (
        <ToolCardFooterError text={String(errorText ?? "Unknown error")} />
      ) : null}
      {rawText ? <ToolCardFooterRaw text={rawText} /> : null}
    </>
  );
}

// Fork: the preview streams before Apply, so a remote image here would load
// (and leak its URL) before the user decides. Same rule as chat messages.
const previewComponents = {
  img: (props: ImgHTMLAttributes<HTMLImageElement>) =>
    isSafeImageSrc(typeof props.src === "string" ? props.src : null) ? (
      <img {...props} className="max-w-full" />
    ) : props.alt ? (
      <span>{props.alt}</span>
    ) : null,
};

export function MarkdownPreview({ children }: { children: string }) {
  return (
    <div className="border-border/80 bg-card rounded-lg border">
      <div className="max-h-64 overflow-y-auto px-3 py-2.5">
        <Streamdown
          icons={streamdownIcons}
          className="text-muted-foreground text-sm leading-relaxed"
          linkSafety={{ enabled: false }}
          components={previewComponents}
        >
          {children}
        </Streamdown>
      </div>
    </div>
  );
}
