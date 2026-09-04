import React, { useState, useEffect } from 'react';
import { 
  Phone, Mail, MapPin, Clock, Save, MessageSquare, 
  CheckCircle2, AlertCircle, Search, Filter, Check, Shield 
} from 'lucide-react';
import { apiFetch } from '../../lib/apiClient.js';
import { updateCachedContactSettings } from '../../lib/whatsapp.js';

export default function ContactUsAdminModule() {
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'messages'>('settings');

  const [contactSettings, setContactSettings] = useState<any>({
    companyName: '',
    phone: '',
    whatsapp: '',
    email: '',
    alternateEmail: '',
    address: '',
    city: '',
    state: '',
    pinCode: '',
    workingHours: '',
    googleMapsUrl: '',
    socialMedia: { facebook: '', instagram: '', youtube: '', linkedin: '', twitter: '' }
  });

  const [messages, setMessages] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const [search, setSearch] = useState('');

  const fetchContactModuleData = async () => {
    try {
      const res = await fetch(`/api/contact-settings?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') setContactSettings(data);
      }

      const msgRes = await fetch(`/api/admin/contact-messages?_t=${Date.now()}`);
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        if (Array.isArray(msgData)) setMessages(msgData);
      }
    } catch (err) {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        console.warn('Failed loading contact module data:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContactModuleData();
  }, []);

  const handleSaveContactSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    setErrMsg('');

    try {
      const res = await apiFetch('/api/admin/contact-settings', {
        method: 'POST',
        body: { contactSettings },
        isAdmin: true
      });

      if (res.ok) {
        const responseData = await res.json().catch(() => ({}));
        const updated = responseData.contactSettings || contactSettings;
        updateCachedContactSettings(updated);
        setMsg('Contact details and official address saved successfully!');
      } else {
        const errorData = await res.json().catch(() => ({}));
        setErrMsg(errorData.message || 'Failed to save contact settings.');
      }
    } catch (err: any) {
      setErrMsg(err.message || 'Error saving contact settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMessageStatus = async (id: string, newStatus: string) => {
    try {
      const res = await apiFetch(`/api/admin/contact-messages/${id}`, {
        method: 'PATCH',
        body: { status: newStatus },
        isAdmin: true
      });

      if (res.ok) {
        setMsg(`Message marked as ${newStatus}`);
        fetchContactModuleData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        setErrMsg(errorData.message || 'Failed updating message status.');
      }
    } catch (err: any) {
      setErrMsg(err.message || 'Failed updating message status.');
    }
  };

  const filteredMessages = messages.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    m.subject.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs font-sans">
        Loading Contact Us Module...
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6 font-sans">
      
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
              Modular Architecture
            </span>
            <span className="text-slate-400 text-xs">• Dedicated Module 2</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1">Contact Us Module</h2>
        </div>

        {/* Sub-tabs */}
        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
          <button
            onClick={() => setActiveSubTab('settings')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'settings' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Contact Info Settings
          </button>
          <button
            onClick={() => setActiveSubTab('messages')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'messages' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Inquiries Inbox</span>
            <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-mono">
              {messages.filter(m => m.status === 'New').length}
            </span>
          </button>
        </div>
      </div>

      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-3.5 rounded-2xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {errMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-2xl flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errMsg}</span>
        </div>
      )}

      {/* Sub-tab 1: Contact Details Form */}
      {activeSubTab === 'settings' && (
        <form onSubmit={handleSaveContactSettings} className="space-y-4 text-xs">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Company / Entity Name *</label>
            <input
              type="text"
              required
              value={contactSettings.companyName}
              onChange={(e) => setContactSettings({ ...contactSettings, companyName: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Phone Number *</label>
              <input
                type="text"
                required
                value={contactSettings.phone}
                onChange={(e) => setContactSettings({ ...contactSettings, phone: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">WhatsApp Helpdesk Number</label>
              <input
                type="text"
                value={contactSettings.whatsapp}
                onChange={(e) => setContactSettings({ ...contactSettings, whatsapp: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Primary Email *</label>
              <input
                type="email"
                required
                value={contactSettings.email}
                onChange={(e) => setContactSettings({ ...contactSettings, email: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Alternate / Escalation Email</label>
              <input
                type="email"
                value={contactSettings.alternateEmail || ''}
                onChange={(e) => setContactSettings({ ...contactSettings, alternateEmail: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Office Street Address *</label>
              <input
                type="text"
                required
                value={contactSettings.address}
                onChange={(e) => setContactSettings({ ...contactSettings, address: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">City *</label>
              <input
                type="text"
                required
                value={contactSettings.city}
                onChange={(e) => setContactSettings({ ...contactSettings, city: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">State *</label>
              <input
                type="text"
                required
                value={contactSettings.state}
                onChange={(e) => setContactSettings({ ...contactSettings, state: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">PIN Code *</label>
              <input
                type="text"
                required
                value={contactSettings.pinCode}
                onChange={(e) => setContactSettings({ ...contactSettings, pinCode: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Operating Working Hours</label>
            <input
              type="text"
              value={contactSettings.workingHours}
              onChange={(e) => setContactSettings({ ...contactSettings, workingHours: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Google Maps Location Link URL</label>
            <input
              type="text"
              value={contactSettings.googleMapsUrl || ''}
              onChange={(e) => setContactSettings({ ...contactSettings, googleMapsUrl: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="border-t border-slate-100 pt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Contact Details'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Sub-tab 2: Contact Inquiries Inbox */}
      {activeSubTab === 'messages' && (
        <div className="space-y-4 text-xs">
          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search inquiries by name, email, subject..."
                className="bg-transparent outline-none text-xs w-64"
              />
            </div>
            <span className="text-slate-400 text-[11px] font-bold">Total: {filteredMessages.length} inquiries</span>
          </div>

          <div className="space-y-3">
            {filteredMessages.map(m => (
              <div key={m.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">{m.name}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">{m.email} • Phone: {m.phone || 'N/A'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                      m.status === 'New' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {m.status}
                    </span>

                    {m.status === 'New' && (
                      <button
                        onClick={() => handleUpdateMessageStatus(m.id, 'Replied')}
                        className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition"
                      >
                        Mark Replied
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                  <span className="font-bold text-xs text-blue-600 block">Topic: {m.subject}</span>
                  <p className="text-xs text-slate-700 leading-relaxed">{m.message}</p>
                </div>

                <div className="text-[10px] text-slate-400 text-right">
                  Received: {new Date(m.createdAt).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
