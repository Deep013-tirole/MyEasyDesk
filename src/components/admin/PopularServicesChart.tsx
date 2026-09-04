import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  Award, 
  IndianRupee, 
  Layers, 
  BarChart3, 
  PieChart as PieIcon, 
  Flame, 
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { Order, Service } from '../../types.js';

interface PopularServicesChartProps {
  orders: Order[];
  services: Service[];
}

// Color palette for services visual representation
const SERVICE_COLORS = [
  '#2563eb', // Royal Blue
  '#0891b2', // Cyan
  '#7c3aed', // Purple
  '#059669', // Emerald
  '#d97706', // Amber
  '#e11d48', // Rose
  '#4f46e5', // Indigo
  '#0284c7'  // Sky
];

export default function PopularServicesChart({ orders, services }: PopularServicesChartProps) {
  const [chartView, setChartView] = useState<'ranking' | 'distribution' | 'timeline'>('ranking');
  const [metricType, setMetricType] = useState<'volume' | 'revenue'>('volume');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Generate aggregate demand data strictly from actual orders
  const { topServicesDemand, totalDemandOrders, totalDemandRevenue, categoryBreakdown, timelineData } = useMemo(() => {
    // Group orders by serviceId
    const serviceOrderMap: Record<string, { count: number; revenue: number; serviceTitle: string; categoryId?: string }> = {};
    const categoryMap: Record<string, number> = {};
    const dateServiceMap: Record<string, Record<string, number>> = {};

    let totalOrders = 0;
    let totalRev = 0;

    orders.forEach(ord => {
      totalOrders++;
      const val = typeof ord.totalAmount === 'number' ? ord.totalAmount : (parseFloat(ord.totalAmount as any) || 0);
      totalRev += val;

      const sId = ord.serviceId || 'unknown';
      const sTitle = ord.serviceTitle || sId;
      const matchedService = services.find(s => s.id === sId);
      const catId = matchedService?.categoryId || ord.category || 'other';

      if (!serviceOrderMap[sId]) {
        serviceOrderMap[sId] = {
          count: 0,
          revenue: 0,
          serviceTitle: sTitle,
          categoryId: catId
        };
      }
      serviceOrderMap[sId].count += 1;
      serviceOrderMap[sId].revenue += val;

      categoryMap[catId] = (categoryMap[catId] || 0) + 1;

      // Group for timeline
      const d = new Date(ord.createdAt || Date.now());
      const dateKey = isNaN(d.getTime()) ? 'Recent' : d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      if (!dateServiceMap[dateKey]) dateServiceMap[dateKey] = {};
      const shortKey = sTitle.length > 18 ? sTitle.substring(0, 16) + '...' : sTitle;
      dateServiceMap[dateKey][shortKey] = (dateServiceMap[dateKey][shortKey] || 0) + 1;
    });

    // Build top services list
    const serviceDemandList = Object.keys(serviceOrderMap).map((sId, idx) => {
      const item = serviceOrderMap[sId];
      const matchedService = services.find(s => s.id === sId);
      const share = totalOrders > 0 ? Math.round((item.count / totalOrders) * 100) : 0;
      return {
        id: sId,
        title: item.serviceTitle,
        shortTitle: item.serviceTitle.length > 20 ? item.serviceTitle.substring(0, 18) + '...' : item.serviceTitle,
        categoryId: item.categoryId || 'General',
        govFees: matchedService?.govFees || 0,
        serviceCharge: matchedService?.serviceCharge || 0,
        totalOrders: item.count,
        totalRevenue: item.revenue,
        share,
        color: SERVICE_COLORS[idx % SERVICE_COLORS.length]
      };
    }).sort((a, b) => b.totalOrders - a.totalOrders);

    // Category breakdown
    const catBreakdown = Object.keys(categoryMap).map((cId, i) => ({
      name: cId === 'gov' ? 'Govt Services' : cId === 'biz' ? 'Business Services' : cId === 'edu' ? 'Education' : cId === 'pers' || cId === 'personal' ? 'Personal' : cId,
      value: categoryMap[cId],
      color: SERVICE_COLORS[i % SERVICE_COLORS.length]
    }));

    // Timeline data
    const timeline = Object.keys(dateServiceMap).map(dKey => ({
      date: dKey,
      ...dateServiceMap[dKey]
    }));

    return {
      topServicesDemand: serviceDemandList,
      totalDemandOrders: totalOrders,
      totalDemandRevenue: totalRev,
      categoryBreakdown: catBreakdown,
      timelineData: timeline
    };
  }, [orders, services]);

  const topService = topServicesDemand[0] || null;

  // Custom tooltip for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs font-sans space-y-1.5 min-w-40">
          <p className="font-bold border-b border-slate-700 pb-1 text-slate-300 flex items-center justify-between gap-2">
            <span>{label || payload[0]?.name}</span>
            <span className="text-[10px] text-blue-400 font-mono">Service Analytics</span>
          </p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={`item-${index}`} className="flex items-center justify-between gap-3 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                  <span className="text-slate-200">{entry.name}:</span>
                </div>
                <span className="font-mono font-bold text-white">
                  {metricType === 'volume' ? `${entry.value} orders` : `₹${entry.value.toLocaleString()}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  if (orders.length === 0) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm text-center py-12 space-y-3">
        <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
        <h3 className="text-sm font-bold text-slate-700">No Service Demand Data</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          No services have received orders yet. Real demand rankings will populate as orders are submitted.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
      
      {/* Module Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-50 text-blue-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-blue-200/60">
              <Flame className="w-3 h-3 text-amber-500 fill-amber-500" /> Real Service Demand
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{topServicesDemand.length} Active Services</span>
          </div>
          <h2 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
            Service Popularity & Order Volume Rankings
          </h2>
          <p className="text-xs text-slate-500">
            Calculated strictly from citizen requests placed in the system.
          </p>
        </div>

        {/* View Switchers */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart View Toggle */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs">
            <button
              onClick={() => setChartView('ranking')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                chartView === 'ranking' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Rankings
            </button>
            <button
              onClick={() => setChartView('distribution')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                chartView === 'distribution' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" /> Demand Share
            </button>
          </div>

          {/* Metric Toggle */}
          <button
            onClick={() => setMetricType(prev => prev === 'volume' ? 'revenue' : 'volume')}
            className="border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 transition flex items-center gap-1.5"
            title="Toggle between Order Volume and Revenue"
          >
            {metricType === 'volume' ? (
              <>
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>By Orders</span>
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

      {/* Demand Key Insight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Most Demanded Service */}
        <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/40 border border-blue-100 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">#1 Top Requested Service</span>
            <Award className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-sm font-bold text-slate-900 mt-1 truncate" title={topService?.title}>
            {topService?.title || 'None'}
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-blue-800">{topService?.totalOrders || 0} orders</span>
            <span className="text-xs font-bold text-blue-600 font-mono">
              {topService?.share || 0}% of all orders
            </span>
          </div>
        </div>

        {/* Total Service Orders */}
        <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/40 border border-emerald-100 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Total Services With Orders</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-slate-900 mt-1">
            {topServicesDemand.length} <span className="text-xs font-semibold text-slate-500">Active Services</span>
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
            <span>Total Orders:</span>
            <span className="font-mono font-bold text-slate-900">{totalDemandOrders}</span>
          </div>
        </div>

        {/* Revenue Contribution */}
        <div className="bg-gradient-to-br from-amber-50/70 to-orange-50/40 border border-amber-100 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Total Service Order Value</span>
            <IndianRupee className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl font-black text-slate-900 mt-1">
            ₹{totalDemandRevenue.toLocaleString()}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
            <span>Avg / Order:</span>
            <span className="font-mono font-bold text-slate-900">
              ₹{totalDemandOrders > 0 ? Math.round(totalDemandRevenue / totalDemandOrders) : 0}
            </span>
          </div>
        </div>
      </div>

      {/* Main Recharts Graphic Rendering Area */}
      <div className="bg-slate-50/50 border border-slate-200/60 rounded-2xl p-5">
        
        {/* CHART VIEW 1: HORIZONTAL RANKING BAR CHART */}
        {chartView === 'ranking' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Popular Services Volume & Value Ranking</h3>
                <p className="text-[11px] text-slate-500">Sorted strictly by real customer request count</p>
              </div>
            </div>

            <div className="space-y-3">
              {topServicesDemand.map((srv, index) => {
                const maxVol = topServicesDemand[0]?.totalOrders || 1;
                const fillPercent = Math.round((srv.totalOrders / maxVol) * 100);

                return (
                  <div key={srv.id} className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] flex items-center justify-center font-mono">
                          #{index + 1}
                        </span>
                        <span className="text-slate-900">{srv.title}</span>
                      </div>
                      <div className="flex items-center gap-4 text-[11px]">
                        <span className="text-blue-700 font-mono font-bold">{srv.totalOrders} {srv.totalOrders === 1 ? 'order' : 'orders'} ({srv.share}%)</span>
                        <span className="text-emerald-700 font-bold">₹{srv.totalRevenue.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Progress Bar Visual */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex items-center">
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ width: `${fillPercent}%`, backgroundColor: srv.color }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CHART VIEW 2: PIE / DONUT CHART FOR DEMAND DISTRIBUTION */}
        {chartView === 'distribution' && (
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">Service Demand Share</h3>
              <p className="text-[11px] text-slate-500 mb-4">
                Share of citizen applications across services in the database.
              </p>
              
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topServicesDemand}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey={metricType === 'volume' ? 'totalOrders' : 'totalRevenue'}
                      nameKey="shortTitle"
                    >
                      {topServicesDemand.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Custom Legend & Share Breakdown */}
            <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200/80">
              <h4 className="text-xs font-bold text-slate-900 border-b pb-2 flex items-center justify-between">
                <span>Services Demand Share</span>
                <span className="text-[10px] text-slate-400">Total: {totalDemandOrders} Orders</span>
              </h4>
              
              <div className="space-y-2 max-h-56 overflow-y-auto text-xs">
                {topServicesDemand.map((srv) => (
                  <div key={srv.id} className="flex items-center justify-between gap-3 p-1.5 rounded-lg hover:bg-slate-50 transition">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 rounded-md shrink-0" style={{ backgroundColor: srv.color }} />
                      <span className="font-semibold text-slate-700 truncate" title={srv.title}>{srv.title}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 font-mono">
                      <span className="text-slate-500">
                        {metricType === 'volume' ? `${srv.totalOrders} ord` : `₹${srv.totalRevenue}`}
                      </span>
                      <span className="font-bold text-slate-900 w-10 text-right">{srv.share}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Detailed Services Demand Breakdown Table */}
      <div className="border border-slate-200/80 rounded-xl overflow-hidden">
        <div className="bg-slate-50 p-3.5 border-b border-slate-200/80 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" /> Audited Services Order Breakdown
          </h3>
          <span className="text-[10px] text-slate-500">Direct from Cloudflare D1</span>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="p-3">Rank & Service Title</th>
                <th className="p-3 text-center">Orders Count</th>
                <th className="p-3 text-center">Share of Total</th>
                <th className="p-3 text-right">Accumulated Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-medium">
              {topServicesDemand.map((srv, idx) => (
                <tr key={srv.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-3 flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: srv.color }} />
                    <div>
                      <p className="font-bold text-slate-900">{srv.title}</p>
                      <span className="text-[9px] text-slate-400 uppercase font-mono">ID: {srv.id}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center font-bold text-blue-700 font-mono">
                    {srv.totalOrders}
                  </td>
                  <td className="p-3 text-center font-bold text-slate-800 font-mono">
                    {srv.share}%
                  </td>
                  <td className="p-3 text-right font-bold text-emerald-700 font-mono">
                    ₹{srv.totalRevenue.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
