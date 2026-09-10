/**
 * Automated Verification Suite for:
 * EASYDESK — FINAL FIX: RESPONSIVE NAVIGATION + SAFE TRANSLATION + PROPER-NAME HANDLING
 *
 * Covers all 20 required tests:
 * Test 1: Mobile Header Search Icon Presence
 * Test 2: Mobile Header Language Selector Presence
 * Test 3: Mobile Header Hamburger Presence
 * Test 4: Mobile Header Brand Presence ("EasyDesk" text/logo)
 * Test 5: Hamburger Toggle Opens Navigation Drawer
 * Test 6: Drawer contains all required navigation links (Home, Services, Blogs, Track, Payment, About, Contact, Privacy)
 * Test 7: Mobile Bottom Nav 5 items check: Home, Services, Blogs, Track, Desk
 * Test 8: Mobile Bottom Nav routes intact (/services, /blogs, /track-order)
 * Test 9: Brand name "EasyDesk" strictly preserved in English
 * Test 10: Brand name "EasyDesk" strictly preserved in Hindi (never ईज़ीडेस्क / ईज़ी डेस्क / इजी डेस्क)
 * Test 11: Brand name "EasyDesk" strictly preserved in Marathi
 * Test 12: Brand name "EasyDesk" strictly preserved in Gujarati
 * Test 13: Founder name in English = "Deep Tirole"
 * Test 14: Founder name in Hindi = strictly "दीप तिरोले" (never दीप तिरोल / डीप टिरोले)
 * Test 15: Founder name in Marathi = "Deep Tirole"
 * Test 16: Founder name in Gujarati = "Deep Tirole"
 * Test 17: Machine translation corruption protection (DOM sanitizer / forbidden transliteration pattern check)
 * Test 18: Identifier translation immunity check (Order IDs, PAN, Aadhaar, GSTIN, UPI, IFSC, UTR)
 * Test 19: Repeated language switch stability (en -> hi -> en -> hi -> mr -> gu -> en)
 * Test 20: Database integrity verification (db_store.json canonical fields untouched by translations)
 */

const fs = require('fs');
const path = require('path');

const ROOT = 'c:/Users/dell/Downloads/EasyDesk';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const results = [];

function assert(condition, testNum, testName, detail = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    results.push({ num: testNum, name: testName, status: 'PASS', detail });
    console.log(`  [PASS] Test ${testNum}: ${testName} ${detail ? '(' + detail + ')' : ''}`);
  } else {
    failedTests++;
    results.push({ num: testNum, name: testName, status: 'FAIL', detail });
    console.error(`  [FAIL] Test ${testNum}: ${testName} - FAILED: ${detail}`);
  }
}

