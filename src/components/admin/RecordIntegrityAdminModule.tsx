import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  CheckCircle2, 
  RefreshCw, 
  Wrench, 
  Database, 
  Search, 
  Filter, 
  FileText, 
  Users, 
  UserCheck, 
  CreditCard, 
  FolderLock, 
  ShoppingBag, 
  Check, 
  Copy, 
  ExternalLink,
  Layers,
  ArrowRight
} from 'lucide-react';
import { ValidationReport, ValidationFinding, CollectionIntegritySummary, User } from '../../types.js';
import { adminFetch } from '../../lib/apiClient.js';

interface RecordIntegrityAdminModuleProps {
  adminUser: User | null;
  onRefreshData?: () => void;
}

export default function RecordIntegrityAdminModule({ adminUser, onRefreshData }: RecordIntegrityAdminModuleProps) {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [repairing, setRepairing] = useState<boolean>(false);
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showConfirmRepair, setShowConfirmRepair] = useState<boolean>(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchIntegrityReport = async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/validation/report?engine=d1`);
      if (res.ok) {
        const data: ValidationReport = await res.json();
        setReport(data);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Failed to fetch validation report', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error scanning record relationships', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRunRepair = async () => {
    setRepairing(true);
    setShowConfirmRepair(false);
    try {
      const res = await adminFetch('/api/admin/validation/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setReport(data.afterReport || data.beforeReport);
        showToast(data.message || 'Successfully repaired orphaned and mismatched record relationships!', 'success');
        onRefreshData?.();
      } else {
        showToast(data.message || 'Repair operation encountered an error', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to execute repair operations', 'error');
    } finally {
      setRepairing(false);
    }
  };

  useEffect(() => {
    fetchIntegrityReport();
  }, []);

  const handleCopyReport = () => {
    if (!report) return;
    const summaryText = `EasyDesk Database Relationship Integrity Diagnostic Report
Timestamp: ${report.timestamp}
Scan Source: ${report.scanSource}
Overall Status: ${report.overallStatus}

Summary Stats:
- Total Employees Checked: ${report.stats.totalEmployeesChecked}
- Total Customers Checked: ${report.stats.totalCustomersChecked}
- Total Orders Checked: ${report.stats.totalOrdersChecked}
- Total KYC Records: ${report.stats.totalKYCChecked}
- Total Payroll Records: ${report.stats.totalPayrollChecked}
- Total Accounts: ${report.stats.totalAccountsChecked}
- Total Documents: ${report.stats.totalDocumentsChecked}
- Total Issues Found: ${report.stats.totalIssuesFound} (Critical: ${report.stats.criticalIssuesCount}, Warning: ${report.stats.warningIssuesCount}, Auto-Fixable: ${report.stats.autoFixableCount})

Findings List (${report.findings.length} items):
${report.findings.map(f => `[${f.severity}] [${f.collection}] [${f.issueType}] ${f.title}\n   ${f.description}\n   Fix: ${f.suggestedFix}`).join('\n\n')}
`;
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    showToast('Integrity report copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 3000);
  };

  const filteredFindings = (report?.findings || []).filter(f => {
    const matchesDomain = selectedDomain === 'ALL' || f.domain === selectedDomain;
    const matchesSeverity = selectedSeverity === 'ALL' || f.severity === selectedSeverity;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      f.title.toLowerCase().includes(q) || 
      f.description.toLowerCase().includes(q) || 
      f.recordId.toLowerCase().includes(q) || 
      (f.targetReferenceId && f.targetReferenceId.toLowerCase().includes(q)) ||
      f.collection.toLowerCase().includes(q) ||
      f.issueType.toLowerCase().includes(q);

    return matchesDomain && matchesSeverity && matchesSearch;
  });

  const getCollectionIcon = (coll: string) => {
    switch (coll) {
      case 'employees': return <Users className="w-4 h-4 text-blue-600" />;
      case 'employeeKYC': return <FolderLock className="w-4 h-4 text-purple-600" />;
      case 'employeePayroll': return <CreditCard className="w-4 h-4 text-emerald-600" />;
      case 'employeeAccounts': return <ShieldCheck className="w-4 h-4 text-cyan-600" />;
      case 'employeeDocuments': return <FileText className="w-4 h-4 text-amber-600" />;
      case 'customers': return <UserCheck className="w-4 h-4 text-indigo-600" />;
      case 'orders': return <ShoppingBag className="w-4 h-4 text-rose-600" />;
      default: return <Database className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-md animate-in fade-in duration-200 ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          notification.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {notification.type === 'error' && <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />}
            {notification.type === 'info' && <Database className="w-4 h-4 text-blue-600 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600 text-xs px-2">✕</button>
        </div>
      )}

      {/* Confirmation Modal for Auto-Repair */}
      {showConfirmRepair && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Execute Relationship Auto-Repair</h3>
                <p className="text-xs text-slate-500">Normalize keys, synchronize assignments, and relink orders</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 space-y-2">
              <p className="font-medium text-slate-700">The repair utility will automatically:</p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600">
                <li>Re-key sub-records (KYC, Payroll, Accounts) to canonical Employee IDs</li>
                <li>Synchronize order staff assignments with canonical profile codes and names</li>
                <li>Relink unlinked orders to customer records by verified email or mobile</li>
                <li>Persist clean snapshots to Cloudflare D1 database and log an audit trail</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmRepair(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRunRepair}
                disabled={repairing}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow flex items-center gap-1.5"
              >
                {repairing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Confirm & Repair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Header / Top Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Record Relationship Integrity Engine</h2>
                <p className="text-xs text-slate-500">Centralized validation scanning D1 tables across Employees, Customers, KYC, Payroll, Documents & Orders</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => fetchIntegrityReport()}
              disabled={loading || repairing}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Scanning...' : 'Scan D1 Database'}
            </button>

            <button
              onClick={handleCopyReport}
              disabled={!report}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Export Report'}
            </button>

            <button
              onClick={() => setShowConfirmRepair(true)}
              disabled={loading || repairing || !report || report.stats.autoFixableCount === 0}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
            >
              <Wrench className={`w-3.5 h-3.5 ${repairing ? 'animate-spin' : ''}`} />
              {repairing ? 'Repairing...' : `Auto-Repair (${report?.stats.autoFixableCount || 0})`}
            </button>
          </div>
        </div>

        {/* Global Status Banner */}
        {report && (
          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-slate-50/80 border border-slate-200/60 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Health Status</span>
              <div className="mt-1 flex items-center gap-1.5">
                {report.overallStatus === 'HEALTHY' && (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-black text-emerald-700">Healthy</span>
                  </>
                )}
                {report.overallStatus === 'WARNINGS_FOUND' && (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-black text-amber-700">Warnings</span>
                  </>
                )}
                {report.overallStatus === 'CRITICAL_ERRORS' && (
                  <>
                    <AlertOctagon className="w-4 h-4 text-rose-600" />
                    <span className="text-xs font-black text-rose-700">Critical Issues</span>
                  </>
                )}
              </div>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/60 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Issues</span>
              <p className="text-base font-black text-slate-800 mt-0.5">{report.stats.totalIssuesFound}</p>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/60 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-rose-500 block tracking-wider">Critical Orphans</span>
              <p className="text-base font-black text-rose-600 mt-0.5">{report.stats.criticalIssuesCount}</p>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/60 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-amber-500 block tracking-wider">Mismatched Keys</span>
              <p className="text-base font-black text-amber-600 mt-0.5">{report.stats.warningIssuesCount}</p>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/60 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-emerald-600 block tracking-wider">Auto-Fixable</span>
              <p className="text-base font-black text-emerald-700 mt-0.5">{report.stats.autoFixableCount}</p>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/60 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Last Verified</span>
              <p className="text-[11px] font-semibold text-slate-700 mt-1 truncate">
                {new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Collection Summaries Grid */}
      {report && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Scanned D1 Collections</h3>
            <span className="text-[11px] text-slate-400">Scan mode: {report.scanSource}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {Object.entries(report.summaryByCollection || {}).map(([key, itemVal]) => {
              const item = itemVal as CollectionIntegritySummary;
              const hasCritical = item.status === 'CRITICAL';
              const hasWarnings = item.status === 'WARNINGS';
              return (
                <div 
                  key={key}
                  className={`bg-white border rounded-xl p-4 shadow-sm transition hover:border-slate-300 ${
                    hasCritical ? 'border-rose-200 bg-rose-50/20' :
                    hasWarnings ? 'border-amber-200 bg-amber-50/20' :
                    'border-slate-200/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getCollectionIcon(key)}
                      <span className="text-xs font-bold text-slate-800">{key}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      hasCritical ? 'bg-rose-100 text-rose-700' :
                      hasWarnings ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-semibold block">Records</span>
                      <span className="text-xs font-bold text-slate-700">{item.totalRecords}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-emerald-600 uppercase font-semibold block">Healthy</span>
                      <span className="text-xs font-bold text-emerald-700">{item.healthyCount}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-rose-500 uppercase font-semibold block">Issues</span>
                      <span className="text-xs font-bold text-rose-600">{item.orphanedCount + item.mismatchedCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Findings Explorer */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Integrity & Relationship Findings</h3>
            <p className="text-xs text-slate-400">Detailed list of identified orphans, foreign key mismatches, and data synchronization gaps</p>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search findings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 w-48"
              />
            </div>

            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-slate-700 font-medium"
            >
              <option value="ALL">All Domains</option>
              <option value="EMPLOYEE">Employees</option>
              <option value="CUSTOMER">Customers</option>
              <option value="ORDER">Orders</option>
            </select>

            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-slate-700 font-medium"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </div>
        </div>

        {/* Findings List */}
        {filteredFindings.length === 0 ? (
          <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
            <h4 className="text-sm font-bold text-slate-700">No Relationship Inconsistencies Found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              All Employee, Customer, KYC, Payroll, Document, and Order relationships map cleanly to valid canonical entities.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFindings.map((finding) => {
              const isCritical = finding.severity === 'CRITICAL';
              const isWarning = finding.severity === 'WARNING';
              return (
                <div
                  key={finding.id}
                  className={`p-4 rounded-xl border transition ${
                    isCritical ? 'bg-rose-50/30 border-rose-200/80 hover:border-rose-300' :
                    isWarning ? 'bg-amber-50/30 border-amber-200/80 hover:border-amber-300' :
                    'bg-slate-50/50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          isCritical ? 'bg-rose-600 text-white' :
                          isWarning ? 'bg-amber-500 text-white' :
                          'bg-slate-600 text-white'
                        }`}>
                          {finding.severity}
                        </span>

                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded-md">
                          {finding.collection}
                        </span>

                        <span className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                          ID: {finding.recordId}
                        </span>

                        {finding.autoFixable && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Wrench className="w-2.5 h-2.5" /> Auto-Fixable
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 mt-1">{finding.title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">{finding.description}</p>
                    </div>

                    {finding.targetReferenceId && (
                      <div className="shrink-0 text-right bg-white/80 border border-slate-200 rounded-lg p-2 text-[10px]">
                        <span className="text-slate-400 block font-semibold">Target Reference</span>
                        <span className="font-mono font-bold text-slate-700">{finding.targetReferenceId}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center gap-2 text-[11px] text-slate-600">
                    <span className="font-bold text-slate-700">Remediation:</span>
                    <span>{finding.suggestedFix}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Audit Trail Note */}
      {report?.repairsApplied && report.repairsApplied.details.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h4 className="text-xs font-bold text-emerald-900">Latest Auto-Repair Execution Log</h4>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {report.repairsApplied.details.map((detail, idx) => (
              <div key={idx} className="text-xs text-emerald-800 flex items-start gap-2">
                <span className="text-emerald-500 font-bold">•</span>
                <span>{detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
