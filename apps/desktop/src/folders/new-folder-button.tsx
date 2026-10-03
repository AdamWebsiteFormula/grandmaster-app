import { Trans } from "@lingui/react/macro";

import { Plus } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";

// Fork: the empty folders state's next step (ux-audit-oct3 B; NN/g empty
// states, nngroup.com/articles/empty-state-interface-design).
export function NewFolderButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="h-8 gap-1.5 px-3 shadow-none"
    >
      <Plus className="size-3.5" />
      <Trans>New folder</Trans>
    </Button>
  );
}
