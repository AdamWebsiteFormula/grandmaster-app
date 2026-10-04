import type { SyntheticEvent } from "react";

import manifest from "./static-assets.manifest.json";

import { env } from "~/env";

// Fork: every asset ships in the app (public/assets), so Upshot loads none
// from Anarlog's CDN, which still serves Anarlog's logo for anarlog-icon.png
// and would see each user's IP address. The manifest stays for upstream.
const USE_STATIC_ASSET_CDN = false;

export function staticAssetUrl(localPath: string) {
  const object = manifest[localPath as keyof typeof manifest];
  const origin = env.VITE_STATIC_ASSETS_URL;
  if (!USE_STATIC_ASSET_CDN || !origin || !object) return localPath;
  return `${origin.replace(/\/$/, "")}/${object.split("/").map(encodeURIComponent).join("/")}`;
}

export function fallbackToLocalAsset(localPath: string) {
  return (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.getAttribute("src") !== localPath) image.src = localPath;
  };
}
