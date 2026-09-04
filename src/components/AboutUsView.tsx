import React, { useState, useEffect } from 'react';
import { 
  Building2, ShieldCheck, Zap, Lock, Heart, Layers, 
  CheckCircle2, MapPin, Users, FileText, 
  Award, Download, Mail, ExternalLink, MessageSquare,
  Sparkles, ArrowRight, Compass, Target, Shield, Clock,
  ChevronRight, PhoneCall, Check, Star, Globe2, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FAQItem } from '../types.js';
import { openGeneralWhatsApp } from '../lib/whatsapp.js';
import { safeParseJsonResponse } from '../lib/apiClient.js';
import { getClientAboutUs } from '../lib/apiDataService.js';

interface AboutUsData {
  aboutText: string;
  vision: string;
  mission: string;
  coreValues: Array<{ title: string; description: string; icon?: string }>;
  whyChooseUs: Array<{ title: string; description: string; icon?: string }>;
  howItWorks: Array<{ step: number; title: string; description: string }>;
  achievements: Array<{ number: string; label: string }>;
  serviceAreas: string[];
  gallery?: string[];
  videos?: Array<{ title: string; url: string }>;
  publicDocuments?: Array<{ title: string; url: string; category?: string }>;
  faqs?: FAQItem[];
  teamStats?: {
    teamDescription?: string;
    description?: string;
    approximateEmployeeCount?: number;
    employeeCount?: number;
    trainedQualifiedCount?: number;
    trainedEmployeeCount?: number;
    combinedExperienceYears?: number;
    officesCount?: number;
  };
}

interface FounderData {
  name: string;
  designation: string;
  photoUrl: string;
  shortBio: string;
  detailedBio: string;
  founderMessage: string;
  signatureUrl?: string;
  email: string;
  socialLinks?: { linkedin?: string; twitter?: string; facebook?: string };
}

const DEFAULT_CORE_VALUES = [
  {
    title: 'Zero Queue Guarantee',
    description: 'We believe government and civic paperwork should take minutes from your phone, never hours in physical lines.',
    icon: 'Zap'
  },
  {
    title: '100% Data Confidentiality',
    description: 'Bank-grade encryption safeguards all identity documents, purged automatically after order fulfillment.',
    icon: 'Lock'
  },
  {
    title: 'Certified Desk Officers',
    description: 'Every application is audited by licensed legal and revenue documentation specialists before submission.',
    icon: 'ShieldCheck'
  },
  {
    title: 'Transparent Flat Pricing',
    description: 'Fixed government statutory fees with zero hidden middleman commissions or unverified surcharges.',
    icon: 'Heart'
  }
];

const DEFAULT_WHY_CHOOSE = [
  { title: 'End-to-End Tracking', description: 'Real-time SMS, WhatsApp, and live web portal milestone alerts for your applications.' },
  { title: 'Pre-Submission Audit', description: 'Double verification prevents rejections and saves weeks of government re-filing.' },
  { title: 'Doorstep Courier Dispatch', description: 'Original attested physical certificates and cards delivered straight to your home.' },
  { title: 'Dedicated Helpdesk', description: 'Direct telephonic and WhatsApp support by dedicated relationship managers.' }
];

const DEFAULT_HOW_IT_WORKS = [
  { step: 1, title: 'Select Service & Fill Form', description: 'Choose your desired service and fill in basic details within 2 minutes.' },
  { step: 2, title: 'Upload Scanned Documents', description: 'Securely upload ID proofs and required certificates through our portal.' },
  { step: 3, title: 'Desk Officer Verification', description: 'Our legal team verifies all requirements against official government norms.' },
  { step: 4, title: 'Filing & Certificate Delivery', description: 'Official filing processed and digitally signed certificate delivered to you.' }
];

const DEFAULT_SERVICE_AREAS = [
  'National Capital Region (Delhi NCR)',
  'Maharashtra (Mumbai, Pune, Nagpur)',
  'Karnataka (Bengaluru, Mysuru)',
  'Uttar Pradesh (Noida, Lucknow, Kanpur)',
  'Gujarat (Ahmedabad, Surat, Vadodara)',
  'Tamil Nadu (Chennai, Coimbatore)',
  'Telangana & Andhra Pradesh',
  'Pan-India E-Governance Support'
];

