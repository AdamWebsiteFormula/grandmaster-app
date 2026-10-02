# SOP: always-current model picker (F1)

Scope: `grandmaster/features.md` F1. Read-only map of upstream Anarlog `desktop_v1.4.28`, then the smallest-diff plan. All paths under `apps/desktop/src/` unless noted. Line numbers are from this checkout.

## 1. Where providers and model IDs live

### 1a. Provider registry (frontend)

| path:line | what | note |
|---|---|---|
| `settings/ai/llm/shared.tsx:66-683` | `_PROVIDERS`: id, displayName, baseUrl, requirements, links | One array. Hide/trim here or at the export (L720). |
| `settings/ai/llm/shared.tsx:685-720` | `PROVIDER_ORDER` + `PROVIDERS = sortProviders(...)` | Unlisted ids sort after listed ones, then alphabetically. `anarlog` pinned first, `custom` last (`shared/sort-providers.ts:14-19`). |
| `shared.tsx:68` anarlog (cloud, Pro) | hidden per blueprint | Only provider with `requires_entitlement: pro` (L76-79). |
| `shared.tsx:82,98,114,130,146` claude, chatgpt, grok, github_copilot, kimi_code | OAuth "Subscription" providers | Out of the F1 provider list. Hide. |
| `shared.tsx:555` **anthropic**, baseUrl L559 `https://api.anthropic.com/v1` | API key | Keep. |
| `shared.tsx:279` **openai**, baseUrl L283 `https://api.openai.com/v1` | API key | Keep. |
| `shared.tsx:656` **google_generative_ai**, baseUrl L660 `.../v1beta` | Gemini API key | Keep. (Blueprint calls it "Gemini"/`google`; the real id is `google_generative_ai`.) |
| `shared.tsx:261` **openrouter**, baseUrl L265 | API key | Keep. |
| `shared.tsx:192` **ollama**, baseUrl L196 `http://127.0.0.1:11434/v1` | no key; `checkAvailability` polls every 5 s (`shared/index.tsx:278-281`) | Keep. Never suggest to judges. |
| `shared.tsx:172` **lmstudio**, baseUrl L176 `http://127.0.0.1:1234/v1` | no key | Keep. |
| `shared.tsx:162` **apple_foundation** | on-device; `list-apple-foundation.ts` | Keep. |
| `shared.tsx:674` **custom** | requires base_url + api_key (L679-681) | Keep as the escape hatch (also fits the F3 "Demo" worker via base URL). |
| `shared.tsx:172-660` the rest (unsloth, venice, moonshot, zai, deepseek, alibaba_cloud, siliconflow, cohere, groq, xai, together, fireworks, cerebras, amazon_bedrock, google_vertex_ai, cloudflare_workers_ai, mistral, meta, azure_openai, azure_ai) | | Hide (trim). Not needed for F1. |

### 1b. Hardcoded model IDs and "what is old" rules

| path:line | what | note |
|---|---|---|
| `settings/ai/shared/list-common.ts:70-103` | `modelPriorityPatterns`: ~30 regexes naming gpt-5.6/5.5/5.4, claude-fable-5.1, claude-opus-5, claude-sonnet-5, gemini-3.x, grok, mistral, kimi, deepseek, glm | Hardcoded "newest" order. A model that ships after this list sorts last, alphabetically. This is the staleness root cause. |
| `list-common.ts:269-285` | `sortModelsByRecency` (uses the list above) | Called by every `list-*.ts`. Replace the order source. |
| `list-common.ts:209-267` | `isOldModel` regex deny-list (claude-opus-4 except 4-8, gpt-5/5.1-5.3, gemini 1/2/3.0, etc.) | Features says replace with release-date rule + deprecation signals. It also hides valid new models whose names match (e.g. a future `claude-opus-4-9`). |
| `list-common.ts:41-68` | `commonIgnoreKeywords` (embed, tts, image, codex, ...) | Keep. Still needed to drop non-chat models. |
| `list-common.ts:167-172` | `isDateSnapshot` (`-YYYYMMDD`, `-YYYY-MM-DD`) | Basis for family collapse. |
| `list-common.ts:174-193` | `isNonChatModel`, `isNonStreamingModel` | Keep. |
| `settings/ai/llm/shared.tsx:512-520` | `GOOGLE_VERTEX_AI_MODELS` static list | Hidden provider. Ignore. |
| `settings/ai/llm/subscriptions/models.ts:25-31` | `FALLBACK_MODELS` for claude/grok/copilot/kimi | Hidden providers. Ignore. Shows the only existing fallback pattern. |
| `settings/ai/shared/model-display.ts:3-8, 10-48` | `MODEL_NAME_OVERRIDES` + regex name formatters (claude-opus/sonnet/haiku/fable, gpt, gemini, mistral, kimi) | Display name derived from the ID. Prefer the registry `displayName`; keep this as the fallback. |
| `settings/ai/shared/model-capabilities.ts:7` | `IMAGE_INPUT_MODEL_RE` family regex | New families outside the regex are treated as text-only. Use registry `modalities` if present. |
| `ai/reasoning-effort.ts:20-71` | per-provider reasoning options, Gemini 3.x test | Keyed on provider, not model list. No change. |
| `crates/llm-proxy/src/model.rs:9` | `MODEL_LATEST_SONNET = "~anthropic/claude-sonnet-latest"` | Anarlog cloud proxy. Hidden. Do not touch. |
| `crates/template-eval/src/eval/runner.rs:13`, `crates/codex/src/exec.rs:336,359`, `crates/opencode/src/exec.rs:140,159` | model IDs in eval or agent tooling | Not the picker. Do not touch. |
| `apps/mobile/src/settings/provider-model-catalog.ts`, `providers-model.ts` | separate mobile catalog | Out of scope. |
| `plugins/local-llm/src/*.rs` | local GGUF models dir, `list_custom_models` | Not used by the picker's cloud/Ollama/LM Studio path. Do not touch. |

