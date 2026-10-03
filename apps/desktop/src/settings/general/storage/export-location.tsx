import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { downloadDir, homeDir } from "@tauri-apps/api/path";
import { open as selectFolder } from "@tauri-apps/plugin-dialog";

import { commands as openerCommands } from "@anlg/plugin-opener2";
import { CircleNotch, FolderSimple } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";

import { displayPath } from "./path-utils";

import {
  setSettingValue,
  useStoredSettingValuesQuery,
} from "~/settings/queries";
import { SettingIconTile } from "~/settings/setting-row";

export function ExportLocationRow() {
  const { t } = useLingui();
  const settings = useStoredSettingValuesQuery();
  const directory = settings.data?.values.export_directory;
  const { data: home } = useQuery({ queryKey: ["home-dir"], queryFn: homeDir });
  const downloads = useQuery({
    queryKey: ["download-dir"],
    queryFn: downloadDir,
    enabled: !directory,
  });
  const path = directory || downloads.data;
  const changeMutation = useMutation({
    mutationFn: async (action: "choose" | "reset") => {
      if (action === "reset") {
        await setSettingValue("export_directory", "");
        return;
      }

      const selected = await selectFolder({
        title: t`Choose export folder`,
        directory: true,
        multiple: false,
        defaultPath: path,
      });
      if (selected && selected !== path) {
        await setSettingValue("export_directory", selected);
      }
    },
  });
  const disabled =
    settings.isLoading || !!settings.error || changeMutation.isPending;

  const shownPath = displayPath(path, home);

  // Fork: the standard Settings row (icon, title, description under the
  // title) with the folder shown next to its button on the right, as macOS
  // System Settings shows a value beside its control and Granola's rows keep
  // the value on the right (redline2-oct3 Settings). The path opens the
  // folder in Finder.
  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <SettingIconTile icon={FolderSimple} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium">
            <Trans>Export location</Trans>
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            <Trans>
              Save PDF, text, Markdown, and Org exports to this folder.
            </Trans>
          </p>
          {directory && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0 pt-1 text-xs"
              disabled={disabled}
              onClick={() => changeMutation.mutate("reset")}
            >
              <Trans>Reset to Downloads</Trans>
            </Button>
          )}
          {(settings.error || downloads.error || changeMutation.error) && (
            <p role="alert" className="text-destructive mt-1 text-xs">
              <Trans>Could not update the export folder</Trans>
            </p>
          )}
        </div>
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-3">
        {path ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground max-w-40 truncate text-xs transition-colors"
            title={path}
            aria-label={t`Open ${shownPath} in Finder`}
            disabled={settings.isLoading || !!settings.error}
            onClick={() => void openerCommands.openPath(path, null)}
          >
            {shownPath}
          </button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="h-9 justify-center"
          disabled={disabled}
          onClick={() => changeMutation.mutate("choose")}
        >
          {changeMutation.isPending && (
            <CircleNotch className="size-4 animate-spin" aria-hidden="true" />
          )}
          <Trans>Choose folder</Trans>
        </Button>
      </div>
    </div>
  );
}
