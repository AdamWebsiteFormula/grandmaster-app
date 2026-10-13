import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { type CSSProperties, useEffect, useRef } from "react";

import { ArrowElbowDownLeft } from "@anlg/ui/components/icons";
import { cn } from "@anlg/utils";

type DropdownOption = {
  id: string;
  name: string;
  isNew?: boolean;
  email?: string;
  orgId?: string;
  jobTitle?: string;
};

// Fork: a WAI-ARIA combobox list, so VoiceOver reads each suggestion as the
// arrow keys move (accessibility sweep, Oct 12; WAI-ARIA APG, Combobox
// pattern with aria-activedescendant). The input keeps keyboard focus.
export function participantOptionId(listboxId: string, index: number) {
  return `${listboxId}-option-${index}`;
}

export function ParticipantDropdown({
  listboxId,
  floatingRef,
  floatingStyles,
  options,
  selectedIndex,
  onSelect,
  onHover,
}: {
  listboxId: string;
  floatingRef: (node: HTMLDivElement | null) => void;
  floatingStyles: CSSProperties;
  options: DropdownOption[];
  selectedIndex: number;
  onSelect: (option: DropdownOption) => void;
  onHover: (index: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const selectedElement = list.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, options]);

  if (options.length === 0) {
    return null;
  }

  return (
    <div
      ref={floatingRef}
      style={floatingStyles}
      // Fork: above the note's date-and-people popover (z-50), which hid
      // the top of this list (in-app test, Oct 13).
      className="bg-popover z-[60] overflow-hidden rounded-md border shadow-md"
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-label={t`Suggested people`}
        className="max-h-50 overflow-auto py-1"
      >
        {options.map((option, index) => (
          <div
            key={option.id}
            id={participantOptionId(listboxId, index)}
            role="option"
            aria-selected={selectedIndex === index}
            className={cn([
              "cursor-default",
              "w-full px-3 py-1.5 text-left text-sm",
              selectedIndex === index ? "bg-muted" : "hover:bg-accent",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
            ])}
            onClick={() => onSelect(option)}
            onMouseEnter={() => onHover(index)}
          >
            <span className="flex w-full items-center justify-between">
              {option.isNew ? (
                <span>
                  <Trans>
                    Add “<span className="font-medium">{option.name}</span>”
                  </Trans>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="font-medium">{option.name}</span>
                  {option.jobTitle && (
                    <span className="text-muted-foreground text-xs">
                      {option.jobTitle}
                    </span>
                  )}
                </span>
              )}
              {selectedIndex === index && (
                <ArrowElbowDownLeft className="text-muted-foreground size-3" />
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
