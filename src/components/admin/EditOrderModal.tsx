import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle2, AlertCircle, Edit3, IndianRupee, 
  Sparkles, FileText, User, ShieldAlert, Calendar, Clock 
} from 'lucide-react';
import { Order, Service, ServiceCategory, OrderStatus, PaymentMethod, PaymentStatus } from '../../types.js';

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  services: Service[];
  categories: ServiceCategory[];
  onSuccess: (updatedOrder: Order) => void;
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export default function EditOrderModal({
  isOpen,
  onClose,
  order,
  services,
  categories,
  onSuccess,
  adminFetch
}: EditOrderModalProps) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [priority, setPriority] = useState<'Normal' | 'High' | 'Urgent'>('Normal');
  const [orderSource, setOrderSource] = useState<'WhatsApp' | 'Website' | 'Phone' | 'In-Person' | 'Other'>('WhatsApp');
  const [orderDate, setOrderDate] = useState('');
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(OrderStatus.PENDING);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<any>('UPI');
  const [paymentStatus, setPaymentStatus] = useState<any>('Pending Verification');
  const [utr, setUtr] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (order) {
      setName(order.name || '');
      setMobile(order.mobile || '');
      setEmail(order.email || '');
      setAddress(order.address || '');
      setCity(order.city || '');
      setState(order.state || '');
      setPinCode(order.pinCode || '');
      setServiceId(order.serviceId || '');
      setTotalAmount(order.totalAmount || 0);
      setPriority(order.priority || 'Normal');
      setOrderSource((order.orderSource as any) || 'WhatsApp');
      setOrderStatus(order.orderStatus || OrderStatus.PENDING);
      
      // Order date
      if (order.createdAt) {
        try {
          const d = new Date(order.createdAt);
          const tzOffset = d.getTimezoneOffset() * 60000;
          setOrderDate(new Date(d.getTime() - tzOffset).toISOString().slice(0, 16));
        } catch (e) {
          setOrderDate('');
        }
      }

      setAdditionalNotes(order.additionalNotes || '');
      setPaymentMethod(order.paymentMethod || 'UPI');
      setPaymentStatus(order.paymentStatus || 'Pending Verification');
      setUtr(order.utr || '');
      setErrorMessage('');
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim()) {
      setErrorMessage('Customer Name and Mobile are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      let resolvedDate: string | undefined = undefined;
      if (orderDate) {
        try {
          resolvedDate = new Date(orderDate).toISOString();
        } catch (e) {
          // ignore
        }
      }

      const payload: any = {
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pinCode: pinCode.trim(),
        serviceId,
        totalAmount: Number(totalAmount),
        priority,
        orderSource,
        orderStatus,
        createdAt: resolvedDate,
        additionalNotes: additionalNotes.trim(),
        paymentMethod,
        paymentStatus,
        utr: utr.trim() || undefined
      };

      const res = await adminFetch(`/api/admin/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.order) {
        onSuccess(data.order);
        onClose();
      } else {
        setErrorMessage(data.message || 'Failed to update order.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error updating order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/80 max-w-2xl w-full max-h-[96vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white">Edit Order {order.id}</h3>
                <span className="bg-blue-600 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded">
                  {orderSource}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">Modify customer contact information, service details, and order parameters</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-xl transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs text-slate-700 flex-1">
          
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Order Channel & Dates */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <span className="font-bold text-xs text-slate-900 uppercase tracking-wide block">Order Channel, Date & Status</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Order Source</label>
                <select
                  value={orderSource}
                  onChange={e => setOrderSource(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-600 font-bold"
                >
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Website">Website</option>
                  <option value="Phone">Phone</option>
                  <option value="In-Person">In-Person</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  Order Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={orderDate}
                  onChange={e => setOrderDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-mono focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  Order Status
                </label>
                <select
                  value={orderStatus}
                  onChange={e => setOrderStatus(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value={OrderStatus.PENDING}>Pending</option>
                  <option value={OrderStatus.PROCESSING}>Processing</option>
                  <option value={OrderStatus.DOCUMENTS_REQUIRED}>Documents Required</option>
                  <option value={OrderStatus.UNDER_VERIFICATION}>Under Verification</option>
                  <option value={OrderStatus.COMPLETED}>Completed</option>
                  <option value={OrderStatus.REJECTED}>Cancelled / Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Customer Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <span className="font-bold text-xs text-slate-900 uppercase tracking-wide block">Customer Contact Details</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-600 font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-mono focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Street Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Service & Amount */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <span className="font-bold text-xs text-slate-900 uppercase tracking-wide block">Service & Billing Details</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Service Catalog Entry</label>
                <select
                  value={serviceId}
                  onChange={e => {
                    setServiceId(e.target.value);
                    const s = services.find(x => x.id === e.target.value);
                    if (s) {
                      setTotalAmount(s.govFees + s.serviceCharge);
                    }
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-bold focus:outline-none focus:border-blue-600"
                >
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} (₹{s.govFees + s.serviceCharge})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Total Amount (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={totalAmount}
                  onChange={e => setTotalAmount(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-mono font-bold focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-600 font-medium"
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High Priority</option>
                  <option value="Urgent">Urgent / Fast-Track</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Payment Status</label>
                <select
                  value={paymentStatus}
                  onChange={e => setPaymentStatus(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-bold focus:outline-none focus:border-blue-600"
                >
                  <option value="Pending Verification">Pending Verification</option>
                  <option value="Verified">Verified / Paid</option>
                  <option value="Pending">Unpaid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Not Applicable">Not Applicable</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">UTR / Ref No.</label>
                <input
                  type="text"
                  value={utr}
                  onChange={e => setUtr(e.target.value)}
                  placeholder="e.g. 429182910482"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-mono focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Notes & Requirements</label>
              <textarea
                rows={2}
                value={additionalNotes}
                onChange={e => setAdditionalNotes(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-slate-900 hover:bg-slate-850 text-white font-extrabold px-6 py-2 rounded-xl transition cursor-pointer text-xs shadow-md flex items-center gap-2"
            >
              {isSubmitting ? 'Saving Changes...' : 'Save Order Changes'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
