// Fork: the Chat page, Granola's sidebar "Chat" (granola-compare-oct3 section
// 6; Granola 101, docs.granola.ai/help-center/getting-started/granola-101):
// a greeting, a composer with the model menu, recent chats and recipes.
// Sending or opening a chat shows it in the right chat panel.
import { Trans, useLingui } from "@lingui/react/macro";
import { differenceInMinutes, format } from "date-fns";
import { type FormEvent, type KeyboardEvent, useEffect, useState } from "react";

import { ArrowUp, CaretRight, Chat } from "@anlg/ui/components/icons";
import { cn } from "@anlg/utils";

import { useOptionalAuth } from "~/auth";
import { ChatPanelFrame } from "~/chat/components/chat-panel";
import { ChatModelMenu } from "~/chat/components/input/model-menu";
import { chatPageRecipes, RecipeRow } from "~/chat/components/recipes";
import { useChatSessionProps } from "~/chat/components/session-props-context";
import { queueChatPrompt } from "~/chat/pending-prompt";
import { type ChatGroupRecord, useChatGroups } from "~/chat/store/queries";
import { usePersonalContact } from "~/contacts/queries";
import { useShell } from "~/contexts/shell";
import { StandardContentWrapper } from "~/shared/main";
import { useOwnerUserId } from "~/shared/owner-user";
import {
  ensureUpshotSessionLoaded,
  useUpshotAccount,
} from "~/upshot-plan/session";

/** Recents shown before "See all" (Granola shows a handful). Fork: 3, the
 * same rule as the recipe row below, so "See all" shows from the fourth chat
 * (redline4-oct3; it opens the full history inline, as there is no separate
 * chats page). */
export const CHAT_RECENTS_LIMIT = 3;

/** Recipe chips shown before the "See all" chip (redline-oct3). */
export const CHAT_RECIPES_LIMIT = 3;

export function TabContentChat() {
  return (
    <StandardContentWrapper>
      <ChatPage />
    </StandardContentWrapper>
  );
}

/** "adam.willingham@x.com" → "Adam"; null when the local part has no name. */
export function firstNameFromEmail(email: string | null | undefined) {
  const local = email?.split("@")[0] ?? "";
  const first = local.split(/[._+\-\d]+/).find(Boolean) ?? "";
  if (first.length < 2) return null;
  return first[0].toUpperCase() + first.slice(1).toLowerCase();
}

/** "Adam Willingham" → "Adam"; null for an empty profile name. */
export function firstNameFromProfile(name: string | null | undefined) {
  const first = name?.trim().split(/\s+/)[0] ?? "";
  return first || null;
}

/** Granola's compact ages: "now", "12m", "23h", "2d", then a date. */
export function compactAge(fromMs: number, nowMs = Date.now()) {
  const minutes = Math.max(0, differenceInMinutes(nowMs, fromMs));
  if (minutes < 1) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return format(fromMs, "MMM d");
}

