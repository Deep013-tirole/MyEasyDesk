import React, { useState, useEffect } from 'react';
import { 
  Settings, Globe, Shield, Save, CheckCircle2, AlertCircle, RefreshCw, Key, ToggleLeft, ToggleRight,
  Database, Plus, Trash2, Edit3, Check, X, Layers, Briefcase, User, Mail, Phone, MessageSquare, MapPin, Clock, Lock
} from 'lucide-react';
import { apiFetch } from '../../lib/apiClient.js';
import { MediaInput } from './MediaInput';
import { normalizeWhatsAppNumber, updateCachedContactSettings } from '../../lib/whatsapp.js';
import { useScrollToTopOnChange } from '../../lib/scrollUtils.js';

export default function AdminSettingsModule() {
  const [activeTab, setActiveTab] = useState<'profile' | 'contact' | 'general'>('profile');

  // Reset scroll position on settings tab switch
  useScrollToTopOnChange([activeTab]);

  // Admin Profile & Credentials state
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Contact & WhatsApp state
  const [contactSettings, setContactSettings] = useState<any>({
    companyName: 'EasyDesk Digital Services',
    phone: '+91 98765 43210',
    whatsapp: '919876543210',
    whatsappEnabled: true,
    email: 'support@easydesk.com',
    alternateEmail: '',
    address: 'BKC Signature IT Park, Mumbai, Maharashtra 400051',
    city: 'Mumbai',
    state: 'Maharashtra',
    pinCode: '400051',
    workingHours: 'Mon - Sat: 9:00 AM - 7:00 PM IST',
    googleMapsUrl: ''
  });
  const [savingContact, setSavingContact] = useState(false);

  // General Settings state
  const [generalSettings, setGeneralSettings] = useState<any>({
    websiteName: 'EasyDesk',
    logoUrl: '',
    faviconUrl: '',
    tagline: '',
    seo: { metaTitle: '', metaDescription: '', keywords: '', googleAnalyticsId: '' },
    system: { maintenanceMode: false, notificationEmail: '' }
  });
  const [savingGeneral, setSavingGeneral] = useState(false);

  // Master Data state
  const [departments, setDepartments] = useState<string[]>([]);
  const [designations, setDesignations] = useState<string[]>([]);
  const [newDeptInput, setNewDeptInput] = useState('');
  const [newDesigInput, setNewDesigInput] = useState('');
  const [editingDeptIdx, setEditingDeptIdx] = useState<number | null>(null);
  const [editingDeptVal, setEditingDeptVal] = useState('');
  const [editingDesigIdx, setEditingDesigIdx] = useState<number | null>(null);
  const [editingDesigVal, setEditingDesigVal] = useState('');
  const [savingMaster, setSavingMaster] = useState(false);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const fetchAllSettings = async () => {
    try {
      const [resAdmin, resContact, resGen, resMaster] = await Promise.all([
        fetch('/api/auth/admin/me', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('easydesk_admin_token')}` }
        }).catch(() => null),
        fetch('/api/contact-settings').catch(() => null),
        fetch('/api/general-settings').catch(() => null),
        fetch('/api/master-data').catch(() => null)
      ]);

      if (resAdmin && resAdmin.ok) {
        const adminData = await resAdmin.json();
        if (adminData.user) {
          setAdminName(adminData.user.name || '');
          setAdminEmail(adminData.user.email || '');
        }
      } else {
        const savedAdmin = localStorage.getItem('easydesk_admin_user');
        if (savedAdmin) {
          try {
            const parsed = JSON.parse(savedAdmin);
            setAdminName(parsed.name || '');
            setAdminEmail(parsed.email || '');
          } catch (e) {}
        }
      }

      if (resContact && resContact.ok) {
        const cData = await resContact.json();
        if (cData && typeof cData === 'object') {
          setContactSettings({
            ...cData,
            whatsapp: normalizeWhatsAppNumber(cData.whatsapp || '919876543210')
          });
        }
      }

      if (resGen && resGen.ok) {
        const gData = await resGen.json();
        if (gData && typeof gData === 'object') setGeneralSettings(gData);
      }

      if (resMaster && resMaster.ok) {
        const mData = await resMaster.json();
        if (mData) {
          if (Array.isArray(mData.departments)) setDepartments(mData.departments);
          if (Array.isArray(mData.designations)) setDesignations(mData.designations);
        }
      }
    } catch (err) {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        console.warn('Failed fetching admin settings:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllSettings();
  }, []);

  // Save Admin Profile & Password Handler
  const handleSaveAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setMsg('');
    setErrMsg('');

    if (newPassword && newPassword !== confirmPassword) {
      setErrMsg('New password and confirmation password do not match.');
      setSavingProfile(false);
      return;
    }

    try {
      const res = await apiFetch('/api/admin/profile', {
        method: 'POST',
        body: {
          name: adminName,
          email: adminEmail,
          currentPassword,
          newPassword,
          confirmPassword
        },
        isAdmin: true
      });

      const data = await res.json();
      if (res.ok) {
        setMsg(data.message || 'Admin profile and login credentials updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (data.user) {
          localStorage.setItem('easydesk_admin_user', JSON.stringify(data.user));
        }
      } else {
        setErrMsg(data.message || 'Failed updating admin profile.');
      }
    } catch (err: any) {
      setErrMsg(err.message || 'Error updating admin profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Save Contact & WhatsApp Settings Handler
  const handleSaveContactSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingContact(true);
    setMsg('');
    setErrMsg('');

    const normalizedWa = normalizeWhatsAppNumber(contactSettings.whatsapp);
    const updatedSettings = { ...contactSettings, whatsapp: normalizedWa };

    try {
      const res = await apiFetch('/api/admin/contact-settings', {
        method: 'POST',
        body: { contactSettings: updatedSettings },
        isAdmin: true
      });

      const data = await res.json();
      if (res.ok) {
        setMsg('Contact details and WhatsApp Business settings saved successfully!');
        const finalSettings = data.contactSettings || updatedSettings;
        setContactSettings(finalSettings);
        updateCachedContactSettings(finalSettings);
      } else {
        setErrMsg(data.message || 'Failed to save contact settings.');
      }
    } catch (err: any) {
      setErrMsg(err.message || 'Error saving contact settings.');
    } finally {
      setSavingContact(false);
    }
  };

  // Save General Branding Settings Handler
  const handleSaveGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGeneral(true);
    setMsg('');
    setErrMsg('');

    try {
      const res = await apiFetch('/api/admin/general-settings', {
        method: 'POST',
        body: { generalSettings },
        isAdmin: true
      });

      if (res.ok) {
        setMsg('Admin General Settings saved successfully!');
      } else {
        const errorData = await res.json().catch(() => ({}));
        setErrMsg(errorData.message || 'Failed to save general settings.');
      }
    } catch (err: any) {
      setErrMsg(err.message || 'Error saving general settings.');
    } finally {
      setSavingGeneral(false);
    }
  };

  // Master Data Handlers
  const handleSaveMasterData = async (updatedDepts?: string[], updatedDesigs?: string[]) => {
    setSavingMaster(true);
    setMsg('');
    setErrMsg('');

    const targetDepts = updatedDepts || departments;
    const targetDesigs = updatedDesigs || designations;

    try {
      const res = await apiFetch('/api/admin/master-data', {
        method: 'POST',
        body: {
          departments: targetDepts,
          designations: targetDesigs
        },
        isAdmin: true
      });

      if (res.ok) {
        const data = await res.json();
        if (data.masterData) {
          setDepartments(data.masterData.departments || targetDepts);
          setDesignations(data.masterData.designations || targetDesigs);
        }
        setMsg('Department & Designation Master Data saved successfully!');
      } else {
        const errorData = await res.json().catch(() => ({}));
        setErrMsg(errorData.message || 'Failed to save master data.');
      }
    } catch (err: any) {
      setErrMsg(err.message || 'Error saving master data.');
    } finally {
      setSavingMaster(false);
    }
  };

  const handleAddDepartment = () => {
    const trimmed = newDeptInput.trim();
    if (!trimmed) return;
    if (departments.some(d => d.toLowerCase() === trimmed.toLowerCase())) {
      setErrMsg(`Department "${trimmed}" already exists.`);
      return;
    }
    const updated = [...departments, trimmed];
    setDepartments(updated);
    setNewDeptInput('');
    handleSaveMasterData(updated, designations);
  };

  const handleDeleteDepartment = (idx: number) => {
    const deptName = departments[idx];
    if (confirm(`Are you sure you want to remove department "${deptName}" from master records?`)) {
      const updated = departments.filter((_, i) => i !== idx);
      setDepartments(updated);
      handleSaveMasterData(updated, designations);
    }
  };

  const handleAddDesignation = () => {
    const trimmed = newDesigInput.trim();
    if (!trimmed) return;
    if (designations.some(d => d.toLowerCase() === trimmed.toLowerCase())) {
      setErrMsg(`Designation "${trimmed}" already exists.`);
      return;
    }
    const updated = [...designations, trimmed];
    setDesignations(updated);
    setNewDesigInput('');
    handleSaveMasterData(departments, updated);
  };

  const handleDeleteDesignation = (idx: number) => {
    const desigName = designations[idx];
    if (confirm(`Are you sure you want to remove designation "${desigName}" from master records?`)) {
      const updated = designations.filter((_, i) => i !== idx);
      setDesignations(updated);
      handleSaveMasterData(departments, updated);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs font-sans">
        Loading Admin Settings Module...
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6 font-sans">
      
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
              System Configuration
            </span>
            <span className="text-slate-400 text-xs">• EasyDesk Control Panel</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1">Admin Panel & WhatsApp Settings</h2>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto scrollbar-none text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => { setActiveTab('profile'); setMsg(''); setErrMsg(''); }}
            className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === 'profile' ? 'bg-white text-purple-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin Profile</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('contact'); setMsg(''); setErrMsg(''); }}
            className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === 'contact' ? 'bg-white text-purple-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Contact & WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('general'); setMsg(''); setErrMsg(''); }}
            className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === 'general' ? 'bg-white text-purple-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Branding & Master</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-3.5 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {errMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-2xl flex items-center gap-2 text-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errMsg}</span>
        </div>
      )}

      {/* TAB 1: ADMIN PROFILE & LOGIN CREDENTIALS */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveAdminProfile} className="space-y-6 text-xs animate-in fade-in">
          
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">Admin Profile & Security Settings</h3>
              </div>
              <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full">
                Account Status: Active
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Admin Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Enter admin name..."
                    className="w-full border border-slate-200 bg-white rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Admin Email Address *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="Enter admin email address..."
                    className="w-full border border-slate-200 bg-white rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Password Change Section */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-purple-600" />
                <h4 className="font-bold text-slate-900 text-xs">Change Password (Leave blank to keep current password)</h4>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Current Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full border border-slate-200 bg-white rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">New Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full border border-slate-200 bg-white rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-type new password"
                      className="w-full border border-slate-200 bg-white rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2 shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>{savingProfile ? 'Updating Credentials...' : 'Save Profile & Login Credentials'}</span>
            </button>
          </div>

        </form>
      )}

      {/* TAB 2: CONTACT & WHATSAPP CONFIGURATION */}
      {activeTab === 'contact' && (
        <form onSubmit={handleSaveContactSettings} className="space-y-6 text-xs animate-in fade-in">
          
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">Official WhatsApp & Desk Contact Settings</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[10px] font-bold">WhatsApp Service:</span>
                <button
                  type="button"
                  onClick={() => setContactSettings({ ...contactSettings, whatsappEnabled: !contactSettings.whatsappEnabled })}
                  className="cursor-pointer"
                >
                  {contactSettings.whatsappEnabled !== false ? (
                    <ToggleRight className="w-7 h-7 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="w-7 h-7 text-slate-300" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  WhatsApp Business Mobile Number *
                </label>
                <div className="relative">
                  <MessageSquare className="w-4 h-4 text-emerald-600 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={contactSettings.whatsapp}
                    onChange={(e) => setContactSettings({ ...contactSettings, whatsapp: e.target.value })}
                    placeholder="919876543210 or 9876543210"
                    className="w-full border border-slate-200 bg-white rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Normalized to international format (e.g., <code className="text-emerald-700 font-bold">919876543210</code>). All service order CTAs redirect to this WhatsApp number.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Display Phone Support Number *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={contactSettings.phone}
                    onChange={(e) => setContactSettings({ ...contactSettings, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full border border-slate-200 bg-white rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Official Support Email *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={contactSettings.email}
                    onChange={(e) => setContactSettings({ ...contactSettings, email: e.target.value })}
                    placeholder="support@easydesk.com"
                    className="w-full border border-slate-200 bg-white rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Working Hours</label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={contactSettings.workingHours || ''}
                    onChange={(e) => setContactSettings({ ...contactSettings, workingHours: e.target.value })}
                    placeholder="Mon - Sat: 9:00 AM - 7:00 PM IST"
                    className="w-full border border-slate-200 bg-white rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Official Desk Office Address</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <textarea
                  rows={2}
                  value={contactSettings.address || ''}
                  onChange={(e) => setContactSettings({ ...contactSettings, address: e.target.value })}
                  placeholder="Enter complete official postal address..."
                  className="w-full border border-slate-200 bg-white rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingContact}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2 shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>{savingContact ? 'Saving Contact...' : 'Save WhatsApp & Contact Settings'}</span>
            </button>
          </div>

        </form>
      )}

      {/* TAB 3: GENERAL BRANDING & MASTER DATA */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneralSettings} className="space-y-6 text-xs animate-in fade-in">
          
          {/* Section 1: General Branding */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <Globe className="w-5 h-5 text-purple-600" />
              <h3 className="font-extrabold text-slate-900 text-sm">1. General Branding & Assets</h3>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Website Name *</label>
                <input
                  type="text"
                  required
                  value={generalSettings.websiteName}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, websiteName: e.target.value })}
                  className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Portal Tagline</label>
                <input
                  type="text"
                  value={generalSettings.tagline}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, tagline: e.target.value })}
                  className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <MediaInput
                label="Website Primary Logo"
                value={generalSettings.logoUrl || ''}
                onChange={(url) => setGeneralSettings({ ...generalSettings, logoUrl: url })}
                placeholder="Select website brand logo..."
                allowedTypes={['image']}
              />

              <MediaInput
                label="Website Favicon Icon"
                value={generalSettings.faviconUrl || ''}
                onChange={(url) => setGeneralSettings({ ...generalSettings, faviconUrl: url })}
                placeholder="Select favicon icon..."
                allowedTypes={['image']}
              />
            </div>
          </div>

          {/* Section 2: Master Data Management */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">2. Department & Designation Master Records</h3>
              </div>
              <button
                type="button"
                disabled={savingMaster}
                onClick={() => handleSaveMasterData()}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingMaster ? 'Saving Master...' : 'Save Master Records'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              
              {/* Panel 1: Department Master Data */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">Department Names Master</h4>
                    </div>
                  </div>
                  <span className="bg-blue-50 text-blue-700 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-blue-200/60">
                    {departments.length} Records
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDeptInput}
                    onChange={(e) => setNewDeptInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddDepartment(); } }}
                    placeholder="Type new department name..."
                    className="flex-1 border border-slate-200 bg-slate-50/50 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddDepartment}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {departments.map((dept, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/70 hover:border-slate-300 transition text-xs">
                      <span className="font-bold text-slate-800">{dept}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteDepartment(idx)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Panel 2: Designation Master Data */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">Designation / Role Titles Master</h4>
                    </div>
                  </div>
                  <span className="bg-purple-50 text-purple-700 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-purple-200/60">
                    {designations.length} Records
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDesigInput}
                    onChange={(e) => setNewDesigInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddDesignation(); } }}
                    placeholder="Type new designation title..."
                    className="flex-1 border border-slate-200 bg-slate-50/50 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddDesignation}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {designations.map((desig, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/70 hover:border-slate-300 transition text-xs">
                      <span className="font-bold text-slate-800">{desig}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteDesignation(idx)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingGeneral}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{savingGeneral ? 'Saving General Settings...' : 'Save General Branding Settings'}</span>
            </button>
          </div>

        </form>
      )}

    </div>
  );
}
