import React, { useState, useEffect } from 'react';
import { 
  Phone, Mail, MapPin, Clock, Send, MessageSquare, 
  Globe, CheckCircle2, AlertCircle, Share2, ShieldAlert,
  Sparkles, Headphones, ShieldCheck, Zap, Bot
} from 'lucide-react';
import { motion } from 'motion/react';
import { apiFetch, safeParseJsonResponse } from '../lib/apiClient.js';
import { openGeneralWhatsApp } from '../lib/whatsapp.js';
import { BaseCard, BaseCardBody } from './BaseCard.js';
import { getClientContactSettings } from '../lib/apiDataService.js';

interface ContactSettings {
  companyName: string;
  phone: string;
  whatsapp: string;
  email: string;
  alternateEmail?: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  workingHours: string;
  googleMapsUrl?: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    youtube?: string;
    linkedin?: string;
    twitter?: string;
  };
}

const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  companyName: 'EasyDesk Digital Services Pvt Ltd',
  phone: '+91 99999 88888',
  whatsapp: '+91 99999 88888',
  email: 'support@easydesk.com',
  alternateEmail: 'info@easydesk.com',
  address: 'Digital India Tower, Plot 14, Sector 62',
  city: 'Noida',
  state: 'Uttar Pradesh',
  pinCode: '201301',
  workingHours: 'Monday - Saturday: 9:00 AM - 7:00 PM IST',
  googleMapsUrl: 'https://maps.google.com/?q=Sector+62+Noida',
  socialMedia: {
    facebook: 'https://facebook.com/easydesk',
    instagram: 'https://instagram.com/easydesk',
    youtube: 'https://youtube.com/easydesk',
    linkedin: 'https://linkedin.com/company/easydesk',
    twitter: 'https://twitter.com/easydesk'
  }
};

