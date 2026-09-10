import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Filter, Plus, Edit, Trash2, Eye, Printer, UserX, UserCheck, 
  Building2, Phone, Mail, MapPin, FileText, CheckCircle2, ShieldAlert, Lock,
  Globe, Tag, AlertCircle, History, Clock, XCircle, ArrowUpDown, CreditCard,
  Calendar, Briefcase, ChevronRight, ExternalLink, RefreshCw, ShoppingBag
} from 'lucide-react';
import { CustomerRecord, Order, Service, OrderStatus, PaymentStatus } from '../../types.js';
import IndianAddressFields from '../common/IndianAddressFields.js';
import { printElement } from '../../lib/printUtils.js';

interface CustomerManagementModuleProps {
  adminFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  triggerAlert: (msg: string) => void;
  onViewOrder?: (order: Order) => void;
  services?: Service[];
}

export default function CustomerManagementModule({ 
  adminFetch, 
  triggerAlert,
  onViewOrder,
  services: servicesProp
}: CustomerManagementModuleProps) {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters for Customer List
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals for Customer CRUD
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewModalTab, setViewModalTab] = useState<'overview' | 'history' | 'orders' | 'notes'>('overview');
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'profile' | 'tax' | 'notes'>('profile');

  // Service History Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<CustomerRecord | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Print Service History Dossier Modal State
  const [dossierPrintModalOpen, setDossierPrintModalOpen] = useState(false);
  const [dossierCustomer, setDossierCustomer] = useState<CustomerRecord | null>(null);

  // Service History Search, Filters & Sorting
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderDateFilter, setOrderDateFilter] = useState('all');
  const [orderSortBy, setOrderSortBy] = useState<'newest' | 'oldest' | 'amount_high' | 'amount_low'>('newest');

  // Create Order for Existing Customer Dialog
  const [createOrderModalOpen, setCreateOrderModalOpen] = useState(false);
  const [availableServices, setAvailableServices] = useState<Service[]>(servicesProp || []);
  const [orderForm, setOrderForm] = useState({
    serviceId: '',
    paymentMethod: 'Bank Transfer',
    additionalNotes: '',
    priority: 'Normal',
    utr: ''
  });
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Custom Non-Blocking Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    confirmStyle: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    confirmStyle: 'primary',
    onConfirm: () => {}
  });

  // Form State for Customer Create/Edit
  const [formCustomer, setFormCustomer] = useState<Partial<CustomerRecord>>({
    code: '',
    name: '',
    customerType: 'Individual',
    contactPersonName: '',
    gender: 'Male',
    dobOrIncorporationDate: '',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    email: '',
    mobile: '',
    whatsappMobile: '',
    country: 'India',
    address: '',
    addressLine1: '',
    addressLine2: '',
    district: '',
    city: '',
    state: '',
    pincode: '',
    status: 'Active',
    gstin: '',
    panNumber: '',
    msmeLicense: '',
    notes: ''
  });

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/customers');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCustomers(data);
        }
      }
    } catch (err) {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        console.warn('Error fetching customers:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (servicesProp && servicesProp.length > 0) {
      setAvailableServices(servicesProp);
    } else {
      adminFetch('/api/services')
        .then(res => res.ok ? res.json() : [])
        .then(data => { if (Array.isArray(data)) setAvailableServices(data); })
        .catch(err => {
          if (typeof navigator === 'undefined' || navigator.onLine !== false) {
            console.warn('Failed to fetch services list:', err);
          }
        });
    }
  }, [servicesProp]);

  // Fetch Customer Order History
  const fetchCustomerOrders = async (cust: CustomerRecord) => {
    setLoadingOrders(true);
    setCustomerOrders([]); // Immediately clear stale orders to guarantee strict isolation
    try {
      const res = await adminFetch(`/api/admin/customers/${cust.id}/orders`);
      if (res.ok) {
        const data = await res.json();
        setCustomerOrders(Array.isArray(data) ? data : []);
      } else {
        setCustomerOrders([]);
      }
    } catch (err) {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        console.warn('Error fetching customer service history:', err);
      }
      setCustomerOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleOpenServiceHistory = (cust: CustomerRecord) => {
    setHistoryCustomer(cust);
    setOrderSearchQuery('');
    setOrderStatusFilter('all');
    setOrderDateFilter('all');
    setOrderSortBy('newest');
    setHistoryModalOpen(true);
    fetchCustomerOrders(cust);
  };

  const handleOpenDossierPrint = (cust: CustomerRecord) => {
    setDossierCustomer(cust);
    setHistoryCustomer(cust);
    setCustomerOrders([]);
    setDossierPrintModalOpen(true);
    fetchCustomerOrders(cust);
  };

  const handleOpenCreate = () => {
    setSelectedCustomer(null);
    const newCode = `CUST-${1000 + customers.length + 1}`;
    setFormCustomer({
      code: newCode,
      name: '',
      customerType: 'Individual',
      contactPersonName: '',
      gender: 'Male',
      dobOrIncorporationDate: '1990-01-01',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      email: '',
      mobile: '',
      whatsappMobile: '',
      country: 'India',
      address: '',
      addressLine1: '',
      addressLine2: '',
      district: '',
      city: '',
      state: '',
      pincode: '',
      status: 'Active',
      gstin: '',
      panNumber: '',
      msmeLicense: '',
      notes: ''
    });
    setModalTab('profile');
    setFormModalOpen(true);
  };

  const handleOpenEdit = (cust: CustomerRecord) => {
    setSelectedCustomer(cust);
    setFormCustomer({ ...cust });
    setModalTab('profile');
    setFormModalOpen(true);
  };

  const handleOpenView = (cust: CustomerRecord) => {
    setSelectedCustomer(cust);
    setViewModalTab('overview');
    setViewModalOpen(true);
    fetchCustomerOrders(cust);
  };

  const handleOpenPrint = (cust: CustomerRecord) => {
    setSelectedCustomer(cust);
    setCustomerOrders([]);
    setPrintModalOpen(true);
    fetchCustomerOrders(cust);
  };

  const handlePrintRecord = () => {
    if (!selectedCustomer) return;
    const printEl = document.getElementById(`customer-printable-sheet-${selectedCustomer.id}`);
    if (printEl) {
      printElement(printEl, `EasyDesk-Customer-Record-${selectedCustomer.code}`);
    } else {
      window.print();
    }
  };

  const handlePrintDossier = () => {
    const cust = dossierCustomer || historyCustomer;
    if (!cust) return;
    const printEl = document.getElementById(`customer-dossier-sheet-${cust.id}`);
    if (printEl) {
      printElement(printEl, `EasyDesk-Customer-Dossier-${cust.code}`);
    } else {
      window.print();
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomer.name || !formCustomer.email) {
      alert('Name and Email are required.');
      return;
    }

    try {
      const custId = selectedCustomer ? selectedCustomer.id : `cust-${Date.now()}`;
      const payload = {
        ...formCustomer,
        id: custId
      };

      const url = selectedCustomer ? `/api/admin/customers/${custId}` : '/api/admin/customers';
      const method = selectedCustomer ? 'PUT' : 'POST';

      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const savedData = await res.json().catch(() => payload as CustomerRecord);
        triggerAlert(`Customer record for ${formCustomer.name} saved successfully!`);
        setFormModalOpen(false);
        setCustomers(prev => {
          const exists = prev.some(c => c.id === savedData.id);
          if (exists) {
            return prev.map(c => c.id === savedData.id ? savedData : c);
          }
          return [savedData, ...prev];
        });
        fetchCustomers();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to save customer: ${errData.message || 'Server error'}`);
      }
    } catch (err: any) {
      alert(err.message || 'Network error saving customer record.');
    }
  };

  const handleToggleStatus = (cust: CustomerRecord) => {
    const nextStatus = cust.status === 'Active' ? 'Inactive' : 'Active';
    const isActivating = nextStatus === 'Active';

    setConfirmModal({
      isOpen: true,
      title: `${isActivating ? 'Activate' : 'Deactivate'} Customer Record`,
      message: `Are you sure you want to change status of ${cust.name} (${cust.code}) to ${nextStatus}?`,
      confirmText: `${isActivating ? 'Activate' : 'Deactivate'} Customer`,
      confirmStyle: isActivating ? 'primary' : 'warning',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          setCustomers(prev => prev.map(c => c.id === cust.id ? { ...c, status: nextStatus as any } : c));

          const res = await adminFetch(`/api/admin/customers/${cust.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: nextStatus })
          });

          if (res.ok) {
            const updated = await res.json().catch(() => null);
            if (updated) {
              setCustomers(prev => prev.map(c => c.id === cust.id ? updated : c));
            }
            triggerAlert(`Customer status set to ${nextStatus}.`);
          } else {
            const errData = await res.json().catch(() => ({}));
            triggerAlert(`Failed to update status: ${errData.message || 'Server error'}`);
            fetchCustomers();
          }
        } catch (e: any) {
          triggerAlert(`Status update failed: ${e.message || 'Network error'}`);
          fetchCustomers();
        }
      }
    });
  };

  const handleDeleteCustomer = (cust: CustomerRecord) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Customer Record',
      message: `Are you sure you want to permanently delete record for customer ${cust.name} (${cust.code})? This action cannot be undone.`,
      confirmText: 'Delete Customer',
      confirmStyle: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          setCustomers(prev => prev.filter(c => c.id !== cust.id));

          const res = await adminFetch(`/api/admin/customers/${cust.id}`, {
            method: 'DELETE'
          });

          if (res.ok) {
            triggerAlert(`Customer record for ${cust.name} deleted.`);
          } else {
            const errData = await res.json().catch(() => ({}));
            triggerAlert(`Failed to delete customer: ${errData.message || 'Server error'}`);
            fetchCustomers();
          }
        } catch (e: any) {
          triggerAlert(`Delete failed: ${e.message || 'Network error'}`);
          fetchCustomers();
        }
      }
    });
  };

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCust = historyCustomer || selectedCustomer;
    if (!targetCust || !orderForm.serviceId) {
      alert('Please select a valid service.');
      return;
    }

    setSubmittingOrder(true);
    try {
      const res = await adminFetch(`/api/admin/customers/${targetCust.id}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderForm)
      });

      if (res.ok) {
        const newOrder = await res.json();
        triggerAlert(`New service order ${newOrder.id} successfully recorded for ${targetCust.name}!`);
        setCreateOrderModalOpen(false);
        setOrderForm({
          serviceId: '',
          paymentMethod: 'Bank Transfer',
          additionalNotes: '',
          priority: 'Normal',
          utr: ''
        });
        fetchCustomerOrders(targetCust);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to record order: ${errData.message || 'Server error'}`);
      }
    } catch (err: any) {
      alert(err.message || 'Error recording order.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Filtered customer directory list
  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = c.name?.toLowerCase().includes(q) ||
      c.code?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.mobile?.includes(q) ||
      c.city?.toLowerCase().includes(q);

    const matchesType = typeFilter === 'all' || c.customerType === typeFilter;
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Calculate Service History summary statistics
  const totalOrdersCount = customerOrders.length;
  const completedCount = customerOrders.filter(o => o.orderStatus === OrderStatus.COMPLETED).length;
  const processingCount = customerOrders.filter(o => 
    o.orderStatus === OrderStatus.PROCESSING || 
    o.orderStatus === OrderStatus.UNDER_VERIFICATION || 
    o.orderStatus === OrderStatus.DOCUMENTS_REQUIRED
  ).length;
  const pendingCount = customerOrders.filter(o => o.orderStatus === OrderStatus.PENDING).length;
  const rejectedCount = customerOrders.filter(o => o.orderStatus === OrderStatus.REJECTED).length;
  const totalRevenueSpent = customerOrders
    .filter(o => o.orderStatus !== OrderStatus.REJECTED)
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  // Filtered & Sorted Customer Orders
  const filteredCustomerOrders = customerOrders.filter(o => {
    const q = orderSearchQuery.toLowerCase();
    const matchesSearch = !q || 
      o.serviceTitle?.toLowerCase().includes(q) || 
      o.id?.toLowerCase().includes(q) || 
      (o.category && o.category.toLowerCase().includes(q));

    const matchesStatus = orderStatusFilter === 'all' || o.orderStatus === orderStatusFilter;

    let matchesDate = true;
    if (orderDateFilter === '30days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      matchesDate = new Date(o.createdAt) >= thirtyDaysAgo;
    } else if (orderDateFilter === '90days') {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      matchesDate = new Date(o.createdAt) >= ninetyDaysAgo;
    } else if (orderDateFilter === 'year') {
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      matchesDate = new Date(o.createdAt) >= yearAgo;
    }

    return matchesSearch && matchesStatus && matchesDate;
  }).sort((a, b) => {
    if (orderSortBy === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (orderSortBy === 'amount_high') {
      return (b.totalAmount || 0) - (a.totalAmount || 0);
    }
    if (orderSortBy === 'amount_low') {
      return (a.totalAmount || 0) - (b.totalAmount || 0);
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Selected Service object for new order calculator
  const selectedService = availableServices.find(s => s.id === orderForm.serviceId);

  return (
    <div className="space-y-6 font-sans">
      {/* Interactive Controls & Directory Table (hidden during printing) */}
      <div className="space-y-6 print:hidden">
        {/* Header bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Customer Records & Service History
            </span>
            <span className="text-slate-400 text-xs">• Individual & Corporate Accounts</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1">Customer Record Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage customer master directory, view service histories, record new service orders, and track document lifecycles.</p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition flex items-center gap-2 self-start md:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Customer Record
        </button>
      </div>

      {/* Search & Directory Filters */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ID code, email, mobile, city..."
            className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-blue-600"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-700 font-medium cursor-pointer"
        >
          <option value="all">All Customer Types</option>
          <option value="Individual">Individual Citizens</option>
          <option value="Business / Corporate">Business / Corporate</option>
          <option value="Franchise / Partner">Franchise / Partner</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-700 font-medium cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Blocked">Blocked</option>
        </select>
      </div>

      {/* Customer Master Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
            Customer Directory ({filteredCustomers.length} Records)
          </h3>
          <span className="text-[10px] text-slate-400 font-mono">Master Directory</span>
        </div>

        {/* Mobile View: Customer Cards */}
        <div className="sm:hidden p-3 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
              Loading customer records...
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
              No customer records matching search criteria.
            </div>
          ) : (
            filteredCustomers.map(cust => (
              <div key={cust.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <img 
                      src={cust.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'} 
                      alt={cust.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{cust.name}</p>
                      <span className="text-[10px] text-blue-600 font-mono font-bold">{cust.code}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    cust.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    cust.status === 'Inactive' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {cust.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Type</span>
                    <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold inline-block">
                      {cust.customerType}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Location</span>
                    <span className="font-medium text-slate-700">{cust.city || 'N/A'}, {cust.state || 'N/A'}</span>
                  </div>
                </div>

                <div className="text-xs space-y-1 font-mono text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                  {cust.email && (
                    <a href={`mailto:${cust.email}`} className="text-slate-700 hover:text-blue-600 truncate block">
                      ✉️ {cust.email}
                    </a>
                  )}
                  {cust.mobile && (
                    <a href={`tel:${cust.mobile}`} className="text-slate-700 hover:text-blue-600 block">
                      📞 {cust.mobile}
                    </a>
                  )}
                  {cust.gstin && (
                    <p className="text-[11px] text-slate-500">
                      <strong>GST:</strong> {cust.gstin}
                    </p>
                  )}
                </div>

                {/* Touch-Friendly Action Buttons */}
                <div className="pt-1 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleOpenServiceHistory(cust); }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <History className="w-3.5 h-3.5" /> Service History
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleOpenView(cust); }}
                      className="p-2 text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-xl transition cursor-pointer border border-slate-200"
                      title="View Customer Profile"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleOpenPrint(cust); }}
                      className="p-2 text-slate-600 hover:text-emerald-600 bg-slate-50 hover:bg-emerald-50 rounded-xl transition cursor-pointer border border-slate-200"
                      title="Print Customer Record"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleOpenEdit(cust); }}
                      className="p-2 text-slate-600 hover:text-purple-600 bg-slate-50 hover:bg-purple-50 rounded-xl transition cursor-pointer border border-slate-200"
                      title="Edit Customer Details"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleToggleStatus(cust); }}
                      className="p-2 text-slate-600 hover:text-amber-600 bg-slate-50 hover:bg-amber-50 rounded-xl transition cursor-pointer border border-slate-200"
                      title={cust.status === 'Active' ? 'Deactivate' : 'Activate'}
                    >
                      {cust.status === 'Active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(cust); }}
                      className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-xl transition cursor-pointer border border-slate-200"
                      title="Delete Customer Record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden sm:block overflow-x-auto text-xs">
          <table className="w-full min-w-[850px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                <th className="p-3">Customer ID & Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Contact Email & Phone</th>
                <th className="p-3">Location</th>
                <th className="p-3">Tax Identification</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">Loading customer records...</td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">No customer records matching search criteria.</td>
                </tr>
              ) : (
                filteredCustomers.map(cust => (
                  <tr key={cust.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <img 
                          src={cust.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'} 
                          alt={cust.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                        <div>
                          <p className="font-bold text-slate-900">{cust.name}</p>
                          <span className="text-[10px] text-blue-600 font-mono font-bold">{cust.code}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[10px] font-bold">
                        {cust.customerType}
                      </span>
                    </td>
                    <td className="p-3">
                      <p className="text-slate-800">{cust.email}</p>
                      <span className="text-[10px] text-slate-400 font-mono">{cust.mobile}</span>
                    </td>
                    <td className="p-3 text-slate-600">
                      <p className="font-bold">{cust.city || 'N/A'}</p>
                      <span className="text-[10px] text-slate-400">{cust.state || 'N/A'}</span>
                    </td>
                    <td className="p-3 font-mono text-[10px]">
                      {cust.gstin ? (
                        <p><strong className="text-slate-500 font-sans">GST:</strong> {cust.gstin}</p>
                      ) : (
                        <span className="text-slate-400">Individual</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        cust.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        cust.status === 'Inactive' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {cust.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleOpenView(cust); }}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="View Customer Profile"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* PROMINENT SERVICE HISTORY ACTION BUTTON */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleOpenServiceHistory(cust); }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          title="View Service History & Orders"
                        >
                          <History className="w-3.5 h-3.5" /> Service History
                        </button>

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleOpenPrint(cust); }}
                          className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                          title="Print Customer Record"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleOpenEdit(cust); }}
                          className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition cursor-pointer"
                          title="Edit Customer Details"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleToggleStatus(cust); }}
                          className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                          title={cust.status === 'Active' ? 'Deactivate' : 'Activate'}
                        >
                          {cust.status === 'Active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(cust); }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Delete Customer Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* ========================================================= */}
      {/* 2. CUSTOMER SERVICE HISTORY DEDICATED MODAL               */}
      {/* ========================================================= */}
      {historyModalOpen && historyCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 space-y-6 p-6">
            
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      Customer Service History
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{historyCustomer.code}</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mt-0.5">{historyCustomer.name}</h3>
                  <p className="text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{historyCustomer.mobile}</span> • {historyCustomer.email} • {historyCustomer.city || 'N/A'}, {historyCustomer.state || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => historyCustomer && handleOpenDossierPrint(historyCustomer)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Print Clean Customer Service History Dossier"
                >
                  <Printer className="w-4 h-4" /> Print Dossier
                </button>
                <button
                  type="button"
                  onClick={() => setCreateOrderModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Record New Order
                </button>
                <button 
                  type="button"
                  onClick={() => setHistoryModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Summary Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Services</span>
                  <ShoppingBag className="w-4 h-4 text-slate-400" />
                </div>
                <p className="text-2xl font-black text-slate-900">{totalOrdersCount}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">₹{totalRevenueSpent.toLocaleString('en-IN')} Spent</p>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-3.5">
                <div className="flex items-center justify-between text-emerald-600 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Completed</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-black text-emerald-900">{completedCount}</p>
                <p className="text-[10px] text-emerald-600 mt-0.5">Delivered Services</p>
              </div>

              <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-3.5">
                <div className="flex items-center justify-between text-blue-600 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Processing</span>
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl font-black text-blue-900">{processingCount}</p>
                <p className="text-[10px] text-blue-600 mt-0.5">In Progress / Verification</p>
              </div>

              <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-3.5">
                <div className="flex items-center justify-between text-amber-600 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Pending</span>
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-2xl font-black text-amber-900">{pendingCount}</p>
                <p className="text-[10px] text-amber-600 mt-0.5">Awaiting Action</p>
              </div>

              <div className="bg-red-50/60 border border-red-100 rounded-2xl p-3.5 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between text-red-600 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-700">Rejected</span>
                  <XCircle className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-2xl font-black text-red-900">{rejectedCount}</p>
                <p className="text-[10px] text-red-600 mt-0.5">Cancelled / Rejected</p>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  placeholder="Search by Service Name or Order ID..."
                  className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs bg-white text-slate-700 font-medium cursor-pointer"
              >
                <option value="all">All Service Statuses</option>
                <option value={OrderStatus.COMPLETED}>Completed</option>
                <option value={OrderStatus.PROCESSING}>Processing</option>
                <option value={OrderStatus.UNDER_VERIFICATION}>Under Verification</option>
                <option value={OrderStatus.DOCUMENTS_REQUIRED}>Documents Required</option>
                <option value={OrderStatus.PENDING}>Pending</option>
                <option value={OrderStatus.REJECTED}>Rejected</option>
              </select>

              <select
                value={orderDateFilter}
                onChange={(e) => setOrderDateFilter(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs bg-white text-slate-700 font-medium cursor-pointer"
              >
                <option value="all">All Time Range</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
                <option value="year">This Year</option>
              </select>

              <select
                value={orderSortBy}
                onChange={(e) => setOrderSortBy(e.target.value as any)}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs bg-white text-slate-700 font-medium cursor-pointer"
              >
                <option value="newest">Sort: Newest First</option>
                <option value="oldest">Sort: Oldest First</option>
                <option value="amount_high">Sort: Amount High-Low</option>
                <option value="amount_low">Sort: Amount Low-High</option>
              </select>
            </div>

            {/* Chronological Service History Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                      <th className="p-3">Order Date</th>
                      <th className="p-3">Service Name</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Payment Status</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Completion Date</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {loadingOrders ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400">Loading service history orders...</td>
                      </tr>
                    ) : filteredCustomerOrders.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-12 text-center">
                          <div className="max-w-sm mx-auto space-y-2">
                            <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                            <p className="font-bold text-slate-800 text-sm">No service history available yet.</p>
                            <p className="text-[11px] text-slate-400">This customer has no service orders matching the current filter criteria.</p>
                            <button
                              type="button"
                              onClick={() => setCreateOrderModalOpen(true)}
                              className="mt-2 bg-blue-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition hover:bg-blue-700 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Record First Order
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredCustomerOrders.map(order => {
                        const completionLog = order.logs?.find(l => l.status === OrderStatus.COMPLETED);
                        const completionDateStr = order.orderStatus === OrderStatus.COMPLETED 
                          ? new Date(completionLog?.timestamp || order.updatedAt || order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : 'In Progress';

                        return (
                          <tr key={order.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                              {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              <span className="block text-[9px] text-slate-400 font-sans">
                                {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>

                            <td className="p-3 font-bold text-slate-900 max-w-[200px] truncate">
                              {order.serviceTitle}
                            </td>

                            <td className="p-3 text-slate-600 font-medium">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">
                                {order.category || 'General'}
                              </span>
                            </td>

                            <td className="p-3 font-mono font-bold text-blue-600 text-[11px]">
                              {order.id}
                            </td>

                            <td className="p-3">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                order.orderStatus === OrderStatus.COMPLETED ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                order.orderStatus === OrderStatus.PROCESSING ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                order.orderStatus === OrderStatus.UNDER_VERIFICATION ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                order.orderStatus === OrderStatus.DOCUMENTS_REQUIRED ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                order.orderStatus === OrderStatus.PENDING ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-red-50 text-red-700 border-red-200'
                              }`}>
                                {order.orderStatus}
                              </span>
                            </td>

                            <td className="p-3 font-medium">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                order.paymentStatus === PaymentStatus.VERIFIED ? 'bg-emerald-50 text-emerald-700' :
                                order.paymentStatus === PaymentStatus.REJECTED ? 'bg-red-50 text-red-700' :
                                'bg-amber-50 text-amber-700'
                              }`}>
                                {order.paymentStatus || 'Pending'}
                              </span>
                            </td>

                            <td className="p-3 font-bold text-slate-900 font-mono text-xs">
                              ₹{(order.totalAmount || 0).toLocaleString('en-IN')}
                            </td>

                            <td className="p-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                              {completionDateStr}
                            </td>

                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  if (onViewOrder) {
                                    onViewOrder(order);
                                  } else {
                                    alert(`Order Details: ID ${order.id} - ${order.serviceTitle}`);
                                  }
                                }}
                                className="bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-[11px] px-3 py-1.5 rounded-xl transition flex items-center gap-1 ml-auto cursor-pointer border border-slate-200 hover:border-blue-200"
                              >
                                <Eye className="w-3.5 h-3.5" /> View Order
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <p>Showing {filteredCustomerOrders.length} of {totalOrdersCount} linked orders</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => historyCustomer && handleOpenDossierPrint(historyCustomer)}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print Dossier
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Close History
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. NEW ORDER FOR EXISTING CUSTOMER DIALOG                 */}
      {/* ========================================================= */}
      {createOrderModalOpen && (historyCustomer || selectedCustomer) && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-[60] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Record New Service Order
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  New Order for {(historyCustomer || selectedCustomer)?.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Customer ID: <strong className="font-mono text-blue-600">{(historyCustomer || selectedCustomer)?.code}</strong> • Mobile: {(historyCustomer || selectedCustomer)?.mobile}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setCreateOrderModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} className="space-y-4 text-xs">
              
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Catalog Service *</label>
                <select
                  required
                  value={orderForm.serviceId}
                  onChange={(e) => setOrderForm({ ...orderForm, serviceId: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 font-medium focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="">-- Select a Service from Catalog --</option>
                  {availableServices.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} (Gov Fees: ₹{s.govFees} + Service Fee: ₹{s.serviceCharge} = Total ₹{s.govFees + s.serviceCharge})
                    </option>
                  ))}
                </select>
              </div>

              {selectedService && (
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-1.5 font-mono text-slate-800">
                  <div className="flex justify-between">
                    <span className="font-sans text-slate-500">Government Fees:</span>
                    <strong className="font-bold">₹{selectedService.govFees}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans text-slate-500">Service Processing Charge:</span>
                    <strong className="font-bold">₹{selectedService.serviceCharge}</strong>
                  </div>
                  <div className="border-t border-slate-200 pt-1.5 flex justify-between text-sm text-blue-700 font-bold">
                    <span className="font-sans">Total Amount Payable:</span>
                    <span>₹{selectedService.govFees + selectedService.serviceCharge}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Payment Method</label>
                  <select
                    value={orderForm.paymentMethod}
                    onChange={(e) => setOrderForm({ ...orderForm, paymentMethod: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="UPI">UPI Direct</option>
                    <option value="QR Code">QR Code Payment</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Priority Level</label>
                  <select
                    value={orderForm.priority}
                    onChange={(e) => setOrderForm({ ...orderForm, priority: e.target.value as any })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High Priority</option>
                    <option value="Urgent">Urgent / Express</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Transaction UTR / Reference No (Optional)</label>
                <input
                  type="text"
                  value={orderForm.utr}
                  onChange={(e) => setOrderForm({ ...orderForm, utr: e.target.value })}
                  placeholder="e.g. UTR1234567890"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Additional Order Notes / Customer Instructions</label>
                <textarea
                  rows={2}
                  value={orderForm.additionalNotes}
                  onChange={(e) => setOrderForm({ ...orderForm, additionalNotes: e.target.value })}
                  placeholder="Specify custom instructions or document requirements..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateOrderModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOrder || !orderForm.serviceId}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {submittingOrder ? 'Recording Order...' : 'Confirm & Record Order'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* CREATE / EDIT CUSTOMER MASTER RECORD MODAL                 */}
      {/* ========================================================= */}
      {formModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                  Customer Master Record
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {selectedCustomer ? `Edit Customer: ${selectedCustomer.name}` : 'Create New Customer Master Record'}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setFormModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="px-6 pt-4 border-b border-slate-100 flex gap-2 overflow-x-auto text-xs font-bold">
              <button
                type="button"
                onClick={() => setModalTab('profile')}
                className={`px-4 py-2 rounded-t-xl transition border-b-2 cursor-pointer ${modalTab === 'profile' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
              >
                1. Basic Profile
              </button>
              <button
                type="button"
                onClick={() => setModalTab('tax')}
                className={`px-4 py-2 rounded-t-xl transition border-b-2 cursor-pointer ${modalTab === 'tax' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
              >
                2. Business & Tax Identification
              </button>
              <button
                type="button"
                onClick={() => setModalTab('notes')}
                className={`px-4 py-2 rounded-t-xl transition border-b-2 cursor-pointer ${modalTab === 'notes' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
              >
                3. Notes & Remarks
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 space-y-6">
              
              {/* TAB 1: BASIC PROFILE */}
              {modalTab === 'profile' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Customer / Business Name *</label>
                      <input
                        type="text"
                        required
                        value={formCustomer.name}
                        onChange={(e) => setFormCustomer({ ...formCustomer, name: e.target.value })}
                        placeholder="Full Name or Business Name"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Customer Code / ID *</label>
                      <input
                        type="text"
                        required
                        value={formCustomer.code}
                        onChange={(e) => setFormCustomer({ ...formCustomer, code: e.target.value })}
                        placeholder="CUST-1001"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Customer Type</label>
                      <select
                        value={formCustomer.customerType}
                        onChange={(e) => setFormCustomer({ ...formCustomer, customerType: e.target.value as any })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 bg-white cursor-pointer"
                      >
                        <option value="Individual">Individual</option>
                        <option value="Business / Corporate">Business / Corporate</option>
                        <option value="Franchise / Partner">Franchise / Partner</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Primary Contact Person</label>
                      <input
                        type="text"
                        value={formCustomer.contactPersonName}
                        onChange={(e) => setFormCustomer({ ...formCustomer, contactPersonName: e.target.value })}
                        placeholder="Contact person name"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Gender</label>
                      <select
                        value={formCustomer.gender}
                        onChange={(e) => setFormCustomer({ ...formCustomer, gender: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 bg-white cursor-pointer"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">DOB / Incorporation Date</label>
                      <input
                        type="date"
                        value={formCustomer.dobOrIncorporationDate}
                        onChange={(e) => setFormCustomer({ ...formCustomer, dobOrIncorporationDate: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Official Email Address *</label>
                      <input
                        type="email"
                        required
                        value={formCustomer.email}
                        onChange={(e) => setFormCustomer({ ...formCustomer, email: e.target.value })}
                        placeholder="customer@email.com"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Primary Mobile Number</label>
                      <input
                        type="text"
                        value={formCustomer.mobile}
                        onChange={(e) => setFormCustomer({ ...formCustomer, mobile: e.target.value })}
                        placeholder="9876543210"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Alternate / WhatsApp Number</label>
                      <input
                        type="text"
                        value={formCustomer.whatsappMobile}
                        onChange={(e) => setFormCustomer({ ...formCustomer, whatsappMobile: e.target.value })}
                        placeholder="WhatsApp contact"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  {/* Structured Indian Address Section */}
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-2">
                    <span className="font-bold text-xs text-slate-800 uppercase tracking-wide block mb-1">
                      Customer Address
                    </span>
                    <IndianAddressFields
                      value={{
                        country: formCustomer.country || 'India',
                        state: formCustomer.state || '',
                        district: formCustomer.district || '',
                        city: formCustomer.city || '',
                        addressLine1: formCustomer.addressLine1 || formCustomer.address || '',
                        addressLine2: formCustomer.addressLine2 || '',
                        locality: formCustomer.locality || '',
                        landmark: formCustomer.landmark || '',
                        pincode: formCustomer.pincode || formCustomer.pinCode || '',
                        pinCode: formCustomer.pinCode || formCustomer.pincode || '',
                        address: formCustomer.address || ''
                      }}
                      onChange={(addr) => {
                        setFormCustomer(prev => ({
                          ...prev,
                          country: addr.country,
                          state: addr.state,
                          district: addr.district,
                          city: addr.city,
                          addressLine1: addr.addressLine1,
                          addressLine2: addr.addressLine2,
                          locality: addr.locality,
                          landmark: addr.landmark,
                          pincode: addr.pincode,
                          pinCode: addr.pinCode,
                          address: addr.address
                        }));
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Record Status</label>
                      <select
                        value={formCustomer.status}
                        onChange={(e) => setFormCustomer({ ...formCustomer, status: e.target.value as any })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 bg-white cursor-pointer"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Blocked">Blocked</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Profile Photo / Logo URL</label>
                      <input
                        type="text"
                        value={formCustomer.photoUrl}
                        onChange={(e) => setFormCustomer({ ...formCustomer, photoUrl: e.target.value })}
                        placeholder="https://..."
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: TAX IDENTIFICATION */}
              {modalTab === 'tax' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">GSTIN Number</label>
                      <input
                        type="text"
                        value={formCustomer.gstin}
                        onChange={(e) => setFormCustomer({ ...formCustomer, gstin: e.target.value })}
                        placeholder="e.g. 27ABCDE1234F1Z5"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">PAN / Business Reg Number</label>
                      <input
                        type="text"
                        value={formCustomer.panNumber}
                        onChange={(e) => setFormCustomer({ ...formCustomer, panNumber: e.target.value })}
                        placeholder="e.g. ABCDE1234F"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Trade / MSME License Number</label>
                      <input
                        type="text"
                        value={formCustomer.msmeLicense}
                        onChange={(e) => setFormCustomer({ ...formCustomer, msmeLicense: e.target.value })}
                        placeholder="UDYAM-XX-00-0000000"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: NOTES */}
              {modalTab === 'notes' && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Internal Notes & Remarks</label>
                    <textarea
                      rows={4}
                      value={formCustomer.notes}
                      onChange={(e) => setFormCustomer({ ...formCustomer, notes: e.target.value })}
                      placeholder="Add customer preferences, business guidelines, or account notes..."
                      className="w-full border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs cursor-pointer"
                >
                  Save Customer Record
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 9. VIEW CUSTOMER PROFILE & INTEGRATED TABS MODAL          */}
      {/* ========================================================= */}
      {viewModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-6 max-h-[92vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <img 
                  src={selectedCustomer.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'} 
                  alt={selectedCustomer.name} 
                  className="w-12 h-12 rounded-full object-cover border-2 border-blue-600 shadow-xs shrink-0"
                />
                <div>
                  <h3 className="text-lg font-black text-slate-900">{selectedCustomer.name}</h3>
                  <span className="text-xs text-blue-600 font-mono font-bold">{selectedCustomer.code} • {selectedCustomer.customerType}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setViewModalOpen(false); handleOpenPrint(selectedCustomer); }}
                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Record
                </button>
                <button
                  type="button"
                  onClick={() => setViewModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* TAB SELECTOR: Overview | Service History | Orders | Notes */}
            <div className="flex gap-2 border-b border-slate-100 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewModalTab('overview')}
                className={`px-4 py-2.5 rounded-t-xl transition border-b-2 cursor-pointer ${viewModalTab === 'overview' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setViewModalTab('history')}
                className={`px-4 py-2.5 rounded-t-xl transition border-b-2 cursor-pointer flex items-center gap-1.5 ${viewModalTab === 'history' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
              >
                <History className="w-3.5 h-3.5" /> Service History ({customerOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setViewModalTab('orders')}
                className={`px-4 py-2.5 rounded-t-xl transition border-b-2 cursor-pointer flex items-center gap-1.5 ${viewModalTab === 'orders' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
              >
                <ShoppingBag className="w-3.5 h-3.5" /> Linked Orders
              </button>
              <button
                type="button"
                onClick={() => setViewModalTab('notes')}
                className={`px-4 py-2.5 rounded-t-xl transition border-b-2 cursor-pointer ${viewModalTab === 'notes' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
              >
                Notes & Remarks
              </button>
            </div>

            {/* TAB CONTENT 1: OVERVIEW */}
            {viewModalTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Contact Person</span>
                    <p className="font-bold text-slate-800">{selectedCustomer.contactPersonName || selectedCustomer.name}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">City / State</span>
                    <p className="font-bold text-slate-800">{selectedCustomer.city}, {selectedCustomer.state}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Status</span>
                    <span className="font-bold text-emerald-600">{selectedCustomer.status}</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Contact Details</h4>
                  <div className="bg-white border border-slate-100 p-3.5 rounded-xl space-y-1.5">
                    <p><strong className="text-slate-500">Email:</strong> {selectedCustomer.email}</p>
                    <p><strong className="text-slate-500">Phone:</strong> {selectedCustomer.mobile}</p>
                    <p><strong className="text-slate-500">WhatsApp:</strong> {selectedCustomer.whatsappMobile || selectedCustomer.mobile}</p>
                    <p><strong className="text-slate-500">Address:</strong> {selectedCustomer.address}, {selectedCustomer.city}, {selectedCustomer.state} - {selectedCustomer.pincode}</p>
                  </div>
                </div>

                {selectedCustomer.gstin && (
                  <div className="space-y-2 text-xs">
                    <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Business & Tax Identification</h4>
                    <div className="bg-slate-50 p-3.5 rounded-xl font-mono space-y-1.5">
                      <p><strong className="text-slate-500 font-sans">GSTIN:</strong> {selectedCustomer.gstin}</p>
                      <p><strong className="text-slate-500 font-sans">PAN:</strong> {selectedCustomer.panNumber || 'N/A'}</p>
                      <p><strong className="text-slate-500 font-sans">MSME License:</strong> {selectedCustomer.msmeLicense || 'N/A'}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 2: SERVICE HISTORY */}
            {viewModalTab === 'history' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Chronological Service History</h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => selectedCustomer && handleOpenDossierPrint(selectedCustomer)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Dossier
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryCustomer(selectedCustomer);
                        setCreateOrderModalOpen(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Record Order
                    </button>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Orders</span>
                    <strong className="text-lg font-black text-slate-900">{totalOrdersCount}</strong>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <span className="text-[10px] text-emerald-600 font-bold block uppercase">Completed</span>
                    <strong className="text-lg font-black text-emerald-900">{completedCount}</strong>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                    <span className="text-[10px] text-blue-600 font-bold block uppercase">Processing</span>
                    <strong className="text-lg font-black text-blue-900">{processingCount}</strong>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <span className="text-[10px] text-amber-600 font-bold block uppercase">Pending</span>
                    <strong className="text-lg font-black text-amber-900">{pendingCount}</strong>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase text-[9px]">
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Service Name</th>
                        <th className="p-2.5">Order ID</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Amount</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {loadingOrders ? (
                        <tr><td colSpan={6} className="p-6 text-center text-slate-400">Loading history...</td></tr>
                      ) : customerOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                            No service history available yet.
                          </td>
                        </tr>
                      ) : (
                        customerOrders.map(o => (
                          <tr key={o.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono text-[11px]">{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                            <td className="p-2.5 font-bold text-slate-900">{o.serviceTitle}</td>
                            <td className="p-2.5 font-mono text-blue-600 font-bold">{o.id}</td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                                {o.orderStatus}
                              </span>
                            </td>
                            <td className="p-2.5 font-mono font-bold">₹{o.totalAmount}</td>
                            <td className="p-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => onViewOrder && onViewOrder(o)}
                                className="bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-[10px] px-2.5 py-1 rounded-lg transition"
                              >
                                View Order
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: ORDERS */}
            {viewModalTab === 'orders' && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">All Customer Orders ({customerOrders.length})</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryCustomer(selectedCustomer);
                      setCreateOrderModalOpen(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Record New Order
                  </button>
                </div>

                {customerOrders.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 font-bold">
                    No service history available yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {customerOrders.map(o => (
                      <div key={o.id} className="p-3.5 border border-slate-200 rounded-2xl bg-white space-y-2 hover:border-blue-300 transition">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono text-[10px] text-blue-600 font-bold block">{o.id}</span>
                            <h5 className="font-bold text-slate-900">{o.serviceTitle}</h5>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                            {o.orderStatus}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-100">
                          <span className="font-mono font-bold text-slate-900">₹{o.totalAmount}</span>
                          <button
                            type="button"
                            onClick={() => onViewOrder && onViewOrder(o)}
                            className="text-blue-600 font-bold hover:underline"
                          >
                            View Details →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 4: NOTES */}
            {viewModalTab === 'notes' && (
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Internal Notes & Remarks</h4>
                {selectedCustomer.notes ? (
                  <p className="p-4 bg-slate-50 rounded-2xl text-slate-700 italic leading-relaxed border border-slate-200">{selectedCustomer.notes}</p>
                ) : (
                  <p className="p-4 bg-slate-50 rounded-2xl text-slate-400 italic">No internal notes added for this customer account.</p>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. PRINTABLE CUSTOMER RECORD MODAL                        */}
      {/* ========================================================= */}
      {printModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 overflow-y-auto printable-modal-overlay">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-8 shadow-2xl border border-slate-300 space-y-6 font-sans text-slate-900 printable-modal-card">
            
            {/* Top Toolbar - Hidden during print */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full uppercase tracking-wider">
                  Official Client Master Document
                </span>
                <span className="text-xs text-slate-500 font-mono font-bold">Code: {selectedCustomer.code}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrintRecord}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print Document Now
                </button>
                <button
                  type="button"
                  onClick={() => setPrintModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Target Printable Sheet */}
            <div id={`customer-printable-sheet-${selectedCustomer.id}`} className="space-y-4 text-slate-900 bg-white">
              
              {/* 1. Official Corporate Letterhead */}
              <div className="border-b-2 border-slate-900 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 bg-[#0F4C81] text-white rounded-xl flex items-center justify-center font-black text-xl tracking-tighter shrink-0">
                      ED
                    </div>
                    <div>
                      <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase leading-none">
                        EasyDesk Solutions Private Limited
                      </h1>
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mt-1">
                        Customer Relationship & Client Account Registry • Operations Management
                      </p>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                        A51, Vijay Nagar, Indore, Madhya Pradesh - 452010 • Desk Helpline: +91 9575538590 • support@easydesk.com
                      </p>
                      <p className="text-[8px] text-slate-400 font-mono">
                        CIN: U72900MH2024PTC123456 • ISO 9001:2015 Certified Citizen & Business Registry
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-600 shrink-0">
                    <span className="inline-block bg-slate-100 text-slate-800 border border-slate-300 font-extrabold text-[9px] px-2.5 py-0.5 rounded uppercase tracking-wider mb-1">
                      Official Client File
                    </span>
                    <p className="font-bold text-slate-900 uppercase tracking-wider">Customer Master Record</p>
                    <p className="font-mono">Account Ref: <strong className="text-blue-900">{selectedCustomer.code}</strong></p>
                    <p className="font-mono text-[9px] text-slate-400">Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>
              </div>

              {/* 2. Customer Profile Overview Banner */}
              <div className="border border-slate-300 rounded-lg p-3.5 bg-slate-50/40 flex items-start justify-between gap-5 print-avoid-break">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-black text-slate-900 tracking-tight">{selectedCustomer.name}</h2>
                    <span className="font-mono font-bold text-xs text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                      {selectedCustomer.code}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                      selectedCustomer.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300'
                    }`}>
                      {selectedCustomer.status}
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                      {selectedCustomer.customerType}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                    <p><span className="text-slate-500 font-semibold inline-block w-28">Primary Contact:</span> <strong className="text-slate-900">{selectedCustomer.contactPersonName || selectedCustomer.name}</strong></p>
                    <p><span className="text-slate-500 font-semibold inline-block w-28">Registered Mobile:</span> <strong className="font-mono text-slate-900">+91 {selectedCustomer.mobile}</strong></p>
                    <p><span className="text-slate-500 font-semibold inline-block w-28">Email Address:</span> <span className="font-mono text-slate-800">{selectedCustomer.email}</span></p>
                    <p><span className="text-slate-500 font-semibold inline-block w-28">WhatsApp:</span> <span className="font-mono text-slate-800">{selectedCustomer.whatsappMobile ? `+91 ${selectedCustomer.whatsappMobile}` : '+91 ' + selectedCustomer.mobile}</span></p>
                    <p><span className="text-slate-500 font-semibold inline-block w-28">City / State:</span> <span className="text-slate-800">{selectedCustomer.city || 'N/A'}, {selectedCustomer.state || 'N/A'}</span></p>
                    <p><span className="text-slate-500 font-semibold inline-block w-28">PIN Code:</span> <span className="font-mono text-slate-800">{selectedCustomer.pinCode || selectedCustomer.pincode || 'N/A'}</span></p>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-center">
                  {selectedCustomer.photoUrl ? (
                    <img 
                      src={selectedCustomer.photoUrl} 
                      alt={selectedCustomer.name} 
                      className="w-20 h-24 rounded-lg object-cover border-2 border-slate-300 shadow-xs"
                    />
                  ) : (
                    <div className="w-20 h-24 rounded-lg bg-slate-200 border-2 border-slate-300 flex flex-col items-center justify-center text-slate-400 text-xs font-bold">
                      <span className="text-lg font-black text-slate-600">{selectedCustomer.name?.slice(0, 2).toUpperCase()}</span>
                      <span className="text-[9px] mt-1 text-slate-500">Client Seal</span>
                    </div>
                  )}
                  <span className="text-[8px] text-slate-400 font-mono mt-1">Authorized Profile</span>
                </div>
              </div>

              {/* 3. Four-Box Metadata Bar */}
              <div className="grid grid-cols-4 gap-3 print-avoid-break">
                <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/50">
                  <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Customer ID</span>
                  <span className="font-mono font-black text-xs text-blue-900 block mt-0.5">{selectedCustomer.code}</span>
                </div>
                <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/50">
                  <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Account Type</span>
                  <span className="font-medium text-xs text-slate-800 block mt-0.5 truncate">{selectedCustomer.customerType}</span>
                </div>
                <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/50">
                  <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Account Status</span>
                  <span className="font-bold text-xs text-emerald-700 block mt-0.5 uppercase">{selectedCustomer.status}</span>
                </div>
                <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/50">
                  <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Logged Orders</span>
                  <span className="font-bold text-xs text-slate-900 block mt-0.5">{customerOrders.length} Services</span>
                </div>
              </div>

              {/* 4. Section 1: Registered Address & Location Coordinates */}
              <div className="border border-slate-300 rounded-lg p-3.5 space-y-2 print-avoid-break">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                  1. Registered Address & Location Coordinates
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <p className="col-span-2">
                    <span className="text-slate-500 font-semibold inline-block w-28">Full Address:</span>
                    <span className="text-slate-900 font-medium">
                      {selectedCustomer.address || [selectedCustomer.addressLine1, selectedCustomer.addressLine2, selectedCustomer.locality, selectedCustomer.city, selectedCustomer.state].filter(Boolean).join(', ') || 'N/A'}
                    </span>
                  </p>
                  <p><span className="text-slate-500 font-semibold inline-block w-28">City / District:</span> <span className="text-slate-800">{selectedCustomer.city || 'N/A'}{selectedCustomer.district && selectedCustomer.district !== selectedCustomer.city ? `, ${selectedCustomer.district}` : ''}</span></p>
                  <p><span className="text-slate-500 font-semibold inline-block w-28">State & PIN:</span> <span className="text-slate-800">{selectedCustomer.state || 'N/A'} - <strong className="font-mono">{selectedCustomer.pinCode || selectedCustomer.pincode || 'N/A'}</strong></span></p>
                  <p><span className="text-slate-500 font-semibold inline-block w-28">Country:</span> <span className="text-slate-800">{selectedCustomer.country || 'India'}</span></p>
                  {selectedCustomer.landmark && (
                    <p><span className="text-slate-500 font-semibold inline-block w-28">Landmark:</span> <span className="text-slate-800">{selectedCustomer.landmark}</span></p>
                  )}
                </div>
              </div>

              {/* 5. Section 2: Statutory Tax & Business Identifiers */}
              <div className="border border-slate-300 rounded-lg p-3.5 space-y-2 print-avoid-break">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                  2. Statutory Tax & Business Identifiers
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <p>
                    <span className="text-slate-500 font-semibold inline-block w-28">GSTIN:</span> 
                    <span className="font-mono font-bold text-slate-900">{selectedCustomer.gstin || 'Not Registered / Individual'}</span>
                  </p>
                  <p>
                    <span className="text-slate-500 font-semibold inline-block w-28">PAN Number:</span> 
                    <span className="font-mono font-bold text-slate-900">{selectedCustomer.panNumber || 'Not Provided'}</span>
                  </p>
                  <p>
                    <span className="text-slate-500 font-semibold inline-block w-28">MSME / Udyam:</span> 
                    <span className="font-mono text-slate-800">{selectedCustomer.msmeLicense || 'N/A'}</span>
                  </p>
                  <p>
                    <span className="text-slate-500 font-semibold inline-block w-28">DOB / Incorp Date:</span> 
                    <span className="text-slate-800">{selectedCustomer.dobOrIncorporationDate || 'N/A'}</span>
                  </p>
                </div>
              </div>

              {/* 6. Section 3: Engagement History & Recent Services */}
              <div className="border border-slate-300 rounded-lg p-3.5 space-y-2 print-avoid-break">
                <div className="flex justify-between items-center border-b border-slate-200 pb-1">
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-900">
                    3. Engagement History & Service Portfolio ({customerOrders.length} Orders)
                  </h3>
                  <span className="text-[9px] text-slate-400 font-mono">Recent Orders Summary</span>
                </div>
                {customerOrders.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-1">
                    No active or historical service orders currently on record for this customer account.
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] text-slate-600 font-bold uppercase border-b border-slate-200">
                        <th className="py-1.5 px-2 text-left">Order ID</th>
                        <th className="py-1.5 px-2 text-left">Service Applied</th>
                        <th className="py-1.5 px-2 text-left">Date</th>
                        <th className="py-1.5 px-2 text-left">Status</th>
                        <th className="py-1.5 px-2 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customerOrders.slice(0, 5).map((order) => (
                        <tr key={order.id}>
                          <td className="py-1.5 px-2 font-mono font-bold text-blue-900">{order.id}</td>
                          <td className="py-1.5 px-2 font-medium text-slate-900">{order.serviceTitle}</td>
                          <td className="py-1.5 px-2 text-slate-600 font-mono text-[10px]">
                            {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-1.5 px-2">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              order.orderStatus === OrderStatus.COMPLETED ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-blue-800'
                            }`}>
                              {order.orderStatus}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono font-semibold text-slate-900">
                            ₹{(order.totalAmount || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* 7. Section 4: Operational Remarks & Notes (if available) */}
              {selectedCustomer.notes && (
                <div className="border border-slate-300 rounded-lg p-3.5 space-y-1 print-avoid-break">
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                    4. Operational Account Remarks
                  </h3>
                  <p className="text-xs text-slate-700 italic pt-1 leading-relaxed">
                    {selectedCustomer.notes}
                  </p>
                </div>
              )}

              {/* 8. Attestation & Signatures */}
              <div className="pt-6 grid grid-cols-2 gap-12 text-xs print-avoid-break">
                <div className="border-t border-slate-400 pt-2 text-center">
                  <p className="font-bold text-slate-800">Client / Authorized Signatory</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">Acknowledged and confirmed master record profile.</p>
                </div>
                <div className="border-t border-slate-400 pt-2 text-center">
                  <p className="font-bold text-slate-800">Desk Officer / Corporate Operations</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">For EasyDesk Solutions Private Limited • Client Relations Registry</p>
                </div>
              </div>

              {/* 9. Official Document Footer */}
              <div className="pt-4 border-t border-slate-300 text-[9px] text-slate-500 flex items-center justify-between font-mono">
                <span>EasyDesk CRM • Customer Account: {selectedCustomer.code}</span>
                <span>Official Business Record • Indian IT Act 2000 Compliant</span>
                <span>Generated: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PRINTABLE CUSTOMER SERVICE HISTORY DOSSIER MODAL          */}
      {/* ========================================================= */}
      {dossierPrintModalOpen && (dossierCustomer || historyCustomer) && (
        <div className="fixed inset-0 bg-slate-900/80 z-[70] flex items-center justify-center p-4 overflow-y-auto printable-modal-overlay">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-8 shadow-2xl border border-slate-300 space-y-6 font-sans text-slate-900 printable-modal-card">
            
            {/* Header Controls - hidden when printing */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Verified Service Dossier
                </span>
                <span className="text-xs text-slate-400 font-mono">{(dossierCustomer || historyCustomer)?.code}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrintDossier}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print Dossier
                </button>
                <button
                  type="button"
                  onClick={() => setDossierPrintModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Target Printable Dossier Area */}
            <div id={`customer-dossier-sheet-${(dossierCustomer || historyCustomer)?.id}`} className="space-y-5 text-slate-900 bg-white">

            {/* Official Header / Letterhead */}
            <div className="text-center border-b border-slate-300 pb-5 space-y-1">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">EASYDESK DIGITAL SERVICES</h1>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Client Service History & Order Audit Dossier</p>
              <p className="text-[10px] text-slate-400 font-mono">Generated on: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>

            {/* Customer Master Record Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Client Name</span>
                <p className="font-black text-slate-900 text-sm">{(dossierCustomer || historyCustomer)?.name}</p>
                <span className="text-[10px] font-mono text-blue-600 font-bold">{(dossierCustomer || historyCustomer)?.code}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Account Type</span>
                <p className="font-bold text-slate-800">{(dossierCustomer || historyCustomer)?.customerType}</p>
                <span className="text-[10px] text-slate-500 font-medium">Status: {(dossierCustomer || historyCustomer)?.status}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Contact Phone</span>
                <p className="font-bold font-mono text-slate-800">{(dossierCustomer || historyCustomer)?.mobile}</p>
                <p className="text-[10px] text-slate-500 truncate">{(dossierCustomer || historyCustomer)?.email}</p>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Location Address</span>
                <p className="font-medium text-slate-800">{(dossierCustomer || historyCustomer)?.city || 'N/A'}, {(dossierCustomer || historyCustomer)?.state || 'N/A'}</p>
                <p className="text-[10px] text-slate-500 truncate">{(dossierCustomer || historyCustomer)?.address}</p>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Tax / Reg Number</span>
                <p className="font-bold font-mono text-slate-800">{(dossierCustomer || historyCustomer)?.gstin || (dossierCustomer || historyCustomer)?.panNumber || 'Individual / Unregistered'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Pincode</span>
                <p className="font-bold font-mono text-slate-800">{(dossierCustomer || historyCustomer)?.pincode || 'N/A'}</p>
              </div>
            </div>

            {/* Financial & Operational Performance Analytics */}
            <div className="grid grid-cols-4 gap-3 text-xs border border-slate-200 rounded-xl p-3 bg-white text-center">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Services Logged</span>
                <p className="text-lg font-black text-slate-900">{customerOrders.length}</p>
              </div>
              <div>
                <span className="text-[10px] text-emerald-600 uppercase font-bold block">Completed Services</span>
                <p className="text-lg font-black text-emerald-700">
                  {customerOrders.filter(o => o.orderStatus === OrderStatus.COMPLETED).length}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-blue-600 uppercase font-bold block">Processing / Verification</span>
                <p className="text-lg font-black text-blue-700">
                  {customerOrders.filter(o => o.orderStatus === OrderStatus.PROCESSING || o.orderStatus === OrderStatus.UNDER_VERIFICATION || o.orderStatus === OrderStatus.DOCUMENTS_REQUIRED).length}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-600 uppercase font-bold block">Total Revenue Spent</span>
                <p className="text-lg font-black text-slate-900 font-mono">
                  ₹{customerOrders.filter(o => o.orderStatus !== OrderStatus.REJECTED).reduce((sum, o) => sum + (o.totalAmount || 0), 0).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Complete Chronological Service Ledger */}
            <div className="space-y-2">
              <div className="flex justify-between items-center border-b border-slate-200 pb-1">
                <h3 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                  Chronological Service Order History ({customerOrders.length} Orders)
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">Sorted by Date (Newest First)</span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase text-[9px]">
                      <th className="p-2 border-r border-slate-200">#</th>
                      <th className="p-2 border-r border-slate-200">Date</th>
                      <th className="p-2 border-r border-slate-200">Order ID</th>
                      <th className="p-2 border-r border-slate-200">Service Description</th>
                      <th className="p-2 border-r border-slate-200">Category</th>
                      <th className="p-2 border-r border-slate-200">Status</th>
                      <th className="p-2 border-r border-slate-200">Payment</th>
                      <th className="p-2 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-[11px]">
                    {customerOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-400 italic font-bold">
                          No service history orders recorded for this customer.
                        </td>
                      </tr>
                    ) : (
                      customerOrders.map((o, idx) => (
                        <tr key={o.id} className="hover:bg-slate-50">
                          <td className="p-2 text-slate-400 font-mono border-r border-slate-100">{idx + 1}</td>
                          <td className="p-2 font-mono whitespace-nowrap border-r border-slate-100">{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                          <td className="p-2 font-mono font-bold text-blue-700 border-r border-slate-100">{o.id}</td>
                          <td className="p-2 font-bold text-slate-900 border-r border-slate-100">{o.serviceTitle}</td>
                          <td className="p-2 text-slate-600 border-r border-slate-100">{o.category || 'General'}</td>
                          <td className="p-2 border-r border-slate-100">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              o.orderStatus === OrderStatus.COMPLETED ? 'bg-emerald-50 text-emerald-800' :
                              o.orderStatus === OrderStatus.PROCESSING ? 'bg-blue-50 text-blue-800' :
                              o.orderStatus === OrderStatus.REJECTED ? 'bg-red-50 text-red-800' :
                              'bg-amber-50 text-amber-800'
                            }`}>
                              {o.orderStatus}
                            </span>
                          </td>
                          <td className="p-2 text-slate-700 border-r border-slate-100">{o.paymentStatus || 'Pending'}</td>
                          <td className="p-2 text-right font-mono font-bold">₹{(o.totalAmount || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {customerOrders.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-xs text-slate-900">
                        <td colSpan={7} className="p-2.5 text-right uppercase tracking-wider text-[10px]">
                          Total Ledger Value (Excl. Rejected):
                        </td>
                        <td className="p-2.5 text-right font-mono text-sm font-black text-blue-900">
                          ₹{customerOrders.filter(o => o.orderStatus !== OrderStatus.REJECTED).reduce((sum, o) => sum + (o.totalAmount || 0), 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Remarks / Internal Notes */}
            {(dossierCustomer || historyCustomer)?.notes && (
              <div className="space-y-1 text-xs">
                <span className="font-bold text-slate-700 uppercase text-[10px] block">Internal Account Remarks</span>
                <p className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 italic">
                  {(dossierCustomer || historyCustomer)?.notes}
                </p>
              </div>
            )}

            {/* Official Sign-off Footer */}
            <div className="pt-6 border-t border-slate-300 grid grid-cols-2 gap-6 text-xs text-slate-500 print-avoid-break">
              <div>
                <p className="font-bold text-slate-800">EasyDesk Client Operations</p>
                <p className="text-[10px] mt-0.5">This official transcript summarizes all recorded services and transaction logs.</p>
              </div>
              <div className="text-right space-y-6">
                <div className="border-b border-slate-400 w-48 ml-auto"></div>
                <p className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">Authorized Administrative Seal</p>
              </div>
            </div>

            </div>

          </div>
        </div>
      )}

      {/* CUSTOM NON-BLOCKING CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-full shrink-0 ${
                confirmModal.confirmStyle === 'danger' ? 'bg-red-100 text-red-600' :
                confirmModal.confirmStyle === 'warning' ? 'bg-amber-100 text-amber-600' :
                'bg-blue-100 text-blue-600'
              }`}>
                {confirmModal.confirmStyle === 'danger' ? <Trash2 className="w-6 h-6" /> :
                 confirmModal.confirmStyle === 'warning' ? <UserX className="w-6 h-6" /> :
                 <AlertCircle className="w-6 h-6" />}
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">{confirmModal.title}</h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmModal.onConfirm()}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-xs transition cursor-pointer ${
                  confirmModal.confirmStyle === 'danger' ? 'bg-red-600 hover:bg-red-700' :
                  confirmModal.confirmStyle === 'warning' ? 'bg-amber-600 hover:bg-amber-700' :
                  'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
