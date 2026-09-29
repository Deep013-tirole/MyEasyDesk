import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { 
  Phone, Mail, MapPin, Clock, Send, MessageSquare, 
  CheckCircle2, AlertCircle, ShieldAlert,
  ShieldCheck, Zap, ExternalLink, ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { apiFetch, safeParseJsonResponse } from '../lib/apiClient.js';
import { openGeneralWhatsApp } from '../lib/whatsapp.js';
import { getClientContactSettings, formatFullAddress } from '../lib/apiDataService.js';
import { onContactSettingsUpdated, updateCachedContactSettings } from '../lib/whatsapp.js';
import { getCanonicalOrigin } from '../lib/seoConfig.js';
import { SectionContainer, SectionHeader, PageHeader, CivicCard } from './ui/index.js';

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
  companyName: 'My EasyDesk Digital Services Pvt Ltd',
  phone: '',
  whatsapp: '',
  email: '',
  alternateEmail: '',
  address: '',
  city: '',
  state: '',
  pinCode: '',
  workingHours: 'Monday - Saturday: 9:00 AM - 7:00 PM IST',
  googleMapsUrl: '',
  socialMedia: {
    facebook: '',
    instagram: '',
    youtube: '',
    linkedin: '',
    twitter: ''
  }
};

export default function ContactView({ setView }: { setView?: (v: string) => void }) {
  const origin = getCanonicalOrigin();
  const [contactInfo, setContactInfo] = useState<ContactSettings>(() => {
    try {
      const cached = localStorage.getItem('easydesk_cache_contact_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.phone || parsed.email || parsed.companyName || parsed.address)) {
          return { ...DEFAULT_CONTACT_SETTINGS, ...parsed };
        }
      }
    } catch {}
    return DEFAULT_CONTACT_SETTINGS;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('easydesk_cache_contact_settings');
      return !cached;
    } catch {
      return true;
    }
  });

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

    // Real-time synchronization when Admin updates contact details in another component/tab
    const unsubscribe = onContactSettingsUpdated((freshData) => {
      if (freshData && typeof freshData === 'object' && isMounted) {
        setContactInfo(prev => ({ ...prev, ...freshData }));
      }
    });

    const fetchContactInfo = async () => {
      try {
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
            if (data && typeof data === 'object' && (data.phone || data.email || data.companyName || data.address) && isMounted) {
              setContactInfo(prev => ({ ...prev, ...data }));
              updateCachedContactSettings(data);
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
            if (directContact && typeof directContact === 'object' && isMounted) {
              setContactInfo(prev => ({ ...prev, ...directContact }));
              updateCachedContactSettings(directContact);
            }
          }
        } catch (fsErr: any) {
          if (typeof navigator === 'undefined' || navigator.onLine !== false) {
            console.warn('Failed to load direct fallback contact settings:', fsErr?.message || fsErr);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchContactInfo();
    return () => {
      isMounted = false;
      unsubscribe();
    };
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

      const data = await safeParseJsonResponse<any>(res);
      if (res.ok) {
        setSuccessMsg('Thank you! Your message has been received. A My EasyDesk assistance officer will contact you shortly.');
        try {
          window.dispatchEvent(new CustomEvent('easydesk_contact_inquiry_submitted', { detail: data?.messageData || data?.inquiry }));
        } catch {}
        setName('');
        setEmail('');
        setPhone('');
        setSubject('');
        setMessage('');
      } else {
        setErrorMsg(data?.message || 'Failed to send message. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error sending message. Please try again.');
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
    <div id="easydesk-contact-view" className="font-sans text-slate-900 bg-white w-full max-w-full overflow-x-hidden">
      <Helmet>
        <title>Contact Assistance Desk | My EasyDesk — Your Online Work, Done Easily</title>
        <meta name="description" content="Get in touch with My EasyDesk officers. Direct WhatsApp helpdesk, phone support, office address, and online inquiry queue." />
        <link rel="canonical" href={`${origin}/contact`} />
      </Helmet>

      {/* SECTION 1: HERO & PAGE HEADER */}
      <PageHeader
        badge="Official Support Desk & Direct Inquiry"
        title="Get in Touch with Our Assistance Team"
        subtitle="Have questions about document requirements, application status, or need bespoke service assistance? Send us an inquiry or reach out directly through WhatsApp and phone channels."
        breadcrumbs={[{ label: 'Contact Us', active: true }]}
        actions={
          <div className="flex flex-wrap gap-2.5 text-xs font-bold text-slate-700">
            <div className="flex items-center gap-1.5 bg-white/95 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Same-Day Response</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/95 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-[#0F4C81]" />
              <span>Verified Desk Officers</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/95 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Zero Automation Loops</span>
            </div>
          </div>
        }
      />

      {/* SECTION 2: DIRECT ASSISTANCE CHANNELS */}
      <SectionContainer id="contact-channels-section" variant="default" size="md" topDivider bottomDivider>
        <SectionHeader
          badge="Direct Channels"
          icon={<Phone className="w-4 h-4" />}
          title="Immediate Desk Assistance & Official Contacts"
          subtitle="Connect directly with verified My EasyDesk personnel during operating hours."
          align="left"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* Card 1: WhatsApp Live Support */}
          <CivicCard variant="interactive" className="p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                  Fastest Response
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">WhatsApp Helpdesk</span>
                <h3 className="text-base font-black text-slate-900 mt-0.5">Live Desk Chat</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Chat directly with an officer for quick eligibility verification, fees, and filing queries.
                </p>
              </div>
            </div>

            <button 
              onClick={() => openGeneralWhatsApp()}
              className="w-full bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs hover-scale-sm"
            >
              <span>{contactInfo?.whatsapp ? `Chat +${contactInfo.whatsapp}` : 'Open WhatsApp Chat'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </CivicCard>

          {/* Card 2: Phone Support */}
          <CivicCard variant="interactive" className="p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 bg-blue-50 text-[#0F4C81] border border-blue-100 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
                  <Phone className="w-5 h-5" />
                </div>
                <span className="text-[10px] bg-blue-50 text-[#0F4C81] border border-blue-100 px-2.5 py-0.5 rounded-full font-bold">
                  Voice Calling
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Citizen Helpline</span>
                <h3 className="text-base font-black text-slate-900 mt-0.5">
                  {contactInfo?.phone ? (
                    <a href={`tel:${contactInfo.phone}`} className="hover:text-[#0F4C81] transition-colors">
                      {contactInfo.phone}
                    </a>
                  ) : (
                    'Direct Hotline'
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Speak directly with our service coordinators for document guidance and complex applications.
                </p>
              </div>
            </div>

            {contactInfo?.phone ? (
              <a
                href={`tel:${contactInfo.phone}`}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 text-center"
              >
                <Phone className="w-4 h-4 text-[#0F4C81]" />
                <span>Call {contactInfo.phone}</span>
              </a>
            ) : (
              <div className="text-xs text-slate-400 font-medium py-2 text-center bg-slate-50 rounded-xl">
                Helpline Active During Business Hours
              </div>
            )}
          </CivicCard>

          {/* Card 3: Email Support */}
          <CivicCard variant="interactive" className="p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 bg-purple-50 text-purple-600 border border-purple-100 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
                  <Mail className="w-5 h-5" />
                </div>
                <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-0.5 rounded-full font-bold">
                  Formal Inquiry
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Official Email</span>
                <h3 className="text-sm font-black text-slate-900 mt-0.5 truncate">
                  {contactInfo?.email || 'help.myeasydesks@gmail.com'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Send official documents, corporate requests, or formal grievance correspondence.
                </p>
              </div>
            </div>

            <a
              href={`mailto:${contactInfo?.email || 'help.myeasydesks@gmail.com'}`}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 text-center"
            >
              <Mail className="w-4 h-4 text-purple-600" />
              <span>Send Official Email</span>
            </a>
          </CivicCard>

        </div>

        {/* Operating Schedule & Physical Desk Strip */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3.5">
            <div className="w-10 h-10 bg-white border border-slate-200 text-slate-700 rounded-xl flex items-center justify-center shrink-0 shadow-2xs">
              <Clock className="w-5 h-5 text-[#0F4C81]" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Operating Schedule</span>
              <p className="text-xs font-bold text-slate-800 mt-0.5">
                {contactInfo?.workingHours || 'Monday - Saturday: 9:00 AM - 7:00 PM IST'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Closed on Sundays and statutory national gazetted holidays.</p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3.5">
            <div className="w-10 h-10 bg-white border border-slate-200 text-slate-700 rounded-xl flex items-center justify-center shrink-0 shadow-2xs">
              <MapPin className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Headquarters Office</span>
              <p className="text-xs font-bold text-slate-800 mt-0.5">
                {formatFullAddress(contactInfo) || 'A51, Vijay Nagar, Indore, Madhya Pradesh - 452010'}
              </p>
              {contactInfo?.googleMapsUrl && (
                <a 
                  href={contactInfo.googleMapsUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[11px] text-[#0F4C81] hover:underline font-bold inline-flex items-center gap-1 mt-1"
                >
                  <span>View on Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </SectionContainer>

      {/* SECTION 3: SEND AN ONLINE INQUIRY */}
      <SectionContainer id="contact-inquiry-section" variant="subtle" size="md" bottomDivider>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Context Column */}
          <div className="lg:col-span-4 space-y-6">
            <SectionHeader
              badge="Direct Message Queue"
              icon={<Send className="w-4 h-4" />}
              title="Submit an Online Inquiry"
              subtitle="Our duty officers log each inquiry into our internal ticketing queue and respond with documented guidance."
              align="left"
            />

            <CivicCard variant="default" className="p-5 space-y-3.5 border-l-4 border-l-[#0F4C81]">
              <span className="text-xs font-black text-slate-900 block">How our inquiry desk works</span>
              <ul className="space-y-2 text-xs text-slate-600 pl-4 list-disc font-normal leading-relaxed m-0">
                <li>Desk officers review queries within 4 business hours.</li>
                <li>You receive a direct reply via WhatsApp or phone.</li>
                <li>Zero bot loops: every message is handled by a trained human desk assistant.</li>
              </ul>
            </CivicCard>

            {/* Anti-Fraud Banner */}
            <div className="bg-gradient-to-br from-[#0F4C81] to-[#0A3258] text-white rounded-3xl p-6 shadow-md border border-blue-900/50 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-cyan-300 shrink-0" />
                <span className="font-black text-sm text-white">Security & Anti-Fraud Notice</span>
              </div>
              <p className="text-xs text-blue-100/90 leading-relaxed m-0 font-normal">
                My EasyDesk personnel will <strong>NEVER</strong> request your private UPI PIN, internet banking passwords, or personal biometric credentials.
              </p>
              {setView && (
                <button 
                  onClick={() => setView('privacy-security')}
                  className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-2 rounded-xl text-xs transition-all cursor-pointer text-center block border border-white/20 hover-scale-sm mt-2"
                >
                  Visit Privacy & Security Trust Center →
                </button>
              )}
            </div>
          </div>

          {/* Right Form Column */}
          <div className="lg:col-span-8">
            <CivicCard variant="elevated" className="p-6 sm:p-8 space-y-6">
              <div>
                <h3 className="font-black text-xl text-slate-900 m-0">Inquiry Submission Form</h3>
                <p className="text-xs text-slate-500 mt-1 mb-0 font-normal">
                  All fields marked with an asterisk (<span className="text-red-500">*</span>) are mandatory.
                </p>
              </div>

              {successMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 text-xs rounded-2xl p-4 shadow-2xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-medium">{successMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-800 flex items-center gap-3 text-xs rounded-2xl p-4 shadow-2xs">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <span className="font-medium">{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-full-name" className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1.5">
                      Your Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="contact-full-name"
                      name="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Ramesh Verma"
                      className="w-full bg-slate-50/70 border border-slate-200/90 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:bg-white input-focus-glow placeholder:text-slate-400 font-medium notranslate"
                      translate="no"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-email-addr" className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1.5">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="contact-email-addr"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@domain.com"
                      className="w-full bg-slate-50/70 border border-slate-200/90 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:bg-white input-focus-glow placeholder:text-slate-400 font-medium notranslate"
                      translate="no"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-mobile-num" className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1.5">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="contact-mobile-num"
                      name="phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="w-full bg-slate-50/70 border border-slate-200/90 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:bg-white input-focus-glow placeholder:text-slate-400 font-medium notranslate"
                      translate="no"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-subject-topic" className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1.5">
                      Subject / Service Topic <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="contact-subject-topic"
                      name="subject"
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Passport application inquiry"
                      className="w-full bg-slate-50/70 border border-slate-200/90 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:bg-white input-focus-glow placeholder:text-slate-400 font-medium notranslate"
                      translate="no"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-inquiry-message" className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1.5">
                    Your Message / Inquiry Details <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="contact-inquiry-message"
                    name="message"
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your inquiry, specific document questions, or filing needs..."
                    className="w-full bg-slate-50/70 border border-slate-200/90 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:bg-white input-focus-glow placeholder:text-slate-400 font-medium notranslate resize-y"
                    translate="no"
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-[#0F4C81] hover:bg-[#0b3b64] text-white btn-glow-primary rounded-xl px-7 py-3 text-xs font-bold transition-all cursor-pointer shadow-sm inline-flex items-center justify-center gap-2 hover-scale-sm disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Submitting Inquiry...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Inquiry to Queue</span>
                      </>
                    )}
                  </button>

                  <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                    <span>🔒 SSL 256-Bit Encrypted & Privacy Protected</span>
                  </span>
                </div>
              </form>
            </CivicCard>
          </div>

        </div>
      </SectionContainer>
    </div>
  );
}
