import { describe, expect, it } from "vitest";

import { displayTemplateTitle } from "./default-titles";

// Fork tests: installed-build review Oct 3 (P3: Title Case suggestions).
describe("displayTemplateTitle", () => {
  it("shows the seeded names in sentence case", () => {
    expect(
      displayTemplateTitle("default-project-kickoff", "Project Kickoff"),
    ).toBe("Project kickoff");
    expect(displayTemplateTitle("default-daily-standup", "Daily Standup")).toBe(
      "Daily standup",
    );
    expect(
      displayTemplateTitle("default-one-on-one-meeting", "1:1 Meeting"),
    ).toBe("1:1 meeting");
  });

  it("never rewrites a name the user changed, or another template", () => {
    expect(
      displayTemplateTitle("default-project-kickoff", "Acme Kickoff"),
    ).toBe("Acme Kickoff");
    expect(displayTemplateTitle("custom-1", "Project Kickoff")).toBe(
      "Project Kickoff",
    );
  });
});
