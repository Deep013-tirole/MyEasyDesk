import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Globe } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient.js';
import { SocialMediaLink, SupportedSocialPlatform } from '../../types.js';

interface PlatformMeta {
  key: SupportedSocialPlatform;
  name: string;
  placeholder: string;
  badgeBg: string;
  badgeText: string;
  accentBorder: string;
  iconSvg: React.ReactNode;
}

const PLATFORMS: PlatformMeta[] = [
  {
    key: 'facebook',
    name: 'Facebook',
    placeholder: 'https://facebook.com/your-page',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    accentBorder: 'border-blue-200',
    iconSvg: (
      <svg className="w-5 h-5 fill-current text-blue-600" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    )
  },
  {
    key: 'instagram',
    name: 'Instagram',
    placeholder: 'https://instagram.com/your-handle',
    badgeBg: 'bg-pink-50',
    badgeText: 'text-pink-700',
    accentBorder: 'border-pink-200',
    iconSvg: (
      <svg className="w-5 h-5 fill-current text-pink-600" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    )
  },
  {
    key: 'whatsapp',
    name: 'WhatsApp',
    placeholder: 'https://wa.me/919999988888',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    accentBorder: 'border-emerald-200',
    iconSvg: (
      <svg className="w-5 h-5 fill-current text-emerald-600" viewBox="0 0 24 24">
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
      </svg>
    )
  },
  {
    key: 'youtube',
    name: 'YouTube',
    placeholder: 'https://youtube.com/@your-channel',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-700',
    accentBorder: 'border-red-200',
    iconSvg: (
      <svg className="w-5 h-5 fill-current text-red-600" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    )
  },
  {
    key: 'telegram',
    name: 'Telegram',
    placeholder: 'https://t.me/your-channel',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
    accentBorder: 'border-sky-200',
    iconSvg: (
      <svg className="w-5 h-5 fill-current text-sky-500" viewBox="0 0 24 24">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    )
  },
  {
    key: 'twitter',
    name: 'X (Twitter)',
    placeholder: 'https://x.com/your-handle',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
    accentBorder: 'border-slate-300',
    iconSvg: (
      <svg className="w-5 h-5 fill-current text-slate-900" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    )
  },
  {
    key: 'linkedin',
    name: 'LinkedIn',
    placeholder: 'https://linkedin.com/company/your-company',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    accentBorder: 'border-indigo-200',
    iconSvg: (
      <svg className="w-5 h-5 fill-current text-indigo-600" viewBox="0 0 24 24">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
      </svg>
    )
  }
];

