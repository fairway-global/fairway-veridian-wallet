import { useCallback, useEffect, useState } from "react";
import { APP_LANGUAGE_STORAGE_KEY, i18n } from "../../../i18n";
import "./LanguageSwitch.scss";

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "am", label: "AM" },
] as const;

const normalizeLanguage = (language?: string) => {
  return language?.split("-")[0].toLowerCase() || "en";
};

const pageReload = {
  reload: () => window.location.reload(),
};

const LanguageSwitch = () => {
  const [activeLanguage, setActiveLanguage] = useState(() =>
    normalizeLanguage(i18n.resolvedLanguage || i18n.language)
  );

  useEffect(() => {
    const handleLanguageChange = (language: string) => {
      const normalizedLanguage = normalizeLanguage(language);
      setActiveLanguage(normalizedLanguage);
      document.documentElement.lang = normalizedLanguage;
    };

    handleLanguageChange(i18n.resolvedLanguage || i18n.language);
    i18n.on("languageChanged", handleLanguageChange);

    return () => {
      i18n.off("languageChanged", handleLanguageChange);
    };
  }, []);

  const handleLanguageSelect = useCallback(
    async (language: string) => {
      if (language === activeLanguage) return;

      window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
      await i18n.changeLanguage(language);
      pageReload.reload();
    },
    [activeLanguage]
  );

  return (
    <div
      className="language-switch"
      data-testid="language-switch"
      role="group"
      aria-label="Language switch"
    >
      {SUPPORTED_LANGUAGES.map((language) => {
        const isActive = activeLanguage === language.code;

        return (
          <button
            key={language.code}
            type="button"
            className={`language-switch__button${
              isActive ? " is-active" : ""
            }`}
            aria-pressed={isActive}
            data-testid={`language-option-${language.code}`}
            onClick={() => handleLanguageSelect(language.code)}
          >
            {language.label}
          </button>
        );
      })}
    </div>
  );
};

export { LanguageSwitch, pageReload };
