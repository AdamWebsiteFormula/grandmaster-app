import { Trans, useLingui } from "@lingui/react/macro";
import { useCallback, useState } from "react";

import { CircleNotch, Sparkle, X } from "@anlg/ui/components/icons";
import { Badge } from "@anlg/ui/components/ui/badge";
import { Button } from "@anlg/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@anlg/ui/components/ui/tooltip";
import { toast } from "@anlg/ui/components/ui/toast";
import { cn } from "@anlg/utils";

import {
  removeSessionParticipant,
  useSessionParticipant,
} from "~/session/queries";
import { removeHumanSpeakerAssignments } from "~/stt/queries";

export function ParticipantChip({
  mappingId,
  enhancingHumanId,
  onEnhanceContact,
}: {
  mappingId: string;
  enhancingHumanId?: string;
  onEnhanceContact?: (humanId: string) => void;
}) {
  const details = useParticipantDetails(mappingId);

  const assignedHumanId = details?.humanId;
  const sessionId = details?.sessionId;
  const source = details?.source;

  const { remove: handleRemove, isRemoving } = useRemoveParticipant({
    mappingId,
    assignedHumanId,
    sessionId,
  });

  const { t } = useLingui();

  if (!details || source === "excluded" || isRemoving) {
    return null;
  }

  const { humanName, humanEmail } = details;
  const displayName = humanName.trim() || humanEmail?.trim();

  if (!displayName) {
    return null;
  }

  const isEnhancing = enhancingHumanId === assignedHumanId;
  const canEnhance = Boolean(onEnhanceContact && assignedHumanId);

  // Fork: the chip opened the hidden Contacts screen; it is now plain text
  // with a named, 24 px remove button (ux-audit-oct3 C, WCAG 4.1.2, 2.5.8).
  return (
    <Badge
      variant="secondary"
      className={cn([
        "bg-foreground/10 relative flex items-center gap-1 overflow-hidden py-0.5 pr-0.5 pl-2 text-xs",
        isEnhancing && "ring-ring/20 ring-1",
      ])}
    >
      {isEnhancing && (
        <span
          aria-hidden="true"
          className="animate-shimmer pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/60 to-transparent"
        />
      )}
      <span className="relative">{displayName}</span>
      {canEnhance && (
        <EnhanceContactButton
          isEnhancing={isEnhancing}
          isDisabled={Boolean(enhancingHumanId)}
          label={displayName}
          onClick={() => {
            if (assignedHumanId) {
              onEnhanceContact?.(assignedHumanId);
            }
          }}
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t`Remove ${displayName}`}
        title={t`Remove ${displayName}`}
        className="hover:bg-foreground/10 relative -my-1 size-6 rounded-full p-0"
        onClick={(e) => {
          e.stopPropagation();
          handleRemove();
        }}
      >
        <X className="h-2.5 w-2.5" />
      </Button>
    </Badge>
  );
}

function EnhanceContactButton({
  isEnhancing,
  isDisabled,
  label,
  onClick,
}: {
  isEnhancing: boolean;
  isDisabled: boolean;
  label: string;
  onClick: () => void;
}) {
  const { t } = useLingui();
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t`Fill in details from the invite: ${label}`}
          className="text-muted-foreground hover:text-foreground relative ml-0.5 h-3.5 w-3.5 p-0 hover:bg-transparent"
          disabled={isDisabled}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          {isEnhancing ? (
            <CircleNotch className="h-2.5 w-2.5 animate-spin" />
          ) : (
            <Sparkle className="h-2.5 w-2.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <Trans>Fill in details from the invite</Trans>
      </TooltipContent>
    </Tooltip>
  );
}

function useParticipantDetails(mappingId: string) {
  const participant = useSessionParticipant(mappingId);

  if (!participant) {
    return null;
  }

  return {
    mappingId,
    humanId: participant.humanId,
    humanName: participant.name,
    humanEmail: participant.email || undefined,
    humanJobTitle: participant.jobTitle || undefined,
    humanLinkedinUsername: participant.linkedinUsername || undefined,
    orgId: participant.organizationId || undefined,
    orgName: participant.organizationName || undefined,
    sessionId: participant.sessionId,
    source: participant.source,
  };
}

function useRemoveParticipant({
  mappingId,
  assignedHumanId,
  sessionId,
}: {
  mappingId: string;
  assignedHumanId: string | undefined;
  sessionId: string | undefined;
}) {
  const { t } = useLingui();
  const [isRemoving, setIsRemoving] = useState(false);

  const remove = useCallback(() => {
    setIsRemoving(true);
    void (async () => {
      if (assignedHumanId && sessionId) {
        await removeHumanSpeakerAssignments(sessionId, assignedHumanId);
      }
      await removeSessionParticipant(mappingId);
    })().catch((error) => {
      // Fork: a failed remove said nothing (task sweep, Oct 9; NN/g #9).
      setIsRemoving(false);
      console.error("[participants] failed to remove participant", error);
      toast.error(t`Couldn't remove this person. Try again.`);
    });
  }, [mappingId, assignedHumanId, sessionId, t]);

  return { remove, isRemoving };
}
