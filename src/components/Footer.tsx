import React, { useState, useEffect } from 'react';
import { Phone, Mail, MapPin, Globe, ShieldCheck, Heart, ArrowUpRight, MessageSquare } from 'lucide-react';
import { openGeneralWhatsApp, normalizeWhatsAppNumber, onContactSettingsUpdated } from '../lib/whatsapp.js';
import { SocialMediaLink, SupportedSocialPlatform } from '../types.js';

interface FooterProps {
  setView: (v: string) => void;
}

function renderSocialIcon(platform: SupportedSocialPlatform | string) {
  switch (platform) {
    case 'facebook':
      return (
        <svg className="w-3.5 h-3.5 fill-current text-[#1877F2]" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      );
    case 'instagram':
      return (
        <svg className="w-3.5 h-3.5 fill-current text-[#E4405F]" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      );
    case 'whatsapp':
      return (
        <svg className="w-3.5 h-3.5 fill-current text-[#25D366]" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
        </svg>
      );
    case 'youtube':
      return (
        <svg className="w-3.5 h-3.5 fill-current text-[#FF0000]" viewBox="0 0 24 24">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      );
    case 'telegram':
      return (
        <svg className="w-3.5 h-3.5 fill-current text-[#229ED9]" viewBox="0 0 24 24">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      );
    case 'twitter':
      return (
        <svg className="w-3.5 h-3.5 fill-current text-white" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      );
    case 'linkedin':
      return (
        <svg className="w-3.5 h-3.5 fill-current text-[#0A66C2]" viewBox="0 0 24 24">
          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
        </svg>
      );
    default:
      return <Globe className="w-3.5 h-3.5" />;
  }
}

function getPlatformTitle(platform: string): string {
  switch (platform) {
    case 'facebook': return 'Facebook';
    case 'instagram': return 'Instagram';
    case 'whatsapp': return 'WhatsApp';
    case 'youtube': return 'YouTube';
    case 'telegram': return 'Telegram';
    case 'twitter': return 'X (Twitter)';
    case 'linkedin': return 'LinkedIn';
    default: return platform;
  }
}

export default function Footer({ setView }: FooterProps) {
  const [contact, setContact] = useState(() => {
    try {
      const cached = localStorage.getItem('easydesk_cache_contact_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.phone || parsed.email || parsed.address)) {
          return {
            phone: parsed.phone || parsed.whatsapp || '',
            email: parsed.email || '',
            address: parsed.address ? `${parsed.address}${parsed.city ? ', ' + parsed.city : ''}${parsed.state ? ', ' + parsed.state : ''}` : (parsed.city || ''),
            whatsapp: parsed.whatsapp ? normalizeWhatsAppNumber(parsed.whatsapp) : ''
          };
        }
      }
    } catch {}
    return {
      phone: '',
      email: '',
      address: '',
      whatsapp: ''
    };
  });

  const [socialLinks, setSocialLinks] = useState<SocialMediaLink[]>(() => {
    try {
      const cached = localStorage.getItem('easydesk_cache_social_links');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    const applyContact = (data: any) => {
      if (data && typeof data === 'object') {
        const normalizedWa = data.whatsapp ? normalizeWhatsAppNumber(data.whatsapp) : '';
        const fullAddress = data.address ? `${data.address}${data.city ? ', ' + data.city : ''}${data.state ? ', ' + data.state : ''}${data.pinCode ? ' - ' + data.pinCode : ''}` : (data.city || '');
        setContact({
          phone: data.phone || data.whatsapp || '',
          email: data.email || '',
          address: fullAddress,
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

    // Hydrate social media links from server API
    fetch(`/api/social-media-links?_t=${Date.now()}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && Array.isArray(data.socialMediaLinks)) {
          setSocialLinks(data.socialMediaLinks);
          try {
            localStorage.setItem('easydesk_cache_social_links', JSON.stringify(data.socialMediaLinks));
          } catch {}
        }
      })
      .catch(() => {});

    // Instant sync with admin module updates in same browser tab
    const onSocialUpdated = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setSocialLinks(e.detail);
      }
    };
    window.addEventListener('easydesk_social_links_updated', onSocialUpdated);

    return () => {
      unsubscribe();
      window.removeEventListener('easydesk_social_links_updated', onSocialUpdated);
    };
  }, []);

  const activeSocialLinks = socialLinks.filter(item => {
    if (!item || !item.enabled || typeof item.url !== 'string') return false;
    const trimmed = item.url.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    return lower.startsWith('http://') || lower.startsWith('https://');
  });
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
                {contact.phone ? (
                  <span>{contact.phone}</span>
                ) : (
                  <div className="h-3 w-24 bg-white/20 rounded animate-pulse" />
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <Mail className="w-3.5 h-3.5 text-cyan-200 shrink-0" />
                {contact.email ? (
                  <span>{contact.email}</span>
                ) : (
                  <div className="h-3 w-32 bg-white/20 rounded animate-pulse" />
                )}
              </div>
              <div className="flex items-start gap-2 text-slate-200 pt-0.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-200 shrink-0 mt-0.5" />
                {contact.address ? (
                  <span>{contact.address}</span>
                ) : (
                  <div className="h-3 w-40 bg-white/20 rounded animate-pulse" />
                )}
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

        {/* Social Media Links Section - Rendered only when active enabled links exist */}
        {activeSocialLinks.length > 0 && (
          <div className="mt-10 pt-6 border-t border-blue-900/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <span className="text-cyan-200 uppercase tracking-wider text-[11px]">Follow Us:</span>
            </div>
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 sm:gap-2.5">
              {activeSocialLinks.map((item) => (
                <a
                  key={item.platform}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow EasyDesk on ${getPlatformTitle(item.platform)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/25 text-xs font-semibold text-slate-100 hover:text-white transition cursor-pointer shadow-xs active:scale-95"
                >
                  <span className="shrink-0 flex items-center justify-center">{renderSocialIcon(item.platform)}</span>
                  <span>{getPlatformTitle(item.platform)}</span>
                </a>
              ))}
            </div>
          </div>
        )}

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
