/**
 * EasyDesk Global Localization, Brand Protection & Content Integrity Engine
 *
 * Implements strict, four-category localization architecture:
 * - Category A: Standard UI & Explanatory Language (Fully Localized via Curated Dictionaries)
 * - Category B: Proper Names & Brands (Strictly Governed, No Phonetic Guesswork)
 * - Category C: Places & Addresses (Established Civic Representations, Street Protection)
 * - Category D: Statutory Identifiers & Financials (100% Translation Immunity)
 *
 * Core Principle: One-Way Data Flow
 * Canonical Content -> Localization Layer -> Display
 * (Underlying database and server states are NEVER mutated by translation).
 */

export type SupportedLanguage = 'en' | 'hi' | 'mr' | 'gu';

// ============================================================================
// 1. BRAND IDENTITIES & PROPER NAMES REGISTRY (Category B)
// ============================================================================

export const PROTECTED_BRAND_NAME = 'EasyDesk';
export const PROTECTED_CORPORATE_NAME = 'EasyDesk Solutions Private Limited';
export const PROTECTED_COMMERCIAL_NAME = 'EasyDesk Digital Services Pvt Ltd';
export const PROTECTED_PORTAL_NAME = 'EasyDesk Digital Service Portal';

export const APPROVED_LOCALIZED_NAMES: Record<string, Partial<Record<SupportedLanguage, string>>> = {
  // Canonical Founder Name: Deep Tirole
  // Hindi localized representation MUST strictly be 'दीप तिरोले'
  // (NEVER 'दीप तिरोल', 'डीप टिरोले', or 'दीप तिरोले́')
  // For Marathi and Gujarati, canonical 'Deep Tirole' is preserved without unverified transliteration.
  'Deep Tirole': {
    en: 'Deep Tirole',
    hi: 'दीप तिरोले',
    mr: 'Deep Tirole',
    gu: 'Deep Tirole'
  },
  'deep tirole': {
    en: 'Deep Tirole',
    hi: 'दीप तिरोले',
    mr: 'Deep Tirole',
    gu: 'Deep Tirole'
  },

  // Protected Brand: EasyDesk
  // Must remain 'EasyDesk' across ALL languages (never ईज़ीडेस्क / ईज़ी डेस्क / Easy Desk)
  'EasyDesk': {
    en: 'EasyDesk',
    hi: 'EasyDesk',
    mr: 'EasyDesk',
    gu: 'EasyDesk'
  },
  'easydesk': {
    en: 'EasyDesk',
    hi: 'EasyDesk',
    mr: 'EasyDesk',
    gu: 'EasyDesk'
  },

  // Corporate Entity Names (Must preserve commercial identity)
  'EasyDesk Solutions Private Limited': {
    en: 'EasyDesk Solutions Private Limited',
    hi: 'EasyDesk Solutions Private Limited',
    mr: 'EasyDesk Solutions Private Limited',
    gu: 'EasyDesk Solutions Private Limited'
  },
  'EasyDesk Digital Services Pvt Ltd': {
    en: 'EasyDesk Digital Services Pvt Ltd',
    hi: 'EasyDesk Digital Services Pvt Ltd',
    mr: 'EasyDesk Digital Services Pvt Ltd',
    gu: 'EasyDesk Digital Services Pvt Ltd'
  },
  'EasyDesk Digital Service Portal': {
    en: 'EasyDesk Digital Service Portal',
    hi: 'EasyDesk Digital Service Portal',
    mr: 'EasyDesk Digital Service Portal',
    gu: 'EasyDesk Digital Service Portal'
  }
};

// ============================================================================
// 2. GEOGRAPHIC & PLACE NAMES REGISTRY (Category C)
// ============================================================================

