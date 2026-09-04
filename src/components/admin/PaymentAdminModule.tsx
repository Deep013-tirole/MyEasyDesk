import React, { useState, useEffect } from 'react';
import { 
  CreditCard, QrCode, Building, Save, 
  CheckCircle2, AlertCircle, ShieldCheck, DollarSign 
} from 'lucide-react';
import { apiFetch } from '../../lib/apiClient.js';
import { MediaInput } from './MediaInput';

export default function PaymentAdminModule() {
  const [paymentConfig, setPaymentConfig] = useState<any>({
    upiId: '',
    qrCodeUrl: '',
    bankName: '',
    accountName: '',
    accountNumber: '',
    ifscCode: '',
    branch: '',
    paymentInstructions: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const fetchPaymentConfig = async () => {
    try {
      const res = await fetch(`/api/payment-settings?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') setPaymentConfig(data);
      }
    } catch (err) {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        console.warn('Failed fetching payment settings:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentConfig();
  }, []);

  const handleSavePaymentConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    setErrMsg('');

    try {
      const res = await apiFetch('/api/admin/payment-settings', {
        method: 'PUT',
        body: { paymentConfig },
        isAdmin: true
      });

      if (res.ok) {
        setMsg('Payment configuration (UPI, QR Code, and Bank Transfer) updated successfully!');
      } else {
        const errorData = await res.json().catch(() => ({}));
        setErrMsg(errorData.message || 'Failed saving payment settings.');
      }
    } catch (err: any) {
      setErrMsg(err.message || 'Error saving payment settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs font-sans">
        Loading Payment Settings Module...
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6 font-sans">
      
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
              Modular Architecture
            </span>
            <span className="text-slate-400 text-xs">• Dedicated Module 3</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1">Payment Module Settings</h2>
        </div>
        
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Manual Payment Proof Verification Enabled</span>
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

      <form onSubmit={handleSavePaymentConfig} className="space-y-6 text-xs">
        
        {/* Section 1: UPI & QR Code Settings */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <QrCode className="w-5 h-5 text-blue-600" />
            <h3 className="font-extrabold text-slate-900 text-sm">1. UPI & QR Code Configuration</h3>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Official EasyDesk VPA / UPI ID *</label>
              <input
                type="text"
                required
                value={paymentConfig.upiId}
                onChange={(e) => setPaymentConfig({ ...paymentConfig, upiId: e.target.value })}
                placeholder="easydesk@icici"
                className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
              />
            </div>

            <MediaInput
              label="Official UPI QR Code Image *"
              value={paymentConfig.qrCodeUrl || ''}
              onChange={(url) => setPaymentConfig({ ...paymentConfig, qrCodeUrl: url })}
              placeholder="Select or upload QR code image..."
              allowedTypes={['image']}
              required
            />

          </div>
        </div>

        {/* Section 2: Direct Bank Transfer Details */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Building className="w-5 h-5 text-blue-600" />
            <h3 className="font-extrabold text-slate-900 text-sm">2. Bank Transfer Account Details</h3>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Bank Name *</label>
              <input
                type="text"
                required
                value={paymentConfig.bankName}
                onChange={(e) => setPaymentConfig({ ...paymentConfig, bankName: e.target.value })}
                placeholder="ICICI Bank"
                className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Account Beneficiary Name *</label>
              <input
                type="text"
                required
                value={paymentConfig.accountName}
                onChange={(e) => setPaymentConfig({ ...paymentConfig, accountName: e.target.value })}
                placeholder="EASYDESK DIGITAL SERVICES PVT LTD"
                className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Account Number *</label>
              <input
                type="text"
                required
                value={paymentConfig.accountNumber}
                onChange={(e) => setPaymentConfig({ ...paymentConfig, accountNumber: e.target.value })}
                placeholder="987654321000"
                className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">IFSC Code *</label>
              <input
                type="text"
                required
                value={paymentConfig.ifscCode}
                onChange={(e) => setPaymentConfig({ ...paymentConfig, ifscCode: e.target.value })}
                placeholder="ICIC0000102"
                className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Bank Branch Location</label>
              <input
                type="text"
                value={paymentConfig.branch}
                onChange={(e) => setPaymentConfig({ ...paymentConfig, branch: e.target.value })}
                placeholder="Sector 62 Noida Branch"
                className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Customer Payment Guidelines */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Payment Proof Guidelines for Citizens</label>
          <textarea
            rows={3}
            value={paymentConfig.paymentInstructions}
            onChange={(e) => setPaymentConfig({ ...paymentConfig, paymentInstructions: e.target.value })}
            className="w-full border border-slate-200 bg-white rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
          />
        </div>

        <div className="border-t border-slate-100 pt-4 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Payment Settings'}</span>
          </button>
        </div>

      </form>
    </div>
  );
}
