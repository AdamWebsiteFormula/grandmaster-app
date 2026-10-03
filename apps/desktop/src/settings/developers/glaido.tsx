import { t } from "@lingui/core/macro";
import { useMutation } from "@tanstack/react-query";
import { dataDir } from "@tauri-apps/api/path";

import { commands as fs2Commands } from "@anlg/plugin-fs2";
import { commands as openerCommands } from "@anlg/plugin-opener2";
import { CircleNotch, Copy, FolderOpen } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";
import { toast } from "@anlg/ui/components/ui/toast";

import { copyText } from "./clipboard";

import { SettingsSectionTitle } from "~/settings/page-title";
import { commands, type McpServerPaths } from "~/types/tauri.gen";

// Glaido imports a folder whose root mcp.json names a local stdio server.
// Format: github.com/daveebbelaar/glaido-skills,
// creating-glaido-mcp-servers/references/glaido-integration.md
export const GLAIDO_SERVER_NAME = "Upshot";

export const GLAIDO_READ_TOOLS = [
  "list_meetings",
  "list_folders",
  "get_meeting",
  "get_recurring_meeting_history",
  "list_proposals",
  "get_proposal",
] as const;

// Bulk reads of a whole transcript or meeting export ask first (red-team
// finding: least privilege for data an agent could forward elsewhere).
export const GLAIDO_ASK_TOOLS = [
  "get_meeting_transcript",
  "export_meeting",
] as const;

// These stage or discard edits, so Glaido never runs them.
export const GLAIDO_DENIED_TOOLS = [
  "propose_summary_edit",
  "propose_memo_edit",
  "decline_proposal",
] as const;

export function buildGlaidoMcpConfig({ cliPath, dbPath }: McpServerPaths) {
  return {
    mcpServers: {
      [GLAIDO_SERVER_NAME]: {
        type: "stdio",
        instructions:
          "Your Upshot meetings: notes, summaries, transcripts and folders, read from this Mac.",
        command: cliPath,
        args: ["mcp"],
        env: { ANARLOG_DB_PATH: dbPath },
        toolApproval: {
          ...Object.fromEntries(
            GLAIDO_READ_TOOLS.map((tool) => [tool, "auto"]),
          ),
          ...Object.fromEntries(GLAIDO_ASK_TOOLS.map((tool) => [tool, "ask"])),
          ...Object.fromEntries(
            GLAIDO_DENIED_TOOLS.map((tool) => [tool, "deny"]),
          ),
        },
      },
    },
  };
}

export function glaidoFolderPath(appDataDir: string) {
  return `${appDataDir.replace(/\/+$/, "")}/Upshot/glaido`;
}

async function writeGlaidoFolder() {
  const paths = await commands.getMcpServerPaths();
  if (paths.status === "error") {
    throw new Error(paths.error);
  }

  const folder = glaidoFolderPath(await dataDir());
  const content = `${JSON.stringify(buildGlaidoMcpConfig(paths.data), null, 2)}\n`;
  const written = await fs2Commands.writeTextFile(
    `${folder}/mcp.json`,
    content,
  );
  if (written.status === "error") {
    throw new Error(written.error);
  }
  return folder;
}

export function GlaidoSection() {
  const connect = useMutation({
    mutationFn: writeGlaidoFolder,
    onSuccess: () => toast.success(t`Glaido folder is ready`),
    onError: (error) => toast.error(error.message),
  });
  const folder = connect.data;

  const reveal = async () => {
    if (!folder) return;
    const result = await openerCommands.revealItemInDir(folder);
    if (result.status === "error") toast.error(result.error);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <SettingsSectionTitle>{t`Glaido`}</SettingsSectionTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            {t`Ask about your meetings from anywhere with your Glaido key.`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {folder && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void reveal()}
            >
              <FolderOpen className="size-3.5" />
              {t`Reveal in Finder`}
            </Button>
          )}
          {/* Fork: outline, so the CLI Install stays the one primary on
              the page (ux-audit-oct3 E, design-system). */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={connect.isPending}
            onClick={() => connect.mutate()}
          >
            {connect.isPending && (
              <CircleNotch className="size-3.5 animate-spin" />
            )}
            {folder ? t`Update folder` : t`Create Glaido folder`}
          </Button>
        </div>
      </div>
      {folder && (
        <ol className="text-muted-foreground flex list-decimal flex-col gap-1 pl-5 text-sm">
          <li>{t`In Glaido, open Tools and click Import.`}</li>
          <li>
            {/* Apple Support, "Go to a folder by entering its pathname": Shift-Command-G. ~/Library is hidden in file pickers. */}
            {t`In the file picker, press ⌘⇧G and paste the path, then turn Upshot on.`}
            <span className="mt-1 block text-xs break-all">{folder}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void copyText(folder, t`Path copied`)}
            >
              <Copy className="size-3.5" />
              {t`Copy path`}
            </Button>
          </li>
        </ol>
      )}
    </section>
  );
}