No Rust code lists cloud models for the desktop picker. The picker is entirely frontend.

## 2. How the list is fetched, cached and reaches Enhance

### 2a. Fetch

| path:line | what | note |
|---|---|---|
| `settings/ai/llm/shared.tsx:522-646` `getLlmProviderStatus` | switch on provider id builds `listModels()`; line 642-645 wraps every result in `removeNonStreamingModels(...)` | Single choke point for all providers. Best place to enrich. |
| `settings/ai/shared/list-openai.ts:26-73` | `GET {base}/models`, Bearer key. Schema keeps only `id` (L18-24) | OpenAI `created` is dropped. `shutdown_date` is not in the schema either. |
| `list-anthropic.ts:17-29, 31-87` | `GET {base}/models` with `x-api-key`. Schema has `display_name` and `created_at` | **Both fetched, then discarded** (only `id` goes out, L70). Free release date. |
| `list-google.ts:19-26, 32-86` | `GET {base}/models` with `x-goog-api-key`. Schema: `name`, `supportedGenerationMethods` | No release date from Google. Needs the catalog. |
| `list-openrouter.ts:18-31, 37-117` | `GET {base}/models`. Schema: `id`, `supported_parameters`, `architecture` | Add `created`, `expiration_date`, `context_length`, `pricing`, `name` to the schema. |
| `list-ollama.ts` | `ollama.list()` via `ollama/browser` over tauriFetch | Local. No catalog. Leave alone. |
| `list-lmstudio.ts:12-61` | LM Studio native `/api/v1/models`, falls back to `listGenericModels` | Local. Leave alone. |
| custom: `shared.tsx:629-631` | `listGenericModels` = `GET {base}/models` | Leave alone. |
| `ai/provider-fetch.ts:3-21` | `providerFetch` = `@tauri-apps/plugin-http` fetch | No CORS. Reuse for models.dev. |
| `src-tauri/capabilities/default.json:97-110` | `http:default` allows `https://**` | models.dev needs no capability change. No CSP is set in `tauri.conf.json`. |
| `list-common.ts:105-121` `fetchJson`, L37 `REQUEST_TIMEOUT = 5 s`, L38 8 MB cap | | Reuse for catalog fetch. |

Every `list-*` swallows failure to `DEFAULT_RESULT` (empty list), e.g. `list-openai.ts:70`. Picker then shows "No models available" (`model-combobox.tsx:218`). There is no bundled fallback for the 7 target providers today.

### 2b. Cache and refresh

| path:line | what | note |
|---|---|---|
| `ai/hooks/useModelMetadata.ts:17-29` | react-query key `["models", providerId, listModels]`, `staleTime` 2 s, `retry` 3 | In-memory only. |
| `main.tsx:58-64` | `QueryClient` default `gcTime` 60 s | No persistence, no persister. |
| `settings/ai/shared/model-combobox.tsx:101-106` | fetch happens when the combobox mounts (Settings > Intelligence is open) | **No fetch at app launch.** First fetch is when the user opens settings. |
| `model-combobox.tsx:345-354` | icon-only refresh button, calls `refetch()` | Needs a text label and "Updated 2 h ago". |
| `settings/ai/llm/select.tsx:182-213` | `getCachedModels` / `fetchModels` use the same query key | Used on provider switch; `getPreferredProviderModel` picks `models[0]` (`llm/selection.ts:14-32`). So list order decides the default model. |

