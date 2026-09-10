import React from 'react';
import { Home, Layers, BookOpen, Search, MessageSquare } from 'lucide-react';
import { openGeneralWhatsApp } from '../lib/whatsapp.js';
import { useLanguage } from '../context/LanguageContext.js';

interface MobileBottomNavProps {
  currentView: string;
  setView: (view: string) => void;
  onOpenCommandPalette?: () => void;
}

export default function MobileBottomNav({ currentView, setView, onOpenCommandPalette }: MobileBottomNavProps) {
  const { t } = useLanguage();

  // Omit bottom bar on admin dashboard views to avoid cluttering operator controls
  if (currentView === 'admin' || currentView === 'admin-login') {
    return null;
  }

  const navItems = [
    {
      id: 'home',
      label: t('nav.home', 'Home'),
      icon: Home,
      action: () => setView('home'),
      active: currentView === 'home'
    },
    {
      id: 'services',
      label: t('nav.services', 'Services'),
      icon: Layers,
      action: () => setView('services'),
      active: currentView === 'services' || currentView === 'service-details'
    },
    {
      id: 'blogs',
      label: t('nav.blogs', 'Blogs'),
      icon: BookOpen,
      action: () => setView('blogs'),
      active: currentView === 'blogs' || currentView === 'blog-details'
    },
    {
      id: 'track',
      label: t('nav.track', 'Track'),
      icon: Search,
      action: () => setView('track'),
      active: currentView === 'track' || currentView === 'track-order'
    },
    {
      id: 'desk',
      label: t('nav.desk', 'Desk'),
      icon: MessageSquare,
      action: () => {
        window.dispatchEvent(new CustomEvent('easydesk-open-desk-assistant'));
        openGeneralWhatsApp('Hello EasyDesk, I need assistance with an online application.');
      },
      isAccent: true
    }
  ];

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] pb-safe transition-all"
    >
      <div className="grid grid-cols-5 items-center h-14 max-w-md mx-auto px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = Boolean(item.active);

          if (item.isAccent) {
            return (
              <button
                key={item.id}
                id={`mobile-nav-${item.id}`}
                type="button"
                onClick={item.action}
                className="flex flex-col items-center justify-center gap-0.5 h-full py-1 text-[#10B981] hover:text-[#059669] transition-colors cursor-pointer group"
                aria-label="WhatsApp Desk"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-2xs group-active:scale-90 transition-transform">
                  <Icon className="w-4 h-4 text-[#10B981]" />
                </div>
                <span className="text-[10px] font-extrabold text-[#059669] leading-tight">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              id={`mobile-nav-${item.id}`}
              type="button"
              onClick={item.action}
              className={`flex flex-col items-center justify-center gap-0.5 h-full py-1 transition-colors cursor-pointer focus-civic rounded-lg ${
                isActive 
                  ? 'text-[#0F4C81] font-bold' 
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-blue-50/80 text-[#0F4C81]' : ''}`}>
                <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
              </div>
              <span className={`text-[10px] leading-tight ${isActive ? 'font-black text-[#0F4C81]' : 'text-slate-500'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
