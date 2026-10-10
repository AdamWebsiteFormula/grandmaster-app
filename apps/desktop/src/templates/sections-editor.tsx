import { t as tm } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { Reorder, useDragControls } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { TemplateSection } from "@anlg/store";
import { DotsSixVertical, DotsThree, Plus } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";
import {
  AppFloatingPanel,
  appFloatingMenuPanelClassName,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@anlg/ui/components/ui/dropdown-menu";
import { Input } from "@anlg/ui/components/ui/input";
import { toast } from "@anlg/ui/components/ui/toast";
import { cn } from "@anlg/utils";

let pendingSectionFocusKey: string | null = null;

type SectionDraft = TemplateSection & { key: string };

function useEditableSections({
  disabled,
  initialItems,
  onChange,
}: {
  disabled: boolean;
  initialItems: TemplateSection[];
  onChange: (items: TemplateSection[]) => void;
}) {
  const [drafts, setDrafts] = useState<SectionDraft[]>(() =>
    initialItems.map((s) => ({ ...s, key: crypto.randomUUID() })),
  );

  useEffect(() => {
    setDrafts((prev) => {
      const changed =
        prev.length !== initialItems.length ||
        prev.some(
          (d, i) =>
            d.title !== initialItems[i]?.title ||
            d.description !== initialItems[i]?.description,
        );
      if (!changed) return prev;
      return initialItems.map((s, i) => ({
        ...s,
        key: prev[i]?.key ?? crypto.randomUUID(),
      }));
    });
  }, [initialItems]);

  const pendingCommit = useRef<TemplateSection[] | null>(null);

  useEffect(() => {
    if (pendingCommit.current) {
      const value = pendingCommit.current;
      pendingCommit.current = null;
      onChange(value);
    }
  });

  const commit = useCallback(
    (next: SectionDraft[] | ((prev: SectionDraft[]) => SectionDraft[])) => {
      setDrafts((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        pendingCommit.current = resolved.map(({ title, description }) => ({
          title,
          description,
        }));
        return resolved;
      });
    },
    [],
  );

  return {
    drafts,
    addSection: useCallback(() => {
      const key = crypto.randomUUID();
      // Fork: the new section's name takes typing at once (live task test,
      // Oct 9; Apple HIG, Entering data).
      pendingSectionFocusKey = key;
      commit((prev) => [...prev, { title: "", description: "", key }]);
    }, [commit]),
    changeSection: useCallback(
      (draft: SectionDraft) =>
        commit((prev) => prev.map((s) => (s.key === draft.key ? draft : s))),
      [commit],
    ),
    // Fork: Delete took the section and its text at once, and autosave
    // kept it gone. Offer Undo, as Delete note does (task test, Oct 9;
    // NN/g #3).
    deleteSection: useCallback(
      (key: string) => {
        const index = drafts.findIndex((s) => s.key === key);
        if (index < 0) return;
        const removed = drafts[index]!;
        commit((prev) => prev.filter((s) => s.key !== key));
        toast(tm`Section deleted`, {
          id: `section-deleted-${key}`,
          action: {
            label: tm`Undo`,
            onClick: () =>
              commit((prev) => {
                if (prev.some((s) => s.key === key)) return prev;
                const next = [...prev];
                next.splice(Math.min(index, next.length), 0, removed);
                return next;
              }),
          },
        });
      },
      [commit, drafts],
    ),
    insertSectionAt: useCallback(
      (index: number) =>
        commit((prev) => {
          const next = [...prev];
          next.splice(index, 0, {
            title: "",
            description: "",
            key: crypto.randomUUID(),
          });
          return next;
        }),
      [commit],
    ),
    moveSection: useCallback(
      (key: string, direction: -1 | 1) =>
        commit((prev) => {
          const i = prev.findIndex((s) => s.key === key);
          const j = i + direction;
          if (i < 0 || j < 0 || j >= prev.length) return prev;
          const next = [...prev];
          const [s] = next.splice(i, 1);
          next.splice(j, 0, s);
          return next;
        }),
      [commit],
    ),
    reorderSections: useCallback(
      (next: SectionDraft[]) => {
        if (!disabled) commit(next);
      },
      [commit, disabled],
    ),
  };
}

export function SectionsList({
  disabled,
  items,
  onChange,
}: {
  disabled: boolean;
  items: TemplateSection[];
  onChange: (items: TemplateSection[]) => void;
}) {
  const controls = useDragControls();
  const {
    drafts,
    addSection,
    changeSection,
    deleteSection,
    insertSectionAt,
    moveSection,
    reorderSections,
  } = useEditableSections({
    disabled,
    initialItems: items,
    onChange,
  });

  return (
    <div className="flex flex-col gap-3">
      <Reorder.Group values={drafts} onReorder={reorderSections}>
        <div className="flex flex-col gap-2">
          {drafts.map((draft, index) => (
            <Reorder.Item key={draft.key} value={draft}>
              <SectionItem
                disabled={disabled}
                index={index}
                total={drafts.length}
                item={draft}
                onChange={changeSection}
                onDelete={deleteSection}
                onInsertAbove={insertSectionAt}
                onInsertBelow={insertSectionAt}
                onMove={moveSection}
                dragControls={controls}
              />
            </Reorder.Item>
          ))}
        </div>
      </Reorder.Group>

      {!disabled && (
        <Button
          variant="outline"
          size="sm"
          className="border-border bg-card text-foreground hover:bg-background h-auto w-fit rounded-full px-4 py-2.5 text-sm shadow-[0_2px_6px_rgba(0,0,0,0.08),0_10px_18px_-10px_rgba(0,0,0,0.22)]"
          onClick={addSection}
          disabled={disabled}
        >
          <Plus className="mr-2 h-4 w-4" />
          {/* Fork: sentence case (ux-audit-oct3 B). */}
          <Trans>Add section</Trans>
        </Button>
      )}
    </div>
  );
}

function SectionItem({
  disabled,
  index,
  total,
  item,
  onChange,
  onDelete,
  onInsertAbove,
  onInsertBelow,
  onMove,
  dragControls,
}: {
  disabled: boolean;
  index: number;
  total: number;
  item: SectionDraft;
  onChange: (item: SectionDraft) => void;
  onDelete: (key: string) => void;
  onInsertAbove: (index: number) => void;
  onInsertBelow: (index: number) => void;
  onMove: (key: string, direction: -1 | 1) => void;
  dragControls: ReturnType<typeof useDragControls>;
}) {
  const { t } = useLingui();
  const [isFocused, setIsFocused] = useState(false);

  return (
    // Fork: no fill on the section band. A white band under gray fields read
    // as sunken on the light panel; the fields carry the fill now (NN/g #4;
    // Apple HIG Text fields).
    <div className="group relative">
      {!disabled && (
        // Fork: named, and shown on keyboard focus, not only hover
        // (ux-audit-oct3 B; WCAG 2.4.7, 4.1.2).
        <button
          type="button"
          aria-label={t`Drag to reorder`}
          title={t`Drag to reorder`}
          className="focus-visible:ring-ring absolute top-2.5 -left-5 cursor-move rounded-sm opacity-0 transition-opacity group-focus-within:opacity-60 group-hover:opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-hidden"
          onPointerDown={(event) => dragControls.start(event)}
          disabled={disabled}
        >
          <DotsSixVertical className="text-muted-foreground h-4 w-4" />
        </button>
      )}

      {!disabled && (
        <div className="absolute top-2 right-2 opacity-0 transition-all group-focus-within:opacity-100 group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-muted-foreground h-7 w-7"
                aria-label={t`Section actions`}
                title={t`Section actions`}
              >
                <DotsThree className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent variant="app" align="end">
              <AppFloatingPanel className={appFloatingMenuPanelClassName}>
                <DropdownMenuItem
                  onClick={() => onInsertAbove(index)}
                  className="cursor-pointer"
                >
                  <Trans>Insert above</Trans>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onInsertBelow(index + 1)}
                  className="cursor-pointer"
                >
                  <Trans>Insert below</Trans>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onMove(item.key, -1)}
                  disabled={index === 0}
                  className="cursor-pointer"
                >
                  <Trans>Move up</Trans>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onMove(item.key, 1)}
                  disabled={index === total - 1}
                  className="cursor-pointer"
                >
                  <Trans>Move down</Trans>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(item.key)}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trans>Delete</Trans>
                </DropdownMenuItem>
              </AppFloatingPanel>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Fork: the 36 px strip is for the section menu, which read-only
          built-in templates do not show, so their sections use the full
          width (picture review, Oct 6: 24 pt left, 60 pt right margins). */}
      <div className={cn(["flex flex-col gap-1", !disabled && "pr-9"])}>
        <Input
          ref={(input) => {
            if (input && pendingSectionFocusKey === item.key) {
              pendingSectionFocusKey = null;
              input.focus();
            }
          }}
          disabled={disabled}
          value={item.title}
          onChange={(e) => onChange({ ...item, title: e.target.value })}
          aria-label={t`Section name`}
          placeholder={t`Untitled`}
          // Fork: a read-only label keeps full opacity in the muted text
          // color. The Input's disabled:opacity-50 left it near 3.3:1 on
          // white in light; muted-foreground is 4.6:1 or more (WCAG 2.2
          // SC 1.4.3).
          className="placeholder:text-muted-foreground disabled:text-muted-foreground border-0 bg-transparent p-0 font-medium shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-100"
        />

        <textarea
          disabled={disabled}
          value={item.description}
          onChange={(e) => onChange({ ...item, description: e.target.value })}
          // Fork: plain-language hint, not template syntax (ux-audit-oct3 B;
          // NN/g #2).
          aria-label={t`Section content`}
          placeholder={t`What this section should cover, e.g. decisions made and who owns each`}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn([
            // Fork: the house field look of Settings text fields, editable or
            // read-only: white in light, the composers' dark:bg-muted in dark, a
            // border-input edge (settings/setting-row.tsx
            // SETTING_CONTROL_CLASS; NN/g #4; Apple HIG Text fields).
            // Fork: no resize grip; it grows with its text, as Mac text views
            // do (picture review, Oct 6; Apple HIG, Text views).
            // Fork: the folder Context box's insets, 12 pt across and 10 pt down,
            // so one text box looks the same on both pages (picture review,
            // Oct 9: 2 pt apart; Apple HIG, Text fields).
            "bg-card dark:bg-muted min-h-[100px] w-full resize-none rounded-lg border px-3 py-2.5 text-sm leading-5 transition-colors [field-sizing:content]",
            "focus-visible:outline-hidden",
            isFocused
              ? "ring-primary/20 border-primary ring-2"
              : "border-input",
          ])}
        />
      </div>
    </div>
  );
}
