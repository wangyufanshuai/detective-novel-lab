import {
  DEFAULT_APP_LOCALE,
  LOCALE_FORMAT_VERSION,
  isAppLocale,
  type AppLocale
} from "./locale-catalog";

export type LocalePreference = { formatVersion: typeof LOCALE_FORMAT_VERSION; locale: AppLocale };

export function normalizeLocalePreference(value: unknown): LocalePreference | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.formatVersion !== LOCALE_FORMAT_VERSION || !isAppLocale(record.locale)) return null;
  return { formatVersion: LOCALE_FORMAT_VERSION, locale: record.locale };
}

export function resolveBrowserLocale(input: { query?: string | null; stored?: unknown; languages?: readonly string[] }) {
  if (isAppLocale(input.query)) return input.query;
  const stored = normalizeLocalePreference(input.stored);
  if (stored) return stored.locale;
  return input.languages?.some((item) => item.toLowerCase().startsWith("zh")) ? "zh-CN" : DEFAULT_APP_LOCALE;
}
