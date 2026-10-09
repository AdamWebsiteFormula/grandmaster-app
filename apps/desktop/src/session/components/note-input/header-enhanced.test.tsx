import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeaderViewEnhanced } from "./header-enhanced";

const mocks = vi.hoisted(() => ({
  content: "" as string,
  isGenerating: false,
  enhance: vi.fn(() => Promise.resolve({ type: "started", noteId: "note-1" })),
  regenerate: vi.fn(() => Promise.resolve()),
  toast: vi.fn(),
}));

vi.mock("./template-picker", () => ({
  TemplatePickerPopover: ({
    onSelectTemplate,
    onRegenerateUsed,
  }: {
    onSelectTemplate: (selection: {
      templateId: string;
      title: string;
    }) => void;
    onRegenerateUsed: () => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onSelectTemplate({ templateId: "sales", title: "Sales" })
        }
      >
        Pick Sales
      </button>
      <button type="button" onClick={() => onRegenerateUsed()}>
        Regenerate
      </button>
    </div>
  ),
}));

vi.mock("./header-shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./header-shared")>()),
  getStoredNoteMarkdown: (content: unknown) =>
    typeof content === "string" ? content : "",
}));

vi.mock("~/session/components/note-input/enhanced-actions", () => ({
  useEnhancedNoteActions: () => ({
    isGenerating: mocks.isGenerating,
    isError: false,
    onRegenerate: mocks.regenerate,
  }),
}));

vi.mock("~/session/queries", () => ({
  useEnhancedNote: () => ({
    content: mocks.content,
    templateId: "general",
    title: "Summary",
  }),
}));

vi.mock("~/services/enhancer", () => ({
  getEnhancerService: () => ({ enhance: mocks.enhance }),
}));

vi.mock("~/ai/hooks", () => ({
  useAITaskTask: () => ({ isGenerating: false }),
}));

vi.mock("~/templates", () => ({
  useUserTemplate: () => ({ data: undefined }),
}));

vi.mock("~/shared/hooks/useNativeContextMenu", () => ({
  useNativeContextMenu: () => () => {},
}));

vi.mock("~/session/components/note-input/template-switch-offline", () => ({
  refuseTemplateSwitchOffline: () => false,
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: mocks.toast,
}));

vi.mock("~/shared/ui/destructive-confirmation-dialog", () => ({
  DestructiveConfirmationDialog: ({
    open,
    title,
    confirmLabel,
    onConfirm,
  }: {
    open: boolean;
    title: string;
    confirmLabel: string;
    onConfirm: () => void;
  }) =>
    open ? (
      <div role="dialog">
        <p>{title}</p>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

const renderHeader = () =>
  render(
    <HeaderViewEnhanced
      isActive
      sessionId="session-1"
      enhancedNoteId="note-1"
      variant="chip"
    />,
  );

// Fork tests: task test, Oct 8 (a new summary replaced an edited one with
// no warning; Granola asks before it overwrites notes you edited).
describe("HeaderViewEnhanced replace confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.content = "";
    mocks.isGenerating = false;
  });

  afterEach(() => {
    cleanup();
  });

  it("asks before another template replaces a summary", () => {
    mocks.content = "Decisions: ship Friday";
    renderHeader();

    fireEvent.click(screen.getByText("Pick Sales"));

    expect(mocks.enhance).not.toHaveBeenCalled();
    expect(screen.getByText("Replace this summary?")).toBeTruthy();

    fireEvent.click(screen.getByText("Replace"));

    expect(mocks.enhance).toHaveBeenCalledWith(
      "session-1",
      expect.objectContaining({ templateId: "sales", targetNoteId: "note-1" }),
    );
  });

  it("asks before Regenerate replaces a summary", () => {
    mocks.content = "Decisions: ship Friday";
    renderHeader();

    fireEvent.click(screen.getByText("Regenerate"));

    expect(mocks.regenerate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Replace"));
    expect(mocks.regenerate).toHaveBeenCalledWith(null);
  });

  it("writes at once when there is no summary to lose", () => {
    renderHeader();

    fireEvent.click(screen.getByText("Pick Sales"));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.enhance).toHaveBeenCalledTimes(1);
  });

  it("says why a template can't be picked while a summary is being written", () => {
    mocks.content = "Decisions: ship Friday";
    mocks.isGenerating = true;
    renderHeader();

    fireEvent.click(screen.getByText("Pick Sales"));

    expect(mocks.enhance).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });
});
