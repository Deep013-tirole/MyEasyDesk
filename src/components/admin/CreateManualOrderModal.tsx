import React, { useState, useEffect } from 'react';
import { 
  X, MessageSquare, Phone, Globe, User, Users, ShieldCheck, 
  IndianRupee, Plus, CheckCircle2, AlertCircle, FileText, 
  Search, ShieldAlert, Sparkles, Building2, MapPin, Calendar, Clock, ArrowRight
} from 'lucide-react';
import { Service, ServiceCategory, Order, CustomerRecord, OrderStatus, PaymentMethod, PaymentStatus } from '../../types.js';
import IndianAddressFields from '../common/IndianAddressFields.js';

interface CreateManualOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newOrder: Order) => void;
  services: Service[];
  categories: ServiceCategory[];
  preselectedCustomer?: CustomerRecord | null;
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export default function CreateManualOrderModal({
  isOpen,
  onClose,
  onSuccess,
  services,
  categories,
  preselectedCustomer,
  adminFetch
}: CreateManualOrderModalProps) {
  // 1. Order Channel & Source
  const [orderSource, setOrderSource] = useState<'WhatsApp' | 'Website' | 'Phone' | 'In-Person' | 'Other'>('WhatsApp');
  const [sourceReference, setSourceReference] = useState('');
  
  // 2. Order Date & Status
  const [orderDate, setOrderDate] = useState(() => {
    const now = new Date();
    // Local date string in YYYY-MM-DDTHH:MM
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  });
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(OrderStatus.PENDING);

  // 3. Customer Mode & Selection
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [customerSearch, setCustomerSearch] = useState('');
  const [existingCustomers, setExistingCustomers] = useState<CustomerRecord[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(preselectedCustomer || null);

  // 4. New Customer Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustMobile, setNewCustMobile] = useState('');
  const [newCustWhatsapp, setNewCustWhatsapp] = useState('');
  const [sameAsMobile, setSameAsMobile] = useState(true);
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustType, setNewCustType] = useState<'Individual' | 'Business' | 'Franchise'>('Individual');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustDistrict, setNewCustDistrict] = useState('');
  const [newCustCity, setNewCustCity] = useState('');
  const [newCustState, setNewCustState] = useState('');
  const [newCustPincode, setNewCustPincode] = useState('');

  // 5. Service Selection & Fees
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [govFees, setGovFees] = useState<number>(0);
  const [serviceCharge, setServiceCharge] = useState<number>(0);
  const [priority, setPriority] = useState<'Normal' | 'High' | 'Urgent'>('Normal');

  // 6. WhatsApp Conversation Notes & Requirements
  const [requirements, setRequirements] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // 7. Payment Information
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');
  const [paymentStatus, setPaymentStatus] = useState<string>('Pending Verification');
  const [utr, setUtr] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);

  // 8. Documents Checklist
  const [docNames, setDocNames] = useState<string[]>([]);
  const [customDocInput, setCustomDocInput] = useState('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load existing customers on open
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      const now = new Date();
      const tzOffset = now.getTimezoneOffset() * 60000;
      setOrderDate(new Date(now.getTime() - tzOffset).toISOString().slice(0, 16));
      
      if (preselectedCustomer) {
        setSelectedCustomer(preselectedCustomer);
        setCustomerMode('existing');
      } else {
        fetchRecentCustomers();
      }
    }
  }, [isOpen, preselectedCustomer]);

  const fetchRecentCustomers = async () => {
    try {
      setIsSearchingCustomers(true);
      const res = await adminFetch('/api/admin/customers');
      if (res.ok) {
        const data = await res.json();
        setExistingCustomers(Array.isArray(data) ? data : (data.customers || []));
      }
    } catch (e) {
      // Background load error
    } finally {
      setIsSearchingCustomers(false);
    }
  };

  // When service changes, update default pricing and required documents
  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    const s = services.find(x => x.id === serviceId);
    if (s) {
      setGovFees(s.govFees || 0);
      setServiceCharge(s.serviceCharge || 0);
      if (s.requiredDocuments && s.requiredDocuments.length > 0) {
        setDocNames([...s.requiredDocuments]);
      }
    }
  };

  // Filtered customer list for search
  const filteredCustomers = existingCustomers.filter(c => {
    if (!customerSearch.trim()) return true;
    const term = customerSearch.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.mobile && c.mobile.includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term)) ||
      (c.code && c.code.toLowerCase().includes(term))
    );
  });

  // Duplicate check for new customer mode
  const matchingDuplicateCustomer = (newCustMobile.trim() || newCustEmail.trim()) ? existingCustomers.find(c => {
    const cleanInputMobile = newCustMobile.replace(/\D/g, '');
    const cleanCustMobile = (c.mobile || '').replace(/\D/g, '');
    const matchMobile = cleanInputMobile && cleanCustMobile && cleanCustMobile.includes(cleanInputMobile);
    const matchEmail = newCustEmail.trim() && c.email && c.email.toLowerCase() === newCustEmail.trim().toLowerCase();
    return matchMobile || matchEmail;
  }) : null;

  const handleAddDoc = () => {
    if (customDocInput.trim() && !docNames.includes(customDocInput.trim())) {
      setDocNames([...docNames, customDocInput.trim()]);
      setCustomDocInput('');
    }
  };

  const handleRemoveDoc = (index: number) => {
    setDocNames(docNames.filter((_, i) => i !== index));
  };

  const totalAmount = (Number(govFees) || 0) + (Number(serviceCharge) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedServiceId) {
      setErrorMessage('Please select a target service from the catalog.');
      return;
    }

    if (customerMode === 'existing') {
      if (!selectedCustomer) {
        setErrorMessage('Please select an existing customer or create a new customer record.');
        return;
      }
    } else {
      if (!newCustName.trim() || !newCustMobile.trim()) {
        setErrorMessage('Customer Full Name and Mobile Number are required.');
        return;
      }
      if (newCustMobile.replace(/\D/g, '').length < 10) {
        setErrorMessage('Please enter a valid 10-digit mobile number.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Build ISO Date for Order Date
      let resolvedOrderDate: string;
      try {
        resolvedOrderDate = new Date(orderDate).toISOString();
      } catch (e) {
        resolvedOrderDate = new Date().toISOString();
      }

      const payload: any = {
        orderSource,
        sourceReference: sourceReference.trim() || undefined,
        orderDate: resolvedOrderDate,
        orderStatus,
        serviceId: selectedServiceId,
        customGovFees: Number(govFees) || 0,
        customServiceCharge: Number(serviceCharge) || 0,
        priority,
        requirements: requirements.trim() || undefined,
        additionalNotes: additionalNotes.trim() || undefined,
        paymentMethod,
        paymentStatus,
        utr: utr.trim() || undefined,
        paymentDate: paymentDate || new Date().toISOString(),
        uploadedDocuments: docNames.map(name => ({ name }))
      };

      if (customerMode === 'existing' && selectedCustomer) {
        payload.customerId = selectedCustomer.id;
        payload.name = selectedCustomer.name;
        payload.mobile = selectedCustomer.mobile;
        payload.email = selectedCustomer.email;
        payload.address = selectedCustomer.address || '';
        payload.city = selectedCustomer.city || '';
        payload.district = selectedCustomer.district || '';
        payload.state = selectedCustomer.state || '';
        payload.pinCode = selectedCustomer.pincode || selectedCustomer.pinCode || '';
        payload.pincode = selectedCustomer.pincode || selectedCustomer.pinCode || '';
        payload.country = selectedCustomer.country || 'India';
      } else {
        payload.newCustomer = {
          name: newCustName.trim(),
          mobile: newCustMobile.trim(),
          whatsappMobile: sameAsMobile ? newCustMobile.trim() : (newCustWhatsapp.trim() || newCustMobile.trim()),
          email: newCustEmail.trim() || `${newCustName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@easydesk.client`,
          customerType: newCustType,
          address: newCustAddress.trim(),
          city: newCustCity.trim(),
          district: newCustDistrict.trim(),
          state: newCustState.trim(),
          pincode: newCustPincode.trim(),
          pinCode: newCustPincode.trim(),
          country: 'India',
          notes: `Created during manual ${orderSource} order creation`
        };
        payload.name = newCustName.trim();
        payload.mobile = newCustMobile.trim();
        payload.email = newCustEmail.trim() || payload.newCustomer.email;
        payload.address = newCustAddress.trim();
        payload.city = newCustCity.trim();
        payload.district = newCustDistrict.trim();
        payload.state = newCustState.trim();
        payload.pinCode = newCustPincode.trim();
        payload.pincode = newCustPincode.trim();
        payload.country = 'India';
      }

      const res = await adminFetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.order) {
        onSuccess(data.order);
        onClose();
      } else {
        setErrorMessage(data.message || 'Failed to record manual order in database.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error while creating manual order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/80 max-w-3xl w-full max-h-[96vh] sm:max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white">Manual Order Entry</h3>
                <span className="bg-emerald-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Authoritative Record
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Record confirmed customer orders received via WhatsApp, Phone, or In-Person
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body Scrollable */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto text-xs text-slate-700 flex-1">
          
          {/* Error Message Box */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-2xl flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span className="font-medium text-xs">{errorMessage}</span>
            </div>
          )}

          {/* SECTION 1: Order Source & Date Parameters */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                1. Order Channel, Date & Status
              </label>
              <span className="text-[10px] text-slate-500 font-medium">Authoritative Source Parameters</span>
            </div>

            {/* Source Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: 'WhatsApp', label: 'WhatsApp', icon: MessageSquare, badge: 'Recommended', color: 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20' },
                { id: 'Website', label: 'Website', icon: Globe, color: 'border-blue-500 bg-blue-50 text-blue-950 ring-2 ring-blue-500/20' },
                { id: 'Phone', label: 'Phone Call', icon: Phone, color: 'border-indigo-500 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-500/20' },
                { id: 'In-Person', label: 'In-Person', icon: User, color: 'border-purple-500 bg-purple-50 text-purple-950 ring-2 ring-purple-500/20' },
                { id: 'Other', label: 'Other', icon: FileText, color: 'border-slate-500 bg-slate-100 text-slate-950 ring-2 ring-slate-500/20' }
              ].map(src => {
                const Icon = src.icon;
                const isSelected = orderSource === src.id;
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setOrderSource(src.id as any)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer relative ${
                      isSelected
                        ? src.color
                        : 'border-slate-200 bg-white hover:bg-slate-100/60 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-slate-500'}`} />
                      {src.badge && (
                        <span className="text-[8px] bg-emerald-600 text-white font-extrabold px-1.5 py-0.5 rounded">
                          {src.badge}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-xs">{src.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Order Date & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  Order Date & Time (WhatsApp Timestamp) *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={orderDate}
                  onChange={e => setOrderDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-mono focus:outline-none focus:border-emerald-600"
                />
                <span className="text-[9px] text-slate-400 mt-1 block">Set backdated timestamp if order was confirmed earlier.</span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  Initial Order Status *
                </label>
                <select
                  value={orderStatus}
                  onChange={e => setOrderStatus(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                >
                  <option value={OrderStatus.PENDING}>Pending / Received</option>
                  <option value={OrderStatus.PROCESSING}>Processing / In Progress</option>
                  <option value={OrderStatus.DOCUMENTS_REQUIRED}>Documents Required</option>
                  <option value={OrderStatus.UNDER_VERIFICATION}>Under Verification</option>
                  <option value={OrderStatus.COMPLETED}>Completed</option>
                  <option value={OrderStatus.REJECTED}>Cancelled / Rejected</option>
                </select>
                <span className="text-[9px] text-slate-400 mt-1 block">Status can be updated anytime from the Action Drawer.</span>
              </div>
            </div>

            {/* WhatsApp Ref */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                WhatsApp Reference / Conversation Note (Optional)
              </label>
              <input
                type="text"
                value={sourceReference}
                onChange={e => setSourceReference(e.target.value)}
                placeholder="e.g. Customer contacted via WhatsApp on 18 Aug 2026 regarding PAN card renewal"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {/* SECTION 2: Customer Selection / Creation */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <label className="font-bold text-xs text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                2. Customer Information (Authoritative Customer Profile)
              </label>
              
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setCustomerMode('existing')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    customerMode === 'existing'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Select Existing Customer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerMode('new');
                    setSelectedCustomer(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    customerMode === 'new'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  + Create New Customer
                </button>
              </div>
            </div>

            {customerMode === 'existing' ? (
              <div className="space-y-3">
                {selectedCustomer ? (
                  <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3.5 flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-xs">{selectedCustomer.name}</span>
                        <span className="bg-blue-600 text-white font-mono font-bold text-[9px] px-2 py-0.5 rounded">
                          {selectedCustomer.code}
                        </span>
                        <span className="text-[10px] text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded">
                          {selectedCustomer.customerType}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 space-y-0.5">
                        <p><strong>Mobile:</strong> {selectedCustomer.mobile} {selectedCustomer.whatsappMobile ? `(WA: ${selectedCustomer.whatsappMobile})` : ''}</p>
                        <p><strong>Email:</strong> {selectedCustomer.email}</p>
                        <p><strong>Location:</strong> {selectedCustomer.city}, {selectedCustomer.state} - {selectedCustomer.pincode}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(null)}
                      className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[10px] px-3 py-1.5 rounded-xl transition cursor-pointer shadow-sm"
                    >
                      Change Customer
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={e => setCustomerSearch(e.target.value)}
                        placeholder="Search customer by Name, Mobile (e.g. 9876543210), Email, or CUST code..."
                        className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 bg-white">
                      {isSearchingCustomers ? (
                        <p className="p-3 text-center text-slate-400 text-xs">Loading customer directory...</p>
                      ) : filteredCustomers.length === 0 ? (
                        <div className="p-3 text-center text-slate-400 text-xs">
                          No matching customer record found.{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setCustomerMode('new');
                              setNewCustName(customerSearch);
                            }}
                            className="text-blue-600 font-bold hover:underline ml-1 cursor-pointer"
                          >
                            + Create New Customer Profile
                          </button>
                        </div>
                      ) : (
                        filteredCustomers.slice(0, 10).map(cust => (
                          <div
                            key={cust.id}
                            onClick={() => setSelectedCustomer(cust)}
                            className="p-2.5 hover:bg-blue-50/50 cursor-pointer flex items-center justify-between transition"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-xs">{cust.name}</span>
                                <span className="text-[9px] font-mono font-bold text-blue-600">{cust.code}</span>
                                <span className="text-[9px] text-slate-500 font-medium">({cust.customerType})</span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono">
                                📞 {cust.mobile} • ✉️ {cust.email} • 📍 {cust.city || 'N/A'}
                              </span>
                            </div>
                            <span className="text-[10px] bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-bold px-2.5 py-1 rounded-lg transition">
                              Select
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in duration-100">
                {/* Duplicate Warning Banner */}
                {matchingDuplicateCustomer && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <strong>Existing Customer Found:</strong> {matchingDuplicateCustomer.name} ({matchingDuplicateCustomer.code} - {matchingDuplicateCustomer.mobile})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(matchingDuplicateCustomer);
                        setCustomerMode('existing');
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-3 py-1 rounded-xl transition cursor-pointer shrink-0 ml-2"
                    >
                      Use Existing Record
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newCustName}
                      onChange={e => setNewCustName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                      Customer Type
                    </label>
                    <select
                      value={newCustType}
                      onChange={e => setNewCustType(e.target.value as any)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-600 font-medium"
                    >
                      <option value="Individual">Individual Citizen</option>
                      <option value="Business">Business / MSME / Trader</option>
                      <option value="Franchise">Franchise / Partner</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                      Mobile Number (Calling) *
                    </label>
                    <input
                      type="tel"
                      required
                      value={newCustMobile}
                      onChange={e => setNewCustMobile(e.target.value)}
                      placeholder="9876543210"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-600 font-mono"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                        WhatsApp Number
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={sameAsMobile}
                          onChange={e => setSameAsMobile(e.target.checked)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3 h-3"
                        />
                        Same as Mobile
                      </label>
                    </div>
                    <input
                      type="tel"
                      disabled={sameAsMobile}
                      value={sameAsMobile ? newCustMobile : newCustWhatsapp}
                      onChange={e => setNewCustWhatsapp(e.target.value)}
                      placeholder="9876543210"
                      className={`w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none ${
                        sameAsMobile ? 'bg-slate-50 text-slate-400' : 'bg-white focus:border-emerald-600'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={newCustEmail}
                    onChange={e => setNewCustEmail(e.target.value)}
                    placeholder="customer@gmail.com"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <IndianAddressFields
                    compact
                    showLandmark={false}
                    value={{
                      country: 'India',
                      state: newCustState,
                      district: newCustDistrict,
                      city: newCustCity,
                      addressLine1: newCustAddress,
                      pinCode: newCustPincode,
                      pincode: newCustPincode
                    }}
                    onChange={(addr) => {
                      setNewCustState(addr.state || '');
                      setNewCustDistrict(addr.district || '');
                      setNewCustCity(addr.city || '');
                      setNewCustPincode(addr.pinCode || addr.pincode || '');
                      setNewCustAddress(addr.addressLine1 || addr.address || '');
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: Service Selection & Pricing */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-4">
            <label className="font-bold text-xs text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              3. Service Selection & Fee Calculation
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                  Select Target Service from EasyDesk Catalog *
                </label>
                <select
                  required
                  value={selectedServiceId}
                  onChange={e => handleServiceChange(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-xs bg-white font-bold text-slate-900 focus:outline-none focus:border-blue-600 shadow-sm"
                >
                  <option value="">-- Select Service from Active Catalog --</option>
                  {categories.map(cat => {
                    const catServices = services.filter(s => s.categoryId === cat.id);
                    if (catServices.length === 0) return null;
                    return (
                      <optgroup key={cat.id} label={cat.name}>
                        {catServices.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.title} (Gov: ₹{s.govFees} + Service: ₹{s.serviceCharge} = Total: ₹{s.govFees + s.serviceCharge})
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                  Government Fees (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={govFees}
                  onChange={e => setGovFees(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-mono font-bold focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                  EasyDesk Service Charge (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={serviceCharge}
                  onChange={e => setServiceCharge(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-mono font-bold focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                  Processing Priority
                </label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-medium focus:outline-none focus:border-blue-600"
                >
                  <option value="Normal">Normal Processing</option>
                  <option value="High">High Priority</option>
                  <option value="Urgent">Urgent / Fast-Track</option>
                </select>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Payable Amount</span>
                  <span className="font-extrabold text-base text-slate-900 font-mono">₹{totalAmount}</span>
                </div>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                  Gov: ₹{govFees} + Service: ₹{serviceCharge}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 4: Requirements & WhatsApp Notes */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
            <label className="font-bold text-xs text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              4. WhatsApp Conversation Notes & Requirements
            </label>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                Specific Customer Requirements (as agreed on WhatsApp)
              </label>
              <textarea
                rows={2}
                value={requirements}
                onChange={e => setRequirements(e.target.value)}
                placeholder="e.g. Customer needs Name Correction in PAN card matching Aadhaar. Urgently required for passport appointment."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                Internal Administrative Processing Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={additionalNotes}
                onChange={e => setAdditionalNotes(e.target.value)}
                placeholder="e.g. Customer provided Aadhaar PDF via WhatsApp. Document verified. Assigned to executive for portal upload."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* SECTION 5: Initial Documents Checklist */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <label className="font-bold text-xs text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-600" />
              5. Documents Required / Received on WhatsApp
            </label>

            <div className="flex flex-wrap gap-2">
              {docNames.map((doc, idx) => (
                <span
                  key={idx}
                  className="bg-white border border-slate-200 text-slate-700 text-xs px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  {doc}
                  <button
                    type="button"
                    onClick={() => handleRemoveDoc(idx)}
                    className="text-slate-400 hover:text-red-600 font-bold ml-1 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={customDocInput}
                onChange={e => setCustomDocInput(e.target.value)}
                placeholder="Add another required document (e.g. Electricity Bill, Photo, Form 16)..."
                className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-600"
              />
              <button
                type="button"
                onClick={handleAddDoc}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer"
              >
                + Add Doc
              </button>
            </div>
          </div>

          {/* SECTION 6: Payment Details (Optional / Flexible) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
            <label className="font-bold text-xs text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-emerald-600" />
              6. Payment Recording (Optional / If paid on WhatsApp)
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="QR Code">Dynamic QR Code</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT / IMPS)</option>
                  <option value="Cash">Cash / In-Person</option>
                  <option value="Other">Other Gateway</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                  Payment Verification Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={e => setPaymentStatus(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="Pending Verification">Pending Verification (Default)</option>
                  <option value="Verified">Verified / Paid (UTR Confirmed)</option>
                  <option value="Pending">Unpaid / Payment Pending</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Not Applicable">Not Applicable</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                  Transaction UTR / Reference No. (Optional)
                </label>
                <input
                  type="text"
                  value={utr}
                  onChange={e => setUtr(e.target.value)}
                  placeholder="e.g. 429182910482"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-mono focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Privacy & Security Mandate Notice Banner */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-3 text-amber-900">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong className="font-extrabold block text-amber-950">Security & Privacy Protocol:</strong>
              EasyDesk operations staff will <strong>NEVER</strong> request or record customer Bank OTPs, UPI PINs, ATM PINs, Net Banking Passwords, or CVVs. Only official public documents for application verification may be attached.
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              Order will be assigned to authoritative <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono">orders</code> database.
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial bg-slate-900 hover:bg-slate-850 text-white font-extrabold px-6 py-2.5 rounded-xl transition cursor-pointer text-xs shadow-md flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Recording Order...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Create Order Record
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