export default function SocialMediaAdminModule() {
  const [links, setLinks] = useState<Record<string, { url: string; enabled: boolean }>>({
    facebook: { url: '', enabled: false },
    instagram: { url: '', enabled: false },
    whatsapp: { url: '', enabled: false },
    youtube: { url: '', enabled: false },
    telegram: { url: '', enabled: false },
    twitter: { url: '', enabled: false },
    linkedin: { url: '', enabled: false }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const fetchSocialLinks = async () => {
    try {
      const res = await fetch(`/api/social-media-links?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.socialMediaLinks)) {
          const mapped: Record<string, { url: string; enabled: boolean }> = {
            facebook: { url: '', enabled: false },
            instagram: { url: '', enabled: false },
            whatsapp: { url: '', enabled: false },
            youtube: { url: '', enabled: false },
            telegram: { url: '', enabled: false },
            twitter: { url: '', enabled: false },
            linkedin: { url: '', enabled: false }
          };
          for (const item of data.socialMediaLinks) {
            const p = String(item.platform || '').toLowerCase();
            if (p) {
              mapped[p] = {
                url: item.url || '',
                enabled: Boolean(item.enabled)
              };
            }
          }
          setLinks(mapped);
        }
      }
    } catch (err) {
      console.warn('Failed loading social media links:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSocialLinks();
  }, []);

  const handleUrlChange = (platform: string, url: string) => {
    setLinks(prev => ({
      ...prev,
      [platform]: {
        ...(prev[platform] || { enabled: false }),
        url
      }
    }));
  };

  const handleToggleEnabled = (platform: string) => {
    setLinks(prev => {
      const current = prev[platform] || { url: '', enabled: false };
      return {
        ...prev,
        [platform]: {
          ...current,
          enabled: !current.enabled
        }
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    setErrMsg('');

    // Pre-flight client validation for enabled items
    for (const p of PLATFORMS) {
      const item = links[p.key];
      if (item && item.enabled) {
        const trimmed = (item.url || '').trim();
        if (!trimmed) {
          setErrMsg(`Platform '${p.name}' is enabled but has an empty URL. Please provide a valid URL or disable it.`);
          setSaving(false);
          return;
        }
        const lower = trimmed.toLowerCase();
        if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
          setErrMsg(`Platform '${p.name}' contains an unsafe URL protocol.`);
          setSaving(false);
          return;
        }
      }
    }

    const payload = PLATFORMS.map(p => ({
      platform: p.key,
      url: (links[p.key]?.url || '').trim(),
      enabled: Boolean(links[p.key]?.enabled && (links[p.key]?.url || '').trim())
    }));

    try {
      const res = await apiFetch('/api/admin/social-media-links', {
        method: 'POST',
        body: { socialMediaLinks: payload },
        isAdmin: true
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg('Social media profile links saved successfully! Footer updated.');
        // Update local cache for instant zero-flicker hydration
        if (data.socialMediaLinks) {
          localStorage.setItem('easydesk_cache_social_links', JSON.stringify(data.socialMediaLinks));
          try {
            window.dispatchEvent(new CustomEvent('easydesk_social_links_updated', { detail: data.socialMediaLinks }));
          } catch {}
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        setErrMsg(errorData.message || 'Failed to save social media links.');
      }
    } catch (err: any) {
      setErrMsg(err.message || 'Error saving social media links.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center text-slate-400 text-xs font-sans shadow-sm">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        Loading Social Media Links CMS...
      </div>
    );
  }

  const enabledCount = PLATFORMS.filter(p => links[p.key]?.enabled && links[p.key]?.url?.trim()).length;

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6 font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
              Public Website CMS
            </span>
            <span className="text-slate-400 text-xs">• Footer Profile Links</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1">Social Media Links</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure official social profiles for EasyDesk. Enabled links appear with official icons in the website Footer.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            Active: <strong className="text-blue-600">{enabledCount}</strong> / {PLATFORMS.length}
          </span>
          <button
            type="button"
            onClick={fetchSocialLinks}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="Reload from server"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{msg}</span>
        </div>
      )}

      {errMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-2xl flex items-center gap-2 text-xs animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="font-medium">{errMsg}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-3">
          {PLATFORMS.map((platform) => {
            const current = links[platform.key] || { url: '', enabled: false };
            const isEnabled = Boolean(current.enabled);

            return (
              <div 
                key={platform.key}
                className={`border rounded-2xl p-4 transition-all duration-150 ${
                  isEnabled ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-50/70 border-slate-200/60 opacity-80'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  
                  {/* Platform Brand */}
                  <div className="flex items-center gap-3 min-w-[170px]">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${platform.badgeBg} ${platform.accentBorder} border`}>
                      {platform.iconSvg}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 leading-tight">{platform.name}</h4>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        isEnabled ? 'text-emerald-600' : 'text-slate-400'
                      }`}>
                        {isEnabled ? '● Active' : '○ Disabled'}
                      </span>
                    </div>
                  </div>

                  {/* URL Input */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="url"
                      value={current.url}
                      onChange={(e) => handleUrlChange(platform.key, e.target.value)}
                      placeholder={platform.placeholder}
                      className={`w-full border rounded-xl px-3.5 py-2 text-xs outline-none transition font-sans ${
                        isEnabled 
                          ? 'border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 font-medium' 
                          : 'border-slate-200/80 bg-slate-100/80 text-slate-500 placeholder-slate-400'
                      }`}
                    />
                  </div>

                  {/* Toggle & External Test Button */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {current.url && isEnabled && (
                      <a
                        href={current.url.startsWith('http') ? current.url : `https://${current.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition cursor-pointer"
                        title="Test link in new tab"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleEnabled(platform.key)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                        isEnabled
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                      }`}
                    >
                      <span>{isEnabled ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-400 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>Only enabled platforms with valid URLs appear in the public Footer.</span>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Links...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>

    </div>
  );
}