console.log('================================================================');
console.log('EASYDESK - RESPONSIVE NAV & SAFE TRANSLATION 20-POINT TEST SUITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// Read Source Files for Analysis
// -------------------------------------------------------------
const headerCode = fs.readFileSync(path.join(ROOT, 'src/components/Header.tsx'), 'utf8');
const bottomNavCode = fs.readFileSync(path.join(ROOT, 'src/components/MobileBottomNav.tsx'), 'utf8');
const langContextCode = fs.readFileSync(path.join(ROOT, 'src/context/LanguageContext.tsx'), 'utf8');
const nameLocCode = fs.readFileSync(path.join(ROOT, 'src/lib/nameLocalization.ts'), 'utf8');
const aboutUsCode = fs.readFileSync(path.join(ROOT, 'src/components/AboutUsView.tsx'), 'utf8');
const dbStore = JSON.parse(fs.readFileSync(path.join(ROOT, 'db_store.json'), 'utf8'));

// -------------------------------------------------------------
// PART 1: MOBILE HEADER NAVIGATION TESTS (Tests 1 - 6)
// -------------------------------------------------------------
console.log('--- PART 1: Mobile Header Navigation Tests ---');

// Test 1: Mobile Header Search Icon Presence
const hasSearchButton = headerCode.includes('btn-header-search') && headerCode.includes('handleTriggerSearch');
assert(hasSearchButton, 1, 'Mobile Header Search Icon Presence', 'Search button with ID btn-header-search exists in Header');

// Test 2: Mobile Header Language Selector Presence
const hasLanguageSelector = headerCode.includes('<LanguageSwitcher') && headerCode.includes('LanguageSwitcher');
assert(hasLanguageSelector, 2, 'Mobile Header Language Selector Presence', 'LanguageSwitcher rendered in right action bar');

// Test 3: Mobile Header Hamburger Presence
const hasHamburger = headerCode.includes('btn-mobile-hamburger') && headerCode.includes('setMobileMenuOpen(!mobileMenuOpen)');
assert(hasHamburger, 3, 'Mobile Header Hamburger Presence', 'Hamburger toggle with ID btn-mobile-hamburger and state toggle exists');

// Test 4: Mobile Header Brand Presence ("EasyDesk" text/logo)
const hasBrandPresence = headerCode.includes('EasyDesk') && headerCode.includes('notranslate') && headerCode.includes('translate="no"');
assert(hasBrandPresence, 4, 'Mobile Header Brand Presence', 'Brand logo with EasyDesk text guarded with notranslate/translate="no"');

// Test 5: Hamburger Toggle Opens Navigation Drawer
const hasMobileDrawer = headerCode.includes('mobileMenuOpen && (') && headerCode.includes('xl:hidden bg-white border-b');
assert(hasMobileDrawer, 5, 'Hamburger Toggle Opens Navigation Drawer', 'Conditional drawer rendering on mobileMenuOpen state present');

// Test 6: Drawer contains all required navigation links
const requiredLinks = ['home', 'services', 'blogs', 'track', 'payment', 'about', 'contact', 'privacy-security'];
const hasAllRequiredLinks = requiredLinks.every(link => headerCode.includes(`id: '${link}'`));
assert(hasAllRequiredLinks, 6, 'Drawer Contains All Required Navigation Links', `All 8 required links present: ${requiredLinks.join(', ')}`);

// -------------------------------------------------------------
// PART 2: MOBILE BOTTOM NAVIGATION TESTS (Tests 7 - 8)
// -------------------------------------------------------------
console.log('\n--- PART 2: Mobile Bottom Navigation Tests ---');

// Test 7: Mobile Bottom Nav 5 items check: Home, Services, Blogs, Track, Desk
const hasGridCols5 = bottomNavCode.includes('grid-cols-5');
const bottomNavItems = ['home', 'services', 'blogs', 'track', 'desk'];
const hasAll5Items = bottomNavItems.every(id => bottomNavCode.includes(`id: '${id}'`));
assert(hasGridCols5 && hasAll5Items, 7, 'Mobile Bottom Nav 5 items check', `5 items found (${bottomNavItems.join(' | ')}) with grid-cols-5 layout`);

// Test 8: Mobile Bottom Nav routes intact (/services, /blogs, /track-order)
const hasServicesRoute = bottomNavCode.includes("setView('services')") && bottomNavCode.includes('service-details');
const hasBlogsRoute = bottomNavCode.includes("setView('blogs')") && bottomNavCode.includes('blog-details');
const hasTrackRoute = bottomNavCode.includes("setView('track')") && bottomNavCode.includes('track-order');
const hasDeskAction = bottomNavCode.includes('easydesk-open-desk-assistant') && bottomNavCode.includes('openGeneralWhatsApp');
assert(hasServicesRoute && hasBlogsRoute && hasTrackRoute && hasDeskAction, 8, 'Mobile Bottom Nav routes intact', 'Services, Blogs, Track-order, and Desk actions preserved');

// -------------------------------------------------------------
// PART 3: BRAND NAME TRANSLATION IMMUNITY (Tests 9 - 12)
// -------------------------------------------------------------
console.log('\n--- PART 3: Brand Name Translation Immunity Tests ---');

// Dynamically evaluate nameLocalization functions in Node via esbuild
const esbuild = require('esbuild');
const compiled = esbuild.transformSync(nameLocCode, { loader: 'ts', format: 'cjs' }).code;
const nameLocFn = new Function('exports', 'module', compiled + '\nreturn module.exports;');
const nameLocModule = { exports: {} };
nameLocFn(nameLocModule.exports, nameLocModule);

const { localizeBrandName, localizePersonName, sanitizeProtectedNamesInText, isProtectedIdentifier, APPROVED_LOCALIZED_NAMES } = nameLocModule.exports;

// Test 9: Brand name "EasyDesk" strictly preserved in English
const brandEn = localizeBrandName('EasyDesk', 'en');
assert(brandEn === 'EasyDesk', 9, 'Brand name preserved in English', `Expected 'EasyDesk', got '${brandEn}'`);

// Test 10: Brand name "EasyDesk" strictly preserved in Hindi (never ईज़ीडेस्क / ईज़ी डेस्क / इजी डेस्क)
const brandHi = localizeBrandName('EasyDesk', 'hi');
const isHindiBrandSafe = brandHi === 'EasyDesk' && !['ईज़ीडेस्क', 'ईज़ी डेस्क', 'इजी डेस्क'].includes(brandHi);
assert(isHindiBrandSafe, 10, 'Brand name preserved in Hindi (never transliterated)', `Expected 'EasyDesk', got '${brandHi}'`);

// Test 11: Brand name "EasyDesk" strictly preserved in Marathi
const brandMr = localizeBrandName('EasyDesk', 'mr');
assert(brandMr === 'EasyDesk', 11, 'Brand name preserved in Marathi', `Expected 'EasyDesk', got '${brandMr}'`);

// Test 12: Brand name "EasyDesk" strictly preserved in Gujarati
const brandGu = localizeBrandName('EasyDesk', 'gu');
assert(brandGu === 'EasyDesk', 12, 'Brand name preserved in Gujarati', `Expected 'EasyDesk', got '${brandGu}'`);

// -------------------------------------------------------------
// PART 4: FOUNDER NAME HANDLING (Tests 13 - 16)
// -------------------------------------------------------------
console.log('\n--- PART 4: Founder Name Handling Tests ---');

// Test 13: Founder name in English = "Deep Tirole"
const founderEn = localizePersonName('Deep Tirole', 'en');
assert(founderEn === 'Deep Tirole', 13, 'Founder name in English = Deep Tirole', `Expected 'Deep Tirole', got '${founderEn}'`);

// Test 14: Founder name in Hindi = strictly "दीप तिरोले" (never दीप तिरोल / डीप टिरोले)
const founderHi = localizePersonName('Deep Tirole', 'hi');
const isFounderHindiStrict = founderHi === 'दीप तिरोले';
assert(isFounderHindiStrict, 14, 'Founder name in Hindi = strictly दीप तिरोले', `Expected 'दीप तिरोले', got '${founderHi}'`);

// Test 15: Founder name in Marathi = "Deep Tirole" (no unapproved phonetic transliterations)
const founderMr = localizePersonName('Deep Tirole', 'mr');
assert(founderMr === 'Deep Tirole', 15, 'Founder name in Marathi = Deep Tirole', `Expected 'Deep Tirole', got '${founderMr}'`);

// Test 16: Founder name in Gujarati = "Deep Tirole" (no unapproved phonetic transliterations)
const founderGu = localizePersonName('Deep Tirole', 'gu');
assert(founderGu === 'Deep Tirole', 16, 'Founder name in Gujarati = Deep Tirole', `Expected 'Deep Tirole', got '${founderGu}'`);

// -------------------------------------------------------------
// PART 5: SECURITY & CORRUPTION PROTECTION (Tests 17 - 20)
// -------------------------------------------------------------
console.log('\n--- PART 5: Security & Corruption Protection Tests ---');

// Test 17: Machine translation corruption protection (DOM sanitizer / forbidden transliteration pattern check)
const testCorruptedTextHindi = 'हम ईज़ीडेस्क पर दीप तिरोल और डीप टिरोले से मिले। इजी डेस्क सर्वश्रेष्ठ है।';
const sanitizedHindi = sanitizeProtectedNamesInText(testCorruptedTextHindi, 'hi');
const noForbiddenInHindi = !sanitizedHindi.includes('ईज़ीडेस्क') &&
                           !sanitizedHindi.includes('इजी डेस्क') &&
                           !/दीप\s*तिरोल(?!े)/.test(sanitizedHindi) &&
                           !sanitizedHindi.includes('डीप टिरोले') &&
                           sanitizedHindi.includes('EasyDesk') &&
                           sanitizedHindi.includes('दीप तिरोले');
assert(noForbiddenInHindi, 17, 'Machine translation corruption protection', `Corrupted text restored safely: "${sanitizedHindi}"`);

// Test 18: Identifier translation immunity check (Order IDs, PAN, Aadhaar, GSTIN, UPI, IFSC, UTR)
const sampleIdentifiers = [
  'ORD-2026-0312-9842',
  'TRK-987654321',
  'ABCDE1234F',
  '27ABCDE1234F1Z5',
  'HDFC0001234',
  'easydesk@okhdfcbank',
  'UTR123456789012',
  'user@easydesk.in',
  '+91 98765 43210'
];
const allIdentProtected = sampleIdentifiers.every(id => isProtectedIdentifier(id));
assert(allIdentProtected, 18, 'Identifier translation immunity check', `All ${sampleIdentifiers.length} identifiers verified as protected from translation`);

// Test 19: Repeated language switch stability (en -> hi -> en -> hi -> mr -> gu -> en)
const switchSequence = ['en', 'hi', 'en', 'hi', 'mr', 'gu', 'en'];
let switchPassed = true;
let currentFounder = 'Deep Tirole';
for (const lang of switchSequence) {
  const renderedFounder = localizePersonName(currentFounder, lang);
  const renderedBrand = localizeBrandName('EasyDesk', lang);
  if (renderedBrand !== 'EasyDesk') switchPassed = false;
  if (lang === 'hi' && renderedFounder !== 'दीप तिरोले') switchPassed = false;
  if (['en', 'mr', 'gu'].includes(lang) && renderedFounder !== 'Deep Tirole') switchPassed = false;
}
assert(switchPassed, 19, 'Repeated language switch stability', `Sequence ${switchSequence.join(' -> ')} maintains exact integrity`);

// Test 20: Database integrity verification (db_store.json canonical fields untouched by translations)
const dbFounderName = dbStore?.founder?.name;
const dbFounderLocalized = dbStore?.founder?.localizedNames;
const dbCompanyFounder = dbStore?.companyProfile?.founderName;
const dbIsUntouched = dbFounderName === 'Deep Tirole' &&
                      dbFounderLocalized?.hi === 'दीप तिरोले' &&
                      dbFounderLocalized?.en === 'Deep Tirole' &&
                      dbCompanyFounder === 'Deep Tirole';
assert(dbIsUntouched, 20, 'Database integrity verification', `db_store.json has canonical Deep Tirole without transliteration contamination`);

// -------------------------------------------------------------
// SUMMARY & ACCEPTANCE VERDICT
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('================================================================');

if (failedTests === 0) {
  console.log('\n>>> ACCEPTANCE VERDICT: PASSED ALL 20 PRODUCTION CHECKS <<<\n');
  process.exit(0);
} else {
  console.error(`\n>>> ACCEPTANCE VERDICT: FAILED (${failedTests} tests failed) <<<\n`);
  process.exit(1);
}
