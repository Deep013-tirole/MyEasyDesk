import React, { useState, useEffect } from 'react';
import { 
  Building2, UserCheck, Users, Plus, Trash2, Edit, 
  CheckCircle2, AlertCircle, Save, Layers, HelpCircle, FileText,
  Eye, Compass, Target, Sparkles, Award, Star, Globe2, Zap, Lock, ShieldCheck, Heart
} from 'lucide-react';
import { apiFetch } from '../../lib/apiClient.js';
import { MediaInput } from './MediaInput';

export default function AboutUsAdminModule() {
  const [activeSubTab, setActiveSubTab] = useState<'content' | 'founder' | 'team' | 'preview'>('content');

  // Loaded states
  const [aboutUs, setAboutUs] = useState<any>({
    aboutText: '',
    vision: '',
    mission: '',
    coreValues: [],
    whyChooseUs: [],
    howItWorks: [],
    achievements: [],
    serviceAreas: []
  });

  const [founder, setFounder] = useState<any>({
    name: '',
    designation: '',
    photoUrl: '',
    shortBio: '',
    detailedBio: '',
    founderMessage: '',
    signatureUrl: '',
    email: '',
    socialLinks: { linkedin: '', twitter: '', facebook: '' }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const fetchAllAboutData = async () => {
    try {
      const res = await fetch(`/api/about?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.aboutUs) setAboutUs(data.aboutUs);
        if (data?.founder) setFounder(data.founder);
        return;
      }
    } catch (err) {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        console.warn('Failed fetching about data via API:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAboutData();
  }, []);

  const handleSaveAboutContent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    setErrMsg('');

    try {
      const res = await apiFetch('/api/admin/about', {
        method: 'POST',
        body: { aboutUs },
        isAdmin: true
      });

      if (res.ok) {
        setMsg('About Us CMS content updated successfully!');
      } else {
        const errorData = await res.json().catch(() => ({}));
        setErrMsg(errorData.message || 'Failed to save About Us content.');
      }
    } catch (err: any) {
      setErrMsg(err.message || 'Error saving About Us content.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFounder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    setErrMsg('');

    try {
      const res = await apiFetch('/api/admin/founder', {
        method: 'POST',
        body: { founder },
        isAdmin: true
      });

      if (res.ok) {
        setMsg('Founder profile & message saved successfully!');
      } else {
        const errorData = await res.json().catch(() => ({}));
        setErrMsg(errorData.message || 'Failed to save founder details.');
      }
    } catch (err: any) {
      setErrMsg(err.message || 'Error saving founder details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs font-sans">
        <div className="w-8 h-8 border-4 border-[#0F4C81] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <span>Loading About Us Configuration...</span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 font-sans">
      
      {/* Module Title & Bootstrap Pills Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-100 text-[#0F4C81] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Bootstrap CMS Module
            </span>
            <span className="text-slate-400 text-xs font-medium">• Public Portal Story & Mission</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">About Us Module Settings</h2>
        </div>

        {/* Bootstrap Nav-Pills Style Tab Selector */}
        <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-2xl gap-1 shadow-inner">
          <button
            onClick={() => setActiveSubTab('content')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'content' 
                ? 'bg-white text-[#0F4C81] shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Page Content</span>
          </button>

          <button
            onClick={() => setActiveSubTab('founder')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'founder' 
                ? 'bg-white text-[#0F4C81] shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Founder Profile</span>
          </button>

          <button
            onClick={() => setActiveSubTab('team')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'team' 
                ? 'bg-white text-[#0F4C81] shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Team Metrics</span>
          </button>

          <button
            onClick={() => setActiveSubTab('preview')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'preview' 
                ? 'bg-[#0F4C81] text-white shadow-sm' 
                : 'text-slate-600 hover:text-[#0F4C81] hover:bg-slate-200/60'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Live Card Preview</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs flex items-center gap-2.5 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold">{msg}</span>
        </div>
      )}

      {errMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl flex items-center gap-2.5 text-xs shadow-2xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="font-bold">{errMsg}</span>
        </div>
      )}

      {/* Sub-tab 1: Main Content CMS */}
      {activeSubTab === 'content' && (
        <form onSubmit={handleSaveAboutContent} className="space-y-6 text-xs">
          
          {/* Main Text */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
              Company Overview & Primary About Us Statement
            </label>
            <textarea
              rows={4}
              value={aboutUs.aboutText || ''}
              onChange={(e) => setAboutUs({ ...aboutUs, aboutText: e.target.value })}
              placeholder="Provide a comprehensive summary of EasyDesk mission, citizen support coverage, and values..."
              className="w-full border border-slate-200 rounded-2xl p-3.5 focus:ring-2 focus:ring-blue-500 outline-none transition text-slate-800 bg-slate-50/50 hover:bg-white"
            />
          </div>

          {/* Vision and Mission Grid */}
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-1.5 p-4 rounded-2xl bg-blue-50/50 border border-blue-100 hover-lift-sm transition">
              <div className="flex items-center gap-2 text-[#0F4C81]">
                <Compass className="w-4 h-4" />
                <label className="text-[11px] font-black uppercase tracking-wider">Our Vision Statement</label>
              </div>
              <textarea
                rows={3}
                value={aboutUs.vision || ''}
                onChange={(e) => setAboutUs({ ...aboutUs, vision: e.target.value })}
                placeholder="Our long term goal: To empower every citizen with effortless, paperless service desk support..."
                className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 bg-white"
              />
            </div>

            <div className="space-y-1.5 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 hover-lift-sm transition">
              <div className="flex items-center gap-2 text-emerald-700">
                <Target className="w-4 h-4" />
                <label className="text-[11px] font-black uppercase tracking-wider">Our Mission Statement</label>
              </div>
              <textarea
                rows={3}
                value={aboutUs.mission || ''}
                onChange={(e) => setAboutUs({ ...aboutUs, mission: e.target.value })}
                placeholder="Our daily commitment: To eliminate physical queue delays through automated document audits..."
                className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 bg-white"
              />
            </div>
          </div>

          {/* Service Areas */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                Regional Service Hub Areas (Comma-separated)
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Displayed as interactive badges on About Us</span>
            </div>
            <input
              type="text"
              value={Array.isArray(aboutUs.serviceAreas) ? aboutUs.serviceAreas.join(', ') : aboutUs.serviceAreas || ''}
              onChange={(e) => setAboutUs({ ...aboutUs, serviceAreas: e.target.value.split(',').map((s: string) => s.trim()) })}
              placeholder="e.g. National Capital Region (Delhi NCR), Maharashtra (Mumbai, Pune), Karnataka (Bengaluru)"
              className="w-full border border-slate-200 rounded-2xl p-3.5 focus:ring-2 focus:ring-blue-500 outline-none transition text-slate-800 bg-slate-50/50 hover:bg-white"
            />
          </div>

          <div className="border-t border-slate-100 pt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="hover-lift bg-[#0F4C81] hover:bg-blue-800 text-white font-extrabold px-6 py-3 rounded-2xl transition cursor-pointer flex items-center gap-2 shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Changes...' : 'Save Page Content'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Sub-tab 2: Founder Details */}
      {activeSubTab === 'founder' && (
        <form onSubmit={handleSaveFounder} className="space-y-5 text-xs">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">Founder Full Name *</label>
              <input
                type="text"
                required
                value={founder.name || ''}
                onChange={(e) => setFounder({ ...founder, name: e.target.value })}
                placeholder="e.g. Deepak Kumar"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50/50 hover:bg-white transition font-bold text-slate-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">Designation / Title *</label>
              <input
                type="text"
                required
                value={founder.designation || ''}
                onChange={(e) => setFounder({ ...founder, designation: e.target.value })}
                placeholder="e.g. Founder & Chief Operations Director"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50/50 hover:bg-white transition text-slate-800"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <MediaInput
              label="Founder Portrait Asset"
              value={founder.photoUrl || ''}
              onChange={(url) => setFounder({ ...founder, photoUrl: url })}
              placeholder="Select founder portrait..."
              allowedTypes={['image']}
            />

            <MediaInput
              label="Official Signature Asset"
              value={founder.signatureUrl || ''}
              onChange={(url) => setFounder({ ...founder, signatureUrl: url })}
              placeholder="Select founder signature asset..."
              allowedTypes={['image']}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
              Founder Message / Note to Citizens
            </label>
            <textarea
              rows={3}
              value={founder.founderMessage || ''}
              onChange={(e) => setFounder({ ...founder, founderMessage: e.target.value })}
              placeholder="Quote displayed prominently with quotation styling in executive spotlight..."
              className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50/50 hover:bg-white transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
              Detailed Professional Biography
            </label>
            <textarea
              rows={4}
              value={founder.detailedBio || ''}
              onChange={(e) => setFounder({ ...founder, detailedBio: e.target.value })}
              placeholder="Detailed background, years in e-governance, and citizen service history..."
              className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50/50 hover:bg-white transition"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">Executive Email</label>
              <input
                type="email"
                value={founder.email || ''}
                onChange={(e) => setFounder({ ...founder, email: e.target.value })}
                placeholder="contact@easydesk.in"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">LinkedIn Profile URL</label>
              <input
                type="url"
                value={founder.socialLinks?.linkedin || ''}
                onChange={(e) => setFounder({ 
                  ...founder, 
                  socialLinks: { ...(founder.socialLinks || {}), linkedin: e.target.value } 
                })}
                placeholder="https://linkedin.com/in/..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="hover-lift bg-[#0F4C81] hover:bg-blue-800 text-white font-extrabold px-6 py-3 rounded-2xl transition cursor-pointer flex items-center gap-2 shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Changes...' : 'Save Founder Profile'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Sub-tab 3: Aggregate Team Statistics */}
      {activeSubTab === 'team' && (
        <form onSubmit={handleSaveAboutContent} className="space-y-6 text-xs">
          <div className="hover-lift-sm bg-blue-50/70 border border-blue-200/80 p-5 rounded-2xl flex items-start gap-3.5 text-slate-700">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-slate-900 text-sm">Public Aggregate Team Statistics & Metrics</h4>
              <p className="text-[11px] leading-relaxed text-slate-600">
                To protect staff privacy, individual employee records are held securely in the internal <strong>Employee Directory</strong>. The public website showcases the aggregate numbers configured here.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover-lift-sm transition">
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                Desk Personnel Count
              </label>
              <input
                type="number"
                min="1"
                value={aboutUs.teamStats?.employeeCount || aboutUs.teamStats?.approximateEmployeeCount || 48}
                onChange={(e) => setAboutUs({
                  ...aboutUs,
                  teamStats: {
                    ...(aboutUs.teamStats || {}),
                    employeeCount: Number(e.target.value),
                    approximateEmployeeCount: Number(e.target.value)
                  }
                })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-black text-slate-900 text-lg bg-white"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Active desk officers</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover-lift-sm transition">
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                Certified Auditors
              </label>
              <input
                type="number"
                min="0"
                value={aboutUs.teamStats?.trainedEmployeeCount || aboutUs.teamStats?.trainedQualifiedCount || 42}
                onChange={(e) => setAboutUs({
                  ...aboutUs,
                  teamStats: {
                    ...(aboutUs.teamStats || {}),
                    trainedEmployeeCount: Number(e.target.value),
                    trainedQualifiedCount: Number(e.target.value)
                  }
                })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 font-black text-emerald-600 text-lg bg-white"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">E-Gov qualified</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover-lift-sm transition">
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                Combined Years Experience
              </label>
              <input
                type="number"
                min="0"
                value={aboutUs.teamStats?.combinedExperienceYears || 120}
                onChange={(e) => setAboutUs({
                  ...aboutUs,
                  teamStats: {
                    ...(aboutUs.teamStats || {}),
                    combinedExperienceYears: Number(e.target.value)
                  }
                })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500 font-black text-amber-600 text-lg bg-white"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Total industry tenure</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover-lift-sm transition">
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                Support Hubs / Branches
              </label>
              <input
                type="number"
                min="1"
                value={aboutUs.teamStats?.officesCount || 6}
                onChange={(e) => setAboutUs({
                  ...aboutUs,
                  teamStats: {
                    ...(aboutUs.teamStats || {}),
                    officesCount: Number(e.target.value)
                  }
                })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500 font-black text-teal-600 text-lg bg-white"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Metro operational hubs</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
              Team Operational Narrative & Description
            </label>
            <textarea
              rows={3}
              value={aboutUs.teamStats?.description || aboutUs.teamStats?.teamDescription || ''}
              onChange={(e) => setAboutUs({
                ...aboutUs,
                teamStats: {
                  ...(aboutUs.teamStats || {}),
                  description: e.target.value,
                  teamDescription: e.target.value
                }
              })}
              placeholder="e.g. Our certified desk officers, legal documentation auditors, and technology engineers are dedicated to making citizen services effortless, transparent, and prompt."
              className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 hover:bg-white transition"
            />
          </div>

          <div className="border-t border-slate-100 pt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="hover-lift bg-[#0F4C81] hover:bg-blue-800 text-white font-extrabold px-6 py-3 rounded-2xl transition cursor-pointer flex items-center gap-2 shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Changes...' : 'Save Aggregate Team Metrics'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Sub-tab 4: Live Card Preview */}
      {activeSubTab === 'preview' && (
        <div className="space-y-6 pt-2">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Live Preview of Vision, Mission & Founder Elements</span>
            <span className="text-[10px] bg-blue-100 text-[#0F4C81] font-bold px-2 py-0.5 rounded-md">Realtime Render</span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="hover-lift bg-[#0F4C81] text-white p-6 rounded-3xl space-y-2">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold">
                <Compass className="w-5 h-5 text-blue-200" />
              </div>
              <h4 className="font-black text-lg text-white">Our Vision</h4>
              <p className="text-xs text-blue-100 leading-relaxed">{aboutUs.vision || 'Vision placeholder...'}</p>
            </div>

            <div className="hover-lift bg-white border border-slate-200 p-6 rounded-3xl space-y-2 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Target className="w-5 h-5 text-emerald-600" />
              </div>
              <h4 className="font-black text-lg text-slate-900">Our Mission</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{aboutUs.mission || 'Mission placeholder...'}</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