### 2c. Picker UI

| path:line | what | note |
|---|---|---|
| `settings/ai/llm/select.tsx:82-499` `SelectProviderAndModel` | provider `Select` L389-436, model `ModelCombobox` L442-454 | Only caller of the combobox (`select.tsx:65`). |
| `model-combobox.tsx:36, 227-250` | renders `options: string[]`, one `CommandItem` per id | Add badge, family grouping, "More models" here. |
| `model-combobox.tsx:252-296, 337-343` | "ignored" models behind an eye toggle, `DeprecatedBadge` L363-376 | Reuse this toggle for "Show previews". Reuse `DeprecatedBadge` pattern for **New** and **Thinking**. |
| `list-common.ts:18-30` | `ListModelsResult = { models: string[]; ignored: IgnoredModel[]; metadata: Record<string, ModelMetadata> }`, `ModelMetadata = { input_modalities? }` | Extend `ModelMetadata` with optional fields. Do not change `models: string[]`. |

### 2d. Selected model to Enhance

1. Pick: `select.tsx:155-172` `persistSelection` -> `setSettingValues({ current_llm_provider, current_llm_model, current_llm_reasoning_effort: "default" })`. Keys: `settings/schema.ts:293-300` (`ai.current_llm_provider`, `ai.current_llm_model`).
2. Read: `ai/hooks/useLLMConnection.ts:103-142` `useLLMConnection` -> `resolveLLMConnection` L149-258 builds `conn = { providerId, modelId, baseUrl, apiKey }`. Key comes from `useAiProvider("llm", provider)` L119.
3. Build: `useLanguageModel(task)` L76-101 -> `createLanguageModel` L272 -> `createProviderModel` L293-: `provider(conn.modelId)`. **The model ID string is passed through verbatim.** No allowlist, so a new ID works without code changes.
4. Enhance host: `main/lifecycle.tsx:119-145` `EnhancerInit` (`useLanguageModel("enhance")` L124, `getModel` L140).
5. Run: `services/enhancer/index.ts:467` `getModel()`; L537-541 `aiTaskStore.generate(enhanceTaskId, { model, taskType: "enhance", args })`.
6. Workflow: `store/zustand/ai-task/task-configs/enhance-workflow.ts:40-61` `executeWorkflow({ model, ... })` -> `streamText`.
7. Manual regenerate: `session/components/note-input/enhanced-actions.ts:25, 76` same hook, `enhanceTask.start({ model })`.
8. Chat/title use the same selection (`chat/...`, `useLanguageModel("chat"|"title")`).

Saved model that disappears: no handling today. `shared/selection.ts:1-11` and `llm/selection.ts:14-32` only fall back to `models[0]` when choosing a provider. Health check (`llm/health.tsx:20-40`, `generateText "Hi"`) just shows an error. The "switch to newest in family + toast" rule is net-new.

## 3. API keys

| path:line | what | note |
|---|---|---|
| `settings/providers.ts:24` | `PROVIDER_SECRET_SCOPE = "ai-provider-api-keys"` | |
| `providers.ts:443, 460` | `store2Commands.getSecret` / `setSecret(scope, rowId, apiKey)` | Keys live in the **macOS Keychain** via `plugins/store2` (`keyring` crate). |
| `plugins/store2/src/commands.rs:37-58, 187-200, 318-326` | service/account naming, `get_secret`, `read_secret` | Chunked for long secrets (`chunked.rs`). Do not touch. |
| `providers.ts:145` | row written to SQLite `app_settings` with `api_key: ""` | Non-secret fields only (base_url, type). |
| `ai/hooks/useLLMConnection.ts:195-199` | key read at runtime, passed to the AI SDK provider | |
| `env.ts:6-19` | `VITE_*` client env: URLs, `VITE_SUPABASE_ANON_KEY`, `VITE_POSTHOG_API_KEY`, `VITE_SENTRY_DSN` | No LLM key. Leave the Supabase/PostHog/Sentry vars unset in the build. |
| `apps/desktop/` root | no `.env*` file present (`ls -a`) | |

Result: no provider key is bundled in the frontend, config or Tauri resources. I did not run a full-repo secret regex (blocked); F3's gitleaks gate is the proof. The models.dev catalog fetch needs **no** key and must stay keyless.

## 4. Gating (isPaid / isPro)

