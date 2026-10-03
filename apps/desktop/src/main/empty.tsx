import { HomeComposer } from "~/home/home-composer";
import { HomeView } from "~/home/home-view";
import { StandardContentWrapper } from "~/shared/main";
import type { Tab } from "~/store/zustand/tabs";

export function TabContentEmpty({
  tab: _tab,
}: {
  tab: Extract<Tab, { type: "empty" }>;
}) {
  // Fork: the home screen lives in ~/home/home-view; the Ask anything
  // composer is pinned at the bottom, Granola style.
  return (
    <StandardContentWrapper floatingButton={<HomeComposer />}>
      <HomeView />
    </StandardContentWrapper>
  );
}
