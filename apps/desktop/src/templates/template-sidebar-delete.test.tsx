import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tab: {} as Record<string, unknown>,
  menus: [] as Array<Array<{ id?: string; action?: () => void }>>,
  toastError: vi.fn(),
}));

vi.mock("./utils", () => ({
  AUTO_TEMPLATE_ID: "__auto__",
  useTemplateTab: () => mocks.tab,
}));
vi.mock("./queries", () => ({
  getTemplateCopyTitle: (title: string) => `${title} (Copy)`,
}));
vi.mock("./delete-template-dialog", () => ({
  DeleteTemplateDialog: ({
    template,
    onConfirm,
  }: {
    template: { id: string } | null;
    onConfirm: (id: string) => void;
  }) =>
    template ? (
      <button type="button" onClick={() => onConfirm(template.id)}>
        Confirm delete
      </button>
    ) : null,
}));
vi.mock("./template-icon", () => ({ TemplateIconGlyph: () => null }));
vi.mock("~/resource-sharing", () => ({
  parseSharedTemplatePayload: vi.fn(),
  SharedResourceLibrarySection: () => null,
}));
vi.mock("~/shared/config", () => ({ useConfigValue: () => "" }));
vi.mock("~/shared/hooks/useNativeContextMenu", () => ({
  useNativeContextMenu: (menu: Array<{ id?: string; action?: () => void }>) => {
    mocks.menus.push(menu);
    return vi.fn();
  },
}));
vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: Object.assign(vi.fn(), { error: mocks.toastError }),
}));

import type { UserTemplate } from "./queries";
import { TemplatesSidebarContent } from "./template-sidebar";

const tab = { type: "templates", state: {} } as never;
const mine = {
  id: "mine-1",
  title: "Weekly sync",
  description: "",
  pinned: false,
  icon: { type: "icon", value: "notebook-tabs" },
  sections: [],
} as unknown as UserTemplate;

function setTab(deleteTemplate: () => Promise<void>) {
  mocks.tab = {
    userTemplates: [mine],
    webTemplates: [],
    isWebLoading: false,
    isWebMode: false,
    selectedMineId: "mine-1",
    selectedWebIndex: null,
    setSelectedMineId: vi.fn(),
    setSelectedWebIndex: vi.fn(),
    createTemplate: vi.fn(),
    createDefaultTemplate: vi.fn(),
    deleteTemplate,
    toggleTemplateFavorite: vi.fn(),
  };
}

function requestDelete() {
  const item = mocks.menus
    .flat()
    .find((entry) => entry.id === "delete-template-mine-1");
  act(() => item?.action?.());
  fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
}

// Fork tests: task test, Oct 9.
describe("TemplatesSidebarContent delete", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    cleanup();
    mocks.menus = [];
    mocks.toastError.mockClear();
  });

  it("puts the keyboard in the search field after a delete", async () => {
    setTab(() => Promise.resolve());
    render(<TemplatesSidebarContent tab={tab} />);

    requestDelete();

    await vi.waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByPlaceholderText("Search templates"),
      ),
    );
  });

  it("says so when the delete fails", async () => {
    setTab(() => Promise.reject(new Error("locked")));
    render(<TemplatesSidebarContent tab={tab} />);

    requestDelete();

    await vi.waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Couldn't delete the template. Try again.",
      ),
    );
  });
});
