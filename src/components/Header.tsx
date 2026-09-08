import React, { useState } from 'react';
import {
  Menu, X, LogOut, MessageSquare, ShieldCheck, Search, Shield
} from 'lucide-react';
import { User } from '../types.js';
import { openGeneralWhatsApp } from '../lib/whatsapp.js';
import { auth, signOut } from '../lib/firebaseClient.js';
import { useLanguage } from '../context/LanguageContext.js';
import LanguageSwitcher from './LanguageSwitcher.js';

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
    { id: 'track', label: t('nav.track', 'Track Application'), action: () => setView('track') },
    { id: 'blogs', label: t('nav.blogs', 'Knowledge Hub'), action: () => setView('blogs') },
    { id: 'about', label: t('nav.about', 'About Us'), action: () => setView('about') },
    { id: 'contact', label: t('nav.contact', 'Contact'), action: () => setView('contact') },
    { id: 'payment', label: t('nav.payment', 'Payment'), action: () => setView('payment') },
    { id: 'privacy-security', label: t('nav.privacy', 'Privacy & Security'), action: () => setView('privacy-security') },
  ];

  return (
    <header id="easydesk-header" className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 font-sans text-slate-900 w-full max-w-full">
      <div className="portal-container w-full max-w-full">
        <div className="flex justify-between items-center h-16 w-full min-w-0 gap-3">

          {/* Brand Logo */}
          <div
            className="flex items-center gap-2.5 cursor-pointer shrink-0 focus-civic rounded-xl p-1"
            onClick={() => setView('home')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setView('home')}
            aria-label="EasyDesk Home"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-[#0F4C81] to-[#0A2540] rounded-xl flex items-center justify-center shadow-xs text-white">
              <Shield className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-[#0F4C81] leading-none block">
                EasyDesk
              </span>
              <span className="block text-[9px] text-slate-500 font-extrabold tracking-wider uppercase mt-0.5">
                {t('nav.portalSubtitle', 'Digital Service Portal')}
              </span>
            </div>
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
                      ? 'bg-blue-50 text-[#0F4C81] border border-blue-200/60 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
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
                    ? 'bg-blue-100 text-[#0F4C81]'
                    : 'text-[#0F4C81] hover:bg-blue-50'
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
          <div className="flex items-center gap-2 shrink-0">
            {/* Spotlight Search Trigger */}
            <button
              type="button"
              onClick={handleTriggerSearch}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs transition cursor-pointer focus-civic"
              title="Search services and guides (Ctrl + K)"
              aria-label="Search services and guides"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden lg:inline text-[11px] font-medium text-slate-600">Search</span>
              <kbd className="hidden lg:inline text-[10px] font-mono px-1 py-0.5 rounded bg-white border border-slate-200 text-slate-400">⌘K</kbd>
            </button>

            {/* Language Switcher Dropdown */}
            <LanguageSwitcher />

            {/* WhatsApp Quick Desk CTA */}
            <button
              onClick={() => openGeneralWhatsApp('Hello EasyDesk, I would like to inquire about digital document services.')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs active:scale-95 btn-glow-emerald"
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

            {/* Mobile Hamburger Toggle (for extra links: about, contact, payment, privacy) */}
            <button
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
        <div className="xl:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-6 space-y-1 animate-in slide-in-from-top duration-150">
          <div className="pb-2 border-b border-slate-100 mb-2">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
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
                className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  isActive ? 'bg-blue-50 text-[#0F4C81] border border-blue-200/60' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {link.label}
              </button>
            );
          })}

          <div className="pt-3 border-t border-slate-100 mt-2 space-y-2">
            <button
              onClick={() => {
                openGeneralWhatsApp('Hello EasyDesk, I need help with an application.');
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 bg-[#10B981] text-white py-2.5 rounded-xl text-xs font-bold shadow-xs"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Connect on WhatsApp Desk</span>
            </button>

            {['ADMIN', 'SUPER_ADMIN', 'STAFF', 'OPERATOR'].includes(currentUser?.role as string) ? (
              <button
                onClick={() => { setView('admin'); setMobileMenuOpen(false); }}
                className="w-full text-left px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50 text-[#0F4C81]"
              >
                Admin Control Dashboard
              </button>
            ) : (
              <button
                onClick={() => { setView('admin-login'); setMobileMenuOpen(false); }}
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-500"
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
