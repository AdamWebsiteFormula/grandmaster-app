import { useCallback } from "react";

import type { ContactsSelection } from "@anlg/plugin-windows";

import { confirmContactDelete, deleteContactOrSay } from "./contact-actions";
import { DetailsColumn } from "./details";
import { OrganizationDetailsColumn } from "./organization-details";
import { useHumans, useOrganizations } from "./queries";

import { useOptionalAuth } from "~/auth";
import { StandardContentWrapper } from "~/shared/main";
import { useOwnerUserId } from "~/shared/owner-user";
import { type Tab, useTabs } from "~/store/zustand/tabs";

export function TabContentContact({
  tab,
}: {
  tab: Extract<Tab, { type: "contacts" }>;
}) {
  return (
    <StandardContentWrapper>
      <ContactView tab={tab} />
    </StandardContentWrapper>
  );
}

function ContactView({ tab }: { tab: Extract<Tab, { type: "contacts" }> }) {
  const updateContactsTabState = useTabs(
    (state) => state.updateContactsTabState,
  );
  const openCurrent = useTabs((state) => state.openCurrent);
  const invalidateResource = useTabs((state) => state.invalidateResource);

  const selected = tab.state.selected;
  const localOwnerUserId = useOwnerUserId();
  const auth = useOptionalAuth();
  const ownerUserId = auth?.session?.user.id ?? localOwnerUserId;
  const humans = useHumans();
  const self = humans.find((human) => human.id === ownerUserId);
  const organizations = useOrganizations();

  const setSelected = useCallback(
    (value: ContactsSelection | null) => {
      updateContactsTabState(tab, { selected: value });
    },
    [updateContactsTabState, tab],
  );

  const handleSessionClick = useCallback(
    (id: string) => {
      openCurrent({ type: "sessions", id });
    },
    [openCurrent],
  );

  const handleDeletePerson = useCallback(
    (id: string) => {
      void (async () => {
        if (!(await confirmContactDelete("person"))) return;
        invalidateResource("humans", id);
        setSelected(null);
        await deleteContactOrSay("person", id);
      })();
    },
    [invalidateResource, setSelected],
  );

  const handleDeleteOrganization = useCallback(
    (id: string) => {
      void (async () => {
        if (!(await confirmContactDelete("organization"))) return;
        invalidateResource("organizations", id);
        setSelected(null);
        await deleteContactOrSay("organization", id);
      })();
    },
    [invalidateResource, setSelected],
  );

  const effectiveSelection =
    selected ??
    (self ? ({ type: "person", id: self.id } as const) : null) ??
    (humans[0]
      ? ({ type: "person", id: humans[0].id } as const)
      : organizations[0]
        ? ({ type: "organization", id: organizations[0].id } as const)
        : null);

  return (
    <div className="h-full">
      {effectiveSelection?.type === "organization" ? (
        <OrganizationDetailsColumn
          key={effectiveSelection.id}
          organization={
            organizations.find(
              (organization) => organization.id === effectiveSelection.id,
            ) ?? null
          }
          humans={humans}
          onPersonClick={(personId) =>
            setSelected({ type: "person", id: personId })
          }
          onDelete={handleDeleteOrganization}
        />
      ) : (
        <DetailsColumn
          key={effectiveSelection?.id ?? "empty"}
          human={
            effectiveSelection?.type === "person"
              ? (humans.find((human) => human.id === effectiveSelection.id) ??
                null)
              : null
          }
          humans={humans}
          organizations={organizations}
          handleSessionClick={handleSessionClick}
          onDelete={handleDeletePerson}
        />
      )}
    </div>
  );
}
