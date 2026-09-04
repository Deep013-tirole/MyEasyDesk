import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, Lock, EyeOff, Save, Plus, Trash2, 
  CheckCircle2, AlertTriangle, FileText, Phone, Mail, Clock, MapPin, 
  RefreshCw, Check, X, FileSpreadsheet, Layers, Info
} from 'lucide-react';
import { PrivacySecurityData } from '../PrivacySecurityView.js';

export default function PrivacySecurityAdminModule() {
  const [data, setData] = useState<PrivacySecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');

  // Subtabs
  const [activeSubtab, setActiveSubtab] = useState<'hero' | 'requests' | 'protection' | 'retention' | 'scam' | 'faqs' | 'reports'>('hero');

  // Customer Incident Reports & Purge Requests
  const [scamReports, setScamReports] = useState<any[]>([]);
  const [purgeRequests, setPurgeRequests] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        fetch(`/api/privacy-security?_t=${Date.now()}`),
        fetch(`/api/admin/scam-reports?_t=${Date.now()}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('easydesk_admin_token')}` }
        }),
        fetch(`/api/admin/data-deletion-requests?_t=${Date.now()}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('easydesk_admin_token')}` }
        })
      ]);

      const [resConfig, resScams, resPurges] = results;

      if (resConfig.status === 'fulfilled' && resConfig.value.ok) {
        const json = await resConfig.value.json();
        if (json && typeof json === 'object') setData(json);
      }
      if (resScams.status === 'fulfilled' && resScams.value.ok) {
        const jsonScams = await resScams.value.json();
        if (Array.isArray(jsonScams)) setScamReports(jsonScams);
      }
      if (resPurges.status === 'fulfilled' && resPurges.value.ok) {
        const jsonPurges = await resPurges.value.json();
        if (Array.isArray(jsonPurges)) setPurgeRequests(jsonPurges);
      }
    } catch (err) {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        console.warn('Failed to load Privacy Admin content:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setSaveSuccess('');
    try {
      const adminUser = JSON.parse(localStorage.getItem('easydesk_admin_user') || '{}');
      const res = await fetch('/api/admin/privacy-security', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('easydesk_admin_token')}`
        },
        body: JSON.stringify({
          privacySecuritySettings: data,
          updaterId: adminUser.id || 'admin-1',
          updaterName: adminUser.name || 'Admin',
          updaterRole: adminUser.role || 'ADMIN'
        })
      });

      if (res.ok) {
        setSaveSuccess('Privacy & Security CMS settings saved successfully!');
        setTimeout(() => setSaveSuccess(''), 3500);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateScamStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/scam-reports/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('easydesk_admin_token')}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setScamReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePurgeStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/data-deletion-requests/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('easydesk_admin_token')}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setPurgeRequests(prev => prev.map(p => p.id === id ? { ...p, status } : p));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span>Loading Privacy & Security CMS Module...</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider bg-blue-50 px-2.5 py-1 rounded-full">
            CMS Module
          </span>
          <h2 className="text-xl font-black text-slate-900 mt-1 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            Privacy, Security Notice & Data Protection CMS
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage public security guidelines, allowed/never-requested items, data retention rules, and customer fraud reports.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving Changes...' : 'Save CMS Settings'}
        </button>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {saveSuccess}
        </div>
      )}

      {/* Subtabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'hero', label: '1. Hero & Trust Cards' },
          { id: 'requests', label: '2. Allowed & NEVER Ask List' },
          { id: 'protection', label: '3. Data Protection & Usage' },
          { id: 'retention', label: '4. Retention & Checklist' },
          { id: 'scam', label: '5. Scam Guide & Contact' },
          { id: 'faqs', label: '6. FAQs & Legal' },
          { id: 'reports', label: `7. Fraud Reports (${scamReports.length}) & Purges (${purgeRequests.length})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubtab(tab.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubtab === tab.id 
                ? 'bg-blue-600 text-white shadow' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUBTAB 1: HERO & TRUST CARDS */}
      {activeSubtab === 'hero' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 space-y-6">
          <h3 className="font-bold text-sm text-slate-900 border-b pb-2">Hero Header & Badge</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Badge Text</label>
              <input 
                type="text" 
                value={data.hero.badgeText}
                onChange={e => setData({ ...data, hero: { ...data.hero, badgeText: e.target.value } })}
                className="w-full bg-slate-50 border rounded-xl p-2.5 font-semibold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Main Heading</label>
              <input 
                type="text" 
                value={data.hero.heading}
                onChange={e => setData({ ...data, hero: { ...data.hero, heading: e.target.value } })}
                className="w-full bg-slate-50 border rounded-xl p-2.5 font-semibold text-slate-800"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Subtitle Description</label>
              <textarea 
                rows={2}
                value={data.hero.subtitle}
                onChange={e => setData({ ...data, hero: { ...data.hero, subtitle: e.target.value } })}
                className="w-full bg-slate-50 border rounded-xl p-2.5 font-semibold text-slate-800"
              />
            </div>
          </div>

          <div className="pt-4 border-t space-y-3">
            <h4 className="font-bold text-xs text-slate-800">Trust Badges Cards (5 Cards)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.hero.trustCards.map((tc, idx) => (
                <div key={tc.id} className="bg-slate-50 p-3 rounded-xl border space-y-2 text-xs">
                  <input 
                    type="text" 
                    value={tc.title} 
                    onChange={e => {
                      const updated = [...data.hero.trustCards];
                      updated[idx].title = e.target.value;
                      setData({ ...data, hero: { ...data.hero, trustCards: updated } });
                    }}
                    placeholder="Card Title"
                    className="w-full bg-white border rounded-lg p-2 font-bold"
                  />
                  <input 
                    type="text" 
                    value={tc.description} 
                    onChange={e => {
                      const updated = [...data.hero.trustCards];
                      updated[idx].description = e.target.value;
                      setData({ ...data, hero: { ...data.hero, trustCards: updated } });
                    }}
                    placeholder="Short description"
                    className="w-full bg-white border rounded-lg p-2 text-slate-600"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: ALLOWED & NEVER REQUESTED ITEMS */}
      {activeSubtab === 'requests' && (
        <div className="space-y-6">
          
          {/* May Request Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b pb-2">Information We May Request</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Section Title</label>
                <input 
                  type="text" 
                  value={data.mayRequest.title}
                  onChange={e => setData({ ...data, mayRequest: { ...data.mayRequest, title: e.target.value } })}
                  className="w-full bg-slate-50 border rounded-xl p-2.5 font-semibold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Subtitle</label>
                <input 
                  type="text" 
                  value={data.mayRequest.subtitle}
                  onChange={e => setData({ ...data, mayRequest: { ...data.mayRequest, subtitle: e.target.value } })}
                  className="w-full bg-slate-50 border rounded-xl p-2.5 font-semibold text-slate-800"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-amber-700 uppercase mb-1">Important Callout Note</label>
                <textarea 
                  rows={2}
                  value={data.mayRequest.importantNote}
                  onChange={e => setData({ ...data, mayRequest: { ...data.mayRequest, importantNote: e.target.value } })}
                  className="w-full bg-amber-50 border border-amber-200 rounded-xl p-2.5 font-semibold text-amber-900"
                />
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-800">Allowed Info Items List</h4>
                <button 
                  onClick={() => {
                    const newItem = { id: `mr-${Date.now()}`, name: 'New Info Category', examples: 'Details...', category: 'General', icon: 'FileText' };
                    setData({ ...data, mayRequest: { ...data.mayRequest, items: [...data.mayRequest.items, newItem] } });
                  }}
                  className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-lg font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.mayRequest.items.map((item, idx) => (
                  <div key={item.id} className="bg-slate-50 p-3 rounded-xl border text-xs space-y-2 relative">
                    <button 
                      onClick={() => {
                        const updated = data.mayRequest.items.filter((_, i) => i !== idx);
                        setData({ ...data, mayRequest: { ...data.mayRequest, items: updated } });
                      }}
                      className="absolute top-2 right-2 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <input 
                      type="text" 
                      value={item.name} 
                      onChange={e => {
                        const updated = [...data.mayRequest.items];
                        updated[idx].name = e.target.value;
                        setData({ ...data, mayRequest: { ...data.mayRequest, items: updated } });
                      }}
                      className="w-full bg-white border rounded-lg p-2 font-bold pr-8"
                    />
                    <input 
                      type="text" 
                      value={item.examples} 
                      onChange={e => {
                        const updated = [...data.mayRequest.items];
                        updated[idx].examples = e.target.value;
                        setData({ ...data, mayRequest: { ...data.mayRequest, items: updated } });
                      }}
                      className="w-full bg-white border rounded-lg p-2 text-slate-600"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* NEVER Request Section */}
          <div className="bg-red-50 p-6 rounded-2xl border border-red-200 space-y-4">
            <h3 className="font-bold text-sm text-red-900 border-b border-red-200 pb-2">Information EasyDesk WILL NEVER ASK FOR</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-red-700 uppercase mb-1">Section Title</label>
                <input 
                  type="text" 
                  value={data.neverRequest.title}
                  onChange={e => setData({ ...data, neverRequest: { ...data.neverRequest, title: e.target.value } })}
                  className="w-full bg-white border rounded-xl p-2.5 font-semibold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-red-700 uppercase mb-1">Warning Heading</label>
                <input 
                  type="text" 
                  value={data.neverRequest.warningHeading}
                  onChange={e => setData({ ...data, neverRequest: { ...data.neverRequest, warningHeading: e.target.value } })}
                  className="w-full bg-white border rounded-xl p-2.5 font-semibold text-slate-800"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-red-700 uppercase mb-1">Large Warning Banner Text</label>
                <input 
                  type="text" 
                  value={data.neverRequest.largeWarning}
                  onChange={e => setData({ ...data, neverRequest: { ...data.neverRequest, largeWarning: e.target.value } })}
                  className="w-full bg-white border rounded-xl p-2.5 font-bold text-red-900"
                />
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <label className="block text-[10px] font-bold text-red-800 uppercase">
                Red Alert Secret Items List (Comma separated or click to delete)
              </label>
              <div className="flex flex-wrap gap-2 bg-white p-4 rounded-xl border border-red-200">
                {data.neverRequest.redItems.map((red, idx) => (
                  <span key={idx} className="bg-red-100 text-red-800 font-bold text-xs px-2.5 py-1 rounded-lg border border-red-200 flex items-center gap-1.5">
                    {red}
                    <button 
                      onClick={() => {
                        const updated = data.neverRequest.redItems.filter((_, i) => i !== idx);
                        setData({ ...data, neverRequest: { ...data.neverRequest, redItems: updated } });
                      }}
                      className="text-red-500 hover:text-red-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input 
                  type="text" 
                  id="new-red-item"
                  placeholder="Add secret item (e.g. Wallet PIN)"
                  className="bg-white border text-xs p-2 rounded-xl"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) {
                        setData({ ...data, neverRequest: { ...data.neverRequest, redItems: [...data.neverRequest.redItems, val] } });
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
                <span className="text-[10px] text-slate-400">Press Enter to add to list</span>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* SUBTAB 3: DATA PROTECTION & USAGE */}
      {activeSubtab === 'protection' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b pb-2">Data Protection Measures (12 Cards)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {data.dataProtection.measures.map((m, idx) => (
                <div key={m.id} className="bg-slate-50 p-3 rounded-xl border text-xs space-y-2">
                  <input 
                    type="text" 
                    value={m.title} 
                    onChange={e => {
                      const updated = [...data.dataProtection.measures];
                      updated[idx].title = e.target.value;
                      setData({ ...data, dataProtection: { ...data.dataProtection, measures: updated } });
                    }}
                    className="w-full bg-white border rounded-lg p-2 font-bold"
                  />
                  <textarea 
                    rows={2}
                    value={m.description} 
                    onChange={e => {
                      const updated = [...data.dataProtection.measures];
                      updated[idx].description = e.target.value;
                      setData({ ...data, dataProtection: { ...data.dataProtection, measures: updated } });
                    }}
                    className="w-full bg-white border rounded-lg p-2 text-slate-600"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b pb-2">Data Usage & Privacy Guarantees</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Never Sell Callout Statement</label>
                <input 
                  type="text" 
                  value={data.dataUsage.neverSellStatement}
                  onChange={e => setData({ ...data, dataUsage: { ...data.dataUsage, neverSellStatement: e.target.value } })}
                  className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 font-bold text-emerald-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Never Share Callout Statement</label>
                <input 
                  type="text" 
                  value={data.dataUsage.neverShareStatement}
                  onChange={e => setData({ ...data, dataUsage: { ...data.dataUsage, neverShareStatement: e.target.value } })}
                  className="w-full bg-blue-50 border border-blue-200 rounded-xl p-2.5 font-bold text-blue-900"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: RETENTION & CHECKLIST */}
      {activeSubtab === 'retention' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 space-y-6">
          <h3 className="font-bold text-sm text-slate-900 border-b pb-2">Retention Policy & Customer Rights</h3>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Retention Description</label>
              <textarea 
                rows={3}
                value={data.dataRetention.description}
                onChange={e => setData({ ...data, dataRetention: { ...data.dataRetention, description: e.target.value } })}
                className="w-full bg-slate-50 border rounded-xl p-2.5 font-semibold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Customer Rights Description</label>
              <textarea 
                rows={2}
                value={data.dataRetention.customerRights}
                onChange={e => setData({ ...data, dataRetention: { ...data.dataRetention, customerRights: e.target.value } })}
                className="w-full bg-slate-50 border rounded-xl p-2.5 font-semibold text-slate-800"
              />
            </div>
          </div>

          <div className="pt-4 border-t space-y-3">
            <h4 className="font-bold text-xs text-slate-800">Customer Security Checklist</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.customerResponsibilities.checklist.map((item, idx) => (
                <div key={item.id} className="bg-slate-50 p-3 rounded-xl border text-xs space-y-2">
                  <input 
                    type="text" 
                    value={item.title} 
                    onChange={e => {
                      const updated = [...data.customerResponsibilities.checklist];
                      updated[idx].title = e.target.value;
                      setData({ ...data, customerResponsibilities: { ...data.customerResponsibilities, checklist: updated } });
                    }}
                    className="w-full bg-white border rounded-lg p-2 font-bold"
                  />
                  <input 
                    type="text" 
                    value={item.description} 
                    onChange={e => {
                      const updated = [...data.customerResponsibilities.checklist];
                      updated[idx].description = e.target.value;
                      setData({ ...data, customerResponsibilities: { ...data.customerResponsibilities, checklist: updated } });
                    }}
                    className="w-full bg-white border rounded-lg p-2 text-slate-600"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: SCAM GUIDE & CONTACT */}
      {activeSubtab === 'scam' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b pb-2">Fraud Response Timeline (5 Steps)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {data.fraudTimeline.steps.map((st, idx) => (
                <div key={st.step} className="bg-slate-50 p-3 rounded-xl border text-xs space-y-2">
                  <span className="w-5 h-5 rounded-full bg-red-600 text-white font-bold text-[10px] flex items-center justify-center">
                    {st.step}
                  </span>
                  <input 
                    type="text" 
                    value={st.title} 
                    onChange={e => {
                      const updated = [...data.fraudTimeline.steps];
                      updated[idx].title = e.target.value;
                      setData({ ...data, fraudTimeline: { ...data.fraudTimeline, steps: updated } });
                    }}
                    className="w-full bg-white border rounded-lg p-2 font-bold"
                  />
                  <textarea 
                    rows={2}
                    value={st.description} 
                    onChange={e => {
                      const updated = [...data.fraudTimeline.steps];
                      updated[idx].description = e.target.value;
                      setData({ ...data, fraudTimeline: { ...data.fraudTimeline, steps: updated } });
                    }}
                    className="w-full bg-white border rounded-lg p-2 text-slate-600"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b pb-2">Security Team Contact Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Security Email</label>
                <input 
                  type="email" 
                  value={data.securityContact.securityEmail}
                  onChange={e => setData({ ...data, securityContact: { ...data.securityContact, securityEmail: e.target.value } })}
                  className="w-full bg-slate-50 border rounded-xl p-2.5 font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Customer Care Phone</label>
                <input 
                  type="text" 
                  value={data.securityContact.customerCarePhone}
                  onChange={e => setData({ ...data, securityContact: { ...data.securityContact, customerCarePhone: e.target.value } })}
                  className="w-full bg-slate-50 border rounded-xl p-2.5 font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-red-600 uppercase mb-1">Emergency Scam Hotline</label>
                <input 
                  type="text" 
                  value={data.securityContact.emergencyHotline}
                  onChange={e => setData({ ...data, securityContact: { ...data.securityContact, emergencyHotline: e.target.value } })}
                  className="w-full bg-red-50 border border-red-200 text-red-900 rounded-xl p-2.5 font-bold"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 6: FAQS & LEGAL */}
      {activeSubtab === 'faqs' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-900">Security & Privacy FAQs</h3>
              <button 
                onClick={() => {
                  const newFaq = { question: 'New Security Question?', answer: 'Answer details...' };
                  setData({ ...data, faqs: [...data.faqs, newFaq] });
                }}
                className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-lg font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add FAQ
              </button>
            </div>

            <div className="space-y-3">
              {data.faqs.map((faq, idx) => (
                <div key={idx} className="bg-slate-50 p-3.5 rounded-xl border text-xs space-y-2 relative">
                  <button 
                    onClick={() => {
                      const updated = data.faqs.filter((_, i) => i !== idx);
                      setData({ ...data, faqs: updated });
                    }}
                    className="absolute top-2.5 right-2.5 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <input 
                    type="text" 
                    value={faq.question} 
                    onChange={e => {
                      const updated = [...data.faqs];
                      updated[idx].question = e.target.value;
                      setData({ ...data, faqs: updated });
                    }}
                    className="w-full bg-white border rounded-lg p-2 font-bold pr-8"
                  />
                  <textarea 
                    rows={2}
                    value={faq.answer} 
                    onChange={e => {
                      const updated = [...data.faqs];
                      updated[idx].answer = e.target.value;
                      setData({ ...data, faqs: updated });
                    }}
                    className="w-full bg-white border rounded-lg p-2 text-slate-600"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b pb-2">Legal Compliance Statement</h3>
            <div>
              <textarea 
                rows={3}
                value={data.legalCompliance.statement}
                onChange={e => setData({ ...data, legalCompliance: { ...data.legalCompliance, statement: e.target.value } })}
                className="w-full bg-slate-50 border rounded-xl p-2.5 text-xs font-semibold text-slate-800"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 7: LIVE SCAM REPORTS & PURGE REQUESTS */}
      {activeSubtab === 'reports' && (
        <div className="space-y-6">
          
          {/* Scam Incident Reports Table */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm">
            <h3 className="font-bold text-sm text-slate-900 border-b pb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                Customer Scam Incident Reports
              </span>
              <span className="text-xs bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full">
                {scamReports.length} Reports
              </span>
            </h3>

            {scamReports.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No scam or impersonation reports recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b text-[10px] font-bold text-slate-500 uppercase">
                      <th className="p-3">Report ID / Date</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Impersonator Contact</th>
                      <th className="p-3">Channel</th>
                      <th className="p-3">Incident Details</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700">
                    {scamReports.map((scam) => (
                      <tr key={scam.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono text-[11px]">
                          <div className="font-bold text-slate-900">{scam.id}</div>
                          <div className="text-[10px] text-slate-400">{new Date(scam.createdAt).toLocaleDateString()}</div>
                        </td>
                        <td className="p-3 font-medium">
                          <div>{scam.reporterName}</div>
                          <div className="text-[10px] text-slate-400">{scam.reporterEmail || scam.reporterPhone}</div>
                        </td>
                        <td className="p-3 font-bold text-red-600">{scam.impersonatorContact}</td>
                        <td className="p-3">{scam.channelUsed}</td>
                        <td className="p-3 max-w-xs truncate text-slate-600">{scam.scamDetails}</td>
                        <td className="p-3">
                          <select 
                            value={scam.status} 
                            onChange={e => handleUpdateScamStatus(scam.id, e.target.value)}
                            className={`p-1.5 rounded-lg text-[10px] font-bold border ${
                              scam.status === 'Resolved' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-red-50 text-red-800 border-red-300'
                            }`}
                          >
                            <option value="Investigating">Investigating</option>
                            <option value="Escalated">Escalated</option>
                            <option value="Resolved">Resolved</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Data Deletion / Purge Requests Table */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm">
            <h3 className="font-bold text-sm text-slate-900 border-b pb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                Customer Data Purge / Deletion Requests
              </span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
                {purgeRequests.length} Requests
              </span>
            </h3>

            {purgeRequests.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No data purge requests recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b text-[10px] font-bold text-slate-500 uppercase">
                      <th className="p-3">Req ID / Date</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700">
                    {purgeRequests.map((purge) => (
                      <tr key={purge.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono text-[11px]">
                          <div className="font-bold text-slate-900">{purge.id}</div>
                          <div className="text-[10px] text-slate-400">{new Date(purge.createdAt).toLocaleDateString()}</div>
                        </td>
                        <td className="p-3 font-medium">
                          <div>{purge.customerName}</div>
                          <div className="text-[10px] text-slate-400">{purge.customerEmail}</div>
                        </td>
                        <td className="p-3 font-bold">{purge.orderId}</td>
                        <td className="p-3 max-w-xs truncate text-slate-600">{purge.reason}</td>
                        <td className="p-3">
                          <select 
                            value={purge.status} 
                            onChange={e => handleUpdatePurgeStatus(purge.id, e.target.value)}
                            className={`p-1.5 rounded-lg text-[10px] font-bold border ${
                              purge.status === 'Purged' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}
                          >
                            <option value="Pending Verification">Pending Verification</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Purged">Purged / Wiped</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
