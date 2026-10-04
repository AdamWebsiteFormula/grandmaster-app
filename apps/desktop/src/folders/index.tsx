import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";

import { FolderEditor } from "./folder-editor";
import { NewFolderButton } from "./new-folder-button";
import { useActiveFolderPath, useFolderSelection } from "./selection";

import { createNamedFolder } from "~/session/folder-catalog";
import { useFolderPaths } from "~/session/queries";
import { StandardContentWrapper } from "~/shared/main";
import { FolderNameDialog } from "~/sidebar/folder-name-dialog";

export function TabContentFolders() {
  return (
    <StandardContentWrapper>
      <div className="h-full">
        <FoldersMain />
      </div>
    </StandardContentWrapper>
  );
}

export function FoldersMain() {
  const folders = useFolderPaths();
  const activeFolder = useActiveFolderPath(folders);

  if (!activeFolder) {
    return <NoFolders />;
  }

  return <FolderEditor key={activeFolder} folderPath={activeFolder} />;
}

// Fork: an empty state with its next step (ux-audit-oct3 B; NN/g empty
// states, nngroup.com/articles/empty-state-interface-design).
function NoFolders() {
  const { t } = useLingui();
  const setSelectedPath = useFolderSelection((state) => state.setSelectedPath);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
      {/* Fork: the page says where you are, as the Chat page does (NN/g,
          "Navigation: You Are Here"); the sidebar only says where folders
          will show up. */}
      <h1 className="text-foreground font-display text-2xl font-semibold tracking-[-0.01em]">
        <Trans>Folders</Trans>
      </h1>
      <p className="text-muted-foreground text-center text-sm">
        <Trans>No folders yet. Create one to group notes and materials.</Trans>
      </p>
      <NewFolderButton onClick={() => setCreating(true)} />
      <FolderNameDialog
        open={creating}
        title={t`New folder`}
        confirmLabel={t`Create`}
        onOpenChange={setCreating}
        onSubmit={async (path) => {
          const created = await createNamedFolder(path);
          setSelectedPath(created);
        }}
      />
    </div>
  );
}
