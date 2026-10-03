import { describe, expect, it } from "vitest";

import { BUNDLED_TEMPLATES } from "./bundled-templates";
import { parseWebTemplates } from "./codec";
import { DEFAULT_TEMPLATE_ICON } from "./template-icon";

describe("BUNDLED_TEMPLATES", () => {
  const parsed = parseWebTemplates(BUNDLED_TEMPLATES);

  it("parses every template with the codec", () => {
    expect(parsed).toHaveLength(BUNDLED_TEMPLATES.length);
    expect(parsed.length).toBeGreaterThanOrEqual(9);
  });

  it("gives each template a unique slug and title", () => {
    expect(new Set(parsed.map((t) => t.slug)).size).toBe(parsed.length);
    expect(new Set(parsed.map((t) => t.title)).size).toBe(parsed.length);
  });

  it.each(parseWebTemplates(BUNDLED_TEMPLATES).map((t) => [t.title, t]))(
    "%s has described sections and a known icon",
    (_title, template) => {
      expect(template.description.trim()).not.toBe("");
      expect(template.sections.length).toBeGreaterThanOrEqual(3);
      for (const section of template.sections) {
        expect(section.title.trim()).not.toBe("");
        expect(section.description.trim()).not.toBe("");
      }
      expect(template.icon.type).toBe("icon");
      if (template.slug !== "general-meeting") {
        expect(template.icon).not.toEqual(DEFAULT_TEMPLATE_ICON);
      }
    },
  );

  // Fork: journey-meeting P2, follow-up emails are drafted in chat by the
  // bottom bar's chip, not by a notes template.
  it("has no follow-up email notes template", () => {
    expect(parsed.some((t) => t.slug === "follow-up-email")).toBe(false);
    expect(parsed.some((t) => /email/i.test(t.title))).toBe(false);
  });
});
