// Fork: a template just made with + opens with its name selected, so typing
// names it, as Finder's New Folder does (live task test, Oct 9; Apple HIG,
// Entering data: start where the person will type).
let pendingTemplateId: string | null = null;

export function requestTemplateNameFocus(templateId: string) {
  pendingTemplateId = templateId;
}

export function takeTemplateNameFocus(templateId: string): boolean {
  if (pendingTemplateId !== templateId) return false;
  pendingTemplateId = null;
  return true;
}
