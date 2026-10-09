// Fork: Granola's Home ends in a full-width chat composer: recipe chips
// (with chat history at the left) above an "Ask anything" field with the
// Auto model menu (Granola 101, docs.granola.ai/help-center/getting-started/granola-101;
// Granola recipes, docs.granola.ai/help-center/getting-more-from-your-notes/recipes).
// Upshot reuses its home starter prompts and the chat's model menu; sending
// opens the floating chat with a new conversation.
import { useLingui } from "@lingui/react/macro";
import { type FormEvent, useState } from "react";

import { ArrowUp } from "@anlg/ui/components/icons";
import { Kbd } from "@anlg/ui/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@anlg/ui/components/ui/tooltip";
import { toast } from "@anlg/ui/components/ui/toast";
import { cn } from "@anlg/utils";

import { HOME_COLUMN_CLASS } from "./home-view";

import { useLanguageModel, useLLMConnectionStatus } from "~/ai/hooks";
import { homeChatSuggestions } from "~/chat/components/body/empty";
import { ChatModelMenu } from "~/chat/components/input/model-menu";
import { ChatGroups } from "~/chat/components/toolbar-controls";
import { queueChatPrompt } from "~/chat/pending-prompt";
import { useRecentChatGroups } from "~/chat/store/queries";
import { useShell } from "~/contexts/shell";
import { ariaKeyShortcut, kbdLabel } from "~/shared/shortcut-label";
import { openUpshotSignIn } from "~/upshot-plan";
import { useUpshotAccount } from "~/upshot-plan/session";

export function HomeComposer() {
  const { t } = useLingui();
  const { chat } = useShell();
  const [value, setValue] = useState("");
  const hasHistory = useRecentChatGroups(chat.scope, 1).length > 0;
  const model = useLanguageModel("chat");
  const llmStatus = useLLMConnectionStatus();
  const signedIn = useUpshotAccount((state) => !!state.session);

  // The open chat has its own field; never show two.
  if (chat.mode !== "FloatingClosed") return null;

  const ask = (prompt: string) => {
    const text = prompt.trim();
    if (!text) return;
    // Fork: with no model ready, the question was cleared and sent later in
    // whatever chat opened next. Keep it in the field and say why, with
    // Sign in when that is the fix (task test, Oct 8; NN/g #1, #9).
    if (!model) {
      if (
        llmStatus.status === "error" &&
        llmStatus.reason === "unauthenticated" &&
        !signedIn
      ) {
        openUpshotSignIn("hosted");
      } else {
        toast(t`Upshot AI is getting ready. Try again in a minute.`, {
          id: "home-chat-model-not-ready",
        });
      }
      return;
    }
    chat.startNewChat();
    queueChatPrompt(text);
    chat.sendEvent({ type: "OPEN" });
    setValue("");
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    ask(value);
  };

  return (
    // Fade the list out under the composer instead of a shadow (flat look,
    // design-system.md Shape and space). Fork: pb-4 keeps the box 16 px off
    // the panel bottom (redline4-oct3; Apple HIG Layout margins).
    <div
      data-home-composer
      className="from-panel via-panel pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t via-70% to-transparent pt-10 pb-4"
    >
      <div className={HOME_COLUMN_CLASS}>
        {/* Fork: one border around chips and field (redline-oct3, Granola's
            Home composer); the focus ring moves to this box. Same surface
            and field border as the Chat page composer: a white card in
            light, border-input (design-system.md Contrast; redline3-oct3 S2). */}
        <div
          className={cn([
            "bg-card dark:bg-muted border-input pointer-events-auto flex flex-col rounded-2xl border p-1",
            "has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-2",
          ])}
        >
          {/* Fork: chips that do not fit wrap onto a hidden second line, so a
              narrow window shows only whole chips (no cut-off labels). */}
          <div className="flex h-9 min-w-0 flex-wrap items-center gap-1 overflow-hidden px-1 py-1">
            {/* Fork: the icon-only history button says what it is, by name
                and on hover (redline3-oct3 S2; Apple HIG "Offering help":
                help tags for icon-only controls; WCAG 2.2 SC 4.1.2). */}
            {hasHistory ? (
              <TooltipProvider>
                <Tooltip delayDuration={400}>
                  <TooltipTrigger asChild>
                    {/* Fork: ml-1 puts the history icon on the text's 16 pt edge
                        (picture review, Oct 7: 20 pt). */}
                    <div className="ml-1 shrink-0">
                      <ChatGroups
                        label={t`Recent chats`}
                        chatScope={chat.scope}
                        currentChatGroupId={chat.groupId}
                        layout="floating"
                        onSelectChat={(groupId) => {
                          chat.selectChat(groupId);
                          chat.sendEvent({ type: "OPEN" });
                        }}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {t`Recent chats`}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {homeChatSuggestions().map(({ label, icon: Icon, prompt }) => (
              <button
                key={label}
                type="button"
                onClick={() => ask(prompt)}
                className="border-border text-muted-foreground hover:bg-accent hover:text-foreground inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors"
              >
                <Icon size={14} className="shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <form
            onSubmit={onSubmit}
            // Fork: pl-3 puts the text 16 pt inside the border, as in the
            // Coming up card, the chip row above and Chat's composer
            // (picture review, Oct 6: 20.5 pt; NN/g #4).
            className="flex h-12 items-center gap-2 rounded-xl border-0 bg-transparent pr-2 pl-3"
          >
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") event.currentTarget.blur();
              }}
              placeholder={t`Ask anything`}
              aria-label={t`Ask anything`}
              // Fork: ⌘ J on a Mac, Ctrl+J elsewhere (Apple HIG, Keyboards;
              // Microsoft Writing Style Guide, Keys and keyboard shortcuts).
              aria-keyshortcuts={ariaKeyShortcut(["mod", "J"])}
              className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            {value.trim() ? null : (
              <Kbd className="shrink-0">{kbdLabel(["mod", "J"])}</Kbd>
            )}
            {/* Fork: with no Send button after it, the model menu's chevron
                ends 17 pt from the composer's edge, as the text starts 17 pt
                from the other (picture review, Oct 7: 23 pt). */}
            <span className={value.trim() ? "contents" : "-mr-1.5 flex"}>
              <ChatModelMenu />
            </span>
            {value.trim() ? (
              <button
                type="submit"
                aria-label={t`Send`}
                // Fork: the brand accent marks Send (Claude.ai; Apple HIG,
                // Color: the accent marks the primary action).
                className="bg-primary text-primary-foreground inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition hover:brightness-90"
              >
                <ArrowUp className="size-4" weight="bold" />
              </button>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
