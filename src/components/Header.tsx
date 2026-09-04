import React, { useState } from 'react';
import { 
  Menu, X, ShieldAlert, LogOut, MessageSquare, Bot, ShieldCheck, User as UserIcon, Globe, Search
} from 'lucide-react';
import { User, UserRole } from '../types.js';
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
}

export default function Header({ 
  currentView, 
  setView, 
  currentUser, 
  setCurrentUser 
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

  return (
    <header id="easydesk-header" className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] font-sans text-[#111827] w-full max-w-full">
      <div className="portal-container w-full max-w-full">
        <div className="flex justify-between items-center h-16 w-full min-w-0">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
            <div className="w-8 h-8 bg-[#0F4C81] rounded-xl flex items-center justify-center shadow-xs">
              <div className="w-4 h-4 border-2 border-white rounded-xs"></div>
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-[#0F4C81] leading-none block">
                EasyDesk
              </span>
              <span className="block text-[8px] text-[#6B7280] font-bold tracking-widest uppercase mt-0.5">
                {t('nav.portalSubtitle', 'Digital Service Portal')}
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => setView('home')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentView === 'home' 
                  ? 'bg-blue-50 text-[#0F4C81]' 
                  : 'text-[#6B7280] hover:text-[#111827] hover:bg-slate-50'
              }`}
            >
              {t('nav.home', 'Home')}
            </button>
            <button
              onClick={() => setView('services')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentView === 'services' 
                  ? 'bg-blue-50 text-[#0F4C81]' 
                  : 'text-[#6B7280] hover:text-[#111827] hover:bg-slate-50'
              }`}
            >
              {t('nav.services', 'Services')}
            </button>
            <button
              onClick={() => setView('track')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                currentView === 'track' 
                  ? 'bg-blue-50 text-[#0F4C81]' 
                  : 'text-[#6B7280] hover:text-[#111827] hover:bg-slate-50'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-[#0F4C81]" />
              <span>{t('nav.track', 'Track Application')}</span>
            </button>
            <button
              onClick={() => setView('blogs')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentView === 'blogs' 
                  ? 'bg-blue-50 text-[#0F4C81]' 
                  : 'text-[#6B7280] hover:text-[#111827] hover:bg-slate-50'
              }`}
            >
              {t('nav.blogs', 'Blogs')}
            </button>
            <button
              onClick={() => setView('about')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentView === 'about' 
                  ? 'bg-blue-50 text-[#0F4C81]' 
                  : 'text-[#6B7280] hover:text-[#111827] hover:bg-slate-50'
              }`}
            >
              {t('nav.about', 'About Us')}
            </button>
            <button
              onClick={() => setView('contact')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentView === 'contact' 
                  ? 'bg-blue-50 text-[#0F4C81]' 
                  : 'text-[#6B7280] hover:text-[#111827] hover:bg-slate-50'
              }`}
            >
              {t('nav.contact', 'Contact')}
            </button>
            <button
              onClick={() => setView('payment')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentView === 'payment' 
                  ? 'bg-blue-50 text-[#0F4C81]' 
                  : 'text-[#6B7280] hover:text-[#111827] hover:bg-slate-50'
              }`}
            >
              {t('nav.payment', 'Payment')}
            </button>
            <button
              onClick={() => setView('privacy-security')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                currentView === 'privacy-security' 
                  ? 'bg-blue-50 text-[#0F4C81]' 
                  : 'text-[#6B7280] hover:text-[#111827] hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
              <span>{t('nav.privacy', 'Privacy & Security')}</span>
            </button>
            
            {/* Conditional Admin Access */}
            {['ADMIN', 'SUPER_ADMIN', 'STAFF', 'OPERATOR'].includes(currentUser?.role as string) ? (
              <button
                onClick={() => setView('admin')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  currentView === 'admin' 
                    ? 'bg-blue-100 text-[#0F4C81]' 
                    : 'text-[#0F4C81] hover:bg-blue-50'
                }`}
              >
                {t('nav.admin', 'Admin Panel')}
              </button>
            ) : (
              <button
                onClick={() => setView('admin-login')}
                className="px-3 py-2 text-xs font-bold text-[#6B7280] hover:text-[#0F4C81] transition cursor-pointer"
              >
                {t('nav.adminLogin', 'Admin Login')}
              </button>
            )}
          </nav>

          {/* Right Header Action Buttons & Language Switcher */}
          <div className="hidden md:flex items-center gap-2.5">
            {/* Language Switcher Dropdown */}
            <LanguageSwitcher />

            <button
              onClick={() => openGeneralWhatsApp('Hello EasyDesk, I would like to inquire about digital document services.')}
              className="px-4 py-2 bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" /> {t('nav.orderWhatsApp', 'Order on WhatsApp')}
            </button>

            {currentUser && (
              <button
                onClick={handleLogout}
                className="p-2 text-[#6B7280] hover:text-red-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                title={t('nav.signOut', 'Sign Out')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mobile Right Controls: Compact Language Switcher + Menu Button */}
          <div className="flex md:hidden items-center gap-1.5">
            <LanguageSwitcher />

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#6B7280] hover:text-[#111827] rounded-xl hover:bg-slate-100 transition cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-[#E5E7EB] px-4 pt-2 pb-6 space-y-2 animate-in slide-in-from-top duration-200">
          {/* Mobile Language Selection Grid */}
          <LanguageSwitcher variant="mobile" className="mb-3" />

          <button
            onClick={() => { setView('home'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition ${
              currentView === 'home' ? 'bg-blue-50 text-[#0F4C81]' : 'text-[#111827] hover:bg-slate-50'
            }`}
          >
            {t('nav.home', 'Home')}
          </button>
          <button
            onClick={() => { setView('services'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition ${
              currentView === 'services' ? 'bg-blue-50 text-[#0F4C81]' : 'text-[#111827] hover:bg-slate-50'
            }`}
          >
            {t('nav.services', 'Services')}
          </button>
          <button
            onClick={() => { setView('track'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              currentView === 'track' ? 'bg-blue-50 text-[#0F4C81]' : 'text-[#111827] hover:bg-slate-50'
            }`}
          >
            <Search className="w-4 h-4 text-[#0F4C81]" />
            <span>{t('nav.track', 'Track Application')}</span>
          </button>
          <button
            onClick={() => { setView('blogs'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition ${
              currentView === 'blogs' ? 'bg-blue-50 text-[#0F4C81]' : 'text-[#111827] hover:bg-slate-50'
            }`}
          >
            {t('nav.blogs', 'Blogs')}
          </button>
          <button
            onClick={() => { setView('about'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition ${
              currentView === 'about' ? 'bg-blue-50 text-[#0F4C81]' : 'text-[#111827] hover:bg-slate-50'
            }`}
          >
            {t('nav.about', 'About Us')}
          </button>
          <button
            onClick={() => { setView('contact'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition ${
              currentView === 'contact' ? 'bg-blue-50 text-[#0F4C81]' : 'text-[#111827] hover:bg-slate-50'
            }`}
          >
            {t('nav.contact', 'Contact')}
          </button>
          <button
            onClick={() => { setView('payment'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition ${
              currentView === 'payment' ? 'bg-blue-50 text-[#0F4C81]' : 'text-[#111827] hover:bg-slate-50'
            }`}
          >
            {t('nav.payment', 'Payment')}
          </button>
          <button
            onClick={() => { setView('privacy-security'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              currentView === 'privacy-security' ? 'bg-blue-50 text-[#0F4C81]' : 'text-[#111827] hover:bg-slate-50'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#10B981]" /> {t('nav.privacy', 'Privacy & Security')}
          </button>
          {['ADMIN', 'SUPER_ADMIN', 'STAFF', 'OPERATOR'].includes(currentUser?.role as string) ? (
            <button
              onClick={() => { setView('admin'); setMobileMenuOpen(false); }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-[#0F4C81] bg-blue-50 hover:bg-blue-100"
            >
              {t('nav.admin', 'Admin Panel')}
            </button>
          ) : (
            <button
              onClick={() => { setView('admin-login'); setMobileMenuOpen(false); }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-[#6B7280] hover:bg-slate-50"
            >
              {t('nav.adminLogin', 'Admin Login')}
            </button>
          )}

          <div className="pt-2">
            <button
              onClick={() => { openGeneralWhatsApp(); setMobileMenuOpen(false); }}
              className="w-full py-3 bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold rounded-xl text-xs shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" /> {t('nav.orderWhatsApp', 'Order on WhatsApp')}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