export function ChatPage() {
  const { t } = useLingui();
  const { chat } = useShell();
  const sessionProps = useChatSessionProps();
  const email = useUpshotAccount((state) => state.session?.email ?? null);
  // Fork: the Profile name first, as the Settings header does
  // (sidebar/settings.tsx), then the email rule (journey-after P3 "Chat page
  // greeting"; NN/g #2).
  const auth = useOptionalAuth();
  const localOwnerUserId = useOwnerUserId();
  const profile = usePersonalContact(
    auth?.session?.user.id ?? localOwnerUserId ?? "",
  );
  const firstName =
    firstNameFromProfile(profile.data?.name) ?? firstNameFromEmail(email);
  // Fork: while a chat is open in the right panel, its own field is the
  // composer; never two "Ask anything" fields (journey-after P1 "Chat page";
  // Granola's Chat page; NN/g #4, #5). Same rule as home-composer.tsx.
  const chatOpen = chat.mode !== "FloatingClosed";
  const groups = useChatGroups(chat.scope);
  const [value, setValue] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [showAllRecipes, setShowAllRecipes] = useState(false);

  useEffect(() => {
    void ensureUpshotSessionLoaded();
  }, []);

  const ask = (prompt: string) => {
    const text = prompt.trim();
    if (!text) return;
    // A recipe picked while a chat is open continues that chat.
    if (!chatOpen) chat.startNewChat();
    queueChatPrompt(text);
    chat.sendEvent({ type: "OPEN_RIGHT_PANEL" });
    setValue("");
  };

  const openChat = (groupId: string) => {
    chat.selectChat(groupId);
    chat.sendEvent({ type: "OPEN_RIGHT_PANEL" });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    ask(value);
  };

  // Enter sends, Shift+Enter adds a line, as in the chat panel.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      ask(value);
    }
    if (event.key === "Escape") event.currentTarget.blur();
  };

  const recents = showAll ? groups : groups.slice(0, CHAT_RECENTS_LIMIT);
  const recipes = chatPageRecipes();

  // Fork: a chat opened here (sent, a recipe, or a recent) stays in this
  // page's column, as ChatGPT and Claude keep a conversation where you typed
  // it; the right panel stays closed on this page (owner test, Oct 4:
  // "jarring"; NN/g #4). All chats returns to Recents and Recipes.
  if (chat.mode === "RightPanelOpen") {
    return (
      <div
        data-chat-page-conversation
        className="mx-auto flex h-full min-h-0 w-full max-w-[760px] flex-col px-4"
      >
        <ChatPanelFrame
          layout="page"
          onBack={() => chat.sendEvent({ type: "CLOSE" })}
          sessionProps={sessionProps}
        />
      </div>
    );
  }

  return (
    <div
      data-tauri-drag-region
      className="scrollbar-soft h-full overflow-y-auto"
    >
      {/* Fork: the Home column (640 px, 576 px inside its gutters), so Chat,
          Home and notes share one width (picture review, Oct 6; NN/g #4). */}
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-8 px-8 pt-24 pb-10">
        {chatOpen ? null : (
          <h1 className="text-foreground font-display text-center text-2xl font-semibold tracking-[-0.01em] text-balance">
            {/* Fork: the field says "Ask anything", so the heading asks
                instead of repeating it (picture review, Oct 9; NN/g #8). */}
            {firstName
              ? t`Hi ${firstName}, what do you want to know?`
              : t`What do you want to know?`}
          </h1>
        )}

        {chatOpen ? null : (
          <form
            onSubmit={onSubmit}
            className={cn([
              // Fork: p-4, the 16 pt inset of Home's cards and composer, on
              // every side, so the send button sits square in its corner
              // (picture review, Oct 6 and 7).
              "bg-card dark:bg-muted border-input flex min-h-[88px] flex-col gap-2 rounded-2xl border p-4",
              "focus-within:ring-ring focus-within:ring-2",
            ])}
          >
            <textarea
              value={value}
              rows={2}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t`Ask anything`}
              aria-label={t`Ask anything`}
              className="text-foreground placeholder:text-muted-foreground min-h-10 w-full resize-none bg-transparent text-sm outline-none"
            />
            {/* Fork: the model menu sits next to Send, as on Home (NN/g #4,
                consistency); the field is raised in dark like Home's
                (Apple HIG, Dark Mode: elevated surfaces are lighter). */}
            <div className="flex items-center justify-end gap-2">
              <ChatModelMenu />
              <button
                type="submit"
                aria-label={t`Send`}
                disabled={!value.trim()}
                // Fork: the brand accent marks Send once there is text (Claude.ai;
                // Apple HIG, Color: the accent marks the primary action).
                // Fork: in dark, a bright fill with a dark arrow reads as ready,
                // so the empty Send is a muted chip with a gray arrow (Apple
                // HIG, Buttons: a disabled button looks unavailable). Same
                // pale chip in light (picture review, Oct 8: a solid gray
                // read as the heaviest thing in the box).
                className={cn([
                  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition disabled:cursor-default",
                  value.trim()
                    ? "bg-primary text-primary-foreground hover:brightness-90"
                    : "bg-foreground/10 text-foreground/40 dark:bg-foreground/15",
                ])}
              >
                <ArrowUp className="size-4" weight="bold" />
              </button>
            </div>
          </form>
        )}

        {/* Fork: Recents appears with the first chat; an empty list only
            pushes Recipes down (redline-oct3; Granola's Chat page). */}
        {groups.length > 0 ? (
          <section
            aria-labelledby="chat-recents"
            className="flex flex-col gap-1"
          >
            {/* Fork: labels, recent rows and recipe chips share the
                composer's left edge; the rows keep px-2 for their hover
                fill (Apple HIG, Layout: align elements to scan them). */}
            <div className="flex items-center justify-between">
              <h2
                id="chat-recents"
                className="text-muted-foreground text-sm font-medium"
              >
                {/* Fork: "Recent", the word Search uses (picture review,
                    Oct 6; NN/g #4). */}
                <Trans>Recent</Trans>
              </h2>
              {groups.length > CHAT_RECENTS_LIMIT ? (
                <button
                  type="button"
                  aria-expanded={showAll}
                  aria-controls="chat-recents-list"
                  onClick={() => setShowAll((current) => !current)}
                  // Fork: -mr-[6.5px] puts the chevron on the column edge with
                  // the row times (picture review, Oct 6 and 7).
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -mr-[6.5px] cursor-pointer rounded-md px-1 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
                >
                  {/* Fork: a chevron, as on Recipes' "See all", so it reads
                      as a link, not a label (picture review, Oct 7; NN/g
                      #4). */}
                  {showAll ? (
                    <Trans>Show less</Trans>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Trans>See all</Trans>
                      <CaretRight size={12} className="shrink-0" aria-hidden />
                    </span>
                  )}
                </button>
              ) : null}
            </div>
            <ul id="chat-recents-list" className="-mx-2 flex flex-col">
              {recents.map((group) => (
                <RecentChatRow key={group.id} group={group} onOpen={openChat} />
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="chat-recipes" className="flex flex-col gap-2">
          {/* Fork: "See all" sits by the heading, the same link as Recent's,
              so one action has one look on the page (picture review, Oct 6
              to 8: a link and a chip; NN/g #4). */}
          <div className="flex items-center justify-between">
            <h2
              id="chat-recipes"
              className="text-muted-foreground text-sm font-medium"
            >
              <Trans>Recipes</Trans>
            </h2>
            {recipes.length > CHAT_RECIPES_LIMIT ? (
              <button
                type="button"
                aria-expanded={showAllRecipes}
                onClick={() => setShowAllRecipes((current) => !current)}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -mr-[6.5px] cursor-pointer rounded-md px-1 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
              >
                {showAllRecipes ? (
                  <Trans>Show less</Trans>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Trans>See all</Trans>
                    <CaretRight size={12} className="shrink-0" aria-hidden />
                  </span>
                )}
              </button>
            ) : null}
          </div>
          <RecipeRow
            label={t`Recipes`}
            recipes={
              showAllRecipes ? recipes : recipes.slice(0, CHAT_RECIPES_LIMIT)
            }
            onSelect={ask}
            wrap
          />
        </section>
      </div>
    </div>
  );
}

function RecentChatRow({
  group,
  onOpen,
}: {
  group: ChatGroupRecord;
  onOpen: (groupId: string) => void;
}) {
  const { t } = useLingui();
  // Fork: age from the last message, so a continued chat reads fresh
  // (journey-after P3 "Chat page › Recents").
  const time = group.updatedAt || group.createdAt;
  const timeMs = time ? new Date(time).getTime() : Number.NaN;
  const age = Number.isNaN(timeMs) ? "" : (compactAge(timeMs) ?? t`now`);
  const title = group.title || t`Untitled chat`;

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(group.id)}
        className="hover:bg-accent focus-visible:ring-ring flex h-9 w-full cursor-pointer items-center gap-3 rounded-lg px-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
      >
        {/* Fork: a 14 px square chat bubble, no outlined circle, as
            Granola's Chat page Recents (redline3-oct3 S2). */}
        <Chat
          aria-hidden="true"
          className="text-muted-foreground size-3.5 shrink-0"
        />
        <span
          title={title}
          className="text-foreground min-w-0 flex-1 truncate text-sm"
        >
          {title}
        </span>
        {age ? (
          <time
            dateTime={time}
            title={Number.isNaN(timeMs) ? undefined : format(timeMs, "PPpp")}
            className="text-muted-foreground shrink-0 text-xs tabular-nums"
          >
            {age}
          </time>
        ) : null}
      </button>
    </li>
  );
}