export default function ContactView({ setView }: { setView?: (v: string) => void }) {
  const [contactInfo, setContactInfo] = useState<ContactSettings>(() => {
    try {
      const cached = localStorage.getItem('easydesk_cache_contact_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.phone || parsed.email || parsed.companyName)) {
          return { ...DEFAULT_CONTACT_SETTINGS, ...parsed };
        }
      }
    } catch {}
    return DEFAULT_CONTACT_SETTINGS;
  });
  const [loading, setLoading] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchContactInfo = async () => {
      try {
        const res = await fetch(`/api/contact-settings?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        if (res.ok) {
          const data = await safeParseJsonResponse<any>(res);
          if (data && (data.phone || data.email || data.companyName) && isMounted) {
            setContactInfo(prev => {
              const updated = { ...prev, ...data };
              try {
                localStorage.setItem('easydesk_cache_contact_settings', JSON.stringify(updated));
              } catch {}
              return updated;
            });
            return;
          }
        }
      } catch (err: any) {
        if (typeof navigator === 'undefined' || navigator.onLine !== false) {
          console.warn('Failed to load contact settings via API:', err?.message || err);
        }
      }

      // Authoritative Direct API Fallback
      try {
        if (typeof navigator === 'undefined' || navigator.onLine !== false) {
          const directContact = await getClientContactSettings();
          if (directContact && isMounted) {
            setContactInfo(prev => {
              const updated = { ...prev, ...directContact };
              try {
                localStorage.setItem('easydesk_cache_contact_settings', JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }
        }
      } catch (fsErr: any) {
        if (typeof navigator === 'undefined' || navigator.onLine !== false) {
          console.warn('Failed to load direct fallback contact settings:', fsErr?.message || fsErr);
        }
      }
    };

    fetchContactInfo();
    return () => { isMounted = false; };
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await apiFetch('/api/contact-messages', {
        method: 'POST',
        body: { name, email, phone, subject, message }
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccessMsg('Thank you! Your message has been received. A desk assistance officer will contact you shortly.');
        setName('');
        setEmail('');
        setPhone('');
        setSubject('');
        setMessage('');
      } else {
        setErrorMsg(data.message || 'Failed to send message. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error sending message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-xs text-slate-500 font-medium">
        <div className="w-8 h-8 border-4 border-[#0F4C81] border-t-transparent rounded-full animate-spin" />
        <span>Loading Contact Details...</span>
      </div>
    );
  }

  return (
    <div id="easydesk-contact-view" className="font-sans text-slate-900 bg-[#F8FAFC] pb-20 w-full max-w-full overflow-x-hidden">
      
      {/* 1. HERO HEADER (Matching AboutUs Gradient Banner & Pulse Badge) */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/70 via-slate-50 to-white py-12 sm:py-16 border-b border-slate-200/60 mb-10">
        
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
            className="max-w-3xl space-y-4"
          >
            <div className="inline-flex items-center gap-2 bg-blue-100/90 border border-blue-200/70 px-4 py-1.5 rounded-full text-xs font-black text-[#0F4C81] shadow-2xs pulse-badge">
              <Headphones className="w-4 h-4 text-[#0F4C81]" />
              <span>Official Support Desk & Direct Inquiry</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Get in Touch with <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F4C81] via-blue-600 to-teal-600">Our Assistance Team</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              Have questions about document requirements, application status, or need bespoke service assistance? Send us an inquiry or reach out directly through WhatsApp and phone channels.
            </p>

            {/* Quick Badges */}
            <div className="pt-2 flex flex-wrap gap-3 text-xs font-bold text-slate-700">
              <div className="flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Same-Day Response</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-[#0F4C81]" />
                <span>Verified Desk Officers</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Zero Automation Loops</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. MAIN CONTACT SECTION */}
      <div className="portal-container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Company Contact Cards (Left column) */}
          <div className="lg:col-span-5 space-y-6">
            
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-7 space-y-5 hover-lift hover-glow-blue transition-all duration-300">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[10px] font-extrabold uppercase text-[#0F4C81] tracking-wider block">Official Headquarters</span>
                <h3 className="font-black text-base text-slate-900 mt-1 m-0">
                  {contactInfo?.companyName || 'EasyDesk Digital Services Pvt Ltd'}
                </h3>
              </div>

              {/* Phone Support */}
              <div className="flex gap-3.5 items-center group/item p-2 rounded-2xl hover:bg-slate-50/80 transition-colors">
                <div className="w-11 h-11 bg-blue-50 text-[#0F4C81] border border-blue-100/80 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-extrabold block uppercase">Phone Support</span>
                  <a href={`tel:${contactInfo?.phone}`} className="font-black text-sm text-slate-900 hover:text-[#0F4C81] transition-colors">
                    {contactInfo?.phone || '+91 98765 43210'}
                  </a>
                </div>
              </div>

              {/* WhatsApp */}
              <div className="flex gap-3.5 items-center group/item p-2 rounded-2xl hover:bg-emerald-50/40 transition-colors">
                <div className="w-11 h-11 bg-emerald-50 text-emerald-600 border border-emerald-100/80 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-extrabold block uppercase">WhatsApp Helpdesk</span>
                  <button 
                    onClick={() => openGeneralWhatsApp()}
                    className="font-black text-sm text-emerald-600 hover:underline text-left cursor-pointer p-0 bg-transparent border-0 flex items-center gap-1.5"
                  >
                    <span>{contactInfo?.whatsapp || '+91 98765 43210'}</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Chat Live</span>
                  </button>
                </div>
              </div>

              {/* Email */}
              <div className="flex gap-3.5 items-center group/item p-2 rounded-2xl hover:bg-slate-50/80 transition-colors">
                <div className="w-11 h-11 bg-purple-50 text-purple-600 border border-purple-100/80 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-extrabold block uppercase">Official Email</span>
                  <a href={`mailto:${contactInfo?.email}`} className="font-black text-sm text-slate-900 hover:text-[#0F4C81] block transition-colors">
                    {contactInfo?.email || 'support@easydesk.com'}
                  </a>
                </div>
              </div>

              {/* Address */}
              <div className="flex gap-3.5 items-start group/item p-2 rounded-2xl hover:bg-slate-50/80 transition-colors">
                <div className="w-11 h-11 bg-amber-50 text-amber-600 border border-amber-100/80 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-extrabold block uppercase">Office Location</span>
                  <p className="font-medium text-xs text-slate-600 leading-relaxed m-0 mt-0.5">
                    {contactInfo?.address || 'Signature IT Park, BKC'}, {contactInfo?.city || 'Mumbai'}, {contactInfo?.state || 'Maharashtra'} - {contactInfo?.pinCode || '400051'}
                  </p>
                </div>
              </div>

              {/* Working Hours */}
              <div className="flex gap-3.5 items-center group/item p-2 rounded-2xl hover:bg-slate-50/80 transition-colors">
                <div className="w-11 h-11 bg-slate-100 text-slate-600 border border-slate-200/80 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-extrabold block uppercase">Operating Schedule</span>
                  <p className="font-semibold text-xs text-slate-700 m-0 mt-0.5">
                    {contactInfo?.workingHours || 'Mon - Sat: 9:00 AM - 6:30 PM IST'}
                  </p>
                </div>
              </div>

            </div>

            {/* Security Alert Banner (Matching AboutUs Consultation Style) */}
            <div className="bg-gradient-to-br from-[#0F4C81] to-[#0A3258] text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-blue-900/50 space-y-3.5 text-xs hover-lift hover-glow-blue transition-all duration-300">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-cyan-300 shrink-0" />
                <span className="font-black text-sm text-white">Security & Anti-Fraud Notice</span>
              </div>
              <p className="text-xs text-blue-100/90 leading-relaxed m-0 font-normal">
                EasyDesk personnel will <strong>NEVER</strong> request your private UPI PIN, internet banking passwords, or personal biometric credentials.
              </p>
              {setView && (
                <button 
                  onClick={() => setView('privacy-security')}
                  className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer text-center block border border-white/20 hover-scale-sm"
                >
                  Visit Privacy & Security Trust Center →
                </button>
              )}
            </div>

          </div>

          {/* Public Interactive Contact Form (Right column) */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6 hover-lift hover-glow-blue transition-all duration-300">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#0F4C81] badge-soft-primary px-3 py-1 rounded-full mb-2">
                  <Send className="w-3.5 h-3.5 text-[#0F4C81]" /> Direct Message Queue
                </div>
                <h2 className="font-black text-xl sm:text-2xl text-slate-900 m-0">Send an Online Inquiry</h2>
                <p className="text-xs text-slate-500 mt-1 mb-0 font-normal">Our duty officers review all submissions and provide documented answers.</p>
              </div>

              {successMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 text-xs rounded-2xl p-4 m-0 shadow-2xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-medium">{successMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-800 flex items-center gap-3 text-xs rounded-2xl p-4 m-0 shadow-2xs">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <span className="font-medium">{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-full-name" className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1.5">Your Full Name *</label>
                    <input
                      id="contact-full-name"
                      name="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Ramesh Verma"
                      className="w-full bg-slate-50/60 border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none input-focus-glow placeholder:text-slate-400 font-medium"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-email-addr" className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1.5">Email Address *</label>
                    <input
                      id="contact-email-addr"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@domain.com"
                      className="w-full bg-slate-50/60 border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none input-focus-glow placeholder:text-slate-400 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-mobile-num" className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1.5">Mobile Number *</label>
                    <input
                      id="contact-mobile-num"
                      name="phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="w-full bg-slate-50/60 border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none input-focus-glow placeholder:text-slate-400 font-medium"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-subject-topic" className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1.5">Subject / Service Topic *</label>
                    <input
                      id="contact-subject-topic"
                      name="subject"
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Passport application inquiry"
                      className="w-full bg-slate-50/60 border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none input-focus-glow placeholder:text-slate-400 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-inquiry-message" className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1.5">Your Message / Inquiry Details *</label>
                  <textarea
                    id="contact-inquiry-message"
                    name="message"
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your inquiry, specific document questions, or filing needs..."
                    className="w-full bg-slate-50/60 border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none input-focus-glow placeholder:text-slate-400 font-medium"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between gap-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-[#0F4C81] hover:bg-[#0b3b64] text-white btn-glow-primary rounded-xl px-7 py-3 text-xs font-bold transition-all cursor-pointer shadow-sm inline-flex items-center gap-2 hover-scale-sm disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Submitting Inquiry...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Inquiry</span>
                      </>
                    )}
                  </button>

                  <span className="text-[10px] text-slate-400 font-medium">
                    🔒 SSL Encrypted Submission
                  </span>
                </div>
              </form>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}

