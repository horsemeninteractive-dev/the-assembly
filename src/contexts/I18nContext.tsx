import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import en from '../locales/en.json';

type Translations = typeof en;
type TranslationKey = string; // Simplified for deep access

interface I18nContextType {
  t: (key: TranslationKey, params?: Record<string, any>) => string;
  locale: string;
  setLocale: (locale: string) => void;
  availableLocales: string[];
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const LOCALES: Record<string, any> = {
  en,
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocale] = useState(() => {
    return localStorage.getItem('assembly_locale') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('assembly_locale', locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback((key: TranslationKey, params?: Record<string, any>): string => {
    const keys = key.split('.');
    let value = LOCALES[locale] || en;
    
    for (const k of keys) {
      value = value?.[k];
    }

    if (typeof value !== 'string') {
      console.warn(`Translation key not found: ${key} for locale: ${locale}`);
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

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};