const DEFAULT_FOUNDER: FounderData = {
  name: 'Devendra Sharma',
  designation: 'Founder & Managing Director',
  photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
  shortBio: 'Pioneering accessible digital documentation assistance for citizens and enterprises across India with a focus on speed, precision, and trust.',
  detailedBio: 'Devendra founded EasyDesk with a clear vision: to ensure no citizen ever loses a day of work standing in government service queues. With extensive expertise in public administration workflows and digital identity systems, he spearheads the company\'s nationwide documentation assistance network.',
  founderMessage: 'Welcome to EasyDesk. Our mission is to transform how Indians interact with digital governance and document filings. By combining intelligent document pre-auditing with dedicated human desk verification, we guarantee accuracy, privacy, and expedited delivery for every applicant.',
  email: 'founder@easydesk.com',
  signatureUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=200',
  socialLinks: {
    linkedin: 'https://linkedin.com/company/easydesk',
    twitter: 'https://twitter.com/easydesk'
  }
};

const DEFAULT_ABOUT_DATA: AboutUsData = {
  aboutText: 'EasyDesk is India\'s premier commercial digital service desk platform. We simplify complex government applications, educational documentation, corporate registrations, and personal identity paperwork through verified desk assistance and transparent processing.',
  vision: 'To empower every citizen and small business with effortless, transparent, and paperless digital documentation services across India.',
  mission: 'To eliminate physical queue delays through automated document audits, step-by-step guidance, and verified desk officers.',
  coreValues: DEFAULT_CORE_VALUES,
  whyChooseUs: DEFAULT_WHY_CHOOSE,
  howItWorks: DEFAULT_HOW_IT_WORKS,
  achievements: [
    { number: '1,50,000+', label: 'Applications Completed' },
    { number: '99.4%', label: 'First-Time Approval Rate' },
    { number: '100+', label: 'Services Offered' },
    { number: '4.9 / 5', label: 'Citizen Rating' }
  ],
  serviceAreas: DEFAULT_SERVICE_AREAS,
  teamStats: {
    employeeCount: 45,
    approximateEmployeeCount: 45,
    trainedEmployeeCount: 40,
    trainedQualifiedCount: 40,
    combinedExperienceYears: 120,
    description: 'A dedicated team of qualified document verification specialists, desk officers, and compliance advisors operating pan-India.',
    teamDescription: 'A dedicated team of qualified document verification specialists, desk officers, and compliance advisors operating pan-India.'
  }
};

