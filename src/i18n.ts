import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./i18n/en";
import { pl } from "./i18n/pl";
import { uk } from "./i18n/uk";

/**
 * Three catalogues, one shape. English is the source and the fallback: a key
 * missing from Ukrainian or Polish falls through to English rather than
 * showing the key. The language is a *setting*, not a guess — the browser's
 * locale is deliberately not consulted, so the game opens in English for
 * everyone and switches when asked (Settings → LANGUAGE).
 */
export const LANGUAGES = ["en", "uk", "pl"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABEL: Record<Language, string> = {
  en: "ENGLISH",
  uk: "УКРАЇНСЬКА",
  pl: "POLSKI",
};

export const resources = {
  en: { translation: en },
  uk: { translation: uk },
  pl: { translation: pl },
} as const;

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  supportedLngs: [...LANGUAGES],
  interpolation: { escapeValue: false },
});

export function setLanguage(lng: Language): void {
  if (i18n.language !== lng) void i18n.changeLanguage(lng);
}

export default i18n;