export const APPROVED_GEOGRAPHIC_NAMES: Record<string, Partial<Record<SupportedLanguage, string>>> = {
  // Cities & Regions
  'Indore': { en: 'Indore', hi: 'इंदौर', mr: 'इंदूर', gu: 'ઈન્દોર' },
  'Bhopal': { en: 'Bhopal', hi: 'भोपाल', mr: 'भोपाळ', gu: 'ભોપાલ' },
  'Noida': { en: 'Noida', hi: 'नोएडा', mr: 'नोएडा', gu: 'નોઇડા' },
  'Delhi NCR': { en: 'Delhi NCR', hi: 'दिल्ली एनसीआर', mr: 'दिल्ली एनसीआर', gu: 'દિલ્હી એનસીઆર' },
  'New Delhi': { en: 'New Delhi', hi: 'नई दिल्ली', mr: 'नवी दिल्ली', gu: 'નવી દિલ્હી' },
  'Delhi': { en: 'Delhi', hi: 'दिल्ली', mr: 'दिल्ली', gu: 'દિલ્હી' },
  'Mumbai': { en: 'Mumbai', hi: 'मुंबई', mr: 'मुंबई', gu: 'મુંબઈ' },
  'Pune': { en: 'Pune', hi: 'पुणे', mr: 'पुणे', gu: 'પુણે' },
  'Nagpur': { en: 'Nagpur', hi: 'नागपुर', mr: 'नागपूर', gu: 'નાગપુર' },
  'Bengaluru': { en: 'Bengaluru', hi: 'बेंगलुरु', mr: 'बंगळुरू', gu: 'બેંગલુરુ' },
  'Mysuru': { en: 'Mysuru', hi: 'मैसूरु', mr: 'म्हैसूर', gu: 'મૈસૂર' },
  'Hyderabad': { en: 'Hyderabad', hi: 'हैदराबाद', mr: 'हैदराबाद', gu: 'હૈદરાબાદ' },
  'Ahmedabad': { en: 'Ahmedabad', hi: 'अहमदाबाद', mr: 'अहमदाबाद', gu: 'અમદાવાદ' },
  'Surat': { en: 'Surat', hi: 'सूरत', mr: 'सुरत', gu: 'સુરત' },
  'Vadodara': { en: 'Vadodara', hi: 'वडोदरा', mr: 'वडोદરા', gu: 'વડોદરા' },
  'Lucknow': { en: 'Lucknow', hi: 'लखनऊ', mr: 'लखनौ', gu: 'લખનઉ' },
  'Kanpur': { en: 'Kanpur', hi: 'कानपुर', mr: 'कानपूर', gu: 'કાનપુર' },
  'Jaipur': { en: 'Jaipur', hi: 'जयपुर', mr: 'जयपूर', gu: 'જયપુર' },
  'Chennai': { en: 'Chennai', hi: 'चेन्नई', mr: 'चेन्नई', gu: 'ચેન્નાઈ' },
  'Coimbatore': { en: 'Coimbatore', hi: 'कोयंबटूर', mr: 'कोइम्बतूर', gu: 'કોઈમ્બતૂર' },
  'Kolkata': { en: 'Kolkata', hi: 'कोलकाता', mr: 'कोलकाता', gu: 'કોલકાતા' },

  // States
  'Indore, Madhya Pradesh': {
    en: 'Indore, Madhya Pradesh',
    hi: 'इंदौर, मध्य प्रदेश',
    mr: 'इंदूर, मध्य प्रदेश',
    gu: 'ઈન્દોર, મધ્ય પ્રદેશ'
  },
  'Madhya Pradesh': { en: 'Madhya Pradesh', hi: 'मध्य प्रदेश', mr: 'मध्य प्रदेश', gu: 'મધ્ય પ્રદેશ' },
  'Maharashtra': { en: 'Maharashtra', hi: 'महाराष्ट्र', mr: 'महाराष्ट्र', gu: 'મહારાષ્ટ્ર' },
  'Gujarat': { en: 'Gujarat', hi: 'गुजरात', mr: 'गुजरात', gu: 'ગુજરાત' },
  'Uttar Pradesh': { en: 'Uttar Pradesh', hi: 'उत्तर प्रदेश', mr: 'उत्तर प्रदेश', gu: 'ઉત્તર પ્રદેશ' },
  'Karnataka': { en: 'Karnataka', hi: 'कर्नाटक', mr: 'कर्नाटक', gu: 'કર્ણાટક' },
  'Rajasthan': { en: 'Rajasthan', hi: 'राजस्थान', mr: 'राजस्थान', gu: 'રાજસ્થાન' },
  'Telangana': { en: 'Telangana', hi: 'तेलंगाना', mr: 'तेलंगणा', gu: 'તેલંગાણા' },
  'Andhra Pradesh': { en: 'Andhra Pradesh', hi: 'आंध्र प्रदेश', mr: 'आंध्र प्रदेश', gu: 'આંધ્ર પ્રદેશ' },
  'Tamil Nadu': { en: 'Tamil Nadu', hi: 'तमिलनाडु', mr: 'तमिळनाडू', gu: 'તમિલનાડુ' },
  'West Bengal': { en: 'West Bengal', hi: 'पश्चिम बंगाल', mr: 'पश्चिम बंगाल', gu: 'પશ્ચિમ બંગાળ' },
  'Pan-India': { en: 'Pan-India', hi: 'अखिल भारतीय', mr: 'अखिल भारतीय', gu: 'સમગ્ર ભારત' },

  // Composite Service Areas
  'National Capital Region (Delhi NCR)': {
    en: 'National Capital Region (Delhi NCR)',
    hi: 'राष्ट्रीय राजधानी क्षेत्र (दिल्ली एनसीआर)',
    mr: 'राष्ट्रीय राजधानी क्षेत्र (दिल्ली एनसीआर)',
    gu: 'રાષ્ટ્રીય રાજધાની ક્ષેત્ર (દિલ્હી એનસીઆર)'
  },
  'Maharashtra (Mumbai, Pune, Nagpur)': {
    en: 'Maharashtra (Mumbai, Pune, Nagpur)',
    hi: 'महाराष्ट्र (मुंबई, पुणे, नागपुर)',
    mr: 'महाराष्ट्र (मुंबई, पुणे, नागपूर)',
    gu: 'મહારાષ્ટ્ર (મુંબઈ, પુણે, નાગપુર)'
  },
  'Karnataka (Bengaluru, Mysuru)': {
    en: 'Karnataka (Bengaluru, Mysuru)',
    hi: 'कर्नाटक (बेंगलुरु, मैसूरु)',
    mr: 'कर्नाटक (बंगळुरू, म्हैसूर)',
    gu: 'કર્ણાટક (બેંગલુરુ, મૈસૂર)'
  },
  'Uttar Pradesh (Noida, Lucknow, Kanpur)': {
    en: 'Uttar Pradesh (Noida, Lucknow, Kanpur)',
    hi: 'उत्तर प्रदेश (नोएडा, लखनऊ, कानपुर)',
    mr: 'उत्तर प्रदेश (नोएडा, लखनौ, कानपूर)',
    gu: 'ઉત્તર પ્રદેશ (નોઇડા, લખનઉ, કાનપુર)'
  },
  'Gujarat (Ahmedabad, Surat, Vadodara)': {
    en: 'Gujarat (Ahmedabad, Surat, Vadodara)',
    hi: 'गुजरात (अहमदाबाद, सूरत, वडोदरा)',
    mr: 'गुजरात (अहमदाबाद, सुरत, वડોદરા)',
    gu: 'ગુજરાત (અમદાવાદ, સુરત, વડોદરા)'
  },
  'Tamil Nadu (Chennai, Coimbatore)': {
    en: 'Tamil Nadu (Chennai, Coimbatore)',
    hi: 'तमिलनाडु (चेन्नई, कोयंबटूर)',
    mr: 'तमिळनाडू (चेन्नई, कोइम्बतूर)',
    gu: 'તમિલનાડુ (ચેન્નાઈ, કોઈમ્બતૂર)'
  },
  'Telangana & Andhra Pradesh': {
    en: 'Telangana & Andhra Pradesh',
    hi: 'तेलंगाना और आंध्र प्रदेश',
    mr: 'तेलंगणा आणि आंध्र प्रदेश',
    gu: 'તેલંગાણા અને આંધ્ર પ્રદેશ'
  },
  'Pan-India E-Governance Support': {
    en: 'Pan-India E-Governance Support',
    hi: 'अखिल भारतीय ई-गवर्नेंस सहायता',
    mr: 'अखिल भारतीय ई-प्रशासन सहाय्य',
    gu: 'સમગ્ર ભારત ઈ-ગવર્નન્સ સપોર્ટ'
  }
};

