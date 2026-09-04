import React, { useState, useEffect } from 'react';
import { 
  CreditCard, QrCode, Building, CheckCircle2, AlertCircle, 
  Send, Copy, FileCheck, ArrowRight, Clock, ShieldCheck,
  Sparkles, Lock, Zap, CheckCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { PaymentConfig, PaymentMethod, User } from '../types.js';
import { apiFetch, safeParseJsonResponse } from '../lib/apiClient.js';
import { getClientPaymentConfig } from '../lib/apiDataService.js';

const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  upiId: 'easydesk@sbi',
  upiName: 'EasyDesk Digital Services',
  qrCodeUrl: 'https://images.unsplash.com/photo-1595079672139-5470805086ae?w=300',
  bankAccountName: 'EasyDesk Digital Services Pvt Ltd',
  bankName: 'State Bank of India',
  accountNumber: '40918273645',
  ifsc: 'SBIN0001234',
  branch: 'Sector 62 Noida',
  paymentInstructions: 'Please include your Order ID in the payment remarks/notes for instant reconciliation.'
};

export default function PaymentView({ 
  currentUser, 
  setView 
}: { 
  currentUser: User | null; 
  setView: (view: string) => void;
}) {
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>(() => {
    try {
      const cached = localStorage.getItem('easydesk_cache_payment_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.upiId || parsed.bankName || parsed.accountNumber)) {
          return { ...DEFAULT_PAYMENT_CONFIG, ...parsed };
        }
      }
    } catch {}
    return DEFAULT_PAYMENT_CONFIG;
  });
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Active method selection
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.UPI);

  // Form submission fields
  const [orderId, setOrderId] = useState('');
  const [utr, setUtr] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [screenshotUrl, setScreenshotUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedText, setCopiedText] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchPaymentConfig = async () => {
      try {
        const res = await fetch(`/api/payment-settings?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        if (res.ok) {
          const data = await safeParseJsonResponse<any>(res);
          if (data && (data.upiId || data.bankName || data.accountNumber) && isMounted) {
            setPaymentConfig(prev => {
              const updated = { ...prev, ...data };
              try {
                localStorage.setItem('easydesk_cache_payment_config', JSON.stringify(updated));
              } catch {}
              return updated;
            });
            return;
          }
        }
      } catch (err: any) {
        if (typeof navigator === 'undefined' || navigator.onLine !== false) {
          console.warn('Failed to load payment config via API:', err?.message || err);
        }
      }

      // Authoritative Direct API Fallback
      try {
        if (typeof navigator === 'undefined' || navigator.onLine !== false) {
          const directPay = await getClientPaymentConfig();
          if (directPay && isMounted) {
            setPaymentConfig(prev => {
              const updated = { ...prev, ...directPay };
              try {
                localStorage.setItem('easydesk_cache_payment_config', JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }
        }
      } catch (fsErr: any) {
        if (typeof navigator === 'undefined' || navigator.onLine !== false) {
          console.warn('Failed to load direct fallback payment config:', fsErr?.message || fsErr);
        }
      }
    };

    fetchPaymentConfig();
    return () => { isMounted = false; };
  }, []);


  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 2000);
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || !utr) {
      setErrorMsg('Please enter your Order ID and 12-digit UTR/Transaction Reference ID.');
      return;
    }

    setSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await apiFetch(`/api/orders/${orderId}/submit-payment`, {
        method: 'POST',
        body: {
          paymentMethod: method,
          utr,
          paymentDate,
          paymentScreenshot: screenshotUrl
        }
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccessMsg(`Payment proof for Order ${orderId} submitted successfully! Your payment is under review.`);
        setOrderId('');
        setUtr('');
        setScreenshotUrl('');
      } else {
        setErrorMsg(data.message || 'Failed to submit payment proof. Please check Order ID.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error submitting payment proof.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingConfig) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-xs text-slate-500 font-medium">
        <div className="w-8 h-8 border-4 border-[#0F4C81] border-t-transparent rounded-full animate-spin" />
        <span>Loading Payment Portal...</span>
      </div>
    );
  }

  return (
    <div id="easydesk-payment-view" className="font-sans text-slate-900 bg-[#F8FAFC] pb-20 w-full max-w-full overflow-x-hidden">
      
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
              <ShieldCheck className="w-4 h-4 text-[#0F4C81]" />
              <span>Official EasyDesk Payment Portal & Proof Verification</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Manual Payment & <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F4C81] via-blue-600 to-teal-600">Proof Verification</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              Transfer your order fees directly using UPI, Dynamic QR Code, or Direct Bank NEFT/RTGS. After transferring, submit your 12-digit UTR / Reference ID below for verified desk clearance.
            </p>

            {/* Quick Metrics */}
            <div className="pt-2 flex flex-wrap gap-3 text-xs font-bold text-slate-700">
              <div className="flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Zero Gateway Surcharge</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <Lock className="w-4 h-4 text-[#0F4C81]" />
                <span>100% Direct Banking</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Instant UTR Validation</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. MAIN PAYMENT INTERFACE */}
      <div className="portal-container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Payment Details Tabs */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-5 hover-lift hover-glow-blue transition-all duration-300">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-[#0F4C81] tracking-wider block">Step 1</span>
                  <h2 className="font-black text-base text-slate-900 m-0">Select Payment Method</h2>
                </div>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold px-3 py-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Direct Bank Verified
                </span>
              </div>

              {/* Payment Method Tabs */}
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMethod(PaymentMethod.UPI)}
                  className={`p-3.5 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center gap-2 cursor-pointer hover-scale-sm ${
                    method === PaymentMethod.UPI 
                      ? 'bg-[#0F4C81] text-white border-[#0F4C81] shadow-sm btn-glow-primary' 
                      : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-blue-50/70 hover:text-[#0F4C81]'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span>UPI VPA</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod(PaymentMethod.QR)}
                  className={`p-3.5 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center gap-2 cursor-pointer hover-scale-sm ${
                    method === PaymentMethod.QR 
                      ? 'bg-[#0F4C81] text-white border-[#0F4C81] shadow-sm btn-glow-primary' 
                      : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-blue-50/70 hover:text-[#0F4C81]'
                  }`}
                >
                  <QrCode className="w-5 h-5" />
                  <span>Scan QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod(PaymentMethod.BANK_TRANSFER)}
                  className={`p-3.5 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center gap-2 cursor-pointer hover-scale-sm ${
                    method === PaymentMethod.BANK_TRANSFER 
                      ? 'bg-[#0F4C81] text-white border-[#0F4C81] shadow-sm btn-glow-primary' 
                      : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-blue-50/70 hover:text-[#0F4C81]'
                  }`}
                >
                  <Building className="w-5 h-5" />
                  <span>Bank NEFT</span>
                </button>
              </div>

              {/* Tab 1: UPI */}
              {method === PaymentMethod.UPI && (
                <div className="bg-slate-50/80 border border-slate-200/80 p-5 rounded-2xl space-y-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-slate-500 uppercase text-[10px] tracking-wider">Official EasyDesk UPI VPA</span>
                    {copiedText === 'upi' && <span className="text-emerald-600 font-bold text-[10px]">✓ Copied to Clipboard</span>}
                  </div>

                  <div className="flex items-center justify-between bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
                    <div>
                      <p className="font-mono text-sm sm:text-base font-black text-[#0F4C81] m-0">{paymentConfig?.upiId || 'easydesk@sbi'}</p>
                      <p className="text-[10px] text-slate-400 font-medium m-0 mt-0.5">{paymentConfig?.upiName || 'EasyDesk Digital Services'}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(paymentConfig?.upiId || 'easydesk@sbi', 'upi')}
                      className="border border-[#0F4C81] text-[#0F4C81] hover:bg-blue-50 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 hover-scale-sm shadow-2xs"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy ID
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed m-0 font-normal">
                    Open GPay, PhonePe, Paytm, or BHIM app, select <strong>Pay via UPI ID</strong>, paste the address above, enter the total order amount, and complete the payment.
                  </p>
                </div>
              )}

              {/* Tab 2: QR Code */}
              {method === PaymentMethod.QR && (
                <div className="bg-slate-50/80 border border-slate-200/80 p-5 rounded-2xl text-center space-y-4 text-xs">
                  <span className="font-extrabold text-slate-500 uppercase text-[10px] tracking-wider block">Scan & Pay with Any UPI App</span>

                  {paymentConfig?.qrCodeUrl ? (
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 inline-block shadow-sm hover-scale transition-transform">
                      <img 
                        src={paymentConfig.qrCodeUrl} 
                        alt="EasyDesk Official Payment QR" 
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="w-48 h-48 object-contain mx-auto"
                      />
                      <p className="text-[10px] text-slate-600 font-bold mt-2.5 mb-0">{paymentConfig.upiName}</p>
                    </div>
                  ) : (
                    <div className="p-8 bg-white rounded-2xl border border-slate-200 text-slate-400">
                      QR Code Image Unavailable
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm mx-auto m-0 font-normal">
                    Scan this QR code using GPay, PhonePe, Paytm, or BHIM to pay instantly. Note the 12-digit transaction UTR reference.
                  </p>
                </div>
              )}

              {/* Tab 3: Bank Transfer */}
              {method === PaymentMethod.BANK_TRANSFER && (
                <div className="bg-slate-50/80 border border-slate-200/80 p-5 rounded-2xl space-y-3.5 text-xs">
                  <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
                    <span className="font-extrabold text-slate-500 uppercase text-[10px] tracking-wider">Official Bank Account Details</span>
                    {copiedText === 'bank' && <span className="text-emerald-600 font-bold text-[10px]">✓ Account Details Copied</span>}
                  </div>

                  <div className="space-y-2.5 text-slate-700 bg-white p-4 rounded-xl border border-slate-200/80">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Bank Name:</span>
                      <span className="font-bold text-slate-900">{paymentConfig?.bankName || 'State Bank of India'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Account Name:</span>
                      <span className="font-bold text-slate-900">{paymentConfig?.bankAccountName || 'EasyDesk Digital Services Pvt Ltd'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Account Number:</span>
                      <span className="font-mono font-bold text-[#0F4C81]">{paymentConfig?.accountNumber || '40918273645'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">IFSC Code:</span>
                      <span className="font-mono font-bold text-slate-900">{paymentConfig?.ifsc || 'SBIN0001234'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Branch:</span>
                      <span className="font-bold text-slate-900">{paymentConfig?.branch || 'Sector 62 Noida'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => copyToClipboard(`${paymentConfig?.accountNumber} / ${paymentConfig?.ifsc}`, 'bank')}
                    className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl font-bold text-xs py-2.5 transition-all cursor-pointer flex items-center justify-center gap-1.5 hover-scale-sm shadow-2xs"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Account & IFSC Code
                  </button>
                </div>
              )}

              {/* Payment Instructions Note */}
              <div className="bg-blue-50/70 border border-blue-100 p-4 rounded-2xl text-[11px] text-blue-900 leading-relaxed space-y-1">
                <span className="font-bold block flex items-center gap-1.5 text-[#0F4C81]">
                  <Sparkles className="w-3.5 h-3.5" /> Filing Instructions:
                </span>
                <p className="m-0 text-slate-700 font-normal">{paymentConfig?.paymentInstructions}</p>
              </div>

            </div>
          </div>

          {/* Right Column: Submit Payment Proof Form */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-5 hover-lift hover-glow-blue transition-all duration-300">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-[#0F4C81] tracking-wider block">Step 2</span>
                  <h2 className="font-black text-base text-slate-900 m-0">Submit Payment Proof</h2>
                </div>
                <span className="bg-blue-50 text-[#0F4C81] border border-blue-200 rounded-full text-[10px] font-bold px-3 py-1">
                  Verification Desk
                </span>
              </div>

              {successMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-col gap-2.5 text-xs rounded-2xl p-4 m-0 shadow-2xs">
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Proof Submitted Successfully</span>
                  </div>
                  <p className="m-0 text-emerald-900/90 font-normal">{successMsg}</p>
                  <div>
                    <button 
                      onClick={() => setView('track')} 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2 text-xs font-bold transition-all hover-scale-sm cursor-pointer inline-flex items-center gap-1.5 btn-glow-emerald"
                    >
                      Track Order Status →
                    </button>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-800 flex items-center gap-2.5 text-xs rounded-2xl p-4 m-0 shadow-2xs">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="font-medium">{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmitProof} className="space-y-4 text-xs">
                <div>
                  <label htmlFor="payment-order-id" className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1.5">EasyDesk Order ID *</label>
                  <input
                    id="payment-order-id"
                    name="orderId"
                    type="text"
                    required
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value.toUpperCase())}
                    placeholder="e.g. ORD-10026"
                    className="w-full bg-slate-50/60 border border-slate-200/80 rounded-xl px-4 py-2.5 font-mono font-bold text-slate-900 uppercase focus:outline-none input-focus-glow placeholder:text-slate-400"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block font-normal">Enter the Order ID provided during your booking.</span>
                </div>

                <div>
                  <label htmlFor="payment-utr-number" className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1.5">12-Digit UTR / Transaction Reference ID *</label>
                  <input
                    id="payment-utr-number"
                    name="utr"
                    type="text"
                    required
                    value={utr}
                    onChange={(e) => setUtr(e.target.value)}
                    placeholder="e.g. 981273981273 or Bank Ref No"
                    className="w-full bg-slate-50/60 border border-slate-200/80 rounded-xl px-4 py-2.5 font-mono font-bold text-[#0F4C81] focus:outline-none input-focus-glow placeholder:text-slate-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="payment-date-input" className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1.5">Payment Date *</label>
                    <input
                      id="payment-date-input"
                      name="paymentDate"
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full bg-slate-50/60 border border-slate-200/80 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none input-focus-glow font-medium"
                    />
                  </div>

                  <div>
                    <label htmlFor="payment-screenshot-url" className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1.5">Payment Screenshot URL (Optional)</label>
                    <input
                      id="payment-screenshot-url"
                      name="screenshotUrl"
                      type="text"
                      value={screenshotUrl}
                      onChange={(e) => setScreenshotUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-slate-50/60 border border-slate-200/80 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none input-focus-glow placeholder:text-slate-400 font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#0F4C81] hover:bg-[#0b3b64] text-white btn-glow-primary w-full py-3.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2 hover-scale-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting Payment Proof...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Payment Proof for Verification</span>
                    </>
                  )}
                </button>
              </form>

              {/* Quick Track Link */}
              <div className="border-t border-slate-100 pt-3 text-center">
                <button
                  onClick={() => setView('track')}
                  className="text-xs text-[#0F4C81] hover:underline font-bold inline-flex items-center gap-1.5 cursor-pointer bg-transparent border-0"
                >
                  Already submitted proof? Check payment verification status <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          </div>

        </div>
      </div>

    </div>
  );
}

