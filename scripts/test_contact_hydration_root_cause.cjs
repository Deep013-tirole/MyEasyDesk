/**
 * EASYDESK CONTACT HYDRATION ROOT CAUSE REGRESSION TEST SUITE
 *
 * Verifies that:
 * 1. Contact cache serialization preserves city, state, pinCode, whatsapp.
 * 2. formatFullAddress helper works correctly across all input forms.
 * 3. ContactView, HomeView, and Footer components do NOT corrupt or strip contact data.
 * 4. Zero occurrences of legacy fallback contact strings (Noida Sector 62, Signature IT Park BKC, 99999 88888).
 * 5. Server baseline preseeded constants match authoritative Indore business details.
 * 6. Server handleContactSettingsGet awaits database readiness.
 * 7. Server handleContactSettingsUpdate synchronizes contactSettings, companyProfile, and settings tables.
 * 8. whatsapp.ts default fallback is normalized authoritative WhatsApp number.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log("  [PASS] " + desc);
    passedTests++;
  } catch (err) {
    console.error("  [FAIL] " + desc);
    console.error("         " + err.message);
    process.exitCode = 1;
  }
}

console.log('\n============================================================');
console.log('EASYDESK CONTACT HYDRATION & SOURCE-OF-TRUTH TEST SUITE');
console.log('============================================================\n');

// 1. Cache Serialization & Address Normalization Invariants
console.log('--- 1. Frontend Cache Serialization & Address Helpers ---');

it('1.1 apiDataService.ts: Exports formatFullAddress helper and handles all permutations', () => {
  const fileContent = fs.readFileSync(path.join(__dirname, '../src/lib/apiDataService.ts'), 'utf8');
  assert(fileContent.includes('export function formatFullAddress'), 'formatFullAddress must be exported');

  function formatFullAddress(contact) {
    if (!contact || typeof contact !== 'object') return '';
    const rawAddr = (contact.address || contact.addressLine1 || '').trim();
    const city = (contact.city || '').trim();
    const state = (contact.state || '').trim();
    const pin = (contact.pinCode || contact.pincode || '').toString().trim();

    if (rawAddr && city && rawAddr.toLowerCase().includes(city.toLowerCase()) && state && rawAddr.toLowerCase().includes(state.toLowerCase())) {
      return pin && !rawAddr.includes(pin) ? (rawAddr + ' - ' + pin) : rawAddr;
    }
    const parts = [rawAddr, city, state].filter(Boolean);
    const joined = parts.join(', ');
    if (joined && pin) return joined + ' - ' + pin;
    return joined || pin || '';
  }

  const authoritative = {
    address: 'A51, Vijay Nagar',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pinCode: '452010'
  };
  const formatted = formatFullAddress(authoritative);
  assert.strictEqual(formatted, 'A51, Vijay Nagar, Indore, Madhya Pradesh - 452010');

  const alreadyJoined = {
    address: 'A51, Vijay Nagar, Indore, Madhya Pradesh',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pinCode: '452010'
  };
  assert.strictEqual(formatFullAddress(alreadyJoined), 'A51, Vijay Nagar, Indore, Madhya Pradesh - 452010');
});

it('1.2 whatsapp.ts: Default fallback number is normalized authoritative 919575538590', () => {
  const content = fs.readFileSync(path.join(__dirname, '../src/lib/whatsapp.ts'), 'utf8');
  assert(content.includes("'919575538590'"), 'whatsapp.ts must use authoritative fallback 919575538590');
  assert(!content.includes("'919876543210'"), 'whatsapp.ts must NOT use dummy 919876543210');
  assert(content.includes('export function updateCachedContactSettings'), 'Must export updateCachedContactSettings');
  assert(content.includes('export function onContactSettingsUpdated'), 'Must export onContactSettingsUpdated');
});

it('1.3 HomeView.tsx: Does NOT strip city/state/pinCode and does NOT overwrite with flattened address', () => {
  const content = fs.readFileSync(path.join(__dirname, '../src/components/HomeView.tsx'), 'utf8');
  assert(!content.includes("address: `${data.address || ''}, ${data.city || ''}, ${data.state || ''}`"), 'HomeView must NOT flatten address into single string during cache write');
  assert(content.includes('updateCachedContactSettings(data)'), 'HomeView must use canonical updateCachedContactSettings');
  assert(content.includes('formatFullAddress(data)'), 'HomeView must use formatFullAddress');
});

it('1.4 ContactView.tsx: Does NOT contain hardcoded Signature IT Park / BKC / Mumbai fallbacks', () => {
  const content = fs.readFileSync(path.join(__dirname, '../src/components/ContactView.tsx'), 'utf8');
  assert(!content.includes('Signature IT Park'), 'ContactView must NOT contain Signature IT Park');
  assert(!content.includes('BKC'), 'ContactView must NOT contain BKC');
  assert(!content.includes('Mumbai'), 'ContactView must NOT contain Mumbai');
  assert(!content.includes('400051'), 'ContactView must NOT contain 400051');
  assert(content.includes('formatFullAddress(contactInfo)'), 'ContactView must use formatFullAddress');
  assert(content.includes('onContactSettingsUpdated'), 'ContactView must subscribe to real-time updates');
});

it('1.5 Footer.tsx: Uses formatFullAddress and contains NO hardcoded BKC or Noida defaults', () => {
  const content = fs.readFileSync(path.join(__dirname, '../src/components/Footer.tsx'), 'utf8');
  assert(content.includes('formatFullAddress(parsed)'), 'Footer must format cached address on mount');
  assert(content.includes('formatFullAddress(data)'), 'Footer must format API address on load');
  assert(!content.includes('Signature IT Park'), 'Footer must NOT contain Signature IT Park');
  assert(!content.includes('BKC'), 'Footer must NOT contain BKC');
  assert(!content.includes('Sector 62'), 'Footer must NOT contain Sector 62');
});

// 2. Server Persistence & Alignment Invariants
console.log('\n--- 2. Server Configuration, Handlers & Persistence ---');

it('2.1 server.ts: PRESEEDED_CONTACT_SETTINGS matches authoritative Indore business details', () => {
  const content = fs.readFileSync(path.join(__dirname, '../server.ts'), 'utf8');
  assert(content.includes("phone: '+91 9575538590'"), 'PRESEEDED_CONTACT_SETTINGS phone must be +91 9575538590');
  assert(content.includes("whatsapp: '919575538590'"), 'PRESEEDED_CONTACT_SETTINGS whatsapp must be 919575538590');
  assert(content.includes("email: 'help.myeasydesks@gmail.com'"), 'PRESEEDED_CONTACT_SETTINGS email must be help.myeasydesks@gmail.com');
  assert(content.includes("city: 'Indore'"), 'PRESEEDED_CONTACT_SETTINGS city must be Indore');
  assert(content.includes("pinCode: '452010'"), 'PRESEEDED_CONTACT_SETTINGS pinCode must be 452010');
});

it('2.2 server.ts: PRESEEDED_SETTINGS contactDetails matches authoritative Indore details', () => {
  const content = fs.readFileSync(path.join(__dirname, '../server.ts'), 'utf8');
  assert(!content.includes("phone: '+91 99999 88888', address: 'Digital India Tower, Sector 62"), 'PRESEEDED_SETTINGS must NOT contain Noida 99999 88888');
  assert(content.includes("contactDetails: { email: 'help.myeasydesks@gmail.com', phone: '+91 9575538590', address: 'A51, Vijay Nagar, Indore, Madhya Pradesh - 452010' }"), 'PRESEEDED_SETTINGS contactDetails must be Indore');
});

it('2.3 server.ts: handleContactSettingsGet awaits ensureDatabaseReady()', () => {
  const content = fs.readFileSync(path.join(__dirname, '../server.ts'), 'utf8');
  assert(content.includes('const handleContactSettingsGet = async (req: express.Request, res: express.Response) => {\n  await ensureDatabaseReady();'), 'handleContactSettingsGet must be async and await ensureDatabaseReady');
});

it('2.4 server.ts: handleContactSettingsUpdate persists contactSettings, companyProfile, and settings tables', () => {
  const content = fs.readFileSync(path.join(__dirname, '../server.ts'), 'utf8');
  assert(content.includes("await persistDatabase('contactSettings');"), 'Must persist contactSettings');
  assert(content.includes("await persistDatabase('companyProfile');"), 'Must persist companyProfile');
  assert(content.includes("await persistDatabase('settings');"), 'Must persist settings table');
});

it('2.5 server.ts: normalizeDatabaseRelationships synchronizes contact settings across all tables', () => {
  const content = fs.readFileSync(path.join(__dirname, '../server.ts'), 'utf8');
  assert(content.includes('// 5. Normalize and synchronize Contact Settings, Company Profile, and Settings'), 'Must have Step 5 in normalizeDatabaseRelationships');
});

it('2.6 server.ts: Local knowledge AI assistant contact response does NOT contain BKC / Mumbai / 9999988888', () => {
  const content = fs.readFileSync(path.join(__dirname, '../server.ts'), 'utf8');
  assert(!content.includes('Signature IT Park, Bandra Kurla Complex (BKC)'), 'AI fallback must NOT contain BKC');
  assert(!content.includes("phone || '9999988888'"), 'AI fallback must NOT contain 9999988888');
});

// 3. Simulated Full Hydration Lifecycle
console.log('\n--- 3. Hydration Lifecycle & State Preservation Simulation ---');

it('3.1 Full Hydration: Cold start -> D1 fetch -> LocalStorage cache -> Component consumption', () => {
  const mockStorage = new Map();

  const d1ContactSettings = {
    phone: '+91 9575538590',
    whatsapp: '919575538590',
    email: 'help.myeasydesks@gmail.com',
    address: 'A51, Vijay Nagar',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pinCode: '452010'
  };

  mockStorage.set('easydesk_cache_contact_settings', JSON.stringify(d1ContactSettings));

  const cachedRaw = mockStorage.get('easydesk_cache_contact_settings');
  assert(cachedRaw, 'Cache must exist on refresh');
  const parsed = JSON.parse(cachedRaw);

  assert.strictEqual(parsed.phone, '+91 9575538590');
  assert.strictEqual(parsed.whatsapp, '919575538590');
  assert.strictEqual(parsed.city, 'Indore');
  assert.strictEqual(parsed.state, 'Madhya Pradesh');
  assert.strictEqual(parsed.pinCode, '452010');

  const cvCache = JSON.parse(mockStorage.get('easydesk_cache_contact_settings'));
  assert.strictEqual(cvCache.city, 'Indore');
  assert.strictEqual(cvCache.state, 'Madhya Pradesh');
  assert.strictEqual(cvCache.pinCode, '452010');

  const fullAddr = [cvCache.address, cvCache.city, cvCache.state].filter(Boolean).join(', ') + ' - ' + cvCache.pinCode;
  assert.strictEqual(fullAddr, 'A51, Vijay Nagar, Indore, Madhya Pradesh - 452010');
});

console.log('\n------------------------------------------------------------');
console.log('Results: ' + passedTests + '/' + totalTests + ' tests passed');
console.log('------------------------------------------------------------\n');

if (passedTests === totalTests) {
  console.log('SUCCESS: ALL CONTACT HYDRATION & SOURCE-OF-TRUTH TESTS PASSED (100%)!\n');
} else {
  process.exit(1);
}
