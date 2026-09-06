import React, { useState, useEffect, useMemo } from 'react';
import { 
  INDIAN_STATES_AND_UTS, 
  getDistrictsForState, 
  isValidIndianPinCode, 
  formatStructuredAddress,
  normalizeIndianState
} from '../../lib/indiaAddressData.js';
import { MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface IndianAddressValue {
  country?: string;
  state?: string;
  district?: string;
  city?: string;
  addressLine1?: string;
  addressLine2?: string;
  locality?: string;
  landmark?: string;
  pincode?: string;
  pinCode?: string;
  address?: string;
}

export interface IndianAddressFieldsProps {
  value: IndianAddressValue;
  onChange: (updated: IndianAddressValue) => void;
  required?: boolean;
  disabled?: boolean;
  compact?: boolean;
  labelPrefix?: string;
  showLandmark?: boolean;
  showLocality?: boolean;
}

export default function IndianAddressFields({
  value,
  onChange,
  required = false,
  disabled = false,
  compact = false,
  labelPrefix = '',
  showLandmark = true,
  showLocality = false
}: IndianAddressFieldsProps) {
  // Extract normalized state
  const rawState = value.state || '';
  const normalizedState = useMemo(() => normalizeIndianState(rawState) || rawState, [rawState]);

  // Available districts for the current state
  const availableDistricts = useMemo(() => {
    return getDistrictsForState(normalizedState);
  }, [normalizedState]);

  const [isManualDistrict, setIsManualDistrict] = useState(false);

  // If the current district is not in the district list and is non-empty, allow manual mode
  useEffect(() => {
    if (value.district && availableDistricts.length > 0 && !availableDistricts.includes(value.district)) {
      setIsManualDistrict(true);
    }
  }, [value.district, availableDistricts]);

  // PIN code validation
  const currentPin = (value.pincode || value.pinCode || '').trim();
  const isPinValid = currentPin ? isValidIndianPinCode(currentPin) : !required;
  const isPinTouched = currentPin.length > 0;

  // Propagate changes with structured & legacy address synchronizations
  const handleChange = (field: keyof IndianAddressValue, val: string) => {
    const updated: IndianAddressValue = {
      ...value,
      country: value.country || 'India',
      [field]: val
    };

    // Keep pincode and pinCode in sync
    if (field === 'pincode' || field === 'pinCode') {
      const cleanDigits = val.replace(/\D/g, '').slice(0, 6);
      updated.pincode = cleanDigits;
      updated.pinCode = cleanDigits;
    }

    // If state changes, adjust district if invalid
    if (field === 'state') {
      const newDistricts = getDistrictsForState(val);
      if (updated.district && !newDistricts.includes(updated.district)) {
        updated.district = '';
      }
      setIsManualDistrict(false);
    }

    // Auto-compute formatted legacy address
    updated.address = formatStructuredAddress(updated);

    onChange(updated);
  };

  const inputPaddingClass = compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs';
  const labelClass = 'font-bold text-slate-700 block mb-1 text-xs';

  return (
    <div className="space-y-3">
      {/* Row 1: Country & State */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>
            {labelPrefix}Country {required && <span className="text-red-500">*</span>}
          </label>
          <select
            value={value.country || 'India'}
            onChange={(e) => handleChange('country', e.target.value)}
            disabled={disabled}
            className={`w-full border border-slate-200 rounded-xl ${inputPaddingClass} focus:outline-none focus:border-blue-600 bg-slate-50 cursor-pointer text-slate-800 font-medium`}
          >
            <option value="India">India</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>
            {labelPrefix}State / Union Territory {required && <span className="text-red-500">*</span>}
          </label>
          <select
            value={normalizedState}
            onChange={(e) => handleChange('state', e.target.value)}
            disabled={disabled}
            required={required}
            className={`w-full border border-slate-200 rounded-xl ${inputPaddingClass} focus:outline-none focus:border-blue-600 bg-white cursor-pointer text-slate-800 font-medium`}
          >
            <option value="">-- Select State / UT --</option>
            <optgroup label="States (28)">
              {INDIAN_STATES_AND_UTS.filter(s => s.type === 'STATE').map(s => (
                <option key={s.code} value={s.name}>
                  {s.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Union Territories (8)">
              {INDIAN_STATES_AND_UTS.filter(s => s.type === 'UT').map(s => (
                <option key={s.code} value={s.name}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {/* Row 2: District, City, PIN Code */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* District */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-bold text-slate-700 text-xs">
              District
            </label>
            {availableDistricts.length > 0 && (
              <button
                type="button"
                onClick={() => setIsManualDistrict(!isManualDistrict)}
                className="text-[10px] text-blue-600 hover:underline cursor-pointer"
              >
                {isManualDistrict ? 'Choose from list' : 'Enter other'}
              </button>
            )}
          </div>

          {availableDistricts.length > 0 && !isManualDistrict ? (
            <select
              value={value.district || ''}
              onChange={(e) => handleChange('district', e.target.value)}
              disabled={disabled || !normalizedState}
              className={`w-full border border-slate-200 rounded-xl ${inputPaddingClass} focus:outline-none focus:border-blue-600 bg-white cursor-pointer text-slate-800`}
            >
              <option value="">{normalizedState ? '-- Select District --' : '-- Select State First --'}</option>
              {availableDistricts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={value.district || ''}
              onChange={(e) => handleChange('district', e.target.value)}
              placeholder={normalizedState ? "e.g. Indore" : "Enter District"}
              disabled={disabled}
              className={`w-full border border-slate-200 rounded-xl ${inputPaddingClass} focus:outline-none focus:border-blue-600 bg-white`}
            />
          )}
        </div>

        {/* City / Town / Village */}
        <div>
          <label className={labelClass}>
            City / Town / Village {required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            value={value.city || ''}
            onChange={(e) => handleChange('city', e.target.value)}
            placeholder="e.g. Indore, Bandra West"
            disabled={disabled}
            required={required}
            className={`w-full border border-slate-200 rounded-xl ${inputPaddingClass} focus:outline-none focus:border-blue-600 bg-white`}
          />
        </div>

        {/* PIN Code */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-bold text-slate-700 text-xs">
              PIN Code {required && <span className="text-red-500">*</span>}
            </label>
            {isPinTouched && (
              <span className={`text-[10px] font-bold flex items-center gap-1 ${isPinValid ? 'text-emerald-600' : 'text-red-500'}`}>
                {isPinValid ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" /> Valid PIN
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3" /> 6 Digits
                  </>
                )}
              </span>
            )}
          </div>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={currentPin}
            onChange={(e) => handleChange('pincode', e.target.value)}
            placeholder="e.g. 452001"
            disabled={disabled}
            required={required}
            className={`w-full border rounded-xl ${inputPaddingClass} font-mono focus:outline-none bg-white ${
              isPinTouched && !isPinValid 
                ? 'border-red-400 focus:border-red-500 ring-1 ring-red-200' 
                : 'border-slate-200 focus:border-blue-600'
            }`}
          />
        </div>
      </div>

      {/* Row 3: Address Line 1 */}
      <div>
        <label className={labelClass}>
          Address Line 1 (Flat, House / Shop No., Building, Street) {required && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          value={value.addressLine1 || value.address || ''}
          onChange={(e) => handleChange('addressLine1', e.target.value)}
          placeholder="e.g. Flat 302, Sai Residency, MG Road"
          disabled={disabled}
          required={required}
          className={`w-full border border-slate-200 rounded-xl ${inputPaddingClass} focus:outline-none focus:border-blue-600 bg-white`}
        />
      </div>

      {/* Row 4: Address Line 2 & Optional Landmark */}
      <div className={`grid grid-cols-1 ${showLandmark || showLocality ? 'sm:grid-cols-2' : ''} gap-3`}>
        <div>
          <label className={labelClass}>
            Address Line 2 (Area / Locality / Sector)
          </label>
          <input
            type="text"
            value={value.addressLine2 || value.locality || ''}
            onChange={(e) => handleChange('addressLine2', e.target.value)}
            placeholder="e.g. Vijay Nagar, Sector 4"
            disabled={disabled}
            className={`w-full border border-slate-200 rounded-xl ${inputPaddingClass} focus:outline-none focus:border-blue-600 bg-white`}
          />
        </div>

        {showLandmark && (
          <div>
            <label className={labelClass}>
              Nearby Landmark (Optional)
            </label>
            <input
              type="text"
              value={value.landmark || ''}
              onChange={(e) => handleChange('landmark', e.target.value)}
              placeholder="e.g. Opposite City Hospital"
              disabled={disabled}
              className={`w-full border border-slate-200 rounded-xl ${inputPaddingClass} focus:outline-none focus:border-blue-600 bg-white`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
