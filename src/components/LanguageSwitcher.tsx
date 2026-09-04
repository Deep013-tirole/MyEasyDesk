import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useLanguage, SUPPORTED_LANGUAGES } from '../context/LanguageContext.js';

interface LanguageSwitcherProps {
  variant?: 'compact' | 'dropdown' | 'mobile';
  className?: string;
}

export default function LanguageSwitcher({ variant = 'dropdown', className = '' }: LanguageSwitcherProps) {
  const { language, setLanguage, currentLanguageOption, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Mobile Grid View Variant
  if (variant === 'mobile') {
    return (
      <div className={`p-3 bg-slate-50/90 border border-slate-200/80 rounded-2xl space-y-2.5 notranslate ${className}`} translate="no">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Globe className="w-4 h-4 text-[#0F4C81]" />
            <span>{t('nav.selectLanguage', 'Select Language')}</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100/90 text-[#0F4C81] px-2 py-0.5 rounded-md">
            {currentLanguageOption.name}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 pt-1">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = lang.code === language;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code)}
                className={`px-3 py-2 rounded-xl text-left transition cursor-pointer flex items-center justify-between border ${
                  isSelected
                    ? 'bg-[#0F4C81] text-white border-[#0F4C81] font-bold shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-blue-50/60 border-slate-200/80'
                }`}
              >
                <div className="truncate">
                  <div className="text-xs leading-tight font-extrabold truncate">{lang.nativeName}</div>
                  <div className={`text-[10px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                    {lang.name}
                  </div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Desktop Dropdown
  return (
    <div className={`relative inline-block text-left notranslate ${className}`} translate="no" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
          isOpen
            ? 'bg-blue-50 text-[#0F4C81] border-blue-200 shadow-xs'
            : 'bg-slate-50/80 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border-slate-200/70'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Change Language"
      >
        <Globe className="w-3.5 h-3.5 text-[#0F4C81]" />
        <span className="font-extrabold text-xs">{currentLanguageOption.nativeName}</span>
        <span className="text-[10px] text-slate-400 font-semibold uppercase hidden lg:inline">
          ({currentLanguageOption.shortLabel})
        </span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#0F4C81]' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              {t('nav.selectLanguage', 'Select Language')}
            </span>
            <span className="text-[10px] font-bold text-[#0F4C81] bg-blue-50 px-1.5 py-0.5 rounded">
              4 Languages
            </span>
          </div>

          <div className="space-y-0.5">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = lang.code === language;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full px-2.5 py-2 rounded-xl text-left text-xs transition cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-50 text-[#0F4C81] font-extrabold'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-center text-[10px] font-black uppercase text-slate-400 bg-slate-100 rounded py-0.5">
                      {lang.shortLabel}
                    </span>
                    <div>
                      <span className="block text-xs leading-tight font-bold">{lang.nativeName}</span>
                      <span className="block text-[10px] text-slate-400 font-normal">{lang.name}</span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#0F4C81]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
