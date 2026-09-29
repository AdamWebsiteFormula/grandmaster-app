import { useRef } from "react";

import { env } from "@/env";
import { useMountEffect } from "@/hooks/useMountEffect";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const turnstileScriptUrl =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let turnstileScriptPromise: Promise<TurnstileApi> | undefined;

export const isTurnstileEnabled = Boolean(env.VITE_TURNSTILE_SITE_KEY);

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }
  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  const scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = turnstileScriptUrl;
    script.addEventListener(
      "load",
      () => {
        if (window.turnstile) {
          resolve(window.turnstile);
        } else {
          reject(new Error("Turnstile API did not initialize"));
        }
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => reject(new Error("Turnstile API failed to load")),
      { once: true },
    );
    document.head.append(script);
  }).catch((error: unknown) => {
    turnstileScriptPromise = undefined;
    throw error;
  });
  turnstileScriptPromise = scriptPromise;

  return scriptPromise;
}

export function Turnstile({
  onToken,
}: {
  onToken: (token: string | undefined) => void;
}) {
  const siteKey = env.VITE_TURNSTILE_SITE_KEY;
  if (!siteKey) {
    return null;
  }

  return <TurnstileWidget siteKey={siteKey} onToken={onToken} />;
}

function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string | undefined) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useMountEffect(() => {
    let disposed = false;
    let widgetId: string | undefined;
    let turnstile: TurnstileApi | undefined;

    void loadTurnstile()
      .then((api) => {
        if (disposed || !containerRef.current) {
          return;
        }

        turnstile = api;
        widgetId = api.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(undefined),
          "error-callback": () => onTokenRef.current(undefined),
        });
      })
      .catch(() => {
        if (!disposed) {
          onTokenRef.current(undefined);
        }
      });

    return () => {
      disposed = true;
      if (widgetId !== undefined) {
        turnstile?.remove(widgetId);
      }
    };
  });

  return <div ref={containerRef} />;
}