| path:line | what | note |
|---|---|---|
| `settings/ai/shared/eligibility.ts:5-16, 44-47` | `requires_entitlement: "pro"` blocker when `!isPaid` | Generic mechanism. |
| `llm/shared.tsx:76-79` | only `anarlog` carries it | **No per-model or per-provider gate on the 7 target providers.** |
| `llm/select.tsx:275-278, 403-407, 426-430` | `handleProviderChange`: anarlog + `!isPaid` -> `upgradeToPro()`; locked row text "Upgrade to Pro" | Disappears once `anarlog` is removed from `_PROVIDERS`. |
| `ai/hooks/useLLMConnection.ts:214-225` | not_pro / unauthenticated errors for anarlog | Dead path once hidden. |
| `shared/config/configure-paid-settings.ts:9-25, 34-60` | if the user is paid, force `anarlog` / `Auto` | Only runs for paid users. Check it is unreachable after the billing hide. Do not edit in F1. |
| `settings/ai/shared/index.tsx:366` | `locked` accordion for Pro providers | Same: anarlog only. |
| `src/auth/billing-context.ts`, `billing.tsx` | `useBillingAccess()` | Owned by the rebrand/hide lane. |

Fork rule: remove `anarlog` from `_PROVIDERS` (it needs sign-in + Pro). Everything else is key-gated only.

## 5. Smallest-diff plan

Principle: keep `ListModelsResult.models: string[]` and the `list-*.ts` flow. Add a registry layer that enriches and orders the existing result at the one choke point. No new dependency. Reuse `providerFetch`, `fetchJson`, `Effect` and Vitest (`pnpm test`, `vitest run`).

### 5a. Files to ADD

| path | what |
|---|---|
| `settings/ai/shared/model-registry.ts` | Types from blueprint section 6 (`ModelEntry`, `ModelRegistry`). `loadRegistry()`: read cache; if absent, parse bundled fallback; if cache is older than 24 h, fetch `https://models.dev/api.json` (primary), else OpenRouter `/api/v1/models?sort=newest` (backup; confirm the param against the live API before relying on it), via `fetchJson` + `providerFetch`. Normalize to entries keyed `provider/id`. Persist `{ fetchedAt, catalogSource, entries }`. Exports `refreshRegistry()`, `enrichResult(providerId, result)`, `familyOf(id)`, `isNew(entry, now)`. Never throws. |
| `settings/ai/shared/models.fallback.json` | Bundled snapshot: `fallbackVersion` date + entries for the 7 providers (id, displayName, family, releasedAt, contextWindow, price, thinking, preview). Imported as a module (`resolveJsonModule` is on, same pattern as `shared/static-assets.ts:3`). Built into the JS bundle, so no Tauri resource change. Must contain Claude Sonnet 5.5 (Sep 28) and GPT-6.1 Sol (Sep 29) for the offline demo. No keys. |
| `settings/ai/shared/model-registry.test.ts` | merge, sort, family collapse, fallback, deprecation, 30-day New. Pattern: `list-common.test.ts`. |
| `settings/ai/shared/use-model-registry.ts` (or inside `ai/hooks/useModelMetadata.ts`) | react-query hook: `queryKey ["model-registry"]`, `staleTime` 24 h, exposes `fetchedAt`, `source`, `refetch`. |

Cache storage choice: `localStorage` key `model-registry-v1` (precedent `main.tsx:147`; wrap in try/catch). It is non-secret and keeps Rust untouched. Do not use Keychain, `app_settings` or SQLite for it.

### 5b. Files to EDIT (surgical)

