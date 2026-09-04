import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileCheck, Shield, Zap, RefreshCw, Star, Heart, Search, 
  MapPin, Clock, ArrowRight, HelpCircle, Phone, Mail, Clock4, Check, User,
  Lock, ShieldCheck, EyeOff, FileText, Calendar, MessageSquare, Sparkles,
  Bot, Award, CheckCircle2, ChevronRight, AlertTriangle, ExternalLink,
  Users, Building2, Globe, ShieldAlert, BadgeCheck, CheckCircle, Edit3,
  Compass, Target, HelpCircle as HelpIcon, ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Service, Blog, Review, BlogCategory } from '../types.js';
import { openWhatsAppForService, openGeneralWhatsApp, onContactSettingsUpdated } from '../lib/whatsapp.js';
import { BaseCard, BaseCardBody, BaseCardFooter } from './BaseCard.js';
import ReviewSubmissionModal from './ReviewSubmissionModal.js';
import BlogCard from './blog/BlogCard.js';
import { getClientFaqs } from '../lib/apiDataService.js';

const STATS = [
  { label: 'Applications Handled', value: '45,280+', desc: 'Across 100+ digital certificate categories' },
  { label: 'Customer Satisfaction', value: '99.4%', desc: 'Verified 5-star customer feedback' },
  { label: 'Cities Covered', value: '250+', desc: 'Pan-India digital desk support network' },
  { label: 'Average Resolution', value: '3.5 Days', desc: 'Accelerated document submission & verification' }
];

const TRUST_BADGES = [
  { title: 'Secure Document Handling', desc: '256-bit encrypted filing vault & automated cache purge', icon: Lock },
  { title: 'Privacy Protected', desc: 'Strict non-disclosure policy. No data sharing with 3rd parties', icon: ShieldCheck },
  { title: 'Professional Assistance', desc: 'Verified filing officers audit every document before submission', icon: Award },
  { title: 'Transparent Pricing', desc: 'Clear breakup of Government fees and minimal consultancy charges', icon: FileText },
  { title: 'Fast Support', desc: 'Instant WhatsApp & Phone help desk support for filing queries', icon: Zap }
];