// ============================================================================
// 3. GOVERNMENT & STATUTORY TERMINOLOGY (Category D)
// ============================================================================

export const APPROVED_GOVERNMENT_TERMS: Record<string, Partial<Record<SupportedLanguage, string>>> = {
  'PAN Card': { en: 'PAN Card', hi: 'पैन कार्ड', mr: 'पॅन कार्ड', gu: 'પાન કાર્ડ' },
  'New PAN Card / Correction': {
    en: 'New PAN Card / Correction',
    hi: 'नया पैन कार्ड / सुधार',
    mr: 'नवीन पॅन कार्ड / दुरुस्ती',
    gu: 'નવું પાન કાર્ડ / સુધારો'
  },
  'Aadhaar Card': { en: 'Aadhaar Card', hi: 'आधार कार्ड', mr: 'आधार कार्ड', gu: 'આધાર કાર્ડ' },
  'Aadhaar Demographics Update': {
    en: 'Aadhaar Demographics Update',
    hi: 'आधार विवरण सुधार / अपडेट',
    mr: 'आधार माहिती सुधारणा / अपडेट',
    gu: 'આધાર વિગતો સુધારો / અપડેટ'
  },
  'Voter ID Card': { en: 'Voter ID Card', hi: 'वोटर आईडी कार्ड', mr: 'मतदार ओळखपत्र', gu: 'મતદાર આઈડી કાર્ડ' },
  'Driving Licence': { en: 'Driving Licence', hi: 'ड्राइविंग लाइसेंस', mr: 'वाहन चालक परवाना', gu: 'ડ્રાઇવિંગ લાયસન્સ' },
  'Fresh / Reissue Passport Assistance': {
    en: 'Fresh / Reissue Passport Assistance',
    hi: 'नया / नवीनीकरण पासपोर्ट सहायता',
    mr: 'नवीन / नूतनीकरण पासपोर्ट सहाय्य',
    gu: 'નવો / રીન્યુ પાસપોર્ટ સહાય'
  },
  'Passport': { en: 'Passport', hi: 'पासपोर्ट', mr: 'पासपोर्ट', gu: 'પાસપોર્ટ' },
  'GST Registration': { en: 'GST Registration', hi: 'जीएसटी पंजीकरण', mr: 'जीएसटी नोंदणी', gu: 'જીએસટી નોંધણી' },
  'New GST Registration': {
    en: 'New GST Registration',
    hi: 'नया जीएसटी पंजीकरण',
    mr: 'नवीन जीएसटी नोंदणी',
    gu: 'નવી જીએસટી નોંધણી'
  },
  'MSME / Udyam Registration': {
    en: 'MSME / Udyam Registration',
    hi: 'एमएसएमई / उद्यम पंजीकरण',
    mr: 'एमएसएमई / उद्यम नोंदणी',
    gu: 'MSME / ઉદ્યમ નોંધણી'
  },
  'National Scholarship Form Filing': {
    en: 'National Scholarship Form Filing',
    hi: 'राष्ट्रीय छात्रवृत्ति फॉर्म आवेदन',
    mr: 'राष्ट्रीय शिष्यवृत्ती अर्ज भरणी',
    gu: 'રાષ્ટ્રીય શિષ્યવૃત્તિ ફોર્મ અરજી'
  },
  'Income Certificate': { en: 'Income Certificate', hi: 'आय प्रमाण पत्र', mr: 'उत्पन्नाचा दाखला', gu: 'આવકનું પ્રમાણપત્ર' },
  'Caste Certificate': { en: 'Caste Certificate', hi: 'जाति प्रमाण पत्र', mr: 'जातीचा दाखला', gu: 'જાતિનું પ્રમાણપત્ર' },
  'Domicile Certificate': { en: 'Domicile Certificate', hi: 'मूल निवास प्रमाण पत्र', mr: 'अधिवास प्रमाणपत्र', gu: 'રહેઠાણનું પ્રમાણપત્ર' },
  'Ration Card': { en: 'Ration Card', hi: 'राशन कार्ड', mr: 'रेशन कार्ड', gu: 'રેશન કાર્ડ' },
  'Ayushman Bharat Card': { en: 'Ayushman Bharat Card', hi: 'आयुष्मान भारत कार्ड', mr: 'आयुष्मान भारत कार्ड', gu: 'આયુષ્માન ભારત કાર્ડ' },
  'EPFO / PF Claim': { en: 'EPFO / PF Claim', hi: 'ईपीएफओ / पीएफ क्लेम', mr: 'ईपीएफओ / पीएफ दावा', gu: 'EPFO / પીએફ ક્લેમ' },
  'Food License (FSSAI)': { en: 'Food License (FSSAI)', hi: 'खाद्य लाइसेंस (FSSAI)', mr: 'अन्न परवाना (FSSAI)', gu: 'ફૂડ લાયસન્સ (FSSAI)' }
};

