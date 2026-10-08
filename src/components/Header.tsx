import React, { useState, useEffect } from 'react';
import {
  Menu, X, LogOut, MessageSquare, ShieldCheck, Search, Shield
} from 'lucide-react';
import { User } from '../types.js';
import { openGeneralWhatsApp } from '../lib/whatsapp.js';
import { auth, signOut } from '../lib/firebaseClient.js';
import { useLanguage } from '../context/LanguageContext.js';
import LanguageSwitcher from './LanguageSwitcher.js';
import MyEasyDeskBrand from './ui/MyEasyDeskBrand.js';

interface HeaderProps {
  currentView: string;
  setView: (view: string) => void;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  allUsers: User[];
  onOpenSearch?: () => void;
}

export default function Header({
  currentView,
  setView,
  currentUser,
  setCurrentUser,
  onOpenSearch
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useLanguage();
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('easydesk_general_settings');
      if (saved) return JSON.parse(saved).logoUrl || '';
    } catch {}
    return '';
  });
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail?.logoUrl !== undefined) {
        setLogoUrl(e.detail.logoUrl || '');
        setLogoFailed(false);
      }
    };
    window.addEventListener('easydesk_general_settings_updated', handleUpdate);

    fetch('/api/general-settings')
      .then(res => res.json())
      .then(data => {
        if (data?.logoUrl) {
          setLogoUrl(data.logoUrl);
          try {
            const current = JSON.parse(localStorage.getItem('easydesk_general_settings') || '{}');
            localStorage.setItem('easydesk_general_settings', JSON.stringify({ ...current, ...data }));
          } catch {}
        }
      })
      .catch(() => {});

    return () => window.removeEventListener('easydesk_general_settings_updated', handleUpdate);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Signout error:', e);
    }
    localStorage.removeItem('easydesk_token');
    localStorage.removeItem('easydesk_refresh_token');
    localStorage.removeItem('easydesk_user');
    localStorage.removeItem('easydesk_admin_token');
    localStorage.removeItem('easydesk_admin_refresh');
    localStorage.removeItem('easydesk_admin_user');

    setCurrentUser(null);
    setView('home');
  };

  const handleTriggerSearch = () => {
    if (onOpenSearch) {
      onOpenSearch();
    } else {
      window.dispatchEvent(new CustomEvent('easydesk-open-command-palette'));
    }
  };

  const navLinks = [
    { id: 'home', label: t('nav.home', 'Home'), action: () => setView('home') },
    { id: 'services', label: t('nav.services', 'Services'), action: () => setView('services') },
    { id: 'blogs', label: t('nav.blogs', 'Blogs'), action: () => setView('blogs') },
    { id: 'track', label: t('nav.track', 'Track'), action: () => setView('track') },
    { id: 'payment', label: t('nav.payment', 'Payment'), action: () => setView('payment') },
    { id: 'about', label: t('nav.about', 'About'), action: () => setView('about') },
    { id: 'contact', label: t('nav.contact', 'Contact'), action: () => setView('contact') },
    { id: 'privacy-security', label: t('nav.privacy', 'Privacy & Security'), action: () => setView('privacy-security') },
  ];

  return (
    <header id="easydesk-header" className="sticky top-0 z-40 bg-[#F4F8FC]/95 backdrop-blur-md border-b border-[#D8E6F5] font-sans text-[#0B192C] w-full max-w-full shadow-[0_1px_4px_rgba(11,25,44,0.04)]">
      <div className="portal-container w-full max-w-full">
        <div className="flex justify-between items-center h-16 w-full min-w-0 gap-2 sm:gap-3">

          {/* Brand Logo */}
          <div
            className="cursor-pointer shrink-0 focus-civic rounded-xl py-1 px-1.5 notranslate transition-opacity hover:opacity-95"
            translate="no"
            onClick={() => setView('home')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setView('home')}
            aria-label="My EasyDesk Home"
          >
            <MyEasyDeskBrand size="md" showTagline={true} />
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center space-x-1" aria-label="Main Navigation">
            {navLinks.map(link => {
              const isActive = currentView === link.id ||
                (link.id === 'services' && currentView === 'service-details');
              return (
                <button
                  key={link.id}
                  onClick={link.action}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer focus-civic ${
                    isActive
                      ? 'bg-[#0062FF] text-white shadow-xs'
                      : 'text-[#334E68] hover:text-[#0062FF] hover:bg-blue-100/60'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {link.label}
                </button>
              );
            })}

            {/* Admin Panel Link if logged in or direct login */}
            {['ADMIN', 'SUPER_ADMIN', 'STAFF', 'OPERATOR'].includes(currentUser?.role as string) ? (
              <button
                onClick={() => setView('admin')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer focus-civic ${
                  currentView === 'admin'
                    ? 'bg-[#0062FF] text-white shadow-xs'
                    : 'text-[#0062FF] hover:bg-blue-100/60'
                }`}
              >
                {t('nav.admin', 'Admin')}
              </button>
            ) : (
              <button
                onClick={() => setView('admin-login')}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-700 transition cursor-pointer focus-civic rounded-lg"
              >
                {t('nav.adminLogin', 'Officer Desk')}
              </button>
            )}
          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Spotlight Search Trigger */}
            <button
              type="button"
              id="btn-header-search"
              onClick={handleTriggerSearch}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-xl border border-[#D8E6F5] bg-white hover:bg-blue-50/70 text-slate-600 text-xs transition cursor-pointer focus-civic shadow-2xs"
              title="Search services and guides (Ctrl + K)"
              aria-label="Search"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden lg:inline text-[11px] font-semibold text-[#334E68]">Search</span>
              <kbd className="hidden lg:inline text-[10px] font-mono px-1 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-400">⌘K</kbd>
            </button>

            {/* Language Switcher Dropdown */}
            <LanguageSwitcher />

            {/* WhatsApp Quick Desk CTA - visible on desktop xl+ */}
            <button
              onClick={() => openGeneralWhatsApp('Hello My EasyDesk, I would like to inquire about digital document services.')}
              className="hidden xl:inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs active:scale-95 btn-glow-emerald"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{t('nav.orderWhatsApp', 'WhatsApp Desk')}</span>
            </button>

            {/* Sign Out for Admin User */}
            {currentUser && (
              <button
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-red-600 rounded-xl hover:bg-slate-100 transition cursor-pointer focus-civic"
                title={t('nav.signOut', 'Sign Out')}
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              id="btn-mobile-hamburger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 text-slate-700 hover:text-slate-950 rounded-xl hover:bg-slate-100 transition cursor-pointer focus-civic"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Navigation (Extended Menu) */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-[#F4F8FC] border-b border-[#D8E6F5] px-4 pt-3 pb-6 space-y-1 animate-in slide-in-from-top duration-150 shadow-lg">
          <div className="pb-2 border-b border-[#D8E6F5] mb-2">
            <span className="text-[10px] font-extrabold uppercase text-[#627D98] tracking-wider">
              Navigation
            </span>
          </div>

          {navLinks.map(link => {
            const isActive = currentView === link.id;
            return (
              <button
                key={link.id}
                onClick={() => {
                  link.action();
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  isActive ? 'bg-[#0062FF] text-white shadow-xs' : 'text-[#334E68] hover:bg-blue-100/60'
                }`}
              >
                {link.label}
              </button>
            );
          })}

          <div className="pt-3 border-t border-[#D8E6F5] mt-2 space-y-2">
            <button
              onClick={() => {
                openGeneralWhatsApp('Hello My EasyDesk, I need help with an application.');
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#0e9f6e] text-white py-2.5 rounded-xl text-xs font-bold shadow-xs transition active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Connect on WhatsApp Desk</span>
            </button>

            {['ADMIN', 'SUPER_ADMIN', 'STAFF', 'OPERATOR'].includes(currentUser?.role as string) ? (
              <button
                onClick={() => { setView('admin'); setMobileMenuOpen(false); }}
                className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold bg-blue-100/80 text-[#0062FF]"
              >
                Admin Control Dashboard
              </button>
            ) : (
              <button
                onClick={() => { setView('admin-login'); setMobileMenuOpen(false); }}
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Officer / Admin Access
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