const WHY_CHOOSE_FEATURES = [
  { title: 'Professional Experts', desc: 'Experienced filing officers review every application parameter to prevent portal rejections.', icon: Users, color: 'text-[#0F4C81] bg-blue-50 border-blue-200/60' },
  { title: '100+ Digital Services', desc: 'Comprehensive coverage from PAN, GST, Passport, MSME to State Income & Caste Certificates.', icon: Building2, color: 'text-indigo-600 bg-indigo-50 border-indigo-200/60' },
  { title: 'Secure Data Handling', desc: 'Bank-grade SSL encryption for files, with user-initiated data purge options after order delivery.', icon: Lock, color: 'text-emerald-600 bg-emerald-50 border-emerald-200/60' },
  { title: 'Quick Response', desc: 'Automated status alerts via SMS, Email, and WhatsApp for every application milestone.', icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200/60' },
  { title: 'Verified Process', desc: 'Direct portal submission with official government fee receipts delivered via WhatsApp and Email.', icon: BadgeCheck, color: 'text-blue-600 bg-cyan-50 border-cyan-200/60' },
  { title: 'Affordable Pricing', desc: 'Lowest consultancy charge guaranteed with zero hidden fees or unexpected surcharges.', icon: FileText, color: 'text-purple-600 bg-purple-50 border-purple-200/60' }
];

const GOVT_EVENTS = [
  { date: 'Aug 15, 2026', title: 'Income Tax Return (ITR) Filing Window', dept: 'CBDT / Income Tax Portal', urgency: 'High Priority' },
  { date: 'Aug 20, 2026', title: 'GSTR-3B Monthly Return Deadline', dept: 'GST Portal', urgency: 'Important' },
  { date: 'Sep 01, 2026', title: 'MSME Udyam Re-certification Audit', dept: 'Ministry of MSME', urgency: 'Regular' },
  { date: 'Sep 15, 2026', title: 'Passport Tatkaal Slot Quota Update', dept: 'Passport Seva Kendra', urgency: 'Notification' }
];

const FAQS = [
  { q: 'How does EasyDesk ensure document safety?', a: 'All documents uploaded to EasyDesk are stored in encrypted environments, checked exclusively by assigned verification experts, and cleared from processing caches after order completion.' },
  { q: 'Is the Government fee included in the payment?', a: 'Yes! EasyDesk displays a clear break-up of official Government fees and our minimal service consultancy charge. We pay the government on your behalf.' },
  { q: 'How do I place an order for document assistance?', a: 'Browse our catalog, click "Order on WhatsApp", and your pre-filled service inquiry opens directly in WhatsApp. You can discuss requirements and send documents securely to our expert.' },
  { q: 'What happens if a document has errors?', a: 'Our expert officer pre-audits your documents before submission and notifies you on WhatsApp if any corrections are needed at zero additional charge.' }
];

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
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [contactInfo, setContactInfo] = useState(() => {
    try {
      const cached = localStorage.getItem('easydesk_cache_contact_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.companyName) return parsed;
      }
    } catch {}
    return {
      companyName: 'EasyDesk Digital Services Pvt Ltd',
      phone: '+91 98765 43210',
      email: 'support@easydesk.com',
      workingHours: 'Mon - Sat: 9:00 AM - 6:30 PM',
      address: '402, Signature IT Park, Bandra Kurla Complex, Mumbai, MH, 400051'
    };
  });

  const [faqsList, setFaqsList] = useState<{ question: string; answer: string }[]>(() => {
    try {
      const cached = localStorage.getItem('easydesk_cache_faqs');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    const applyContact = (data: any) => {
      if (data && typeof data === 'object') {
        const clean = {
          companyName: data.companyName || 'EasyDesk Digital Services Pvt Ltd',
          phone: data.phone || '+91 98765 43210',
          email: data.email || 'support@easydesk.com',
          workingHours: data.workingHours || 'Mon - Sat: 9:00 AM - 6:30 PM',
          address: data.address || '402, Signature IT Park, Bandra Kurla Complex, Mumbai, MH, 400051'
        };
        setContactInfo(clean);
        try {
          localStorage.setItem('easydesk_cache_contact_settings', JSON.stringify(clean));
        } catch {}
      }
    };

    fetch(`/api/contact-settings?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
      .then(res => res.json())
      .then(data => applyContact(data))
      .catch(() => {});

    // Fetch dynamic FAQs with multi-tier fallback (retains last known real data on failure)
    const loadFaqs = async () => {
      try {
        const res = await fetch(`/api/faqs?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const mapped = data.map((f: any) => ({
              question: f.question || f.q || '',
              answer: f.answer || f.a || ''
            })).filter(f => f.question && f.answer);
            if (mapped.length > 0) {
              setFaqsList(mapped);
              try {
                localStorage.setItem('easydesk_cache_faqs', JSON.stringify(mapped));
              } catch {}
              return;
            }
          }
        }
      } catch {}

      // Authoritative Direct API Fallback
      try {
        if (typeof navigator === 'undefined' || navigator.onLine !== false) {
          const directFaqs = await getClientFaqs();
          if (directFaqs && directFaqs.length > 0) {
            const mapped = directFaqs.map((f: any) => ({
              question: f.question || f.q || '',
              answer: f.answer || f.a || ''
            })).filter(f => f.question && f.answer);
            if (mapped.length > 0) {
              setFaqsList(mapped);
              try {
                localStorage.setItem('easydesk_cache_faqs', JSON.stringify(mapped));
              } catch {}
            }
          }
        }
      } catch {}
    };

    loadFaqs();

    const unsubscribe = onContactSettingsUpdated(applyContact);
    return () => unsubscribe();
  }, []);

  const featuredServices = useMemo(() => services.slice(0, 6), [services]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setView('services');
  };

  const handleServiceDetailsSelect = (id: string) => {
    setSelectedServiceId(id);
    setView('service-details');
  };

  const stats = STATS;
  const trustBadges = TRUST_BADGES;
  const whyChooseFeatures = WHY_CHOOSE_FEATURES;
  const govtEvents = GOVT_EVENTS;
  const faqs = faqsList;

  return (
    <div id="easydesk-home-view" className="font-sans text-slate-900 bg-[#F8FAFC] pb-16 w-full max-w-full overflow-x-hidden">
      
      {/* 1. HERO SECTION (Matching AboutUsView Gradient, Pulse Badge & Motion Entrance) */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/70 via-slate-50 to-white pt-10 pb-16 lg:pb-20 border-b border-slate-200/60">
        
        {/* Subtle Decorative Background Blur Blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full portal-container h-full pointer-events-none overflow-hidden opacity-60">
          <div className="absolute -top-24 -left-20 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -right-20 w-80 h-80 bg-emerald-200/30 rounded-full blur-3xl" />
        </div>

        <div className="portal-container relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Content Column */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-7 space-y-6 text-left"
            >
              
              {/* Top Pulse Badge */}
              <div className="inline-flex items-center gap-2 bg-blue-100/90 border border-blue-200/70 px-4 py-1.5 rounded-full text-xs font-black text-[#0F4C81] shadow-2xs pulse-badge">
                <ShieldCheck className="w-4 h-4 text-[#0F4C81]" />
                <span>Next-Generation Citizen E-Governance & Digital Desk</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12]">
                Your Online Work, <br className="hidden sm:inline" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F4C81] via-blue-600 to-teal-600">
                  Done Easily & Securely
                </span>
              </h1>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl font-normal">
                Get your Government, Education, Business, and Personal Digital certificates assisted by verified filing officers. Fast-track WhatsApp support, 100% transparent pricing, and secure file handling.
              </p>

              {/* Quick Search Widget with Focus Glow */}
              <form onSubmit={handleSearch} className="max-w-xl bg-white rounded-2xl shadow-md border border-slate-200/80 p-2 flex gap-2 items-center hover-glow-blue transition-all duration-300">
                <div className="flex-1 flex items-center gap-2.5 px-3">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    id="hero-service-search"
                    name="search"
                    aria-label="Search services, certificates, and schemes"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Passport, PAN Card, GST, MSME, Income Certificate..."
                    className="w-full text-xs text-slate-900 bg-transparent outline-none placeholder:text-slate-400 font-medium"
                  />
                </div>
                <button
                  id="btn-hero-search"
                  type="submit"
                  className="bg-[#0F4C81] hover:bg-[#0b3b64] text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer active:scale-95 btn-glow-primary"
                >
                  Search
                </button>
              </form>

              {/* CTA Action Buttons */}
              <div className="pt-2 flex flex-wrap gap-3.5 items-center">
                <button
                  onClick={() => openGeneralWhatsApp('Hello EasyDesk, I would like to inquire about digital document services.')}
                  className="bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs px-6 py-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 active:scale-95 btn-glow-emerald hover-scale-sm"
                >
                  <MessageSquare className="w-4 h-4" /> Order on WhatsApp
                </button>
                <button
                  onClick={() => setView('services')}
                  className="bg-[#0F4C81] hover:bg-[#0b3b64] text-white font-bold text-xs px-6 py-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 active:scale-95 btn-glow-primary hover-scale-sm"
                >
                  Browse Services <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('easydesk-ai-contextual-help', {
                      detail: { customPrompt: "Hello! Please guide me on required documents.", autoSend: true }
                    }));
                  }}
                  className="bg-white text-[#0F4C81] border border-slate-200/80 hover:bg-blue-50/80 font-bold text-xs px-5 py-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 hover-lift-sm shadow-2xs"
                >
                  <Bot className="w-4 h-4 text-[#0F4C81]" /> Ask EasyDesk AI
                </button>
              </div>

            </motion.div>

            {/* Right Card Illustration Column (Elevated with Glassmorphism & Hover Glow) */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="lg:col-span-5 relative"
            >
              <div className="border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-xl space-y-4 relative z-10 bg-white/95 backdrop-blur-md hover-glow-blue hover-lift transition-all duration-300">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#0F4C81] to-[#0B2545] text-white flex items-center justify-center font-black text-xs shadow-xs">
                      ED
                    </div>
                    <div>
                      <h3 className="font-extrabold text-xs text-slate-900 m-0">Verified Filing Desk</h3>
                      <p className="text-[10px] text-slate-500 font-medium m-0">Official Govt Portal Sync</p>
                    </div>
                  </div>
                  <span className="badge-soft-success text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Authorized
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="bg-slate-50/90 hover:bg-blue-50/70 p-3.5 rounded-2xl border border-slate-200/60 flex items-center justify-between transition-all hover-scale-sm shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#0F4C81] flex items-center justify-center shrink-0">
                        <FileCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-900 block text-xs">Passport Seva Assistance</span>
                        <span className="text-[10px] text-slate-500 font-medium">Tatkaal & Normal Application Audit</span>
                      </div>
                    </div>
                    <span className="badge-soft-success text-[9px] font-black px-2.5 py-0.5 rounded-full">Active</span>
                  </div>

                  <div className="bg-slate-50/90 hover:bg-blue-50/70 p-3.5 rounded-2xl border border-slate-200/60 flex items-center justify-between transition-all hover-scale-sm shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                        <BadgeCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-900 block text-xs">PAN Card (NSDL / UTIITSL)</span>
                        <span className="text-[10px] text-slate-500 font-medium">New, Correction & e-PAN Instant</span>
                      </div>
                    </div>
                    <span className="badge-soft-success text-[9px] font-black px-2.5 py-0.5 rounded-full">Active</span>
                  </div>

                  <div className="bg-slate-50/90 hover:bg-blue-50/70 p-3.5 rounded-2xl border border-slate-200/60 flex items-center justify-between transition-all hover-scale-sm shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-900 block text-xs">GST & MSME Registration</span>
                        <span className="text-[10px] text-slate-500 font-medium">Corporate Certificate Filing</span>
                      </div>
                    </div>
                    <span className="badge-soft-success text-[9px] font-black px-2.5 py-0.5 rounded-full">Active</span>
                  </div>
                </div>

                {/* Floating Trust Banner inside illustration */}
                <div className="pt-2">
                  <div className="bg-gradient-to-r from-[#0F4C81] to-[#0A3258] text-white p-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-sm hover-scale-sm transition">
                    <div className="flex items-center gap-2.5">
                      <Lock className="w-4 h-4 text-cyan-300" />
                      <span className="font-bold">256-Bit SSL Encrypted Vault</span>
                    </div>
                    <span className="text-[10px] text-blue-200 bg-white/10 border border-white/20 px-2.5 py-0.5 rounded-full font-black">100% Safe</span>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* 2. TRUST SECTION (Matching AboutUs Elevated Badges) */}
      <section className="portal-container -mt-7 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 2xl:gap-5">
          {trustBadges.map((badge, idx) => {
            const Icon = badge.icon;
            return (
              <motion.div 
                key={idx} 
                className="h-full"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.4, delay: idx * 0.08, ease: "easeOut" }}
              >
                <div className="h-full bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover-lift hover-glow-blue transition-all duration-300 flex flex-row items-start gap-3.5 group">
                  <div className="w-9 h-9 rounded-2xl bg-blue-50 text-[#0F4C81] border border-blue-100 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-[#0F4C81] group-hover:text-white transition-colors duration-200 shadow-2xs">
                    <Icon className="w-4 h-4 floating-icon-bounce" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-900 m-0">{badge.title}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 m-0 leading-snug font-normal">{badge.desc}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Live Statistics Bar (Matching AboutUs Metrics Atmosphere) */}
      <section className="portal-container pt-14">
        <motion.div 
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-gradient-to-br from-[#0F4C81] via-[#0D3F6C] to-[#0A3258] text-white rounded-3xl shadow-xl p-7 md:p-9 hover-glow-blue transition-all duration-300 border border-blue-800/40 relative overflow-hidden"
        >
          {/* Subtle background glow */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 2xl:gap-8 relative z-10">
            {stats.map((stat, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 + idx * 0.08 }}
                className="text-center lg:border-r border-white/10 last:border-0 px-3 flex flex-col justify-center hover-scale-sm transition-transform"
              >
                <span className="block text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {stat.value}
                </span>
                <span className="block text-xs font-extrabold text-blue-200 mt-1.5 uppercase tracking-wider">{stat.label}</span>
                <span className="block text-[11px] text-blue-100/80 mt-1 leading-normal max-w-[200px] mx-auto font-normal">{stat.desc}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* 3. SERVICES SECTION */}
      <section className="portal-container pt-20">
        <motion.div 
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45 }}
          className="flex flex-col sm:flex-row justify-between sm:items-end mb-8 gap-4"
        >
          <div>
            <span className="badge-soft-primary px-3.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase inline-block shadow-2xs">
              Directory Catalog
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black mt-2 text-slate-900 tracking-tight">Featured Digital Services</h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">Select a service to inspect government fees, required checklist, and order via WhatsApp.</p>
          </div>
          <button
            onClick={() => setView('services')}
            className="text-[#0F4C81] hover:text-blue-700 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto hover-scale-sm transition bg-blue-50/80 hover:bg-blue-100/80 px-4 py-2 rounded-xl border border-blue-200/60 shadow-2xs"
          >
            Explore all 100+ Services <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 2xl:gap-7">
          {featuredServices.map((service, idx) => (
            <motion.div 
              key={service.id} 
              className="h-full"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.45, delay: idx * 0.08, ease: "easeOut" }}
            >
              <div className="h-full bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-xs hover-lift hover-glow-blue transition-all duration-300 flex flex-col justify-between group">
                <div className="p-6 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="badge-soft-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                      Popularity: {service.popularity}%
                    </span>
                    <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-1 rounded-full">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> {service.processingTime}
                    </span>
                  </div>

                  <h3 
                    onClick={() => handleServiceDetailsSelect(service.id)}
                    className="font-black text-base text-slate-900 mt-4 leading-snug group-hover:text-[#0F4C81] cursor-pointer transition"
                  >
                    {service.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed font-normal">{service.description}</p>
                  
                  {/* Required Documents Checklist */}
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <span className="block text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Required Checklist:</span>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {service.requiredDocuments.slice(0, 3).map((doc, dIdx) => (
                        <span key={dIdx} className="text-[10px] bg-slate-50 hover:bg-blue-50 text-slate-700 px-2.5 py-1 rounded-xl border border-slate-200/70 font-medium transition-colors">
                          ✓ {doc}
                        </span>
                      ))}
                      {service.requiredDocuments.length > 3 && (
                        <span className="text-[10px] text-slate-500 py-1 font-bold">+{service.requiredDocuments.length - 3} more</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price & Action Footer */}
                <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    <span className="block text-[9px] text-slate-500 font-extrabold uppercase leading-none">Starting Price</span>
                    <span className="text-base font-black text-slate-900">₹{service.govFees + service.serviceCharge}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleServiceDetailsSelect(service.id)}
                      className="bg-white border border-slate-200/80 hover:bg-slate-100 text-slate-800 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer hover-scale-sm shadow-2xs"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => openWhatsAppForService(service)}
                      className="bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm btn-glow-emerald hover-scale-sm"
                      title="Order on WhatsApp"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Order
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 4. WHY CHOOSE EASYDESK (Matching AboutUs Core Value Cards) */}
      <section className="portal-container pt-20">
        <motion.div 
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45 }}
          className="text-center max-w-2xl 2xl:max-w-3xl mx-auto mb-12"
        >
          <span className="badge-soft-success px-3.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase inline-block shadow-2xs">Verified Standard</span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black mt-2 text-slate-900 tracking-tight">Why Choose EasyDesk</h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
            We combine expert document auditing, transparent pricing, and direct WhatsApp communication to make your application error-free.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3 gap-6 2xl:gap-8">
          {whyChooseFeatures.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <motion.div 
                key={idx} 
                className="h-full"
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.45, delay: idx * 0.08, ease: "easeOut" }}
              >
                <div className="h-full bg-white p-7 rounded-3xl border border-slate-200/80 shadow-xs hover-lift hover-glow-blue transition-all duration-300 group flex flex-col justify-between">
                  <div>
                    <div className={`w-13 h-13 rounded-2xl flex items-center justify-center ${feat.color} border shadow-2xs floating-icon-bounce`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-black text-base text-slate-900 mt-5 m-0 group-hover:text-[#0F4C81] transition-colors">{feat.title}</h3>
                    <p className="text-xs sm:text-sm text-slate-600 mt-2.5 m-0 leading-relaxed font-normal">{feat.desc}</p>
                  </div>
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-[#0F4C81]">
                    <span>Guaranteed Assistance</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* 5. SECURITY SECTION (Dedicated Premium Section with Dark Navy Background & Glassmorphism) */}
      <section className="portal-container pt-20">
        <motion.div 
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-gradient-to-br from-[#0F4C81] via-[#0B2545] to-[#07192F] text-white rounded-3xl p-7 sm:p-10 lg:p-12 shadow-2xl space-y-8 relative overflow-hidden hover-glow-blue transition-all duration-300 border border-blue-900/50"
        >
          
          {/* Decorative Corner Watermark */}
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl opacity-25 pointer-events-none bg-cyan-400" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none bg-blue-500" />

          {/* Top Security Title */}
          <div className="max-w-3xl space-y-3 relative z-10">
            <span className="bg-white/10 text-cyan-300 border border-cyan-400/30 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 hover-scale-sm shadow-xs">
              <ShieldCheck className="w-4 h-4 text-cyan-300" /> Dedicated Security & Privacy Safeguards
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              100% Document Safety & Government Portal Compliance
            </h2>
            <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed font-normal">
              EasyDesk prioritizes citizen privacy. All files are encrypted during transit and handled exclusively by authorized filing officers.
            </p>
          </div>

          {/* Security Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 2xl:gap-6 relative z-10">
            {[
              {
                icon: Lock,
                title: "256-Bit SSL Encryption",
                desc: "Industrial grade transport encryption for all uploaded PDFs & images.",
                color: "cyan"
              },
              {
                icon: EyeOff,
                title: "Privacy Protection",
                desc: "Strict non-disclosure agreements. We NEVER sell or share data with 3rd parties.",
                color: "emerald"
              },
              {
                icon: ShieldCheck,
                title: "Document Safety",
                desc: "Officer-only access controls and automated data purge upon order delivery.",
                color: "amber"
              },
              {
                icon: Building2,
                title: "Government Compliance",
                desc: "Adherence to official NSDL, Passport Seva, and GST portal filing protocols.",
                color: "purple"
              }
            ].map((item, sIdx) => {
              const SIcon = item.icon;
              const borderHoverColor = item.color === 'cyan' ? 'hover:border-cyan-300' :
                                       item.color === 'emerald' ? 'hover:border-emerald-300' :
                                       item.color === 'amber' ? 'hover:border-amber-300' : 'hover:border-purple-300';
              const iconBg = item.color === 'cyan' ? 'bg-cyan-400/20 border-cyan-400/30 text-cyan-300' :
                             item.color === 'emerald' ? 'bg-emerald-400/20 border-emerald-400/30 text-emerald-300' :
                             item.color === 'amber' ? 'bg-amber-400/20 border-amber-400/30 text-amber-300' : 'bg-purple-400/20 border-purple-400/30 text-purple-300';
              return (
                <motion.div 
                  key={sIdx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.4, delay: 0.1 + sIdx * 0.08 }}
                  className={`h-full bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15 space-y-2.5 hover-lift-sm ${borderHoverColor} transition-all text-white`}
                >
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${iconBg}`}>
                    <SIcon className="w-5 h-5" />
                  </div>
                  <h4 className="font-extrabold text-sm text-white m-0">{item.title}</h4>
                  <p className="text-xs text-blue-100/80 leading-relaxed m-0 font-normal">{item.desc}</p>
                </motion.div>
              );
            })}
          </div>

          {/* CRITICAL RED ALERT CALLOUT BOX ("NEVER ASK FOR") */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="bg-red-950/80 backdrop-blur-md border border-red-500/50 rounded-2xl p-5 sm:p-6 text-red-100 space-y-3 relative z-10 hover-lift-sm transition-all shadow-lg"
          >
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-6 h-6 text-red-400 shrink-0" />
              <h3 className="font-black text-sm text-red-200 uppercase tracking-wider m-0">
                Anti-Fraud Safety Notice — EasyDesk WILL NEVER ASK FOR:
              </h3>
            </div>
            <p className="text-xs text-red-200/90 leading-relaxed m-0 font-normal">
              To protect citizens from scam calls or fake officers, please note that EasyDesk personnel will NEVER request any confidential banking credentials:
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1.5">
              {[
                'Bank OTP',
                'UPI PIN',
                'ATM PIN',
                'Card CVV / Expiry',
                'Net Banking Password'
              ].map((item, iIdx) => (
                <span key={iIdx} className="bg-red-900/90 text-white border border-red-400/60 text-xs font-black px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 hover-scale-sm transition shadow-2xs">
                  <span className="text-red-400 font-black">✕</span> {item}
                </span>
              ))}
            </div>
          </motion.div>

        </motion.div>
      </section>

      {/* 6. EASYDESK AI CHATBOT CARD (Interactive Glassmorphic Container) */}
      <section className="portal-container pt-20">
        <motion.div 
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-white border border-blue-200/80 rounded-3xl p-7 sm:p-9 shadow-xl relative overflow-hidden hover-glow-blue transition-all duration-300"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 badge-soft-primary px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-[#0F4C81]" /> Smart AI Assistant
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight m-0">
                Have Filing Questions? Ask EasyDesk AI
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed m-0 font-normal">
                Get instant, accurate guidance regarding document eligibility, official government fees, processing times, and verification requirements.
              </p>

              {/* Example Prompts */}
              <div className="space-y-2 pt-2">
                <span className="block text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Try asking:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    "What documents are needed for Tatkaal Passport?",
                    "How to correct date of birth in PAN Card?",
                    "Check eligibility for MSME Udyam Certificate",
                    "What is the total fee for GST Registration?"
                  ].map((prompt, pIdx) => (
                    <button
                      key={pIdx}
                      onClick={() => {
                        const evt = new CustomEvent('easydesk-ai-contextual-help', {
                          detail: { customPrompt: prompt, autoSend: true }
                        });
                        window.dispatchEvent(evt);
                      }}
                      className="text-xs bg-slate-50 hover:bg-blue-50 border border-slate-200/80 text-slate-700 px-3.5 py-2 rounded-xl hover:border-blue-400 hover:text-[#0F4C81] transition cursor-pointer text-left font-medium hover-scale-sm shadow-2xs"
                    >
                      "{prompt}"
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    const evt = new CustomEvent('easydesk-ai-contextual-help', {
                      detail: { customPrompt: "Hello! Please guide me on digital certificate applications.", autoSend: true }
                    });
                    window.dispatchEvent(evt);
                  }}
                  className="bg-[#0F4C81] hover:bg-[#0b3b64] text-white font-bold text-xs px-6 py-3.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 active:scale-95 btn-glow-primary hover-scale-sm"
                >
                  <Bot className="w-4 h-4 text-cyan-300" /> Start EasyDesk AI Chat Assistant
                </button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, delay: 0.15 }}
                className="bg-slate-50/90 p-5 rounded-3xl border border-slate-200/80 space-y-4 hover-lift-sm transition-all shadow-xs"
              >
                <div className="flex items-center gap-2.5 border-b border-slate-200/70 pb-3">
                  <div className="w-9 h-9 rounded-2xl bg-[#0F4C81] text-white flex items-center justify-center font-black shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-900 m-0">EasyDesk Smart AI</h4>
                    <p className="text-[10px] text-emerald-600 font-bold m-0 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Support Online
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 text-slate-700 shadow-2xs">
                    <p className="font-black text-[11px] text-[#0F4C81] m-0">EasyDesk AI Officer:</p>
                    <p className="text-xs mt-1 leading-relaxed text-slate-600 m-0 font-normal">
                      Hello! I can analyze document lists, calculate government fees, and guide you through WhatsApp ordering. How can I help you today?
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

          </div>
        </motion.div>
      </section>

      {/* 7. CALENDAR & UPCOMING GOVERNMENT DEADLINES */}
      <section className="portal-container pt-20">
        <motion.div 
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-white border border-slate-200/80 rounded-3xl p-7 sm:p-9 shadow-sm space-y-6 hover-glow-blue transition-all duration-300"
        >
          <div className="flex flex-col sm:flex-row justify-between sm:items-end border-b border-slate-100 pb-5 gap-3">
            <div>
              <span className="badge-soft-purple px-3.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase inline-block shadow-2xs">
                Government Compliance Calendar
              </span>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black mt-2 text-slate-900 flex items-center gap-2.5 m-0 tracking-tight">
                <Calendar className="w-6 h-6 text-[#0F4C81]" /> Upcoming Important Deadlines & Notifications
              </h2>
            </div>
            <button 
              onClick={() => setView('contact')}
              className="text-xs font-black text-[#0F4C81] hover:underline cursor-pointer flex items-center gap-1"
            >
              Get Reminder Alerts <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 2xl:gap-6">
            {govtEvents.map((evt, eIdx) => (
              <motion.div 
                key={eIdx} 
                className="h-full"
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.4, delay: eIdx * 0.08, ease: "easeOut" }}
              >
                <div className="h-full bg-slate-50/90 p-5 rounded-2xl border border-slate-200/80 space-y-3 flex flex-col justify-between hover-lift hover:border-blue-300 transition-all duration-200 group">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="badge-soft-primary px-3 py-0.5 rounded-full text-[10px] font-black">
                        {evt.date}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black ${
                        evt.urgency === 'High Priority' ? 'badge-soft-danger' : 'badge-soft-warning'
                      }`}>
                        {evt.urgency}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 mt-3 leading-snug group-hover:text-[#0F4C81] transition-colors">{evt.title}</h4>
                    <p className="text-[11px] text-slate-500 mt-1 m-0 font-normal">{evt.dept}</p>
                  </div>
                  <button
                    onClick={() => openGeneralWhatsApp(`Inquiry regarding deadline: ${evt.title}`)}
                    className="text-xs font-black text-[#0F4C81] hover:text-blue-700 mt-2 text-left flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#10B981]" /> Order on WhatsApp →
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* 8. VERIFIED REVIEWS (Matching AboutUs Testimonial Refinement) */}
      <section className="portal-container pt-20">
        <motion.div 
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10"
        >
          <div>
            <span className="badge-soft-warning px-3.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase inline-block shadow-2xs">Verified Feedback</span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black mt-2 text-slate-900 tracking-tight">What Our Customers Say</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5">Real ratings submitted by citizens and verified against service orders.</p>
          </div>
          <button
            onClick={() => setIsReviewModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F4C81] hover:bg-[#0c3e69] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer self-start sm:self-auto btn-glow-primary hover-scale-sm"
          >
            <Edit3 className="w-4 h-4 text-cyan-300" /> Write a Review
          </button>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 2xl:grid-cols-3 gap-6 2xl:gap-8">
          {reviews.map((rev, idx) => (
            <motion.div 
              key={rev.id} 
              className="h-full"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.45, delay: idx * 0.08, ease: "easeOut" }}
            >
              <div className="h-full bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-sm hover-lift hover-glow-blue transition-all duration-300 flex flex-col justify-between group">
                <div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 italic mt-4 leading-relaxed font-normal">"{rev.comment || rev.reviewText}"</p>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 m-0">{rev.userName || rev.customerName}</h4>
                    {(rev.serviceTitle || rev.serviceName) && (
                      <span className="text-[10px] text-slate-500 font-medium block mt-0.5">{rev.serviceTitle || rev.serviceName}</span>
                    )}
                  </div>
                  {rev.isVerified && (
                    <span className="badge-soft-success px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                      Verified
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Review Submission Popup Modal */}
        <ReviewSubmissionModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
        />
      </section>

      {/* 9. BLOGS & ARTICLES */}
      <section className="portal-container pt-20">
        <motion.div 
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45 }}
          className="flex justify-between items-end mb-8"
        >
          <div>
            <span className="badge-soft-primary px-3.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase inline-block shadow-2xs">
              INSIGHTS & GUIDES
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black mt-2 text-slate-900 tracking-tight">
              Filing Guides & Knowledge Hub
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5">Practical instructions and government document filing updates.</p>
          </div>
          <button
            onClick={() => setView('blogs')}
            className="text-[#0F4C81] hover:text-blue-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer bg-slate-50 hover:bg-blue-50 px-4 py-2.5 rounded-xl border border-slate-200/80 transition hover-scale-sm shadow-2xs"
          >
            <span>All Guides</span> <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 2xl:gap-8">
          {blogs.slice(0, 3).map((blog, idx) => (
            <motion.div 
              key={blog.id} 
              className="h-full"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.45, delay: idx * 0.1, ease: "easeOut" }}
            >
              <BlogCard
                blog={blog}
                blogCategories={blogCategories}
                onSelect={() => setView('blogs')}
              />
            </motion.div>
          ))}
        </div>
      </section>

      {/* 10. SUPPORT FAQS ACCORDION */}
      <section id="faq-section" className="max-w-4xl 2xl:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 pt-20">
        <motion.div 
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45 }}
          className="text-center mb-10"
        >
          <span className="badge-soft-primary px-3.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase inline-block shadow-2xs">Need Assistance?</span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black mt-2 text-slate-900 tracking-tight">Frequently Asked Questions</h2>
        </motion.div>

        <div className="space-y-3.5">
          {faqs.map((faq, idx) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.35, delay: idx * 0.05, ease: "easeOut" }}
              className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs hover-glow-blue transition-all duration-200"
            >
              <button
                onClick={() => setOpenFaqIdx(openFaqIdx === idx ? null : idx)}
                className="w-full text-left p-4 sm:p-5 flex justify-between items-center text-xs sm:text-sm font-extrabold text-slate-900 hover:bg-slate-50 transition cursor-pointer"
              >
                <span>{faq.q}</span>
                <HelpCircle className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${openFaqIdx === idx ? 'rotate-180 text-[#0F4C81]' : ''}`} />
              </button>
              {openFaqIdx === idx && (
                <div className="px-4 sm:px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3.5 animate-in fade-in duration-200 font-normal">
                  {faq.a}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* 11. CONTACT & LOCATION CARD (Matching AboutUs Split Card Aesthetics) */}
      <section id="contact-section" className="portal-container pt-20">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xl hover-glow-blue transition-all duration-300"
        >
          <div className="grid grid-cols-1 md:grid-cols-2">
            
            {/* Office details */}
            <div className="bg-gradient-to-br from-[#0F4C81] to-[#092B4C] p-7 sm:p-9 lg:p-11 text-white flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none bg-cyan-400" />
              
              <div className="relative z-10">
                <span className="text-[10px] bg-white/10 border border-white/20 px-3.5 py-1 rounded-full font-black uppercase tracking-wider text-cyan-300 inline-block shadow-2xs">
                  Contact Help Desk
                </span>
                <h3 className="text-2xl sm:text-3xl font-black mt-4 text-white tracking-tight leading-tight">We are here to support your applications</h3>
                <p className="text-xs sm:text-sm text-blue-100/90 mt-2.5 leading-relaxed font-normal">
                  Reach out directly via phone or WhatsApp. Visit our digital workspace during business hours for rapid offline documentation clearances.
                </p>
                
                <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-3.5 hover-scale-sm transition">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4 text-cyan-300" />
                    </div>
                    <div>
                      <span className="block text-[10px] text-blue-200 font-extrabold uppercase leading-none">Support Hotline</span>
                      <span className="text-xs sm:text-sm font-black text-white mt-0.5 block">{contactInfo.phone}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3.5 hover-scale-sm transition">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4 text-cyan-300" />
                    </div>
                    <div>
                      <span className="block text-[10px] text-blue-200 font-extrabold uppercase leading-none">Official Inquiry Email</span>
                      <span className="text-xs sm:text-sm font-black text-white mt-0.5 block">{contactInfo.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3.5 hover-scale-sm transition">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                      <Clock4 className="w-4 h-4 text-cyan-300" />
                    </div>
                    <div>
                      <span className="block text-[10px] text-blue-200 font-extrabold uppercase leading-none">Office Timings</span>
                      <span className="text-xs sm:text-sm font-black text-white mt-0.5 block">{contactInfo.workingHours}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/10 mt-8 flex items-center gap-2.5 relative z-10">
                <MapPin className="w-4 h-4 text-cyan-300 shrink-0" />
                <p className="text-xs text-blue-100/90 m-0 font-normal">{contactInfo.address}</p>
              </div>
            </div>

            {/* Message Form */}
            <div className="p-7 sm:p-9 lg:p-11">
              <h4 className="font-black text-lg text-slate-900">Leave a Message</h4>
              <p className="text-xs text-slate-600 mt-1 font-normal">Our customer experience officer will resolve queries within 15 minutes.</p>

              {contactSubmitted ? (
                <div className="mt-6 bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center space-y-2">
                  <Check className="w-10 h-10 text-emerald-600 mx-auto bg-emerald-100 p-2 rounded-full" />
                  <h5 className="font-black text-sm text-slate-900 mt-2">Message Sent Successfully</h5>
                  <p className="text-xs text-slate-600 font-normal">Thank you! Our filing expert will review and get back to you shortly.</p>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); setContactSubmitted(true); }} className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="home-contact-name" className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Your Name</label>
                    <input
                      id="home-contact-name"
                      name="name"
                      type="text"
                      required
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      placeholder="Enter full name"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 focus:outline-none input-focus-glow mt-1"
                    />
                  </div>
                  <div>
                    <label htmlFor="home-contact-email" className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Email Address</label>
                    <input
                      id="home-contact-email"
                      name="email"
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="name@email.com"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 focus:outline-none input-focus-glow mt-1"
                    />
                  </div>
                  <div>
                    <label htmlFor="home-contact-message" className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Message</label>
                    <textarea
                      id="home-contact-message"
                      name="message"
                      required
                      rows={3}
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      placeholder="How can we help you today?"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 focus:outline-none input-focus-glow mt-1"
                    />
                  </div>
                  <button
                    id="btn-contact-submit"
                    type="submit"
                    className="w-full bg-[#0F4C81] hover:bg-[#0b3b64] text-white font-bold text-xs py-3.5 rounded-xl transition-all cursor-pointer active:scale-95 shadow-md btn-glow-primary hover-scale-sm"
                  >
                    Send Message
                  </button>
                </form>
              )}
            </div>

          </div>
        </motion.div>
      </section>

    </div>
  );
}


