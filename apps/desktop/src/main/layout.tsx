import { useRouteContext } from "@tanstack/react-router";

import { TaskStorageProvider } from "@anlg/editor/task-storage";

import { ClassicMainServices } from "./lifecycle";

import { AITaskProvider } from "~/ai/contexts";
import { NotificationProvider } from "~/contexts/notifications";
import { ShellProvider } from "~/contexts/shell";
import { ToolRegistryProvider } from "~/contexts/tool";
import { useStoreBackedTaskStorage } from "~/editor-bridge/task-storage";
import { SearchEngineProvider } from "~/search/contexts/engine";
import { OpenNoteDialogProvider } from "~/shared/open-note-dialog";
import { UpshotUpgradeDialog } from "~/upshot-plan/upgrade-dialog";

export function ClassicMainLayout({
  children,
  includeServices = true,
}: {
  children: React.ReactNode;
  includeServices?: boolean;
}) {
  const { aiTaskStore, toolRegistry } = useRouteContext({
    from: "__root__",
  });
  const taskStorage = useStoreBackedTaskStorage();

  if (!aiTaskStore) {
    return null;
  }

  return (
    <SearchEngineProvider>
      <TaskStorageProvider storage={taskStorage}>
        <OpenNoteDialogProvider>
          <ShellProvider>
            <ToolRegistryProvider registry={toolRegistry}>
              <AITaskProvider store={aiTaskStore}>
                <NotificationProvider>
                  {includeServices ? <ClassicMainServices /> : null}
                  {children}
                  {/* Fork: Upshot Pro sign-in and checkout. */}
                  <UpshotUpgradeDialog />
                </NotificationProvider>
              </AITaskProvider>
            </ToolRegistryProvider>
          </ShellProvider>
        </OpenNoteDialogProvider>
      </TaskStorageProvider>
    </SearchEngineProvider>
  );
}
