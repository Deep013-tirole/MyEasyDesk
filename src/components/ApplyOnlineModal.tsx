import React, { useState } from 'react';
import { 
  X, CheckCircle2, AlertCircle, FileText, IndianRupee, 
  ShieldCheck, UploadCloud, Copy, ArrowRight, Check,
  QrCode, CreditCard, Building, Lock, Sparkles, Clock
} from 'lucide-react';
import { Service, Order, PaymentMethod, PaymentStatus, OrderStatus } from '../types.js';

interface ApplyOnlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: Service;
  categoryName: string;
  onOrderCreated?: (order: Order) => void;
  setView?: (view: string) => void;
}

export default function ApplyOnlineModal({
  isOpen,
  onClose,
  service,
  categoryName,
  onOrderCreated,
  setView
}: ApplyOnlineModalProps) {
  // Step indicator: 1 = Details, 2 = Documents, 3 = Payment & Summary, 4 = Confirmation
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State: Customer Profile
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [whatsappMobile, setWhatsappMobile] = useState('');
  const [sameAsMobile, setSameAsMobile] = useState(true);
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [pinCode, setPinCode] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Form State: Documents
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
  const [docNotes, setDocNotes] = useState('');

  // Form State: Pricing & Coupon
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponSuccess, setCouponSuccess] = useState('');
  const [couponError, setCouponError] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Form State: Payment
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');
  const [utr, setUtr] = useState('');

  // Processing & Error States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState(false);

  if (!isOpen) return null;

  const baseGovFees = Number(service.govFees || 0);
  const baseServiceCharge = Number(service.serviceCharge || 0);
  const subtotal = baseGovFees + baseServiceCharge;
  const totalPayable = Math.max(0, subtotal - couponDiscount);

  // Validate Coupon
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    setCouponError('');
    setCouponSuccess('');

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), amount: subtotal })
      });
      const data = await res.json();
      if (res.ok && data.discount) {
        setCouponDiscount(Number(data.discount));
        setCouponSuccess(`Coupon '${data.coupon?.code || couponCode.toUpperCase()}' applied! ₹${data.discount} discount.`);
      } else {
        setCouponDiscount(0);
        setCouponError(data.message || 'Invalid or expired coupon code.');
      }
    } catch {
      setCouponError('Error validating coupon. Please proceed without coupon.');
    } finally {
      setValidatingCoupon(false);
    }
  };

  // Step 1 Validation
  const handleProceedToDocs = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) return setErrorMsg('Please enter your full name as per official ID.');
    if (!mobile.trim() || !/^\d{10}$/.test(mobile.replace(/\D/g, ''))) {
      return setErrorMsg('Please enter a valid 10-digit mobile number.');
    }
    if (!email.trim() || !email.includes('@')) {
      return setErrorMsg('Please enter a valid email address for application updates.');
    }
    if (!address.trim()) return setErrorMsg('Please enter your complete street / postal address.');
    if (!city.trim()) return setErrorMsg('Please enter your city.');
    if (!pinCode.trim() || !/^\d{6}$/.test(pinCode.replace(/\D/g, ''))) {
      return setErrorMsg('Please enter a valid 6-digit postal PIN code.');
    }

    setStep(2);
  };

  // Step 2 Validation
  const handleProceedToPayment = () => {
    setErrorMsg('');
    setStep(3);
  };

  // Step 3 Order Submission
  const handleSubmitOrder = async () => {
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        serviceId: service.id,
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pinCode: pinCode.trim(),
        additionalNotes: additionalNotes.trim() + (docNotes ? ` | Doc Notes: ${docNotes}` : ''),
        paymentMethod: paymentMethod === 'QR Code' ? PaymentMethod.QR : 
                       paymentMethod === 'Bank Transfer' ? PaymentMethod.BANK_TRANSFER : PaymentMethod.UPI,
        couponCode: couponDiscount > 0 ? couponCode.trim() : undefined,
        uploadedDocs: uploadedDocs.length > 0 ? uploadedDocs : (service.requiredDocuments || ['Customer Document']),
        utr: utr.trim() || undefined
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data && data.id) {
        setCreatedOrder(data);
        setStep(4);
        if (onOrderCreated) {
          onOrderCreated(data);
        }
      } else {
        setErrorMsg(data?.message || 'Failed to submit application. Please try again.');
      }
    } catch {
      setErrorMsg('Network connection error while placing application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyOrderId = () => {
    if (!createdOrder) return;
    navigator.clipboard.writeText(createdOrder.id);
    setCopiedOrderId(true);
    setTimeout(() => setCopiedOrderId(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div 
        className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-[#0F4C81] via-[#165B96] to-[#0F4C81] text-white p-5 sm:p-6 flex items-center justify-between shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-white/10 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase text-blue-100 mb-1">
              <ShieldCheck className="w-3 h-3 text-emerald-300" />
              <span>Verified Government & Citizen Filing</span>
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight">{service.title}</h2>
            <p className="text-xs text-blue-100/90 mt-0.5">{categoryName} • Official Turnaround: {service.processingTime || '3–5 Days'}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP PROGRESS BAR */}
        {step < 4 && (
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-xs font-bold text-slate-500 shrink-0">
            <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-[#0F4C81]' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? 'bg-[#0F4C81] text-white' : 'bg-slate-200'}`}>1</span>
              <span>Citizen Info</span>
            </div>
            <div className="w-8 h-0.5 bg-slate-200" />
            <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-[#0F4C81]' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-[#0F4C81] text-white' : 'bg-slate-200'}`}>2</span>
              <span>Documents</span>
            </div>
            <div className="w-8 h-0.5 bg-slate-200" />
            <div className={`flex items-center gap-1.5 ${step >= 3 ? 'text-[#0F4C81]' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 3 ? 'bg-[#0F4C81] text-white' : 'bg-slate-200'}`}>3</span>
              <span>Review & Pay</span>
            </div>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-5">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: CITIZEN INFORMATION */}
          {step === 1 && (
            <form onSubmit={handleProceedToDocs} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name (as per Govt ID) *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Ramesh Shankar Rao"
                    className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0F4C81] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number (10 digits) *</label>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={e => {
                      const val = e.target.value;
                      setMobile(val);
                      if (sameAsMobile) setWhatsappMobile(val);
                    }}
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0F4C81] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="citizen@example.com"
                    className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0F4C81] outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">WhatsApp Number</label>
                    <label className="text-[11px] text-slate-500 flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sameAsMobile}
                        onChange={e => {
                          setSameAsMobile(e.target.checked);
                          if (e.target.checked) setWhatsappMobile(mobile);
                        }}
                        className="rounded text-[#0F4C81]"
                      />
                      <span>Same as Mobile</span>
                    </label>
                  </div>
                  <input
                    type="tel"
                    disabled={sameAsMobile}
                    value={sameAsMobile ? mobile : whatsappMobile}
                    onChange={e => setWhatsappMobile(e.target.value)}
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0F4C81] outline-none disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Street / Postal Address *</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="House/Flat No, Landmark, Area"
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0F4C81] outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="e.g. Pune"
                    className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0F4C81] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={e => setState(e.target.value)}
                    placeholder="Maharashtra"
                    className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0F4C81] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">PIN Code *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={pinCode}
                    onChange={e => setPinCode(e.target.value)}
                    placeholder="411001"
                    className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0F4C81] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Additional Instructions / Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={additionalNotes}
                  onChange={e => setAdditionalNotes(e.target.value)}
                  placeholder="Any specific instructions or urgent notes for our desk coordinator"
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0F4C81] outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="bg-[#0F4C81] hover:bg-[#0c3e69] text-white font-bold text-xs py-3 px-6 rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  <span>Continue to Documents</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: DOCUMENTS CHECKLIST */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-900 mb-1">Required Documents Checklist</h3>
                <p className="text-[11px] text-slate-500">
                  Please verify that you have authentic copies of the following documents ready:
                </p>
              </div>

              <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                {(service.requiredDocuments && service.requiredDocuments.length > 0 ? service.requiredDocuments : [
                  'Proof of Identity (Aadhaar / Voter ID / Passport)',
                  'Proof of Address (Electricity Bill / Rent Agreement)',
                  'Passport Size Photograph'
                ]).map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 bg-white border border-slate-200/80 p-3 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800">{doc}</span>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Document Readiness Confirmation</label>
                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-slate-600 leading-relaxed">
                  ✓ After placing your order, our dedicated desk agent will verify your details and connect on WhatsApp or through your tracking portal to collect clear digital copies.
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs py-3 px-5 rounded-xl transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleProceedToPayment}
                  className="bg-[#0F4C81] hover:bg-[#0c3e69] text-white font-bold text-xs py-3 px-6 rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  <span>Continue to Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: FEE BREAKDOWN & PAYMENT METHOD */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Fee Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-2">Fee & Charge Summary</h4>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Official Government Department Fee:</span>
                  <span className="font-bold text-slate-900">₹{baseGovFees}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>EasyDesk Documentation & Advisory Charge:</span>
                  <span className="font-bold text-slate-900">₹{baseServiceCharge}</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-xs text-emerald-700 font-bold">
                    <span>Coupon Discount:</span>
                    <span>-₹{couponDiscount}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-[#0F4C81] border-t border-slate-200 pt-2">
                  <span>Total Amount Payable:</span>
                  <span>₹{totalPayable}</span>
                </div>
              </div>

              {/* Coupon Code Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Have a Promotional Coupon?</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter Coupon Code"
                    className="flex-1 text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0F4C81] outline-none uppercase font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={validatingCoupon || !couponCode.trim()}
                    className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
                  >
                    {validatingCoupon ? 'Checking...' : 'Apply'}
                  </button>
                </div>
                {couponSuccess && <p className="text-[11px] text-emerald-600 font-bold">{couponSuccess}</p>}
                {couponError && <p className="text-[11px] text-rose-600 font-bold">{couponError}</p>}
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">Select Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'UPI', label: 'UPI Direct', icon: CreditCard },
                    { id: 'QR Code', label: 'QR Scan', icon: QrCode },
                    { id: 'Bank Transfer', label: 'Bank NEFT', icon: Building }
                  ].map(m => {
                    const Icon = m.icon;
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                          isSelected ? 'border-[#0F4C81] bg-blue-50/60 text-[#0F4C81] font-bold shadow-2xs' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[11px]">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional UTR Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  UTR / Reference ID (if already transferred)
                </label>
                <input
                  type="text"
                  value={utr}
                  onChange={e => setUtr(e.target.value)}
                  placeholder="e.g. 331289123456 (can also submit later on Tracking page)"
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0F4C81] outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs py-3 px-5 rounded-xl transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmitOrder}
                  disabled={isSubmitting}
                  className="bg-[#10B981] hover:bg-[#0e9f6e] disabled:bg-slate-300 text-white font-black text-xs py-3.5 px-7 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting Application...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Confirm & Place Order (₹{totalPayable})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: ORDER CONFIRMATION */}
          {step === 4 && createdOrder && (
            <div className="text-center py-4 space-y-5 animate-in fade-in zoom-in-95">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900">Application Submitted Successfully!</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Your official application has been recorded in the EasyDesk verification queue.
                </p>
              </div>

              {/* Order ID Badge */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl max-w-sm mx-auto flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Your Order ID</span>
                  <span className="text-base font-black text-[#0F4C81]">{createdOrder.id}</span>
                </div>
                <button
                  onClick={copyOrderId}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs py-2 px-3 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedOrderId ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 text-left max-w-md mx-auto text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-bold">Applicant</span>
                  <span className="font-bold text-slate-800 truncate block">{createdOrder.name}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-bold">Total Fee</span>
                  <span className="font-black text-[#0F4C81] block">₹{createdOrder.totalAmount}</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                ℹ️ Keep your Order ID handy. You can check live processing status, upload documents, or submit payment proof anytime on our Tracking desk.
              </div>

              {/* Next Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <button
                  onClick={() => {
                    onClose();
                    if (setView) setView('track');
                  }}
                  className="bg-[#0F4C81] hover:bg-[#0c3e69] text-white font-bold text-xs py-3 px-6 rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  <span>Track Application Now</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    if (setView) setView('payment');
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 px-6 rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Payment Portal</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
