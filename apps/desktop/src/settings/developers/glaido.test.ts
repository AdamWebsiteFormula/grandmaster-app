import { describe, expect, it } from "vitest";

import {
  buildGlaidoMcpConfig,
  GLAIDO_DENIED_TOOLS,
  GLAIDO_READ_TOOLS,
  glaidoFolderPath,
} from "./glaido";

const paths = {
  cliPath: "/Applications/Upshot.app/Contents/MacOS/anarlog-cli",
  dbPath: "/Users/test/Library/Application Support/anarlog/app.db",
};

describe("buildGlaidoMcpConfig", () => {
  const config = buildGlaidoMcpConfig(paths);
  const server = config.mcpServers.Upshot;

  it("names one local stdio server that runs the bundled CLI", () => {
    expect(Object.keys(config.mcpServers)).toEqual(["Upshot"]);
    expect(server.type).toBe("stdio");
    expect(server.command).toBe(paths.cliPath);
    expect(server.args).toEqual(["mcp"]);
    expect(server.instructions.length).toBeGreaterThan(0);
  });

  it("points the CLI at the database this app opens", () => {
    expect(server.env).toEqual({ ANARLOG_DB_PATH: paths.dbPath });
  });

  it("runs read tools automatically and denies edit tools", () => {
    for (const tool of GLAIDO_READ_TOOLS) {
      expect(server.toolApproval[tool]).toBe("auto");
    }
    for (const tool of GLAIDO_DENIED_TOOLS) {
      expect(server.toolApproval[tool]).toBe("deny");
    }
    expect(Object.keys(server.toolApproval)).toHaveLength(11);
    expect(
      Object.entries(server.toolApproval)
        .filter(([, policy]) => policy === "deny")
        .map(([tool]) => tool)
        .every(
          (tool) => tool.startsWith("propose_") || tool.startsWith("decline_"),
        ),
    ).toBe(true);
  });

  it("serializes to plain JSON", () => {
    expect(JSON.parse(JSON.stringify(config))).toEqual(config);
  });
});

describe("glaidoFolderPath", () => {
  it("uses a brand folder in Application Support", () => {
    expect(glaidoFolderPath("/Users/test/Library/Application Support/")).toBe(
      "/Users/test/Library/Application Support/Upshot/glaido",
    );
  });
});
