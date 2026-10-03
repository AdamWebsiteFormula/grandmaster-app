// Fork: the note count for a folder page header ("12 notes · 3 files"), as
// Granola's space header has a meta line (granola-compare-oct3 section 7).
// Same match as FOLDER_SESSIONS_SQL in ~/home/home-data: nested folders count.
import { useLiveQuery } from "~/db";

export function useFolderNoteCount(folderPath: string): number | null {
  const prefix = `${folderPath}/`;
  const { data = null } = useLiveQuery<{ count: number }, number>({
    sql: `
      SELECT COUNT(*) AS count
      FROM sessions AS session
      WHERE session.deleted_at IS NULL
        AND (
          session.folder_path = ?
          OR substr(session.folder_path, 1, length(?)) = ?
        )
    `,
    params: [folderPath, prefix, prefix],
    enabled: folderPath.length > 0,
    mapRows: (rows) => Number(rows[0]?.count ?? 0),
  });
  return data;
}
