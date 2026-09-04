import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Printer, Download, RefreshCw, Building2, Phone, Mail, Globe, MapPin, 
  ShieldCheck, AlertTriangle, Settings, Check, User, Sparkles, QrCode, FileText, CheckCircle2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { EmployeeProfile, CompanyProfile } from '../../types.js';

interface EmployeeIDCardModalProps {
  employee: EmployeeProfile;
  onClose: () => void;
  adminFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  triggerAlert: (msg: string) => void;
  onEmployeeUpdated?: () => void;
}

const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  companyName: 'EasyDesk Digital Services Pvt Ltd',
  logoUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=200',
  address: 'Digital India Tower, Plot 14, Sector 62',
  city: 'Noida',
  state: 'Uttar Pradesh',
  pinCode: '201301',
  phone: '+91 99999 88888',
  email: 'support@easydesk.com',
  website: 'https://easydesk.com',
  primaryColor: '#1e40af', // Corporate Deep Blue
  secondaryColor: '#0f172a', // Dark Slate
  accentColor: '#2563eb',
  authorizedSignatoryName: 'Devendra Sharma',
  authorizedSignatoryDesignation: 'Managing Director'
};

export default function EmployeeIDCardModal({
  employee,
  onClose,
  adminFetch,
  triggerAlert,
  onEmployeeUpdated
}: EmployeeIDCardModalProps) {
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(DEFAULT_COMPANY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'both' | 'front' | 'back'>('both');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  
  // Settings Edit Drawer/Modal state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [formCompany, setFormCompany] = useState<CompanyProfile>(DEFAULT_COMPANY_PROFILE);
  const [savingSettings, setSavingSettings] = useState(false);

  // Card Refs for PDF Capture
  const frontCardRef = useRef<HTMLDivElement>(null);
  const backCardRef = useRef<HTMLDivElement>(null);

  // Fetch Company Settings & Generate QR Code
  const fetchCompanyProfileAndGenerateQR = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/company-profile');
      if (res.ok) {
        const data = await res.json();
        const merged = { ...DEFAULT_COMPANY_PROFILE, ...(data || {}) };
        setCompanyProfile(merged);
        setFormCompany(merged);
      }
    } catch (err) {
      console.error('Failed to load company profile:', err);
    } finally {
      setLoading(false);
    }

    // Generate Verification QR Code
    try {
      const verifyUrl = `${companyProfile.website || 'https://easydesk.com'}/verify-employee?code=${employee.employeeCode}`;
      const qrData = await QRCode.toDataURL(verifyUrl, {
        margin: 1,
        width: 200,
        color: {
          dark: companyProfile.secondaryColor || '#0f172a',
          light: '#ffffff'
        }
      });
      setQrDataUrl(qrData);
    } catch (qrErr) {
      console.error('Failed generating QR code:', qrErr);
    }
  };

  useEffect(() => {
    fetchCompanyProfileAndGenerateQR();
  }, [employee.id, employee.employeeCode]);

  // Handle Regenerate ID Card
  const handleRegenerate = async () => {
    setRegenerating(true);
    await fetchCompanyProfileAndGenerateQR();
    setTimeout(() => {
      setRegenerating(false);
      triggerAlert(`Employee ID card regenerated for ${employee.fullName} (${employee.employeeCode}).`);
    }, 600);
  };

  // Save updated Company Profile Settings
  const handleSaveCompanySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await adminFetch('/api/admin/company-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyProfile: formCompany })
      });

      if (res.ok) {
        setCompanyProfile(formCompany);
        setSettingsOpen(false);
        triggerAlert('Company branding and profile updated. ID cards re-rendered.');
        // Re-generate QR
        const verifyUrl = `${formCompany.website || 'https://easydesk.com'}/verify-employee?code=${employee.employeeCode}`;
        const qrData = await QRCode.toDataURL(verifyUrl, {
          margin: 1,
          width: 200,
          color: { dark: formCompany.secondaryColor || '#0f172a', light: '#ffffff' }
        });
        setQrDataUrl(qrData);
      } else {
        triggerAlert('Failed to update company profile settings.');
      }
    } catch (err) {
      triggerAlert('Error saving company profile.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Direct Browser Print
  const handlePrint = () => {
    window.print();
  };

  // High-Resolution PDF Download using html2canvas & jsPDF
  const handleDownloadPDF = async () => {
    if (!frontCardRef.current || !backCardRef.current) return;
    setDownloadingPdf(true);

    try {
      const canvasOpts = {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      };

      const frontCanvas = await html2canvas(frontCardRef.current, canvasOpts);
      const backCanvas = await html2canvas(backCardRef.current, canvasOpts);

      const frontImgData = frontCanvas.toDataURL('image/png');
      const backImgData = backCanvas.toDataURL('image/png');

      // CR80 dimensions in mm: 85.6 mm x 53.98 mm (portrait: 53.98 x 85.6 mm)
      // Standard ID Card PDF format or A4 landscape
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [54, 86] // CR80 standard badge
      });

      // Page 1: Front
      pdf.addImage(frontImgData, 'PNG', 0, 0, 54, 86);

      // Page 2: Back
      pdf.addPage([54, 86], 'portrait');
      pdf.addImage(backImgData, 'PNG', 0, 0, 54, 86);

      const fileName = `EasyDesk_${employee.employeeCode || 'EMP'}_ID_Card.pdf`;
      pdf.save(fileName);
      triggerAlert(`ID Card PDF downloaded: ${fileName}`);
    } catch (err: any) {
      console.error('PDF Generation failed:', err);
      triggerAlert(`Failed to generate PDF: ${err.message || 'Rendering error'}`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const isInactive = employee.employmentStatus !== 'Active';

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static">
      
      {/* Modal Container */}
      <div className="bg-slate-100 rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:bg-transparent print:w-auto">
        
        {/* Header Toolbar (Hidden in Print) */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-2xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base text-slate-900">Official Employee ID Card</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                  isInactive 
                    ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}>
                  {employee.employmentStatus}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {employee.fullName} • <span className="font-mono text-blue-700 font-bold">{employee.employeeCode}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Configure Company Logo, Address & Color Theme"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" /> Company Settings
            </button>

            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh ID Card graphics & verification token"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} /> Regenerate
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloadingPdf}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" /> Print ID Card
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Switcher Tabs (Front / Back / Both) - Hidden in Print */}
        <div className="bg-slate-200/70 border-b border-slate-300 px-6 py-2.5 flex items-center justify-between gap-4 shrink-0 print:hidden">
          <div className="flex items-center gap-1 bg-white/80 p-1 rounded-xl border border-slate-300/80 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('both')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'both' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Both Sides (Front & Back)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('front')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'front' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Front Side Only
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('back')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'back' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Back Side Only
            </button>
          </div>

          <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
            CR80 Standard Dimensions • High Quality Vector Print Ready
          </p>
        </div>

        {/* Main Preview Area */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-100 print:p-0 print:bg-white print:overflow-visible">
          
          {isInactive && (
            <div className="mb-4 bg-amber-50 border border-amber-300 text-amber-800 rounded-2xl p-3 px-4 max-w-xl text-center text-xs flex items-center justify-center gap-2 font-medium print:hidden">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Notice:</strong> This employee is marked as <strong>{employee.employmentStatus}</strong>. ID card preview is for archival reference only.
              </span>
            </div>
          )}

          {/* PRINTABLE CONTAINER (Targeted by @media print) */}
          <div className="id-card-print-area flex flex-wrap items-center justify-center gap-8 py-4">
            
            {/* FRONT SIDE CARD */}
            {(activeTab === 'both' || activeTab === 'front') && (
              <div className="flex flex-col items-center">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 print:hidden">
                  [ CARD FRONT ]
                </span>

                {/* CR80 Aspect Ratio Vertical Badge Box (approx 270px x 428px -> 54mm x 85.6mm) */}
                <div 
                  ref={frontCardRef}
                  id="id-card-front"
                  className="w-[270px] h-[428px] bg-white rounded-[22px] shadow-xl border border-slate-300 overflow-hidden relative flex flex-col justify-between select-none print:shadow-none print:border-slate-400"
                  style={{
                    boxSizing: 'border-box'
                  }}
                >
                  {/* Top Header Section with Company Branding Color */}
                  <div 
                    className="p-3.5 pb-5 text-white relative"
                    style={{ backgroundColor: companyProfile.primaryColor || '#1e40af' }}
                  >
                    {/* Header Decorative Pattern Overlay */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:8px_8px]"></div>
                    
                    <div className="relative z-10 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {companyProfile.logoUrl ? (
                          <img 
                            src={companyProfile.logoUrl} 
                            alt={companyProfile.companyName} 
                            className="w-7 h-7 rounded-lg object-cover bg-white p-0.5 border border-white/40 shadow-xs"
                          />
                        ) : (
                          <div className="w-7 h-7 bg-white/20 backdrop-blur-xs rounded-lg flex items-center justify-center text-white font-black text-xs border border-white/30">
                            ED
                          </div>
                        )}
                        <span className="font-extrabold text-[11px] tracking-tight leading-tight uppercase line-clamp-1">
                          {companyProfile.companyName}
                        </span>
                      </div>
                      
                      <span className="text-[8px] font-black uppercase tracking-widest bg-white/20 text-white px-1.5 py-0.5 rounded border border-white/20 shrink-0">
                        OFFICIAL ID
                      </span>
                    </div>
                  </div>

                  {/* Photo & Badge Section (Centered Overlap) */}
                  <div className="-mt-5 relative z-20 flex flex-col items-center">
                    <div className="relative">
                      <div className="w-24 h-28 rounded-2xl overflow-hidden border-4 border-white shadow-md bg-slate-100">
                        <img 
                          src={employee.profilePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'} 
                          alt={employee.fullName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback image on load error
                            (e.target as HTMLElement).setAttribute('src', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200');
                          }}
                        />
                      </div>
                      
                      {/* Active Status Badge Indicator */}
                      <span className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[10px] shadow-xs ${
                        isInactive ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
                      }`}>
                        ✓
                      </span>
                    </div>

                    {/* Employee Name & Designation */}
                    <div className="text-center px-3 mt-2.5">
                      <h3 className="font-black text-sm text-slate-900 tracking-tight uppercase line-clamp-1">
                        {employee.fullName}
                      </h3>
                      <p className="text-[11px] font-bold text-blue-700 leading-tight line-clamp-1 mt-0.5">
                        {employee.designation}
                      </p>
                      <p className="text-[9.5px] font-semibold text-slate-500 line-clamp-1">
                        {employee.department}
                      </p>
                    </div>
                  </div>

                  {/* Employee Key Specs Table */}
                  <div className="px-3 py-2 text-[10px] space-y-1 my-auto">
                    <div className="bg-slate-50 rounded-xl p-2 border border-slate-200/80 grid grid-cols-2 gap-1.5 font-medium">
                      <div>
                        <span className="text-[8px] font-bold uppercase text-slate-400 block tracking-wider">Employee Code</span>
                        <span className="font-mono font-black text-blue-700 text-xs">{employee.employeeCode}</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold uppercase text-slate-400 block tracking-wider">Joining Date</span>
                        <span className="font-mono text-slate-800 text-[10.5px] font-bold">{employee.joiningDate || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold uppercase text-slate-400 block tracking-wider">Employment Type</span>
                        <span className="text-slate-800 font-bold text-[10px]">{employee.employmentType}</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold uppercase text-slate-400 block tracking-wider">Blood Group</span>
                        <span className="font-mono text-red-600 font-bold text-[10px]">{employee.bloodGroup || 'O+'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Footer Line */}
                  <div 
                    className="p-2.5 px-3.5 text-white flex items-center justify-between text-[8px] font-mono font-bold"
                    style={{ backgroundColor: companyProfile.secondaryColor || '#0f172a' }}
                  >
                    <span>LOC: {employee.workLocation || 'Headquarters'}</span>
                    <span className="text-amber-400">AUTHORIZED CARD</span>
                  </div>

                </div>
              </div>
            )}

            {/* BACK SIDE CARD */}
            {(activeTab === 'both' || activeTab === 'back') && (
              <div className="flex flex-col items-center">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 print:hidden">
                  [ CARD BACK ]
                </span>

                {/* CR80 Aspect Ratio Vertical Badge Box */}
                <div 
                  ref={backCardRef}
                  id="id-card-back"
                  className="w-[270px] h-[428px] bg-white rounded-[22px] shadow-xl border border-slate-300 overflow-hidden relative flex flex-col justify-between select-none print:shadow-none print:border-slate-400"
                  style={{ boxSizing: 'border-box' }}
                >
                  {/* Top Header Section */}
                  <div 
                    className="p-3 text-white text-center relative"
                    style={{ backgroundColor: companyProfile.secondaryColor || '#0f172a' }}
                  >
                    <h4 className="font-black text-[11px] uppercase tracking-wider">
                      {companyProfile.companyName}
                    </h4>
                    <p className="text-[8px] text-slate-300 font-medium">Corporate Identification & Policy Notice</p>
                  </div>

                  {/* Company Contact Details */}
                  <div className="px-3.5 py-1 space-y-1.5 text-[9.5px]">
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80 space-y-1">
                      <div className="flex items-start gap-1.5 text-slate-700">
                        <MapPin className="w-3 h-3 text-blue-600 shrink-0 mt-0.5" />
                        <span className="leading-tight text-[9px]">
                          {companyProfile.address}, {companyProfile.city}, {companyProfile.state} - {companyProfile.pinCode}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Phone className="w-3 h-3 text-blue-600 shrink-0" />
                        <span className="font-mono text-[9px] font-bold">{companyProfile.phone}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Mail className="w-3 h-3 text-blue-600 shrink-0" />
                        <span className="text-[9px]">{companyProfile.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Globe className="w-3 h-3 text-blue-600 shrink-0" />
                        <span className="text-[9px] font-mono text-blue-700 font-bold">{companyProfile.website}</span>
                      </div>
                    </div>

                    {/* Emergency Contact */}
                    {employee.emergencyContactMobile && (
                      <div className="bg-red-50/60 rounded-xl p-2 border border-red-200/80 text-[8.5px]">
                        <span className="text-red-700 font-bold uppercase block tracking-wider text-[7.5px]">In Case of Emergency</span>
                        <p className="font-bold text-slate-900 leading-tight">
                          {employee.emergencyContactName || 'Emergency Contact'} ({employee.emergencyContactRelation || 'Relative'})
                        </p>
                        <p className="font-mono font-black text-red-700">{employee.emergencyContactMobile}</p>
                      </div>
                    )}
                  </div>

                  {/* QR Code Verification & Notice Section */}
                  <div className="px-3.5 py-1 text-[8px] text-slate-500 text-center space-y-1">
                    <p className="leading-tight text-slate-600 italic font-medium">
                      "This ID card is the property of {companyProfile.companyName} and must be returned upon cessation of employment."
                    </p>
                    <p className="text-[7.5px] text-slate-400">
                      If found, please return to the company address mentioned above.
                    </p>

                    <div className="pt-1 flex items-center justify-around gap-2">
                      {/* QR Code */}
                      <div className="flex flex-col items-center">
                        {qrDataUrl ? (
                          <img src={qrDataUrl} alt="Verification QR" className="w-14 h-14 rounded-lg border border-slate-200 p-0.5 bg-white" />
                        ) : (
                          <div className="w-14 h-14 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400">
                            QR
                          </div>
                        )}
                        <span className="text-[7px] font-mono font-bold text-slate-400 mt-0.5">SCAN TO VERIFY</span>
                      </div>

                      {/* Authorized Signatory Line */}
                      <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-6 border-b border-slate-400 flex items-center justify-center">
                          <span className="font-serif italic text-[10px] text-slate-700 font-bold">
                            {companyProfile.authorizedSignatoryName || 'D. Sharma'}
                          </span>
                        </div>
                        <span className="text-[7px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                          {companyProfile.authorizedSignatoryDesignation || 'Authorized Signatory'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Strip */}
                  <div 
                    className="p-1.5 text-center text-white text-[7.5px] font-mono font-bold uppercase tracking-wider"
                    style={{ backgroundColor: companyProfile.primaryColor || '#1e40af' }}
                  >
                    REF: {employee.employeeCode} • CONFIDENTIAL INTERNAL BADGE
                  </div>

                </div>
              </div>
            )}

          </div>

          <div className="mt-4 text-center text-slate-400 text-xs print:hidden">
            <p className="font-mono">Tip: Use <strong>Print ID Card</strong> or <strong>Download PDF</strong> for official printing.</p>
          </div>

        </div>

      </div>

      {/* INLINE COMPANY SETTINGS EDIT DRAWER / MODAL */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">Company Profile & ID Branding</h3>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCompanySettings} className="space-y-3.5 mt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={formCompany.companyName}
                  onChange={(e) => setFormCompany(prev => ({ ...prev, companyName: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Company Logo URL</label>
                  <input
                    type="url"
                    value={formCompany.logoUrl || ''}
                    onChange={(e) => setFormCompany(prev => ({ ...prev, logoUrl: e.target.value }))}
                    placeholder="https://..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Company Website</label>
                  <input
                    type="text"
                    value={formCompany.website || ''}
                    onChange={(e) => setFormCompany(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://easydesk.com"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Company Address</label>
                <input
                  type="text"
                  value={formCompany.address || ''}
                  onChange={(e) => setFormCompany(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formCompany.city || ''}
                    onChange={(e) => setFormCompany(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={formCompany.state || ''}
                    onChange={(e) => setFormCompany(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">PIN Code</label>
                  <input
                    type="text"
                    value={formCompany.pinCode || ''}
                    onChange={(e) => setFormCompany(prev => ({ ...prev, pinCode: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={formCompany.phone || ''}
                    onChange={(e) => setFormCompany(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={formCompany.email || ''}
                    onChange={(e) => setFormCompany(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Primary Color (Header)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formCompany.primaryColor || '#1e40af'}
                      onChange={(e) => setFormCompany(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-8 h-8 rounded-lg cursor-pointer border-none"
                    />
                    <input
                      type="text"
                      value={formCompany.primaryColor || '#1e40af'}
                      onChange={(e) => setFormCompany(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-2 py-1 text-xs font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Secondary Color (Footer)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formCompany.secondaryColor || '#0f172a'}
                      onChange={(e) => setFormCompany(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="w-8 h-8 rounded-lg cursor-pointer border-none"
                    />
                    <input
                      type="text"
                      value={formCompany.secondaryColor || '#0f172a'}
                      onChange={(e) => setFormCompany(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-2 py-1 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {savingSettings ? 'Saving...' : 'Save Branding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT-ONLY CSS STYLES INJECTED DYNAMICALLY */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .id-card-print-area, .id-card-print-area * {
            visibility: visible !important;
          }
          .id-card-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            display: flex !important;
            flex-direction: row !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 20px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: auto;
            margin: 10mm;
          }
        }
      `}</style>

    </div>
  );
}
