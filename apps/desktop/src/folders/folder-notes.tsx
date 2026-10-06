// Fork: a folder page lists its notes, grouped by day like Home, with
// "Show more" and the same right-click menu (ux-audit-oct3 B P1; Granola
// folders, docs.granola.ai/help-center/sharing/folders/spaces-and-folders;
// NN/g #6, recognition rather than recall).
import { Trans } from "@lingui/react/macro";
import { useState } from "react";

import { RECENT_PAGE_SIZE, useFolderNotes } from "~/home/home-data";
import { RecentNotes } from "~/home/home-view";

export function FolderNotes({ folderPath }: { folderPath: string }) {
  const [limit, setLimit] = useState(RECENT_PAGE_SIZE);
  const notes = useFolderNotes(folderPath, limit);

  if (notes.isLoading) return null;

  if (!notes.hasNotes) {
    return (
      <section aria-labelledby="folder-notes" className="flex flex-col gap-1.5">
        <h4 id="folder-notes" className="text-muted-foreground text-sm font-medium">
          <Trans>Notes</Trans>
        </h4>
        {/* Fork: an empty state that says how to fill it (NN/g empty
            states, nngroup.com/articles/empty-state-interface-design). No
            dashed outline: it read as a drop target, and Granola's empty
            states have none (picture review, Oct 6). */}
        <div className="flex flex-col items-center gap-1 px-6 py-3 text-center">
          <p className="text-foreground text-sm font-medium">
            <Trans>No notes in this folder yet</Trans>
          </p>
          <p className="text-muted-foreground text-sm text-pretty">
            <Trans>
              On Home, right-click a note and choose Add to folder. Or open a
              note and click Add to folder under its title.
            </Trans>
          </p>
        </div>
      </section>
    );
  }

  return (
    <RecentNotes
      headingId="folder-notes"
      compactHeading
      groups={notes.groups}
      hasMore={notes.hasMore}
      onShowMore={() => setLimit((value) => value + RECENT_PAGE_SIZE)}
    />
  );
}