| path | edit | why |
|---|---|---|
| `settings/ai/shared/list-common.ts` | (1) `ModelMetadata` L22-24: add optional `releasedAt`, `family`, `displayName`, `isNew`, `thinking`, `preview`, `deprecated`, `contextWindow`, `priceTier`. (2) `isOldModel` L209: first ask the registry (`deprecated` or older than the family head), keep the regex as fallback only when the id is unknown to the registry. (3) `sortModelsByRecency` L269: sort by `releasedAt` desc when known; patterns L70-103 only as tiebreak or fallback. | Replaces hardcoded freshness. Keeps 8 callers unchanged. |
| `settings/ai/llm/shared.tsx` | L642-645: `listModels: async () => enrichResult(provider.id, removeNonStreamingModels(await listModelsFunc()))`. If the live call returns empty, return the registry's entries for that provider (labelled Offline list). L66-720: delete or comment out the providers outside the 7 plus `custom`. | One choke point. Gives the fallback and provider trim. |
| `settings/ai/shared/list-anthropic.ts` | L70: pass `created_at` and `display_name` into `metadata` (already fetched L20-23). | Free release date. |
| `settings/ai/shared/list-openai.ts` | Schema L18-24: add optional `created`, `shutdown_date`; emit in metadata (`listOpenAIModels` only). | Real release date and deprecation signal. |
| `settings/ai/shared/list-openrouter.ts` | Schema L18-31: add optional `created`, `expiration_date`, `context_length`, `name`, `pricing`; emit in metadata (`processOpenRouterModels` L55-69). | Date, deprecation, context, price. |
| `settings/ai/shared/model-combobox.tsx` | Rows L227-250: show registry `displayName`, **New** and **Thinking** badges, price tier and context in a detail line. Collapse to one row per family with "More models". Previews behind a "Show previews" toggle (reuse the eye toggle L325-343). Footer: "Updated 2 h ago" or "Offline list", and a labelled Refresh (L345-354). Reuse `DeprecatedBadge` styling (L363-376). | The visible feature. Wiring only; styling is the Design lane's job. |
| `settings/ai/shared/model-display.ts` | L10: return the registry `displayName` first, regex formatter as fallback. | Names for brand-new models. |
| `main/lifecycle.tsx` (or `main.tsx` near L100-110) | Mount a tiny `ModelRegistryInit` next to `EnhancerInit` (L119) that calls `refreshRegistry()` once at launch when the cache is >24 h old. | "Refresh at launch". Today nothing fetches until Settings opens. Prefer `lifecycle.tsx`: it runs only in the main window. |
| `settings/ai/llm/select.tsx` | After the list loads: if `current_llm_model` is not in the provider's list but its family has a newer member, `persistSelection(...)` with that model and `toast`. Reuse `setSettingValues` (L162) and the existing `toast` import pattern. | "Saved model vanished" rule. |
| `settings/ai/shared/model-capabilities.ts` | Optional: consult registry modalities before `IMAGE_INPUT_MODEL_RE` (L7). | Only if time allows. |

### 5c. Files NOT to touch

- Audio, transcription, `crates/cloudsync`, LICENSE files, `@anlg/*` and `anlg-*` names (project rules).
- `plugins/store2/**` (Keychain), `settings/providers.ts` (key storage), `packages/provider-validation`, `packages/store/src/zod.ts`.
- `ai/hooks/useLLMConnection.ts` (works with any ID; no change needed), `store/zustand/ai-task/**`, `services/enhancer/**`, `ai/reasoning-effort.ts`.
- `crates/llm-proxy/**`, `plugins/local-llm/**`, `crates/template-eval`, `crates/codex`, `crates/opencode`.
- `settings/ai/stt/**` (STT lists), `settings/ai/llm/subscriptions/**` (OAuth providers, hidden), `list-ollama.ts`, `list-lmstudio.ts`, `list-apple-foundation.ts`.
- `src-tauri/capabilities/default.json`, `tauri.conf*.json` (HTTP to models.dev already allowed; fallback ships inside the JS bundle).
- `apps/mobile/**`.
- Styling: `styles/`, `packages/ui` (Design lane).

### 5d. Order of work and verification

1. Add `models.fallback.json` and `model-registry.ts` with tests (`pnpm --filter desktop test list-common model-registry` or the repo's `vitest run` path). Must pass offline.
2. Enrich metadata in `list-anthropic`, `list-openai`, `list-openrouter` (additive).
3. Hook the choke point in `llm/shared.tsx:642-645`; trim providers.
4. Combobox UI wiring; launch refresh in `lifecycle.tsx`; vanished-model toast.
5. Done check: with a live key, Sonnet 5.5 and GPT-6.1 Sol show **New**; with the network off, the "Offline list" appears; `gitleaks` clean; `scripts/rebrand-check.sh` = 0 (the new strings must not mention Anarlog).

### 5e. Risks

- `ListModelsResult.models` is a flat `string[]` used by `select.tsx:182-213` and `llm/selection.ts`. Keep ordering (newest first, one per family) in that array, so default selection (`models[0]`) is the newest model.
- Family collapse must only hide, never drop: freeform entry (`model-combobox.tsx:298-320`) and the saved model stay selectable.
- models.dev schema, field names and OpenRouter `sort=newest` are not verified here; check the live JSON before coding the normalizer. Keep the parser tolerant (optional fields) so a schema change falls back to the bundle.
- Date from the provider (`created_at`/`created`) beats the catalog; the catalog is for price, context, thinking, status.
- The "preview" rule: Google `-preview` ids (`list-common.ts:89` shows `gemini-3.1-pro-preview` is currently prioritized) will move behind the toggle. Confirm that is intended for the demo.
