// Regenerates src/settings/ai/shared/models.fallback.json (the "Offline
// list") from models.dev. Keyless. Run before each release:
//   npx tsx scripts/update-models-fallback.ts [path/to/api.json]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type ModelRegistry,
  normalizeModelsDev,
} from "../src/settings/ai/shared/model-catalog";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../src/settings/ai/shared/models.fallback.json");

async function main() {
  const source = process.argv[2];
  const json: unknown = source
    ? JSON.parse(readFileSync(source, "utf8"))
    : await (await fetch("https://models.dev/api.json")).json();

  const providers = normalizeModelsDev(json);
  const count = Object.values(providers).reduce((n, l) => n + l.length, 0);
  if (count < 100) throw new Error(`Only ${count} models; refusing to write`);

  const registry: ModelRegistry = {
    fetchedAt: null,
    catalogSource: "bundled",
    fallbackVersion: new Date().toISOString().slice(0, 10),
    providers,
  };
  writeFileSync(out, `${JSON.stringify(registry)}\n`);
  console.log(`Wrote ${count} models from ${Object.keys(providers).length} providers`);
}

void main();
