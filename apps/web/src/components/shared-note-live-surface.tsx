import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { yXmlFragmentToProsemirrorJSON } from "y-prosemirror";
import type * as Y from "yjs";

import { schema, seedFragment } from "@anlg/editor/note";

import type { SharedAttachmentResolver } from "@/components/shared-note-document";
import { SharedNoteReadSurface } from "@/components/shared-note-read-surface";
import { env } from "@/env";
import {
  createSharedNoteLiveTicket,
  saveSharedNoteWebEdit,
} from "@/functions/shared-note-live";
import { readAuthenticatedSharedNote } from "@/functions/shared-notes";
import { useMountEffect } from "@/hooks/useMountEffect";
import {
  buildSharedNoteLiveSocketUrl,
  LIVE_SEED_ORIGIN,
  type SharedNoteLiveConnection,
  SharedNoteLiveClient,
  titleFromDocument,
} from "@/lib/shared-note-live";
import {
  type SharedNoteSnapshot,
  withoutDuplicateLeadingTitle,
} from "@/lib/shared-notes";

const FLUSH_DEBOUNCE_MS = 2_000;

/**
 * Editable shared-note surface bound to the api-sync live document. The CRDT
 * is the source of truth while connected; local edits are additionally
 * flushed into the durable snapshot through the existing web-edit CAS route
 * so desktop clients, previews, and viewers without a live connection keep
 * receiving content.
 */
export function SharedNoteLiveSurface({
  canCompose,
  excludedAttachmentIds,
  manageAccess,
  resolveAttachment,
  shareId,
  snapshot,
}: {
  canCompose: boolean;
  excludedAttachmentIds?: readonly string[];
  manageAccess: boolean;
  resolveAttachment?: SharedAttachmentResolver;
  shareId: string;
  snapshot: SharedNoteSnapshot;
}) {
  const revisionRef = useRef(snapshot.contentRevision);
  const dirtyRef = useRef(false);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [generation, setGeneration] = useState(0);

  const saveMutation = useMutation({
    mutationFn: async (fragment: Y.XmlFragment) => {
      const body = yXmlFragmentToProsemirrorJSON(fragment);
      const attempt = () =>
        saveSharedNoteWebEdit({
          data: {
            shareId,
            baseRevision: revisionRef.current,
            mutationId: crypto.randomUUID(),
            title: titleFromDocument(body, snapshot.title),
            body,
            attachmentIds: snapshot.attachments.map((a) => a.id),
          },
        });
      let result = await attempt();
      if (result.status === "conflict") {
        const current = await readAuthenticatedSharedNote({ data: shareId });
        if (current.status === "ready") {
          revisionRef.current = Math.max(
            revisionRef.current,
            current.note.snapshot.contentRevision,
          );
          result = await attempt();
        }
      }
      if (result.status === "ready") {
        revisionRef.current = Math.max(
          revisionRef.current,
          result.snapshot.contentRevision,
        );
      }
      return result;
    },
    retry: false,
  });
  const { mutate: save, data: saveResult } = saveMutation;

  const [client] = useState(() => {
    const connect = async (): Promise<SharedNoteLiveConnection> => {
      const result = await createSharedNoteLiveTicket({ data: shareId });
      if (result.status !== "ready") return result;
      revisionRef.current = Math.max(
        revisionRef.current,
        result.ticket.contentRevision,
      );
      return {
        status: "ready",
        socket: new WebSocket(
          buildSharedNoteLiveSocketUrl(
            env.VITE_API_URL,
            shareId,
            result.ticket.ticket,
          ),
        ),
      };
    };
    const liveClient = new SharedNoteLiveClient({
      connect,
      seed: (fragment) =>
        seedFragment(
          schema,
          withoutDuplicateLeadingTitle(snapshot.body, snapshot.title),
          fragment,
        ),
      onReset: () => {
        dirtyRef.current = false;
        setGeneration((value) => value + 1);
      },
      onRemoteRevision: (contentRevision) => {
        revisionRef.current = Math.max(revisionRef.current, contentRevision);
      },
    });
    return liveClient;
  });

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      if (!dirtyRef.current || client.getStatus().kind !== "live") return;
      dirtyRef.current = false;
      save(client.fragment);
    }, FLUSH_DEBOUNCE_MS);
  }, [client, save]);

  useMountEffect(() => {
    // Only edits authored in this tab are flushed: remote peers flush their
    // own, and the relay-applied updates carry the client as origin.
    const onUpdate = (_update: Uint8Array, origin: unknown, doc: Y.Doc) => {
      if (
        origin === client ||
        origin === LIVE_SEED_ORIGIN ||
        doc !== client.doc
      ) {
        return;
      }
      dirtyRef.current = true;
      scheduleFlush();
    };
    let boundDoc = client.doc;
    boundDoc.on("update", onUpdate);
    const rebind = client.subscribe(() => {
      if (client.doc === boundDoc) return;
      boundDoc = client.doc;
      boundDoc.on("update", onUpdate);
    });
    const flushNow = () => {
      if (!dirtyRef.current || client.getStatus().kind !== "live") return;
      dirtyRef.current = false;
      save(client.fragment);
    };
    window.addEventListener("pagehide", flushNow);
    return () => {
      window.removeEventListener("pagehide", flushNow);
      rebind();
      if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current);
      flushNow();
      client.destroy();
    };
  });

  const status = useSyncExternalStore(
    client.subscribe.bind(client),
    () => client.getStatus(),
    () => client.getStatus(),
  );
  const synced = useSyncExternalStore(
    client.subscribe.bind(client),
    () => client.isSynced(),
    () => false,
  );

  const editable = status.kind === "live" && status.capability === "editor";
  const surfaceProps = {
    canCompose,
    excludedAttachmentIds,
    manageAccess,
    resolveAttachment,
    shareId,
    signedIn: true,
    snapshot,
  };

  if (!editable || !synced) {
    return (
      <SharedNoteReadSurface
        key={`read:${snapshot.contentRevision}`}
        {...surfaceProps}
      />
    );
  }

  return (
    <>
      <SharedNoteReadSurface
        key={`live:${generation}`}
        {...surfaceProps}
        collaboration={{ fragment: client.fragment }}
      />
      {saveResult?.status === "forbidden" && (
        <p className="text-color-muted mt-4 text-xs" role="status">
          Your edits are live for collaborators but could not be saved to the
          shared note.
        </p>
      )}
    </>
  );
}
