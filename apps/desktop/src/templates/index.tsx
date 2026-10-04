import { TemplateView } from "./template-body";
import { TemplatesSidebarContent } from "./template-sidebar";

import { StandardContentWrapper } from "~/shared/main";
import { type Tab } from "~/store/zustand/tabs";

export { parseWebTemplates } from "./codec";
export type { WebTemplate } from "./codec";
export {
  useCreateTemplate,
  useUserTemplate,
  useUserTemplates,
} from "./queries";
export type { UserTemplate, UserTemplateDraft } from "./queries";
export { DEFAULT_TEMPLATE_ICON, TemplateIconGlyph } from "./template-icon";
export type { TemplateIcon } from "./template-icon";
export { useOpenTemplatesTab } from "./use-open-templates-tab";
export { filterWebTemplatesAgainstUserTemplates } from "./utils";
export { TemplatesSidebarContent } from "./template-sidebar";

export function TabContentTemplate({
  tab,
}: {
  tab: Extract<Tab, { type: "templates" }>;
}) {
  return (
    <StandardContentWrapper>
      {/* Fork: the template list sits in the page, beside the editor, so the
          main sidebar stays (backlog item 2; Granola's Note templates shows
          its list left of the editor; Apple HIG, Split views). */}
      <div className="flex h-full min-h-0">
        <div className="border-border flex w-56 shrink-0 flex-col border-r px-2 pb-2">
          <TemplatesSidebarContent tab={tab} />
        </div>
        <div className="min-w-0 flex-1">
          <TemplateView tab={tab} />
        </div>
      </div>
    </StandardContentWrapper>
  );
}
