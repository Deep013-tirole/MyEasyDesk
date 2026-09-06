import React, { useState } from 'react';
import { 
  X, CheckCircle2, AlertCircle, FileText,
  ShieldCheck, Copy, ArrowRight, Check,
  Clock, MessageSquare, Edit3, User, MapPin,
  Phone, Mail, FileCheck, Info
} from 'lucide-react';
import { Service, Order } from '../types.js';
import { openWhatsAppForSubmittedOrder } from '../lib/whatsapp.js';
import IndianAddressFields from './common/IndianAddressFields.js';
import { isValidIndianPinCode } from '../lib/indiaAddressData.js';

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
  // Step indicator: 1 = Details, 2 = Documents, 3 = Review, 4 = Success Confirmation
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State: Customer Profile
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [whatsappMobile, setWhatsappMobile] = useState('');
  const [sameAsMobile, setSameAsMobile] = useState(true);
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Form State: Documents
  const [uploadedDocs] = useState<string[]>([]);
  const [docNotes, setDocNotes] = useState('');

  // Processing & Error States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState(false);

  if (!isOpen) return null;

  const baseGovFees = Number(service.govFees || 0);
  const baseServiceCharge = Number(service.serviceCharge || 0);
  const totalEstimatedAmount = baseGovFees + baseServiceCharge;

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
    if (!state.trim()) return setErrorMsg('Please select your State or Union Territory.');
    if (!city.trim()) return setErrorMsg('Please enter your city.');
    if (!isValidIndianPinCode(pinCode)) {
      return setErrorMsg('Please enter a valid 6-digit postal PIN code (e.g. 400001).');
    }

    setStep(2);
  };

  // Step 2 Validation -> Proceed to Review
  const handleProceedToReview = () => {
    setErrorMsg('');
    setStep(3);
  };

  // Step 3 Order Submission (Without Payment)
  const handleSubmitRequest = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        serviceId: service.id,
        orderSource: 'Website',
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        address: address.trim(),
        district: district.trim(),
        city: city.trim(),
        state: state.trim(),
        pinCode: pinCode.trim(),
        pincode: pinCode.trim(),
        country: 'India',
        additionalNotes: additionalNotes.trim() + (docNotes ? ` | Doc Notes: ${docNotes}` : ''),
        uploadedDocs: uploadedDocs.length > 0 ? uploadedDocs : (service.requiredDocuments || ['Customer Verification Documents'])
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'easydesk_secure_csrf_token_2026_val'
        },
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
        setErrorMsg(data?.message || 'Failed to submit service request. Please try again.');
      }
    } catch {
      setErrorMsg('Network connection error while submitting request. Please try again.');
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

  const requiredDocList = (service.requiredDocuments && service.requiredDocuments.length > 0)
    ? service.requiredDocuments
    : [
        'Proof of Identity (Aadhaar / Voter ID / Passport)',
        'Proof of Address (Electricity Bill / Rent Agreement)',
        'Passport Size Photograph'
      ];

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
            <div className="w-8 sm:w-16 h-0.5 bg-slate-200" />
            <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-[#0F4C81]' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-[#0F4C81] text-white' : 'bg-slate-200'}`}>2</span>
              <span>Documents</span>
            </div>
            <div className="w-8 sm:w-16 h-0.5 bg-slate-200" />
            <div className={`flex items-center gap-1.5 ${step >= 3 ? 'text-[#0F4C81]' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 3 ? 'bg-[#0F4C81] text-white' : 'bg-slate-200'}`}>3</span>
              <span>Review Request</span>
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

              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200">
                <IndianAddressFields
                  required
                  compact
                  showLandmark={false}
                  value={{
                    country: 'India',
                    state,
                    district,
                    city,
                    addressLine1: address,
                    pinCode,
                    pincode: pinCode
                  }}
                  onChange={(addr) => {
                    setState(addr.state || '');
                    setDistrict(addr.district || '');
                    setCity(addr.city || '');
                    setPinCode(addr.pinCode || addr.pincode || '');
                    setAddress(addr.addressLine1 || addr.address || '');
                  }}
                />
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
                  Please verify that you have authentic copies of the following documents ready for submission:
                </p>
              </div>

              <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                {requiredDocList.map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 bg-white border border-slate-200/80 p-3 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800">{doc}</span>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Document Readiness & Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={docNotes}
                  onChange={e => setDocNotes(e.target.value)}
                  placeholder="e.g. Aadhaar linked to phone, original marksheet available, etc."
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0F4C81] outline-none resize-none"
                />
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-slate-600 leading-relaxed flex items-start gap-2">
                <Info className="w-4 h-4 text-[#0F4C81] shrink-0 mt-0.5" />
                <span>
                  <strong>Document Verification Guarantee:</strong> After submitting your request, our dedicated desk coordinator will review your file and connect with you on WhatsApp or call to collect clear digital scans.
                </span>
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
                  onClick={handleProceedToReview}
                  className="bg-[#0F4C81] hover:bg-[#0c3e69] text-white font-bold text-xs py-3 px-6 rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  <span>Continue to Review</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & SUBMIT REQUEST (NO PAYMENT REQUIRED) */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">Review Application Request</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Please review all details before submitting. No payment is required at this stage.
                </p>
              </div>

              {/* Card A: Selected Service */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Selected Service</span>
                  <span className="text-[11px] font-bold text-[#0F4C81] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    {categoryName}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <h4 className="text-sm font-black text-slate-900">{service.title}</h4>
                  <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{service.processingTime || '3–5 Days'}</span>
                  </span>
                </div>
              </div>

              {/* Card B: Citizen Information */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <User className="w-3 h-3" /> Citizen Details
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-[11px] font-bold text-[#0F4C81] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Full Name</span>
                    <span className="font-bold text-slate-800">{name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Contact Number</span>
                    <span className="font-bold text-slate-800">+91 {mobile}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">WhatsApp Number</span>
                    <span className="font-bold text-slate-800">+91 {sameAsMobile ? mobile : whatsappMobile}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Email Address</span>
                    <span className="font-bold text-slate-800 truncate block">{email}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 text-[10px] block">Postal Address</span>
                    <span className="text-slate-700 font-medium">{[address, district, city, state].filter(Boolean).join(', ')}{pinCode ? ` - ${pinCode}` : ''}</span>
                  </div>
                  {additionalNotes && (
                    <div className="sm:col-span-2 pt-1 border-t border-slate-200/60">
                      <span className="text-slate-400 text-[10px] block">Applicant Notes</span>
                      <span className="text-slate-600 text-[11px] italic">{additionalNotes}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card C: Document Readiness */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <FileCheck className="w-3 h-3" /> Documents Ready for Verification
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-[11px] font-bold text-[#0F4C81] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {requiredDocList.map((doc, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-medium">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>{doc}</span>
                    </span>
                  ))}
                </div>
                {docNotes && (
                  <p className="text-[11px] text-slate-600 italic pt-1 border-t border-slate-200/60">
                    Doc Notes: {docNotes}
                  </p>
                )}
              </div>

              {/* Card D: Transparent Fee Structure (Informational Only) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Transparent Service Fee Structure
                </span>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Official Government Department Fee:</span>
                  <span className="font-bold text-slate-900">₹{baseGovFees}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>EasyDesk Documentation & Advisory Charge:</span>
                  <span className="font-bold text-slate-900">₹{baseServiceCharge}</span>
                </div>
                <div className="flex justify-between text-xs font-black text-[#0F4C81] border-t border-slate-200 pt-2">
                  <span>Total Estimated Fee:</span>
                  <span>₹{totalEstimatedAmount}</span>
                </div>
              </div>

              {/* Clear User Trust Advisory: No Payment Required Now */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 leading-relaxed">
                  <strong className="font-bold block text-emerald-950 mb-0.5">No Immediate Payment Required</strong>
                  Submit your request now without paying. Our desk coordinator will verify your paperwork and contact you directly via WhatsApp or phone to confirm details and provide official payment instructions.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={isSubmitting}
                  className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs py-3 px-5 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmitRequest}
                  disabled={isSubmitting}
                  className="bg-[#10B981] hover:bg-[#0e9f6e] disabled:bg-slate-300 text-white font-black text-xs py-3.5 px-8 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting Request...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Submit Request</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: ORDER SUCCESS SCREEN (ZERO PAYMENT REDIRECTS) */}
          {step === 4 && createdOrder && (
            <div className="text-center py-4 space-y-5 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900">Request Submitted Successfully!</h3>
                <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto leading-relaxed">
                  Your request has been received. Our team will contact you shortly to confirm the details and payment.
                </p>
              </div>

              {/* Order ID Badge */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl max-w-sm mx-auto flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Your Order ID</span>
                  <span className="text-base font-black text-[#0F4C81] font-mono">{createdOrder.id}</span>
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

              {/* Order Summary Information */}
              <div className="grid grid-cols-2 gap-3 text-left max-w-md mx-auto text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-bold">Service</span>
                  <span className="font-bold text-slate-800 truncate block">{createdOrder.serviceTitle}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-bold">Applicant</span>
                  <span className="font-bold text-slate-800 truncate block">{createdOrder.name}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-bold">Application Status</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>Pending Contact</span>
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-bold">Payment Status</span>
                  <span className="inline-flex items-center text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md mt-0.5">
                    Unpaid / Pending
                  </span>
                </div>
              </div>

              {/* Next Steps Guidance */}
              <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl text-left max-w-md mx-auto text-xs space-y-1.5 leading-relaxed text-slate-700">
                <span className="font-bold text-[#0F4C81] block text-xs">What happens next?</span>
                <p>1. <strong>Verification:</strong> Our team will verify your submitted information and document checklist.</p>
                <p>2. <strong>Direct Contact:</strong> We will contact you at <strong>+91 {createdOrder.mobile}</strong> via WhatsApp or phone.</p>
                <p>3. <strong>Payment:</strong> After confirming your details, we will provide payment instructions.</p>
              </div>

              {/* Primary Action Buttons (Zero Payment Buttons) */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2 max-w-md mx-auto">
                <button
                  onClick={() => {
                    onClose();
                    if (setView) setView('track');
                  }}
                  className="flex-1 bg-[#0F4C81] hover:bg-[#0c3e69] text-white font-bold text-xs py-3 px-5 rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  <span>Track Application</span>
                </button>
                <button
                  onClick={() => openWhatsAppForSubmittedOrder(createdOrder)}
                  className="flex-1 bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs py-3 px-5 rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Contact on WhatsApp</span>
                </button>
              </div>

              <div className="pt-1">
                <button
                  onClick={onClose}
                  className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer underline"
                >
                  Close Window
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