// ============================================================================
// 3B. ORDER STATUS & TRACKING MILESTONES REGISTRY (Category A / Presentation)
// ============================================================================

export const APPROVED_ORDER_STATUSES: Record<string, Partial<Record<SupportedLanguage, string>>> = {
  'Pending': { en: 'Pending', hi: 'लंबित', mr: 'प्रलंबित', gu: 'બાકી' },
  'Under Verification': { en: 'Under Verification', hi: 'सत्यापनाधीन', mr: 'पडताळणी अंतर्गत', gu: 'ચકાસણી હેઠળ' },
  'Processing': { en: 'Processing', hi: 'प्रक्रिया जारी', mr: 'प्रक्रिया सुरू', gu: 'પ્રક્રિયા ચાલુ' },
  'Completed': { en: 'Completed', hi: 'पूर्ण', mr: 'पूर्ण', gu: 'પૂર્ણ' },
  'Rejected': { en: 'Rejected', hi: 'अस्वीकृत', mr: 'नाकारले', gu: 'અસ્વીકાર્ય' },
  'Documents Required': { en: 'Documents Required', hi: 'दस्तावेज़ आवश्यक', mr: 'कागदपत्रे आवश्यक', gu: 'દસ્તાવેજો જરૂરી' },
  'In Progress': { en: 'In Progress', hi: 'प्रगति पर', mr: 'प्रगतीपथावर', gu: 'પ્રગતિમાં' },
  'Cancelled': { en: 'Cancelled', hi: 'रद्द', mr: 'रद्द', gu: 'રદ' }
};

