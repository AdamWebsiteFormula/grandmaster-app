import { BUNDLED_TEMPLATES } from "~/templates/bundled-templates";

const BUNDLED_RESOURCES: Record<string, unknown[]> = {
  templates: BUNDLED_TEMPLATES,
};

const EMPTY: unknown[] = [];

// Resources ship with the app. No network call: Upshot is local-first.
export function useWebResources<T>(endpoint: string) {
  return {
    data: (BUNDLED_RESOURCES[endpoint] ?? EMPTY) as T[],
    isLoading: false,
  };
}
