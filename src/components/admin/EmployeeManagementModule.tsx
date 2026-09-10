import React, { useState, useEffect, Suspense, lazy } from 'react';
import { 
  Users, Search, Filter, Plus, Edit, Trash2, Eye, Printer, UserX, UserCheck, 
  FileText, ShieldCheck, CreditCard, Clock, Building2, MapPin, Mail, Phone,
  AlertCircle, Upload, CheckCircle2, XCircle, ChevronRight, Lock, Loader2
} from 'lucide-react';
import { EmployeeProfile, EmployeeKYC, EmployeePayroll, EmployeeDocument, MasterData } from '../../types.js';
const EmployeeIDCardModal = lazy(() => import('./EmployeeIDCardModal.js'));
import { EmployeePhotoUpload } from './EmployeePhotoUpload.js';
import IndianAddressFields from '../common/IndianAddressFields.js';
import { printElement } from '../../lib/printUtils.js';

interface EmployeeManagementModuleProps {
  adminFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  triggerAlert: (msg: string) => void;
  masterData?: MasterData;
}

export default function EmployeeManagementModule({ adminFetch, triggerAlert, masterData }: EmployeeManagementModuleProps) {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [designationFilter, setDesignationFilter] = useState('all');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Active Selected Employee for View/Print/Edit/ID Card
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeProfile | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [idCardModalOpen, setIdCardModalOpen] = useState(false);

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
  
  // Tab inside Modal
  const [modalTab, setModalTab] = useState<'profile' | 'kyc' | 'payroll' | 'history'>('profile');

  // Selected Employee Sub-Records
  const [activeKYC, setActiveKYC] = useState<EmployeeKYC | null>(null);
  const [activePayroll, setActivePayroll] = useState<EmployeePayroll | null>(null);
  const [activeDocs, setActiveDocs] = useState<EmployeeDocument[]>([]);

  // Form State for Create/Edit Profile
  const [formProfile, setFormProfile] = useState<Partial<EmployeeProfile>>({
    fullName: '',
    employeeCode: '',
    designation: 'Operations Executive',
    department: 'Operations',
    employmentType: 'Full-Time',
    joiningDate: new Date().toISOString().split('T')[0],
    employmentStatus: 'Active',
    workLocation: 'Headquarters - Mumbai',
    personalEmail: '',
    personalMobile: '',
    emergencyContactMobile: '',
    gender: 'Male',
    dateOfBirth: '',
    fatherName: '',
    spouseName: '',
    currentAddress: '',
    permanentAddress: '',
    isPermanentSameAsCurrent: true,
    country: 'India',
    state: '',
    district: '',
    city: '',
    pinCode: '',
    pincode: '',
    addressLine1: '',
    addressLine2: '',
    locality: '',
    landmark: '',
    profilePhoto: '',
    internalNotes: ''
  });

  // Form State for KYC
  const [formKYC, setFormKYC] = useState<Partial<EmployeeKYC>>({
    aadhaarNumber: '',
    panNumber: '',
    otherGovernmentIdType: 'Passport',
    otherGovernmentIdNumber: '',
    verificationNotes: ''
  });

  // Form State for Payroll
  const [formPayroll, setFormPayroll] = useState<Partial<EmployeePayroll>>({
    bankName: 'HDFC Bank',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    paymentMethod: 'Bank Transfer',
    basicPay: 25000,
    hra: 10000,
    specialAllowance: 5000,
    pfDeduction: 1800,
    taxDeduction: 0,
    grossSalary: 40000,
    netSalary: 38200
  });

  // Master lists options
  const defaultDepts = ['Operations', 'Customer Support', 'IT & Software', 'Human Resources', 'Finance & Accounting', 'Legal & Compliance', 'Marketing'];
  const defaultDesigs = ['Operations Executive', 'Senior Service Manager', 'Verification Officer', 'HR Specialist', 'IT Admin', 'Legal Advisor', 'Department Head'];
  const departmentsList = masterData?.departments?.length ? masterData.departments : defaultDepts;
  const designationsList = masterData?.designations?.length ? masterData.designations : defaultDesigs;

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/employees');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setEmployees(data);
        }
      }
    } catch (err) {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        console.warn('Error fetching employee records:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const loadSubRecords = async (empId: string) => {
    // Immediately clear stale sub-records to guarantee zero leakage between records
    setActiveKYC(null);
    setActivePayroll(null);
    setActiveDocs([]);
    try {
      const [kycRes, payrollRes, docsRes] = await Promise.all([
        adminFetch(`/api/admin/employees/${empId}/kyc?unmask=true`),
        adminFetch(`/api/admin/employees/${empId}/payroll?unmask=true`),
        adminFetch(`/api/admin/employees/${empId}/documents`)
      ]);

      if (kycRes.ok) {
        const kData = await kycRes.json();
        if (kData && (!kData.employeeId || kData.employeeId === empId)) {
          setActiveKYC(kData);
        } else {
          setActiveKYC(null);
        }
      } else {
        setActiveKYC(null);
      }

      if (payrollRes.ok) {
        const pData = await payrollRes.json();
        if (pData && (!pData.employeeId || pData.employeeId === empId)) {
          setActivePayroll(pData);
        } else {
          setActivePayroll(null);
        }
      } else {
        setActivePayroll(null);
      }

      if (docsRes.ok) {
        const dData = await docsRes.json();
        if (Array.isArray(dData)) {
          setActiveDocs(dData.filter((doc: any) => !doc.employeeId || doc.employeeId === empId));
        } else {
          setActiveDocs([]);
        }
      } else {
        setActiveDocs([]);
      }
    } catch (e) {
      console.error('Error loading sub-records:', e);
      setActiveKYC(null);
      setActivePayroll(null);
      setActiveDocs([]);
    }
  };

  const handleOpenCreate = () => {
    setSelectedEmployee(null);
    const newCode = `EMP-${1000 + employees.length + 1}`;
    setFormProfile({
      fullName: '',
      employeeCode: newCode,
      designation: designationsList[0] || 'Operations Executive',
      department: departmentsList[0] || 'Operations',
      employmentType: 'Full-Time',
      joiningDate: new Date().toISOString().split('T')[0],
      employmentStatus: 'Active',
      workLocation: 'Headquarters - Mumbai',
      reportingManager: '',
      probationStatus: 'Confirmed',
      confirmationDate: '',
      exitDate: '',
      exitReason: '',
      personalEmail: '',
      personalMobile: '',
      emergencyContactName: '',
      emergencyContactRelation: '',
      emergencyContactMobile: '',
      gender: 'Male',
      dateOfBirth: '1995-01-01',
      fatherName: '',
      motherName: '',
      spouseName: '',
      nationality: 'Indian',
      bloodGroup: 'O+',
      currentAddress: '',
      permanentAddress: '',
      isPermanentSameAsCurrent: true,
      country: 'India',
      city: '',
      state: '',
      district: '',
      pinCode: '',
      pincode: '',
      addressLine1: '',
      addressLine2: '',
      locality: '',
      landmark: '',
      profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      highestQualification: 'Bachelor Degree',
      university: '',
      certifications: '',
      totalExperienceYears: 2,
      previousOrganizations: '',
      skills: 'Operations, Customer Support' as any,
      languages: 'English, Hindi' as any,
      internalNotes: ''
    });
    setFormKYC({
      aadhaarNumber: '1234 5678 9012',
      panNumber: 'ABCDE1234F',
      otherGovernmentIdType: 'Passport',
      otherGovernmentIdNumber: 'Z1234567',
      verificationNotes: 'KYC documents verified'
    });
    setFormPayroll({
      bankName: 'HDFC Bank',
      accountHolderName: '',
      accountNumber: '50100234567890',
      ifscCode: 'HDFC0001234',
      branchName: 'Mumbai Central',
      paymentMethod: 'Bank Transfer',
      basicPay: 25000,
      hra: 10000,
      specialAllowance: 5000,
      pfDeduction: 1800,
      taxDeduction: 1000,
      grossSalary: 40000,
      netSalary: 37200
    });
    setModalTab('profile');
    setFormModalOpen(true);
  };

  const handleOpenEdit = async (emp: EmployeeProfile) => {
    setSelectedEmployee(emp);
    setFormProfile({
      ...emp,
      skills: Array.isArray(emp.skills) ? emp.skills.join(', ') : (emp.skills || '') as any,
      languages: Array.isArray(emp.languages) ? emp.languages.join(', ') : (emp.languages || '') as any
    });
    setModalTab('profile');
    setFormModalOpen(true);

    // Load sub-records for form initialization
    try {
      const [kycRes, payrollRes, docsRes] = await Promise.all([
        adminFetch(`/api/admin/employees/${emp.id}/kyc?unmask=true`),
        adminFetch(`/api/admin/employees/${emp.id}/payroll?unmask=true`),
        adminFetch(`/api/admin/employees/${emp.id}/documents`)
      ]);

      if (kycRes.ok) {
        const kData = await kycRes.json();
        setActiveKYC(kData);
        setFormKYC({ ...kData });
      }
      if (payrollRes.ok) {
        const pData = await payrollRes.json();
        setActivePayroll(pData);
        setFormPayroll({ ...pData });
      }
      if (docsRes.ok) {
        setActiveDocs(await docsRes.json());
      }
    } catch (err) {
      console.error('Failed to load sub-records for employee edit:', err);
    }
  };

  const handleOpenView = async (emp: EmployeeProfile) => {
    setSelectedEmployee(emp);
    setActiveKYC(null);
    setActivePayroll(null);
    setActiveDocs([]);
    setModalTab('profile');
    setViewModalOpen(true);
    await loadSubRecords(emp.id);
  };

  const handleOpenPrint = async (emp: EmployeeProfile) => {
    setSelectedEmployee(emp);
    setActiveKYC(null);
    setActivePayroll(null);
    setActiveDocs([]);
    setPrintModalOpen(true);
    await loadSubRecords(emp.id);
  };

  const handlePrintRecord = () => {
    if (!selectedEmployee) return;
    const printEl = document.getElementById(`employee-printable-sheet-${selectedEmployee.id}`);
    if (printEl) {
      printElement(printEl, `EasyDesk-Employee-Record-${selectedEmployee.employeeCode}`);
    } else {
      window.print();
    }
  };

  const handleOpenIDCard = (emp: EmployeeProfile) => {
    setSelectedEmployee(emp);
    setIdCardModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProfile.fullName || !formProfile.employeeCode) {
      alert('Full Name and Employee Code are required.');
      return;
    }

    try {
      const empId = selectedEmployee ? selectedEmployee.id : `emp-${Date.now()}`;
      
      const skillsArray = typeof formProfile.skills === 'string'
        ? (formProfile.skills as string).split(',').map(s => s.trim()).filter(Boolean)
        : (formProfile.skills || []);

      const languagesArray = typeof formProfile.languages === 'string'
        ? (formProfile.languages as string).split(',').map(l => l.trim()).filter(Boolean)
        : (formProfile.languages || []);

      const payload = {
        ...formProfile,
        skills: skillsArray,
        languages: languagesArray,
        id: empId,
        fatherMotherSpouseName: [formProfile.fatherName, formProfile.motherName, formProfile.spouseName].filter(Boolean).join(', ')
      };

      const url = selectedEmployee ? `/api/admin/employees/${empId}` : '/api/admin/employees';
      const method = selectedEmployee ? 'PUT' : 'POST';

      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Also save KYC and Payroll
        await Promise.all([
          adminFetch(`/api/admin/employees/${empId}/kyc`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formKYC)
          }),
          adminFetch(`/api/admin/employees/${empId}/payroll`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...formPayroll,
              accountHolderName: formPayroll.accountHolderName || formProfile.fullName
            })
          })
        ]);

        const savedEmployee = {
          ...payload,
          employmentStatus: payload.employmentStatus as any
        } as EmployeeProfile;

        setEmployees(prev => {
          const exists = prev.some(e => e.id === savedEmployee.id);
          if (exists) {
            return prev.map(e => e.id === savedEmployee.id ? { ...e, ...savedEmployee } : e);
          }
          return [savedEmployee, ...prev];
        });

        triggerAlert(`Employee Record for ${formProfile.fullName} saved successfully!`);
        setFormModalOpen(false);
        fetchEmployees();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to save employee: ${errData.message || 'Server error'}`);
      }
    } catch (err: any) {
      alert(err.message || 'Network error saving employee record.');
    }
  };

  const handleToggleDeactivate = (emp: EmployeeProfile) => {
    const isActivating = emp.employmentStatus !== 'Active';
    const actionLabel = isActivating ? 'Activate' : 'Deactivate / Suspend';
    const newStatus = isActivating ? 'Active' : 'Suspended';

    setConfirmModal({
      isOpen: true,
      title: `${actionLabel} Employee Record`,
      message: `Are you sure you want to ${isActivating ? 'activate' : 'deactivate / suspend'} employee record for ${emp.fullName} (${emp.employeeCode})?`,
      confirmText: actionLabel,
      confirmStyle: isActivating ? 'primary' : 'warning',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        // Immediate optimistic UI update
        setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, employmentStatus: newStatus as any } : e));

        try {
          const res = await adminFetch(`/api/admin/employees/${emp.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employmentStatus: newStatus })
          });

          if (res.ok) {
            triggerAlert(`Employee record status updated to ${newStatus}.`);
            fetchEmployees();
          } else {
            // Fallback to PUT
            const fallbackRes = await adminFetch(`/api/admin/employees/${emp.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ employmentStatus: newStatus })
            });

            if (fallbackRes.ok) {
              triggerAlert(`Employee record status updated to ${newStatus}.`);
              fetchEmployees();
            } else {
              const errData = await fallbackRes.json().catch(() => ({}));
              triggerAlert(`Failed to update employee status: ${errData.message || 'Server error'}`);
              fetchEmployees(); // Revert
            }
          }
        } catch (e: any) {
          triggerAlert(`Failed to update employee status: ${e.message || 'Network error'}`);
          fetchEmployees(); // Revert
        }
      }
    });
  };

  const handleDeleteEmployee = (emp: EmployeeProfile) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Employee Record',
      message: `Are you sure you want to permanently delete internal record for ${emp.fullName} (${emp.employeeCode})? This action cannot be undone.`,
      confirmText: 'Delete Employee',
      confirmStyle: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        // Immediate optimistic UI update
        setEmployees(prev => prev.filter(e => e.id !== emp.id));

        try {
          const res = await adminFetch(`/api/admin/employees/${emp.id}?permanent=true`, {
            method: 'DELETE'
          });

          if (res.ok) {
            triggerAlert(`Employee record for ${emp.fullName} permanently deleted.`);
            fetchEmployees();
          } else {
            const errData = await res.json().catch(() => ({}));
            triggerAlert(`Failed to delete employee: ${errData.message || 'Server error'}`);
            fetchEmployees(); // Revert
          }
        } catch (e: any) {
          triggerAlert(`Delete failed: ${e.message || 'Network error'}`);
          fetchEmployees(); // Revert
        }
      }
    });
  };

  const handleUploadDocument = async (docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEmployee) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      try {
        const res = await adminFetch(`/api/admin/employees/${selectedEmployee.id}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentType: docType,
            documentName: `${docType} - ${file.name}`,
            originalFileName: file.name,
            fileData: base64Data,
            mimeType: file.type,
            notes: `Uploaded for HR record`
          })
        });

        if (res.ok) {
          triggerAlert(`Uploaded ${docType} successfully.`);
          loadSubRecords(selectedEmployee.id);
        } else {
          alert('Failed to upload document.');
        }
      } catch (err) {
        alert('Document upload error.');
      }
    };
    reader.readAsDataURL(file);
  };

  // Filtered employees list
  const filteredEmployees = employees.filter(emp => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = emp.fullName?.toLowerCase().includes(q) || 
      emp.employeeCode?.toLowerCase().includes(q) || 
      emp.personalEmail?.toLowerCase().includes(q) ||
      emp.personalMobile?.includes(q);

    const matchesDept = departmentFilter === 'all' || emp.department === departmentFilter;
    const matchesDesig = designationFilter === 'all' || emp.designation === designationFilter;
    const matchesType = employmentTypeFilter === 'all' || emp.employmentType === employmentTypeFilter;
    const matchesStatus = statusFilter === 'all' || emp.employmentStatus === statusFilter;

    return matchesSearch && matchesDept && matchesDesig && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Interactive Controls & Directory Table (hidden during printing) */}
      <div className="space-y-6 print:hidden">
        {/* Header bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Internal HR Records
            </span>
            <span className="text-slate-400 text-xs">• Company Record System Only</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1">Employee Record Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">Maintain internal company profiles, KYC document archives, and HR payroll history.</p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 self-start md:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Employee Record
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative col-span-1 sm:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ID code, email or phone..."
            className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-blue-600"
          />
        </div>

        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-700 font-medium"
        >
          <option value="all">All Departments</option>
          {departmentsList.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <select
          value={employmentTypeFilter}
          onChange={(e) => setEmploymentTypeFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-700 font-medium"
        >
          <option value="all">All Employment Types</option>
          <option value="Full-Time">Full-Time</option>
          <option value="Part-Time">Part-Time</option>
          <option value="Contract">Contract</option>
          <option value="Intern">Intern / Trainee</option>
          <option value="Consultant">Consultant</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-700 font-medium"
        >
          <option value="all">All Statuses</option>
          <option value="Active">Active</option>
          <option value="On Leave">On Leave</option>
          <option value="Suspended">Suspended</option>
          <option value="Resigned">Resigned</option>
          <option value="Terminated">Terminated</option>
        </select>
      </div>

      {/* Employee Records Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
            Employee Directory ({filteredEmployees.length} Records)
          </h3>
          <span className="text-[10px] text-slate-400 font-mono">HR Master Index</span>
        </div>

        {/* Mobile View: Employee Cards */}
        <div className="sm:hidden p-3 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
              Loading internal employee records...
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
              No matching employee records found in system archives.
            </div>
          ) : (
            filteredEmployees.map(emp => (
              <div key={emp.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <img 
                      src={emp.profilePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'} 
                      alt={emp.fullName}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{emp.fullName}</p>
                      <span className="text-[10px] text-blue-600 font-mono font-bold">{emp.employeeCode}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    emp.employmentStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    emp.employmentStatus === 'On Leave' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {emp.employmentStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Designation</span>
                    <p className="font-bold text-slate-800">{emp.designation}</p>
                    <span className="text-[10px] text-slate-400">{emp.department}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Type & Joined</span>
                    <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold inline-block">
                      {emp.employmentType}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-0.5">{emp.joiningDate}</span>
                  </div>
                </div>

                <div className="text-xs space-y-1 font-mono text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                  {emp.personalEmail && (
                    <a href={`mailto:${emp.personalEmail}`} className="text-slate-700 hover:text-blue-600 truncate block">
                      ✉️ {emp.personalEmail}
                    </a>
                  )}
                  {emp.personalMobile && (
                    <a href={`tel:${emp.personalMobile}`} className="text-slate-700 hover:text-blue-600 block">
                      📞 {emp.personalMobile}
                    </a>
                  )}
                </div>

                {/* Touch-Friendly Action Buttons */}
                <div className="pt-1 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleOpenIDCard(emp); }}
                    className="px-3 py-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition cursor-pointer font-bold text-xs flex items-center gap-1.5 shadow-2xs"
                  >
                    <CreditCard className="w-3.5 h-3.5" /> ID Card
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleOpenView(emp); }}
                      className="p-2 text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-xl transition cursor-pointer border border-slate-200"
                      title="View Internal Profile Record"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleOpenPrint(emp); }}
                      className="p-2 text-slate-600 hover:text-emerald-600 bg-slate-50 hover:bg-emerald-50 rounded-xl transition cursor-pointer border border-slate-200"
                      title="Print Official Record Sheet"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleOpenEdit(emp); }}
                      className="p-2 text-slate-600 hover:text-purple-600 bg-slate-50 hover:bg-purple-50 rounded-xl transition cursor-pointer border border-slate-200"
                      title="Edit Employee Record"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleToggleDeactivate(emp); }}
                      className="p-2 text-slate-600 hover:text-amber-600 bg-slate-50 hover:bg-amber-50 rounded-xl transition cursor-pointer border border-slate-200"
                      title={emp.employmentStatus === 'Active' ? 'Deactivate Record' : 'Activate Record'}
                    >
                      {emp.employmentStatus === 'Active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(emp); }}
                      className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-xl transition cursor-pointer border border-slate-200"
                      title="Permanently Delete Record"
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
                <th className="p-3">Code & Employee</th>
                <th className="p-3">Department & Role</th>
                <th className="p-3">Employment Type</th>
                <th className="p-3">Joining Date</th>
                <th className="p-3">Contact Email & Phone</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">Loading internal employee records...</td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">No matching employee records found in system archives.</td>
                </tr>
              ) : (
                filteredEmployees.map(emp => (
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
                      <p className="font-bold text-slate-800">{emp.designation}</p>
                      <span className="text-[10px] text-slate-400 block">{emp.department}</span>
                    </td>
                    <td className="p-3">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                        {emp.employmentType}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 font-mono text-[11px]">{emp.joiningDate}</td>
                    <td className="p-3">
                      <p className="text-slate-800">{emp.personalEmail}</p>
                      <span className="text-[10px] text-slate-400 font-mono">{emp.personalMobile}</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        emp.employmentStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        emp.employmentStatus === 'On Leave' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {emp.employmentStatus}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleOpenIDCard(emp); }}
                          className="px-2 py-1 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer font-bold text-[11px] flex items-center gap-1 shadow-2xs"
                          title="Generate Official Employee ID Card"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">ID Card</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleOpenView(emp); }}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="View Internal Profile Record"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleOpenPrint(emp); }}
                          className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                          title="Print Official Record Sheet"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleOpenEdit(emp); }}
                          className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition cursor-pointer"
                          title="Edit Employee Record"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleToggleDeactivate(emp); }}
                          className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                          title={emp.employmentStatus === 'Active' ? 'Deactivate Record' : 'Activate Record'}
                        >
                          {emp.employmentStatus === 'Active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(emp); }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Permanently Delete Record"
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

      {/* CREATE / EDIT EMPLOYEE MODAL */}
      {formModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                  HR Management Form
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {selectedEmployee ? `Edit Employee Record: ${selectedEmployee.fullName}` : 'Create New Internal Employee Record'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {selectedEmployee && (
                  <button
                    type="button"
                    onClick={() => { setFormModalOpen(false); handleOpenIDCard(selectedEmployee); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Generate ID Card
                  </button>
                )}
                <button 
                  onClick={() => setFormModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="px-6 pt-4 border-b border-slate-100 flex gap-2 overflow-x-auto text-xs font-bold">
              <button
                type="button"
                onClick={() => setModalTab('profile')}
                className={`px-4 py-2 rounded-t-xl transition border-b-2 ${modalTab === 'profile' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
              >
                1. Basic Profile
              </button>
              <button
                type="button"
                onClick={() => setModalTab('kyc')}
                className={`px-4 py-2 rounded-t-xl transition border-b-2 ${modalTab === 'kyc' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
              >
                2. Identification & KYC
              </button>
              <button
                type="button"
                onClick={() => setModalTab('payroll')}
                className={`px-4 py-2 rounded-t-xl transition border-b-2 ${modalTab === 'payroll' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
              >
                3. Payroll & Banking
              </button>
              <button
                type="button"
                onClick={() => setModalTab('history')}
                className={`px-4 py-2 rounded-t-xl transition border-b-2 ${modalTab === 'history' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
              >
                4. History & Notes
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-6">
              
              {/* TAB 1: BASIC PROFILE */}
              {modalTab === 'profile' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={formProfile.fullName || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, fullName: e.target.value })}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Employee Code / ID *</label>
                      <input
                        type="text"
                        required
                        value={formProfile.employeeCode || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, employeeCode: e.target.value })}
                        placeholder="e.g. EMP-1001"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Gender</label>
                      <select
                        value={formProfile.gender || 'Male'}
                        onChange={(e) => setFormProfile({ ...formProfile, gender: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 bg-white"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={formProfile.dateOfBirth || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, dateOfBirth: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Father Name</label>
                      <input
                        type="text"
                        value={formProfile.fatherName || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, fatherName: e.target.value })}
                        placeholder="Father's full name"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Mother Name</label>
                      <input
                        type="text"
                        value={formProfile.motherName || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, motherName: e.target.value })}
                        placeholder="Mother's full name"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Spouse Name (Optional)</label>
                      <input
                        type="text"
                        value={formProfile.spouseName || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, spouseName: e.target.value })}
                        placeholder="Spouse name"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Nationality</label>
                      <input
                        type="text"
                        value={formProfile.nationality || 'Indian'}
                        onChange={(e) => setFormProfile({ ...formProfile, nationality: e.target.value })}
                        placeholder="e.g. Indian"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Blood Group</label>
                      <select
                        value={formProfile.bloodGroup || 'O+'}
                        onChange={(e) => setFormProfile({ ...formProfile, bloodGroup: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 bg-white"
                      >
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Reporting Manager</label>
                      <input
                        type="text"
                        value={formProfile.reportingManager || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, reportingManager: e.target.value })}
                        placeholder="Manager Name / Code"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Department</label>
                      <select
                        value={formProfile.department || departmentsList[0]}
                        onChange={(e) => setFormProfile({ ...formProfile, department: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 bg-white"
                      >
                        {departmentsList.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Designation</label>
                      <select
                        value={formProfile.designation || designationsList[0]}
                        onChange={(e) => setFormProfile({ ...formProfile, designation: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 bg-white"
                      >
                        {designationsList.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Employment Type</label>
                      <select
                        value={formProfile.employmentType || 'Full-Time'}
                        onChange={(e) => setFormProfile({ ...formProfile, employmentType: e.target.value as any })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 bg-white"
                      >
                        <option value="Full-Time">Full-Time</option>
                        <option value="Part-Time">Part-Time</option>
                        <option value="Contract">Contract</option>
                        <option value="Intern">Intern / Trainee</option>
                        <option value="Consultant">Consultant</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Date of Joining</label>
                      <input
                        type="date"
                        value={formProfile.joiningDate || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, joiningDate: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Work Location</label>
                      <input
                        type="text"
                        value={formProfile.workLocation || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, workLocation: e.target.value })}
                        placeholder="e.g. Headquarters - Mumbai"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Record Status</label>
                      <select
                        value={formProfile.employmentStatus || 'Active'}
                        onChange={(e) => setFormProfile({ ...formProfile, employmentStatus: e.target.value as any })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 bg-white"
                      >
                        <option value="Active">Active</option>
                        <option value="On Leave">On Leave</option>
                        <option value="Suspended">Suspended</option>
                        <option value="Resigned">Resigned</option>
                        <option value="Terminated">Terminated</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Official / Personal Email</label>
                      <input
                        type="email"
                        value={formProfile.personalEmail || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, personalEmail: e.target.value })}
                        placeholder="employee@company.com"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Primary Mobile Number</label>
                      <input
                        type="text"
                        value={formProfile.personalMobile || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, personalMobile: e.target.value })}
                        placeholder="9876543210"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Emergency Contact Mobile</label>
                      <input
                        type="text"
                        value={formProfile.emergencyContactMobile || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, emergencyContactMobile: e.target.value })}
                        placeholder="Emergency phone"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Emergency Contact Name</label>
                      <input
                        type="text"
                        value={formProfile.emergencyContactName || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, emergencyContactName: e.target.value })}
                        placeholder="e.g. Ramesh Sharma"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Emergency Contact Relation</label>
                      <input
                        type="text"
                        value={formProfile.emergencyContactRelation || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, emergencyContactRelation: e.target.value })}
                        placeholder="e.g. Father, Spouse"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                    <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      Present / Communication Address
                    </h4>
                    <IndianAddressFields
                      value={{
                        country: formProfile.country || 'India',
                        state: formProfile.state || '',
                        district: formProfile.district || '',
                        city: formProfile.city || '',
                        addressLine1: formProfile.addressLine1 || formProfile.currentAddress || '',
                        addressLine2: formProfile.addressLine2 || '',
                        locality: formProfile.locality || '',
                        landmark: formProfile.landmark || '',
                        pincode: formProfile.pincode || formProfile.pinCode || '',
                        pinCode: formProfile.pinCode || formProfile.pincode || '',
                        address: formProfile.currentAddress || ''
                      }}
                      onChange={(addr) => {
                        setFormProfile(prev => {
                          const updated = {
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
                            currentAddress: addr.address || addr.addressLine1 || ''
                          };
                          if (prev.isPermanentSameAsCurrent) {
                            updated.permanentAddress = updated.currentAddress;
                          }
                          return updated;
                        });
                      }}
                    />

                    <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formProfile.isPermanentSameAsCurrent ?? true}
                          onChange={(e) => {
                            const isSame = e.target.checked;
                            setFormProfile(prev => ({
                              ...prev,
                              isPermanentSameAsCurrent: isSame,
                              permanentAddress: isSame ? (prev.currentAddress || '') : prev.permanentAddress
                            }));
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        Permanent address is same as present address
                      </label>

                      {!(formProfile.isPermanentSameAsCurrent ?? true) && (
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Permanent Address Details</label>
                          <textarea
                            rows={2}
                            value={formProfile.permanentAddress || ''}
                            onChange={(e) => setFormProfile({ ...formProfile, permanentAddress: e.target.value })}
                            placeholder="Full permanent address..."
                            className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-blue-600 bg-white"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <EmployeePhotoUpload
                      value={formProfile.profilePhoto || ''}
                      onChange={(photoUrl) => setFormProfile(prev => ({ ...prev, profilePhoto: photoUrl }))}
                      adminFetch={adminFetch}
                      label="Employee Profile Photo"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: IDENTIFICATION & KYC */}
              {modalTab === 'kyc' && (
                <div className="space-y-4 text-xs">
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Sensitive HR Identification Vault: All credentials are held securely in compliance with data privacy.</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Aadhaar Number</label>
                      <input
                        type="text"
                        value={formKYC.aadhaarNumber}
                        onChange={(e) => setFormKYC({ ...formKYC, aadhaarNumber: e.target.value })}
                        placeholder="12-digit Aadhaar number"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">PAN Number</label>
                      <input
                        type="text"
                        value={formKYC.panNumber}
                        onChange={(e) => setFormKYC({ ...formKYC, panNumber: e.target.value })}
                        placeholder="10-digit PAN alphanumeric"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Passport / Other ID Type</label>
                      <input
                        type="text"
                        value={formKYC.otherGovernmentIdType}
                        onChange={(e) => setFormKYC({ ...formKYC, otherGovernmentIdType: e.target.value })}
                        placeholder="e.g. Passport or Voter ID"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Other ID Number</label>
                      <input
                        type="text"
                        value={formKYC.otherGovernmentIdNumber}
                        onChange={(e) => setFormKYC({ ...formKYC, otherGovernmentIdNumber: e.target.value })}
                        placeholder="ID number"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 font-mono"
                      />
                    </div>
                  </div>

                  {/* Document Upload Links */}
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Required Document Uploads</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {['Aadhaar Copy', 'PAN Copy', 'Resume / Bio-Data', 'Appointment Letter', 'Educational Certificates', 'Experience Letter'].map(docType => (
                        <div key={docType} className="border border-slate-200/80 rounded-xl p-3 flex items-center justify-between bg-slate-50/50">
                          <div>
                            <p className="font-bold text-slate-800 text-[11px]">{docType}</p>
                            <span className="text-[9px] text-slate-400">PDF, JPG or PNG format</span>
                          </div>
                          <label className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition flex items-center gap-1">
                            <Upload className="w-3 h-3" /> Upload
                            <input 
                              type="file" 
                              className="hidden" 
                              onChange={(e) => handleUploadDocument(docType, e)}
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PAYROLL & BANKING */}
              {modalTab === 'payroll' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={formPayroll.bankName}
                        onChange={(e) => setFormPayroll({ ...formPayroll, bankName: e.target.value })}
                        placeholder="e.g. HDFC Bank"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Account Holder Name</label>
                      <input
                        type="text"
                        value={formPayroll.accountHolderName || formProfile.fullName}
                        onChange={(e) => setFormPayroll({ ...formPayroll, accountHolderName: e.target.value })}
                        placeholder="Name on bank account"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Account Number</label>
                      <input
                        type="text"
                        value={formPayroll.accountNumber}
                        onChange={(e) => setFormPayroll({ ...formPayroll, accountNumber: e.target.value })}
                        placeholder="Bank account number"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">IFSC Code</label>
                      <input
                        type="text"
                        value={formPayroll.ifscCode}
                        onChange={(e) => setFormPayroll({ ...formPayroll, ifscCode: e.target.value })}
                        placeholder="HDFC0001234"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Branch Name</label>
                      <input
                        type="text"
                        value={formPayroll.branchName}
                        onChange={(e) => setFormPayroll({ ...formPayroll, branchName: e.target.value })}
                        placeholder="Branch location"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Payment Mode</label>
                      <select
                        value={formPayroll.paymentMethod}
                        onChange={(e) => setFormPayroll({ ...formPayroll, paymentMethod: e.target.value as any })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 bg-white"
                      >
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cheque">Cheque</option>
                        <option value="UPI">UPI</option>
                        <option value="Cash">Cash</option>
                      </select>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Basic Salary (₹)</label>
                      <input
                        type="number"
                        value={formPayroll.basicPay}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const gross = val + (formPayroll.hra || 0) + (formPayroll.specialAllowance || 0);
                          const net = gross - (formPayroll.pfDeduction || 0) - (formPayroll.taxDeduction || 0);
                          setFormPayroll({ ...formPayroll, basicPay: val, grossSalary: gross, netSalary: net });
                        }}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">HRA Allowances (₹)</label>
                      <input
                        type="number"
                        value={formPayroll.hra}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const gross = (formPayroll.basicPay || 0) + val + (formPayroll.specialAllowance || 0);
                          const net = gross - (formPayroll.pfDeduction || 0) - (formPayroll.taxDeduction || 0);
                          setFormPayroll({ ...formPayroll, hra: val, grossSalary: gross, netSalary: net });
                        }}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Total Deductions (PF/Tax) (₹)</label>
                      <input
                        type="number"
                        value={(formPayroll.pfDeduction || 0) + (formPayroll.taxDeduction || 0)}
                        onChange={(e) => {
                          const ded = Number(e.target.value);
                          const gross = formPayroll.grossSalary || 0;
                          setFormPayroll({ ...formPayroll, pfDeduction: ded, netSalary: gross - ded });
                        }}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-900 block mb-1">Net Payable Salary (₹)</label>
                      <input
                        type="number"
                        value={formPayroll.netSalary}
                        readOnly
                        className="w-full border border-slate-200 bg-slate-100 font-bold text-blue-700 rounded-xl px-3 py-2 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: QUALIFICATIONS, SKILLS & NOTES */}
              {modalTab === 'history' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Highest Qualification</label>
                      <input
                        type="text"
                        value={formProfile.highestQualification || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, highestQualification: e.target.value })}
                        placeholder="e.g. B.Tech Computer Science / MBA"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">University / Institute</label>
                      <input
                        type="text"
                        value={formProfile.university || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, university: e.target.value })}
                        placeholder="e.g. University of Mumbai"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Certifications</label>
                      <input
                        type="text"
                        value={formProfile.certifications || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, certifications: e.target.value })}
                        placeholder="e.g. AWS Certified, PMP, Six Sigma"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Total Experience (Years)</label>
                      <input
                        type="number"
                        value={formProfile.totalExperienceYears ?? 0}
                        onChange={(e) => setFormProfile({ ...formProfile, totalExperienceYears: Number(e.target.value) })}
                        placeholder="e.g. 5"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Previous Organizations</label>
                    <input
                      type="text"
                      value={formProfile.previousOrganizations || ''}
                      onChange={(e) => setFormProfile({ ...formProfile, previousOrganizations: e.target.value })}
                      placeholder="e.g. TCS, Infosys, Wipro"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Skills (comma separated)</label>
                      <input
                        type="text"
                        value={typeof formProfile.skills === 'string' ? formProfile.skills : (Array.isArray(formProfile.skills) ? formProfile.skills.join(', ') : '')}
                        onChange={(e) => setFormProfile({ ...formProfile, skills: e.target.value as any })}
                        placeholder="e.g. Operations, Customer Support, Excel"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Languages Known (comma separated)</label>
                      <input
                        type="text"
                        value={typeof formProfile.languages === 'string' ? formProfile.languages : (Array.isArray(formProfile.languages) ? formProfile.languages.join(', ') : '')}
                        onChange={(e) => setFormProfile({ ...formProfile, languages: e.target.value as any })}
                        placeholder="e.g. English, Hindi, Marathi"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Internal HR Notes & Performance Remarks</label>
                    <textarea
                      rows={4}
                      value={formProfile.internalNotes || ''}
                      onChange={(e) => setFormProfile({ ...formProfile, internalNotes: e.target.value })}
                      placeholder="Add performance evaluations, internal transfer notes, or administrative remarks..."
                      className="w-full border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md"
                >
                  Save Internal Employee Record
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* VIEW EMPLOYEE PROFILE MODAL */}
      {viewModalOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <img 
                  src={selectedEmployee.profilePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'} 
                  alt={selectedEmployee.fullName} 
                  className="w-12 h-12 rounded-full object-cover border-2 border-blue-600 shadow-sm"
                />
                <div>
                  <h3 className="text-lg font-black text-slate-900">{selectedEmployee.fullName}</h3>
                  <span className="text-xs text-blue-600 font-mono font-bold">{selectedEmployee.employeeCode} • {selectedEmployee.designation}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setViewModalOpen(false); handleOpenIDCard(selectedEmployee); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" /> Generate ID Card
                </button>
                <button
                  onClick={() => { setViewModalOpen(false); handleOpenPrint(selectedEmployee); }}
                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Sheet
                </button>
                <button
                  onClick={() => setViewModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-xs"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Profile Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl text-xs">
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase block">Department</span>
                <p className="font-bold text-slate-800">{selectedEmployee.department}</p>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase block">Employment Type</span>
                <p className="font-bold text-slate-800">{selectedEmployee.employmentType}</p>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase block">Joining Date</span>
                <p className="font-bold text-slate-800 font-mono">{selectedEmployee.joiningDate}</p>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase block">Status</span>
                <span className="font-bold text-emerald-600">{selectedEmployee.employmentStatus}</span>
              </div>
            </div>

            {/* Contact & Address */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Contact & Address Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white border border-slate-100 p-3 rounded-xl">
                <p><strong className="text-slate-500">Official Email:</strong> {selectedEmployee.personalEmail || 'N/A'}</p>
                <p><strong className="text-slate-500">Mobile Phone:</strong> {selectedEmployee.personalMobile || 'N/A'}</p>
                <p><strong className="text-slate-500">Work Location:</strong> {selectedEmployee.workLocation || 'N/A'}</p>
                <p><strong className="text-slate-500">Emergency Contact:</strong> {selectedEmployee.emergencyContactMobile || 'N/A'}</p>
                <p className="col-span-2"><strong className="text-slate-500">Address:</strong> {selectedEmployee.currentAddress || 'N/A'}</p>
              </div>
            </div>

            {/* Sub Records */}
            {activeKYC && (
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">KYC & Identification Verification</h4>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl font-mono">
                  <p><strong className="text-slate-500 font-sans">Aadhaar:</strong> {activeKYC.aadhaarNumber || 'Pending'}</p>
                  <p><strong className="text-slate-500 font-sans">PAN:</strong> {activeKYC.panNumber || 'Pending'}</p>
                </div>
              </div>
            )}

            {activePayroll && (
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Payroll & Compensation</h4>
                <div className="grid grid-cols-3 gap-2 bg-blue-50/50 border border-blue-100 p-3 rounded-xl">
                  <p><strong className="text-slate-500 block">Bank:</strong> {activePayroll.bankName || 'N/A'}</p>
                  <p><strong className="text-slate-500 block">A/C Number:</strong> <span className="font-mono">{activePayroll.accountNumber || 'N/A'}</span></p>
                  <p><strong className="text-slate-500 block">Net Salary:</strong> <span className="font-bold text-blue-700">₹{activePayroll.netSalary || activePayroll.salaryAmount || 0}</span></p>
                </div>
              </div>
            )}

            {/* Document Vault List */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Uploaded HR Vault Documents ({activeDocs.length})</h4>
              {activeDocs.length === 0 ? (
                <p className="text-slate-400 italic">No uploaded documents on file.</p>
              ) : (
                <div className="space-y-1.5">
                  {activeDocs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <p className="font-bold text-slate-800">{doc.documentName}</p>
                        <span className="text-[9px] text-slate-400">{doc.documentType} • Uploaded {doc.uploadedAt?.split('T')[0]}</span>
                      </div>
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[9px] font-bold">Verified</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* PRINTABLE RECORD SHEET MODAL */}
      {printModalOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 overflow-y-auto printable-modal-overlay">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-8 shadow-2xl border border-slate-300 space-y-6 font-sans text-slate-900 printable-modal-card">
            
            {/* Top Toolbar - Hidden in Print */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full uppercase tracking-wider">
                  Internal Corporate HR Document
                </span>
                <span className="text-xs text-slate-500 font-mono font-bold">Ref: {selectedEmployee.employeeCode}</span>
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

            {/* Target Printable Record Sheet */}
            <div id={`employee-printable-sheet-${selectedEmployee.id}`} className="space-y-4 text-slate-900 bg-white">
              
              {/* 1. Official Corporate Header / Letterhead */}
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
                        Corporate Human Resources & Personnel Records Repository
                      </p>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                        A51, Vijay Nagar, Indore, Madhya Pradesh - 452010 • HR Desk: +91 9575538590 • hr@easydesk.com
                      </p>
                      <p className="text-[8px] text-slate-400 font-mono">
                        CIN: U72900MH2024PTC123456 • ISO 9001:2015 Certified HRMS System
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-600 shrink-0">
                    <span className="inline-block bg-slate-100 text-slate-800 border border-slate-300 font-extrabold text-[9px] px-2.5 py-0.5 rounded uppercase tracking-wider mb-1">
                      Confidential Record
                    </span>
                    <p className="font-bold text-slate-900 uppercase tracking-wider">Internal Employee Master</p>
                    <p className="font-mono">Doc Ref: <strong className="text-blue-900">HR/EMP/{selectedEmployee.employeeCode}</strong></p>
                    <p className="font-mono text-[9px] text-slate-400">Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>
              </div>

              {/* 2. Employee Profile Overview Banner */}
              <div className="border border-slate-300 rounded-lg p-3.5 bg-slate-50/40 flex items-start justify-between gap-5 print-avoid-break">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-black text-slate-900 tracking-tight">{selectedEmployee.fullName}</h2>
                    <span className="font-mono font-bold text-xs text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                      {selectedEmployee.employeeCode}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                      selectedEmployee.employmentStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300'
                    }`}>
                      {selectedEmployee.employmentStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                    <p><span className="text-slate-500 font-semibold inline-block w-28">Designation:</span> <strong className="text-slate-900">{selectedEmployee.designation}</strong></p>
                    <p><span className="text-slate-500 font-semibold inline-block w-28">Department:</span> <strong className="text-slate-900">{selectedEmployee.department}</strong></p>
                    <p><span className="text-slate-500 font-semibold inline-block w-28">Employment Type:</span> <span className="text-slate-800">{selectedEmployee.employmentType}</span></p>
                    <p><span className="text-slate-500 font-semibold inline-block w-28">Joining Date:</span> <span className="text-slate-800">{selectedEmployee.joiningDate}</span></p>
                    <p><span className="text-slate-500 font-semibold inline-block w-28">Work Location:</span> <span className="text-slate-800">{selectedEmployee.workLocation || 'Central Corporate Office'}</span></p>
                    <p><span className="text-slate-500 font-semibold inline-block w-28">Reporting To:</span> <span className="text-slate-800">{selectedEmployee.reportingManager || 'Department Head'}</span></p>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-center">
                  {selectedEmployee.profilePhoto ? (
                    <img 
                      src={selectedEmployee.profilePhoto} 
                      alt={selectedEmployee.fullName} 
                      className="w-24 h-28 rounded-lg object-cover border-2 border-slate-300 shadow-xs"
                    />
                  ) : (
                    <div className="w-24 h-28 rounded-lg bg-slate-200 border-2 border-slate-300 flex flex-col items-center justify-center text-slate-400 text-xs font-bold">
                      <span className="text-lg font-black text-slate-600">{selectedEmployee.fullName?.slice(0, 2).toUpperCase()}</span>
                      <span className="text-[9px] mt-1 text-slate-500">Photo ID</span>
                    </div>
                  )}
                  <span className="text-[8px] text-slate-400 font-mono mt-1">Verified Portrait</span>
                </div>
              </div>

              {/* 3. Section 1: Personal & Emergency Demographics */}
              <div className="border border-slate-300 rounded-lg p-3.5 space-y-2 print-avoid-break">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                  1. Personal & Emergency Contact Demographics
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <p><span className="text-slate-500 font-semibold inline-block w-28">Gender / DOB:</span> <span className="text-slate-900 font-medium">{selectedEmployee.gender || 'N/A'} / {selectedEmployee.dateOfBirth || 'N/A'}</span></p>
                  <p><span className="text-slate-500 font-semibold inline-block w-28">Blood Group:</span> <span className="text-slate-900 font-medium">{selectedEmployee.bloodGroup || 'N/A'}</span></p>
                  <p><span className="text-slate-500 font-semibold inline-block w-28">Father / Spouse:</span> <span className="text-slate-900 font-medium">{selectedEmployee.fatherName || selectedEmployee.spouseName || 'N/A'}</span></p>
                  <p><span className="text-slate-500 font-semibold inline-block w-28">Nationality:</span> <span className="text-slate-900 font-medium">{selectedEmployee.nationality || 'Indian'}</span></p>
                  <p><span className="text-slate-500 font-semibold inline-block w-28">Personal Email:</span> <span className="font-mono text-slate-900">{selectedEmployee.personalEmail || 'N/A'}</span></p>
                  <p><span className="text-slate-500 font-semibold inline-block w-28">Personal Mobile:</span> <span className="font-mono text-slate-900">{selectedEmployee.personalMobile ? `+91 ${selectedEmployee.personalMobile}` : 'N/A'}</span></p>
                  <p className="col-span-2">
                    <span className="text-slate-500 font-semibold inline-block w-28">Emergency Contact:</span> 
                    <span className="text-slate-900 font-medium">
                      {selectedEmployee.emergencyContactName ? `${selectedEmployee.emergencyContactName} (${selectedEmployee.emergencyContactRelation || 'Contact'}) - ${selectedEmployee.emergencyContactMobile || 'N/A'}` : 'N/A'}
                    </span>
                  </p>
                  <div className="col-span-2 pt-1 border-t border-slate-100">
                    <span className="text-slate-500 font-semibold block text-[10px] uppercase">Current Residential Address:</span>
                    <p className="text-slate-800 leading-snug mt-0.5 font-medium">
                      {selectedEmployee.currentAddress || [selectedEmployee.addressLine1, selectedEmployee.addressLine2, selectedEmployee.locality, selectedEmployee.city, selectedEmployee.state].filter(Boolean).join(', ') || 'N/A'}
                      {(selectedEmployee.pinCode || selectedEmployee.pincode) ? ` - ${selectedEmployee.pinCode || selectedEmployee.pincode}` : ''}
                    </p>
                  </div>
                  {selectedEmployee.permanentAddress && (
                    <div className="col-span-2 pt-1 border-t border-slate-100">
                      <span className="text-slate-500 font-semibold block text-[10px] uppercase">Permanent Residential Address:</span>
                      <p className="text-slate-800 leading-snug mt-0.5 font-medium">{selectedEmployee.permanentAddress}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Section 2: Statutory Verification & Government Identity Vault */}
              <div className="border border-slate-300 rounded-lg p-3.5 space-y-2 print-avoid-break">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                  2. Statutory Verification & Government Identity Vault
                </h3>
                {activeKYC ? (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                    <p>
                      <span className="text-slate-500 font-semibold inline-block w-32">Aadhaar Number:</span>
                      <span className="font-mono font-bold text-slate-900">{activeKYC.aadhaarNumber || 'Verified On File'}</span>
                      <span className="ml-2 text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold uppercase">
                        {activeKYC.aadhaarVerificationStatus || 'Verified'}
                      </span>
                    </p>
                    <p>
                      <span className="text-slate-500 font-semibold inline-block w-32">PAN Number:</span>
                      <span className="font-mono font-bold text-slate-900">{activeKYC.panNumber || 'Verified On File'}</span>
                      <span className="ml-2 text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold uppercase">
                        {activeKYC.panVerificationStatus || 'Verified'}
                      </span>
                    </p>
                    {activeKYC.otherGovernmentIdNumber && (
                      <p className="col-span-2">
                        <span className="text-slate-500 font-semibold inline-block w-32">{activeKYC.otherGovernmentIdType || 'Government ID'}:</span>
                        <span className="font-mono font-bold text-slate-900">{activeKYC.otherGovernmentIdNumber}</span>
                      </p>
                    )}
                    {activeKYC.verifiedBy && (
                      <p className="col-span-2 text-[10px] text-slate-500 pt-1">
                        Verified by: <span className="font-medium text-slate-700">{activeKYC.verifiedBy}</span>
                        {activeKYC.verifiedAt ? ` on ${new Date(activeKYC.verifiedAt).toLocaleDateString('en-IN')}` : ''}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-1">
                    Statutory identity documents and government vault records are pending physical/electronic verification for this employee.
                  </p>
                )}
              </div>

              {/* 5. Section 3: Compensation Structure & Banking Credentials */}
              <div className="border border-slate-300 rounded-lg p-3.5 space-y-2 print-avoid-break">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                  3. Compensation Structure & Banking Credentials
                </h3>
                {activePayroll ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-3 text-xs bg-slate-50/60 p-2.5 rounded border border-slate-200">
                      <div>
                        <span className="text-slate-500 font-semibold block text-[10px] uppercase">Bank Name:</span>
                        <strong className="text-slate-900">{activePayroll.bankName || 'N/A'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block text-[10px] uppercase">A/C Number:</span>
                        <span className="font-mono font-bold text-slate-900">{activePayroll.accountNumber || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block text-[10px] uppercase">IFSC Code & Branch:</span>
                        <span className="font-mono text-slate-800">{activePayroll.ifscCode || 'N/A'} {activePayroll.branchName ? `(${activePayroll.branchName})` : ''}</span>
                      </div>
                    </div>

                    <table className="w-full text-xs border border-slate-200 rounded overflow-hidden">
                      <thead>
                        <tr className="bg-slate-100 text-[10px] text-slate-600 font-bold uppercase border-b border-slate-200">
                          <th className="py-1 px-2.5 text-left">Basic Pay</th>
                          <th className="py-1 px-2.5 text-left">HRA</th>
                          <th className="py-1 px-2.5 text-left">Allowances</th>
                          <th className="py-1 px-2.5 text-left">Gross Salary</th>
                          <th className="py-1 px-2.5 text-left">Deductions (PF+Tax)</th>
                          <th className="py-1 px-2.5 text-right font-black text-blue-950">Net Monthly Salary</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="divide-x divide-slate-200">
                          <td className="py-1.5 px-2.5 font-medium">₹{(activePayroll.basicPay || 0).toLocaleString('en-IN')}</td>
                          <td className="py-1.5 px-2.5 font-medium">₹{(activePayroll.hra || 0).toLocaleString('en-IN')}</td>
                          <td className="py-1.5 px-2.5 font-medium">₹{(activePayroll.specialAllowance || 0).toLocaleString('en-IN')}</td>
                          <td className="py-1.5 px-2.5 font-semibold text-slate-900">₹{(activePayroll.grossSalary || 0).toLocaleString('en-IN')}</td>
                          <td className="py-1.5 px-2.5 text-red-600 font-medium">₹{((activePayroll.pfDeduction || 0) + (activePayroll.taxDeduction || 0)).toLocaleString('en-IN')}</td>
                          <td className="py-1.5 px-2.5 text-right font-black text-blue-800 text-sm">₹{(activePayroll.netSalary || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-1">
                    Payroll structure and banking credentials have not been configured for this employee record.
                  </p>
                )}
              </div>

              {/* 6. Section 4: Skills, Qualifications & Languages (If Available) */}
              {(selectedEmployee.highestQualification || (selectedEmployee.skills && selectedEmployee.skills.length > 0) || (selectedEmployee.languages && selectedEmployee.languages.length > 0)) && (
                <div className="border border-slate-300 rounded-lg p-3.5 space-y-1.5 print-avoid-break">
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                    4. Professional Qualifications & Competencies
                  </h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                    {selectedEmployee.highestQualification && (
                      <p><span className="text-slate-500 font-semibold inline-block w-28">Qualification:</span> <strong className="text-slate-900">{selectedEmployee.highestQualification}</strong> {selectedEmployee.university ? `(${selectedEmployee.university})` : ''}</p>
                    )}
                    {selectedEmployee.languages && selectedEmployee.languages.length > 0 && (
                      <p><span className="text-slate-500 font-semibold inline-block w-28">Languages:</span> <span className="text-slate-800">{Array.isArray(selectedEmployee.languages) ? selectedEmployee.languages.join(', ') : selectedEmployee.languages}</span></p>
                    )}
                    {selectedEmployee.skills && selectedEmployee.skills.length > 0 && (
                      <p className="col-span-2 pt-0.5">
                        <span className="text-slate-500 font-semibold inline-block w-28">Key Skills:</span> 
                        <span className="text-slate-800 font-medium">
                          {Array.isArray(selectedEmployee.skills) ? selectedEmployee.skills.join(' • ') : selectedEmployee.skills}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 7. Section 5: Document Verification Manifest (If Attached) */}
              {activeDocs && activeDocs.length > 0 && (
                <div className="border border-slate-300 rounded-lg p-3.5 space-y-2 print-avoid-break">
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                    5. Document Archive Manifest ({activeDocs.length})
                  </h3>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] text-slate-600 font-bold uppercase border-b border-slate-200">
                        <th className="py-1 px-2 text-left">Document Type</th>
                        <th className="py-1 px-2 text-left">File Name</th>
                        <th className="py-1 px-2 text-left">Uploaded On</th>
                        <th className="py-1 px-2 text-right">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeDocs.map((doc, idx) => (
                        <tr key={doc.id || idx}>
                          <td className="py-1 px-2 font-semibold text-slate-900">{doc.documentType}</td>
                          <td className="py-1 px-2 font-mono text-slate-600 text-[11px] truncate max-w-[200px]">{doc.documentName || doc.originalFileName}</td>
                          <td className="py-1 px-2 text-slate-500 font-mono text-[10px]">{doc.uploadedAt?.split('T')[0] || 'N/A'}</td>
                          <td className="py-1 px-2 text-right">
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded uppercase">
                              {doc.verificationStatus || 'Verified'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 8. Attestation & Signatures */}
              <div className="pt-6 grid grid-cols-2 gap-12 text-xs print-avoid-break">
                <div className="border-t border-slate-400 pt-2 text-center">
                  <p className="font-bold text-slate-800">Employee Signature & Attestation</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">I confirm that all personal and statutory information stated above is accurate and valid.</p>
                </div>
                <div className="border-t border-slate-400 pt-2 text-center">
                  <p className="font-bold text-slate-800">Authorized HR Signatory & Seal</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">For EasyDesk Solutions Private Limited • Corporate HR Operations</p>
                </div>
              </div>

              {/* 9. Official Document Footer */}
              <div className="pt-4 border-t border-slate-300 text-[9px] text-slate-500 flex items-center justify-between font-mono">
                <span>EasyDesk HRMS • Master Record: {selectedEmployee.employeeCode}</span>
                <span>Confidential Record • Protected under Indian IT Act 2000</span>
                <span>Generated: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
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

      {/* OFFICIAL EMPLOYEE ID CARD GENERATOR MODAL */}
      {idCardModalOpen && selectedEmployee && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 text-xs text-slate-500 shadow-2xl">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span>Generating Employee ID Badge Preview & PDF Engine...</span>
            </div>
          </div>
        }>
          <EmployeeIDCardModal
            employee={selectedEmployee}
            onClose={() => setIdCardModalOpen(false)}
            adminFetch={adminFetch}
            triggerAlert={triggerAlert}
            onEmployeeUpdated={fetchEmployees}
          />
        </Suspense>
      )}

    </div>
  );
}
