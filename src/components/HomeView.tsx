import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck, Lock, Zap, Search, ArrowRight, MessageSquare,
  Layers, CheckCircle2, Clock, Bot, FileText, CheckCircle,
  HelpCircle, Sparkles, ChevronRight, Shield, Award, Check
} from 'lucide-react';
import { Service, Blog, Review, BlogCategory } from '../types.js';
import { openWhatsAppForService, openGeneralWhatsApp, updateCachedContactSettings } from '../lib/whatsapp.js';
import { formatFullAddress, getClientContactSettings } from '../lib/apiDataService.js';
import BlogCard from './blog/BlogCard.js';
import TrustBadge from './ui/TrustBadge.js';
import SectionContainer from './ui/SectionContainer.js';
import SectionHeader from './ui/SectionHeader.js';
import CivicCard from './ui/CivicCard.js';
import MyEasyDeskBrand from './ui/MyEasyDeskBrand.js';

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

  const [catalogSection, setCatalogSection] = useState<'popular' | 'trending' | 'featured' | 'all'>('popular');

  // Curated services based on Popular / Trending / Featured
  const isServiceActive = (s: Service) => {
    const st = (s.status || 'Active').toLowerCase();
    return st !== 'inactive' && st !== 'draft' && st !== 'hidden' && s.active !== false;
  };

  const displayedServices = useMemo(() => {
    const active = (services || []).filter(isServiceActive);
    let sectionFiltered = active;

    if (catalogSection === 'popular') {
      const pop = active.filter(s => s.popular || (s.popularity && s.popularity >= 80));
      sectionFiltered = pop.length > 0 ? pop : active;
    } else if (catalogSection === 'trending') {
      const trn = active.filter(s => s.trending || (s.popularity && s.popularity >= 70));
      sectionFiltered = trn.length > 0 ? trn : [...active].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    } else if (catalogSection === 'featured') {
      const feat = active.filter(s => s.featured);
      sectionFiltered = feat.length > 0 ? feat : active;
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return sectionFiltered.slice(0, 6);
    return sectionFiltered.filter(s =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.shortDescription || '').toLowerCase().includes(q)
    ).slice(0, 6);
  }, [services, searchQuery, catalogSection]);

  const handleAskAI = () => {
    window.dispatchEvent(new CustomEvent('easydesk-ai-contextual-help', {
      detail: { customPrompt: "Hello! I need assistance with finding the right government or digital service.", autoSend: true }
    }));
  };

  const handleServiceSelect = (id: string) => {
    setSelectedServiceId(id);
  };

  return (
    <div id="easydesk-home-view" className="font-sans text-slate-900 w-full max-w-full overflow-x-hidden">

      {/* ==================================================
          SECTION 1: HERO
          ================================================== */}
      <SectionContainer
        id="home-hero-section"
        variant="brand-tint"
        size="hero"
        ariaLabel="Hero Introduction"
      >
        <div className="max-w-4xl mx-auto text-center space-y-6">

          {/* Official Brand Identity Presentation */}
          <div className="flex justify-center pb-1">
            <MyEasyDeskBrand size="xl" showTagline={false} />
          </div>

          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black bg-blue-50 text-[#0F4C81] border border-blue-200/80 shadow-2xs">
            <Shield className="w-3.5 h-3.5 text-[#0F4C81]" />
            <span>Government • Education • Business • Personal Documents</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12]">
            Your Online Work,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F4C81] via-blue-600 to-teal-600">
              Done Easily & Securely
            </span>
          </h1>

          {/* Supporting Description */}
          <p className="text-sm sm:text-base md:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
            India-focused digital assistance for government certificates, PAN cards, licenses, GST filings, and scholarship paperwork. Verified desk officers pre-audit every document before submission to eliminate rejections.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => openGeneralWhatsApp('Hello My EasyDesk, I need help with an online application.')}
              className="inline-flex items-center gap-2 bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs sm:text-sm px-6 py-3.5 rounded-xl transition cursor-pointer shadow-md hover:shadow-lg active:scale-95 btn-glow-emerald"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Order on WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => setView('services')}
              className="inline-flex items-center gap-2 bg-[#0F4C81] hover:bg-[#0b3b64] text-white font-bold text-xs sm:text-sm px-6 py-3.5 rounded-xl transition cursor-pointer shadow-sm hover:shadow-md active:scale-95"
            >
              <Layers className="w-4 h-4" />
              <span>Browse Services</span>
            </button>

            <button
              type="button"
              onClick={handleAskAI}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 font-bold text-xs sm:text-sm px-5 py-3.5 rounded-xl transition cursor-pointer shadow-2xs hover:shadow-sm active:scale-95"
            >
              <Bot className="w-4 h-4 text-[#0F4C81]" />
              <span>Ask My EasyDesk AI</span>
            </button>
          </div>

          {/* In-Hero Search Input */}
          <div className="pt-4 max-w-xl mx-auto">
            <div className="relative bg-white rounded-2xl shadow-sm border border-slate-200/90 p-1.5 flex items-center hover:border-blue-400 focus-within:border-[#0F4C81] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
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
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl transition shrink-0 cursor-pointer"
              >
                Explore
              </button>
            </div>
          </div>

        </div>
      </SectionContainer>

      {/* ==================================================
          SECTION 2: TRUST & SECURITY STRIP
          ================================================== */}
      <SectionContainer
        id="home-trust-strip"
        variant="default"
        size="sm"
        dividerTop
        dividerBottom
        ariaLabel="Key Trust Guarantees"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center">
          <div className="flex items-center justify-center gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-2xs">
            <Lock className="w-4 h-4 text-[#0F4C81] shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-slate-800">Secure Document Vault</span>
          </div>
          <div className="flex items-center justify-center gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-2xs">
            <Zap className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-slate-800">Fast-Track Filing</span>
          </div>
          <div className="flex items-center justify-center gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-slate-800">100% Transparent Fees</span>
          </div>
          <div className="flex items-center justify-center gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-slate-800">Pre-Audit Guarantee</span>
          </div>
        </div>
      </SectionContainer>

      {/* ==================================================
          SECTION 3: CIVIC SERVICES DIRECTORY
          ================================================== */}
      <SectionContainer
        id="home-services-section"
        variant="subtle"
        size="lg"
        ariaLabel="Civic Services Directory"
      >
        <SectionHeader
          badge={{
            text: 'Civic Services Directory',
            icon: <Sparkles className="w-3.5 h-3.5 text-[#0F4C81]" />
          }}
          title={
            catalogSection === 'popular' ? 'Most Popular Services' :
            catalogSection === 'trending' ? 'Trending & High-Demand Services' :
            catalogSection === 'featured' ? 'Featured Assistance Programs' : 'All Digital Services'
          }
          subtitle="Official portal applications with verified desk assistance, checklist audit, and transparent fee schedules."
          actions={
            <button
              type="button"
              onClick={() => setView('services')}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#0F4C81] hover:text-[#0A2540] transition cursor-pointer shrink-0 focus-civic rounded-lg px-2 py-1"
            >
              <span>View All Services</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          }
        />

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            type="button"
            onClick={() => setCatalogSection('popular')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1.5 focus-civic ${
              catalogSection === 'popular'
                ? 'bg-[#0F4C81] text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${catalogSection === 'popular' ? 'text-amber-300' : 'text-amber-500'}`} />
            <span>Most Popular</span>
          </button>

          <button
            type="button"
            onClick={() => setCatalogSection('trending')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1.5 focus-civic ${
              catalogSection === 'trending'
                ? 'bg-[#0F4C81] text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${catalogSection === 'trending' ? 'text-amber-300' : 'text-amber-500'}`} />
            <span>Trending</span>
          </button>

          <button
            type="button"
            onClick={() => setCatalogSection('featured')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1.5 focus-civic ${
              catalogSection === 'featured'
                ? 'bg-[#0F4C81] text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${catalogSection === 'featured' ? 'text-emerald-300' : 'text-emerald-600'}`} />
            <span>Featured</span>
          </button>

          <button
            type="button"
            onClick={() => setCatalogSection('all')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition cursor-pointer focus-civic ${
              catalogSection === 'all'
                ? 'bg-[#0F4C81] text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Services
          </button>
        </div>

        {displayedServices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-10 text-center space-y-2 max-w-md mx-auto shadow-2xs">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No matching services found</h3>
            <p className="text-xs text-slate-500">Try switching categories or view the full services catalog.</p>
            <button
              onClick={() => { setSearchQuery(''); setCatalogSection('all'); }}
              type="button"
              className="mt-3 px-4 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedServices.map(service => {
              const totalFee = (service.govFees || 0) + (service.serviceCharge || 0);
              const hasTimeline = Boolean(service?.timeline?.enabled && service.timeline?.startDate && service.timeline?.endDate);
              const bannerImg = service.bannerImage || service.imageUrl || service.image;

              return (
                <CivicCard
                  key={service.id}
                  variant="default"
                  hoverEffect
                  className="flex flex-col justify-between group"
                >
                  <div>
                    {/* Banner Image with Clean Fallback */}
                    {bannerImg ? (
                      <div 
                        onClick={() => handleServiceSelect(service.id)}
                        className="relative w-full h-44 overflow-hidden bg-slate-100 cursor-pointer border-b border-slate-100"
                      >
                        <img
                          src={bannerImg}
                          alt={service.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                          {service.featured && (
                            <span className="bg-blue-600/95 backdrop-blur-xs text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md shadow-xs">
                              Featured
                            </span>
                          )}
                          {service.popular && (
                            <span className="bg-amber-500/95 backdrop-blur-xs text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md shadow-xs">
                              Popular
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={() => handleServiceSelect(service.id)}
                        className="w-full h-28 bg-gradient-to-r from-blue-900 via-[#0F4C81] to-slate-900 flex items-center justify-between px-5 text-white cursor-pointer border-b border-slate-100"
                      >
                        <div className="flex items-center gap-2">
                          <Layers className="w-5 h-5 text-cyan-300" />
                          <span className="text-xs font-bold text-slate-100">Official Desk Service</span>
                        </div>
                        {service.featured && (
                          <span className="bg-white/20 text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded">
                            Featured
                          </span>
                        )}
                      </div>
                    )}

                    <div className="p-5 sm:p-6 space-y-3">
                      {/* Badge & Turnaround */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                        <span className="bg-blue-50 text-[#0F4C81] border border-blue-100 px-2.5 py-0.5 rounded-full font-bold">
                          {service.processingTime || '3–5 Days'}
                        </span>
                        {hasTimeline && (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" /> Active Timeline
                          </span>
                        )}
                      </div>

                      {/* Service Name */}
                      <h3
                        onClick={() => handleServiceSelect(service.id)}
                        className="text-base sm:text-lg font-black text-slate-900 leading-snug hover:text-[#0F4C81] cursor-pointer transition-colors m-0"
                      >
                        {service.title}
                      </h3>

                      {/* Short Description */}
                      {(service.shortDescription || service.description) ? (
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 font-normal m-0">
                          {service.shortDescription || service.description}
                        </p>
                      ) : null}

                      {/* Timeline dates if configured */}
                      {hasTimeline && service.timeline?.startDate && service.timeline?.endDate && (
                        <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-100/90 text-xs text-slate-700 space-y-0.5">
                          <span className="block text-[10px] uppercase font-extrabold text-[#0F4C81]">Application Window</span>
                          <span className="font-semibold text-slate-700">
                            {service.timeline.startDate} to {service.timeline.endDate}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Price & Apply */}
                  <div className="p-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/60">
                    <div>
                      <span className="block text-[10px] text-slate-400 font-extrabold uppercase">Starting from</span>
                      <span className="text-base sm:text-lg font-black text-slate-900 tabular-nums">
                        {totalFee > 0 ? `₹${totalFee}` : 'Guided on Desk'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleServiceSelect(service.id)}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-2xs focus-civic"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={() => openWhatsAppForService(service, 'Service Desk')}
                        className="bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-95 btn-glow-emerald focus-civic"
                      >
                        Apply Now
                      </button>
                    </div>
                  </div>

                </CivicCard>
              );
            })}
          </div>
        )}
      </SectionContainer>

      {/* ==================================================
          SECTION 4: HOW MY EASYDESK WORKS
          ================================================== */}
      <SectionContainer
        id="home-how-it-works-section"
        variant="default"
        size="lg"
        dividerTop
        ariaLabel="How My EasyDesk Works"
      >
        <SectionHeader
          align="center"
          badge={{
            text: 'Straightforward Workflow',
            icon: <CheckCircle className="w-3.5 h-3.5 text-[#0F4C81]" />
          }}
          title="How My EasyDesk Works"
          subtitle="Five transparent stages to complete your civic and digital documentation from home without portal errors."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 relative">
          {[
            { step: '01', icon: Layers, title: 'Choose Service', desc: 'Browse verified catalog and inspect prerequisites and eligibility.' },
            { step: '02', icon: FileText, title: 'Submit Documents', desc: 'Share required paperwork securely to our designated desk.' },
            { step: '03', icon: ShieldCheck, title: 'Desk Verification', desc: 'Officers pre-audit fields, spellings, and formats for 100% accuracy.' },
            { step: '04', icon: Zap, title: 'Portal Filing', desc: 'Fast-track submission to official department portals with receipt.' },
            { step: '05', icon: CheckCircle2, title: 'Track & Deliver', desc: 'Real-time status updates and direct document delivery to your phone.' }
          ].map((item, idx) => {
            const StepIcon = item.icon;
            return (
              <CivicCard
                key={idx}
                variant="subtle"
                hoverEffect
                className="p-5 flex flex-col justify-between group transition-all duration-300 hover:-translate-y-1"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black font-mono text-[#0062FF] bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200/80 inline-block shadow-2xs">
                      STEP {item.step}
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0F4C81] flex items-center justify-center group-hover:bg-[#0062FF] group-hover:text-white transition-colors shadow-2xs">
                      <StepIcon className="w-4 h-4" />
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 leading-snug m-0">{item.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-normal m-0">{item.desc}</p>
                </div>
              </CivicCard>
            );
          })}
        </div>
      </SectionContainer>

      {/* ==================================================
          SECTION 5: WHY MY EASYDESK (TRUST & VALUES)
          ================================================== */}
      <SectionContainer
        id="home-why-easydesk-section"
        variant="subtle"
        size="lg"
        dividerTop
        ariaLabel="Why Choose My EasyDesk"
      >
        <SectionHeader
          align="center"
          badge={{
            text: 'Uncompromising Standards',
            icon: <Award className="w-3.5 h-3.5 text-[#0F4C81]" />
          }}
          title="Why Choose My EasyDesk"
          subtitle="Designed specifically for citizens and businesses requiring error-free digital applications and zero rejections."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
      </SectionContainer>

      {/* ==================================================
          SECTION 6: LATEST GUIDES & UPDATES (KNOWLEDGE HUB)
          ================================================== */}
      {publicBlogs.length > 0 && (
        <SectionContainer
          id="home-blogs-section"
          variant="default"
          size="lg"
          dividerTop
          ariaLabel="Knowledge Hub"
        >
          <SectionHeader
            badge={{
              text: 'Knowledge Hub',
              icon: <FileText className="w-3.5 h-3.5 text-[#0F4C81]" />
            }}
            title="Latest Guides & Procedural Updates"
            subtitle="Step-by-step documentation rules, deadlines, and official procedure circulars written by desk specialists."
            actions={
              <button
                type="button"
                onClick={() => setView('blogs')}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#0F4C81] hover:text-[#0A2540] transition cursor-pointer shrink-0 focus-civic rounded-lg px-2 py-1"
              >
                <span>Explore All Guides</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            }
          />

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
        </SectionContainer>
      )}

      {/* ==================================================
          SECTION 7: FINAL CALL TO ACTION
          ================================================== */}
      <SectionContainer
        id="home-final-cta-section"
        variant="subtle"
        size="md"
        dividerTop
        ariaLabel="Contact Assistance CTA"
      >
        <div className="rounded-3xl bg-gradient-to-br from-[#0F4C81] via-[#0D3F6C] to-[#0A2540] text-white p-8 sm:p-12 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2.5 text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 bg-white/10 text-cyan-300 text-[10px] font-black uppercase tracking-wider px-3.5 py-1 rounded-full border border-white/15">
              <HelpCircle className="w-3.5 h-3.5" /> Direct Officer Support
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-white m-0 leading-tight">
              Need Help with a Government or Digital Service?
            </h3>
            <p className="text-xs sm:text-sm text-blue-100/90 max-w-xl m-0 font-normal leading-relaxed">
              Connect directly with our verification officers on WhatsApp for personalized document pre-checks and accelerated submission.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => openGeneralWhatsApp('Hello My EasyDesk, I need help with an online application.')}
              className="bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs sm:text-sm px-6 py-3.5 rounded-xl transition cursor-pointer shadow-md flex items-center gap-2 active:scale-95 btn-glow-emerald focus-civic"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Talk to My EasyDesk</span>
            </button>
            <button
              type="button"
              onClick={() => setView('services')}
              className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm px-5 py-3.5 rounded-xl transition border border-white/20 cursor-pointer focus-civic"
            >
              Browse Catalog
            </button>
          </div>
        </div>
      </SectionContainer>

    </div>
  );
}
