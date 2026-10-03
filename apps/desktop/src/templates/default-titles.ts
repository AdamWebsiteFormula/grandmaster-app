// Fork: the upstream seed (crates/db-app/migrations/20260524000000_default_templates.sql)
// names its built-in templates in Title Case. Upshot writes every label in
// sentence case (design-system.md; Apple HIG, Writing: "Use sentence-style
// capitalization"; Granola's own templates read "1:1", "Customer discovery
// call"). The migration is applied user data, so the name is changed where it
// is read, and only while it is still the untouched seed name. A name the
// user typed is never rewritten.
const SEEDED_TITLE_CASE_NAMES: Record<string, string> = {
  "default-board-meeting": "Board Meeting",
  "default-brainstorming-session": "Brainstorming Session",
  "default-client-kickoff": "Client Kickoff Meeting",
  "default-customer-discovery": "Customer Discovery Interview",
  "default-daily-standup": "Daily Standup",
  "default-executive-briefing": "Executive Briefing",
  "default-incident-postmortem": "Incident Postmortem",
  "default-investor-pitch": "Investor Pitch Meeting",
  "default-lecture-notes": "Lecture Notes",
  "default-one-on-one-meeting": "1:1 Meeting",
  "default-performance-review": "Performance Review",
  "default-product-roadmap-review": "Product Roadmap Review",
  "default-project-kickoff": "Project Kickoff",
  "default-sales-discovery-call": "Sales Discovery Call",
  "default-sprint-planning": "Sprint Planning",
  "default-sprint-retrospective": "Sprint Retrospective",
  "default-technical-design-review": "Technical Design Review",
};

function toSentenceCase(title: string) {
  return title
    .split(" ")
    .map((word, index) => (index === 0 ? word : word.toLowerCase()))
    .join(" ");
}

export function displayTemplateTitle(id: string, title: string): string {
  const seeded = SEEDED_TITLE_CASE_NAMES[id];
  return seeded !== undefined && title === seeded
    ? toSentenceCase(seeded)
    : title;
}
