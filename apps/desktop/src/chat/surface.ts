export type ChatToolbarSurface = "light" | "dark";

export function isChatDarkAppearance(): boolean {
  return false;
}

export function chatPanelClassNames(): string {
  return "bg-card text-card-foreground";
}

// Fork: tokens, not hex, and flat: one surface step and a hairline, no
// 84 px shadow (journey-after P3 "Floating chat"; design-system "Shape and
// space": no drop shadows, separate layers with a 1 px border).
export function chatFloatingPanelClassNames(): string {
  return "bg-popover text-card-foreground";
}

export function chatPanelBorderClassNames(): string {
  return "border-border";
}

export function chatFloatingPanelShellClassNames(): string {
  return "bg-popover text-card-foreground rounded-[24px] border border-border";
}

export function chatElevatedSurfaceClassNames(): string {
  return "bg-card text-card-foreground border-input";
}

export function chatInputEditorClassNames(): string {
  return "chat-input-editor text-card-foreground";
}

export function chatSendButtonDisabledClassNames(): string {
  return "cursor-default border-border text-muted-foreground/60";
}

export function chatSendButtonShortcutDisabledClassNames(): string {
  return "text-muted-foreground/60";
}

export function chatToolbarSurface(): ChatToolbarSurface {
  return "light";
}

export function chatFloatingControlClassNames(): string {
  return "border-border bg-accent text-accent-foreground hover:bg-accent/90";
}
