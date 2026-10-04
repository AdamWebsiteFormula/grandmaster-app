// Built-in templates, bundled so the gallery never calls the network. Modeled on Granola's built-ins: https://docs.granola.ai/help-center/taking-notes/customise-notes-with-templates
// Same shape the upstream gallery API returned, so parseWebTemplates reads it.

const icon = (value: string) => ({ type: "icon", value, color: "#9ca3af" });

export const BUNDLED_TEMPLATES: Record<string, unknown>[] = [
  {
    slug: "general-meeting",
    title: "General meeting",
    description:
      "Any meeting: what was discussed, what was decided, what happens next.",
    category: "General",
    icon: icon("notebook-tabs"),
    targets: ["meeting"],
    sections: [
      {
        title: "Summary",
        description:
          "Two or three sentences on the purpose and outcome of the meeting.",
      },
      {
        title: "Key points",
        description:
          "The main topics discussed, with concrete details, numbers, and names.",
      },
      {
        title: "Decisions",
        description: 'What was agreed. Write "None" if nothing was decided.',
      },
      {
        title: "Next steps",
        description:
          "Each action item with its owner and due date when stated.",
      },
    ],
  },
  {
    slug: "one-on-one",
    title: "1:1",
    description: "A recurring check-in between a manager and a report.",
    category: "Team",
    icon: icon("users"),
    targets: ["manager", "report", "one on one"],
    sections: [
      {
        title: "Updates",
        description: "Progress since the last 1:1, including wins.",
      },
      {
        title: "Blockers and concerns",
        description: "Anything slowing the person down or worrying them.",
      },
      {
        title: "Feedback",
        description: "Feedback given in either direction, quoted closely.",
      },
      {
        title: "Growth",
        description: "Career goals, skills, and development topics raised.",
      },
      {
        title: "Next steps",
        description: "Commitments from each person, with dates when stated.",
      },
    ],
  },
  {
    slug: "customer-discovery-call",
    title: "Customer discovery call",
    description:
      "Learn a customer's problems, current workflow and what they would pay to fix.",
    category: "Customers",
    icon: icon("user-search"),
    targets: ["customer", "user research"],
    sections: [
      {
        title: "About the customer",
        description: "Role, company, team size and context.",
      },
      {
        title: "Problems",
        description:
          "Pain points in their own words, with how often and how badly each one hurts.",
      },
      {
        title: "Current workflow",
        description:
          "How they handle it today, including tools and workarounds.",
      },
      {
        title: "Notable quotes",
        description: "Short verbatim quotes worth sharing with the team.",
      },
      {
        title: "Next steps",
        description:
          "Follow-ups agreed with the customer, with owners and dates.",
      },
    ],
  },
  {
    slug: "sales-call",
    title: "Sales call",
    description:
      "Qualify the deal and capture what the buyer needs to move forward.",
    category: "Sales",
    icon: icon("handshake"),
    targets: ["prospect", "buyer", "sales"],
    sections: [
      {
        title: "Prospect",
        description: "Company, attendees, and their roles.",
      },
      {
        title: "Needs and pain points",
        description: "What they are trying to solve and why now.",
      },
      {
        title: "Budget, authority, and timeline",
        description:
          "Budget, who decides and signs, and the timeline to buy, as stated.",
      },
      {
        title: "Objections",
        description: "Concerns raised and how each one was answered.",
      },
      {
        title: "Competitors",
        description: "Other vendors or options they mentioned.",
      },
      {
        title: "Next steps",
        description: "Agreed actions with owners and dates.",
      },
    ],
  },
  {
    slug: "candidate-interview",
    title: "Interview",
    description: "Notes on a candidate interview, kept to evidence.",
    category: "Hiring",
    icon: icon("briefcase"),
    targets: ["candidate", "hiring"],
    sections: [
      {
        title: "Candidate",
        description: "Name, role interviewed for and current position.",
      },
      {
        title: "Background",
        description: "Relevant experience and accomplishments they described.",
      },
      {
        title: "Strengths",
        description:
          "Strengths shown, each backed by a specific example from the conversation.",
      },
      {
        title: "Concerns",
        description: "Gaps or risks, each backed by a specific example.",
      },
      {
        title: "Candidate questions",
        description: "Questions the candidate asked and what they signal.",
      },
      {
        title: "Next steps",
        description: "Next stage of the process and who owns it.",
      },
    ],
  },
  {
    slug: "team-standup",
    title: "Team standup",
    description: "A short daily sync: done, next, and blocked, per person.",
    category: "Team",
    icon: icon("list-checks"),
    targets: ["team", "standup"],
    sections: [
      {
        title: "Done",
        description: "What each person finished, grouped by person.",
      },
      {
        title: "Next",
        description: "What each person is working on next, grouped by person.",
      },
      {
        title: "Blockers",
        description: "Anything blocked, who can unblock it and by when.",
      },
    ],
  },
  {
    slug: "project-kickoff",
    title: "Project kickoff",
    description:
      "Align on goals, scope, owners, and milestones at the start of a project.",
    category: "Projects",
    icon: icon("rocket"),
    targets: ["project", "kickoff"],
    sections: [
      {
        title: "Goals",
        description:
          "What the project must achieve and how success will be measured.",
      },
      {
        title: "Scope",
        description: "What is in and what is explicitly out.",
      },
      {
        title: "Roles",
        description: "Who owns what, including the decision maker.",
      },
      {
        title: "Milestones",
        description: "Key dates and deliverables in order.",
      },
      {
        title: "Risks and open questions",
        description:
          "Known risks, dependencies, and questions still to answer.",
      },
      {
        title: "Next steps",
        description: "Immediate actions with owners and dates.",
      },
    ],
  },
  {
    slug: "board-investor-update",
    title: "Board or investor update",
    description:
      "A board meeting or investor update: performance, asks, and decisions.",
    category: "Leadership",
    icon: icon("landmark"),
    targets: ["board", "investor"],
    sections: [
      {
        title: "Highlights",
        description: "The most important wins since the last update.",
      },
      {
        title: "Key metrics",
        description:
          "Numbers shared, such as revenue, growth, burn, and runway, with comparisons.",
      },
      {
        title: "Challenges",
        description: "Problems and risks, and the plan for each.",
      },
      {
        title: "Asks",
        description: "Specific help requested from the board or investors.",
      },
      {
        title: "Decisions and feedback",
        description: "Votes, approvals, and advice given.",
      },
      {
        title: "Next steps",
        description: "Actions with owners and dates.",
      },
    ],
  },
  {
    slug: "brainstorm",
    title: "Brainstorm",
    description: "Capture every idea, then the ones the group chose to pursue.",
    category: "General",
    icon: icon("lightbulb"),
    targets: ["brainstorm", "ideas"],
    sections: [
      {
        title: "Problem",
        description: "The question or challenge the group set out to solve.",
      },
      {
        title: "Ideas",
        description: "Every idea raised, one line each, grouped by theme.",
      },
      {
        title: "Shortlist",
        description: "The ideas the group favored and why.",
      },
      {
        title: "Next steps",
        description: "Who will explore or test which idea, and by when.",
      },
    ],
  },
  // Fork: no "Follow-up email" notes template. Its format rules turned the
  // email into bulleted headings and it replaced the summary in place; the
  // bottom bar's "Draft follow-up email" chip drafts it in chat instead, as
  // Granola's recipe does (journey-meeting P2; Granola docs "Follow-up
  // emails", "Writing effective recipes"; NN/g #2).
];