export const APPROVED_TIMELINE_STEPS: Record<string, Partial<Record<SupportedLanguage, string>>> = {
  'File Checked': { en: 'File Checked', hi: 'फाइल जांच पूर्ण', mr: 'फाईल तपासणी पूर्ण', gu: 'ફાઇલ તપાસી' },
  'Audit Completed': { en: 'Audit Completed', hi: 'ऑडिट पूर्ण', mr: 'ऑडिट पूर्ण', gu: 'ઓડિટ પૂર્ણ' },
  'Submitted to Govt': { en: 'Submitted to Govt', hi: 'विभाग में प्रस्तुत', mr: 'शासनाला सादर', gu: 'સરકારને સબમિટ' },
  'Dispatched Certificate': { en: 'Dispatched Certificate', hi: 'प्रमाणपत्र प्रेषित', mr: 'प्रमाणपत्र पाठवले', gu: 'પ્રમાણપત્ર રવાના' }
};

// ============================================================================
// 4. RESOLUTION & LOCALIZATION FUNCTIONS
// ============================================================================

/**
 * Resolves a proper person name for the specified language.
 *
 * Rules:
 * 1. Data-driven entity localized mapping if present
 * 2. Exact match in approved registry
 * 3. Case-insensitive match in approved registry
 * 4. Default: Canonical original name (NEVER phonetic machine-guessing).
 */