export default function AboutUsView({ setView }: { setView: (v: string) => void }) {
  const [aboutData, setAboutData] = useState<AboutUsData>(() => {
    try {
      const cached = localStorage.getItem('easydesk_cache_about_us');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.story || parsed.coreValues || parsed.whyChooseUs)) return parsed;
      }
    } catch {}
    return DEFAULT_ABOUT_DATA;
  });
  const [founder, setFounder] = useState<FounderData>(() => {
    try {
      const cached = localStorage.getItem('easydesk_cache_founder');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.name) return parsed;
      }
    } catch {}
    return DEFAULT_FOUNDER;
  });
  const [loading, setLoading] = useState(false);
  const [activeValueIndex, setActiveValueIndex] = useState<number | null>(0);
  const [activeStepHover, setActiveStepHover] = useState<number | null>(null);
  const [searchArea, setSearchArea] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchAboutData = async () => {
      try {
        const res = await fetch(`/api/about?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        if (res.ok) {
          const data = await safeParseJsonResponse<any>(res);
          if (data && data.aboutUs && isMounted) {
            setAboutData(data.aboutUs);
            try {
              localStorage.setItem('easydesk_cache_about_us', JSON.stringify(data.aboutUs));
            } catch {}
            if (data.founder) {
              setFounder(data.founder);
              try {
                localStorage.setItem('easydesk_cache_founder', JSON.stringify(data.founder));
              } catch {}
            }
            return;
          }
        }
      } catch (err: any) {
        if (typeof navigator === 'undefined' || navigator.onLine !== false) {
          console.warn('Failed to load About Us content via API:', err?.message || err);
        }
      }

      // Authoritative Direct API Fallback
      try {
        if (typeof navigator === 'undefined' || navigator.onLine !== false) {
          const directAbout = await getClientAboutUs();
          if (isMounted) {
            if (directAbout.aboutUs) {
              setAboutData(directAbout.aboutUs);
              try {
                localStorage.setItem('easydesk_cache_about_us', JSON.stringify(directAbout.aboutUs));
              } catch {}
            }
            if (directAbout.founder) {
              setFounder(directAbout.founder);
              try {
                localStorage.setItem('easydesk_cache_founder', JSON.stringify(directAbout.founder));
              } catch {}
            }
          }
        }
      } catch (fsErr: any) {
        if (typeof navigator === 'undefined' || navigator.onLine !== false) {
          console.warn('Failed to load direct fallback About Us:', fsErr?.message || fsErr);
        }
      }
    };

    fetchAboutData();
    return () => { isMounted = false; };
  }, []);


  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-[#0F4C81] border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-xs font-mono">Loading EasyDesk About Us Experience...</p>
      </div>
    );
  }

  const coreValues = (aboutData?.coreValues && aboutData.coreValues.length > 0) 
    ? aboutData.coreValues 
    : DEFAULT_CORE_VALUES;

  const whyChooseUs = (aboutData?.whyChooseUs && aboutData.whyChooseUs.length > 0) 
    ? aboutData.whyChooseUs 
    : DEFAULT_WHY_CHOOSE;

  const howItWorks = (aboutData?.howItWorks && aboutData.howItWorks.length > 0) 
    ? aboutData.howItWorks 
    : DEFAULT_HOW_IT_WORKS;

  const serviceAreas = (aboutData?.serviceAreas && aboutData.serviceAreas.length > 0) 
    ? aboutData.serviceAreas 
    : DEFAULT_SERVICE_AREAS;

  const filteredAreas = serviceAreas.filter(area => 
    area.toLowerCase().includes(searchArea.toLowerCase())
  );

  const teamStats = aboutData?.teamStats || {
    approximateEmployeeCount: 48,
    trainedQualifiedCount: 42,
    combinedExperienceYears: 120,
    officesCount: 6,
    teamDescription: 'Our certified desk officers, legal documentation auditors, and technology engineers are dedicated to making citizen services effortless, transparent, and prompt.'
  };

  return (
    <div className="font-sans pb-12 text-slate-900 w-full max-w-full overflow-x-hidden">
      
      {/* =========================================================================
          1. HERO HEADER SECTION (Bootstrap Jumbotron + Motion Animation)
          ========================================================================= */}
      <section className="relative py-12 lg:py-16 overflow-hidden bg-gradient-to-b from-blue-50/70 via-slate-50 to-white border-b border-slate-200/60">
        {/* Subtle Decorative Background Blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full portal-container h-full pointer-events-none overflow-hidden opacity-60">
          <div className="absolute -top-24 -left-20 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -right-20 w-80 h-80 bg-emerald-200/30 rounded-full blur-3xl" />
        </div>

        <div className="portal-container relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-5">
            
            {/* Top Pill Badge */}
            <motion.div 
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100/90 text-[#0F4C81] border border-blue-200/60 text-xs font-extrabold shadow-2xs pulse-badge"
            >
              <Building2 className="w-3.5 h-3.5 text-[#0F4C81]" />
              <span>Next-Generation Citizen E-Governance & Digital Desk</span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15]"
            >
              Empowering Citizens with <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F4C81] via-blue-600 to-teal-600">
                Fast, Transparent & Verified
              </span> Services
            </motion.h1>

            {/* Description */}
            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed"
            >
              {aboutData?.aboutText || 
                'EasyDesk revolutionizes government applications, legal affidavits, and corporate documentation across India through streamlined online workflows, automated audit checks, and verified expert desk personnel.'}
            </motion.p>

            {/* Key Micro Metric Badges */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="pt-4 flex flex-wrap justify-center items-center gap-3 text-xs"
            >
              <div className="hover-lift-sm bg-white/90 backdrop-blur-xs border border-slate-200 rounded-2xl px-4 py-2.5 shadow-2xs flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="block font-black text-slate-900">10,000+</span>
                  <span className="text-[11px] text-slate-500 font-medium">Services Delivered</span>
                </div>
              </div>

              <div className="hover-lift-sm bg-white/90 backdrop-blur-xs border border-slate-200 rounded-2xl px-4 py-2.5 shadow-2xs flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="block font-black text-slate-900">99.8%</span>
                  <span className="text-[11px] text-slate-500 font-medium">Approval Accuracy</span>
                </div>
              </div>

              <div className="hover-lift-sm bg-white/90 backdrop-blur-xs border border-slate-200 rounded-2xl px-4 py-2.5 shadow-2xs flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="block font-black text-slate-900">24-48 Hours</span>
                  <span className="text-[11px] text-slate-500 font-medium">Average Processing</span>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Main Content Body */}
      <div className="portal-container pt-12 space-y-20">

        {/* =========================================================================
            2. VISION & MISSION CARDS (Bootstrap Cards with 3D Hover & Glow)
            ========================================================================= */}
        <section className="space-y-4">
          <div className="text-center max-w-xl mx-auto">
            <span className="text-xs text-[#0F4C81] font-bold uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">
              Guiding Principles
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
              Our Vision & Mission
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 pt-2">
            
            {/* Vision Card */}
            <motion.div 
              whileHover={{ y: -6 }}
              className="hover-lift hover-glow-blue relative overflow-hidden bg-gradient-to-br from-[#0F4C81] to-[#0A3258] text-white p-8 rounded-3xl shadow-lg border border-blue-800/40 group"
            >
              {/* Corner Watermark Graphic */}
              <div className="absolute -right-8 -bottom-8 opacity-10 text-white group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                <Compass className="w-48 h-48" />
              </div>

              <div className="relative z-10 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white text-2xl shadow-inner group-hover:rotate-6 group-hover:scale-110 transition-all duration-300">
                  <Compass className="w-7 h-7 text-blue-200" />
                </div>
                
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-200 block">
                    Long-Term Horizon
                  </span>
                  <h3 className="text-2xl font-black text-white mt-1">Our Vision</h3>
                </div>

                <p className="text-sm sm:text-base text-blue-100/90 leading-relaxed">
                  {aboutData?.vision || 
                    'To empower every citizen, entrepreneur, and family across India with effortless, paperless, and completely transparent digital service desk accessibility at their fingertips.'}
                </p>

                <div className="pt-2 flex items-center gap-2 text-xs font-bold text-blue-200">
                  <span>Zero Physical Queues</span>
                  <span>•</span>
                  <span>100% Pan-India Accessibility</span>
                </div>
              </div>
            </motion.div>

            {/* Mission Card */}
            <motion.div 
              whileHover={{ y: -6 }}
              className="hover-lift hover-glow-emerald relative overflow-hidden bg-white p-8 rounded-3xl shadow-sm border border-slate-200 group"
            >
              {/* Corner Watermark Graphic */}
              <div className="absolute -right-8 -bottom-8 opacity-5 text-emerald-600 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                <Target className="w-48 h-48" />
              </div>

              <div className="relative z-10 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-emerald-600 text-2xl shadow-2xs group-hover:-rotate-6 group-hover:scale-110 transition-all duration-300">
                  <Target className="w-7 h-7 text-emerald-600" />
                </div>

                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 block">
                    Our Daily Commitment
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">Our Mission</h3>
                </div>

                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  {aboutData?.mission || 
                    'To eliminate administrative friction through automated document validation, step-by-step citizen assistance, transparent statutory rates, and dedicated desk officers.'}
                </p>

                <div className="pt-2 flex items-center gap-2 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Licensed Verification Specialists On Every Order</span>
                </div>
              </div>
            </motion.div>

          </div>
        </section>

        {/* =========================================================================
            3. FOUNDER SPOTLIGHT & EXECUTIVE MESSAGE (Bootstrap Media Card with Hover)
            ========================================================================= */}
        {founder && (
          <section className="space-y-4">
            <div className="text-center max-w-xl mx-auto">
              <span className="text-xs text-[#0F4C81] font-bold uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">
                Executive Leadership
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                Leadership Spotlight & Founder's Message
              </h2>
            </div>

            <motion.div 
              whileHover={{ y: -4 }}
              className="hover-lift bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-10 shadow-sm relative overflow-hidden"
            >
              {/* Subtle accent corner glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -z-10" />

              <div className="grid md:grid-cols-12 gap-8 items-center">
                
                {/* Founder Photo & Quick Social Info */}
                <div className="md:col-span-4 text-center space-y-4">
                  <div className="relative inline-block group">
                    <div className="w-48 h-48 sm:w-52 sm:h-52 mx-auto rounded-3xl overflow-hidden border-4 border-blue-50 shadow-md group-hover:border-[#0F4C81] transition-all duration-300">
                      <img 
                        src={founder.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'} 
                        alt={founder.name} 
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover-zoom"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400';
                        }}
                      />
                    </div>
                    {/* Floating verified badge */}
                    <div className="absolute bottom-2 right-2 bg-[#0F4C81] text-white p-2 rounded-2xl shadow-md border-2 border-white">
                      <Award className="w-4 h-4 text-amber-300" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-slate-900">{founder.name}</h3>
                    <p className="text-xs font-bold text-[#0F4C81]">{founder.designation}</p>
                    {founder.shortBio && (
                      <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto italic">
                        "{founder.shortBio}"
                      </p>
                    )}
                  </div>

                  {/* Contact & Social Links */}
                  <div className="flex flex-wrap justify-center items-center gap-2 pt-1">
                    {founder.email && (
                      <a 
                        href={`mailto:${founder.email}`} 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-[#0F4C81] text-xs font-bold transition"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Email Desk</span>
                      </a>
                    )}
                    {founder.socialLinks?.linkedin && (
                      <a 
                        href={founder.socialLinks.linkedin} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0F4C81] text-xs font-bold transition"
                      >
                        <span>LinkedIn</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Founder Message & Detailed Bio */}
                <div className="md:col-span-8 space-y-5 text-left border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8">
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-[#0F4C81] uppercase tracking-widest bg-blue-100/70 text-[#0F4C81] px-3 py-1 rounded-full">
                      Founder's Note to Citizens
                    </span>
                    <span className="text-xs text-slate-400 font-medium">Official Dispatch</span>
                  </div>

                  <blockquote className="text-base sm:text-lg text-slate-800 italic leading-relaxed border-l-4 border-[#0F4C81] pl-4 py-1.5 bg-slate-50/60 rounded-r-2xl">
                    "{founder.founderMessage || 
                      'Our mission with EasyDesk was born out of a simple observation: citizens should not have to sacrifice productive workdays waiting in physical government office lines when technology can verify and file documents with precision and speed.'}"
                  </blockquote>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                    {founder.detailedBio || 
                      'Deepak brings over a decade of hands-on experience in public administration, digital governance frameworks, and citizen service operations. Under his guidance, EasyDesk has expanded from a regional assistance counter into a nationwide technology-driven service portal servicing thousands of citizens every month with guaranteed transparency.'}
                  </p>

                  {/* Official Signature */}
                  {founder.signatureUrl && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Authorized Signatory</span>
                        <span className="text-xs font-bold text-slate-700">{founder.name}</span>
                      </div>
                      <img 
                        src={founder.signatureUrl} 
                        alt={`${founder.name}'s Signature`} 
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="h-10 max-w-[140px] object-contain opacity-85 hover:opacity-100 transition" 
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                </div>

              </div>
            </motion.div>
          </section>
        )}

        {/* =========================================================================
            4. CORE VALUES SECTION (Bootstrap Card Grid with Interactive Hover)
            ========================================================================= */}
        <section className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs text-[#0F4C81] font-bold uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">
              What Defines Us
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Our Core Operational Values
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Every document we verify and submit adheres to these uncompromising standards.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {coreValues.map((value, idx) => {
              const isSelected = activeValueIndex === idx;
              return (
                <motion.div
                  key={idx}
                  whileHover={{ y: -6 }}
                  onClick={() => setActiveValueIndex(idx)}
                  className={`hover-lift cursor-pointer rounded-3xl p-6 transition-all duration-300 relative overflow-hidden ${
                    isSelected 
                      ? 'bg-white border-2 border-[#0F4C81] shadow-md ring-4 ring-blue-50' 
                      : 'bg-white border border-slate-200/80 shadow-2xs hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl transition-all duration-300 ${
                      isSelected 
                        ? 'bg-[#0F4C81] text-white shadow-sm scale-105' 
                        : 'bg-blue-50 text-[#0F4C81] group-hover:bg-blue-100'
                    }`}>
                      {idx === 0 ? <Zap className="w-5 h-5" /> :
                       idx === 1 ? <Lock className="w-5 h-5" /> :
                       idx === 2 ? <ShieldCheck className="w-5 h-5" /> :
                                   <Heart className="w-5 h-5" />}
                    </div>

                    <span className="text-[11px] font-extrabold text-slate-400 font-mono">
                      0{idx + 1}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-slate-900 mb-2">
                    {value.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {value.description}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-[#0F4C81]">
                    <span>Standard Verified</span>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* =========================================================================
            5. PROFESSIONAL TEAM & OPERATIONAL METRICS (Bootstrap Stats Suite)
            ========================================================================= */}
        <section className="space-y-6">
          <motion.div 
            whileHover={{ y: -3 }}
            className="hover-lift bg-gradient-to-br from-slate-900 via-[#0F4C81] to-[#0A3258] text-white rounded-3xl p-8 sm:p-12 shadow-xl border border-blue-900/50 relative overflow-hidden"
          >
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 text-center max-w-3xl mx-auto space-y-4">
              <span className="text-[11px] font-black uppercase tracking-widest bg-white/10 text-blue-200 px-3.5 py-1 rounded-full backdrop-blur-xs">
                Operational Backbone
              </span>
              
              <h2 className="text-2xl sm:text-4xl font-black text-white">
                Our Professional Team & Execution Force
              </h2>

              <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed">
                {teamStats.teamDescription || teamStats.description}
              </p>

              {/* 4-Column Stat Grid with Hover Animations */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
                
                <div className="hover-lift-sm bg-white/10 backdrop-blur-md border border-white/15 p-5 rounded-2xl text-center group">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-white/15 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                    <Users className="w-5 h-5 text-blue-200" />
                  </div>
                  <span className="block text-3xl sm:text-4xl font-black text-white">
                    {teamStats.approximateEmployeeCount || teamStats.employeeCount || 48}+
                  </span>
                  <span className="text-xs font-bold text-blue-200 mt-1 block">Desk Personnel</span>
                  <span className="text-[10px] text-blue-300/80 block mt-0.5">Active Specialists</span>
                </div>

                <div className="hover-lift-sm bg-white/10 backdrop-blur-md border border-white/15 p-5 rounded-2xl text-center group">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-400/20 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                    <ShieldCheck className="w-5 h-5 text-emerald-300" />
                  </div>
                  <span className="block text-3xl sm:text-4xl font-black text-emerald-300">
                    {teamStats.trainedQualifiedCount || teamStats.trainedEmployeeCount || 42}+
                  </span>
                  <span className="text-xs font-bold text-blue-200 mt-1 block">Certified Auditors</span>
                  <span className="text-[10px] text-blue-300/80 block mt-0.5">Legal & E-Gov Certified</span>
                </div>

                <div className="hover-lift-sm bg-white/10 backdrop-blur-md border border-white/15 p-5 rounded-2xl text-center group">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-amber-400/20 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                    <Award className="w-5 h-5 text-amber-300" />
                  </div>
                  <span className="block text-3xl sm:text-4xl font-black text-amber-300">
                    {teamStats.combinedExperienceYears || 120}+ Yrs
                  </span>
                  <span className="text-xs font-bold text-blue-200 mt-1 block">Combined Experience</span>
                  <span className="text-[10px] text-blue-300/80 block mt-0.5">In Public Filings</span>
                </div>

                <div className="hover-lift-sm bg-white/10 backdrop-blur-md border border-white/15 p-5 rounded-2xl text-center group">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-teal-400/20 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                    <Building2 className="w-5 h-5 text-teal-200" />
                  </div>
                  <span className="block text-3xl sm:text-4xl font-black text-teal-300">
                    {teamStats.officesCount || 6}
                  </span>
                  <span className="text-xs font-bold text-blue-200 mt-1 block">Support Hubs</span>
                  <span className="text-[10px] text-blue-300/80 block mt-0.5">Major Metro Branches</span>
                </div>

              </div>

            </div>
          </motion.div>
        </section>

        {/* =========================================================================
            6. WHY CHOOSE EASYDESK & STEP-BY-STEP PROCESS JOURNEY
            ========================================================================= */}
        <section className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Why Choose EasyDesk */}
          <div className="lg:col-span-6 bg-white border border-slate-200/80 rounded-3xl p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0F4C81] flex items-center justify-center">
                <Star className="w-5 h-5 text-[#0F4C81]" />
              </div>
              <div>
                <span className="text-[10px] text-[#0F4C81] font-bold uppercase tracking-wider block">Service Advantage</span>
                <h3 className="text-xl font-black text-slate-900">Why Citizens Choose EasyDesk</h3>
              </div>
            </div>

            <div className="space-y-4">
              {whyChooseUs.map((item: any, idx: number) => {
                const itemTitle = typeof item === 'string' ? item : item.title;
                const itemDesc = typeof item === 'string' ? 'Verified desk service execution' : item.description;
                return (
                  <motion.div 
                    key={idx}
                    whileHover={{ x: 4 }}
                    className="hover-lift-sm p-4 rounded-2xl bg-slate-50/70 hover:bg-blue-50/40 border border-slate-200/60 transition flex items-start gap-3.5 group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-[#0F4C81] flex items-center justify-center font-extrabold text-xs shrink-0 shadow-2xs group-hover:bg-[#0F4C81] group-hover:text-white transition">
                      {idx + 1}
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-[#0F4C81] transition">
                        {itemTitle}
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {itemDesc}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* How It Works Journey */}
          <div className="lg:col-span-6 bg-gradient-to-br from-[#0F4C81] to-[#082845] text-white rounded-3xl p-8 shadow-md space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 text-blue-200 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-blue-200" />
              </div>
              <div>
                <span className="text-[10px] text-blue-200 font-bold uppercase tracking-wider block">Transparent Workflow</span>
                <h3 className="text-xl font-black text-white">How EasyDesk Works</h3>
              </div>
            </div>

            <div className="space-y-4 relative">
              {howItWorks.map((step) => {
                const isHovered = activeStepHover === step.step;
                return (
                  <motion.div 
                    key={step.step}
                    onMouseEnter={() => setActiveStepHover(step.step)}
                    onMouseLeave={() => setActiveStepHover(null)}
                    whileHover={{ scale: 1.01 }}
                    className={`p-4 rounded-2xl transition-all duration-300 border flex items-start gap-4 ${
                      isHovered 
                        ? 'bg-white/20 border-white/40 shadow-md' 
                        : 'bg-white/10 border-white/10 hover:bg-white/15'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-white text-[#0F4C81] flex items-center justify-center font-black text-sm shrink-0 shadow-md">
                      {step.step}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm text-white">{step.title}</h4>
                        <span className="text-[10px] bg-blue-400/20 text-blue-200 font-semibold px-2 py-0.5 rounded-md">
                          Step {step.step}
                        </span>
                      </div>
                      <p className="text-xs text-blue-100/90 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

        </section>

        {/* =========================================================================
            7. SERVICE AREAS & PAN-INDIA COVERAGE
            ========================================================================= */}
        <section className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-[#0F4C81]" />
                <span className="text-xs text-[#0F4C81] font-bold uppercase tracking-widest">Regional Reach</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                Service Coverage Areas Across India
              </h3>
              <p className="text-xs text-slate-500">
                Providing localized document assistance and national e-portal processing across all major jurisdictions.
              </p>
            </div>

            {/* Live Search Filter for Service Areas */}
            <div className="w-full sm:w-64">
              <input
                type="text"
                value={searchArea}
                onChange={(e) => setSearchArea(e.target.value)}
                placeholder="Search state / city..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0F4C81] transition"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            {filteredAreas.map((area, idx) => (
              <motion.div
                key={idx}
                whileHover={{ scale: 1.04, y: -2 }}
                className="hover-lift-sm bg-slate-50 hover:bg-blue-50/80 border border-slate-200/80 hover:border-blue-300 text-slate-700 hover:text-[#0F4C81] px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 cursor-default transition-all duration-200"
              >
                <MapPin className="w-3.5 h-3.5 text-[#0F4C81]" />
                <span>{area}</span>
              </motion.div>
            ))}
            {filteredAreas.length === 0 && (
              <div className="w-full py-6 text-center text-xs text-slate-400 italic">
                No service regions matching "{searchArea}". We provide pan-India online support!
              </div>
            )}
          </div>
        </section>

        {/* =========================================================================
            8. FREQUENTLY ASKED QUESTIONS (Bootstrap-style Accordion)
            ========================================================================= */}
        <section className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs text-[#0F4C81] font-bold uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">
              Common Inquiries
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Clear answers regarding document safety, processing timelines, and government guidelines.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {[
              {
                q: 'How does EasyDesk ensure the security of my uploaded documents?',
                a: 'All personal proofs and certificates uploaded to EasyDesk are stored in 256-bit AES encrypted storage, processed exclusively by authorized verification officers, and automatically purged according to IT compliance protocols after service delivery.'
              },
              {
                q: 'Are certificates issued through EasyDesk legally valid?',
                a: 'Yes, 100%. EasyDesk facilitates official filings directly through authorized central and state government portal APIs. All final certificates carry official government digital signatures and QR verifications.'
              },
              {
                q: 'What happens if my application gets rejected by a government authority?',
                a: 'Because our desk officers perform a pre-submission audit before filing, our rejection rate is below 0.2%. If a department asks for additional clarification, we handle the resubmission at zero extra service charges.'
              },
              {
                q: 'Can I track my application status in real-time?',
                a: 'Yes! You receive live SMS and WhatsApp status updates at each milestone: Received, Verification In-Progress, Government Filed, and Completed with instant download access.'
              }
            ].map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div 
                  key={idx}
                  className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden transition-all duration-200 shadow-2xs hover:border-blue-300"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-5 py-4 text-left font-extrabold text-sm text-slate-900 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <HelpCircle className="w-4 h-4 text-[#0F4C81] shrink-0" />
                      {faq.q}
                    </span>
                    <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90 text-[#0F4C81]' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-4 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/40">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

        {/* =========================================================================
            9. CALL TO ACTION (Bootstrap Banner with Hover Ripple)
            ========================================================================= */}
        <section className="hover-lift bg-gradient-to-r from-[#0F4C81] via-blue-700 to-teal-700 text-white rounded-3xl p-8 sm:p-14 text-center space-y-5 shadow-xl relative overflow-hidden">
          
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <span className="text-[11px] font-black uppercase tracking-widest bg-white/15 px-3 py-1 rounded-full">
              Get Started In Minutes
            </span>

            <h2 className="text-2xl sm:text-4xl font-black leading-tight text-white">
              Ready to Simplify Your Digital Filings?
            </h2>

            <p className="text-xs sm:text-base text-blue-100 leading-relaxed">
              Explore over 100+ verified citizen services, or connect instantly with a desk specialist on WhatsApp for custom assistance.
            </p>

            <div className="flex flex-wrap justify-center gap-3 pt-3">
              <button 
                onClick={() => setView('services')}
                className="hover-lift-sm bg-white hover:bg-slate-50 text-[#0F4C81] font-black text-xs sm:text-sm px-6 py-3.5 rounded-2xl transition shadow-lg cursor-pointer flex items-center gap-2"
              >
                <span>Browse 100+ Services</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button 
                onClick={() => openGeneralWhatsApp()}
                className="hover-lift-sm bg-[#10B981] hover:bg-[#0e9f6e] text-white font-black text-xs sm:text-sm px-6 py-3.5 rounded-2xl transition cursor-pointer flex items-center gap-2 shadow-lg"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat on WhatsApp</span>
              </button>

              <button 
                onClick={() => setView('privacy-security')}
                className="hover-lift-sm bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm px-5 py-3.5 rounded-2xl transition cursor-pointer flex items-center gap-2 border border-white/20"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>Security Assurance</span>
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
