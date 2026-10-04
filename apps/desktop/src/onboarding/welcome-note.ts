import { platform } from "@tauri-apps/plugin-os";

import { md2json } from "@anlg/editor/markdown";
import type { SessionEvent } from "@anlg/store";

import { liveQueryClient } from "~/db";
import {
  WELCOME_NOTE_DEMO_URL,
  WELCOME_NOTE_TRACKING_ID,
} from "~/onboarding/welcome-note.constants";
import { createSession } from "~/session/queries";
import { DEFAULT_USER_ID } from "~/shared/utils";
import { listenerStore } from "~/store/zustand/listener/instance";

const PENDING_WELCOME_SESSION_KEY = "anarlog.pending-welcome-session";

// Fork: New note lives on Home, so the note says where it is (journey-first-run
// P1). The privacy lines match README "Privacy" (journey-first-run P2: FTC
// "clear and conspicuous" disclosures): recordings stay on this computer,
// audio streams to Upshot transcription (Deepgram, mip_opt_out: kept "only
// for the duration necessary to process the request", developers.deepgram.com
// Model Improvement Partnership Program) and summaries go to Upshot AI. Keys
// and device words follow the platform (Microsoft Writing Style Guide: Ctrl+N).
// The body starts after the title instead of repeating it (NN/g #8 aesthetic
// and minimalist design).
export function welcomeNoteMarkdown(currentPlatform: string = platform()) {
  const mac = currentPlatform === "macos";
  const newNoteKey = mac ? "⌘N" : "Ctrl+N";
  const device = mac ? "Mac" : "computer";
  return `Upshot takes notes for your meetings. No bot joins your call.


**Record:** on Home, click **New note** at the top right, or press **${newNoteKey}**. Upshot starts listening right away. It hears you through your microphone and the other people through your ${device}'s sound.


**Take notes:** jot a few words while you talk, or nothing at all.


**Finish:** click **Stop** at the bottom. Upshot turns your notes and the transcript into a clear summary with Upshot AI.


**See an example:** open **Example: Product sync** on Home for a finished summary and transcript.


Recordings, notes and transcripts are stored on this ${device}. While you record, audio streams to Upshot transcription (Deepgram), which keeps nothing. When Upshot writes a summary, the note and transcript go to Upshot AI, which keeps nothing.`;
}

let pendingWelcomeSession: Promise<string> | null = null;

export function getOrCreateWelcomeSession(): Promise<string> {
  if (!pendingWelcomeSession) {
    pendingWelcomeSession = findOrCreateWelcomeSession().finally(() => {
      pendingWelcomeSession = null;
    });
  }
  return pendingWelcomeSession;
}

export function setPendingWelcomeSession(sessionId: string | null) {
  if (sessionId) {
    localStorage.setItem(PENDING_WELCOME_SESSION_KEY, sessionId);
  } else {
    localStorage.removeItem(PENDING_WELCOME_SESSION_KEY);
  }
}

export function takePendingWelcomeSession(): string | null {
  const sessionId = localStorage.getItem(PENDING_WELCOME_SESSION_KEY);
  localStorage.removeItem(PENDING_WELCOME_SESSION_KEY);
  return sessionId;
}

export async function stopActiveWelcomeDemo() {
  const active = listenerStore.getState().live;
  const sessionId = active.sessionId;
  if (!sessionId || active.status !== "active") {
    return;
  }
  const captureGeneration = active.captureGenerationBySession[sessionId];

  const rows = await liveQueryClient.execute<{ id: string }>(
    `
      SELECT id
      FROM sessions
      WHERE id = ?
        AND deleted_at IS NULL
        AND CASE
          WHEN json_valid(event_json)
          THEN json_extract(event_json, '$.tracking_id')
        END = ?
      LIMIT 1
    `,
    [sessionId, WELCOME_NOTE_TRACKING_ID],
  );
  if (!rows[0]) {
    return;
  }

  const current = listenerStore.getState();
  if (
    current.live.sessionId === sessionId &&
    current.live.status === "active" &&
    current.live.captureGenerationBySession[sessionId] === captureGeneration
  ) {
    current.stop();
  }
}

async function findOrCreateWelcomeSession(): Promise<string> {
  const rows = await liveQueryClient.execute<{ id: string }>(
    `
      SELECT id
      FROM sessions
      WHERE deleted_at IS NULL
        AND CASE
          WHEN json_valid(event_json)
          THEN json_extract(event_json, '$.tracking_id')
        END = ?
      ORDER BY created_at, id
      LIMIT 1
    `,
    [WELCOME_NOTE_TRACKING_ID],
  );
  if (rows[0]) return rows[0].id;

  const now = new Date().toISOString();
  const event: SessionEvent = {
    tracking_id: WELCOME_NOTE_TRACKING_ID,
    calendar_id: "",
    title: "Welcome to Upshot",
    started_at: now,
    ended_at: "",
    is_all_day: false,
    has_recurrence_rules: false,
    // Fork: no prerecorded demo; it lived on the upstream server. An empty
    // link means no "Join & record" button on the welcome note.
    meeting_link: WELCOME_NOTE_DEMO_URL,
    description: "How to record your first meeting with Upshot.",
  };

  return createSession("Welcome to Upshot", DEFAULT_USER_ID, {
    event_json: JSON.stringify(event),
    raw_md: JSON.stringify(md2json(welcomeNoteMarkdown())),
  });
}
