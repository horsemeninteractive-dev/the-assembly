import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import pt from '../locales/pt.json';
import ru from '../locales/ru.json';
import zh from '../locales/zh-CN.json';
import ko from '../locales/ko.json';

type Translations = typeof en;
type TranslationKey = string; // Simplified for deep access

interface I18nContextType {
  t: (key: TranslationKey, params?: Record<string, any>) => any;
  locale: string;
  setLocale: (locale: string) => void;
  availableLocales: string[];
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const LOCALES: Record<string, any> = {
  en, es, fr, de, pt, ru, zh, ko
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocale] = useState(() => {
    return localStorage.getItem('assembly_locale') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('assembly_locale', locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback((key: TranslationKey, params?: Record<string, any>): any => {
    const keys = key.split('.');
    
    // 1. Try current locale
    let value = LOCALES[locale];
    for (const k of keys) {
      if (value === undefined || value === null) break;
      value = value[k];
    }

    // 2. Fallback to English if not found or if the locale is not English
    if ((value === undefined || value === null) && locale !== 'en') {
      value = en;
      for (const k of keys) {
        if (value === undefined || value === null) break;
        value = value[k];
      }
    }

    if (value === undefined || value === null) {
      console.warn(`Translation key not found: ${key} for locale: ${locale}`);
      return key;
    }

    if (typeof value !== 'string') {
      if (params?.returnObjects) return value;
      return key;
    }

    let result = value;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        result = result.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
      });
    }

    return result;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ t, locale, setLocale, availableLocales: Object.keys(LOCALES) }}>
      {children}
    </I18nContext.Provider>
  );
};

export const Trans: React.FC<{
  i18nKey: string;
  values?: Record<string, any>;
  components?: Record<string, React.ReactElement>;
}> = ({ i18nKey, values, components }) => {
  const { t } = useTranslation();
  const rawString = t(i18nKey, values);
  
  if (!components) return <>{rawString}</>;

  // Simple parser: matches <1>...</1> or <3>...</3>
  const parts = rawString.split(/(<\d+>.*?<\/\d+>)/g);

  return (
    <>
      {parts.map((part: string, i: number) => {
        const match = part.match(/<(\d+)>(.*?)<\/\1>/);
        if (match) {
          const index = match[1];
          const content = match[2];
          const Comp = components[index];
          if (Comp) {
            return React.cloneElement(Comp, { key: i }, content);
          }
          return <React.Fragment key={i}>{content}</React.Fragment>;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};
