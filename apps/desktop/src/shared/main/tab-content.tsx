import { type ComponentType, lazy, Suspense } from "react";

import { type Tab } from "~/store/zustand/tabs";

// Fork: the pages people open first load in the background two seconds after
// launch and then render directly. A React.lazy page shows its fallback, a
// blank panel, for about 0.3 s on first open even when its code is already
// loaded, because React holds a revealed fallback for 300 ms (picture review,
// Oct 6: 0.3 to 0.5 s blank on the first note; NN/g, Response times: 0.1 s
// feels instant). A page that went through the lazy path keeps it, so it
// never remounts.
function preloadable<P extends object>(load: () => Promise<ComponentType<P>>) {
  let loaded: ComponentType<P> | undefined;
  let lazyUsed = false;
  const Lazy = lazy(async () => {
    lazyUsed = true;
    return { default: await load() };
  });
  return {
    preload() {
      void load().then((component) => {
        loaded = component;
      });
    },
    get(): ComponentType<P> {
      return !lazyUsed && loaded ? loaded : Lazy;
    },
  };
}

const TabContentAutomations = lazy(async () => ({
  default: (await import("~/settings/automations")).TabContentAutomations,
}));
const foldersContent = preloadable(
  async () => (await import("~/folders")).TabContentFolders,
);
const chatContent = preloadable(
  async () => (await import("~/chat/components/chat-page")).TabContentChat,
);
const TabContentCalendar = lazy(async () => ({
  default: (await import("~/calendar")).TabContentCalendar,
}));
const TabContentChangelog = lazy(async () => ({
  default: (await import("~/changelog")).TabContentChangelog,
}));
const TabContentContact = lazy(async () => ({
  default: (await import("~/contacts")).TabContentContact,
}));
const TabContentHuman = lazy(async () => ({
  default: (await import("~/contacts/humans")).TabContentHuman,
}));
const TabContentEdit = lazy(async () => ({
  default: (await import("~/edit")).TabContentEdit,
}));
const noteContent = preloadable(
  async () => (await import("~/session")).TabContentNote,
);
const TabContentOnboarding = lazy(async () => ({
  default: (await import("~/onboarding")).TabContentOnboarding,
}));
const settingsContent = preloadable(
  async () => (await import("~/settings")).TabContentSettings,
);
const TabContentSharedNote = lazy(async () => ({
  default: (await import("~/shared-notes")).TabContentSharedNote,
}));
const TabContentSharedNotePreview = lazy(async () => ({
  default: (await import("~/shared-notes")).TabContentSharedNotePreview,
}));
const TabContentTask = lazy(async () => ({
  default: (await import("~/task")).TabContentTask,
}));
const templateContent = preloadable(
  async () => (await import("~/templates")).TabContentTemplate,
);

if (typeof window !== "undefined" && import.meta.env.MODE !== "test") {
  window.setTimeout(() => {
    noteContent.preload();
    settingsContent.preload();
    chatContent.preload();
    foldersContent.preload();
    templateContent.preload();
  }, 2000);
}

export function MainTabContent({ tab }: { tab: Tab }) {
  return (
    <Suspense fallback={null}>
      <LazyTabContent tab={tab} />
    </Suspense>
  );
}

function LazyTabContent({ tab }: { tab: Tab }) {
  if (tab.type === "automations") {
    return <TabContentAutomations />;
  }
  if (tab.type === "folders") {
    const TabContentFolders = foldersContent.get();
    return <TabContentFolders />;
  }
  if (tab.type === "chat") {
    const TabContentChat = chatContent.get();
    return <TabContentChat />;
  }
  if (tab.type === "sessions") {
    const TabContentNote = noteContent.get();
    return <TabContentNote tab={tab} />;
  }
  if (tab.type === "shared_sessions") {
    return <TabContentSharedNote tab={tab} />;
  }
  if (tab.type === "shared_note_preview") {
    return <TabContentSharedNotePreview tab={tab} />;
  }
  if (tab.type === "humans") {
    return <TabContentHuman tab={tab} />;
  }
  if (tab.type === "contacts") {
    return <TabContentContact tab={tab} />;
  }
  if (tab.type === "calendar") {
    return <TabContentCalendar />;
  }
  if (tab.type === "changelog") {
    return <TabContentChangelog tab={tab} />;
  }
  if (tab.type === "settings") {
    const TabContentSettings = settingsContent.get();
    return <TabContentSettings tab={tab} />;
  }
  if (tab.type === "templates") {
    const TabContentTemplate = templateContent.get();
    return <TabContentTemplate tab={tab} />;
  }
  if (tab.type === "onboarding") {
    return <TabContentOnboarding tab={tab} />;
  }
  if (tab.type === "edit") {
    return <TabContentEdit tab={tab} />;
  }
  if (tab.type === "task") {
    return <TabContentTask tab={tab} />;
  }
  return null;
}
