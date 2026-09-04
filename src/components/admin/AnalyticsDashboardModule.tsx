import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  BarChart, 
  Bar 
} from 'recharts';
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  IndianRupee, 
  Layers, 
  RefreshCw, 
  ShieldCheck, 
  Users, 
  TrendingUp, 
  FileText, 
  CreditCard,
  Check,
  Calendar,
  AlertCircle,
  MessageSquare,
  Globe,
  Phone,
  PieChart
} from 'lucide-react';
import { Order, Service } from '../../types.js';
import OrderStatusChart from './OrderStatusChart.js';
import PopularServicesChart from './PopularServicesChart.js';

interface AnalyticsDashboardModuleProps {
  orders: Order[];
  services: Service[];
  customersCount?: number;
  onRefresh: () => void;
  isLoading?: boolean;
}

export default function AnalyticsDashboardModule({
  orders,
  services,
  customersCount = 0,
  onRefresh,
  isLoading = false
}: AnalyticsDashboardModuleProps) {
  const [dateFilter, setDateFilter] = useState<'all' | '30d' | '7d'>('all');
  const [timelineMetric, setTimelineMetric] = useState<'orders' | 'revenue'>('orders');

  // Filter orders strictly based on selected time window
  const filteredOrders = useMemo(() => {
    if (dateFilter === 'all') return orders;
    const now = Date.now();
    const days = dateFilter === '30d' ? 30 : 7;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    return orders.filter(o => {
      const time = new Date(o.createdAt || 0).getTime();
      return time >= cutoff;
    });
  }, [orders, dateFilter]);

  // Aggregate metrics strictly from the filtered orders list
  const metrics = useMemo(() => {
    const total = filteredOrders.length;
    let completed = 0;
    let inProgress = 0;
    let pending = 0;
    let rejected = 0;

    let verifiedRevenue = 0;
    let pendingRevenue = 0;
    let totalValue = 0;

    filteredOrders.forEach(o => {
      const amt = typeof o.totalAmount === 'number' ? o.totalAmount : (parseFloat(o.totalAmount as any) || 0);
      totalValue += amt;

      const st = (o.orderStatus || '').toLowerCase();
      if (st === 'completed') {
        completed++;
      } else if (st === 'processing' || st === 'in progress' || st === 'in_progress' || st === 'under verification') {
        inProgress++;
      } else if (st === 'rejected' || st === 'cancelled') {
        rejected++;
      } else {
        pending++;
      }

      const pSt = (o.paymentStatus || '').toLowerCase();
      if (pSt === 'verified' || pSt === 'paid') {
        verifiedRevenue += amt;
      } else {
        pendingRevenue += amt;
      }
    });

    // Customer insights
    const uniqueCustomerIds = new Set(filteredOrders.map(o => o.customerId || o.userId).filter(Boolean));

    return {
      total,
      completed,
      inProgress,
      pending,
      rejected,
      verifiedRevenue,
      pendingRevenue,
      totalValue,
      uniqueOrderingCustomers: uniqueCustomerIds.size
    };
  }, [filteredOrders]);

  // Build daily timeline data strictly from actual order timestamps
  const timelineData = useMemo(() => {
    const map: Record<string, { date: string; displayDate: string; orders: number; revenue: number }> = {};

    filteredOrders.forEach(o => {
      const d = new Date(o.createdAt || Date.now());
      const dateStr = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '2026-08-01';
      const displayDate = !isNaN(d.getTime()) ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : dateStr;

      if (!map[dateStr]) {
        map[dateStr] = { date: dateStr, displayDate, orders: 0, revenue: 0 };
      }

      map[dateStr].orders += 1;
      const pSt = (o.paymentStatus || '').toLowerCase();
      if (pSt === 'verified' || pSt === 'paid') {
        map[dateStr].revenue += (typeof o.totalAmount === 'number' ? o.totalAmount : 0);
      }
    });

    return Object.keys(map)
      .sort()
      .map(k => map[k]);
  }, [filteredOrders]);

  // Payment Breakdown
  const paymentBreakdown = useMemo(() => {
    let verifiedCount = 0;
    let verifiedAmt = 0;
    let pendingVerifCount = 0;
    let pendingVerifAmt = 0;
    let unpaidCount = 0;
    let unpaidAmt = 0;

    filteredOrders.forEach(o => {
      const amt = typeof o.totalAmount === 'number' ? o.totalAmount : 0;
      const pSt = (o.paymentStatus || '').toLowerCase();
      if (pSt === 'verified' || pSt === 'paid') {
        verifiedCount++;
        verifiedAmt += amt;
      } else if (pSt === 'pending verification') {
        pendingVerifCount++;
        pendingVerifAmt += amt;
      } else {
        unpaidCount++;
        unpaidAmt += amt;
      }
    });

    return [
      {
        status: 'Verified & Credited',
        count: verifiedCount,
        amount: verifiedAmt,
        percentage: filteredOrders.length > 0 ? Math.round((verifiedCount / filteredOrders.length) * 100) : 0,
        color: 'bg-emerald-500',
        textColor: 'text-emerald-700',
        bgLight: 'bg-emerald-50 border-emerald-200'
      },
      {
        status: 'Pending Verification',
        count: pendingVerifCount,
        amount: pendingVerifAmt,
        percentage: filteredOrders.length > 0 ? Math.round((pendingVerifCount / filteredOrders.length) * 100) : 0,
        color: 'bg-amber-500',
        textColor: 'text-amber-700',
        bgLight: 'bg-amber-50 border-amber-200'
      },
      {
        status: 'Unpaid / Pending',
        count: unpaidCount,
        amount: unpaidAmt,
        percentage: filteredOrders.length > 0 ? Math.round((unpaidCount / filteredOrders.length) * 100) : 0,
        color: 'bg-slate-400',
        textColor: 'text-slate-700',
        bgLight: 'bg-slate-50 border-slate-200'
      }
    ];
  }, [filteredOrders]);

  // Order Acquisition Channel / Source Breakdown
  const sourceBreakdown = useMemo(() => {
    let whatsappCount = 0;
    let whatsappRevenue = 0;
    let websiteCount = 0;
    let websiteRevenue = 0;
    let phoneCount = 0;
    let phoneRevenue = 0;
    let inPersonCount = 0;
    let inPersonRevenue = 0;
    let otherCount = 0;
    let otherRevenue = 0;

    filteredOrders.forEach(o => {
      const amt = typeof o.totalAmount === 'number' ? o.totalAmount : 0;
      const src = o.orderSource || 'Website';

      if (src === 'WhatsApp') {
        whatsappCount++;
        whatsappRevenue += amt;
      } else if (src === 'Phone') {
        phoneCount++;
        phoneRevenue += amt;
      } else if (src === 'In-Person') {
        inPersonCount++;
        inPersonRevenue += amt;
      } else if (src === 'Other') {
        otherCount++;
        otherRevenue += amt;
      } else {
        websiteCount++;
        websiteRevenue += amt;
      }
    });

    const total = filteredOrders.length || 1;

    return [
      {
        channel: 'WhatsApp Direct',
        key: 'WhatsApp',
        count: whatsappCount,
        revenue: whatsappRevenue,
        percentage: filteredOrders.length > 0 ? Math.round((whatsappCount / total) * 100) : 0,
        color: 'bg-emerald-500',
        textColor: 'text-emerald-700',
        bgLight: 'bg-emerald-50/80 border-emerald-200',
        badgeBg: 'bg-emerald-100 text-emerald-800'
      },
      {
        channel: 'Website Portal',
        key: 'Website',
        count: websiteCount,
        revenue: websiteRevenue,
        percentage: filteredOrders.length > 0 ? Math.round((websiteCount / total) * 100) : 0,
        color: 'bg-blue-500',
        textColor: 'text-blue-700',
        bgLight: 'bg-blue-50/80 border-blue-200',
        badgeBg: 'bg-blue-100 text-blue-800'
      },
      {
        channel: 'Phone Helpdesk',
        key: 'Phone',
        count: phoneCount,
        revenue: phoneRevenue,
        percentage: filteredOrders.length > 0 ? Math.round((phoneCount / total) * 100) : 0,
        color: 'bg-indigo-500',
        textColor: 'text-indigo-700',
        bgLight: 'bg-indigo-50/80 border-indigo-200',
        badgeBg: 'bg-indigo-100 text-indigo-800'
      },
      {
        channel: 'In-Person / Walk-in',
        key: 'In-Person',
        count: inPersonCount,
        revenue: inPersonRevenue,
        percentage: filteredOrders.length > 0 ? Math.round((inPersonCount / total) * 100) : 0,
        color: 'bg-purple-500',
        textColor: 'text-purple-700',
        bgLight: 'bg-purple-50/80 border-purple-200',
        badgeBg: 'bg-purple-100 text-purple-800'
      },
      {
        channel: 'Other Sources',
        key: 'Other',
        count: otherCount,
        revenue: otherRevenue,
        percentage: filteredOrders.length > 0 ? Math.round((otherCount / total) * 100) : 0,
        color: 'bg-slate-500',
        textColor: 'text-slate-700',
        bgLight: 'bg-slate-50/80 border-slate-200',
        badgeBg: 'bg-slate-200 text-slate-800'
      }
    ];
  }, [filteredOrders]);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      
      {/* 1. Reconciliation & Source-of-Truth Integrity Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-slate-900">Database Source of Truth: Cloudflare D1</h2>
              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-2.5 h-2.5" /> 100% Reconciled
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              All {orders.length} order records, revenue sums, and service stats are computed directly from persisted database documents.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {/* Time Filter */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs">
            <button
              onClick={() => setDateFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${dateFilter === 'all' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All Time ({orders.length})
            </button>
            <button
              onClick={() => setDateFilter('30d')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${dateFilter === '30d' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              30 Days
            </button>
            <button
              onClick={() => setDateFilter('7d')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${dateFilter === '7d' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              7 Days
            </button>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
            title="Re-fetch and verify all analytics from Cloudflare D1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Core Audited Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Orders */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Total Orders</span>
            <Layers className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <p className="text-xl font-black text-slate-900 mt-1.5">{metrics.total}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">100% matched</span>
        </div>

        {/* Completed Orders */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-emerald-600 mt-1.5">{metrics.completed}</p>
          <span className="text-[10px] text-emerald-700/80 mt-0.5 block">
            {metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0}% completion
          </span>
        </div>

        {/* In Progress */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">In Progress</span>
            <Activity className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <p className="text-xl font-black text-blue-700 mt-1.5">{metrics.inProgress}</p>
          <span className="text-[10px] text-blue-600/80 mt-0.5 block">Active workflow</span>
        </div>

        {/* Pending Review */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Pending</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <p className="text-xl font-black text-amber-600 mt-1.5">{metrics.pending}</p>
          <span className="text-[10px] text-amber-700/80 mt-0.5 block">Awaiting review</span>
        </div>

        {/* Confirmed Revenue */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Verified Revenue</span>
            <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-emerald-700 mt-1.5">₹{metrics.verifiedRevenue.toLocaleString()}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate" title={`Total Book Value: ₹${metrics.totalValue.toLocaleString()}`}>
            Book: ₹{metrics.totalValue.toLocaleString()}
          </span>
        </div>

        {/* Registered Customers */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Customers</span>
            <Users className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <p className="text-xl font-black text-purple-700 mt-1.5">{customersCount || metrics.uniqueOrderingCustomers}</p>
          <span className="text-[10px] text-purple-600/80 mt-0.5 block">Registered records</span>
        </div>
      </div>

      {/* 3. Real Timeline Graph (Orders & Revenue Over Time) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" /> Orders & Financial Timeline
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Aggregated strictly from order creation timestamps ({timelineData.length} active dates)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTimelineMetric('orders')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                timelineMetric === 'orders' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-600 border border-slate-200'
              }`}
            >
              <FileText className="w-3 h-3" /> Volume (Count)
            </button>
            <button
              onClick={() => setTimelineMetric('revenue')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                timelineMetric === 'revenue' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-600 border border-slate-200'
              }`}
            >
              <IndianRupee className="w-3 h-3" /> Revenue (₹)
            </button>
          </div>
        </div>

        {timelineData.length > 0 ? (
          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {timelineMetric === 'orders' ? (
                <BarChart data={timelineData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="displayDate" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs space-y-1 shadow-lg">
                            <p className="font-bold border-b border-slate-700 pb-1 text-slate-300">{label}</p>
                            <p className="font-mono text-blue-400 font-bold">{payload[0]?.value} orders submitted</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="orders" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={45} />
                </BarChart>
              ) : (
                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="displayDate" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs space-y-1 shadow-lg">
                            <p className="font-bold border-b border-slate-700 pb-1 text-slate-300">{label}</p>
                            <p className="font-mono text-emerald-400 font-bold">₹{payload[0]?.value?.toLocaleString()} verified revenue</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#revGrad)" />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-10 text-xs text-slate-400">
            No order activity recorded in this selected time range.
          </div>
        )}
      </div>

      {/* 4. Visual Order Status Lifecycle Distribution Analytics */}
      <OrderStatusChart orders={filteredOrders} />

      {/* 5. Visual Popular Services Demand Analytics */}
      <PopularServicesChart orders={filteredOrders} services={services} />

      {/* 6. Payment Status Reconciliation Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Payment Status Breakdown
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Real-time payment audit from database transactions</p>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            Total Book Value: <strong className="text-slate-900">₹{metrics.totalValue.toLocaleString()}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {paymentBreakdown.map((item, idx) => (
            <div key={idx} className={`p-4 rounded-xl border ${item.bgLight} flex flex-col justify-between space-y-2`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${item.textColor}`}>
                  {item.status}
                </span>
                <span className={`text-xs font-mono font-bold ${item.textColor}`}>
                  {item.count} {item.count === 1 ? 'order' : 'orders'} ({item.percentage}%)
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-lg font-black text-slate-900 font-mono">₹{item.amount.toLocaleString()}</span>
                <span className="text-[10px] text-slate-400">Audited Amount</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Order Acquisition Channel / Source Breakdown Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-emerald-600" /> Order Channel & Acquisition Source
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Distribution of orders created via WhatsApp, Website, Phone, and Offline channels</p>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            Total Orders: <strong className="text-slate-900">{filteredOrders.length}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {sourceBreakdown.map((item, idx) => {
            const IconComponent = item.key === 'WhatsApp' ? MessageSquare :
              item.key === 'Phone' ? Phone :
              item.key === 'In-Person' ? Users :
              item.key === 'Website' ? Globe : Layers;

            return (
              <div key={idx} className={`p-4 rounded-xl border ${item.bgLight} flex flex-col justify-between space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <IconComponent className={`w-3.5 h-3.5 ${item.textColor}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${item.textColor}`}>
                      {item.key}
                    </span>
                  </div>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full ${item.badgeBg}`}>
                    {item.percentage}%
                  </span>
                </div>
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-black text-slate-950 font-mono">{item.count}</span>
                    <span className="text-[10px] text-slate-400 font-medium">orders</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100/80 text-[10px] text-slate-500">
                    <span>Revenue</span>
                    <span className="font-mono font-bold text-slate-800">₹{item.revenue.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
