import React, { useState, useMemo } from 'react';
import { 
  Search, ShieldAlert, CheckSquare, 
  MessageSquare, FileText, ArrowRight, Sparkles,
  ShieldCheck, Clock, CheckCircle2, Bot, Layers,
  HelpCircle, Zap
} from 'lucide-react';
import { motion } from 'motion/react';
import { Service, ServiceCategory } from '../types.js';
import { openWhatsAppForService, openGeneralWhatsApp } from '../lib/whatsapp.js';
import { BaseCard, BaseCardBody, BaseCardFooter } from './BaseCard.js';
import { useScrollToTopOnChange } from '../lib/scrollUtils.js';
import ContentUnavailable from './ContentUnavailable.js';

interface ServicesViewProps {
  categories: ServiceCategory[];
  services: Service[];
  setView: (view: string) => void;
  setSelectedServiceId: (id: string | null) => void;
  selectedServiceId?: string | null;
  setOrderService?: (service: Service | null) => void;
}

export default function ServicesView({ 
  categories, 
  services, 
  setView, 
  setSelectedServiceId
}: ServicesViewProps) {
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Reset scroll to top when category tab changes
  useScrollToTopOnChange([selectedCategory]);

  const filteredServices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return services.filter(s => {
      const matchesCategory = selectedCategory === 'all' || s.categoryId === selectedCategory;
      const matchesSearch = !q || (s.title || '').toLowerCase().includes(q) || 
                            (s.description || '').toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [services, selectedCategory, searchQuery]);

  const handleOpenDetails = (id: string) => {
    setSelectedServiceId(id);
    setView('service-details');
  };

  // Filter active categories for public view tabs
  const activeCategories = useMemo(() => {
    return categories.filter(c => (c.status || 'Active') === 'Active');
  }, [categories]);

  return (
    <div id="easydesk-services-view" className="font-sans text-slate-900 bg-[#F8FAFC] pb-16 w-full max-w-full overflow-x-hidden">
      
      {/* 1. HERO HEADER (Matching AboutUs Gradient Banner & Pulse Badge) */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/70 via-slate-50 to-white py-10 sm:py-14 border-b border-slate-200/60 mb-8">
        
        {/* Subtle Decorative Background Blur */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full portal-container h-full pointer-events-none overflow-hidden opacity-60">
          <div className="absolute -top-24 -left-20 w-80 h-80 bg-blue-200/40 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -right-20 w-72 h-72 bg-emerald-200/30 rounded-full blur-3xl" />
        </div>

        <div className="portal-container relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-3xl space-y-3"
          >
            <div className="inline-flex items-center gap-2 bg-blue-100/90 border border-blue-200/70 px-4 py-1.5 rounded-full text-xs font-black text-[#0F4C81] shadow-2xs pulse-badge">
              <Layers className="w-4 h-4 text-[#0F4C81]" />
              <span>Verified Catalog & Assistance Directory</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Explore Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F4C81] via-blue-600 to-teal-600">Digital Services Catalog</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              Get assistance for Government documents, business registrations, licenses, and personal certificates. Connect directly with EasyDesk filing experts on WhatsApp for accelerated processing and pre-submission audit.
            </p>

            {/* Quick Metrics Bar */}
            <div className="pt-3 flex flex-wrap gap-4 text-xs font-bold text-slate-700">
              <div className="flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>100+ Verified Services</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-[#0F4C81]" />
                <span>Pre-Audited Document Filing</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Instant WhatsApp Desk</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="portal-container">
        
        {/* 2. FILTER AND SEARCH BAR (Polished Container with Focus Glow) */}
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm p-4 sm:p-5 mb-8 hover-glow-blue transition-all duration-300">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            
            {/* Categories Tab list */}
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer hover-scale-sm ${
                  selectedCategory === 'all' 
                    ? 'bg-[#0F4C81] text-white shadow-sm btn-glow-primary' 
                    : 'bg-slate-50 text-slate-700 border border-slate-200/80 hover:bg-blue-50/70 hover:text-[#0F4C81]'
                }`}
              >
                All Services
              </button>
              {activeCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer hover-scale-sm ${
                    selectedCategory === cat.id 
                      ? 'bg-[#0F4C81] text-white shadow-sm btn-glow-primary' 
                      : 'bg-slate-50 text-slate-700 border border-slate-200/80 hover:bg-blue-50/70 hover:text-[#0F4C81]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Local Search Input */}
            <div className="w-full md:w-auto relative min-w-[280px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 shrink-0 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search within catalog..."
                className="w-full bg-slate-50/70 border border-slate-200/80 rounded-xl pl-10 pr-8 py-2.5 text-xs text-slate-900 focus:outline-none input-focus-glow placeholder:text-slate-400 font-medium"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-900 cursor-pointer w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-200 transition"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3. SERVICES GRID */}
        {services.length === 0 && !searchQuery ? (
          <ContentUnavailable
            id="services-catalog-unavailable"
            statusCode={404}
            title="Services Directory Unavailable"
            message="We were unable to load the services catalog at this moment. You can still reach our team directly on WhatsApp for filing assistance."
            primaryActionText="Return to Home"
            onPrimaryAction={() => setView('home')}
            secondaryActionText="Chat on WhatsApp"
            onSecondaryAction={() => openGeneralWhatsApp('Hello EasyDesk, I need help with government certificate services.')}
          />
        ) : filteredServices.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-10 text-center shadow-sm space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#0F4C81] border border-blue-100 flex items-center justify-center mx-auto shadow-2xs">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h3 className="font-black text-base text-slate-900 mt-2 m-0">No Services Found</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto font-normal">
              We couldn't find any services matching "{searchQuery}". Try typing another keyword, or chat with our EasyDesk AI Assistant for custom guidance.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button 
                onClick={() => { setSelectedCategory('all'); setSearchQuery(''); }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Reset Filters
              </button>
              <button
                onClick={() => openGeneralWhatsApp(`Inquiry regarding service search: ${searchQuery}`)}
                className="px-5 py-2.5 bg-[#10B981] hover:bg-[#0e9f6e] text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 btn-glow-emerald"
              >
                <MessageSquare className="w-4 h-4" /> Ask on WhatsApp
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 2xl:gap-7">
            {filteredServices.map(service => {
              const catName = categories.find(c => c.id === service.categoryId)?.name || 'Service';
              return (
                <div key={service.id} className="h-full">
                  <div className="h-full bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-xs hover-lift hover-glow-blue transition-all duration-300 flex flex-col justify-between group">
                    <div className="p-6 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-1 rounded-full">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> {service.processingTime || '3–5 Working Days'}
                        </span>
                        <span className="badge-soft-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                          {catName}
                        </span>
                      </div>
                      
                      <h3 
                        onClick={() => handleOpenDetails(service.id)}
                        className="font-black text-base text-slate-900 mt-4 leading-snug hover:text-[#0F4C81] cursor-pointer transition"
                      >
                        {service.title}
                      </h3>
                      {service.description ? (
                        <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed font-normal">{service.description}</p>
                      ) : null}
                      
                      {/* Required Checklist */}
                      <div className="mt-5 pt-4 border-t border-slate-100">
                        <span className="block text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Required Checklist:</span>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(service.requiredDocuments || []).slice(0, 2).map((doc, dIdx) => (
                            <span key={dIdx} className="text-[10px] bg-slate-50 hover:bg-blue-50 text-slate-700 px-2.5 py-1 rounded-xl border border-slate-200/70 font-medium transition-colors">
                              ✓ {doc}
                            </span>
                          ))}
                          {(service.requiredDocuments || []).length > 2 && (
                            <span className="text-[10px] text-slate-500 py-1 font-bold">+{(service.requiredDocuments || []).length - 2} more</span>
                          )}
                          {(!service.requiredDocuments || service.requiredDocuments.length === 0) && (
                            <span className="text-[10px] text-slate-400 italic">Guided on WhatsApp</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Price & Action Footer */}
                    <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        <span className="block text-[9px] text-slate-500 font-extrabold uppercase leading-none">Starting Price</span>
                        <span className="text-base font-black text-slate-900">₹{(service.govFees || 0) + (service.serviceCharge || 0)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenDetails(service.id)}
                          className="bg-white border border-slate-200/80 hover:bg-slate-100 text-slate-800 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer hover-scale-sm shadow-2xs"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => openWhatsAppForService(service, catName)}
                          className="bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm btn-glow-emerald hover-scale-sm"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Order
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4. BOTTOM HELP & AI BANNER (Matching AboutUs Consultation Callout) */}
        <div className="mt-14 bg-gradient-to-br from-[#0F4C81] to-[#0A3258] text-white rounded-3xl p-7 sm:p-9 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 hover-glow-blue transition-all duration-300">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 bg-white/10 text-cyan-300 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-white/15">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" /> Custom Certificate Inquiry
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white m-0">Can't Find the Service You Need?</h3>
            <p className="text-xs text-blue-100/90 max-w-xl m-0 font-normal">
              Our officers handle hundreds of specialized municipal, state, and central government filings. Chat with our team for instant custom assistance.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              onClick={() => openGeneralWhatsApp('Hello EasyDesk, I need help with a custom digital service that is not in the catalog.')}
              className="bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs px-5 py-3 rounded-xl transition cursor-pointer flex items-center gap-2 btn-glow-emerald hover-scale-sm shadow-md"
            >
              <MessageSquare className="w-4 h-4" /> WhatsApp Officer
            </button>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('easydesk-ai-contextual-help', {
                  detail: { customPrompt: "Hello! I need guidance on finding a specific certificate service.", autoSend: true }
                }));
              }}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs px-5 py-3 rounded-xl transition cursor-pointer flex items-center gap-2 hover-scale-sm"
            >
              <Bot className="w-4 h-4 text-cyan-300" /> Consult AI Desk
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}

