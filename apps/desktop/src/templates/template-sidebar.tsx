import { t as tm } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowsDownUp,
  BookOpenText,
  MagnifyingGlass,
  Plus,
  Sparkle,
  X,
} from "@anlg/ui/components/icons";
import { toast } from "@anlg/ui/components/ui/toast";
import { Button } from "@anlg/ui/components/ui/button";
import {
  AppFloatingPanel,
  appFloatingMenuPanelClassName,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@anlg/ui/components/ui/dropdown-menu";
import { useSquircleRef } from "@anlg/ui/hooks/use-squircle";
import { cn } from "@anlg/utils";

import { type WebTemplate } from "./codec";
import { DeleteTemplateDialog } from "./delete-template-dialog";
import { getTemplateCopyTitle, type UserTemplate } from "./queries";
import { TemplateIconGlyph } from "./template-icon";
import { AUTO_TEMPLATE_ID, useTemplateTab } from "./utils";

import {
  parseSharedTemplatePayload,
  SharedResourceLibrarySection,
} from "~/resource-sharing";
import { useConfigValue } from "~/shared/config";
import { useNativeContextMenu } from "~/shared/hooks/useNativeContextMenu";
import { type Tab } from "~/store/zustand/tabs";

type SortOption = "alphabetical" | "reverse-alphabetical";

export function TemplatesSidebarContent({
  tab,
}: {
  tab: Extract<Tab, { type: "templates" }>;
}) {
  const { t } = useLingui();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchRef = useSquircleRef<HTMLDivElement>();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("alphabetical");
  const autoPrompt = useConfigValue("auto_summary_prompt");

  const {
    userTemplates,
    webTemplates,
    isWebLoading,
    isWebMode,
    selectedMineId: effectiveSelectedMineId,
    selectedWebIndex: effectiveSelectedWebIndex,
    setSelectedMineId,
    setSelectedWebIndex,
    createTemplate,
    createDefaultTemplate,
    deleteTemplate,
    toggleTemplateFavorite,
  } = useTemplateTab(tab);

  const handleDuplicateTemplate = useCallback(
    async (template: UserTemplate) => {
      const id = await createTemplate({
        title: getTemplateCopyTitle(template.title),
        description: template.description ?? "",
        category: template.category,
        icon: template.icon,
        targets: template.targets,
        sections: template.sections.map((section) => ({ ...section })),
      });

      if (id) {
        setSelectedMineId(id);
      }
    },
    [createTemplate, setSelectedMineId],
  );

  const handleDeleteTemplate = useCallback(
    async (id: string) => {
      // Fork: a failed delete says so, and after a delete the keyboard lands
      // in the template search field, not on the page; the row that opened
      // the menu is gone (task test, Oct 9; NN/g #9; WCAG 2.2 SC 2.4.3).
      try {
        await deleteTemplate(id);
      } catch (error) {
        console.error("[templates] failed to delete", error);
        toast.error(tm`Couldn't delete the template. Try again.`);
        return;
      }

      if (effectiveSelectedMineId === id) {
        setSelectedMineId(null);
      }
      window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    },
    [deleteTemplate, effectiveSelectedMineId, setSelectedMineId],
  );

  const [pendingDelete, setPendingDelete] = useState<UserTemplate | null>(null);
  const requestDeleteTemplate = useCallback(
    (id: string) => {
      setPendingDelete(
        userTemplates.find((template) => template.id === id) ?? null,
      );
    },
    [userTemplates],
  );

  const handleToggleFavorite = useCallback(
    async (id: string) => {
      await toggleTemplateFavorite(id);
    },
    [toggleTemplateFavorite],
  );

  const sortedUserTemplates = useMemo(() => {
    const favorites = userTemplates
      .filter((template) => template.pinned)
      .sort((a, b) => {
        const orderA = a.pinOrder ?? Infinity;
        const orderB = b.pinOrder ?? Infinity;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return (a.title || "").localeCompare(b.title || "");
      });

    const others = userTemplates.filter((template) => !template.pinned);
    switch (sortOption) {
      case "alphabetical":
        others.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        break;
      case "reverse-alphabetical":
      default:
        others.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
        break;
    }

    return [...favorites, ...others];
  }, [userTemplates, sortOption]);

  const filteredMine = useMemo(() => {
    if (!search.trim()) return sortedUserTemplates;
    const q = search.toLowerCase();
    return sortedUserTemplates.filter(
      (template) =>
        template.title?.toLowerCase().includes(q) ||
        template.description?.toLowerCase().includes(q) ||
        template.category?.toLowerCase().includes(q) ||
        template.targets?.some((target) => target.toLowerCase().includes(q)),
    );
  }, [sortedUserTemplates, search]);

  const filteredWeb = useMemo(() => {
    const query = search.toLowerCase().trim();

    const matchingTemplates = webTemplates.flatMap((template, index) => {
      const matches =
        !query ||
        template.title?.toLowerCase().includes(query) ||
        template.description?.toLowerCase().includes(query) ||
        template.category?.toLowerCase().includes(query) ||
        template.targets?.some((target) =>
          target.toLowerCase().includes(query),
        );

      return matches ? [{ template, index }] : [];
    });

    matchingTemplates.sort((a, b) => {
      const titleA = a.template.title || "";
      const titleB = b.template.title || "";

      return sortOption === "reverse-alphabetical"
        ? titleB.localeCompare(titleA)
        : titleA.localeCompare(titleB);
    });

    return matchingTemplates;
  }, [search, sortOption, webTemplates]);

  const combinedTemplates = useMemo<
    Array<
      | {
          key: typeof AUTO_TEMPLATE_ID;
          title: "Auto";
          selected: boolean;
          source: "auto";
          customized: boolean;
        }
      | {
          key: string;
          title: string;
          selected: boolean;
          pinned: boolean;
          source: "user";
          template: UserTemplate;
        }
      | {
          key: string;
          title: string;
          selected: boolean;
          pinned: false;
          source: "web";
          index: number;
          template: WebTemplate;
        }
    >
  >(() => {
    const query = search.trim().toLowerCase();
    const auto =
      !query || "auto".includes(query)
        ? [
            {
              key: AUTO_TEMPLATE_ID as typeof AUTO_TEMPLATE_ID,
              title: "Auto" as const,
              selected:
                !isWebMode && effectiveSelectedMineId === AUTO_TEMPLATE_ID,
              source: "auto" as const,
              customized: Boolean(autoPrompt.trim()),
            },
          ]
        : [];
    const mine = filteredMine.map((template) => ({
      key: template.id,
      title: template.title?.trim() || "Untitled",
      selected: !isWebMode && effectiveSelectedMineId === template.id,
      pinned: Boolean(template.pinned),
      source: "user" as const,
      template,
    }));

    const web = filteredWeb.map(({ template, index }) => ({
      key: template.slug || `web-${index}`,
      title: template.title?.trim() || "Untitled",
      selected: isWebMode && effectiveSelectedWebIndex === index,
      pinned: false as const,
      source: "web" as const,
      index,
      template,
    }));

    return [...auto, ...mine, ...web];
  }, [
    autoPrompt,
    effectiveSelectedMineId,
    effectiveSelectedWebIndex,
    filteredMine,
    filteredWeb,
    isWebMode,
    search,
  ]);

  const hasResults = combinedTemplates.length > 0;
  const isEmpty = !isWebLoading && !hasResults;

  const selectCombinedTemplate = useCallback(
    (
      item:
        | {
            source: "auto";
          }
        | {
            source: "user";
            template: UserTemplate;
          }
        | {
            source: "web";
            index: number;
          },
    ) => {
      if (item.source === "auto") {
        setSelectedMineId(AUTO_TEMPLATE_ID);
        return;
      }

      if (item.source === "user") {
        setSelectedMineId(item.template.id);
        return;
      }

      setSelectedWebIndex(item.index);
    },
    [setSelectedMineId, setSelectedWebIndex],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !event.altKey ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        (event.key !== "ArrowUp" && event.key !== "ArrowDown")
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("input, textarea, select, [contenteditable='true']"))
      ) {
        return;
      }

      if (combinedTemplates.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const currentIndex = combinedTemplates.findIndex((item) => item.selected);
      const nextIndex =
        currentIndex === -1
          ? event.key === "ArrowDown"
            ? 0
            : combinedTemplates.length - 1
          : Math.max(
              0,
              Math.min(
                combinedTemplates.length - 1,
                currentIndex + (event.key === "ArrowDown" ? 1 : -1),
              ),
            );

      const nextItem = combinedTemplates[nextIndex];
      if (!nextItem || nextIndex === currentIndex) {
        return;
      }

      selectCombinedTemplate(nextItem);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [combinedTemplates, selectCombinedTemplate]);

  // Fork: follow the open row when its position moves, not only when the
  // selection changes. The saved templates load after the first render and
  // sit above the built-in ones, which pushed the open built-in row below the
  // fold with no row marked (NN/g #1, visibility of system status).
  const selectedRowIndex = combinedTemplates.findIndex((item) => item.selected);

  useEffect(() => {
    const selectedElement = scrollContainerRef.current?.querySelector(
      "[data-template-selected='true']",
    );

    if (!(selectedElement instanceof HTMLElement)) {
      return;
    }

    selectedElement.scrollIntoView({
      block: "nearest",
    });
  }, [effectiveSelectedMineId, effectiveSelectedWebIndex, selectedRowIndex]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div>
        {/* Fork: the list's own header row, level with the editor's title
            row, as Granola's Note templates heads its list with New template
            (Granola Help Center, "Customize notes with templates"). */}
        {/* Fork: pr-1 puts the + icon 12 pt inside the search field's right
            edge, as the title sits 12 pt inside its left (picture review,
            Oct 7: 8 pt). */}
        <div className="flex h-12 items-center gap-1 pr-1 pl-3">
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
            <Trans>Templates</Trans>
          </h1>
          {userTemplates.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {/* Fork: named icon buttons (ux-audit-oct3 B, WCAG 4.1.2). */}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t`Sort templates`}
                  title={t`Sort templates`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowsDownUp size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent variant="app" align="end">
                <AppFloatingPanel className={appFloatingMenuPanelClassName}>
                  <DropdownMenuItem
                    onClick={() => setSortOption("alphabetical")}
                  >
                    <Trans>A to Z</Trans>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortOption("reverse-alphabetical")}
                  >
                    <Trans>Z to A</Trans>
                  </DropdownMenuItem>
                </AppFloatingPanel>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button
            size="icon"
            variant="ghost"
            aria-label={t`New template`}
            title={t`New template`}
            className="text-muted-foreground hover:text-foreground"
            onClick={createDefaultTemplate}
          >
            <Plus size={16} />
          </Button>
        </div>

        <div className="pb-2">
          <div
            ref={searchRef}
            className={cn([
              // Fork: the Settings search style: the field-border gray
              // (picture review, Oct 6: 1.15:1 light, 1.76:1 dark; WCAG 2.2
              // SC 1.4.11) and a focus ring (SC 2.4.7).
              "border-input bg-accent/50 flex h-8 w-full shrink-0 items-center gap-2 rounded-lg border px-3",
              "focus-within:bg-accent focus-within:ring-ring transition-colors focus-within:ring-1",
            ])}
          >
            <MagnifyingGlass className="text-muted-foreground h-4 w-4 shrink-0" />
            <input
              aria-label={t`Search templates`}
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearch("");
                }
              }}
              placeholder={t`Search templates`}
              className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm placeholder:text-sm focus:outline-hidden"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className={cn([
                  "h-4 w-4 shrink-0",
                  "text-muted-foreground hover:text-muted-foreground",
                  "transition-colors",
                ])}
                aria-label={t`Clear search`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fork: rows fade at the list's top and bottom edges instead of being
          cut against the search field (picture review, Oct 8; Apple HIG,
          scroll edge effect); scroll-py-6 keeps the selected template,
          scrolled into view, clear of the 24 pt fade. */}
      <div
        ref={scrollContainerRef}
        className="scrollbar-hide scroll-fade-y flex-1 scroll-py-6 overflow-y-auto"
      >
        {isEmpty ? (
          <div className="text-muted-foreground px-3 py-8 text-center">
            <BookOpenText
              size={32}
              className="text-muted-foreground/70 mx-auto mb-2"
            />
            <p className="text-sm">
              {search ? "No templates found" : "No templates yet"}
            </p>
            {!search && (
              <button
                onClick={createDefaultTemplate}
                className="text-muted-foreground hover:text-foreground mt-3 text-sm underline"
              >
                <Trans>Create my first template</Trans>
              </button>
            )}
          </div>
        ) : (
          <>
            {hasResults && (
              <div className="pt-1">
                {combinedTemplates.map((item, index) => (
                  <Fragment key={item.key}>
                    <TemplateGroupHeading
                      source={item.source}
                      previous={combinedTemplates[index - 1]?.source}
                    />
                    {item.source === "auto" ? (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setSelectedMineId(AUTO_TEMPLATE_ID)}
                        data-template-selected={item.selected}
                        className={cn([
                          "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors select-none",
                          // Fork: the open template takes the Settings sidebar's
                          // gray selection fill, not the hover step (design-system
                          // "Contrast"; Apple HIG Sidebars; NN/g #1, #4).
                          item.selected
                            ? "bg-sidebar-accent"
                            : "hover:bg-accent/50",
                        ])}
                      >
                        <div className="flex items-center gap-2">
                          {/* Fork: neutral, as the note picker shows Auto; orange
                            marks only the main action (design-system.md The one
                            accent; Apple HIG Color). */}
                          <Sparkle className="text-muted-foreground size-4" />
                          <div className="min-w-0 flex-1">
                            <div
                              className={cn([
                                "truncate",
                                item.selected && "font-medium",
                              ])}
                            >
                              {item.title}
                            </div>
                            {item.customized ? (
                              <div className="text-muted-foreground truncate text-xs">
                                <Trans>Customized</Trans>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    ) : item.source === "user" ? (
                      <TemplateListItem
                        key={item.key}
                        template={item.template}
                        selected={item.selected}
                        onSelect={setSelectedMineId}
                        onToggleFavorite={handleToggleFavorite}
                        onDuplicate={handleDuplicateTemplate}
                        onDelete={requestDeleteTemplate}
                      />
                    ) : (
                      <button
                        key={item.key}
                        onClick={() => setSelectedWebIndex(item.index)}
                        data-template-selected={item.selected}
                        className={cn([
                          "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors select-none",
                          // Fork: the Settings sidebar's gray selection fill (see
                          // the Auto row above).
                          item.selected
                            ? "bg-sidebar-accent"
                            : "hover:bg-accent/50",
                        ])}
                      >
                        <div className="flex items-center gap-2">
                          <TemplateIconGlyph
                            icon={item.template.icon}
                            className="size-4 text-sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div
                              className={cn([
                                "truncate",
                                item.selected && "font-medium",
                              ])}
                            >
                              {item.title}
                            </div>
                          </div>
                        </div>
                      </button>
                    )}
                  </Fragment>
                ))}
              </div>
            )}

            {isWebLoading && !hasResults && (
              <div className="pt-1">
                <div className="flex flex-col gap-1">
                  {[0, 1, 2, 3].map((index) => (
                    <div
                      key={index}
                      className="animate-pulse rounded-lg px-3 py-2"
                    >
                      <div className="bg-accent h-4 w-3/4 rounded-xs" />
                      <div className="bg-muted mt-1.5 h-3 w-1/3 rounded-xs" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <SharedResourceLibrarySection
              resourceType="template"
              search={search}
              onImport={async (resource) => {
                const id = await createTemplate(
                  parseSharedTemplatePayload(resource.payload),
                );
                if (id) setSelectedMineId(id);
              }}
            />
          </>
        )}
      </div>
      <DeleteTemplateDialog
        template={pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={(id) => void handleDeleteTemplate(id)}
      />
    </div>
  );
}

function TemplateListItem({
  template,
  selected,
  onSelect,
  onToggleFavorite,
  onDuplicate,
  onDelete,
}: {
  template: UserTemplate;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onDuplicate: (template: UserTemplate) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useLingui();
  // Fork: menu and tile words go through t (journey-after P3 "Templates").
  const contextMenu = useMemo(
    () => [
      {
        id: `favorite-template-${template.id}`,
        text: template.pinned ? t`Unfavorite` : t`Favorite`,
        action: () => onToggleFavorite(template.id),
      },
      { separator: true as const },
      {
        id: `duplicate-template-${template.id}`,
        text: t`Duplicate`,
        action: () => onDuplicate(template),
      },
      // Fork: Delete sits in its own group, as in the note menu (Apple HIG
      // Menus: separate groups of items with a separator).
      { separator: true as const },
      {
        id: `delete-template-${template.id}`,
        text: t`Delete…`,
        action: () => onDelete(template.id),
      },
    ],
    [onDelete, onDuplicate, onToggleFavorite, t, template],
  );
  const showContextMenu = useNativeContextMenu(contextMenu);

  return (
    <button
      onClick={() => onSelect(template.id)}
      onContextMenu={(e) => {
        onSelect(template.id);
        void showContextMenu(e);
      }}
      data-template-selected={selected}
      className={cn([
        "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors select-none",
        // Fork: the Settings sidebar's gray selection fill (see the Auto row).
        selected ? "bg-sidebar-accent" : "hover:bg-accent/50",
      ])}
    >
      <div className="flex items-center gap-2">
        <TemplateIconGlyph icon={template.icon} className="size-4 text-sm" />
        <div className="min-w-0 flex-1">
          {/* Fork: regular weight, medium only on the open row, as the
              sidebar and Chat lists (picture review, Oct 9; Apple HIG,
              Typography). */}
          <div className={cn(["truncate", selected && "font-medium"])}>
            {template.title?.trim() || t`Untitled template`}
          </div>
        </div>
      </div>
    </button>
  );
}

// Fork: label the two groups, your saved templates and the built-in ones,
// so the list reads as two sets, not one A to Z run (backlog item 3; Apple
// HIG, Lists and tables: section headers group related rows).
function TemplateGroupHeading({
  source,
  previous,
}: {
  source: "auto" | "user" | "web";
  previous?: "auto" | "user" | "web";
}) {
  const { t } = useLingui();
  if (source === "auto" || source === previous) {
    return null;
  }

  return (
    <div className="text-muted-foreground px-3 pt-3 pb-1 text-xs font-medium">
      {source === "user" ? t`Your templates` : t`Built-in`}
    </div>
  );
}
