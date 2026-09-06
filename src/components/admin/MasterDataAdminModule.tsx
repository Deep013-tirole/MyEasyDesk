import React, { useState, useEffect } from 'react';
import { Database, Plus, Trash2, Building, Briefcase, MapPin, CheckCircle2, FileText, Landmark, RefreshCw } from 'lucide-react';
import { MasterData } from '../../types.js';
import { useScrollToTopOnChange } from '../../lib/scrollUtils.js';

interface MasterDataAdminModuleProps {
  adminFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  triggerAlert: (msg: string) => void;
}

export default function MasterDataAdminModule({ adminFetch, triggerAlert }: MasterDataAdminModuleProps) {
  const [loading, setLoading] = useState(true);
  const [masterData, setMasterData] = useState<MasterData>({
    departments: [],
    designations: [],
    employmentTypes: [],
    workLocations: [],
    employeeStatuses: [],
    documentTypes: [],
    banks: []
  });

  const [activeTab, setActiveTab] = useState<'departments' | 'designations' | 'employmentTypes' | 'workLocations' | 'employeeStatuses' | 'documentTypes' | 'banks'>('departments');
  const [newItemText, setNewItemText] = useState('');

  // Reset scroll to top on master data tab change
  useScrollToTopOnChange([activeTab]);

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/master-data');
      if (res.ok) {
        const data = await res.json();
        setMasterData({
          departments: Array.isArray(data.departments) ? data.departments : [],
          designations: Array.isArray(data.designations) ? data.designations : [],
          employmentTypes: Array.isArray(data.employmentTypes) ? data.employmentTypes : [],
          workLocations: Array.isArray(data.workLocations) ? data.workLocations : [],
          employeeStatuses: Array.isArray(data.employeeStatuses) ? data.employeeStatuses : [],
          documentTypes: Array.isArray(data.documentTypes) ? data.documentTypes : [],
          banks: Array.isArray(data.banks) ? data.banks : []
        });
      }
    } catch (err) {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        console.warn('Error loading master data:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  const handleAddItem = async () => {
    const trimmed = newItemText.trim();
    if (!trimmed) return;

    const currentList = (masterData[activeTab] || []) as string[];
    if (currentList.includes(trimmed)) {
      alert(`"${trimmed}" is already in the list.`);
      return;
    }

    const updatedList = [...currentList, trimmed];
    const updatedMasterData = {
      ...masterData,
      [activeTab]: updatedList
    };

    try {
      const res = await adminFetch('/api/admin/master-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departments: updatedMasterData.departments,
          designations: updatedMasterData.designations,
          employmentTypes: updatedMasterData.employmentTypes,
          workLocations: updatedMasterData.workLocations,
          employeeStatuses: updatedMasterData.employeeStatuses,
          documentTypes: updatedMasterData.documentTypes,
          banks: updatedMasterData.banks,
        })
      });

      if (res.ok) {
        setMasterData(updatedMasterData);
        setNewItemText('');
        triggerAlert(`Added "${trimmed}" to ${activeTab}.`);
      } else {
        alert('Failed to update Master Data.');
      }
    } catch (err) {
      alert('Network error updating Master Data.');
    }
  };

  const handleRemoveItem = async (itemToRemove: string) => {
    const currentList = (masterData[activeTab] || []) as string[];
    const updatedList = currentList.filter(item => item !== itemToRemove);
    const updatedMasterData = {
      ...masterData,
      [activeTab]: updatedList
    };

    try {
      const res = await adminFetch('/api/admin/master-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departments: updatedMasterData.departments,
          designations: updatedMasterData.designations,
          employmentTypes: updatedMasterData.employmentTypes,
          workLocations: updatedMasterData.workLocations,
          employeeStatuses: updatedMasterData.employeeStatuses,
          documentTypes: updatedMasterData.documentTypes,
          banks: updatedMasterData.banks,
        })
      });

      if (res.ok) {
        setMasterData(updatedMasterData);
        triggerAlert(`Removed "${itemToRemove}".`);
      } else {
        triggerAlert('Failed to remove item.');
      }
    } catch (err) {
      triggerAlert('Error saving Master Data.');
    }
  };

  const tabsConfig = [
    { key: 'departments', label: 'Departments', icon: Building, desc: 'Company organizational departments' },
    { key: 'designations', label: 'Designations', icon: Briefcase, desc: 'Employee job titles and roles' },
    { key: 'employmentTypes', label: 'Employment Types', icon: CheckCircle2, desc: 'Full-Time, Contract, Trainee' },
    { key: 'workLocations', label: 'Work Locations', icon: MapPin, desc: 'Offices, Tech Hubs, Remote' },
    { key: 'employeeStatuses', label: 'Statuses', icon: RefreshCw, desc: 'Active, On Leave, Suspended' },
    { key: 'documentTypes', label: 'Document Types', icon: FileText, desc: 'KYC & HR Document classifications' },
    { key: 'banks', label: 'Supported Banks', icon: Landmark, desc: 'Pre-approved banking institutions' },
  ] as const;

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-400 text-xs font-sans flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
        <span>Loading Master Data Taxonomies...</span>
      </div>
    );
  }

  const currentList = (masterData[activeTab] || []) as string[];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
              System Configuration
            </span>
            <span className="text-slate-400 text-xs">• Master Taxonomies</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1">Master Data Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage system dropdown values, departments, designations, work locations, document types, and banks.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-2 shadow-sm flex md:flex-col overflow-x-auto md:overflow-x-visible gap-1.5 md:space-y-1 scrollbar-none">
          {tabsConfig.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`text-left p-2.5 md:p-3 rounded-xl transition flex items-center justify-between cursor-pointer shrink-0 md:shrink md:w-full whitespace-nowrap ${
                  isActive ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-700 hover:bg-slate-50 font-medium'
                }`}
              >
                <div className="flex items-center gap-2.5 text-xs">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <div>
                    <p className="leading-tight">{tab.label}</p>
                    <span className={`text-[9px] ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                      {((masterData[tab.key as keyof MasterData] || []) as string[]).length} items
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Content Pane */}
        <div className="md:col-span-3 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Manage {tabsConfig.find(t => t.key === activeTab)?.label}
              </h3>
              <p className="text-xs text-slate-500">
                {tabsConfig.find(t => t.key === activeTab)?.desc}
              </p>
            </div>
          </div>

          {/* Add New Item Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              placeholder={`Enter new ${tabsConfig.find(t => t.key === activeTab)?.label.toLowerCase()} name...`}
              className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-blue-600"
            />
            <button
              onClick={handleAddItem}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>

          {/* Current Master Items List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Current Options ({currentList.length})
            </h4>

            {currentList.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-4 text-center border border-dashed rounded-xl">
                No items defined in this category yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentList.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/60 transition text-xs font-medium text-slate-800"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemoveItem(item); }}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      title="Remove from Master Data"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
