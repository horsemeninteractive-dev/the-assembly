import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useTranslation, LOCALES } from '../../contexts/I18nContext';
import { cn } from '../../utils/utils';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'ghost' | 'solid' | 'outline';
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  className,
  variant = 'ghost'
}) => {
  const { locale, setLocale, availableLocales } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const currentLocaleDef = LOCALES[locale] || LOCALES['en'];
  // We can pull the localized language name if we want, or just display the key / standard name
  // Assuming short code like EN, ES, FR for now.
  const displayLabel = locale.toUpperCase();

  const handleSelect = (code: string) => {
    setLocale(code);
    setIsOpen(false);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'solid':
        return 'bg-surface-glass border-subtle text-primary hover:bg-surface-glass-hover shadow-lg';
      case 'outline':
        return 'border border-subtle text-primary hover:bg-white/5';
      case 'ghost':
      default:
        return 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10';
    }
  };

  return (
    <div className={cn("relative z-50", className)} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 text-sm font-mono",
          getVariantStyles(),
          isOpen && variant === 'ghost' && 'bg-white/5 text-white border-white/10'
        )}
      >
        <Globe className="w-4 h-4 opacity-70" />
        <span>{displayLabel}</span>
        <ChevronDown className={cn("w-3 h-3 opacity-50 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full mt-2 right-0 min-w-[140px] bg-[#07070a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="p-1 space-y-0.5">
              {availableLocales.map((code) => {
                const isSelected = code === locale;
                return (
                  <button
                    key={code}
                    onClick={() => handleSelect(code)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-mono transition-colors",
                      isSelected 
                        ? "bg-blue-500/10 text-blue-400" 
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <span>{code.toUpperCase()}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
