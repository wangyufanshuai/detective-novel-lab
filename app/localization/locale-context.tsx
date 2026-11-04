"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  DEFAULT_APP_LOCALE,
  LOCALE_FORMAT_VERSION,
  LOCALE_STORAGE_KEY,
  formatLocaleMessage,
  isAppLocale,
  localizePublicText,
  localizeSafeTree,
  type AppLocale,
  type LocaleMessageKey,
  type LocaleVariables
} from "./locale-catalog";
import { resolveBrowserLocale, type LocalePreference } from "./locale-preference";
import { localizeCampaignContent } from "./campaign-content-locale";

export { normalizeLocalePreference, resolveBrowserLocale } from "./locale-preference";

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: LocaleMessageKey, variables?: LocaleVariables) => string;
  text: (value: string) => string;
  number: (value: number) => string;
};

const defaultValue: LocaleContextValue = {
  locale: DEFAULT_APP_LOCALE,
  setLocale: () => undefined,
  t: (key, variables) => formatLocaleMessage(DEFAULT_APP_LOCALE, key, variables),
  text: (value) => value,
  number: (value) => new Intl.NumberFormat(DEFAULT_APP_LOCALE).format(value)
};

const LocaleContext = createContext<LocaleContextValue>(defaultValue);

function readInitialLocale() {
  const query = new URLSearchParams(window.location.search).get("lang");
  let stored: unknown;
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    stored = raw ? JSON.parse(raw) : undefined;
  } catch {
    stored = undefined;
  }
  return resolveBrowserLocale({ query, stored, languages: navigator.languages });
}

export function AppLocaleProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [locale, updateLocale] = useState<AppLocale>(DEFAULT_APP_LOCALE);

  useEffect(() => {
    updateLocale(readInitialLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  const setLocale = useCallback((next: AppLocale) => {
    updateLocale(next);
    const preference: LocalePreference = { formatVersion: LOCALE_FORMAT_VERSION, locale: next };
    try { window.localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(preference)); } catch {}
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const t = useCallback((key: LocaleMessageKey, variables?: LocaleVariables) => formatLocaleMessage(locale, key, variables), [locale]);
  const text = useCallback((value: string) => {
    const publicText = localizePublicText(value, locale);
    return localizeCampaignContent(publicText, locale) || publicText;
  }, [locale]);
  const number = useCallback((value: number) => new Intl.NumberFormat(locale).format(value), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t, text, number }), [locale, number, setLocale, t, text]);

  return (
    <LocaleContext.Provider value={value}>
      <a className="skipToMain" href="#detective-town-main">{t("locale.skip")}</a>
      {pathname !== "/" && pathname !== "/town-play" && pathname !== "/town-play/agent-first" && <button
        type="button"
        className="localeSwitcher"
        aria-label={locale === "en-US" ? t("locale.switch.zh") : t("locale.switch.en")}
        title={locale === "en-US" ? t("locale.switch.zh") : t("locale.switch.en")}
        onClick={() => setLocale(locale === "en-US" ? "zh-CN" : "en-US")}
      >
        <span aria-hidden="true">{locale === "en-US" ? t("locale.current.zh") : t("locale.current.en")}</span>
      </button>}
      <div id="detective-town-main" tabIndex={-1}>{children}</div>
    </LocaleContext.Provider>
  );
}

export function useAppLocale() {
  return useContext(LocaleContext);
}

/** Only pass plain public presentation records; runtime authority, callbacks, Sets, Maps and refs stay outside this boundary. */
export function useLocalizedSafeTree<T>(value: T) {
  const { locale } = useAppLocale();
  return useMemo(() => localizeSafeTree(value, locale), [locale, value]);
}