export function localizePersonName(
  canonicalName: string | null | undefined,
  lang: SupportedLanguage = 'en',
  entityLocalizedMap?: Partial<Record<SupportedLanguage, string>> | null
): string {
  if (!canonicalName || typeof canonicalName !== 'string') return '';
  const trimmed = canonicalName.trim();
  if (!trimmed) return '';

  // 1. Data-driven entity mapping
  if (entityLocalizedMap && typeof entityLocalizedMap === 'object' && entityLocalizedMap[lang]) {
    const custom = entityLocalizedMap[lang];
    if (custom && typeof custom === 'string' && custom.trim()) {
      return custom.trim();
    }
  }

  // 2. Exact match in approved registry
  const approvedExact = APPROVED_LOCALIZED_NAMES[trimmed];
  if (approvedExact && approvedExact[lang]) {
    return approvedExact[lang]!;
  }

  // 3. Case-insensitive match
  const lower = trimmed.toLowerCase();
  for (const [key, mapping] of Object.entries(APPROVED_LOCALIZED_NAMES)) {
    if (key.toLowerCase() === lower && mapping[lang]) {
      return mapping[lang]!;
    }
  }

  // 4. Default: Preserve canonical original name as-is
  return trimmed;
}

/**
 * Returns the immutable brand name or registered entity name across languages.
 */
export function localizeBrandName(
  canonicalBrand?: string | null,
  lang: SupportedLanguage = 'en'
): string {
  if (!canonicalBrand || typeof canonicalBrand !== 'string') return PROTECTED_BRAND_NAME;
  const trimmed = canonicalBrand.trim();
  if (!trimmed) return PROTECTED_BRAND_NAME;

  // Check approved registry (exact & case-insensitive)
  const approvedExact = APPROVED_LOCALIZED_NAMES[trimmed];
  if (approvedExact && approvedExact[lang]) {
    return approvedExact[lang]!;
  }
  const lower = trimmed.toLowerCase();
  for (const [key, mapping] of Object.entries(APPROVED_LOCALIZED_NAMES)) {
    if (key.toLowerCase() === lower && mapping[lang]) {
      return mapping[lang]!;
    }
  }

  // If brand name contains EasyDesk, keep it as-is without alteration
  if (lower.includes('easydesk')) {
    return trimmed;
  }

  return PROTECTED_BRAND_NAME;
}

/**
 * Resolves an Indian place or geographic name with approved civic spelling.
 */
export function localizePlaceName(
  canonicalPlace: string | null | undefined,
  lang: SupportedLanguage = 'en'
): string {
  if (!canonicalPlace || typeof canonicalPlace !== 'string') return '';
  const trimmed = canonicalPlace.trim();
  if (!trimmed) return '';

  // Check approved geographic registry
  const approvedExact = APPROVED_GEOGRAPHIC_NAMES[trimmed];
  if (approvedExact && approvedExact[lang]) {
    return approvedExact[lang]!;
  }

  // Check case-insensitive
  const lower = trimmed.toLowerCase();
  for (const [key, mapping] of Object.entries(APPROVED_GEOGRAPHIC_NAMES)) {
    if (key.toLowerCase() === lower && mapping[lang]) {
      return mapping[lang]!;
    }
  }

  // Support composite comma-separated locations (e.g., "Indore, Madhya Pradesh")
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((p) => p.trim());
    const localizedParts = parts.map((p) => localizePlaceName(p, lang));
    return localizedParts.join(', ');
  }

  // Preserve canonical place name without dictionary mangling
  return trimmed;
}

/**
 * Resolves an official government scheme, service or certificate term.
 */
export function localizeGovTerm(
  canonicalTerm: string | null | undefined,
  lang: SupportedLanguage = 'en'
): string {
  if (!canonicalTerm || typeof canonicalTerm !== 'string') return '';
  const trimmed = canonicalTerm.trim();
  if (!trimmed) return '';

  const approved = APPROVED_GOVERNMENT_TERMS[trimmed];
  if (approved && approved[lang]) {
    return approved[lang]!;
  }

  return trimmed;
}

