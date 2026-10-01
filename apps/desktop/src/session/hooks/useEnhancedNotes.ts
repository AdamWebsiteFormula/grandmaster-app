import { useMemo } from "react";

import { useAITask } from "~/ai/contexts";
import { useEnhancedNoteRecords } from "~/session/queries";
import { createTaskId } from "~/store/zustand/ai-task/task-configs";

export function useEnhancedNotes(sessionId: string) {
  const notes = useEnhancedNoteRecords(sessionId);
  return useMemo(() => notes.map((note) => note.id), [notes]);
}

export function useIsSessionEnhancing(sessionId: string): boolean {
  const enhancedNoteIds = useEnhancedNotes(sessionId);

  const taskIds = useMemo(
    () => enhancedNoteIds.map((id) => createTaskId(id, "enhance")),
    [enhancedNoteIds],
  );

  const isEnhancing = useAITask((state) => {
    return taskIds.some(
      (taskId) => state.tasks[taskId]?.status === "generating",
    );
  });

  return isEnhancing;
}
