import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck, Lock, Zap, Search, ArrowRight, MessageSquare,
  Layers, CheckCircle2, Clock, Bot, FileText, CheckCircle,
  HelpCircle, Sparkles, ChevronRight, Shield
} from 'lucide-react';
import { Service, Blog, Review, BlogCategory } from '../types.js';
import { openWhatsAppForService, openGeneralWhatsApp, updateCachedContactSettings } from '../lib/whatsapp.js';
import { formatFullAddress, getClientContactSettings } from '../lib/apiDataService.js';
import BlogCard from './blog/BlogCard.js';
import TrustBadge from './ui/TrustBadge.js';

interface HomeViewProps {
  services: Service[];
  blogs: Blog[];
  blogCategories?: BlogCategory[];
  reviews: Review[];
  setView: (view: string) => void;
  setSelectedServiceId: (id: string) => void;
}

export default function HomeView({
  services,
  blogs,
  blogCategories = [],
  reviews,
  setView,
  setSelectedServiceId
}: HomeViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [contactInfo, setContactInfo] = useState<{ phone: string; address: string }>({ phone: '', address: '' });

  // Sync contact settings into cache on mount
  useEffect(() => {
    getClientContactSettings().then((data) => {
      if (data && typeof data === 'object') {
        formatFullAddress(data);
        updateCachedContactSettings(data);
        setContactInfo({ phone: data.phone || '', address: data.address || '' });
      }
    }).catch(() => {});
  }, []);

  // Filter public published blogs
  const publicBlogs = useMemo(() => {
    return (blogs || []).filter(b => {
      const st = (b.status || 'active').toLowerCase();
      return st !== 'inactive' && st !== 'draft' && st !== 'deleted';
    }).slice(0, 3);
  }, [blogs]);

  // Featured / popular services (top 6 active services)
  const popularServices = useMemo(() => {
    const active = (services || []).filter(s => (s.status || 'Active') === 'Active');
    const q = searchQuery.trim().toLowerCase();
    if (!q) return active.slice(0, 6);
    return active.filter(s =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.shortDescription || '').toLowerCase().includes(q)
    ).slice(0, 6);
  }, [services, searchQuery]);

  const handleAskAI = () => {
    window.dispatchEvent(new CustomEvent('easydesk-ai-contextual-help', {
      detail: { customPrompt: "Hello! I need assistance with finding the right government or digital service.", autoSend: true }
    }));
  };

  const handleServiceSelect = (id: string) => {
    setSelectedServiceId(id);
  };

  return (
    <div id="easydesk-home-view" className="font-sans text-slate-900 bg-[#F8FAFC] pb-16 w-full max-w-full overflow-x-hidden">

      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50/50 py-12 sm:py-16 lg:py-20 border-b border-slate-200/70">
        <div className="portal-container relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">

            {/* Eyebrow Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black bg-blue-50 text-[#0F4C81] border border-blue-200/70 shadow-2xs">
              <Shield className="w-3.5 h-3.5 text-[#0F4C81]" />
              <span>Trusted Digital Assistance • Government • Education • Business • Personal</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
              Your Online Work,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F4C81] via-blue-600 to-teal-600">
                Done Easily & Securely
              </span>
            </h1>

            {/* Supporting Description */}
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
              India-focused digital assistance for government certificates, PAN cards, licenses, GST filings, and scholarship paperwork. Verified desk officers pre-audit every document before submission to eliminate rejections.
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => openGeneralWhatsApp('Hello EasyDesk, I need help with an online application.')}
                className="inline-flex items-center gap-2 bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-xl transition cursor-pointer shadow-sm active:scale-95 btn-glow-emerald"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Order on WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setView('services')}
                className="inline-flex items-center gap-2 bg-[#0F4C81] hover:bg-[#0b3b64] text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-xl transition cursor-pointer shadow-xs active:scale-95"
              >
                <Layers className="w-4 h-4" />
                <span>Browse Services</span>
              </button>

              <button
                type="button"
                onClick={handleAskAI}
                className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-xs sm:text-sm px-4 py-3 rounded-xl transition cursor-pointer shadow-2xs active:scale-95"
              >
                <Bot className="w-4 h-4 text-[#0F4C81]" />
                <span>Ask EasyDesk AI</span>
              </button>
            </div>

            {/* In-Hero Search Input */}
            <div className="pt-4 max-w-xl mx-auto">
              <div className="relative bg-white rounded-2xl shadow-sm border border-slate-200/90 p-1.5 flex items-center hover:border-blue-300 transition-colors">
                <Search className="w-4 h-4 text-slate-400 ml-3.5 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Passport, PAN Card, GST, Certificates..."
                  className="w-full text-xs sm:text-sm text-slate-900 bg-transparent pl-3 pr-4 py-2 outline-none font-medium placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    type="button"
                    className="text-xs text-slate-400 hover:text-slate-700 font-bold px-2 py-1 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setView('services')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl transition shrink-0 cursor-pointer"
                >
                  Explore
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. TRUST STRIP */}
      <section className="border-b border-slate-200/80 bg-white py-4 shadow-2xs">
        <div className="portal-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-800">
              <Lock className="w-4 h-4 text-[#0F4C81] shrink-0" />
              <span>Secure Document Handling</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-800">
              <Zap className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Fast Assistance</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Transparent Pricing</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Privacy Protected</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. POPULAR SERVICES SECTION */}
      <section className="portal-container pt-12 sm:pt-16">
        <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#0F4C81] uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5 text-[#0F4C81]" />
              <span>Catalog Highlights</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight m-0">
              Popular Digital Services
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal m-0 max-w-xl">
              Select an application below for step-by-step assistance, pre-submission checklist, and transparent fee schedules.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setView('services')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F4C81] hover:text-[#0b3b64] cursor-pointer shrink-0"
          >
            <span>View All Services</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {popularServices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center space-y-2">
            <Layers className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No matching services found</h3>
            <p className="text-xs text-slate-500">Try searching for other terms or explore the full catalog.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {popularServices.map(service => {
              const totalFee = (service.govFees || 0) + (service.serviceCharge || 0);
              const hasTimeline = Boolean(service?.timeline?.enabled && service.timeline?.startDate && service.timeline?.endDate);

              return (
                <div
                  key={service.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col justify-between shadow-2xs hover:shadow-md hover:-translate-y-1 transition-all duration-200 group"
                >
                  <div className="space-y-3">
                    {/* Badge & Turnaround */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                        {service.processingTime || '3–5 Days'}
                      </span>
                      {hasTimeline && (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-600" /> Active Timeline
                        </span>
                      )}
                    </div>

                    {/* Service Name */}
                    <h3
                      onClick={() => handleServiceSelect(service.id)}
                      className="text-base font-black text-slate-900 leading-snug hover:text-[#0F4C81] cursor-pointer transition-colors m-0"
                    >
                      {service.title}
                    </h3>

                    {/* Short Description strictly with description fallback */}
                    {(service.shortDescription || service.description) ? (
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 font-normal m-0">
                        {service.shortDescription || service.description}
                      </p>
                    ) : null}

                    {/* Timeline dates if configured */}
                    {hasTimeline && service.timeline?.startDate && service.timeline?.endDate && (
                      <div className="p-2 bg-blue-50/60 rounded-xl border border-blue-100/80 text-[11px] text-slate-700 space-y-0.5">
                        <span className="block text-[10px] uppercase font-extrabold text-[#0F4C81]">Application Window</span>
                        <span className="font-medium text-slate-600">
                          {service.timeline.startDate} to {service.timeline.endDate}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Price & Apply */}
                  <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <span className="block text-[10px] text-slate-400 font-extrabold uppercase">Starting from</span>
                      <span className="text-base font-black text-slate-900 tabular-nums">
                        {totalFee > 0 ? `₹${totalFee}` : 'Guided on Desk'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleServiceSelect(service.id)}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-2xs"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={() => openWhatsAppForService(service, 'Service Desk')}
                        className="bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-95"
                      >
                        Apply Now
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. HOW EASYDESK WORKS */}
      <section className="portal-container pt-16 sm:pt-20">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <span className="text-[11px] font-black text-[#0F4C81] uppercase tracking-wider block">
            Straightforward Process
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight m-0">
            How EasyDesk Works
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-normal m-0">
            Five transparent stages to complete your civic and digital documentation from home.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
          {[
            { step: '01', title: 'Choose Service', desc: 'Browse verified catalog and inspect prerequisites.' },
            { step: '02', title: 'Submit Documents', desc: 'Share required paperwork securely to our desk.' },
            { step: '03', title: 'Desk Verification', desc: 'Dedicated officers pre-audit fields for 100% accuracy.' },
            { step: '04', title: 'Processing', desc: 'Fast-track submission to official department portals.' },
            { step: '05', title: 'Track Application', desc: 'Real-time status updates and direct document delivery.' }
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs relative flex flex-col justify-between"
            >
              <div className="space-y-2">
                <span className="text-xs font-black font-mono text-[#0F4C81] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100/60 inline-block">
                  {item.step}
                </span>
                <h4 className="text-sm font-bold text-slate-900 leading-snug m-0">{item.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed font-normal m-0">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. WHY EASYDESK TRUST CARDS */}
      <section className="portal-container pt-16 sm:pt-20">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <span className="text-[11px] font-black text-[#0F4C81] uppercase tracking-wider block">
            Uncompromising Standards
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight m-0">
            Why Choose EasyDesk
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-normal m-0">
            Designed specifically for citizens and businesses requiring error-free digital applications.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <TrustBadge
            icon={ShieldCheck}
            title="Pre-Audited Document Filing"
            description="Our verification officers audit required paperwork prior to submission to prevent portal rejections."
          />
          <TrustBadge
            icon={Lock}
            title="Encrypted & Safe Vault"
            description="All sensitive files are safeguarded during processing with strict non-disclosure safeguards."
          />
          <TrustBadge
            icon={FileText}
            title="Transparent Fee Breakdown"
            description="Clear separation of official government charges and assistance fees. Zero hidden costs."
          />
          <TrustBadge
            icon={Zap}
            title="Instant WhatsApp Desk"
            description="Direct real-time communication with designated desk officers for status and guidance."
          />
        </div>
      </section>

      {/* 6. LATEST GUIDES / BLOGS (Real data only) */}
      {publicBlogs.length > 0 && (
        <section className="portal-container pt-16 sm:pt-20">
          <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-8 gap-4">
            <div>
              <span className="text-[11px] font-black text-[#0F4C81] uppercase tracking-wider block mb-1">
                Knowledge Hub
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight m-0">
                Latest Guides & Updates
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-normal m-0 mt-1">
                Step-by-step documentation rules, deadlines, and official procedure circulars.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setView('blogs')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F4C81] hover:text-[#0b3b64] cursor-pointer shrink-0"
            >
              <span>Explore All Guides</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {publicBlogs.map(blog => (
              <BlogCard
                key={blog.id}
                blog={blog}
                blogCategories={blogCategories}
                onSelect={(b) => {
                  const slugOrId = b.slug || b.id;
                  setView('blogs');
                  window.history.pushState({ view: 'blogs', blogId: slugOrId }, '', `/blogs/${slugOrId}`);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* 7. FINAL CALL TO ACTION */}
      <section className="portal-container pt-16 sm:pt-20">
        <div className="rounded-3xl bg-gradient-to-br from-[#0F4C81] via-[#0D3F6C] to-[#0A2540] text-white p-8 sm:p-12 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 bg-white/10 text-cyan-300 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-white/15">
              <HelpCircle className="w-3.5 h-3.5" /> Direct Assistance
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-white m-0 leading-tight">
              Need Help with a Government or Digital Service?
            </h3>
            <p className="text-xs sm:text-sm text-blue-100/90 max-w-xl m-0 font-normal">
              Connect directly with our verification officers on WhatsApp for personalized document pre-checks and accelerated submission.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              type="button"
              onClick={() => openGeneralWhatsApp('Hello EasyDesk, I need help with an online application.')}
              className="bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl transition cursor-pointer shadow-md flex items-center gap-2 active:scale-95 btn-glow-emerald"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Talk to EasyDesk</span>
            </button>
            <button
              type="button"
              onClick={() => setView('services')}
              className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-xl transition border border-white/20 cursor-pointer"
            >
              Browse Catalog
            </button>
          </div>
        </div>
      </section>

      {/* Contact hydration skeleton placeholder if hydrating */}
      {(!contactInfo.phone || !contactInfo.address) && (
        <div className="hidden" aria-hidden="true">
          <div className="animate-pulse" />
        </div>
      )}

    </div>
  );
}
