import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Key, Lock, Unlock, Check, X, RefreshCw, 
  AlertCircle, Eye, EyeOff, Sparkles, UserCheck, UserX, ShieldAlert
} from 'lucide-react';
import { EmployeeProfile } from '../../types.js';

interface EmployeeLoginAccessModuleProps {
  adminFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  triggerAlert: (msg: string) => void;
  isSuper: boolean;
}

interface EnrichedEmployee extends EmployeeProfile {
  hasLogin?: boolean;
  loginAllowed?: boolean;
  loginId?: string;
  loginRole?: string | null;
  accountStatus?: string;
}

export default function EmployeeLoginAccessModule({
  adminFetch,
  triggerAlert,
  isSuper: _isSuper
}: EmployeeLoginAccessModuleProps) {
  const [employees, setEmployees] = useState<EnrichedEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [loginStatusFilter, setLoginStatusFilter] = useState<'all' | 'with_login' | 'no_login'>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // Modal State
  const [modalEmployee, setModalEmployee] = useState<EnrichedEmployee | null>(null);
  const [loginAllowed, setLoginAllowed] = useState(true);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STAFF');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/employees');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setEmployees(data);
        }
      } else {
        triggerAlert('Failed to load employee list.');
      }
    } catch (e: any) {
      triggerAlert('Network error loading employees.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const openCredentialsModal = (emp: EnrichedEmployee) => {
    setModalEmployee(emp);
    const hasActiveLogin = !!emp.hasLogin;
    setLoginAllowed(hasActiveLogin);
    setLoginId(emp.loginId || emp.employeeCode || '');
    setPassword('');
    setRole(emp.loginRole || 'STAFF');
    setShowPassword(false);
    setModalError('');
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
    setShowPassword(true);
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEmployee) return;

    if (loginAllowed && !loginId.trim()) {
      setModalError('Login ID / Username cannot be empty.');
      return;
    }

    if (loginAllowed && !modalEmployee.hasLogin && (!password || password.length < 6)) {
      setModalError('Password must be at least 6 characters for a new login.');
      return;
    }

    setIsSubmitting(true);
    setModalError('');

    try {
      if (!loginAllowed) {
        // Super Admin chose "No Login" -> Revoke credentials
        const res = await adminFetch(`/api/admin/employees/${modalEmployee.id}/account`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            loginAllowed: false,
            noLogin: true,
            accountStatus: 'Disabled'
          })
        });

        if (res.ok) {
          triggerAlert(`Login access disabled for ${modalEmployee.fullName}. Set to No Login.`);
          setModalEmployee(null);
          fetchEmployees();
        } else {
          const err = await res.json().catch(() => ({}));
          setModalError(err.message || 'Failed to revoke login.');
        }
      } else {
        // Super Admin chose "Create Login" or update credentials
        const payload: any = {
          loginAllowed: true,
          username: loginId.trim(),
          loginId: loginId.trim(),
          role: role,
          accountStatus: 'Active'
        };
        if (password) {
          payload.password = password;
        }

        const res = await adminFetch(`/api/admin/employees/${modalEmployee.id}/account`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          triggerAlert(`Login credentials updated for ${modalEmployee.fullName} (${loginId.trim()}).`);
          setModalEmployee(null);
          fetchEmployees();
        } else {
          const err = await res.json().catch(() => ({}));
          setModalError(err.message || 'Failed to update login credentials.');
        }
      }
    } catch (err: any) {
      setModalError(err.message || 'Error communicating with server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stats calculation
  const totalEmployees = employees.length;
  const withLoginCount = employees.filter(e => e.hasLogin).length;
  const noLoginCount = totalEmployees - withLoginCount;

  // Departments list for filter
  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));

  // Filtered employees
  const filtered = employees.filter(emp => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery = !q ||
      (emp.fullName && emp.fullName.toLowerCase().includes(q)) ||
      (emp.employeeCode && emp.employeeCode.toLowerCase().includes(q)) ||
      (emp.loginId && emp.loginId.toLowerCase().includes(q)) ||
      (emp.personalEmail && emp.personalEmail.toLowerCase().includes(q)) ||
      (emp.designation && emp.designation.toLowerCase().includes(q));

    const matchStatus = 
      loginStatusFilter === 'all' || 
      (loginStatusFilter === 'with_login' && emp.hasLogin) ||
      (loginStatusFilter === 'no_login' && !emp.hasLogin);

    const matchDept = departmentFilter === 'all' || emp.department === departmentFilter;

    return matchQuery && matchStatus && matchDept;
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      
      {/* Header & Policy Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
              RBAC Credential Authority
            </span>
            <span className="text-slate-400 text-xs">• Super Admin Only</span>
          </div>
          <h3 className="font-bold text-sm text-slate-900 mt-1">Employee System Login & Credentials</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Employees cannot log into the dashboard unless Super Admin explicitly enables login credentials. Other staff accounts can only view/manage orders assigned to them.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchEmployees}
          disabled={loading}
          className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-center cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div 
          onClick={() => setLoginStatusFilter('all')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            loginStatusFilter === 'all' ? 'bg-blue-50/80 border-blue-200 shadow-xs' : 'bg-white border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Employees</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1">{totalEmployees}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Staff & personnel directory</span>
        </div>

        <div 
          onClick={() => setLoginStatusFilter('with_login')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            loginStatusFilter === 'with_login' ? 'bg-emerald-50/80 border-emerald-200 shadow-xs' : 'bg-white border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Active Logins</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-1">{withLoginCount}</p>
          <span className="text-[10px] text-emerald-600/80 mt-0.5 block">Authorized dashboard users</span>
        </div>

        <div 
          onClick={() => setLoginStatusFilter('no_login')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            loginStatusFilter === 'no_login' ? 'bg-slate-100 border-slate-300 shadow-xs' : 'bg-white border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">No Login</span>
            <UserX className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-600 mt-1">{noLoginCount}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Directory records with no access</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by employee name, code, login ID, email..."
            className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-slate-50 text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">All Departments ({departments.length})</option>
            {departments.map((d: any) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={loginStatusFilter}
            onChange={(e) => setLoginStatusFilter(e.target.value as any)}
            className="text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-slate-50 text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses ({totalEmployees})</option>
            <option value="with_login">Active Login ({withLoginCount})</option>
            <option value="no_login">No Login ({noLoginCount})</option>
          </select>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-bold text-xs text-slate-900 leading-none">
            Employee Security & Login Directory
          </h4>
          <span className="text-[10px] text-slate-400 font-medium">({filtered.length} shown)</span>
        </div>

        {/* Mobile View: Cards */}
        <div className="sm:hidden p-3 space-y-3">
          {loading ? (
            <div className="p-6 text-center text-slate-400 text-xs">Loading employee security status...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">No employees found matching criteria.</div>
          ) : (
            filtered.map(emp => (
              <div key={emp.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={emp.profilePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={emp.fullName}
                      className="w-9 h-9 rounded-full object-cover border border-slate-200"
                    />
                    <div>
                      <p className="font-bold text-slate-900 text-xs">{emp.fullName}</p>
                      <span className="text-[10px] text-blue-600 font-mono font-semibold">{emp.employeeCode}</span>
                    </div>
                  </div>
                  {emp.hasLogin ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1">
                      <Key className="w-2.5 h-2.5" /> Login Active
                    </span>
                  ) : (
                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5 text-slate-400" /> No Login
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-600 space-y-0.5 bg-slate-50 p-2 rounded-lg font-mono">
                  <p className="font-sans text-[11px] font-medium text-slate-800">{emp.designation} • {emp.department}</p>
                  {emp.hasLogin ? (
                    <p className="text-emerald-800">Login ID: <strong>{emp.loginId}</strong> ({emp.loginRole || 'STAFF'})</p>
                  ) : (
                    <p className="text-slate-400">No login credentials assigned</p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => openCredentialsModal(emp)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                      emp.hasLogin
                        ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{emp.hasLogin ? 'Change Login / No Login' : 'Create Login'}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden sm:block overflow-x-auto text-xs">
          <table className="w-full min-w-[700px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                <th className="p-3">Employee & Code</th>
                <th className="p-3">Department & Designation</th>
                <th className="p-3">Login Access Status</th>
                <th className="p-3">Assigned Login ID</th>
                <th className="p-3">System Role</th>
                <th className="p-3 text-right">Super Admin Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">Loading employees...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">No matching employees found.</td>
                </tr>
              ) : (
                filtered.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={emp.profilePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                          alt={emp.fullName}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <p className="font-bold text-slate-900">{emp.fullName}</p>
                          <span className="text-[10px] text-blue-600 font-mono font-bold">{emp.employeeCode}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3">
                      <p className="text-slate-800 font-semibold">{emp.designation}</p>
                      <span className="text-[10px] text-slate-400 block">{emp.department}</span>
                    </td>

                    <td className="p-3">
                      {emp.hasLogin ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Active Login
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5">
                          <Lock className="w-3 h-3 text-slate-400" />
                          No Login
                        </span>
                      )}
                    </td>

                    <td className="p-3 font-mono">
                      {emp.hasLogin && emp.loginId ? (
                        <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-bold text-[11px] border border-purple-100">
                          {emp.loginId}
                        </span>
                      ) : (
                        <span className="text-slate-300 italic">—</span>
                      )}
                    </td>

                    <td className="p-3">
                      {emp.hasLogin ? (
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100">
                          {emp.loginRole || 'STAFF'}
                        </span>
                      ) : (
                        <span className="text-slate-300 italic">—</span>
                      )}
                    </td>

                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => openCredentialsModal(emp)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                          emp.hasLogin
                            ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                      >
                        <Key className="w-3 h-3" />
                        <span>{emp.hasLogin ? 'Change / No Login' : 'Create Login'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Super Admin Modal for Create Login / Change Credentials / No Login */}
      {modalEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center">
                  <Key className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {modalEmployee.hasLogin ? 'Modify Employee Login' : 'Create Employee Login'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {modalEmployee.fullName} ({modalEmployee.employeeCode})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalEmployee(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCredentials} className="space-y-4 text-xs">
              
              {/* Access Mode Toggle: Create Login vs No Login */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Login Access Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLoginAllowed(true)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                      loginAllowed 
                        ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold shadow-2xs' 
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Unlock className={`w-4 h-4 ${loginAllowed ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div>
                      <p className="text-xs">Create / Enable Login</p>
                      <span className="text-[10px] text-slate-400 font-normal">Allow dashboard access</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLoginAllowed(false)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                      !loginAllowed 
                        ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold shadow-2xs' 
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Lock className={`w-4 h-4 ${!loginAllowed ? 'text-amber-600' : 'text-slate-400'}`} />
                    <div>
                      <p className="text-xs">No Login Option</p>
                      <span className="text-[10px] text-slate-400 font-normal">Revoke system access</span>
                    </div>
                  </button>
                </div>
              </div>

              {loginAllowed ? (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  {/* Login ID / Username */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Login ID / Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      placeholder="e.g. EMP101 or username"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 font-mono"
                      required
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Employee uses this ID to log into the EasyDesk Admin Console.
                    </span>
                  </div>

                  {/* Password Field with Generate Option */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700">
                        {modalEmployee.hasLogin ? 'New Password (leave empty to keep existing)' : 'Set Password'} <span className={modalEmployee.hasLogin ? '' : 'text-red-500'}>*</span>
                      </label>
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="text-[11px] font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" /> Auto-Generate
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={modalEmployee.hasLogin ? 'Leave blank to keep unchanged' : 'Min 6 characters'}
                        className="w-full border border-slate-200 rounded-xl pl-3 pr-9 py-2 text-xs focus:outline-none focus:border-blue-600 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Role Selection */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Access Authorization Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 bg-white"
                    >
                      <option value="STAFF">STAFF (Assigned Orders Only - Restricted Access)</option>
                      <option value="OPERATOR">OPERATOR (Assigned Orders & Verification)</option>
                      <option value="ADMIN">ADMIN (Administrative Level Access)</option>
                    </select>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Non-Super Admin logins will only see and process orders specifically assigned to them.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>Confirm "No Login" Option</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    This will disable all login credentials for <strong>{modalEmployee.fullName}</strong>. They will NOT be able to log into the admin portal. Historical assigned orders and HR records will remain completely safe.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalEmployee(null)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 rounded-xl text-white font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    loginAllowed
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {isSubmitting ? (
                    <span>Saving...</span>
                  ) : loginAllowed ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{modalEmployee.hasLogin ? 'Update Credentials' : 'Save & Enable Login'}</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Revoke Access (No Login)</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
