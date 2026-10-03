import { HomeView } from "~/home/home-view";
import { FloatingChatCTA } from "~/shared/chat-cta";
import { StandardContentWrapper } from "~/shared/main";
import type { Tab } from "~/store/zustand/tabs";

export function TabContentEmpty({
  tab: _tab,
}: {
  tab: Extract<Tab, { type: "empty" }>;
}) {
  // Fork: the home screen lives in ~/home/home-view; "Ask anything" floats
  // at the bottom, Granola style.
  return (
    <StandardContentWrapper floatingButton={<FloatingChatCTA />}>
      <HomeView />
    </StandardContentWrapper>
  );
}
