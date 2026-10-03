import { I18nProvider } from "@lingui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type ReactNode } from "react";

import { useMountEffect } from "@anlg/ui/hooks/use-mount-effect";

import { createI18n } from "./catalogs";
import { SOURCE_LOCALE } from "./locales";

export function AppI18nProvider({ children }: { children: ReactNode }) {
  // Fork (blueprint: English only): the interface is always English. The
  // "Main language" setting still sets the language of AI summaries, but it
  // no longer switches the UI to a partly translated catalog.
  const locale = SOURCE_LOCALE;
  const { data: i18n } = useQuery({
    queryKey: ["i18n-catalog", locale],
    queryFn: () => createI18n(locale),
    placeholderData: keepPreviousData,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });

  if (!i18n) return null;

  return (
    <I18nProvider i18n={i18n}>
      <DocumentLanguage key={i18n.locale} locale={i18n.locale} />
      {children}
    </I18nProvider>
  );
}

function DocumentLanguage({ locale }: { locale: string }) {
  useMountEffect(() => {
    document.documentElement.lang = locale;
  });

  return null;
}