/**
 * Resolves canonical order status enum into presentation-only localized string.
 * Canonical data remains unchanged in underlying database and API models.
 */
export function localizeOrderStatus(
  status: string | null | undefined,
  lang: SupportedLanguage = 'en'
): string {
  if (!status || typeof status !== 'string') return '';
  const trimmed = status.trim();
  if (!trimmed) return '';

  const exact = APPROVED_ORDER_STATUSES[trimmed];
  if (exact && exact[lang]) return exact[lang]!;

  const lower = trimmed.toLowerCase();
  for (const [canonical, map] of Object.entries(APPROVED_ORDER_STATUSES)) {
    if (canonical.toLowerCase() === lower && map[lang]) {
      return map[lang]!;
    }
  }

  return trimmed;
}

/**
 * Resolves timeline milestone descriptions into presentation-only localized string.
 */
export function localizeTimelineStep(
  step: string | null | undefined,
  lang: SupportedLanguage = 'en'
): string {
  if (!step || typeof step !== 'string') return '';
  const trimmed = step.trim();
  if (!trimmed) return '';

  const exact = APPROVED_TIMELINE_STEPS[trimmed];
  if (exact && exact[lang]) return exact[lang]!;

  return trimmed;
}

/**
 * Normalizes Indic numerals (Devanagari U+0966-U+096F, Gujarati U+0AE6-U+0AEF)
 * to standard ASCII Arabic numerals (0-9).
 */
export function normalizeIndicDigits(str: string | null | undefined): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/[\u0966-\u096F]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0966 + 48))
    .replace(/[\u0AE6-\u0AEF]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0AE6 + 48));
}

// ============================================================================
// 5. STATUTORY IDENTIFIER & TECHNICAL IMMUNITY (Category D)
// ============================================================================

/**
 * Checks whether a given string is a sensitive statutory code, identifier,
 * currency, contact info, or URL that must NEVER be translated.
 */
export function isProtectedIdentifier(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();

  // Order ID (e.g. ORD-123456)
  if (/^ORD-[A-Z0-9_-]+$/i.test(trimmed)) return true;
  // Tracking ID (e.g. TRK-123456)
  if (/^TRK-[A-Z0-9_-]+$/i.test(trimmed)) return true;
  // Employee ID (e.g. EMP-1234)
  if (/^EMP-[A-Z0-9_-]+$/i.test(trimmed)) return true;
  // Customer ID (e.g. CUST-1234)
  if (/^CUST-[A-Z0-9_-]+$/i.test(trimmed)) return true;
  // Service ID (e.g. SRV-PAN-001 or standard service IDs)
  if (/^(SRV-)?[a-z0-9-]+$/i.test(trimmed) && (trimmed.startsWith('SRV-') || trimmed.startsWith('service-test-') || ['pan', 'aadhaar-update', 'passport', 'gst-reg', 'msme', 'scholarship', 'resume', 'web-dev'].includes(trimmed))) return true;
  // Review ID (e.g. REV-123456)
  if (/^REV-[A-Z0-9_-]+$/i.test(trimmed)) return true;
  // PAN format: 5 letters, 4 digits, 1 letter
  if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(trimmed)) return true;
  // Aadhaar format: 12 digits (with or without spaces)
  if (/^[0-9]{4}\s?[0-9]{4}\s?[0-9]{4}$/.test(trimmed)) return true;
  // GSTIN format: 2 digits, 5 letters, 4 digits, 1 letter, 1 digit/letter, Z, 1 digit/letter
  if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(trimmed)) return true;
  // IFSC code: 4 letters, 0, 6 alphanumeric
  if (/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(trimmed)) return true;
  // UPI ID: username@bank
  if (/^[\w.-]+@[\w.-]+$/.test(trimmed)) return true;
  // UTR transaction number
  if (/^(UTR)?[0-9]{10,22}$/i.test(trimmed)) return true;
  // CIN (Corporate Identity Number)
  if (/^[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/i.test(trimmed)) return true;
  // ISO certification codes
  if (/^ISO\s?[0-9]{4,5}(:[0-9]{4})?$/i.test(trimmed)) return true;
  // PIN code (6 digits Indian postal code)
  if (/^[1-9][0-9]{5}$/.test(trimmed)) return true;
  // Currency Amount (e.g. ₹500, ₹ 1,200)
  if (/^₹\s?[0-9,]+(\.[0-9]{2})?$/.test(trimmed)) return true;
  // Email address
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) return true;
  // Phone number (e.g. +91 98765 43210 or 9876543210)
  if (/^(\+91[\s-]?)?[0-9\s-]{10,15}$/.test(trimmed)) return true;
  // Route / URL path
  if (/^\/[a-zA-Z0-9_/-]+$/.test(trimmed)) return true;

  return false;
}

