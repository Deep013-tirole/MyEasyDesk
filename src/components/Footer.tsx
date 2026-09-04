import React, { useState, useEffect } from 'react';
import { Phone, Mail, MapPin, Globe, ShieldCheck, Heart, ArrowUpRight, MessageSquare } from 'lucide-react';
import { openGeneralWhatsApp, normalizeWhatsAppNumber, onContactSettingsUpdated } from '../lib/whatsapp.js';

interface FooterProps {
  setView: (v: string) => void;
}

export default function Footer({ setView }: FooterProps) {
  const [contact, setContact] = useState({
    phone: '',
    email: '',
    address: '',
    whatsapp: ''
  });

  useEffect(() => {
    const applyContact = (data: any) => {
      if (data) {
        const normalizedWa = normalizeWhatsAppNumber(data.whatsapp);
        setContact({
          phone: data.phone || '+91 98765 43210',
          email: data.email || 'support@easydesk.com',
          address: data.address || 'BKC Signature IT Park, Mumbai, Maharashtra 400051',
          whatsapp: normalizedWa
        });
      }
    };

    fetch('/api/contact-settings')
      .then(res => res.json())
      .then(data => applyContact(data))
      .catch(() => {});

    const unsubscribe = onContactSettingsUpdated((data) => {
      applyContact(data);
    });

    return () => unsubscribe();
  }, []);
  return (
    <footer className="bg-[#0F4C81] text-slate-200 font-sans border-t border-blue-900 mt-16 w-full max-w-full">
      <div className="portal-container py-10 sm:py-14 w-full max-w-full">
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 w-full min-w-0">
          
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setView('home')}>
              <div className="w-9 h-9 bg-white text-[#0F4C81] rounded-xl flex items-center justify-center font-black shadow-md">
                ED
              </div>
              <div>
                <span className="text-xl font-black text-white tracking-tight leading-none block">EasyDesk</span>
                <span className="block text-[8px] text-cyan-200 font-bold tracking-widest uppercase mt-0.5">Digital Service Platform</span>
              </div>
            </div>

            <p className="text-xs text-slate-200/80 leading-relaxed max-w-sm">
              EasyDesk is a professional digital document assistance platform providing transparent pre-audits, verification guidance, and fast-track submission for 100+ government, business, and personal digital certificates.
            </p>

            <div className="pt-2 flex items-center gap-2 text-[10px] text-cyan-100 font-semibold bg-white/10 border border-white/10 px-3 py-2 rounded-xl max-w-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>100% Encrypted & Verified Document Handling</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-wider mb-3.5">Quick Links</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => setView('home')} className="hover:text-white transition cursor-pointer text-left">
                  Home
                </button>
              </li>
              <li>
                <button onClick={() => setView('services')} className="hover:text-white transition cursor-pointer text-left">
                  Services
                </button>
              </li>
              <li>
                <button onClick={() => setView('blogs')} className="hover:text-white transition cursor-pointer text-left">
                  Blogs
                </button>
              </li>
              <li>
                <button onClick={() => setView('about')} className="hover:text-white transition cursor-pointer text-left">
                  About Us
                </button>
              </li>
              <li>
                <button onClick={() => setView('contact')} className="hover:text-white transition cursor-pointer text-left">
                  Contact
                </button>
              </li>
              <li>
                <button onClick={() => setView('payment')} className="hover:text-white transition cursor-pointer text-left">
                  Payment
                </button>
              </li>
              <li>
                <button onClick={() => setView('track')} className="hover:text-white transition cursor-pointer text-left font-semibold text-cyan-200 flex items-center gap-1">
                  🔍 Track Application
                </button>
              </li>
              <li>
                <button onClick={() => setView('privacy-security')} className="hover:text-white transition cursor-pointer text-left">
                  Privacy & Security
                </button>
              </li>
              <li>
                <button onClick={() => setView('submit-review')} className="hover:text-white transition cursor-pointer text-left text-amber-300 font-semibold flex items-center gap-1">
                  ⭐ Submit Customer Review
                </button>
              </li>
            </ul>
          </div>

          {/* Popular Services */}
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-wider mb-3.5">Popular Services</h4>
            <ul className="space-y-2 text-xs">
              <li><button onClick={() => setView('services')} className="hover:text-white transition text-left cursor-pointer">PAN Card Filing</button></li>
              <li><button onClick={() => setView('services')} className="hover:text-white transition text-left cursor-pointer">Passport Seva Assistance</button></li>
              <li><button onClick={() => setView('services')} className="hover:text-white transition text-left cursor-pointer">GST Registration & Filing</button></li>
              <li><button onClick={() => setView('services')} className="hover:text-white transition text-left cursor-pointer">Udyam MSME Certificate</button></li>
              <li><button onClick={() => setView('blogs')} className="hover:text-white transition text-left cursor-pointer flex items-center gap-1 text-cyan-200">Blogs <ArrowUpRight className="w-3 h-3" /></button></li>
            </ul>
          </div>

          {/* Contact Details & WhatsApp button */}
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-wider mb-3.5">Desk Help Support</h4>
            <div className="space-y-2.5 text-xs mb-4">
              <div className="flex items-center gap-2 text-slate-200">
                <Phone className="w-3.5 h-3.5 text-cyan-200 shrink-0" />
                <span>{contact.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <Mail className="w-3.5 h-3.5 text-cyan-200 shrink-0" />
                <span>{contact.email}</span>
              </div>
              <div className="flex items-start gap-2 text-slate-200 pt-0.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-200 shrink-0 mt-0.5" />
                <span>{contact.address}</span>
              </div>
            </div>

            <button
              onClick={() => openGeneralWhatsApp()}
              className="bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Chat on WhatsApp
            </button>
          </div>

        </div>

        {/* Bottom Legal Bar */}
        <div className="mt-12 pt-6 border-t border-blue-900 text-center flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-slate-300">
          <p>© 2026 EasyDesk Digital Platforms Private Limited. All rights reserved.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <button onClick={() => setView('privacy-security')} className="hover:text-white font-bold text-cyan-200 cursor-pointer">Privacy Policy & Security</button>
            <button onClick={() => setView('about')} className="hover:text-white cursor-pointer">Terms & Conditions</button>
            <button onClick={() => setView('contact')} className="hover:text-white cursor-pointer">Contact Us</button>
            <button onClick={() => setView('blogs')} className="hover:text-white cursor-pointer">Resources</button>
          </div>
        </div>

      </div>
    </footer>
  );
}
