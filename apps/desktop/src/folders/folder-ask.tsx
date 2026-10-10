// Fork: a folder page asks about its own notes, as Granola's spaces put a
// chat field under the space header (journey-after P2 "Folder page";
// granola-screens/11; docs.granola.ai/help-center/sharing/folders/spaces-and-folders).
// Sending opens the floating chat; while the folder page is open the chat
// carries this folder as its context (chat/components/chat-panel.tsx).
import { useLingui } from "@lingui/react/macro";
import { type FormEvent, useState } from "react";

import { ArrowUp } from "@anlg/ui/components/icons";
import { cn } from "@anlg/utils";

import { queueChatPrompt } from "~/chat/pending-prompt";
import { useShell } from "~/contexts/shell";
import { folderDisplayName } from "~/session/folders";

export function FolderAskComposer({ folderPath }: { folderPath: string }) {
  const { t } = useLingui();
  const { chat } = useShell();
  const [value, setValue] = useState("");
  const name = folderDisplayName(folderPath);

  // The open chat has its own field; never show two (home-composer.tsx).
  if (chat.mode !== "FloatingClosed") return null;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = value.trim();
    if (!text) return;
    chat.startNewChat();
    queueChatPrompt(text);
    chat.sendEvent({ type: "OPEN" });
    setValue("");
  };

  return (
    <form
      onSubmit={onSubmit}
      className={cn([
        "bg-card border-input flex items-center gap-2 rounded-2xl border py-1.5 pr-1.5 pl-4",
        "focus-within:ring-ring focus-within:ring-2",
      ])}
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") event.currentTarget.blur();
        }}
        placeholder={t`Ask about notes in ${name}`}
        aria-label={t`Ask about this folder`}
        className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
      <button
        type="submit"
        aria-label={t`Send`}
        disabled={!value.trim()}
        // Fork: the brand accent marks Send once there is text (Claude.ai;
        // Apple HIG, Color: the accent marks the primary action). Empty, it
        // looks unavailable in dark too, as on the Chat page (Apple HIG,
        // Buttons). The empty Send matches Chat's pale chip and dimmed arrow
        // (live task test, Oct 9: a solid gray read as ready; NN/g #4).
        className={cn([
          "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition disabled:cursor-default",
          value.trim()
            ? "bg-primary text-primary-foreground hover:brightness-90"
            : "bg-foreground/10 text-foreground/30! dark:bg-foreground/15",
        ])}
      >
        <ArrowUp className="size-4" weight="bold" />
      </button>
    </form>
  );
}