// ============================================================================
// 6. FORBIDDEN TRANSLITERATION INTERCEPTORS & SANITIZER
// ============================================================================

export const FORBIDDEN_TRANSLITERATION_PATTERNS: Array<{
  pattern: RegExp;
  replacement: (lang: SupportedLanguage) => string;
}> = [
  // Founder Name corruptions:
  // Must strictly be 'दीप तिरोले' in Hindi, and 'Deep Tirole' in others
  {
    pattern: /दीप\s*तिरोल(?!े)/g,
    replacement: (lang) => (lang === 'hi' ? 'दीप तिरोले' : 'Deep Tirole')
  },
  {
    pattern: /डीप\s*टिरोले/g,
    replacement: (lang) => (lang === 'hi' ? 'दीप तिरोले' : 'Deep Tirole')
  },
  {
    pattern: /दीप\s*तिरोले́/g,
    replacement: (lang) => (lang === 'hi' ? 'दीप तिरोले' : 'Deep Tirole')
  },
  {
    pattern: /गहरा\s*तिरोल/g,
    replacement: (lang) => (lang === 'hi' ? 'दीप तिरोले' : 'Deep Tirole')
  },

  // Brand Name corruptions: Must ALWAYS remain 'EasyDesk'
  {
    pattern: /ईज़ीडेस्क/gi,
    replacement: () => 'EasyDesk'
  },
  {
    pattern: /ईज़ी\s*डेस्क/gi,
    replacement: () => 'EasyDesk'
  },
  {
    pattern: /इजी\s*डेस्क/gi,
    replacement: () => 'EasyDesk'
  },
  {
    pattern: /इजीडेस्क/gi,
    replacement: () => 'EasyDesk'
  },
  {
    pattern: /Easy\s+Desk/g,
    replacement: () => 'EasyDesk'
  },

  // Corporate Legal Name Corruptions
  {
    pattern: /ईज़ीडेस्क\s*सॉल्यूशंस\s*प्राइवेट\s*लिमिटेड/gi,
    replacement: () => 'EasyDesk Solutions Private Limited'
  },
  {
    pattern: /सरल\s*डेस्क\s*समाधान\s*निजी\s*सीमित/gi,
    replacement: () => 'EasyDesk Solutions Private Limited'
  },

  // Street Name & Building Corruptions (Address preservation)
  {
    pattern: /नागरिक\s*रेखाएं/gi,
    replacement: () => 'Civil Lines'
  },
  {
    pattern: /न्यायालय\s*सड़क/gi,
    replacement: () => 'Court Road'
  }
];

/**
 * Sanitizes a text string by actively intercepting and correcting any known
 * machine-transliteration corruptions.
 */
export function sanitizeProtectedNamesInText(
  text: string,
  targetLang: SupportedLanguage = 'en'
): string {
  if (!text || typeof text !== 'string') return text;
  let sanitized = text;

  for (const rule of FORBIDDEN_TRANSLITERATION_PATTERNS) {
    sanitized = sanitized.replace(rule.pattern, () => rule.replacement(targetLang));
  }

  return sanitized;
}
