import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  AreaChart, 
  Area 
} from 'recharts';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  PieChart as PieIcon, 
  BarChart3, 
  Activity, 
  Layers, 
  FileText, 
  IndianRupee,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { Order, OrderStatus } from '../../types.js';

interface OrderStatusChartProps {
  orders: Order[];
}

// Color Palette for Order Statuses
const STATUS_COLORS = {
  Pending: '#f59e0b',        // Amber
  InProgress: '#3b82f6',     // Royal Blue
  Completed: '#10b981',      // Emerald Green
  Rejected: '#ef4444',       // Rose Red
  DocumentsRequired: '#8b5cf6', // Violet
  UnderVerification: '#06b6d4', // Cyan
  Processing: '#2563eb'        // Blue
};

export default function OrderStatusChart({ orders }: OrderStatusChartProps) {
  const [activeView, setActiveView] = useState<'donut' | 'bar' | 'trend'>('donut');
  const [metricFilter, setMetricFilter] = useState<'count' | 'value'>('count');

  // Compute status metrics strictly from real orders array (no fake fallback numbers)
  const { 
    statusData, 
    inProgressSubData, 
    monthlyTrend, 
    totalOrdersCount, 
    totalRevenueValue,
    countsByGroup
  } = useMemo(() => {
    let pendingCount = 0;
    let pendingValue = 0;

    let inProgressCount = 0;
    let inProgressValue = 0;

    let completedCount = 0;
    let completedValue = 0;

    let rejectedCount = 0;
    let rejectedValue = 0;

    // Sub-counts for In Progress
    let docsReqCount = 0;
    let verifCount = 0;
    let procCount = 0;

    const realMonthlyStats: Record<string, { pending: number; inProgress: number; completed: number; rejected: number; total: number; revenue: number }> = {};

    orders.forEach(ord => {
      const val = typeof ord.totalAmount === 'number' ? ord.totalAmount : (parseFloat(ord.totalAmount as any) || 0);
      const st = (ord.orderStatus || '').toLowerCase();
      const date = new Date(ord.createdAt || Date.now());
      const mLabel = isNaN(date.getTime()) 
        ? 'Current' 
        : date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

      if (!realMonthlyStats[mLabel]) {
        realMonthlyStats[mLabel] = { pending: 0, inProgress: 0, completed: 0, rejected: 0, total: 0, revenue: 0 };
      }

      realMonthlyStats[mLabel].total++;
      realMonthlyStats[mLabel].revenue += val;

      if (st === 'completed') {
        completedCount++;
        completedValue += val;
        realMonthlyStats[mLabel].completed++;
      } else if (st === 'rejected' || st === 'cancelled') {
        rejectedCount++;
        rejectedValue += val;
        realMonthlyStats[mLabel].rejected++;
      } else if (st.includes('process') || st.includes('progress') || st.includes('verification') || st.includes('document')) {
        inProgressCount++;
        inProgressValue += val;
        realMonthlyStats[mLabel].inProgress++;

        if (st.includes('document')) docsReqCount++;
        else if (st.includes('verification')) verifCount++;
        else procCount++;
      } else {
        // Pending, Pending Verification, etc.
        pendingCount++;
        pendingValue += val;
        realMonthlyStats[mLabel].pending++;
      }
    });

    const totalCount = orders.length;
    const totalVal = pendingValue + inProgressValue + completedValue + rejectedValue;

    // Main 4-group status dataset strictly derived from actual counts
    const mainStatusData = [
      {
        name: 'Completed',
        count: completedCount,
        value: completedValue,
        percentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
        color: STATUS_COLORS.Completed,
        description: 'Service fulfilled and final certificate issued'
      },
      {
        name: 'In Progress',
        count: inProgressCount,
        value: inProgressValue,
        percentage: totalCount > 0 ? Math.round((inProgressCount / totalCount) * 100) : 0,
        color: STATUS_COLORS.InProgress,
        description: 'Actively processing, verification, or document collection'
      },
      {
        name: 'Pending',
        count: pendingCount,
        value: pendingValue,
        percentage: totalCount > 0 ? Math.round((pendingCount / totalCount) * 100) : 0,
        color: STATUS_COLORS.Pending,
        description: 'Awaiting initial staff assignment & review'
      },
      {
        name: 'Rejected',
        count: rejectedCount,
        value: rejectedValue,
        percentage: totalCount > 0 ? Math.round((rejectedCount / totalCount) * 100) : 0,
        color: STATUS_COLORS.Rejected,
        description: 'Application rejected due to invalid credentials'
      }
    ];

    // Filter only statuses that have at least 1 count for the donut chart to keep it clean, unless all 0
    const donutData = mainStatusData.filter(d => d.count > 0);

    // In Progress Sub-breakdown strictly from real counts
    const subBreakdown = [
      { name: 'Documents Required', count: docsReqCount, color: STATUS_COLORS.DocumentsRequired },
      { name: 'Under Verification', count: verifCount, color: STATUS_COLORS.UnderVerification },
      { name: 'Processing in Queue', count: procCount, color: STATUS_COLORS.Processing }
    ];

    // Monthly Trend Data strictly from real order dates
    const trendData = Object.keys(realMonthlyStats).map(m => {
      const stats = realMonthlyStats[m];
      return {
        month: m,
        Pending: stats.pending,
        'In Progress': stats.inProgress,
        Completed: stats.completed,
        Rejected: stats.rejected,
        Total: stats.total,
        Revenue: stats.revenue
      };
    });

    return {
      statusData: mainStatusData,
      donutStatusData: donutData.length > 0 ? donutData : mainStatusData,
      inProgressSubData: subBreakdown,
      monthlyTrend: trendData,
      totalOrdersCount: totalCount,
      totalRevenueValue: totalVal,
      countsByGroup: {
        pending: pendingCount,
        inProgress: inProgressCount,
        completed: completedCount,
        rejected: rejectedCount
      }
    };
  }, [orders]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs font-sans space-y-1.5 min-w-44">
          <p className="font-bold border-b border-slate-700 pb-1 text-slate-300 flex items-center justify-between">
            <span>{label || payload[0]?.name}</span>
            <span className="text-[10px] text-blue-400 font-mono">D1 Database</span>
          </p>
          {payload.map((entry: any, index: number) => {
            const val = entry.value;
            const isValMetric = metricFilter === 'value';
            return (
              <div key={`item-${index}`} className="flex items-center justify-between gap-4 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                  <span className="text-slate-200">{entry.name}:</span>
                </div>
                <span className="font-mono font-bold text-white">
                  {isValMetric ? `₹${val.toLocaleString()}` : `${val} orders`}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  if (orders.length === 0) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm text-center py-12 space-y-3">
        <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
        <h3 className="text-sm font-bold text-slate-700">No Orders in Database</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          No citizen application orders have been recorded in Cloudflare D1 yet. New orders will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
      
      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-indigo-200/60">
              <Activity className="w-3 h-3 text-indigo-600" /> Real-Time Database Metrics
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Source: Cloudflare D1 ({totalOrdersCount} Records)</span>
          </div>
          <h2 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
            Order Status Breakdown & Lifecycle Distribution
          </h2>
          <p className="text-xs text-slate-500">
            Calculated strictly from the {totalOrdersCount} persisted orders in the database.
          </p>
        </div>

        {/* View Switchers */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs">
            <button
              onClick={() => setActiveView('donut')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                activeView === 'donut' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" /> Share
            </button>
            <button
              onClick={() => setActiveView('bar')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                activeView === 'bar' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Comparison
            </button>
            <button
              onClick={() => setActiveView('trend')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                activeView === 'trend' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" /> Timeline
            </button>
          </div>

          <button
            onClick={() => setMetricFilter(prev => prev === 'count' ? 'value' : 'count')}
            className="border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 transition flex items-center gap-1.5"
            title="Toggle between Order Count and Total Value"
          >
            {metricFilter === 'count' ? (
              <>
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>By Volume</span>
              </>
            ) : (
              <>
                <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                <span>By Value (₹)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Completed Orders Card */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Completed
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
              {totalOrdersCount > 0 ? Math.round((countsByGroup.completed / totalOrdersCount) * 100) : 0}%
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-950 mt-2">
            {countsByGroup.completed} <span className="text-xs font-semibold text-emerald-700">Orders</span>
          </p>
          <p className="text-[11px] text-emerald-700/80 mt-1">
            Fulfilled and finalized
          </p>
        </div>

        {/* In Progress Orders Card */}
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-blue-600" /> In Progress
            </span>
            <span className="text-[10px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded-full font-bold">
              {totalOrdersCount > 0 ? Math.round((countsByGroup.inProgress / totalOrdersCount) * 100) : 0}%
            </span>
          </div>
          <p className="text-2xl font-black text-blue-950 mt-2">
            {countsByGroup.inProgress} <span className="text-xs font-semibold text-blue-700">Orders</span>
          </p>
          <p className="text-[11px] text-blue-700/80 mt-1">
            Active processing queue
          </p>
        </div>

        {/* Pending Orders Card */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Review
            </span>
            <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold">
              {totalOrdersCount > 0 ? Math.round((countsByGroup.pending / totalOrdersCount) * 100) : 0}%
            </span>
          </div>
          <p className="text-2xl font-black text-amber-950 mt-2">
            {countsByGroup.pending} <span className="text-xs font-semibold text-amber-700">Orders</span>
          </p>
          <p className="text-[11px] text-amber-700/80 mt-1">
            Awaiting verification
          </p>
        </div>

        {/* Total Database Orders */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-500" /> Total Orders
            </span>
            <span className="text-[10px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full font-bold">
              Database Total
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {totalOrdersCount} <span className="text-xs font-semibold text-slate-500">Orders</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Total value: <span className="font-bold text-slate-800">₹{totalRevenueValue.toLocaleString()}</span>
          </p>
        </div>
      </div>

      {/* Main Recharts Render Box */}
      <div className="bg-slate-50/50 border border-slate-200/60 rounded-2xl p-5">

        {/* VIEW 1: DONUT / PIE CHART */}
        {activeView === 'donut' && (
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div>
              <div className="mb-2">
                <h3 className="text-sm font-bold text-slate-800">Order Status Distribution</h3>
                <p className="text-[11px] text-slate-500">
                  Actual breakdown across Completed ({countsByGroup.completed}), In Progress ({countsByGroup.inProgress}), and Pending ({countsByGroup.pending}) applications.
                </p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData.filter(d => (metricFilter === 'count' ? d.count > 0 : d.value > 0))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey={metricFilter === 'count' ? 'count' : 'value'}
                      nameKey="name"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Custom Legend & Real Breakdown Details */}
            <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
              <h4 className="text-xs font-bold text-slate-900 border-b pb-2 flex items-center justify-between">
                <span>Verified Status Breakdown</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {metricFilter === 'count' ? `${totalOrdersCount} Total Orders` : `₹${totalRevenueValue.toLocaleString()}`}
                </span>
              </h4>

              <div className="space-y-2.5 text-xs">
                {statusData.map((item) => (
                  <div key={item.name} className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex flex-col gap-1">
                    <div className="flex items-center justify-between font-bold">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-900">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-700">
                          {metricFilter === 'count' ? `${item.count} orders` : `₹${item.value.toLocaleString()}`}
                        </span>
                        <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-800 font-bold">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 pl-5">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: BAR CHART COMPARISON */}
        {activeView === 'bar' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Order Volume & Status Comparison</h3>
                <p className="text-[11px] text-slate-500">
                  {metricFilter === 'count' ? 'Actual order count per status stage' : 'Financial value per status stage (₹)'}
                </p>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey={metricFilter === 'count' ? 'count' : 'value'} 
                    radius={[6, 6, 0, 0]}
                    maxBarSize={55}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* VIEW 3: TIMELINE PROGRESSION */}
        {activeView === 'trend' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Order Timeline Progression</h3>
                <p className="text-[11px] text-slate-500">
                  Aggregated from actual timestamps of orders in the database.
                </p>
              </div>
            </div>

            {monthlyTrend.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={STATUS_COLORS.Completed} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={STATUS_COLORS.Completed} stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="gradInProgress" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={STATUS_COLORS.InProgress} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={STATUS_COLORS.InProgress} stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="Completed" stroke={STATUS_COLORS.Completed} fillOpacity={1} fill="url(#gradCompleted)" stackId="1" />
                    <Area type="monotone" dataKey="In Progress" stroke={STATUS_COLORS.InProgress} fillOpacity={1} fill="url(#gradInProgress)" stackId="1" />
                    <Area type="monotone" dataKey="Pending" stroke={STATUS_COLORS.Pending} fillOpacity={1} fill={STATUS_COLORS.Pending} stackId="1" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-10 text-xs text-slate-400">
                No timeline records available yet.
              </div>
            )}
          </div>
        )}

      </div>

      {/* Sub-status breakdown panel for In Progress state */}
      {countsByGroup.inProgress > 0 && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              <span>"In Progress" Active Stage Breakdown</span>
            </h4>
            <span className="text-[10px] text-slate-500 font-mono">
              {countsByGroup.inProgress} Total Active Orders
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {inProgressSubData.map((sub) => (
              <div key={sub.name} className="bg-white p-3 rounded-lg border border-slate-200/70 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                  <div>
                    <p className="text-xs font-bold text-slate-800">{sub.name}</p>
                    <span className="text-[10px] text-slate-400">Queue Stage</span>
                  </div>
                </div>
                <span className="text-sm font-black font-mono text-slate-900">{sub.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
